/**
 * 会话与浏览器启动（持久化）
 * - 保留登录态：使用用户数据目录；遇到单例锁冲突时复制原目录到新目录，跳过锁文件
 * - 反检测注入：隐藏 webdriver、补全语言与插件、修补 WebGL 指纹
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require('playwright');

const sessions = new Map();

/**
 * 随机等待 0.5–1 秒（默认），降低时序与反爬风险
 * @param {import('playwright').Page} page
 * @param {number} min
 * @param {number} max
 */
async function waitRand(page, min = 500, max = 1000){
  const t = Math.floor(min + Math.random() * (max - min));
  try{ await page.waitForTimeout(t); }catch{}
}

function getUserDataDir(appUserDataPath, plat){
  const base = appUserDataPath || path.join(os.homedir(), '.autoOperation');
  const dir = path.join(base, 'playwright', String(plat||'default'));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function copyDirSafe(src, dest){
  try{ fs.mkdirSync(dest, { recursive: true }); }catch{}
  let entries=[]; try{ entries = fs.readdirSync(src, { withFileTypes: true }); }catch{ entries=[]; }
  for(const e of entries){
    const name = e.name;
    if (/^Singleton/i.test(name)) continue;
    const sp = path.join(src, name);
    const dp = path.join(dest, name);
    try{
      if (e.isDirectory()){ copyDirSafe(sp, dp); }
      else { fs.copyFileSync(sp, dp); }
    }catch{}
  }
}

/**
 * 启动持久化浏览器会话
 * @param {{plat?:string,url?:string,appUserDataPath?:string}} opts
 * @returns {{context: import('playwright').BrowserContext, page: import('playwright').Page, plat:string, userDataDir:string}}
 */
async function startSession({ plat='xhs', url='https://www.xiaohongshu.com/explore', appUserDataPath=null }){
  if (sessions.has(plat)) return sessions.get(plat);
  const baseDir = getUserDataDir(appUserDataPath, plat);
  const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  let usedDir = baseDir;
  let context;
  async function launchWithDir(dir){
    const ctx = await chromium.launchPersistentContext(dir, {
      headless: false,
      viewport: { width: 1280, height: 900 },
      userAgent: ua,
      args: ['--lang=zh-CN','--disable-blink-features=AutomationControlled'],
      acceptDownloads: true,
      extraHTTPHeaders: { 'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7' },
      timezoneId: 'Asia/Shanghai',
      locale: 'zh-CN'
    });
    return ctx;
  }
  try{
    context = await launchWithDir(usedDir);
  }catch(e){
    const msg = String(e && e.message || '');
    if (/ProcessSingleton|SingletonLock|profile is already in use/i.test(msg)){
      usedDir = path.join(path.dirname(baseDir), String(plat)+('-'+Date.now()));
      fs.mkdirSync(usedDir, { recursive: true });
      try{ copyDirSafe(baseDir, usedDir); }catch{}
      context = await launchWithDir(usedDir);
    } else {
      throw e;
    }
  }
  await context.addInitScript({ content: `(()=>{try{Object.defineProperty(navigator,'webdriver',{get:()=>undefined,configurable:true});}catch{}try{window.chrome=window.chrome||{runtime:{}};}catch{}try{Object.defineProperty(navigator,'languages',{get:()=>['zh-CN','zh','en-US'],configurable:true});}catch{}try{Object.defineProperty(navigator,'plugins',{get:()=>[{name:'Chrome PDF Plugin'},{name:'Chrome PDF Viewer'},{name:'Native Client'}],configurable:true});}catch{}try{const q=navigator.permissions&&navigator.permissions.query; if(q){navigator.permissions.query=(p)=>p&&p.name==='notifications'?Promise.resolve({state:Notification.permission}):q(p);} }catch{}try{const gp=WebGLRenderingContext.prototype.getParameter; WebGLRenderingContext.prototype.getParameter=function(p){if(p===37445)return 'Intel Inc.'; if(p===37446)return 'Intel Iris OpenGL Engine'; return gp.call(this,p);} }catch{} })()` });
  const page = context.pages()[0] || await context.newPage();
  const targetUrl = (typeof url === 'string' && url) ? url : (plat==='xhs' ? 'https://www.xiaohongshu.com/explore' : 'about:blank');
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  await waitRand(page);
  const session = { context, page, plat, userDataDir: usedDir };
  sessions.set(plat, session);
  return session;
}

async function stopSession(plat='xhs'){
  const s = sessions.get(plat);
  if (!s) return { ok: true };
  try{ await s.context.close(); }catch{}
  sessions.delete(plat);
  return { ok: true };
}

module.exports = { startSession, stopSession, waitRand };

