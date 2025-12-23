## 方案

* 在 Python 的日志输出源头进行 URL 级过滤，忽略指定 `message_list` 请求的所有日志（请求/响应/汇总）。

* 可配置：支持通过外层 `.env` 设置忽略列表（逗号分隔），默认包含你要求的 URL。避免在主进程做二次过滤，减少日志噪音。

## 改动点

* `src/invoke/remote_invoke.py`

  * 在 `_post_json(url, ...)` 内，打印“接口/AI调用/请求/响应”日志前先判断 `url` 是否位于忽略列表：

    * 忽略列表来源：`os.getenv('LOG_IGNORE_URLS', '')` 拆分为数组；同时内置默认集合包含 `https://api.coze.cn/v1/conversation/message/list?conversation_id=7579562996880605220`

    * 若命中，直接跳过该次日志打印（请求/响应），不影响实际请求执行

  * 在 `get_message_list(...)` 内，打印 `ai_msg_list_response` 前也做同样判断，命中即跳过

* 过滤策略

  * 精确匹配完整 URL（含 query），不做模糊匹配，避免误伤其他正常日志

  * 支持多 URL：`.env` 中 `LOG_IGNORE_URLS=url1,url2,...`

## 验证

* 设置 `.env` 或使用默认忽略列表后，运行一次：

  * 控制台不再出现该 URL 的请求/响应日志与 `ai_msg_list_response` 行

  * 其他 Coze 日志不受影响；功能正常执行

## 说明

* 仅抑制日志，不影响接口调用和数据处理；不会影响数据库入库逻辑。

