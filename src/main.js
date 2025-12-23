const { app, BrowserWindow, ipcMain, globalShortcut, shell } = require('electron');
const path = require('path');
require('./config/env').loadEnv(); // Load environment variables based on APP_ENV
const mysql = require('mysql2/promise');
const repo = require('./db/repo');

const { buildQueue } = require('./autoop/steps');
const { stageDefaults } = require('./autoop/selectors');
let _pwMod = null;
function _getPlaywrightMod(){ if (!_pwMod) { try{ _pwMod = require('./playwright/index'); }catch(e){ _pwMod = null; } } return _pwMod; }

let mainWindow = null;
let dbPool = null;
async function getDbPool(){
  if (dbPool) return dbPool;
  const host = process.env.MYSQL_HOST || '127.0.0.1';
  const port = process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT,10) : 3306;
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const database = process.env.MYSQL_DATABASE || 'auto_operation';
  dbPool = await mysql.createPool({ host, port, user, password, database, waitForConnections: true, connectionLimit: 5 });
  return dbPool;
}

async function runMigrations(){
  const pool = await getDbPool();
  const fs = require('fs');
  const path = require('path');
  const file = path.join(process.cwd(), 'db', 'auto_final.sql');
  if (fs.existsSync(file)){
    const raw = fs.readFileSync(file, 'utf8');
    const noBlock = raw.replace(/\/\*[\s\S]*?\*\//g, '');
    const cleanedLines = noBlock.split(/\r?\n/).map(ln => ln.replace(/--.*$/,'').replace(/#.*/,'').trim()).filter(ln => ln.length>0);
    const cleaned = cleanedLines.join('\n');
    const statements = cleaned.split(/;\s*\n/).map(s => s.trim()).filter(s => s.length>0);
    const mode = process.env.MIGRATIONS_MODE || 'schema_only';
    function isDDL(st){ return /^(CREATE|ALTER|DROP)\s+/i.test(st); }
    function isDML(st){ return /^(INSERT|UPDATE|DELETE|REPLACE)\s+/i.test(st); }
    const execStmts = statements.filter(st => {
      if (mode === 'full') return true;
      if (mode === 'schema_only'){
        if (isDML(st)) return false;
        if (/ALTER\s+TABLE\s+sys_users\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+display_name/i.test(st)) return false;
        return isDDL(st);
      }
      return false;
    });
    // 兼容列：display_name（若缺失则创建）
    try{
      const dbName = process.env.MYSQL_DATABASE || 'auto_operation';
      const [colRows] = await pool.query('SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=? LIMIT 1', [dbName, 'sys_users', 'display_name']);
      if (!colRows || !colRows.length){
        await pool.query('ALTER TABLE sys_users ADD COLUMN display_name VARCHAR(128) NULL AFTER username');
        console.log('[migrate] add sys_users.display_name');
      }
    }catch(e){ console.error('[migrate] display_name', e && e.message ? e.message : e); }
    for (const st of execStmts){
      try{ await pool.query(st); }catch(e){ console.error('[migrate]', e && e.message ? e.message : e, '\nSQL:', st.slice(0,200)); }
    }
    try{
      if (process.env.ENABLE_SEED === '1'){
        const seedFile = path.join(process.cwd(), 'db', 'seed_defaults.sql');
        if (fs.existsSync(seedFile)){
          const rawSeed = fs.readFileSync(seedFile, 'utf8');
          const noBlockSeed = rawSeed.replace(/\/\*[\s\S]*?\*\//g, '');
          const cleanedSeedLines = noBlockSeed.split(/\r?\n/).map(ln => ln.replace(/--.*$/,'').replace(/#.*/,'').trim()).filter(ln => ln.length>0);
          const cleanedSeed = cleanedSeedLines.join('\n');
          const seedStatements = cleanedSeed.split(/;\s*\n/).map(s => s.trim()).filter(s => s.length>0);
          for (const st of seedStatements){
            try{ await pool.query(st); }catch(e){ console.error('[seed]', e && e.message ? e.message : e, '\nSQL:', st.slice(0,200)); }
          }
        }
      }
    }catch(e){ console.error('[seed-load]', e && e.message ? e.message : e); }
  }
  // 兼容视图：若 sys_* 不存在，且基础表存在，则创建视图
  async function createViewIfMissing(name, target){
    const [rows] = await pool.query('SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=? LIMIT 1', [process.env.MYSQL_DATABASE || 'auto_operation', name]);
    if (rows && rows.length) return;
    const [base] = await pool.query('SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=? LIMIT 1', [process.env.MYSQL_DATABASE || 'auto_operation', target]);
    if (!base || !base.length) return;
    try{ await pool.query(`CREATE VIEW \`${name}\` AS SELECT * FROM \`${target}\``); console.log('[view-ok]', name, '->', target); }catch(e){ console.error('[view-fail]', name, e && e.message ? e.message : e); }
  }
  await createViewIfMissing('sys_features','features');
  await createViewIfMissing('sys_platform_features','platform_features');
  await createViewIfMissing('sys_user_feature_grants','user_feature_grants');
  await createViewIfMissing('sys_user_platforms','user_platforms');
}

function createWindow(){
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

const { spawn } = require('child_process');
let pyRun = null;

app.whenReady().then(async () => {
  try{
    if (process.env.MIGRATIONS_ON_STARTUP === '1'){
      try{ await runMigrations(); console.log('[migrate-on-start] ok'); }catch(e){ console.error('[migrate-on-start] fail', e && e.message ? e.message : e); }
    }
  }catch{}
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  app.on('will-quit', () => {
    try{ globalShortcut.unregisterAll(); }catch{}
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('open-devtools', async () => {
  const win = BrowserWindow.getFocusedWindow() || mainWindow;
  if (win) win.webContents.openDevTools();
  return { ok: true };
});

ipcMain.handle('login', async (e, payload) => {
  try{
    const { username, password } = payload || {};
    const pool = await getDbPool();
    let u;
    try{
      const [uRows] = await pool.query('SELECT id, username, COALESCE(display_name, username) AS display_name FROM sys_users WHERE username=? LIMIT 1', [username]);
      if (!uRows || !uRows.length){ return { ok:false, error:'用户不存在' }; }
      u = uRows[0];
    }catch(e){
      const msg = String(e && e.message || '');
      if (msg.includes('Unknown column') && msg.includes('display_name')){
        const [uRows2] = await pool.query('SELECT id, username FROM sys_users WHERE username=? LIMIT 1', [username]);
        if (!uRows2 || !uRows2.length){ return { ok:false, error:'用户不存在' }; }
        const t = uRows2[0];
        u = { id: t.id, username: t.username, display_name: t.username };
      } else {
        throw e;
      }
    }
    const [rRows] = await pool.query('SELECT role_code FROM sys_user_roles WHERE user_id=?', [u.id]);
    const roles = (rRows||[]).map(r=>r.role_code);
    const [platRows] = await pool.query('SELECT id FROM platforms WHERE code=? LIMIT 1', ['xhs']);
    const platId = (platRows && platRows[0]) ? platRows[0].id : null;
    const [gRows] = platId ? await pool.query('SELECT action_code FROM sys_role_action_grants WHERE role_code IN (?) AND platform_id=?', [roles.length?roles:['lv1'], platId]) : [[],[]];
    const actions = new Set((gRows||[]).map(r=>r.action_code));
    const perms = { canBrowse: actions.has('auto_view'), canLike: actions.has('auto_like'), canFav: actions.has('auto_favorite'), canComment: actions.has('auto_comment') };
    global.currentUser = { id: u.id, username: u.username, group: roles[0] || 'lv1' };
    global.currentPermissions = perms;
    return { ok:true, userId: u.id, user: { id: u.id, name: u.display_name, group: global.currentUser.group }, permissions: perms };
  }catch(err){ return { ok:false, error: err && err.message ? err.message : 'login failed' }; }
});

ipcMain.handle('quick-admin-login', async () => {
  try{
    const pool = await getDbPool();
    let u;
    try{
      const [uRows] = await pool.query("SELECT id, username, COALESCE(display_name, username) AS display_name FROM sys_users WHERE username='admin' LIMIT 1");
      u = uRows && uRows[0] ? uRows[0] : { id: 1, username: 'admin', display_name: 'admin' };
    }catch(e){
      const msg = String(e && e.message || '');
      if (msg.includes('Unknown column') && msg.includes('display_name')){
        const [uRows2] = await pool.query("SELECT id, username FROM sys_users WHERE username='admin' LIMIT 1");
        const t = uRows2 && uRows2[0] ? uRows2[0] : { id: 1, username: 'admin' };
        u = { id: t.id, username: t.username, display_name: t.username };
      } else {
        throw e;
      }
    }
    global.currentUser = { id: u.id, username: u.username, group: 'admin' };
    global.currentPermissions = { canBrowse:true, canLike:true, canFav:true, canComment:true };
    return { ok:true, userId: u.id, user: { id: u.id, name: u.display_name, group: 'admin' }, permissions: global.currentPermissions };
  }catch(err){ return { ok:false, error: err && err.message ? err.message : 'quick login failed' }; }
});

ipcMain.handle('get-user-platforms', async () => {
  try{
    const uid = global.currentUser && global.currentUser.id;
    if (!uid) return [];
    const pool = await getDbPool();
    const [rows] = await pool.query('SELECT p.code, p.name FROM sys_user_platforms up JOIN platforms p ON up.platform_id=p.id WHERE up.user_id=? AND up.enabled=1', [uid]);
    return rows.map(r => ({ code: r.code, name: r.name }));
  }catch(err){ return []; }
});

ipcMain.handle('get-industries', async () => {
  try {
    const pool = await getDbPool();
    const [rows] = await pool.query('SELECT code, name FROM sys_industries WHERE is_active=1 ORDER BY sort_order ASC, id ASC');
    return { ok: true, items: rows };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('get-platform-features', async (e, { code }) => {
  return [
    { code: 'publish_image_text', name: '自动发布 - 图文' },
    { code: 'publish_video', name: '自动发布 - 视频' },
    { code: 'auto_operation', name: '自动运营' }
  ];
});

ipcMain.handle('open-platform', async (e, { code }) => {
  return { ok: true };
});

ipcMain.handle('feishu-fetch', async (e, { url }) => {
  return { ok: false, error: '未集成飞书接口' };
});

ipcMain.handle('save-parsed-content', async (e, payload) => {
  return { ok: true, savedCount: (payload && Array.isArray(payload.rows)) ? payload.rows.length : 0 };
});

ipcMain.handle('list-parsed-contents', async (e, { platformCode, page, pageSize, status }) => {
  return { ok: true, items: [], total: 0 };
});

ipcMain.handle('get-publish-schedules', async (e, { platformCode }) => {
  return { ok: true, slots: [] };
});

ipcMain.handle('save-publish-schedules', async (e, { platformCode, slots }) => {
  return { ok: true };
});

ipcMain.handle('mark-published', async (e, { id }) => {
  return { ok: true };
});

ipcMain.handle('start-web-publish', async (e, { id }) => {
  return { ok: false, error: '暂未实现网页发布自动化' };
});

  ipcMain.handle('start-auto-op', async (e, payload) => {
    try {
        if (pyRun) { try{ pyRun.kill(); }catch{} pyRun=null; }
        
        // --- PATH RESOLUTION LOGIC FOR PACKAGED APP ---
        let executable = 'python';
        let script = path.join(__dirname, 'playwright/python/xhs.py');
        let args = [script];
        
        // Check for bundled binary (xhs-core) in resources/bin (Production) or src/bin (Dev)
        // In production (asar), process.resourcesPath is the 'Resources' dir.
        // In dev, we look in src/bin.
        
        const platform = process.platform === 'win32' ? 'win' : 'mac';
        const binName = process.platform === 'win32' ? 'xhs-core.exe' : 'xhs-core';
        
        // Potential paths for the binary
        const bundledPath = path.join(process.resourcesPath, 'bin', binName);
        const devPath = path.join(__dirname, '../src/bin', binName); // Adjust based on where main.js is
        const localBinPath = path.join(process.cwd(), 'src/bin', binName);

        let binPath = null;
        if (require('fs').existsSync(bundledPath)) {
            binPath = bundledPath;
        } else if (require('fs').existsSync(devPath)) {
            binPath = devPath;
        } else if (require('fs').existsSync(localBinPath)) {
            binPath = localBinPath;
        }

        if (binPath) {
            console.log(`[start-auto-op] Found bundled binary at: ${binPath}`);
            executable = binPath;
            args = []; // Binary doesn't need script path as first arg
        } else {
            console.log('[start-auto-op] Bundled binary not found, falling back to system python');
        }
        
        // --- END PATH RESOLUTION ---
        
        const kw = (payload && payload.keywords) ? String(payload.keywords) : '保险';
        args.push(`--keyword=${kw}`);
        
        if (payload && payload.industry) args.push(`--industry=${payload.industry}`);
        if (payload && payload.sortType) args.push(`--sort=${payload.sortType}`);
        if (payload && payload.noteType) args.push(`--note-type=${payload.noteType}`);
        if (payload && payload.searchScope) args.push(`--scope=${payload.searchScope}`);
        
        // timeRange is now handled by --time-range CLI (days)
        const timeRange = (payload && payload.timeRange) ? parseInt(payload.timeRange) : 0;
        if (timeRange > 0) args.push(`--time-range=${timeRange}`);
        
        if (payload && payload.maxCount) args.push(`--max-count=${payload.maxCount}`);
        
        // Convert seconds to ms for python script, e.g. "1-3" -> "1000-3000"
        let delayRange = '1000-3000';
        if (payload && payload.delayRange) {
            const parts = payload.delayRange.split('-');
            if (parts.length === 2) {
                try {
                    const min = parseFloat(parts[0]) * 1000;
                    const max = parseFloat(parts[1]) * 1000;
                    delayRange = `${min}-${max}`;
                } catch(e){}
            }
        }
        args.push(`--delay-range=${delayRange}`);

        // Browse time range, convert s to ms
        let browseTime = '5000-10000';
        if (payload && payload.browseTime) {
            const parts = payload.browseTime.split('-');
            if (parts.length === 2) {
                try {
                    const min = parseFloat(parts[0]) * 1000;
                    const max = parseFloat(parts[1]) * 1000;
                    browseTime = `${min}-${max}`;
                } catch(e){}
            }
        }
        args.push(`--browse-time=${browseTime}`);

        const actions = (payload && payload.actions) || {};
        if (actions.browse) args.push('--enable-browse');
        if (actions.record) args.push('--enable-record');
        if (actions.like) {
            args.push('--enable-like');
            if (actions.likeProb !== undefined) args.push(`--like-prob=${actions.likeProb}`);
        }
        if (actions.fav) {
            args.push('--enable-fav');
            if (actions.favProb !== undefined) args.push(`--fav-prob=${actions.favProb}`);
        }
        if (actions.comment) {
            args.push('--enable-comment');
            if (actions.commentProb !== undefined) args.push(`--comment-prob=${actions.commentProb}`);
        }
        
        const userData = app.getPath('userData');
        const env = { 
            ...process.env, 
            XHS_USER_DATA_DIR: path.join(userData, 'playwright/default'),
            PYTHONUNBUFFERED: '1'
        };
        
        console.log('[start-auto-op] spawning process', executable, args);
        pyRun = spawn(executable, args, { env, stdio: 'pipe' });
        
        pyRun.on('error', (err) => {
            console.error('[start-auto-op] Failed to start subprocess.', err);
        });

        pyRun.stdout.on('data', d => console.log(`[py] ${d}`));
        pyRun.stderr.on('data', d => console.error(`[py-err] ${d}`));
        pyRun.on('close', code => {
            console.log(`[py] exited with code ${code}`);
            pyRun = null;
        });
        
        return { ok: true };
    } catch (err) {
        return { ok: false, error: err.message };
    }
  });

ipcMain.handle('pw-open', async (e, { plat='xhs', url } = {}) => {
  try{
    const appUserData = app.getPath('userData');
    const mod = _getPlaywrightMod();
    if (!mod) return { ok:false, error:'playwright_module_load_failed' };
    const s = await mod.startSession({ plat, url: url || (plat==='xhs' ? 'https://www.xiaohongshu.com/explore' : url), appUserDataPath: appUserData });
    return { ok: true, plat, userDataDir: s.userDataDir };
  }catch(err){ return { ok:false, error: err && err.message ? err.message : 'pw-open failed' }; }
});

ipcMain.handle('pw-close', async (e, { plat='xhs' } = {}) => {
  const mod = _getPlaywrightMod();
  if (!mod) return { ok:false, error:'playwright_module_load_failed' };
  const res = await mod.stopSession(plat);
  return { ok: true };
});


ipcMain.handle('stop-auto-op', async (e, { runId }) => {
  if (pyRun){ try{ pyRun.kill(); }catch{} pyRun=null; }
  return { ok: true };
});

ipcMain.handle('list-auto-op-runs', async () => {
  return { ok: true, items: [] };
});

ipcMain.handle('get-scraped-notes', async (e, { page=1, pageSize=20 } = {}) => {
  try {
    const pool = await getDbPool();
    const offset = (page - 1) * pageSize;
    const [rows] = await pool.query('SELECT * FROM xhs_notes ORDER BY last_visited_at DESC LIMIT ? OFFSET ?', [pageSize, offset]);
    const [countRows] = await pool.query('SELECT COUNT(*) as total FROM xhs_notes');
    return { ok: true, items: rows, total: countRows[0].total };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('get-scraped-comments', async (e, { page=1, pageSize=20 } = {}) => {
  try {
    const pool = await getDbPool();
    const offset = (page - 1) * pageSize;
    // Query op_comments
    const [rows] = await pool.query('SELECT * FROM op_comments ORDER BY created_at DESC LIMIT ? OFFSET ?', [pageSize, offset]);
    const [countRows] = await pool.query('SELECT COUNT(*) as total FROM op_comments');
    return { ok: true, items: rows, total: countRows[0].total };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('fetch-xhs-rank', async () => {
  const url = 'https://gw.newrank.cn/api/xh/xdnphb/nr/app/xhs/rank/surgeNoteNewRank';
  try{
    if (typeof fetch === 'function'){
      const resp = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
      const ct = resp.headers.get('content-type')||'';
      const isJson = /application\/json/i.test(ct);
      const data = isJson ? await resp.json() : await resp.text();
      return { ok: true, data };
    } else {
      const https = require('https');
      const resData = await new Promise((resolve, reject)=>{
        https.get(url, (res)=>{
          const chunks=[]; res.on('data',d=>chunks.push(d)); res.on('end',()=>{ const buf = Buffer.concat(chunks); try{ const text = buf.toString('utf8'); try{ resolve({ json: JSON.parse(text) }); }catch{ resolve({ text }); } }catch(e){ reject(e); } });
        }).on('error', reject);
      });
      return { ok: true, data: (resData.json||resData.text||null) };
    }
  }catch(err){ return { ok: false, error: err && err.message ? err.message : '请求失败' }; }
});

ipcMain.handle('open-external', async (e, { url }) => {
  if (!url) return { ok: false };
  try {
    await shell.openExternal(url);
    return { ok: true };
  } catch(err) {
    return { ok: false, error: err.message };
  }
});
 
