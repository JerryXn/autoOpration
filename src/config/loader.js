const fs = require('fs');
const path = require('path');

function loadYamlSafe(p){
  try{
    const yaml = require('yaml');
    const text = fs.readFileSync(p, 'utf8');
    return yaml.parse(text) || {};
  }catch{ return {}; }
}

function loadJsonSafe(p){
  try{ return JSON.parse(fs.readFileSync(p, 'utf8')); }catch{ return {}; }
}

function loadAppConfig(){
  const root = process.cwd();
  const y1 = path.join(root, 'config', 'app.yaml');
  const y2 = path.join(root, 'config', 'app.yml');
  const j1 = path.join(root, 'config', 'app.json');
  if (fs.existsSync(j1)) return loadJsonSafe(j1);
  if (fs.existsSync(y1)) return loadYamlSafe(y1);
  if (fs.existsSync(y2)) return loadYamlSafe(y2);
  return {};
}

function mergeOptions(ui={}, file={}, env=process.env){
  const out = {};
  const pick = (a,b,c)=> a!==undefined ? a : (b!==undefined ? b : c);
  out.platformCode = pick(ui.platformCode, file.platformCode, 'xhs');
  out.keywords = pick(ui.keywords, file.keywords, '').toString();
  out.actions = Object.assign({}, file.actions||{}, ui.actions||{});
  out.limits = Object.assign({}, file.limits||{}, ui.limits||{});
  out.type = pick(ui.type, file.type, 'image_text');
  out.captureEnabled = !!pick(ui.captureEnabled, file.captureEnabled, true);
  out.runtime = Object.assign({
    locale: env.APP_LOCALE||'zh-CN',
    timezone: env.APP_TIMEZONE||'Asia/Shanghai',
    userDataDir: env.APP_USERDATADIR||null,
    headless: /^true|1$/i.test(String(env.HEADLESS||''))
  }, file.runtime||{});
  out.db = {
    host: env.MYSQL_HOST||'127.0.0.1',
    port: env.MYSQL_PORT?parseInt(env.MYSQL_PORT,10):3306,
    user: env.MYSQL_USER||'root',
    password: env.MYSQL_PASSWORD||'',
    database: env.MYSQL_DATABASE||'auto_operation'
  };
  return out;
}

module.exports = { loadAppConfig, mergeOptions };

