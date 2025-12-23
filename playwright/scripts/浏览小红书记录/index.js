
module.exports = {
  run: async ({ page, context, browser, utils }) => {
    await page.goto('https://www.xiaohongshu.com/explore');
    
    // 智能登录守卫：如果未登录则暂停等待
    if (utils && utils.ensureLogin) {
      await utils.ensureLogin({ urlPattern: /login|signin|auth/i });
    }

  // 已通过智能守卫完成登录，移除冗余的登录录制代码
  await page.getByRole('textbox', { name: '搜索小红书' }).click();
  await page.getByRole('textbox', { name: '搜索小红书' }).fill('保险');
  await page.locator('div').filter({ hasText: /^保险怎么买合适年轻人$/ }).first().click();
  await page.getByRole('link').filter({ hasText: /^$/ }).nth(1).click();
  await page.locator('div').filter({ hasText: '阿利爱生活关注1/6' }).first().click();
  await page.locator('.close-icon-wrapper').click();
  await page.locator('div').filter({ hasText: '阿利爱生活关注1/6' }).first().click();
  await page.locator('.swiper-slide.swiper-slide-visible > .img-container > .note-slider-img > img').click();
  await page.locator('.close > .reds-icon > use').click();
  await page.getByRole('link').filter({ hasText: /^$/ }).nth(1).click({
    button: 'right'
  });
  const page1 = await context.newPage();
  await page1.goto('https://www.xiaohongshu.com/search_result/67050954000000001a0222bb?xsec_token=ABG10G_0UNNaAs8v7YH-2FfUwDwuMyQeBGIyg7hRpLXsA=&xsec_source=pc_search');
  await page1.goto('https://www.xiaohongshu.com/explore/67050954000000001a0222bb?xsec_token=ABG10G_0UNNaAs8v7YH-2FfUwDwuMyQeBGIyg7hRpLXsA=&xsec_source=pc_search');
  await page1.locator('.arrow-controller.right > .btn-wrapper > .reds-icon').click();
  await page1.locator('.arrow-controller.right > .btn-wrapper > .reds-icon').click();
  await page1.locator('.arrow-controller.right > .btn-wrapper > .reds-icon').dblclick();
  await page1.goto('https://www.xiaohongshu.com/explore/67050954000000001a0222bb?xsec_token=ABG10G_0UNNaAs8v7YH-2FfUwDwuMyQeBGIyg7hRpLXsA=&xsec_source=pc_search');
  await page1.close();
  await page.locator('a').filter({ hasText: '泰康车险靠谱吗' }).click();
  await page.locator('div').filter({ hasText: '小艾关注小艾关注泰康车险靠谱吗泰康车险靠谱吗，之前买的人保 今年感觉好贵，泰康和阳光都便宜一些？有懂得来说说吗08-03 共 24' }).first().click();
  await page.locator('.close-icon-wrapper > .reds-icon').click();
  await page.locator('.close > .reds-icon').click();
  await page.locator('section:nth-child(7) > div > .cover').click({
    button: 'right'
  });
  const page2 = await context.newPage();
  await page2.goto('https://www.xiaohongshu.com/search_result/688f08480000000025016a76?xsec_token=ABRnNqgpgbFKw7reHdUJwgIG4MaDuhEPl28UTDOR041Jc=&xsec_source=pc_search');
  await page2.goto('https://www.xiaohongshu.com/explore/688f08480000000025016a76?xsec_token=ABRnNqgpgbFKw7reHdUJwgIG4MaDuhEPl28UTDOR041Jc=&xsec_source=pc_search');
  await page2.locator('.left > .like-wrapper > .like-lottie').click();
  await page2.locator('.reds-icon.collect-icon').click();
  await page2.locator('.chat-wrapper > .reds-icon > use').click();
  await page2.getByText('还是', { exact: true }).fill('都贵');
  await page2.getByRole('button', { name: '发送' }).click();
  await page2.close();

  }
};