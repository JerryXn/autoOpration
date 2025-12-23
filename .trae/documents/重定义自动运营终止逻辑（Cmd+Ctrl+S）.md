## 目标
- 在自动运营运行期间，按下 `Control+Command+S` 立即终止当前运行，关闭自动运营窗口并通知渲染层。

## 快捷键与平台
- 快捷键采用 Electron 主进程全局注册：`Command+Control+S`（仅 macOS）。
- 保留现有用户介入日志终止机制（页面事件）作为补充。

## 主进程实现
- 引入 `globalShortcut`，在 `start-auto-op` 成功启动后注册快捷键。
- 注册成功后，将当前运行的 `runId` 视为激活运行；按下快捷键时：
  - 将 `global.autoOpRuns.get(runId).stopped = true`，记录当前步骤 `step`。
  - 关闭对应 `BrowserWindow`。
  - 通过 `mainWindow.webContents.send('autoop-stopped', { runId, step })` 通知渲染层。

## 注册与释放
- 在 `stop-auto-op` 完成关闭后，调用 `globalShortcut.unregister('Command+Control+S')` 释放快捷键。
- 在 `app.on('will-quit')` 中调用 `globalShortcut.unregisterAll()`，防止残留。
- 如果再次启动新运行，重新注册同一快捷键，使其总是控制当前激活运行。

## 渲染层表现
- 复用现有监听：`window.api.onAutoOpStopped`；界面提示保持为“已停止（用户介入） 步骤: xxx”。
- 无需改动 UI；若需要可追加“（快捷键触发）”字样。

## 兼容性与扩展
- 仅在 `process.platform === 'darwin'` 时注册 `Command+Control+S`。
- 未来可在 `.env` 或设置页支持自定义加速键（例如 `AUTOOP_STOP_ACCELERATOR`），本次先固定为你指定的组合。

## 验证步骤
- 启动自动运营，确保日志输出“autoop window opened”。
- 按下 `Control+Command+S`，观察：
  - 主进程记录停止并关闭自动运营窗口。
  - 渲染层收到 `autoop-stopped` 事件并更新状态。
  - 无需页面事件或焦点也能生效（全局快捷键）。

确认后我将按以上方案修改 `src/main.js`，并进行本地验证。