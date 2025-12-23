const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require('playwright');
// simplified: no overlay UI, no runner, no autoop selectors

const sessions = new Map();
const videoNetMap = new WeakMap();
async function waitRand(page, min=500, max=1000){ const t = Math.floor(min + Math.random() * (max - min)); try{ await page.waitForTimeout(t); }catch{} }

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
      proxy: undefined,
      storageState: undefined,
      baseURL: undefined,
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
  const videoNet = new Set();
  page.on('requestfinished', async (req)=>{
    try{
      const url = req.url();
      if (/\.m3u8(\?|$)|\.mp4(\?|$)/i.test(url)){ videoNet.add(url); return; }
      const resp = await req.response();
      const ct = resp && (resp.headers()['content-type']||resp.headers()['Content-Type']);
      if (ct && /(video|application\/x-mpegURL)/i.test(ct)) videoNet.add(url);
    }catch{}
  });
  videoNetMap.set(page, videoNet);

  // simplified: no overlay, no exposed bindings
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

async function search(page, kw){
  const selectors = [
    'input[placeholder*="搜索小红书"]',
    'input[type="search"]',
    'input[placeholder*="搜索"]',
    'input[aria-label*="搜索"]',
    'input'
  ];
  function pickVisible(){ return page.evaluate((sels)=>{
    function vis(el){ if(!el) return false; const st=getComputedStyle(el); if(st.display==='none'||st.visibility==='hidden'||parseFloat(st.opacity||'1')<0.1) return false; const r=el.getBoundingClientRect(); return r.width>20&&r.height>20; }
    for(const s of sels){ const el=document.querySelector(s); if(el && vis(el)){ try{ el.scrollIntoView({behavior:'instant',block:'center'}); }catch{} return s; } }
    return '';
  }, selectors); }
  const sel = await pickVisible();
  if (!sel) { console.log('[search] no input found'); return { ok:false, reason:'no_input' }; }
  const handle = await page.$(sel);
  if (!handle) { console.log('[search] selector not handleable', sel); return { ok:false, reason:'no_handle', selector: sel }; }
  await handle.focus();
  await waitRand(page);
  await page.keyboard.type(String(kw||''), { delay: 30 });
  await waitRand(page);
  await page.keyboard.press('Enter');
  await page.waitForLoadState('domcontentloaded');
  await waitRand(page);
  try{
    await page.evaluate(()=>{
      function tryClick(el){ try{ el.scrollIntoView({behavior:'instant',block:'center'}); }catch{} try{ el.click(); return true; }catch{} try{ el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return true; }catch{} return false; }
      const cand = Array.from(document.querySelectorAll('a, button, div, span'));
      const tab = cand.find(el=>/笔记/.test(String(el.textContent||'')) && /tab|nav|filter|menu/i.test(String(el.className||'')));
      if (tab) tryClick(tab);
      else {
        const link = Array.from(document.querySelectorAll('a')).find(a=>/type=54/.test(String(a.href||'')));
        if (link) tryClick(link);
      }
    });
    await page.waitForLoadState('domcontentloaded');
    await waitRand(page);
  }catch{}
  console.log('[search] submitted', { selector: sel, url: await page.url() });
  return { ok:true, selector: sel, url: await page.url() };
}

module.exports = { startSession, stopSession, search };

async function openFirstNote(page){
  const candidates = [
    'a[href^="/explore/"]',
    'a[href*="/explore/"]',
    'a[href*="/discovery/item"]',
    '[data-note-id]',
    '.note-item',
    'article[role="article"]'
  ];
  try{ await page.waitForSelector(candidates.join(', '), { timeout: 6000 }); }catch{}
  const handles = [];
  for (let i=0;i<8;i++){
    for (const s of candidates){ const hs = await page.$$(s); if (hs && hs.length) hs.forEach(h=>handles.push(h)); }
    if (handles.length>0) break;
    try{ await page.evaluate((n)=>window.scrollBy(0, n), 600); }catch{}
    await page.waitForTimeout(400);
  }
  let target = null; let targetHref = '';
  for (const h of handles){ const box = await h.boundingBox(); if (box && box.width>20 && box.height>20){
      try{ await h.evaluate(el=>{ try{ el.scrollIntoView({behavior:'instant',block:'center'}); }catch{} }); }catch{}
      target = h; try{ targetHref = await h.getAttribute('href'); }catch{}
      break; } }
  if (!target){
    // fallback: try programmatic click via DOM
    const prog = await page.evaluate((sels)=>{
      function vis(el){ if(!el) return false; const st=getComputedStyle(el); if(st.display==='none'||st.visibility==='hidden') return false; const r=el.getBoundingClientRect(); return r.width>20&&r.height>20; }
      function tryClick(el){ try{ el.scrollIntoView({behavior:'instant',block:'center'}); }catch{} try{ el.click(); return true; }catch{} try{ el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return true; }catch{} return false; }
      for (const s of sels){ const el = document.querySelector(s); if(el && vis(el)){ if(tryClick(el)){ return { ok:true, href: (el.href||'') }; } } }
      // scroll and retry
      try{ window.scrollBy(0, 400); }catch{}
      for (const s of sels){ const el = document.querySelector(s); if(el && vis(el)){ if(tryClick(el)){ return { ok:true, href: (el.href||'') }; } } }
      // brute-force anchors
      const a = Array.from(document.querySelectorAll('a')).find(x=>/\/explore\/[\w-]+/.test(String(x.href||''))||/\/discovery\/item\/[\w-]+/.test(String(x.href||'')));
      if (a && tryClick(a)) return { ok:true, href: a.href||'' };
      return { ok:false };
    }, candidates);
    if (!prog || !prog.ok){
      const href = await page.evaluate(()=>{
        const m = Array.from(document.querySelectorAll('a')).map(a=>a.href||'').find(h=>/\/explore\/[\w-]+/.test(h)||/\/discovery\/item\/[\w-]+/.test(h));
        return m||'';
      });
      if (href){ try{ await page.goto(href, { waitUntil: 'domcontentloaded' }); }catch{} targetHref = href; }
      else { console.log('[openFirstNote] no candidate elements'); return { ok:false, reason:'no_candidate' }; }
    } else {
      targetHref = (prog && prog.href) || '';
    }
  } else {
    // prefer element click; if fails, fallback to mouse click center
    const box = await target.boundingBox();
    let clicked = false;
    try{ await target.click(); clicked = true; }catch{}
    if (!clicked && box){ try{ await page.mouse.click(Math.round(box.x+box.width/2), Math.round(box.y+box.height/2)); clicked = true; }catch{} }
    await waitRand(page);
    if (!clicked){ console.log('[openFirstNote] click failed'); return { ok:false, reason:'click_failed' }; }
  }
  // wait for url change or detail heuristics
  const startUrl = await page.url();
  const deadline = Date.now()+6000; let finalUrl = startUrl;
  while(Date.now()<deadline){ finalUrl = await page.url(); if (/\/explore\//.test(finalUrl) || /\/discovery\/item\//.test(finalUrl)) break; await page.waitForTimeout(200); }
  console.log('[openFirstNote] opened', { href: targetHref, url: finalUrl });
  return { ok:true, href: targetHref, url: finalUrl };
}

module.exports.openFirstNote = openFirstNote;

async function extractNote(page){
  // wait for detail content to render
  try{ await page.waitForSelector('#detail-title, #detail-desc, .username, .total, article, .note-content, [data-content]', { timeout: 6000 }); }catch{}
  let data = await page.evaluate(()=>{
    const url = location.href;
    const id = (url.match(/\/explore\/([\w]+)/)||[])[1]||'';
    // scope to main detail container to avoid picking list or comment images
    const containers = [
      document.querySelector('article'),
      document.querySelector('.note-content'),
      document.querySelector('[data-content]')
    ].filter(Boolean);
    const root = containers[0] || document.body;
    function pickText(){ const el = document.getElementById('detail-desc') || root; const t = String(el.textContent||'').trim(); return t; }
    function pickTitle(){ const el = document.getElementById('detail-title'); if (el) return String(el.textContent||'').trim();
      const cand=[ 'h1', 'h2', '[data-title]', '.title' ]; for(const s of cand){ const el2=(root.querySelector && root.querySelector(s)) || document.querySelector(s); if(el2){ const t=String(el2.textContent||'').trim(); if(t) return t; } }
      const meta = document.querySelector('meta[property="og:title"]'); if (meta){ const mt=String(meta.content||'').trim(); if(mt) return mt; }
      const tx = String((document.getElementById('detail-desc')||root).textContent||'').trim(); if(tx){ const first = tx.split(/\n|\r/).map(s=>s.trim()).find(s=>s.length>0) || ''; return first; }
      return '';
    }
    function pickAuthor(){ const u = document.querySelector('.username'); if (u){ const t=String(u.textContent||'').trim(); if(t) return t; }
      const cand=[ 'a[href*="/user/profile"]', 'header a[href*="/user/"]', '[class*="author"] a', '.author a', '[class*="nickname"]', '[data-author]' ];
      for(const s of cand){ const el=document.querySelector(s); if(el){ const t=String(el.textContent||'').trim(); if(t && !/^关(注|\s*注)?$/.test(t) && t!=='我') return t; } }
      const meta = document.querySelector('meta[name="author"], meta[property="og:author"]'); return meta?String(meta.content||''):''; }
    function pickPublishDate(){
      const els = Array.from(document.querySelectorAll('*'));
      const m = els.map(e=>String(e.textContent||'').trim()).find(tx=>/\b\d{2}-\d{2}\b/.test(tx));
      const mm = m ? (m.match(/\b\d{2}-\d{2}\b/)||[])[0] : '';
      return mm||'';
    }
    function pickCommentsCount(){ const tEl = document.querySelector('.total'); if (tEl){ const tx = String(tEl.textContent||'').trim(); const m = tx.match(/共\s*(\d+)\s*条评论/); if(m) return parseInt(m[1],10)||0; }
      const els = Array.from(document.querySelectorAll('*')); for(const e of els){ const tx=String(e.textContent||'').trim(); const m=tx.match(/^共\s*(\d+)\s*条评论$/); if(m) return parseInt(m[1],10)||0; }
      return null; }
    function imgUrls(){ const out=[]; const scope = root.querySelectorAll ? root : document; const imgs = scope.querySelectorAll('img, picture img, img.live-img, img[data-src], img[data-original]'); imgs.forEach(img=>{ let src = img.currentSrc || img.src || img.getAttribute('data-src') || img.getAttribute('data-original') || ''; if(!src){ const ss = img.srcset||''; if(ss){ const parts = ss.split(',').map(s=>s.trim()); const last = parts[parts.length-1]||''; src = String(last.split(' ')[0]||'').trim(); } }
      if(src) out.push(src); }); const bgEls = scope.querySelectorAll('[style*="background-image"]'); bgEls.forEach(el=>{ const st = String(el.getAttribute('style')||''); const m = st.match(/url\(([^)]+)\)/i); if(m){ const u = m[1].replace(/['"]/g,''); if(u) out.push(u); } }); const uniq = Array.from(new Set(out)); return uniq; }
    function videoInfo(){
      const vids = (root.querySelectorAll ? root.querySelectorAll('video') : document.querySelectorAll('video'));
      const sources = (root.querySelectorAll ? root.querySelectorAll('video, source') : document.querySelectorAll('video, source'));
      const urls = []; sources.forEach(v=>{ const src=v.src||v.currentSrc||''; if(src) urls.push(src); });
      let status = 'none'; let errorMsg = '';
      if (vids && vids.length){
        const v = vids[0]; const r=v.getBoundingClientRect(); const vis = r.width>20 && r.height>20 && getComputedStyle(v).visibility!=='hidden' && getComputedStyle(v).display!=='none';
        status = vis ? 'visible' : 'hidden';
      }
      if (status!=='visible'){
        const msg = Array.from(document.querySelectorAll('body *')).map(el=>String(el.textContent||''))
          .find(tx=>/刷新试试/.test(tx));
        if (msg){ status = 'placeholder_message'; errorMsg = '请刷新试试'; }
      }
      return { urls, status, errorMsg };
    }
    const vi = videoInfo();
    return { id, url, title: pickTitle(), author: pickAuthor(), text: pickText(), images: imgUrls(), videos: vi.urls, video_status: vi.status, video_error: vi.errorMsg, published_at: pickPublishDate(), comments_count: pickCommentsCount() };
  });
  if ((!data.videos || data.videos.length===0) && data.video_status!=='visible'){
    const pr = await tryPlayVideo(page);
    data = { ...data, videos: pr.urls, video_status: pr.status };
  }
  await waitRand(page);
  const netSet = videoNetMap.get(page);
  if (netSet && netSet.size){
    const arr = Array.from(netSet);
    data = { ...data, videos_net: arr };
  }
  
  return data;
}

module.exports.extractNote = extractNote;

async function tryPlayVideo(page){
  const res = await page.evaluate(()=>{
    const root = document.querySelector('article') || document.querySelector('.note-content') || document.querySelector('[data-content]') || document.body;
    const v = root.querySelector('video');
    if (v){ try{ v.play(); }catch{} try{ v.click(); }catch{} try{ v.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); }catch{} }
    else {
      const btn = Array.from(root.querySelectorAll('button, a, div, span')).find(el=>/播放|play/i.test(String(el.textContent||'')) || /play/i.test(String(el.className||'')));
      if (btn){ try{ btn.click(); }catch{} }
      else { try{ root.click(); }catch{} }
    }
    const urls = Array.from(root.querySelectorAll('video, source')).map(x=>x.src||x.currentSrc||'').filter(Boolean);
    let status = 'none';
    if (v){ const r=v.getBoundingClientRect(); const vis = r.width>20 && r.height>20 && getComputedStyle(v).visibility!=='hidden' && getComputedStyle(v).display!=='none'; status = vis ? 'visible' : 'hidden'; }
    return { urls, status };
  });
  await waitRand(page);
  return res;
}

module.exports.tryPlayVideo = tryPlayVideo;
async function collectSearchList(page, opts={}){
  const limit = Math.max(1, parseInt((opts && opts.limit) || 50, 10) || 50);
  const doScroll = !(opts && opts.scroll===false);
  const uniq = new Map();
  const maxIters = doScroll ? 40 : 1;
  const candidates = [
    'a[href^="/explore/"]',
    'a[href*="/explore/"]',
    'a[href*="/discovery/item"]',
    '[data-note-id]',
    '.note-item',
    'article[role="article"]'
  ];
  try{ await page.waitForLoadState('domcontentloaded'); }catch{}
  if (!doScroll){ try{ await page.evaluate(()=>{ try{ window.scrollBy(0, 300); }catch{} }); }catch{} await waitRand(page); try{ await page.evaluate(()=>{ try{ window.scrollTo(0, 0); }catch{} }); }catch{} }
  try{ await page.waitForSelector(candidates.join(', '), { timeout: 8000 }); }catch{}
  for (let i=0;i<maxIters;i++){
    const items = await page.evaluate(()=>{
      function vis(el){ if(!el) return false; const st=getComputedStyle(el); if(st.display==='none'||st.visibility==='hidden') return false; const r=el.getBoundingClientRect(); return r.width>40&&r.height>40; }
      function pickTitle(el){ const cand=[ '[aria-label]', '[data-title]' ]; for(const s of cand){ const t=(el.querySelector(s)||el).getAttribute && (el.querySelector(s)||el).getAttribute('aria-label'); if(t) return String(t).trim(); } const tt = String(el.textContent||'').trim(); if(tt) return tt; const img = el.querySelector('img'); const alt = img ? (img.getAttribute('alt')||'') : ''; return String(alt||'').trim(); }
      function pickAuthor(el){ const cand=[ '.author', '[class*="author"]', '.username', '[class*="nickname"]' ]; for(const s of cand){ const m = el.querySelector(s) || document.querySelector(s); if(m){ const t=String(m.textContent||'').trim(); if(t && !/^关(注|\s*注)?$/.test(t) && t!=='我') return t; } } return ''; }
      function pickCover(el){ const img = el.querySelector('img, img.live-img, img[data-src], img[data-original]'); if(!img) return ''; let src = img.currentSrc || img.src || img.getAttribute('data-src') || img.getAttribute('data-original') || ''; if(!src){ const ss = img.srcset||''; if(ss){ const parts = ss.split(',').map(s=>s.trim()); const last = parts[parts.length-1]||''; src = String(last.split(' ')[0]||'').trim(); } } return src||''; }
      const anchors = Array.from(document.querySelectorAll('a')).filter(a=>/\/explore\/[\w-]+/.test(String(a.href||''))||/\/discovery\/item\/[\w-]+/.test(String(a.href||'')));
      const out = [];
      for(const a of anchors){ if(!vis(a)) continue; const href = a.href || ''; if(!href) continue; const id = (href.match(/\/explore\/([\w-]+)/)||href.match(/\/discovery\/item\/([\w-]+)/)||[])[1]||''; const card = a.closest('article')||a.closest('.note-item')||a.closest('[data-note-id]')||a;
        const title = pickTitle(card||a);
        const author = pickAuthor(card||a);
        const cover = pickCover(card||a);
        const snippet = String((card||a).textContent||'').trim();
        out.push({ href, noteId: id, title, author, cover, snippet });
      }
      const origin = location.origin;
      const cards = Array.from(document.querySelectorAll('[data-note-id], .note-item, article[role="article"]'));
      for(const c of cards){ if(!vis(c)) continue; const id = (c.getAttribute('data-note-id')||'').trim(); if(!id) continue; const href = origin + '/explore/' + id; if (out.find(x=>x.href===href)) continue; const title = pickTitle(c); const author = pickAuthor(c); const cover = pickCover(c); const snippet = String(c.textContent||'').trim(); out.push({ href, noteId: id, title, author, cover, snippet }); }
      return out;
    });
    for(const it of items){ if(!uniq.has(it.href)) uniq.set(it.href, it); }
    if(uniq.size>=limit) break;
    if (doScroll){ try{ await page.evaluate((n)=>window.scrollBy(0, n), 800); }catch{} await waitRand(page); }
  }
  const list = Array.from(uniq.values()).slice(0, limit);
  return list;
}

module.exports.collectSearchList = collectSearchList;
function createOpLogger(){
  const logs = [];
  function log(step, info){ logs.push({ step: String(step||''), time: Date.now(), ...(info||{}) }); }
  return { logs, log };
}

module.exports.createOpLogger = createOpLogger;
async function openNoteInNewTab(context, page, hrefOrHandle){
  let href = '';
  if (typeof hrefOrHandle === 'string'){ href = hrefOrHandle; }
  else if (hrefOrHandle){ try{ href = await hrefOrHandle.getAttribute('href'); }catch{} }
  if (!href){
    try{
      href = await page.evaluate(()=>{
        const a = Array.from(document.querySelectorAll('a')).map(x=>x.href||'').find(h=>/\/explore\/[\w-]+/.test(h)||/\/discovery\/item\/[\w-]+/.test(h));
        return a||'';
      });
    }catch{}
  }
  let newPage = null; let finalUrl = '';
  try{
    const [popup] = await Promise.all([
      page.waitForEvent('popup', { timeout: 4000 }),
      (async()=>{ if (hrefOrHandle && typeof hrefOrHandle.click==='function'){ try{ await hrefOrHandle.click(); }catch{} } else { try{ await page.evaluate((u)=>{ const a=document.createElement('a'); a.href=u; a.target='_blank'; document.body.appendChild(a); a.click(); }, href); }catch{} } })()
    ]);
    newPage = popup;
  }catch{}
  if (!newPage){
    try{ newPage = await context.newPage(); }catch{}
    if (newPage){ try{ await newPage.goto(href, { waitUntil: 'domcontentloaded' }); }catch{} }
  }
  if (!newPage) return { ok:false, reason:'no_new_page' };
  try{ await waitRand(newPage); }catch{}
  try{ finalUrl = await newPage.url(); }catch{}
  return { ok:true, href, url: finalUrl, page: newPage };
}

module.exports.openNoteInNewTab = openNoteInNewTab;
async function extractDetail(page){
  const summary = await extractNote(page);
  let nodes = [];
  try{
    nodes = await page.evaluate(()=>{
      const root = document.querySelector('article') || document.querySelector('.note-content') || document.querySelector('[data-content]') || document.body;
      const els = Array.from(root.querySelectorAll('*'));
      const out = [];
      function vis(el){ const st=getComputedStyle(el); const r=el.getBoundingClientRect(); return st.display!=='none' && st.visibility!=='hidden' && r.width>1 && r.height>1; }
      for(let i=0;i<els.length;i++){
        if(out.length>=2000) break;
        const el = els[i];
        const r = el.getBoundingClientRect();
        const attrs = {}; Array.from(el.attributes||[]).forEach(a=>{ attrs[a.name]=a.value; });
        const tag = String((el.tagName||'').toLowerCase());
        const id = el.id||'';
        const cls = typeof el.className==='string' ? el.className : '';
        const text = String(el.textContent||'').replace(/[\s\u00A0]+/g,' ').trim();
        const href = (el.href||'') || '';
        const src = (el.currentSrc||el.src||'') || '';
        const visible = vis(el);
        const bbox = { x: Math.round(r.x||0), y: Math.round(r.y||0), w: Math.round(r.width||0), h: Math.round(r.height||0) };
        out.push({ tag, id, class: cls, attributes: attrs, text, href, src, visible, bbox });
      }
      return out;
    });
  }catch{}
  const res = { summary, nodes };
  return res;
}

module.exports.extractDetail = extractDetail;
async function extractRequired(page){
  const d = await extractNote(page);
  return {
    author: d.author || '',
    title: d.title || '',
    text: d.text || '',
    images: Array.isArray(d.images) ? d.images : [],
    published_at: d.published_at || '',
    comments_count: d.comments_count==null?null:d.comments_count,
    url: d.url || ''
  };
}

module.exports.extractRequired = extractRequired;
