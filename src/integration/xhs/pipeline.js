const { startSession, waitRand } = require('../../playwright/session');
const { getSearchInput } = require('../../playwright/locators');
const { collectSearchList } = require('../../playwright/list');
const { extractRequired } = require('../../playwright/detail');
const repo = require('../../db/repo');

async function typeKeyword(page, kw){
  const input = await getSearchInput(page);
  try{ await input.waitFor({ state: 'visible', timeout: 5000 }); }catch{}
  try{ await input.click(); }catch{}
  await waitRand(page);
  try{ await input.fill(''); }catch{}
  await waitRand(page);
  try{ await page.keyboard.type(String(kw)); }catch{}
  await waitRand(page);
  try{ await page.keyboard.press('Enter'); }catch{}
  await page.waitForLoadState('domcontentloaded');
}

async function openDetail(page, href){
  try{ await page.goto(href, { waitUntil: 'domcontentloaded' }); }catch{}
  await waitRand(page);
}

async function run(options={}){
  const plat = options.platformCode || 'xhs';
  const appUserDataPath = (options.runtime && options.runtime.userDataDir) || null;
  const { context, page } = await startSession({ plat, url: plat==='xhs'?'https://www.xiaohongshu.com/explore':'about:blank', appUserDataPath });
  const delay = (min=500,max=1000)=> waitRand(page, min, max);
  const kwList = Array.isArray(options.keywords) ? options.keywords : String(options.keywords||'').split(',').map(s=>s.trim()).filter(Boolean);
  const limit = (options.limits && parseInt(options.limits.count||5,10)) || 5;
  const scroll = !(options.limits && options.limits.scroll===false);
  await repo.upsertPlatform(plat, plat.toUpperCase());
  if (kwList.length){ await repo.logRequest({ keyword: kwList[0], page:1, pageSize:20, status:'start', hasMore:1, textHead:'pipeline' }); }
  for (const kw of kwList){
    await typeKeyword(page, kw);
    const list = await collectSearchList(page, { limit, scroll });
    for (const it of list){
      await openDetail(page, it.href);
      const req = await extractRequired(page);
      await repo.upsertNote(plat, (req.url.match(/\/explore\/([\w-]+)/)||[])[1]||'', req.url, req.title, null, { description: req.text, noteType: options.type||'image_text', noteTime: null, isRestricted: /\/404\?/.test(req.url) ? 1 : 0, publishedAt: req.published_at||null });
      const imgs = Array.isArray(req.images) ? req.images : [];
      let ord = 1; for (const u of imgs){ await repo.upsertImage((req.url.match(/\/explore\/([\w-]+)/)||[])[1]||'', ord++, u, null); }
      const sid = await repo.insertBrowseSession(plat, 'https://www.xiaohongshu.com/search_result?keyword='+encodeURIComponent(kw), kw);
      if (sid) await repo.insertNoteVisit(sid, (req.url.match(/\/explore\/([\w-]+)/)||[])[1]||'', !!(/\/404\?/.test(req.url)));
      await delay();
    }
    await delay();
  }
  try{ await context.close(); }catch{}
  return { ok: true };
}

module.exports = { run };

