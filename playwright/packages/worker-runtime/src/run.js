const path = require('path')
const fs = require('fs')
const { Commands, Events, makeMessage } = require('@platform/shared')

let browser = null
let context = null
let page = null
let stopping = false
let paused = false
let mode = 'state'
let storageKey = null
let chatSelector = null
let chatInputSelector = null

function send(msg) {
  if (process.send) process.send(msg)
}

function computeKeys(scriptPath, opts) {
  const key = opts.storageKey || path.basename(path.dirname(scriptPath))
  const base = path.join(process.cwd(), 'data')
  return {
    storageStatePath: path.join(base, 'storage', `${key}.json`),
    userDataDir: path.join(base, 'profile', key)
  }
}

async function launchBrowser(opts = {}, scriptPath) {
  const pw = require('playwright')
  const channel = opts.channel || 'chrome'
  const headless = opts.headless ?? false
  const args = Array.isArray(opts.args) ? opts.args : []
  if (!args.find(a => String(a).includes('disable-blink-features'))) args.push('--disable-blink-features=AutomationControlled')
  const proxy = opts.proxy ? { server: opts.proxy.server, username: opts.proxy.username, password: opts.proxy.password } : undefined
  const ctxOptions = {
    viewport: opts.viewport,
    userAgent: opts.userAgent,
    locale: opts.locale,
    timezoneId: opts.timezoneId,
    colorScheme: opts.colorScheme,
    permissions: []
  }
  mode = opts.persistMode || 'state'
  const keys = computeKeys(scriptPath, opts)
  storageKey = keys
  if (mode === 'profile' && (opts.persistLogin || opts.userDataDir)) {
    const dir = opts.userDataDir || keys.userDataDir
    fs.mkdirSync(dir, { recursive: true })
    context = await pw.chromium.launchPersistentContext(dir, { channel, headless, args, proxy, ...ctxOptions })
    browser = context.browser()
    page = await context.newPage()
  } else {
    // default: storageState based persistence
    if (fs.existsSync(keys.storageStatePath)) ctxOptions.storageState = keys.storageStatePath
    browser = await pw.chromium.launch({ channel, headless, args, proxy })
    context = await browser.newContext(ctxOptions)
    page = await context.newPage()
  }
  const headers = opts.headers || {}
  if (headers && Object.keys(headers).length) await context.setExtraHTTPHeaders(headers)
  await page.addInitScript(() => {
    try {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
      const origPlugins = navigator.plugins
      Object.defineProperty(navigator, 'plugins', { get: () => origPlugins })
      const langs = navigator.languages
      Object.defineProperty(navigator, 'languages', { get: () => langs })
    } catch (_) {}
  })
  if (opts.watch && opts.watch.chatSelector) {
    chatSelector = opts.watch.chatSelector
    await setupChatWatcher(chatSelector)
  }
  if (opts.watch && opts.watch.chatInputSelector) {
    chatInputSelector = opts.watch.chatInputSelector
  }
}

async function closeBrowser() {
  try { if (context) await context.close() } catch (_) {}
  try { if (browser) await browser.close() } catch (_) {}
  context = null
  browser = null
  page = null
}

async function heartbeat() {
  const mem = process.memoryUsage()
  send(makeMessage(Events.HEARTBEAT, { mem, url: page?.url() }))
}

function startHeartbeat() {
  return setInterval(heartbeat, 2000)
}

async function runScript(scriptPath, opts) {
  const mod = require(path.resolve(scriptPath))
  await launchBrowser(opts, scriptPath)
  try {
    if (typeof mod.run !== 'function') throw new Error('脚本未导出 run')
    const gatedPage = wrapPage(page)

    // 自动保存登录态逻辑
    if (opts.persistLogin && storageKey?.storageStatePath) {
      context.on('page', async (p) => {
        // 监听特定事件以触发保存
        p.on('load', async () => {
           // 页面加载完成后尝试保存一次，避免频繁IO，可以加 debounce，这里简化处理
           try {
             await context.storageState({ path: storageKey.storageStatePath })
           } catch (_) {}
        })
      })
    }

    const utils = {
      ensureLogin: async (options = {}) => {
         const { urlPattern, checkFn } = options;
         send(makeMessage(Events.LOG, { level: 'info', message: '正在检查登录状态...' }));
         
         let isLoggedIn = false;
         if (checkFn) {
           isLoggedIn = await checkFn(page);
         } else if (urlPattern) {
           isLoggedIn = !page.url().match(urlPattern); // 如果当前URL匹配“登录页”，则未登录
         } else {
           // 默认策略：检查是否有任何 cookies
           const cookies = await context.cookies();
           isLoggedIn = cookies.length > 0;
         }

         if (!isLoggedIn) {
           send(makeMessage(Events.LOG, { level: 'warn', message: '未检测到登录状态，暂停脚本执行。请在浏览器中手动登录...' }));
           paused = true; // 暂停脚本执行逻辑
           send(makeMessage(Events.STATE, { state: 'paused_for_login' }));

           // 轮询等待登录成功
           while (!stopping) {
             await new Promise(r => setTimeout(r, 1000));
             
             // 检查是否登录成功
             let nowLogged = false;
             if (checkFn) {
               nowLogged = await checkFn(page);
             } else {
               // 简单检查：如果有 cookies 且 URL 不再是登录页（如果有 pattern）
               const cookies = await context.cookies();
               if (cookies.length > 0) {
                 if (urlPattern) {
                   nowLogged = !page.url().match(urlPattern);
                 } else {
                   nowLogged = true;
                 }
               }
             }

             if (nowLogged) {
               send(makeMessage(Events.LOG, { level: 'info', message: '检测到登录成功！保存状态并恢复脚本...' }));
               if (storageKey?.storageStatePath) {
                 await context.storageState({ path: storageKey.storageStatePath });
               }
               paused = false;
               send(makeMessage(Events.STATE, { state: 'running' }));
               break;
             }
           }
         } else {
           send(makeMessage(Events.LOG, { level: 'info', message: '登录状态检查通过。' }));
         }
      }
    }

    await mod.run({ browser, context, page: gatedPage, utils }, {
      cancel: () => { stopping = true },
    })
    if ((opts.persistLogin || opts.saveStorageState) && mode === 'state' && storageKey?.storageStatePath) {
      fs.mkdirSync(path.dirname(storageKey.storageStatePath), { recursive: true })
      await context.storageState({ path: storageKey.storageStatePath })
      send(makeMessage(Events.LOG, { level: 'info', message: `保存登录存储: ${storageKey.storageStatePath}` }))
    }
    send(makeMessage(Events.DONE, { ok: true }))

    // 如果开启了 headless: false (有界面模式)，或者是聊天监听模式，则保持浏览器不关闭
    if (opts.headless === false || (opts.watch && opts.watch.chatSelector)) {
       send(makeMessage(Events.LOG, { level: 'info', message: '脚本执行完毕，保持浏览器开启...' }))
       // 挂起 Promise，直到收到 STOP 命令或手动关闭
       await new Promise((resolve) => {
         const checkInterval = setInterval(() => {
           if (stopping || !browser || !browser.isConnected()) {
             clearInterval(checkInterval)
             resolve()
           }
         }, 1000)
       })
    }
  } catch (err) {
    send(makeMessage(Events.ERROR, { message: err.message }))
  } finally {
    await closeBrowser()
  }
}

async function waitIfPaused() {
  while (paused && !stopping) {
    await new Promise(r => setTimeout(r, 250))
  }
}

function wrapPage(p) {
  const gated = new Set([
    'goto','click','dblclick','fill','type','press','hover','check','uncheck','selectOption',
    'waitForSelector','waitForLoadState','waitForNavigation','evaluate','evaluateHandle'
  ])
  return new Proxy(p, {
    get(target, prop, receiver) {
      const val = Reflect.get(target, prop, receiver)
      if (typeof val === 'function' && gated.has(prop)) {
        return async function(...args) { await waitIfPaused(); return val.apply(target, args) }
      }
      return val
    }
  })
}

async function setupChatWatcher(selector) {
  await page.exposeBinding('emitChat', (source, payload) => {
    send(makeMessage(Events.CHAT_MESSAGE, payload))
  })
  const s = String(selector)
  await page.evaluate((sel) => {
    const target = document.querySelector(sel)
    if (!target) return
    const emit = (data) => {
      // @ts-ignore
      window.emitChat(data)
    }
    const parseNode = (node) => {
      const text = node.textContent || ''
      const html = node.outerHTML || ''
      const ts = Date.now()
      emit({ text, html, ts })
    }
    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes && m.addedNodes.forEach(n => { if (n.nodeType === 1) parseNode(n) })
      }
    })
    obs.observe(target, { childList: true, subtree: true })
  }, s)
}

function handleMessage(msg) {
  const { type, payload } = msg || {}
  if (type === Commands.START) {
    send(makeMessage(Events.STATE, { state: 'starting' }))
    const hb = startHeartbeat()
    runScript(payload.scriptPath, payload.options).finally(() => {
      clearInterval(hb)
      send(makeMessage(Events.STATE, { state: 'stopped' }))
    })
  } else if (type === Commands.PAUSE) {
    paused = true
    send(makeMessage(Events.STATE, { state: 'paused' }))
  } else if (type === Commands.RESUME) {
    paused = false
    send(makeMessage(Events.STATE, { state: 'running' }))
  } else if (type === Commands.STOP) {
    stopping = true
    closeBrowser().finally(() => send(makeMessage(Events.DONE, { stopped: true })))
  } else if (type === Commands.STATUS) {
    send(makeMessage(Events.STATE, { state: browser ? 'running' : 'idle' }))
  } else if (type === Commands.PING) {
    send(makeMessage(Events.HEARTBEAT, { ping: true }))
  } else if (type === Commands.AGENT_ACTIONS) {
    executeActions(payload.actions || []).then((results) => {
      send(makeMessage(Events.ACTION_RESULT, { results }))
    }).catch(err => {
      send(makeMessage(Events.ERROR, { message: err.message }))
    })
  }
}

async function executeActions(actions) {
  const results = []
  for (const a of actions) {
    if (stopping) break
    const t = String(a.type || '').toUpperCase()
    if (t === 'SEND_MESSAGE') {
      const r = await actionSendMessage(a.text || '')
      results.push({ type: t, ok: true, detail: r })
    } else if (t === 'CLICK') {
      await page.click(a.selector)
      results.push({ type: t, ok: true })
    } else if (t === 'TYPE') {
      await page.fill(a.selector, a.text || '')
      results.push({ type: t, ok: true })
    } else if (t === 'WAIT') {
      await page.waitForSelector(a.selector, { timeout: a.timeout || 10000 })
      results.push({ type: t, ok: true })
    } else {
      results.push({ type: t, ok: false, error: 'unknown' })
    }
    await humanPause()
  }
  return results
}

async function humanPause() {
  const ms = 300 + Math.floor(Math.random() * 700)
  await new Promise(r => setTimeout(r, ms))
}

async function actionSendMessage(text) {
  let inputSel = chatInputSelector
  if (!inputSel && chatSelector) {
    inputSel = `${chatSelector} input, ${chatSelector} textarea`
  }
  if (!inputSel) throw new Error('no chat input selector')
  const loc = page.locator(inputSel).first()
  await loc.click()
  await loc.type(text, { delay: 50 + Math.floor(Math.random() * 50) })
  try {
    await page.keyboard.press('Enter')
  } catch (_) {}
  return { sent: true }
}

process.on('message', handleMessage)
send(makeMessage(Events.READY))
