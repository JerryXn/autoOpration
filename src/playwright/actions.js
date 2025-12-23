/**
 * 页面操作（搜索与打开详情）
 */
const { waitRand } = require('./session');
const { getSearchInput } = require('./locators');

/**
 * 执行搜索，输入关键词并提交；必要时点击“笔记”标签
 * @param {import('playwright').Page} page
 * @param {string} kw
 */
async function search(page, kw){
  const input = await getSearchInput(page);
  try{ await input.first().waitFor({ state:'visible', timeout:6000 }); }catch{}
  const handle = await input.first();
  try{ await handle.focus(); }catch{}
  await waitRand(page);
  try{ await page.keyboard.type(String(kw||''), { delay: 30 }); }catch{}
  await waitRand(page);
  try{ await page.keyboard.press('Enter'); }catch{}
  try{ await page.waitForLoadState('domcontentloaded'); }catch{}
  await waitRand(page);
  // 尝试点击“笔记”筛选或跳转链接
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
  return { ok:true, url: await page.url() };
}

/**
 * 使用新标签页打开详情；若站点不 `_blank`，则强制新页 + goto
 * @param {import('playwright').BrowserContext} context
 * @param {import('playwright').Page} page
 * @param {string} href
 */
async function openNoteInNewTab(context, page, href){
  let newPage = null;
  try{
    const [popup] = await Promise.all([
      page.waitForEvent('popup', { timeout: 4000 }),
      page.evaluate((u)=>{ const a=document.createElement('a'); a.href=u; a.target='_blank'; document.body.appendChild(a); a.click(); }, href)
    ]);
    newPage = popup;
  }catch{}
  if (!newPage){
    try{ newPage = await context.newPage(); }catch{}
    if (newPage){ try{ await newPage.goto(href, { waitUntil: 'domcontentloaded' }); }catch{} }
  }
  if (!newPage) return { ok:false, reason:'no_new_page' };
  await waitRand(newPage);
  return { ok:true, href, url: await newPage.url(), page: newPage };
}

module.exports = { search, openNoteInNewTab };

