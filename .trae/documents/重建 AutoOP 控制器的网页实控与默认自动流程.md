## 核心目标
- 让浮窗“AutoOP 控制器”在任意站点上，直接驱动 Playwright 的鼠标、键盘与页面脚本，实现真正的网页实控。
- 采用“默认自动流程”，用户只需控制关键节点（开始、暂停、重试、跳过、改关键词），所有动作与选择器由系统默认决定并自动推进。
- 持久化登录状态、抗自动化检测、人类化输入与点击链路，避免因检测而失败。
- 在失败时给出明确诊断（阶段、动作、原因、候选与匹配数、URL），并支持一键覆盖选择器后重试。
- 在详情页仅打印结构化内容（不点开媒体，直接输出图片/视频 URL）。

## 当前问题
- 控制器按钮无法驱动真实页面动作，表现为“下一步”无效或流程不推进。
- 选择器依赖手动输入；当默认选择器失效时缺少兜底与自动候选选择。
- SPA 导航后，浮窗与原生绑定可能丢失，导致注入或命令桥接失效。

## 现有基础（已在仓库中）
- 浮窗与命令桥接：页面注入浮窗并绑定 `window.autoopNative(...)` → Playwright `exposeBinding`（src/playwright/index.js:42-71）；导航后自动重注入（73-75）。
- 执行器（Runner）：实现原子动作 `query_selector/move_to/hover/click/text_input/program_click/program_back/detect_restricted/query_selector_next/extract_note`（src/playwright/runner.js:20-117），含忙锁与自动推进（137、146-151）。
- 默认选择器集中：`DEFAULT_SELECTORS`（src/autoop/selectors.js:4-45），按阶段候选。
- 阶段动作队列：`buildQueue(stage)`（src/autoop/steps.js:4-49），映射“搜索→列表→详情→回退→下一个”。
- 浮窗按钮与日志/诊断面板（src/playwright/overlay.js:16-34、20-24、27-34）。

## 目标行为（默认自动流程）
- 控制节点：开始/暂停/继续/重试阶段/跳过阶段/下一步/运行搜索/应用选择器。
- 流程阶段：
  - 搜索聚焦 → 输入关键词 → 提交搜索 → 进入列表第一项 → 详情页提取 → 受限则回退 → 选择下一未访问项 → 循环。
- 用户交互最小化：仅在默认选择器全失效时提示失败并允许覆盖。

## 选择器策略（默认优先 + 自动诊断）
- 默认优先：若用户未覆盖，优先尝试 `DEFAULT_SELECTORS[stage]` 的第一个；若匹配为 0，则逐项尝试并选择首个可见命中（runner `query_selector`）。
- 校验与高亮：`validateSelector` 空输入时自动遍历默认集合，填充并高亮（index.js:47-63；overlay “检测选择器”）。
- 列表循环：记录已访问 ID，`open_next_item` 仅选择未访问项（runner.js:88-103）。

## 抗检测与人类化
- UA 与 Accept-Language 设置、禁用 AutomationControlled（index.js:21、26、31）。
- 鼠标链路：`move_to/hover/mouse_down/mouse_up/click`，控制点击节奏（steps.js:5-12、17-23、24-30）。
- 键盘输入：逐字符打字（runner.js:55-59），搜索提交失败时回退为 `Enter`（50-54）。

## 失败诊断与恢复
- 统一 `reportFail` 输出阶段、动作、原因、选择器、默认候选、尝试列表、匹配数、URL，并在浮窗显示（runner.js:157-161）。
- 一键“重试阶段”：重新构建当前阶段队列并从头执行（runner.js:149）。
- “跳过阶段”：直接推进到下一阶段（runner.js:150）。

## 数据输出（详情页）
- 提取对象：`{ id, url, title, author, text, images[], videos[] }`（runner.js:103-117），图片/视频只输出 URL。
- 在控制台与浮窗日志打印 `[NOTE]` 和数据对象。

## 端到端验证方案
- 启动持久化会话并打开目标站点，浮窗出现：`node src/playwright/open.js`（已读取 overlay 注入与持久化目录）。
- 浮窗点击“开始流程”：观察日志阶段推进与鼠标键盘动作；若 `search_click` 无目标，确认已发送 Enter 并进入列表。
- 打印详情页 `[NOTE]` 对象；若受限页则“回退→下一个”循环。
- 试用“检测选择器/应用选择器/重试阶段/跳过阶段/下一步”等控件，确认实控有效。

## 需要落实的修复点
1. 强化命令桥接健壮性：`exposeBinding` 错误捕获与重新绑定、确保浮窗存在时绑定可用（index.js）。
2. 扩充默认选择器：针对 `search_input/search_click/browse_list` 增加更具体候选（如占位文案变体）。
3. 可见性与滚动：`query_selector` 命中后统一 `scrollIntoView`，并以中心坐标驱动鼠标移动与点击（已实现，必要时扩大阈值）。
4. 列表项识别：提升 `open_next_item` 正则与候选集合，减少误判。
5. 失败回退：搜索提交失败时统一回退为 `Enter`，并在浮窗日志提示此分支。

## 交付标准
- 浮窗每个按钮都能触发 Playwright 实控动作，观察到页面响应。
- 默认流程在目标站点可从关键词到详情页提取并打印 `[NOTE]`。
- 当默认选择器失效时，浮窗明确失败原因与候选、匹配数，并支持覆盖后“重试阶段”成功。
- 多次导航后浮窗仍在、命令仍生效（重注入验证）。

请确认以上目标与实现思路；我将据此完成针对性修复与增强，并进行端到端验证。