## 目标
- 用 Playwright 持久化浏览器驱动“自动运营”所有阶段（搜索→列表→详情→受限回退→下一条）。
- 在站点页面中显示自带浮窗控制器，并将按钮操作映射到 Playwright 页面动作。
- 选择器集中管理并可运行时覆盖，日志与数据库采集沿用现有实现。

## 架构与职责
- 控制器浮窗：页面内注入（`overlay.js`），提供阶段选择、选择器输入、下一步、开始/暂停。
- Playwright 执行器：动作适配层（`runner`），将“原子动作”映射到 Playwright API。
- 选择器来源：默认集合（`src/autoop/selectors.js`）+ 运行态覆盖（来自浮窗或渲染层）。
- 状态与调度：运行态 `st`（队列、指针、忙锁、autoplay、visited 等），自动推进与手动“下一步”排队。
- 数据采集：在详情页用页面脚本提取字段，通过现有主进程的入库函数写入 MySQL。

## 新增与修改文件
- 新增：`src/playwright/runner.js`（执行器）
- 修改：`src/playwright/index.js`（绑定 overlay → runner）、`src/main.js`（可选：增加 IPC 触发 Runner 执行/关闭）
- 保持：`src/autoop/selectors.js`、`src/autoop/steps.js` 继续作为统一来源

## Playwright 执行器（runner）
- 暴露 API：
  - `init({ context, page, selectorsDefault })`：初始化运行态 `st`（queue、pointer、paused、autoplay、visited、selectors）
  - `setSelector(stage, selector)`：覆盖 `st.selectors[stage]` 并注入到页面变量
  - `toggleAutoplay()`：切换 `st.autoplay`
  - `next()`：若 `st.busy` 则置 `st.userNextPending`；否则执行 `perform(st.queue[st.pointer])`
  - `perform(act)`：按动作类型执行（详见下方）
- 动作映射：
  - `query_selector`：合并覆盖选择器 + 默认集合，`page.$(sel)` → 可见性判断 → `st.lastTarget={x,y}`
  - `move_to/hover`：`page.mouse.move(x,y)` + 可选等待
  - `mouse_down/mouse_up/click`：`page.mouse.down/up` 或 `page.mouse.click(x,y,{button})`
  - `text_input`：`locator.focus()` → `page.type(inputSelector, kw, {delay: 30})`
  - `program_click`：中心点坐标点击；失败回退 `elementHandle.click()`
  - `wait`：`page.waitForTimeout(ms)`
  - `detect_restricted`：`page.url().includes('/404?') || 文案匹配('暂时无法浏览','返回首页')` → `st.restricted=true`
  - `program_back`：优先点击“返回首页”按钮；兜底 `page.goBack()`
  - `query_selector_next`：在默认集合里遍历可见候选，过滤 `visited`，选中未访问链接 → `st.lastTarget`
- 调度与日志：
  - 每步完成后：`pointer++`，推送 `[autoop-step]` 日志到控制台与 overlay（可用 `page.evaluate` 更新浮窗日志）
  - 自动推进：若 `st.autoplay || st.userNextPending` 且未暂停/停止，`setTimeout(next, 0)` 连续执行

## Overlay → Runner 绑定
- 在 `index.js` 的 `exposeBinding('autoopNative')` 中：
  - `cmd==='setSelector'` → `runner.setSelector(stage, selector)`
  - `cmd==='next'` → `runner.next()`
  - `cmd==='toggleAutoplay'` → `runner.toggleAutoplay()`
- 初始化时注入阶段列表：`['search_focus','search_input','search_click','browse_list','open_item','back_to_list','open_next_item']`
- 将关键事件写入浮窗日志：`page.evaluate(()=>window.__overlayLog(...))`（在 overlay 里暴露 `__overlayLog`）

## 选择器策略
- 默认集合：读取 `src/autoop/selectors.js`；在 Runner 内缓存为 `selectorsDefault`
- 覆盖优先：若 `st.selectors[stage]` 有值，优先使用；否则逐个尝试默认集合
- 可见性判定：宽高阈值、样式 `display/visibility/opacity`、`elementFromPoint` 保障真实可点击

## 数据采集与入库
- 详情页解析：标题、作者、图片、笔记 ID、URL 等使用 `page.evaluate` 提取
- 函数复用：沿用主进程现有入库函数（`src/main.js:292-446`），通过 IPC 传递数据对象从 Runner 回主进程写库
- 受限页处理：命中后不采集详情，直接 `back_to_list → open_next_item`

## 指纹与持久化
- 持久化会话：`chromium.launchPersistentContext(userDataDir)`，目录 `~/.autoOperation/playwright/<plat>`
- 指纹设置：`userAgent` 与 `Accept-Language`；可选再注入 `navigator`/`screen` 常值（后续增量）

## 验证与观测
- 功能验证：
  - 手动：浮窗“应用选择器/下一步/开始暂停”联动 Runner；日志出现连续步骤
  - 自动：`autoplay=true` 连续推进，遇受限页自动回退并打开下一候选
- 数据验证：
  - 采集一条详情并写入 MySQL，检查对应表的记录存在
- 回归检查：
  - 列表页选择器修改后立即生效，不需重启

## 风险与回滚
- 并发风险：用 `st.busy` 锁和 `userNextPending` 排队避免竞争
- 注入失败：`page.addInitScript`/`exposeBinding` 若异常，Runner 应降级为控制台驱动；可回滚到 Electron 流程
- 反检测：保持节奏与事件链的自然性（延迟、鼠标轨迹可后续增强），发现命中率提升时再加“真实滚动与随机停顿”

## 交付里程碑
- M1：实现 `runner` 最小闭环（selector → query → click → type → detect → back → next），浮窗联动
- M2：接入入库流水，完成一条采集与持久化
- M3：指纹与行为增强（滚动/随机停顿/轨迹）与浮窗选择器清单视图

请确认该方案，我将开始实现 Runner 与绑定、连通数据采集与入库。