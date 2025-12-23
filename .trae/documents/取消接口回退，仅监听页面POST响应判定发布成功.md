## 问题与要求
- 目前在页面发布失败时做了接口回退（post_comment_in_page），这是你不希望的。
- 需要仅通过“当前页面的 POST 请求响应”来判断是否成功，并据此入库（含响应原文）。

## 改动范围
- 文件：
  - auto_opration_python/src/automation/core/operator.py（回复逻辑）
  - auto_opration_python/src/invoke/comment_pipeline.py（成功判定与入库）

## 实施方案
1. 去除接口回退
- 删除 reply_to_comment 中的 post_comment_in_page 回退调用。
- 不再构造任何额外的 fetch；仅依赖页面自身的网络请求。

2. 强化响应监听
- 在点击“发送”后使用 page.wait_for_response 监听 URL 含 "/api/sns/web/v1/comment/post" 的请求。
- 成功判定：
  - HTTP 200 且 JSON 解析成功，并且 JSON.code==0 或 JSON.success==true。
  - 返回结构统一：{"status":200,"json":<respJson>,"text":""}；失败则{"status":<httpStatus>,"json":<respJson或null>,"text":<错误描述>}。
- 若短时未捕获（页面异步延迟），增加有限重试（例如 2 次，每次 1 秒），仍失败则返回失败并携带 "publish_unknown_status"。

3. 入库逻辑调整
- comment_pipeline 仅依据上一步的返回：
  - 成功：status=200 且 (json.code==0 或 json.success==true)。
  - 失败：其余情况，error_text 写入 text_head；http_status 写入响应码；
  - 无论成败，若 json 为字典则写入 op_comment_reply_responses。

4. 日志
- 只保留“publish_resp”与最终成功/失败日志；取消“publish_error”后的接口回退日志。

5. 验证
- 手动触发 1 次回复：
  - 终端显示 publish_resp 后入库。
  - SQL 验证：
    - SELECT id,status,error_text,http_status FROM op_comment_replies ORDER BY id DESC LIMIT 3;
    - SELECT reply_id, JSON_EXTRACT(resp_json,'$.code') AS code FROM op_comment_reply_responses ORDER BY id DESC LIMIT 3;

## 交付
- 代码变更上述两处；删除回退；确保仅页面响应决定成功；入库响应原文；完成本地验证并输出查询结果。