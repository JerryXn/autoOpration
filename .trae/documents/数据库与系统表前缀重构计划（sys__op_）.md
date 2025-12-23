## 总体目标
- 将系统级表统一为 `sys_` 前缀；将自动运营/抓取相关表统一为 `op_` 前缀。
- 保持数据与功能不变，最小停机、可回滚；若遗漏修改，临时视图兼容旧名称。

## 表名映射（完整清单）
- 系统表（sys_）：
  - `users` → `sys_users`
  - （如后续存在：`roles`→`sys_roles`、`permissions`→`sys_permissions`、`sessions`→`sys_sessions`、`audit_logs`→`sys_audit_logs`）
- 自动运营表（op_）：
  - `notes` → `op_notes`
  - `interactions` → `op_interactions`
  - `images` → `op_images`
  - `tags` → `op_tags`
  - `note_tags` → `op_note_tags`
  - `comments` → `op_comments`
  - `comment_interactions` → `op_comment_interactions`
  - `comment_fetch_log` → `op_comment_fetch_log`
  - `requests_log` → `op_requests_log`
  - `xhs_comment_replies` → `op_comment_replies`
  - `xhs_comment_reply_responses` → `op_comment_reply_responses`
  - `xhs_users`（抓取到的小红书用户）→ `op_users_xhs`

## 列类型统一（防截断与越界）
- 统一：`note_id`/`user_id`/`author_id` → `VARCHAR(64)`（所有 `op_*` 表）
- 时间戳（毫秒写入）：将 `op_comment_fetch_log.ts` → `BIGINT`；保留 `created_at`/`updated_at` 为 `TIMESTAMP`。
- 图片表 `op_images.url` 保持 `NOT NULL`；插入逻辑过滤空URL。

## DDL/数据迁移脚本
- 批量重命名（原子）：
  - `RENAME TABLE users TO sys_users, notes TO op_notes, interactions TO op_interactions, images TO op_images, tags TO op_tags, note_tags TO op_note_tags, comments TO op_comments, comment_interactions TO op_comment_interactions, comment_fetch_log TO op_comment_fetch_log, requests_log TO op_requests_log, xhs_comment_replies TO op_comment_replies, xhs_comment_reply_responses TO op_comment_reply_responses, xhs_users TO op_users_xhs;`
- 列修正（已改/继续核验）：
  - `ALTER TABLE op_notes MODIFY author_id VARCHAR(64) NULL;`
  - `ALTER TABLE op_images MODIFY note_id VARCHAR(64) NOT NULL;`
  - `ALTER TABLE op_note_tags MODIFY note_id VARCHAR(64) NOT NULL;`
  - `ALTER TABLE op_interactions MODIFY note_id VARCHAR(64) NOT NULL;`
  - `ALTER TABLE op_comments MODIFY note_id VARCHAR(64) NOT NULL;`
  - `ALTER TABLE op_comment_replies MODIFY note_id VARCHAR(64) NOT NULL;`
  - `ALTER TABLE op_comment_fetch_log MODIFY note_id VARCHAR(64) NOT NULL, MODIFY ts BIGINT NULL;`
- 兼容视图（防遗漏，临时）：
  - `CREATE VIEW notes AS SELECT * FROM op_notes;` 等，为全部旧名创建只读视图；完成代码改造后逐步移除。
- 备份与回滚：
  - 备份：`mysqldump auto_final > auto_final_bak.sql`
  - 回滚：`RENAME TABLE sys_users TO users, op_notes TO notes, ...`（反向重命名）或用备份恢复。

## 全项目改造点（文件级）
- Python 存储层（强制）：
  - `auto_opration_python/src/storage/xhs_repo_mysql.py`
    - DDL：将所有 `CREATE TABLE` 语句表名改为 `op_*`/`sys_*`
    - DML：将所有 `INSERT/UPDATE/DELETE/SELECT` 的表名改为新前缀
    - 函数受影响：`upsert_note`、`upsert_interactions`、`replace_images`、`replace_tags`、`upsert_comment`、`upsert_comment_interactions`、`log_comment_fetch`、`log_request`、`store_comment_reply`、`store_comment_reply_response`
    - 已注意类型修正与空URL过滤（images）
- Python 业务层：
  - `auto_opration_python/src/invoke/comment_pipeline.py`：无直接表名引用，保留；确保调用的存储层函数指向新表
- Python 配置/脚本：
  - `auto_opration_python/scripts/run_dml_updates.py`：如引用表名，替换为 `op_*`
  - `scripts/*`（自研工具）：如 `db_verify.js`、`inspect_schema.js`、迁移脚本，目标表名改为 `op_*`/`sys_*`
- Node/Electron：
  - `src/main.js`：不直接引用表名；保留日志分类/着色（不用改）

## 全项目扫描与缺失项排查（执行前步骤）
- 代码扫描目标与关键词：
  - 表名关键字：`notes|interactions|images|tags|note_tags|comments|comment_interactions|comment_fetch_log|requests_log|xhs_comment_replies|xhs_comment_reply_responses|xhs_users|users`
  - SQL片段：`INSERT INTO`, `UPDATE`, `DELETE FROM`, `SELECT ... FROM`
- 扫描成果处理：
  - 逐一替换为 `op_*`/`sys_*`
  - 若存在硬编码的旧表名（例如在字符串拼装或日志中），统一调整
  - 对任何 `BIGINT` 写入字符串 ID 的列进行类型核验（全部应为 `VARCHAR(64)`）

## 验证流程
1. 只读停机 → 备份 → `RENAME TABLE`/`ALTER` 执行
2. 启动应用 → 运行评论流程
3. 验证写入：
   - `SELECT COUNT(*) FROM op_comment_replies;`
   - `SELECT COUNT(*) FROM op_comment_reply_responses;`
   - `SELECT COUNT(*) FROM op_comments;`
4. SQL 日志：
   - 分类为 [数据库]/[操作]/[远程调用]，级别 `info/warn/error`；错误为红色，截断为灰色静默；图片空URL跳过有 warn
5. 视图临时保护：旧名访问仍可读（若启用视图），逐步下线视图

## 风险与对策
- 外键/索引名：若使用外键约束，需按新表名重建；当前抓取表多用逻辑关系（索引），基本无外键（经验证）。
- 未替换遗漏：视图兜底，联调后清理视图；扫描过程确保所有 DML/DDL 的表名替换到位
- 回滚：保留备份与反向重命名脚本

## 交付物
- 重命名与列修正 SQL 脚本（含回滚）
- 代码修改 PR（Python 存储层与工具脚本）
- 视图临时兼容脚本（可选）
- 验证清单与操作指南