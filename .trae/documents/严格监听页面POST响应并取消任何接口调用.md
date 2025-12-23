## 目标
- 完全取消任何“主动调用评论接口”的行为。
- 仅通过当前页面的网络响应来判断发送评论是否成功，并把响应原文入库。

## 问题根因
- 之前在捕获不到页面响应时会回退调用接口，或超时返回 `publish_unknown_status`。你现在要求彻底取消回退，只监听页面。

## 实施方案
1. 取消接口回退
- 删除所有回退调用路径（不再调用 `post_comment_in_page` 或其他 fetch）。现有“publish_error”只作为监听失败提示，不触发任何请求。

2. 加强页面响应监听（两层保障）
- 事件监听：在点击“发送”后，注册 `page.wait_for_response`，命中条件：`method==='POST'` 且 URL 包含 `/api/sns/web/v1/comment/post`。
- JS 轻量注入监听（仅监听不发送）：在页面里用 `fetch`/`XMLHttpRequest` 的包装对 `/comment/post` 进行响应捕获，缓存到 `window.__xhs_last_comment_post`，随后轮询读取并解析。
- 判定规则：
  - 成功：HTTP 200 且 JSON 可解析，并且 `json.code==0` 或 `json.success==true`
  - 失败：其余情况；写入 `http_status`、`error_text`（取响应文本或错误）。

3. 入库逻辑
- 仅依据上述监听到的响应判定；如果拿到 JSON，一律写档到 `op_comment_reply_responses`（无论成功/失败）。
- 不再出现“接口回退”的日志与数据。

4. 日志
- 保留 `publish_resp`（页面捕获），去掉任何“回退调用”日志；当监听超时，记录一次 `publish_error`（不触发请求），并返回失败。

5. 验证
- 运行一次“发送”，终端应出现 `publish_resp`；数据库：
  - `op_comment_replies.status='success'`、`error_text IS NULL`
  - `op_comment_reply_responses.resp_json.code=0` 或 `success=true`

## 交付
- 更新 `operator.py` 的回复流程（事件监听 + JS 注入监听）；
- 保持 `comment_pipeline.py` 的入库规则与响应写档；
- 本地验证并回报示例查询结果。