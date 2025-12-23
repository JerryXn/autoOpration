## 开发目标
- 增加“采集开关”（默认开启），控制是否进行详情页的行为采集与入库。
- 以你现有 env 的数据库为存储后端（不保存截图文件，仅保存 URL 与 JSON/DOM）。
- 接入 XHS 适配器并抽象为跨平台统一数据模型与存储接口，后续可扩展其他平台。

## 开关实现
- 前端：在自动运营页新增 `采集开关`（默认选中），状态随启动参数传入。
- 启动参数：`captureEnabled: boolean`，写入运行状态。
- 运行时守卫：当 `captureEnabled=true` 执行采集与入库；为 `false` 则仅执行浏览动作，不写库。
- 也可支持环境变量覆盖：`AUTO_CAPTURE_ENABLED=true|false`。

## 事件采集与阈值（可配置）
- scroll：采样 300–500ms，合并同向增量。
- swipe_left/right：每次手势记录一条，300ms 内重复合并。
- hover：同一目标停留 ≥500ms 记录一次，随后每 2s 心跳。
- view_image：可视≥60% 且停留≥800ms 记录；“已浏览图片”阈值 1200ms。
- 已浏览笔记：停留≥5000ms 或浏览≥3 张图片（其一满足）。
- like/fav/comment/open_link：瞬时事件记录一次并附结果。

## 数据模型与 SQL
- 使用既定表结构：platform、creator、note、note_media、note_stats、tag、note_tag、browse_session、browse_event、note_visit、raw_snapshot（仅 JSON/DOM，无截图路径）、error_log。
- UPSERT 策略与示例沿用（作者/笔记/媒体/统计 upsert；会话与事件批量写入、错误与快照追加）。
- 索引：`browse_event(session_id,event_time)`、`note(author_id)`、`note(url)`、`note_visit(session_id,note_id)`。

## 存储驱动
- 从 env 读取数据库连接（SQLite/Postgres/MySQL 由你 env 决定），实现 `Storage` 接口：
  - `saveNote(note)`、`saveMedia(list)`、`upsertStats(stats)`
  - `appendSession(session)`、`appendEvents(events)`（≤200/批，事务）
  - `appendSnapshots(snaps)`（仅 JSON/DOM）
  - `appendErrors(errs)`
- 连接失败时：记录告警并降级为内存缓冲，不阻塞浏览流程。

## 平台适配器
- XHS 适配器提供：
  - `extractNote(ctx)`：标题、作者、发布时间、媒体列表、统计、受限状态、标签。
  - `locateScrollable(ctx)`、`locateMediaCarousel(ctx)`、`nextMedia(ctx,i)`：行为定位与可视判断。
- 适配器输出统一结构，存储层不感知平台差异。

## 操作→反馈闭环
- 进入详情页创建 `browse_session`；每个滚动/滑动/查看图片等动作写 `browse_event`。
- 进入与退出详情页写 `note_visit`，受限或风控命中写 `error_log`。
- 用户介入（本地鼠标/键盘）即停止：结束会话并写最后事件。

## 验证方案
- 开关为 ON：执行一次完整浏览（滚动 3 次、左右滑各 1 次、停留≥5s），检查库中：1条会话、≥5条事件、1条 visit、媒体条数匹配。
- 开关为 OFF：同样操作但只打印日志，不写库。
- 容错：DB 不可用时打印错误并跳过采集。

## 交付修改点
- 前端：自动运营页增加采集开关与状态提示。
- 主进程：运行状态携带 `captureEnabled` 并在详情流程中触发采集接口。
- 适配器与存储：新增 XHS 适配器与 Storage 实现（读取 env 连接）。

## 配置项
- `AUTO_CAPTURE_ENABLED`（默认 true）
- 采样与阈值：可通过配置对象覆盖（scroll/window、view_image 可视比例与时长、已浏览判定）。

确认后将按此方案开始实现并联调。