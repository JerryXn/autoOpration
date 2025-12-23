## 目标
- 在访问发布页时，自动获取完整的页面结构与行为：DOM树、UI布局、无障碍树、动态脚本与网络活动。
- 基于采集数据自动生成稳定的选择器与备用选择器，并在失败时自动重分析与回退。
- 提供可视化面板展示错误与树结构，支持一键复制选择器与回放验证，无需你手动检查。

## 采集层（CDP）
- 启用模块：DOM、DOMSnapshot、Accessibility、Runtime、Log、Network、PerformanceTimeline。
- 基础快照：
  - DOM.getDocument（保留到节点属性：tag/id/class/aria/role/placeholder/name/text）
  - DOMSnapshot.captureSnapshot（computedStyles+布局边界+styleIndex）
  - Accessibility.getFullAXTree（辅助识别表单控件与按钮语义）
- 行为采集：
  - Log.enable/Runtime.enable 捕获页面 console/异常
  - Network.enable 记录脚本/接口加载（识别动态渲染来源）
  - PerformanceTimeline.enable 记录长任务与布局抖动

## 注入观察器（页面内）
- MutationObserver：
  - 采集新增/删除/属性变化/文本变化，生成“DOM差异序列”（含时间戳与节点路径）
- 事件监听钩子：
  - 包装 EventTarget.prototype.addEventListener，记录被监听的事件类型与目标选择器路径
- 选择器辅助：
  - 提取语义文本邻近（中文文案“标题/正文/上传/发布/标签/内容类型声明”等）
  - 标注表单控件的 label-for、aria-labelledby 关系

## 选择器生成与评分
- 候选生成：CSS/XPath/相对选择器（父子/兄弟）三类，并附 nodeId 与 boundingBox。
- 评分维度：
  - 语义匹配（文本/placeholder/aria/name/id/class关键词）
  - 唯一性与稳定性（快照中唯一/Mutation频率低）
  - 位置权重（主发布容器内，靠近目标标签）
  - 可交互性（可聚焦/可点击/绑定事件）
- 输出：每目标位点（标题、正文、标签输入与候选、上传控件、发布按钮、内容类型声明下拉）生成 1 主 + 3 备选择器。

## 回放与验证
- 行为模拟：Input.dispatchMouseEvent/dispatchKeyEvent/insertText，滚动与悬停，随机延迟。
- 验证流程：
  - 使用主选择器执行；失败自动切换备用选择器→若仍失败触发“重分析”（基于最新 Mutation/AX树）
  - 每步产出“命中证据”（截图+所用选择器+节点边界）

## 可视化与日志
- 前端错误面板：展示错误摘要、console日志、选择器命中、截图链接；支持“打开控制台”。
- 树查看器：在面板中支持：
  - 搜索节点（支持中文文案/placeholder/aria/role）
  - 展示节点路径与候选选择器，复制按钮
  - 查看最近 Mutation 差异与受影响节点
- 存储：`userData/inspect/<timestamp>/<platform-type>/` 包含
  - `dom.json`、`snapshot.json`、`ax.json`、`mutations.json`、`events.json`、`network.json`、`console.log`、`evidence.png`

## 集成点
- 与“立即发布/任务发布”协调器集成：发布前采集→填充→失败时重分析→回退选择器；成功后写库。
- 内容类型声明：在采集中定位下拉/选项文案（“笔记含AI生成内容”），选择器与动作纳入目标位点。

## 安全与性能
- 仅在用户已登录窗口运行；不采集敏感字段值；日志脱敏。
- 快照体积控制：分层采集（首次全量，后续按变更）；日志按大小轮转。

## 交付与验证
- 第1阶段：在小红书图文/视频页落地采集与自动选择器生成；面板显示错误与树结构；回放验证通过。
- 第2阶段：扩展到其他平台与类型；完善选择器词典与语义模型。

## 需要你确认
- 是否默认启用采集与回放面板（进入发布页时自动采集）。
- 树数据存储的保留周期与大小上限（例如 7 天/500MB）。