## 目标
- 点击“执行”后，仅调用 `auto_opration_python` 的主方法接管所有浏览器与采集操作。
- 彻底删除现有 Node/Playwright 的页面操作（搜索、输入、点击等），不再在 Electron 项目内做这些动作。
- 统一配置：继续使用当前 `.env` 并将其传递给 Python侧；UI勾选项映射为 Python CLI 参数。

## 方案概述
- 前端：保留“执行”按钮与关键词/勾选项输入；不显示 AutoOp 控制浮层或分步控制。
- 主进程：
  - 用 `child_process.spawn` 调用 `python -m src.main_xhs --keyword=<kw> ...`；将 UI 勾选项映射为 Python CLI 标志（如 `--comment`、`--like`、`--fav`、`--record`、`--limit`、`--delayRange`）。
  - 将 `.env` 中的数据库与运行环境变量原样注入到 Python 子进程（`env` 合并传递）。
  - 监听 stdout/stderr 并回传到渲染层日志区；提供停止按钮发送 `child.kill()`。
- Python 项目：保留原有逻辑不改动；确保读取传入的环境变量与 CLI 参数；连接同一 MySQL 库（`.env` 中的 `MYSQL_*`）。

## 配置统一
- `.env` 作为统一基础：`MYSQL_HOST/PORT/USER/PASSWORD/DATABASE`、`APP_LOCALE/APP_TIMEZONE` 等。
- UI → CLI 参数映射（示例）：
  - 关键词：`--keyword="<输入框值>"`
  - 勾选项：`--comment`、`--like`、`--fav`、`--record`（勾选则带标志）
  - 数量限制：`--limit=<count>`
  - 延迟范围：`--delayRange=<min-max>`
- 主进程在 spawn 时 `env: { ...process.env, ...overrides }`，让 Python 侧直接感知相同 `.env`。

## 删除与精简
- 删除/停用以下 Node 侧逻辑：
  - 所有 Playwright 页面操作（`src/playwright/session.js/list.js/detail.js/actions.js`）的调用入口在主进程中不再使用；避免 `page.evaluate: Target page has been closed` 类错误。
  - AutoOp 控制 UI（浮层、分步、next/retry/error 事件）；视图仅保留执行入口与简易日志。
- 保留仓储层与数据库初始化脚本，但对 Python 侧入库不做拦截。

## 主进程实现要点
- `ipcMain.handle('start-auto-op', ...)`：
  - 收集 payload（关键词与勾选项），组装 Python CLI 参数。
  - `spawn('python', ['-m', 'src.main_xhs', '--keyword=...', '--comment', ...], { cwd: <auto_opration_python目录>, env: { ...process.env } })`。
  - 将输出通过 `ipcRenderer` 回传到渲染层；异常时返回错误消息。
- `ipcMain.handle('stop-auto-op', ...)`：
  - 若子进程仍在，调用 `child.kill()` 并清理状态。

## 验证
- 点击“执行”后，终端与前端日志展示来自 Python 的 stdout/stderr；Python按原逻辑控制浏览器与采集。
- 数据库落表由 Python 项目负责；检查 `users/platforms/features/...` 与内容侧表是否按 `.env` 的 `MYSQL_DATABASE` 写入。
- 取消 Node Playwright 操作后，不再出现 `page.evaluate` 相关关闭错误（Terminal#19-24）。

## 交付
- 更新主进程：新增 Python 子进程调用、日志回传与停止；移除原有 Playwright 调用。
- 更新视图：删除控制浮层与分步逻辑，仅保留执行按钮与日志区。
- 保留 `.env` 并确保在 Python 子进程中生效；无需再重复配置。