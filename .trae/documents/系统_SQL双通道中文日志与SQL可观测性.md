## 调整目标
- 日志分为“系统”和“SQL”两类，结构化中文，精确说明“当前步骤在做什么、发送的入参、返回的出参、入库结果”。
- 去除无意义日志，仅保留关键阶段与动作日志。
- 增加 SQL 级别日志：连接、事务、执行语句、影响行数、错误。

## 输出规范
- 字段：
  - 类型：系统/SQL/接口/浏览器/数据库/错误
  - 阶段：启动/认证/搜索/分页/详情/评论/AI调用/回复/入库
  - 动作：开始/请求/响应/筛选/点击/提交/连接/事务开始/事务提交/执行SQL/入库开始/入库成功/入库失败
  - 说明：中文一句话说明当前操作意图
  - 入参：关键入参（Authorization 脱敏，payload/text 截断）
  - 返回：关键返回（HTTP 状态、文本头、JSON 关键字段）
  - 标识：note_id/comment_id/keyword/page/cursor/reply_id 等
  - 状态：ok/info/error（用于主进程着色）

## 代码改造
- storage/mysql_client.py：
  - 在 connect/begin/commit/rollback/exec/exec_many 打印 SQL 日志：语句、参数、影响行数、错误；状态统一为 ok/error。
- storage/xhs_repo_mysql.py：
  - 在 store_comment_reply/store_comment_reply_response 前后打印“数据库/入库开始/入库成功/入库失败”中文日志；携带 note_id/comment_id/reply_id。
- invoke/remote_invoke.py：
  - 将接口请求与响应日志转为中文字段：类型=接口，阶段=AI调用，动作=请求/响应；保留 status 以供主进程着色。
  - 去除重复、无信息量的日志，仅保留关键点：ai_invoke_request/post/ids/answer。
- invoke/comment_pipeline.py：
  - 评论筛选、回复、入库阶段打印“系统/数据库”中文日志，详述“当前动作”“入参摘要”“返回摘要”。
- 主进程 src/main.js：
  - 行首标签显示“类型/阶段/动作 + 中文状态”，着色基于 status；对 类型=SQL 使用青色强化区分。

## 验证
- 运行后：观察系统/接口/SQL/数据库日志，能清晰看到：请求→响应→回复→SQL执行→入库成功；出现错误则有“入库失败 + 错误详情”。
- 数据库 auto_final：xhs_comment_replies/xhs_comment_reply_responses 出现新增记录，reply_id 与日志对应。

## 交付
- 修改上述文件，统一中文结构化日志规范，减少无意义输出，增加 SQL 可观测性。