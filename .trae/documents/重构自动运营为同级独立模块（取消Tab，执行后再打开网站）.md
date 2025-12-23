## 目标
- 将“自动运营”从发布页的Tab中移除，作为与“发布”同级的独立模块展示。
- 用户在本页勾选类型、关键词、动作与限速后，点击“执行”才打开对应平台并开始模拟操作。
- 保证严格的HTML结构与样式作用域，避免影响其它页面。

## 页面结构调整
- 移除Tab中的“自动运营”按钮：删除 `src/index.html` 中 `autopub-tabs` 下的 `<button class="tab" data-tab="autoop">自动运营</button>`（src/index.html:55-63）。
- 删除旧的 `#autoop-pane` 容器（src/index.html:159-202），并新增同级模块：
  - 在 `#autopub-card` 内，添加 `<section id="autoop-section">`，包含：
    - 标题区：中文标题与英文标识（auto_operation）。
    - 操作区：保留现有输入控件（类型、关键词、动作勾选、数量与频率、随机延迟、MCP地址），按钮改为“执行”和“停止”，状态展示。
  - 所有控件沿用当前ID：`autoop-type`、`autoop-keywords`、`autoop-browse`、`autoop-like`、`autoop-fav`、`autoop-comment`、`autoop-record`、`autoop-limit-count`、`autoop-limit-permin`、`autoop-limit-perhour`、`autoop-delay-range`、`autoop-mcp-url`、`autoop-start`（文案改“执行”）、`autoop-stop`、`autoop-status`、`autoop-log`。

## 样式约束
- 样式仅在当前页容器生效：新增 `#autoop-section` 的卡片样式（圆角、阴影、内边距），并将自动运营相关栅格与表单布局限定为 `#autoop-section` 作用域。
- 继续保留并使用已作用域化的发布页样式（`#autopub-card`），避免通用 `.tabs`、`.publish-*` 的全局影响（现有作用域位于 src/styles/app.css:15-43、31-36、40-43）。

## 前端交互绑定
- 更新 `src/views/autopublish.js`：
  - 移除 `setActiveTab('autoop')` 分支（src/views/autopublish.js:223-227）。Tabs 仅保留“素材导入/发布列表/任务设置”。
  - 保留自动运营的事件绑定与调用：
    - 启动：`autoStart` 点击后收集表单并调用 `services.ipc.startAutoOp(payload)`（src/views/autopublish.js:318-333）。按钮文案改为“执行”。
    - 停止：`autoStop` 调用 `services.ipc.stopAutoOp(currentRunId)`（src/views/autopublish.js:334-340）。
  - 初始化默认Tab仍为 `setActiveTab('import')`（src/views/autopublish.js:343）。

## 后端行为保持
- IPC 接口与后端逻辑不改动：`start-auto-op` / `stop-auto-op` / `list-auto-op-runs` 已实现（src/main.js:705-761）。
- 仅在用户点击“执行”后才创建 `BrowserWindow` 并加载平台网页，符合“执行后打开网站”的期望。

## 验证
- 启动应用，确认其它页面未受影响：Tabs 与列表样式保持原样（作用域生效）。
- 在同一页面中：
  - 勾选自动运营选项并点击“执行”，后台打开平台窗口并开始模拟操作；
  - 点击“停止”关闭运行窗口，状态更新。
- 回归测试：素材导入与发布列表功能正常；切换Tab不触发任何网站跳转。

## 变更文件清单
- 编辑：`src/index.html`（结构重排与模块新增）
- 编辑：`src/styles/app.css`（新增 `#autoop-section` 作用域样式）
- 编辑：`src/views/autopublish.js`（移除 autoop Tab 分支，保留执行/停止绑定）

请确认以上方案，我将据此实施并进行验证。