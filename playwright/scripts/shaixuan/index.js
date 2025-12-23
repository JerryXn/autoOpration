module.exports = {
  run: async ({ page, context, browser, utils }) => {
        await page.goto('https://www.xiaohongshu.com/explore');
    // 智能登录守卫：如果未登录则暂停等待
    await utils.ensureLogin({ urlPattern: /login|signin|auth/i });

  await page.getByRole('list').getByText('发现发布通知我我').click();
  await page.getByRole('textbox', { name: '搜索小红书' }).click();
  await page.getByRole('textbox', { name: '搜索小红书' }).fill('baoxian ');
  await page.getByRole('textbox', { name: '搜索小红书' }).press('ControlOrMeta+a');
  await page.getByRole('textbox', { name: '搜索小红书' }).fill('保险');
  await page.getByRole('img').nth(2).click();
  await page.getByText('筛选排序依据综合最新最多点赞最多评论最多收藏笔记类型不限视频图文发布时间不限一天内一周内半年内搜索范围不限已看过未看过已关注位置距离不限同城附近 重置 收起').click();
  await page.getByText('筛选').click();
  await page.locator('div').filter({ hasText: /^最新$/ }).click();
  await page.locator('div').filter({ hasText: /^综合$/ }).click();
  await page.locator('div').filter({ hasText: /^最多点赞$/ }).click();
  await page.locator('div').filter({ hasText: /^最多评论$/ }).click();
  await page.locator('div').filter({ hasText: /^最多收藏$/ }).click();
  await page.locator('div').filter({ hasText: /^不限$/ }).first().click();
  await page.locator('div').filter({ hasText: /^视频$/ }).click();
  await page.locator('div').filter({ hasText: /^图文$/ }).click();
  await page.locator('div').filter({ hasText: /^不限$/ }).nth(1).click();
  await page.locator('div').filter({ hasText: /^一天内$/ }).click();
  await page.locator('div').filter({ hasText: /^一周内$/ }).click();
  await page.getByText('一周内').click();
  await page.locator('div').filter({ hasText: /^半年内$/ }).click();
  await page.locator('div').filter({ hasText: /^不限$/ }).nth(2).click();
  await page.locator('div').filter({ hasText: /^已看过$/ }).click();
  await page.locator('div').filter({ hasText: /^未看过$/ }).click();
  await page.locator('div').filter({ hasText: /^已关注$/ }).click();
  await page.locator('div').filter({ hasText: /^不限$/ }).nth(3).click();
  await page.locator('div').filter({ hasText: /^同城$/ }).click();
  await page.locator('div').filter({ hasText: /^附近$/ }).click();
  await page.getByText('重置').click();
  await page.locator('.operation-container > div:nth-child(2) > .reds-icon > use').click();
  await page.getByText('最多评论').click();

  // ---------------------
        }
};