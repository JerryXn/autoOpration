## 目标
- 为运行日志区分级别并着色，便于快速定位（info/warn/error/debug）。
- 修复 Terminal#336-374 的数据库错误：notes 表的 `platform_id` 非空约束导致 Python 的 `update_desc` 写入失败。

## 日志分级与着色（实现方案）
- Node 主进程：为 Python 子进程 stdout/stderr 增加行级解析与着色输出。
  - 解析 JSON 行中的 `status`/`action`/`step_id`：
    - status=ok/info → 绿色
    - status=begin/end → 蓝色
    - status=warn → 黄色
    - status=error → 红色
  - 非 JSON 行按来源（stdout→白色、stderr→红色）着色；保留原始文本一行一条，避免干扰日志收集。
- Python 侧：在关键步骤打印具有 `status` 字段的结构化日志（当前已在用），不改变现有逻辑，仅确保所有阶段都含 `status`；必要处补充 begin/end/info/error。

## 数据库修复（用外层 .env 的库）
- 现象：`(1364, "Field 'platform_id' doesn't have a default value")`，说明 `notes.platform_id` 为 NOT NULL 且 Python 写入只用 `note_id`。
- 处理：向 `auto_final` 执行兼容迁移，不改变数据但放宽约束：
  - 将 `notes.platform_id` 改为可空并给默认：
    - `ALTER TABLE notes MODIFY platform_id BIGINT UNSIGNED NULL DEFAULT NULL;`
  - 将 `requests_log.status` 统一为 INT（Python用数值）：
    - `ALTER TABLE requests_log MODIFY status INT NULL;`
- 验证后如需补充平台信息，使用后台 DML 任务按 `note_url` 前缀或采集源批量回填 `platform_id`（可选）。

## 统一配置（确保只用外层 .env）
- 停用 `auto_opration_python/.env` 加载；所有数据库连接只读取进程环境 `MYSQL_*`（现已调整）。
- 启动时打印：Node `[start-auto-op] MYSQL_DATABASE=auto_final` 与 Python `connect info database=auto_final`。

## 验证
- 运行一次，观察着色日志：comments、feed_desc、page_store 阶段颜色区分清晰；`update_desc error` 不再出现。
- 在 `auto_final` 检查：`SELECT COUNT(*) FROM notes;`、`requests_log;`、`xhs_comment_replies;` 有增长。

若你确认，我将：
1) 在主进程加着色日志输出；
2) 对 `auto_final` 执行上述 ALTER 迁移；
3) 回归一次并展示彩色分级日志与入库结果。