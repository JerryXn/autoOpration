## 修订点
- 去除所有外键约束，仅保留唯一键与索引。
- 修正关键字冲突列名：desc→description、time→note_time、comment_fetch_log.count→fetched_count、comment_fetch_log.cursor→cursor_token、comments.user_id→commenter_id、requests_log.page_count→page_total、requests_log.acc_count→acc_total。

## 文件更新
- 更新 `db/global.sql`：按上述列名与无外键版本重写相关表（requests_log/creators/notes/images/interactions/note_tags/comment_fetch_log/comments/comment_interactions/xhs_comment_replies/xhs_comment_reply_responses）。
- 更新 `src/db/repo.js`：
  - `upsertNote` 映射到 `description` 与 `note_time`，其余字段保持。
  - `logRequest` 写入 `page_total/acc_total`；保留其他字段。
- 检查并修正代码所有入库点：当前主进程仅通过仓储层写入，确保参数键与新列名一致；后续采集步骤沿用仓储层接口，避免散落 SQL。

## 验证
- 执行 `db/global.sql` 不再出现 1064 错误（cursor 改为 cursor_token）。
- 运行应用，点击“执行”，请求日志正常写入；后续扩展时各表可用。

## 交付
- 提交修订过的 SQL 文件与仓储层映射；不改动业务逻辑，仅统一结构与命名以消除冲突。