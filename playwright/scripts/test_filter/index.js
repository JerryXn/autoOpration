const path = require('path');
const fs = require('fs');

// Load config
const configPath = path.join(__dirname, '../xiaohongshu/config.json');
let config = {};
try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e) {
    console.error('Failed to load config:', e);
}

module.exports = {
  run: async ({ page, utils }) => {
    console.log('[TestFilter] Starting search and filter test...');
    
    // 1. Go to Explore
    await page.goto('https://www.xiaohongshu.com/explore');
    await utils.ensureLogin({ urlPattern: /login|signin|auth/i });
    
    // 2. Search
    const keyword = config.search?.keyword || '保险';
    console.log(`[TestFilter] Searching for: "${keyword}"`);
    
    // 定位搜索框并输入
    // 使用录制脚本中的定位方式，或更稳健的 getByRole
    const searchInput = page.getByRole('textbox', { name: '搜索小红书' });
    await searchInput.click();
    await searchInput.fill(keyword);
    
    // 点击搜索图标 (根据录制脚本，是第3个 img，即 nth(2))
    // 也可以尝试 .search-icon
    await page.getByRole('img').nth(2).click();
    
    console.log('[TestFilter] Search submitted, waiting for results...');
    await page.waitForTimeout(3000); // 等待搜索结果加载

    // 3. Filter
    if (config.filter && config.filter.enabled) {
      console.log('[TestFilter] Applying filters...');
      
      // 悬停“筛选”按钮以展开面板
      console.log('[TestFilter] Hovering over "Filter" button...');
      try {
          // 策略1: 优先尝试类名+文本定位
          const filterBtn = page.locator('.filter').filter({ hasText: '筛选' });
          await filterBtn.waitFor({ state: 'visible', timeout: 5000 });
          
          // 关键修改：使用 hover 而不是 click
          await filterBtn.hover();
          console.log('[TestFilter] Hovered over "Filter" button (Strategy 1).');
          
          // 如果 hover 不够（有时需要点击一下才能保持展开），可以追加点击
          // await filterBtn.click(); 
      } catch (e1) {
          console.warn('[TestFilter] Strategy 1 failed, trying Strategy 2 (CSS Selector)...');
          try {
              // 策略2: 使用用户提供的完整 CSS 选择器
              const selector = '#global > div.main-container > div.with-side-bar.main-content > div > div > div.search-layout__top > div.filter';
              await page.locator(selector).hover();
              console.log('[TestFilter] Hovered over "Filter" button (Strategy 2).');
          } catch (e2) {
              console.warn('[TestFilter] Strategy 2 failed, trying Strategy 3 (Simple Text)...');
              // 策略3: 最后的倔强
              await page.getByText('筛选').hover();
              console.log('[TestFilter] Hovered over "Filter" button (Strategy 3).');
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
        f.distance   // e.g. "不限"
      ].filter(Boolean);

      for (const option of optionsToClick) {
        // 如果是“不限”，有时不需要点，但点了也无妨，确保重置
        console.log(`[TestFilter] Clicking option: ${option}`);
        
        // 使用正则精确匹配文本，防止“一天内”匹配到“一周内”
        // 假设选项都在 div 中
        try {
            await page.locator('div').filter({ hasText: new RegExp(`^${option}$`) }).click();
            await page.waitForTimeout(300); // 稍微等待一下点击反应
        } catch (e) {
            console.warn(`[TestFilter] Failed to click option "${option}": ${e.message}`);
        }
      }
      
      // 收起面板
      // 尝试点击“收起”按钮
      try {
        if (await page.getByText('收起').isVisible()) {
            await page.getByText('收起').click();
        } else {
            // 如果没找到收起，再次点击筛选按钮
            await page.getByText('筛选').click();
        }
      } catch (e) {
        console.log('[TestFilter] "收起" button not interactable, clicking "筛选" to close.');
        await page.getByText('筛选').click();
      }
      
      console.log('[TestFilter] Filter applied.');
    } else {
        console.log('[TestFilter] Filter disabled in config.');
    }
    
    console.log('[TestFilter] Test complete. Pausing for inspection...');
    // 暂停脚本，让用户可以看到结果
    // await page.pause(); // 在 headless 模式下 pause 可能不直观，这里直接结束或等待
    // 如果是 CLI 运行，通常结束后浏览器会关闭。为了让用户看清，我们可以等待一段时间
    await page.waitForTimeout(5000);
  }
};
