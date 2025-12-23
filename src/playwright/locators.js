/**
 * 稳定 Locator 定义与选择器组合
 */

/**
 * 获取搜索框 Locator（按优先级）
 * @param {import('playwright').Page} page
 */
function getSearchInput(page){
  const byPlaceholder = page.getByPlaceholder('搜索小红书');
  const byRole = page.getByRole('searchbox');
  const generic = page.locator('input[placeholder*="搜索"], input[type="search"], input[aria-label*="搜索"]');
  return byPlaceholder.count().then(c=> c>0 ? byPlaceholder : byRole.count().then(r=> r>0 ? byRole : generic));
}

/**
 * 获取列表卡片候选容器（首屏/滚动均可）
 * @param {import('playwright').Page} page
 */
function getListCards(page){
  return page.locator('article, .note-item, [data-note-id]');
}

/**
 * 获取详情根容器
 * @param {import('playwright').Page} page
 */
function getDetailRoot(page){
  return page.locator('article, .note-content, [data-content]');
}

module.exports = { getSearchInput, getListCards, getDetailRoot };

