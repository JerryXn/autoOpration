## 根因分析
- Python 侧只从进程环境读取 `COZE_TOKEN/COZE_BOT_ID`，且我们已停用内层 .env；外层 `.env` 未配置 `COZE_TOKEN` 导致 `token_missing`。同时没有清晰的入参/出参日志，难以定位问题。

## 方案总览
- 统一加载外层 `.env` 并在主进程对 Python 子进程透传；若外层缺少 `COZE_*`，临时从内层 `auto_opration_python/.env` 读取仅 `COZE_*` 键进行补齐（不改变长期策略，仅运行时兜底）。
- 在主进程启动前做“凭据健康检查”，着色输出变量存在与否与长度（不打印完整密钥）。
- 在 Python 的远程 AI 调用模块增加完整的入参/出参结构化日志，且对敏感字段做脱敏：
  - 入参：`api_url`、`bot_id`、`user_id`、`timeout_ms`、`content_head`（前100字符）、`headers`（`Authorization` 仅打印前缀与长度）
  - 出参：`status`、`text_head`（前200字符）、`json.keys`、`chat_id/conversation_id`、最终 `answer` 或错误码
- 对缺失场景给出明确错误：`token_missing_env`/`bot_id_missing_env`，并打印修复建议（设置外层 .env 并重启）。

## 具体改动
- 主进程 `src/main.js`：
  1. 顶部加载外层 `.env`：`require('dotenv').config()`，确保 `COZE_*` 进入 `process.env`
  2. 在 spawn 之前：
     - 构建 `envForChild`，若 `COZE_TOKEN/COZE_BOT_ID` 在外层缺失则读取 `auto_opration_python/.env` 的同名键补齐
     - 着色输出凭据摘要：变量是否存在、长度、是否看起来像 Bearer Token
     - 如最终仍缺失，提前 `console.error('token_missing_env')` 并返回 `{ ok:false }`
- Python `src/invoke/remote_invoke.py`：
  1. `_agent_config()`：不再加载内层 .env；从 `os.getenv` 读取，若 `token`/`bot_id` 缺失，返回明确错误，并打印 `token_missing_env` 或 `bot_id_missing_env`
  2. `_post_json()` 前后打印：
     - 请求日志：URL、脱敏后的 `Authorization`、payload 头部
     - 响应日志：status、text 头部、JSON keys
  3. `invoke_ai()`：补充结构化日志：`ai_invoke_request`、`ai_invoke_post`、`ai_invoke_ids`、`ai_invoke_answer`；错误时打印 `ai_invoke_timeout` 或具体 http 错误

## 日志示例（主进程彩色）
- green: `[cred] COZE_TOKEN present len=40`
- yellow: `[cred] COZE_BOT_ID present len=19`
- red: `[cred] token_missing_env`（阻止启动并提示修复）

## 验证
- 在外层 `.env` 设置 `COZE_TOKEN/COZE_BOT_ID` 后启动；观察：
  - 主进程凭据摘要通过（非红色）
  - Python 日志出现 `ai_invoke_request` → `ai_invoke_post status=200` → `ai_invoke_ids` → `ai_invoke_answer`
- 若仍失败：查看结构化出入参日志定位问题（URL/headers/payload/响应status与文本头）。

## 补充
- 长期建议：把 `COZE_*` 全部迁移到外层 `.env`，并删除内层 `.env`；本次运行时兜底不会更改文件，仅确保当前流程可运行与可观测。

请确认，我将按上述方案落地代码改动并进行一次验证运行。