## 目标
- 改为“你主动参与”的手动/脚本双模式：你逐步指定选择器与动作，框架稳定执行并输出每步结构化日志。
- 对列表/详情/评论等动作进行迭代查找与回退，确保在页面结构变化时仍可执行。

## 交付内容
- 手动模式：选择器工作台（匹配数、高亮、边框叠加）与步骤面板（Next/Retry/Stop）。
- 脚本模式（AutoJS DSL）：你编写步骤脚本，执行器按 FIFO 队列执行，支持重试与回退。
- 逐步日志：每一步包含页面地址、阶段、动作、选择器、匹配数、结果/错误、耗时与可选截图。

## 日志结构
- 字段：`ts, runId, url, stage, action, selector, matchCount, result, error, elapsedMs, shot`
- 统一前缀：`[autoop-step]`（终端 + 前端日志面板）
- 封装：`logStep(stage, action, payload)` 与 `withStep(stage, action, selector, fn)`（自动计时/错误捕获）

## AutoJS DSL
- 结构：
  - `meta`: `{ platform, keywords[], limits }`
  - `steps`: `[{ action, selector?, index?, text?, count?, container?, waitFor?, timeout? }]`
- 动作库：`waitVisible, click, clickNth, type, press, scrollContainer, imageNext, expandText, openDetail, openNext, commentSend, eval, screenshot, assertChanged`
- 示例片段：
  - `waitVisible('input[placeholder*="搜索"]') → type(...,'hahah') → press('Enter') → clickNth('a[href*="/explore/"]',0) → scrollContainer('auto',{down:6,up:2}) → imageNext({count:3}) → screenshot('detail_after') → assertChanged('detail_before','detail_after') → openNext()`

## 选择器工作台
- 输入 CSS/XPath；显示匹配数量与所有目标的边框高亮。
- 采集 UI 树快照（tag/role/class/id/text截断/visible/bounds/aria/data-*）供你挑选更稳的选择器。
- 提供稳健选择器建议（属性组合、文本模糊、nth-of-type）。

## 执行器与容器识别
- 队列（FIFO）：列表→详情→评论/交互→返回列表→下一条。
- 容器识别优先序：`div[role='dialog']`、overlay/modal/dialog、`.note-detail/.detail-container`、`article[role='article']`；回退为第一个可滚动容器。
- 详情交互：在目标容器上滚动与翻页；评论输入/发送后等待列表新增项（MutationObserver/条目计数变化）。

## 异常与回退
- 通用封装：`safeLoad(url, timeout)`、`safeRunInPage(fn, timeout)`；指数退避与最大重试次数。
- 选择器迭代链：首选 → 文本模糊 → role/aria/type → 容器内相对位置 → 几何启发 → 坐标点击（微抖动）。
- 特例：404/受限 → 标记 restricted 写库并返回列表；窗口/渲染异常 → 单次重建窗口恢复列表。

## 截图校验
- 前后截图（窗口与容器局部）；像素差比例或简化 SSIM 阈值（如 >2% 判有效）。
- 不一致则进入回退路径（备用按钮、按键或坐标点击），并记录截图与差异指标。

## 验证流程
- 以你给定关键字与勾选动作（浏览/评论）执行：
  - 实时观察每步日志（含选择器与匹配数）。
  - 确认详情滚动与翻页在浮窗容器内执行；评论成功后条目增长。
  - 返回列表并打开下一条，直至达到数量或停止。

## 下一步
- 我将按此方案实现手动/脚本模式、日志封装与迭代执行器，并与你一起逐步填充选择器与脚本，边跑边调。