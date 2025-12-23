## 重构目标
- 将现有入口逻辑（搜索、回退、详情、动作、存储、评论管道）拆分为职责清晰的模块与方法，降低认知负担、便于接手维护。
- 保持现有功能与 CLI 兼容：关键词解析、`--like/--fav/--record`、MySQL 写入、页面回退、动作鲁棒性、日志精简。

## 目录与文件结构
- `src/main_xhs.py`：仅保留 CLI 入口与高层编排（读取配置、构建 Orchestrator、运行）。
- `src/app/orchestrator.py`：流程编排器，协调搜索、详情动作与数据存储。
- `src/app/services/search_runner.py`：统一搜索入口（curl 模式 + 页面回退），输出标准 `NoteItem` 列表。
- `src/app/services/detail_executor.py`：详情页处理与动作执行（点赞、收藏、评论抓取）；封装 `BrowserOperator` 的使用。
- `src/app/services/datastore.py`：MySQL 连接与写入（`create_tables`、`store_items`、`update_desc`、`store_comments_page`）。
- `src/app/services/logging.py`：统一事件日志与必要的终端提示包装（复用现有 `LoggingService`）。
- `src/app/models.py`：类型定义（`NoteItem`、`SearchFilters`、`ActionResult`、`CommentsPageMeta`）。
- `tests/`：新增编排与服务层的单测骨架（以最小可验证为主）。

## 模块职责与方法
### Orchestrator（`orchestrator.py`）
- `class Orchestrator`
  - `run(keyword: str, do_like: bool, do_fav: bool, do_record: bool) -> None`
  - 调用 `SearchRunner.search(keyword)` 获取 `List[NoteItem]`
  - 迭代 `NoteItem`，对每条：`DetailExecutor.process_item(item, actions)`
  - 根据配置调用 `Datastore` 写入笔记与媒体信息、可选动作记录与评论分页。

### SearchRunner（`search_runner.py`）
- `class SearchRunner`
  - `search(keyword: str) -> List[NoteItem]`
  - 优先 curl 模式，失败/空列表回退到页面模式（滚动 + 解析 `a[href*="/explore/"]`）。
  - 输入：`Config`、`BrowserOperator`、`XhsApiService`
  - 输出：规范化的 `NoteItem(note_id, xsec_token, url, title, author, likes)`。

### DetailExecutor（`detail_executor.py`）
- `class DetailExecutor`
  - `open_detail(item: NoteItem) -> Page`
  - `fetch_desc(page, item) -> DescResult`
  - `perform_actions(page, item, do_like: bool, do_fav: bool) -> Dict[str, ActionResult]`
  - 内部封装点赞/收藏选择器优先级：`use[xlink\:href="#like"]/#collect`、`svg.reds-icon.*`、文本/ARIA 回退；显式等待与滚动；DOM 事件与坐标回退；`aria-pressed`/类名选中态归一化。
  - 与现有 `BrowserOperator` 协同，不改变已有动作实现，仅抽象调用与返回结构。

### Datastore（`datastore.py`）
- `class Datastore`
  - `connect() -> None`
  - `ensure_schema(store_raw_row: bool) -> None`
  - `store_notes(items: List[NoteItem]) -> StoreResult`
  - `update_desc(note_id: str, desc: str) -> None`
  - `store_comments_page(note_id: str, comments: List[Dict], meta: CommentsPageMeta) -> None`
  - 封装现有 `xhs_repo_mysql.py` 的方法；对外提供更语义化的接口。

### Logging（`logging.py`）
- 包装 `LoggingService` 与关键终端打印，维持：
  - 入口与导航：`goto_entry/goto_search`
  - 搜索：`search_notes(ok|error|captured)`
  - 详情：`detail_open/feed_desc`
  - 动作：`like_selectors/like_found/like_done`、`collect_*`
  - 存储与评论：`page_store/comments_page_store`

### Models（`models.py`）
- `@dataclass NoteItem`: `note_id: str`, `xsec_token: str`, `url: str`, `title: str`, `author: str`, `likes: str`
- `@dataclass ActionResult`: `status: Literal['ok','fail']`, `before: Optional[int]`, `after: Optional[int]`, `selected: Optional[str]`, `strategy: Optional[str]`
- `@dataclass CommentsPageMeta`: `status: int`, `has_more: bool`, `cursor: str`

## 入口精简（`main_xhs.py`）
- 仅保留：
  - `parse_args()`：解析 `--keyword/--like/--fav/--record/--userId`
  - `bootstrap_config()`：加载配置、可选设置 `user_data_dir` 与 `headless`
  - `build_services()`：实例化 `BrowserOperator/SearchRunner/DetailExecutor/Datastore`
  - `main()`：组合运行并捕获顶层异常（输出一次错误行）。

## 注释与文档
- 为所有公开类/函数添加简短而明确的 docstring（中文），描述用途、输入输出与副作用。
- 在复杂逻辑处增加行级注释（动作点击策略的关键分支），严格控制注释密度，只在必要处出现。

## 兼容与迁移
- 保留现有日志键与事件名称，避免打乱现有观测。
- 保留所有 CLI 旗标与环境变量；默认 `user_data_dir=~/.autoOperation/playwright/default` 可通过配置覆盖。
- 现有 `BrowserOperator`/`Detail`/`XhsApiService` 不做破坏性修改；仅抽象其调用层。

## 测试与验证
- 单测：SearchRunner（页面回退与解析 note_id 正则）、DetailExecutor（选择器优先级与属性态归一化）、Orchestrator（流程组装）。
- 手动验证：保持现有命令；确认进入详情页后动作日志完整输出。

## 交付与时间
- 第一步提交：新文件结构与类骨架 + main 入口调整（保功能等价）。
- 第二步提交：将现有实现迁移到新服务类（不改变行为），补充注释与测试。

## 需要确认
- 是否同意上述模块/文件划分；若你更偏好不同的命名或目录层级，我可按你的习惯调整。