## 重构目标
- 用 Playwright Locator API 替换手写 `page.$/$$/evaluate` 为主，提升稳定性与可读性。
- 输出仅保留你指定的最小字段：`author`, `title`, `text`, `images`, `published_at`, `comments_count`, `url`。
- 全流程加入 0.5–1 秒随机等待，降低反爬与加载时序风险。
- 保留并强化登录态：持久化目录锁冲突时复制原数据到新目录并跳过锁文件。
- 采用结构化分层与清晰注释（JSDoc + 行内注释），便于快速理解与维护。

## 架构与文件结构
- `src/playwright/session.js`
  - `startSession(opts)`：持久化上下文+反检测注入+锁冲突回退（复制数据）。
  - `stopSession(plat)`：关闭上下文，清理缓存。
- `src/playwright/locators.js`
  - 提供稳定的 Locator 组合：
    - `getSearchInput(page)`：`getByPlaceholder('搜索小红书')/getByRole('searchbox')/locator('input[type=search]')`。
    - `getListCards(page)`：基于 `role=article/.note-item/[data-note-id]` 的组合。
    - `getDetailRoot(page)`：`article/.note-content/[data-content]`。
- `src/playwright/list.js`
  - `collectSearchList(page, { limit, scroll })`：支持首屏采集（`scroll=false`）与滚动采集。
  - 图片封面解析支持 `img.live-img/data-src/srcset/style.background-image`。
- `src/playwright/detail.js`
  - `extractRequired(page)`：返回最小字段集；标题兜底策略（容器标题→meta→正文首行）。
  - 内置图片列表解析同上；评论与日期解析稳定正则。
- `src/playwright/actions.js`
  - `search(page, kw)`：使用 Locator 输入与提交，必要时点击“笔记”标签；每步随机等待。
  - `openNoteInNewTab(ctx, page, href)`：严格使用列表 `href` 打开新标签页（无 `_blank` 时强制新页+`goto`）。
- `src/playwright/open.js`
  - CLI 入口：解析参数→`startSession`→`search`→`collectSearchList`→用列表第一条 `href` 打开详情→`extractRequired`→打印单一 JSON。

## 公共约定（注释与风格）
- 所有导出函数添加 JSDoc：参数、返回值、用途说明。
- 关键选择器与兜底路径在注释中解释其适用场景与风险。
- 统一工具方法：
  - `waitRand(page, 500, 1000)`：随机等待；在 `session/search/list/open/detail` 关键节点调用。
  - `isVisible(locator)`：辅助判断可见与尺寸合格。

## 具体实现要点
### 会话与登录态
- 目录：`~/.autoOperation/playwright/<plat>`；若 `SingletonLock` 冲突，创建 `~/<plat>-<timestamp>` 并复制原目录（跳过锁文件），继续启动，登录态延续。
- 反检测：`navigator.webdriver`、`languages/plugins/WebGL` 等注入保持现有能力。

### 随机间隔
- 在以下动作后调用 `waitRand`：
  - 打开首页；搜索框 `focus`；`type`；`press('Enter')`；等待 `domcontentloaded`
  - 列表滚动前后；新标签页弹出/`goto` 后；详情抽取前后；视频尝试后

### Locator 重构策略
- 搜索框：`page.getByPlaceholder('搜索小红书')` → 兜底 `page.getByRole('searchbox')` → `page.locator('input[type=search], input[aria-label*=搜索]')`。
- 列表卡片：
  - `page.locator('a[href*="/explore/"]')` 与 `page.locator('article, .note-item, [data-note-id]')` 结合；
  - 当卡片无锚点时，用 `data-note-id` 组装 `href`（`/explore/<id>`）。
- 详情根容器：优先 `article` → `.note-content` → `[data-content]`；
  - 字段定位均以根容器为范围，避免误取列表或评论区。

### 列表采集
- 参数：`{ limit=30, scroll=true }`
- 首屏模式：`scroll=false` 仅扫描一次，但会轻微滚动（300px）唤醒懒加载后恢复顶部；确保尽量有卡片。
- 解析字段：`href/noteId/title/author/cover/snippet`；
  - `cover` 支持 `img.live-img`/`data-src`/`data-original`/`srcset`/`background-image`。

### 详情提取
- 标题：`#detail-title` → 根容器 `.title/[data-title]/h1/h2` → `meta[property="og:title"]` → 正文首行兜底。
- 正文：优先 `#detail-desc`；无则容器文本。
- 图片列表：同封面解析规则，返回去重后的 URL 列表。
- 日期与评论：已稳定正则；返回 `MM-DD` 与数字。

### 新标签页
- 强制来源一致：使用列表第一条的 `href` 打开。
- 优先监听 `popup`，失败用 `context.newPage()+goto(href)`。

### 输出与日志
- 仅输出一次 JSON：`{ author, title, text, images, published_at, comments_count, url }`。
- `--save-list` 时仅在列表阶段打印一次 `{"list": [...]}`，不输出其它内容。

## CLI 参数
- `--kw <关键词>`
- `--limit <数量>`
- `--new-tab`
- `--save-list`
- `--no-scroll`（仅首屏，不翻页）

## 验证
- 场景 1：`node src/playwright/open.js --kw "美食" --limit 10 --new-tab`
- 场景 2（首屏）：`node src/playwright/open.js --kw "美食" --limit 5 --new-tab --no-scroll`
- 期望：
  - 搜索 → 列表（非空） → 新标签页打开列表第 1 条 → 打印最小字段 JSON。

## 交付
- 新增模块文件：`session.js/locators.js/list.js/detail.js/actions.js`
- 重写 `open.js`（保留现参与行为）
- 完整注释与 README 小节（CLI 用法与字段说明）

## 注释风格
- 顶部 JSDoc 概述函数用途、参数与返回值。
- 关键 Locator 旁附加注释解释选择器的业务含义与兜底逻辑。
- 行内注释简洁说明每一步的目的与可能的站点差异。