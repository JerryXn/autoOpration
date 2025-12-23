## 问题确认
- 浮窗未显示：overlay 注入只在 `goto` 之后执行，导致首次页面未加载浮窗；且导航后未保证重新注入。
- 下一步无效：Runner 未收到关键词、以及忙锁与队列初始态不清晰；需要一键“人工操作”链路。

## 修复方案（严格说明）
### 1. 浮窗控制器在 Playwright 的稳定集成
- 在 `src/playwright/index.js`：
  - 将 `page.addInitScript(overlay)` 与 `exposeBinding('autoopNative')` 放在 `page.goto()` 之前，以确保首次导航就注入。
  - 在当前页面也执行一次 `page.evaluate(overlay)`，保证立即可见（无需等待下一次导航）。
  - 监听 `page.on('framenavigated')` 与 `page.on('load')`，在新文档时检测 `#autoop-overlay` 是否存在，不存在则重注入。
- 在 `src/playwright/overlay.js`：
  - 暴露 `window.__overlayLog`（已完成）；新增关键词输入框与按钮“运行搜索”，调用 `window.autoopNative('runSearch', { kw })`。

### 2. Runner 实现“人工操作”链路（一步到首篇）
- 在 `src/playwright/runner.js` 新增方法：
  - `setKeyword(kw)`：设置 `st.kwList=[kw]; st.currentKwIndex=0`。
  - `runSearchToFirst()`：顺序执行以下动作，完全模拟人工：
    1) `search_focus`：`query_selector → move_to → hover → mouse_down → wait → mouse_up`
    2) `search_input`：聚焦输入并逐字符 `keyboard.type(kw, {delay:30})`
    3) `search_click`：定位搜索按钮；如未找到则发送 `Enter`
    4) `browse_list`：等待列表可见并选择候选中心坐标
    5) `open_item`：鼠标坐标点击进入详情
    6) `detect_restricted`：若受限则 `program_back → open_next_item → open_item` 循环，直到成功进入正常详情
    7) `browse_detail`：`extract_note` 并打印 `{id,url,title,author,text,images,videos}` 到控制台与浮窗
- 在 `exposeBinding('autoopNative')` 中新增：
  - `runSearch`：`runner.setKeyword(payload.kw)` 后调用 `runner.runSearchToFirst()`。

### 3. 选择器与可见性策略
- 默认选择器来源：`src/autoop/selectors.js`。
- 运行时覆盖：浮窗“应用选择器”→ `setSelector(stage, selector)`；优先用覆盖，次用默认集合。
- 可见性校验：尺寸阈值、`display/visibility/opacity`、`elementFromPoint`，确保目标可点击。

### 4. 日志与用户反馈
- 每步写 `[pw-step]` 到控制台与 `__overlayLog`；关键拐点（进入详情/受限回退/提取完成）醒目标记。
- 浮窗在“运行搜索”按钮禁用期间显示“执行中”，结束恢复。

### 5. 验证步骤
- 启动：`npm run pw:open -- --plat xhs`。
- 页面右上角浮窗可见；输入关键词（默认可用“美食”），点击“运行搜索”。
- 观察日志序列：`search_focus → search_input → search_click → browse_list → open_item → detect_restricted → (回退循环) → extract_note`。
- 控制台与浮窗打印首篇笔记内容对象；图片/视频为 URL，不展开。

### 6. 风险与回滚
- 浮窗注入失败：保留控制台驱动与 Runner 直接调用；如需回滚，可退回 Electron WebContents 流程。
- 并发：`busy` 锁与 `userNextPending` 排队；“运行搜索”期间按钮禁用。
- 平台页面结构变化：通过选择器覆盖与文案兜底处理；若失败可提示在浮窗中更新选择器。

### 7. 交付
- 代码改动：`index.js` 注入时序与事件监听、`overlay.js` 增加关键词与“运行搜索”、`runner.js` 新增方法与动作链。
- 文档补充：在 `.trae/documents/自动运营步骤与选择器清单.md` 增加“Playwright 人工操作链路”段落（如你需要我可同步补充）。