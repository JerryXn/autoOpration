const { upsertPlatform, upsertCreator, upsertNote, upsertImage, insertBrowseSession, insertNoteVisit, logRequest } = require('../../db/repo');

async function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }
function rand(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }

async function run(options){
  const { platformCode, keywords, limits, actions, type, captureEnabled } = options;
  await upsertPlatform(platformCode, platformCode.toUpperCase());
  if (keywords && keywords.length){ await logRequest({ keyword: String(keywords[0]||''), page:1, pageSize:20, status:'start', hasMore:1, textHead:'runner' }); }
  // 具体浏览与采集逻辑：此处保留最小入库示例，完整行为与 Playwright 层联动待扩展
  const dmin = limits.dmin||500, dmax = limits.dmax||1000;
  await wait(rand(dmin,dmax));
  return { ok: true };
}

module.exports = { run };

