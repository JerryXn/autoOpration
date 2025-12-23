## 变更目标
- 彻底删除页面浮窗 UI 与相关控制逻辑，取消自动流程与复杂阶段队列。
- 仅保留最原始功能：打开小红书，定位搜索框，输入指定关键词并提交搜索。
- 保持持久化登录与基本抗检测设置（真实 UA、语言头），不再注入任何页面 UI。

## 清理范围（删除/移除）
- 删除文件：
  - `src/playwright/overlay.js`
  - `src/playwright/runner.js`
  - `src/autoop/selectors.js`
  - `src/autoop/steps.js`
- 移除绑定与注入：
  - 删除 `src/playwright/index.js` 中对 `overlayJs` 的读取与 `addInitScript` 注入（当前位于: 5、37-40、73-75）。
  - 删除 `exposeBinding('autoopNative', ...)` 的所有命令分支，仅保留搜索脚本所需的最小函数（当前位于: `src/playwright/index.js:42-71`）。
- 可选（不影响当前需求）：不动 Electron 相关视图与 IPC 文件，保留现状。

## 新的最简实现
- 在 `src/playwright/index.js` 提供极简 API：
  - `startSession({ plat='xhs', url })`：启动持久化上下文并打开首页。
  - `search(page, kw)`：
    - 定位输入框候选：`input[placeholder*="搜索小红书"]`、`input[type="search"]`、`input[placeholder*="搜索"]`、`input[aria-label*="搜索"]`、`input`。
    - 校验可见性、滚动居中、`focus()`，`keyboard.type(kw, { delay: 30 })`，`keyboard.press('Enter')`。
    - 打印日志：输入框选择器、是否提交成功。
- 在 `src/playwright/open.js` 支持 `--kw` 参数：
  - 示例：`node src/playwright/open.js --kw "面包"`
  - 启动会话后调用 `search(page, kw)`，输出运行结果。

## 代码要点
- 仍保留持久化目录与抗检测：
  - UA 与 `Accept-Language` 设置：`src/playwright/index.js:21、26、31`。
  - `chromium.launchPersistentContext(userDataDir, { headless:false })` 保持现状。
- 不引入新依赖；所有逻辑在 Playwright 层完成。

## 验证步骤
- 运行：`node src/playwright/open.js --kw "美食"`。
- 观察浏览器：输入框被聚焦并逐字符输入“美食”，随后提交（`Enter`），页面进入搜索结果。
- 控制台输出包含：选中的输入框选择器、提交状态与当前 URL。

## 交付内容
- 删除 4 个文件并更新 `src/playwright/index.js` 与 `src/playwright/open.js` 为最简实现。
- 提供清晰日志与无 UI 的纯脚本控制方式，满足“打开→输入→提交”需求。

请确认以上方案；确认后我将立即执行删除与改写，并进行端到端验证。