## 目标能力

* 持续监听站点聊天框消息，构建“自动谈单”代理：理解上下文、识别用户意图、生成回复、执行页面动作（输入、发送、上传等）。

* 接入远程多模态大模型（含视觉），结合页面截图与 DOM 文本，进行可靠决策与回复拟合。

* 保障风控与合规：人类化操作、速率限制、敏感动作审批、可审计与可回放。

## 总体架构

* Chat Listener（已集成）

  * 在子进程注入 `MutationObserver`，将新消息以事件 `CHAT_MESSAGE` 推送到主控 WebSocket。

* Agent Service（新增）

  * 订阅聊天事件流，维护会话状态机，调用远程 LLM（视觉），下发“行动计划”。

  * 模式：`assist`（需要人工确认）与 `auto`（自动执行，带风控）。

* Action Executor（运行时扩展）

  * 在 Worker Runtime 中实现工具方法：`sendMessage(text)`、`attachFile(path)`、`click(selector)`、`type(selector, text)`、`wait(selector)` 等。

  * 通过 IPC 接收 Agent 的“结构化行动”JSON，并执行对应 Playwright 操作。

* Memory & Store

  * 会话记忆、用户画像、报价策略、上下文摘要；持久化到 `data/runs.sqlite` 或 JSON。

* Policy & Safety

  * 谈单策略与回复模板（语气、禁用语、价格/优惠边界）、速率限制与异常回退、人机审核与黑名单。

## 数据流（事件 → 决策 → 执行）

1. Worker 监听聊天框，广播 `CHAT_MESSAGE {text, html, ts}`。
2. Agent Service 聚合上下文（最近 N 条、页面截图、DOM 选摘）。
3. LLM 输入：

   * System 指令：角色与目标、价格边界、风控要求、输出 JSON 格式。

   * User：最新消息文本 + DOM 结构化提取。

   * Vision：聊天容器或整页截图（裁剪为主，降低噪声）。
4. LLM 输出：结构化行动计划 JSON（例如 `{ "actions": [{"type":"SEND_MESSAGE","text":"..."},{"type":"WAIT","selector":"..."}] }`）。
5. 审批与风控：`assist` 下人工确认；`auto` 下校验边界与限流；必要时改写/拒绝。
6. Worker 执行行动：输入、发送、点击、等待、上传；回传结果与新事件。
7. Agent 更新会话记忆与指标；持续循环。

## LLM 接入与提示工程

* 远程模型：可选 OpenAI（GPT-4o/4.1）/ 阿里通义 / 百度文心 / 本地多模态推理服务（统一 HTTP 接口）。

* 输入组成：

  * 文本：消息与上下文摘要（避免冗长）

  * 视觉：元素截图（`page.locator(chatSelector).screenshot()`）或整页截图（限制频率）

  * 站点结构：关键 DOM 提取（消息列表、输入框、发送按钮、价格区块）

* System 指令模板：

  * 角色：专业销售代理

  * 目标：完成交易/预约/报价，遵守边界

  * 风控：避免过度承诺、尊重隐私、合规条款

  * 输出：严格 JSON（`actions[]`，含 `type`/`params`）

* 策略模块：

  * 价格与优惠边界、常见拒绝/回绝话术、跟进节奏（间隔与轮次）

## Worker 执行工具（新增接口）

* `SEND_MESSAGE(text)`：定位输入框（`chatInputSelector`），模拟打字与 Enter（输入节奏与随机停顿）。

* `CLICK(selector)`、`TYPE(selector, text)`、`WAIT(selector)`、`SCROLL(selector, to)`、`UPLOAD(selector, filePath)`。

* 返回执行结果与错误，便于 Agent 调整策略。

## 风控与反机器人

* 人类化：随机打字、停顿、滚动、鼠标移动轨迹；避免突刺并发与超频。

* 指纹与代理：延续现有 UA/Headers/Locale/Timezone/代理池，谈单过程中保持画像一致。

* 审批：涉及支付、隐私、绑定账号、提交表单等敏感动作需人工确认。

* 速率限制与退避：LLM调用与页面行动设置额度与冷却；错误时切换代理/指纹（限次）。

## 接口设计（示例）

* REST（Agent Service）：

  * `POST /agent/sessions` 创建会话（绑定脚本实例、模式与策略）

  * `POST /agent/sessions/:id/policy` 更新边界与模板

  * `POST /agent/sessions/:id/mode` 切换 `assist/auto`

* IPC/WS（Worker ↔ Agent）：

  * `CHAT_MESSAGE` → Agent

  * `AGENT_ACTIONS {actions: [...]}` → Worker

  * `ACTION_RESULT` → Agent → WebSocket 广播

## 存储与审计

* 会话记录：消息、截图摘要、行动与结果、耗时与错误。

* 指标：响应时延、成交率、拒绝率、成本（LLM 调用额）、触发风控次数。

* 回放：基于事件流与截图，协助复盘与优化策略。

## 测试与评估

* 仿真数据集：构造常见询盘与拒绝案例；不同站点结构模拟。

* 离线评估：对比多策略提示、不同模型、不同视觉输入的质量与成本。

* 在线灰度：仅 `assist` 模式先行，逐步开放 `auto`。

## 里程碑

1. 新增 Agent Service（订阅 WS、调用 LLM、输出 JSON 行动计划）。
2. 扩展 Worker 工具层（发送消息/点击/等待/上传），约束为可中断且人类化。
3. 提示与策略模板（谈单规则、价格边界、禁用语），可配置。
4. 视觉接入与截图裁剪（降低噪声与成本）。
5. 审批与安全控制（敏感动作拦截、日志与审计）。
6. 指标监控与回放界面（心跳/事件/截图摘要）。
7. 仿真评估与灰度发布（先 `assist`，再 `auto`）。

## 配置建议

* 环境变量：`LLM_API_URL`、`LLM_API_KEY`、`LLM_MODEL`、`AGENT_MODE`、`RATE_LIMITS`。

* 站点适配：`chatSelector`、`chatInputSelector`、`sendButtonSelector`、文件上传选择器与限制。

## 成功标准

* 连续 N 轮消息的稳健理解与回应（延迟与质量可控）。

* 无显著风控触发（或能自动回退），可复用登录态与指纹。

* 明确审计与回放能力，支持快速迭代策略。

