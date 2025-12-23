const path = require('path');
const os = require('os');
const { startSession } = require('./session');
const { search, openNoteInNewTab } = require('./actions');
const { collectSearchList } = require('./list');
const { extractRequired } = require('./detail');
function rand(min=500,max=1000){ return Math.floor(min + Math.random()*(max-min)); }

async function main(){
  const args = process.argv.slice(2);
  const getArg = (k)=>{ const i=args.findIndex(a=>a===`--${k}`); return i>=0 ? args[i+1] : null; };
  const plat = getArg('plat') || 'xhs';
  const url = getArg('url') || null;
  const kw = getArg('kw') || '美食';
  const limit = parseInt(getArg('limit')||'30',10)||30;
  const saveList = args.includes('--save-list');
  const useNewTab = args.includes('--new-tab');
  const noScroll = args.includes('--no-scroll');
  const userData = path.join(os.homedir(), '.autoOperation');
  const s = await startSession({ plat, url, appUserDataPath: userData });
  const homeUrl = await s.page.url();
  const res = await search(s.page, kw);
  await s.page.waitForTimeout(rand());
  const list = await collectSearchList(s.page, { limit, scroll: !noScroll });
  if (saveList){ try{ console.log(JSON.stringify({ list })); }catch{} }
  await s.page.waitForTimeout(rand());
  for (let i=0;i<list.length;i++){
    const item = list[i];
    if (!item || !item.href) continue;
    let opened = null;
    if (useNewTab){ opened = await openNoteInNewTab(s.context, s.page, item.href); } else {
      try{ await s.page.goto(item.href, { waitUntil: 'domcontentloaded' }); opened = { ok:true, href: item.href, url: await s.page.url(), page: s.page }; }catch{ opened = { ok:false }; }
    }
    if (opened && opened.ok){
      await (opened.page || s.page).waitForTimeout(rand());
      const req = await extractRequired(opened.page || s.page);
      try{ console.log(JSON.stringify(req)); }catch{}
      break;
    }
  }
  setInterval(()=>{}, 1<<30);
}

main().catch(e=>{ console.error(e); process.exit(1); });
