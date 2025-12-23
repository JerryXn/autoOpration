/**
 * 小红书搜索结果筛选处理器
 * @param {object} page - Playwright page object
 * @param {object} config - 包含 filter 配置的对象
 */
async function applyFilter(page, config) {
    if (!config.filter || !config.filter.enabled) {
        console.log('[Filter] Filter disabled in config.');
        return;
    }

    console.log('[Filter] Applying filters...');

    // 悬停“筛选”按钮以展开面板
    console.log('[Filter] Hovering over "Filter" button...');
    try {
        // 策略1: 优先尝试类名+文本定位
        const filterBtn = page.locator('.filter').filter({ hasText: '筛选' });
        await filterBtn.waitFor({ state: 'visible', timeout: 5000 });
        
        // 使用 hover 展开
        await filterBtn.hover();
        console.log('[Filter] Hovered over "Filter" button (Strategy 1).');
    } catch (e1) {
        console.warn('[Filter] Strategy 1 failed, trying Strategy 2 (CSS Selector)...');
        try {
            // 策略2: 使用完整 CSS 选择器
            const selector = '#global > div.main-container > div.with-side-bar.main-content > div > div > div.search-layout__top > div.filter';
            await page.locator(selector).hover();
            console.log('[Filter] Hovered over "Filter" button (Strategy 2).');
        } catch (e2) {
            console.warn('[Filter] Strategy 2 failed, trying Strategy 3 (Simple Text)...');
            // 策略3: 最后的倔强
            await page.getByText('筛选').hover();
            console.log('[Filter] Hovered over "Filter" button (Strategy 3).');
        }
    }
    
    await page.waitForTimeout(1000); // 等待面板动画

    const f = config.filter;
    // 定义需要点击的选项列表
    const optionsToClick = [
        f.sort,      // e.g. "最新"
        f.type,      // e.g. "图文"
        f.time,      // e.g. "半年内"
        f.scope,     // e.g. "不限"
        f.distance   // e.g. "同城"
    ].filter(Boolean);

    for (const option of optionsToClick) {
        // 如果是“不限”，也点击以确保状态正确
        console.log(`[Filter] Clicking option: ${option}`);
        
        try {
            // 使用正则精确匹配文本，防止误触
            await page.locator('div').filter({ hasText: new RegExp(`^${option}$`) }).click();
            await page.waitForTimeout(500); // 稍微等待一下点击反应
        } catch (e) {
            console.warn(`[Filter] Failed to click option "${option}": ${e.message}`);
        }
    }
    
    // 收起面板
    console.log('[Filter] Closing filter panel...');
    try {
        if (await page.getByText('收起').isVisible()) {
            await page.getByText('收起').click();
        } else {
            // 如果没找到收起，再次 hover/click 筛选按钮区域可能收起，或者点击空白处
            // 这里简单处理：点击页面空白处
            await page.mouse.click(10, 10);
        }
    } catch (e) {
        console.log('[Filter] "收起" action failed, trying to click body to close.');
        await page.locator('body').click({ position: { x: 10, y: 10 } });
    }
    
    console.log('[Filter] Filter applied successfully.');
    await page.waitForTimeout(2000); // 等待筛选结果刷新
}

module.exports = { applyFilter };
