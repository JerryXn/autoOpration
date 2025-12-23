## 移除 AutoOp 控制
- 删除视图与交互：移除 `autoop-floater`、`onPlanPreview/onDebugReport/next/error/retry` 等控制逻辑与 UI。
- 保留“执行”按钮与参数输入；点击后直接触发集成管道，不再创建控制窗口或分步队列。

## 统一配置
- 单一 `.env` 基础配置对全项目生效（已在主进程与仓储层启用）：
  - 数据库：`MYSQL_HOST`、`MYSQL_PORT`、`MYSQL_USER`、`MYSQL_PASSWORD`、`MYSQL_DATABASE`
  - 运行：`APP_LOCALE`、`APP_TIMEZONE`、`APP_USERDATADIR`、`HEADLESS`
- 新增 `config/app.yaml` 作为默认参数：平台、关键字、limit、delayRange、actions（like/fav/comment/record）、是否滚动/新标签页等；UI 提交参数 > YAML 默认 > `.env`。

## 集成管道（原封不动重构 Python 逻辑）
- 新增模块 `src/integration/xhs/`：
  - `pipeline.js`：主流程（等价原 `src.main_xhs`）：搜索 → 列表采集 → 打开详情 → 详情解析（7 字段）→ 媒体入库 → 交互与统计入库 → 标签入库 → 评论抓取与回复、响应入库 → 请求/抓取日志入库；加入 0.5~1s 随机延迟与登录态。
  - `search.js`、`list.js`、`detail.js`：基于 Playwright 的稳定选择器与懒加载触发；详情输出严格 7 字段：`author/title/text/images/published_at/comments_count/url`；`url` 来自列表 `href`。
  - `comments.js`：抓取评论与交互；`comment_fetch_log` 记录 cursor_token/fetched_count。
  - `interactions.js`、`tags.js`：点赞/收藏/评论统计与标签落库。
  - `logger.js`：统一日志与错误上报。
- 选择器复用与增强：基于现有 `src/playwright/{session,locators}`，补充 `live-img/data-src/srcset/background-image` 图片解析与随机等待。

## 主进程改造
- `src/main.js`：
  - `start-auto-op` 读取 UI payload + `config/app.yaml` + `.env` 合并后，直接调用 `pipeline.run(options)`。
  - 移除旧的 AutoOp 控制窗口/队列/快捷键逻辑；保留基础日志输出。

## 仓储层与 SQL 对齐
- 使用 `src/db/repo.js` 统一入库；所有写操作不散落 SQL：
  - `requests_log(page_total, acc_total)`、`comment_fetch_log(cursor_token, fetched_count)`、`notes(description, note_time)`、`comments(commenter_id)` 等。
- 完整数据库结构：`db/global.sql`（无外键、唯一键+索引）已修正关键字；按 `.env` 的 `MYSQL_DATABASE` 使用。
- 提供迁移指引：对旧库按 `ALTER TABLE` 重命名关键列或重建后迁移数据。

## UI 与交互
- `src/views/autoop.js`：清理控制逻辑，仅保留执行一次的入口；执行中展示简单日志（stdout/stderr），不分步控制。

## 验证
- 使用关键词从 UI 启动，检查：
  - 列表不为空（不滚动与滚动两模式）；
  - 详情 7 字段正确且 `url` 与列表 `href` 一致；图片列表不为空（含 `live-img`）。
  - 勾选项联动 like/fav/comment/record 生效；随机延迟与登录态保留。
  - 数据库：平台、作者、内容、媒体、标签、交互、评论、评论交互、抓取日志、回复与响应均落库；唯一约束与索引正常。

## 交付
- 新增：`src/integration/xhs/{pipeline.js, search.js, list.js, detail.js, comments.js, interactions.js, tags.js, logger.js}`、`config/app.yaml`。
- 更新：`src/main.js`（启动管道）、`src/views/autoop.js`（简化执行入口）、`src/db/repo.js`（如需补充接口）。
- 删除：AutoOp 控制相关 UI 与主进程控制逻辑。

确认后我将开始代码改造与联调（保留逻辑、统一配置、去除控制界面）。