## 目标
- 在“自动运营”页面中直观呈现 lv1/lv2/lv3 三个功能区域，所有按钮常显；根据当前用户组置灰禁用并提示原因。
- 交互与后端保持一致：越权操作前端拦截、主进程拒绝、后端策略跳过。

## 页面结构
- 在 `#autoop-card` 内新增三个区块：
  - lv1 区：浏览/搜索/详情抓取
  - lv2 区：点赞/收藏（含各自开关与数量/速率提示）
  - lv3 区：评论/回复（含概率、最大操作数、每笔记最大评论数入口）
- 每个区块添加组徽章与说明（例如“当前组：lv2，只能使用点赞与收藏”）。

## HTML 修改
- 为每个功能按钮/开关添加 `data-permission` 属性：
  - 示例：点赞按钮 `data-permission="canLike"`，收藏 `data-permission="canFav"`，评论/回复 `data-permission="canComment"`
- 三个分区使用卡片或折叠面板：`<section id="lv1-area">...`，`<section id="lv2-area">...`，`<section id="lv3-area">...`。
- 添加禁用样式类：`.disabled { opacity: .5; pointer-events: none; }`；并在元素上添加禁用提示（`title` 或旁边的提示标签）。

## JS 渲染（views/autoop.js）
- 登录后将用户组与权限载入 `state.user.group` 与 `state.permissions`。
- 初始化界面：
  - 设置当前组徽章（在顶部显示 `lvX` 与说明）。
  - 遍历页面元素，按 `data-permission` 结合 `state.permissions` 进行 `disabled` 与 `.disabled` 样式应用：
    - 未授权：置灰、不可点击，并设置 `title="当前组别不可用该操作"`。
    - 授权：正常可用。
- 点击行为拦截：若元素带 `.disabled`，直接阻止默认并弹出提示，不发送 IPC。

## 主进程校验
- 在 `start-auto-op` 收到 payload 时，根据 `state.user.group` 与 `state.permissions`：
  - 越权动作立即拒绝并返回错误消息（冗余校验，防御性）。
  - 同时将权限映射到 `XHS_ACTION_POLICIES_JSON`（无权限的动作概率=0 或 maxTotal=0）。

## 后端策略一致性
- 控制器在 Python 侧读取策略：
  - lv1：`canLike/canFav/canComment` 为 false → 概率 0 → `should_*` 返回跳过。
  - lv2：允许点赞/收藏；评论概率 0。
  - lv3：允许全部；评论受限额与每笔记最大值。

## 文案与提示
- 每个区域顶部添加一句话说明本组的允许范围。
- 禁用状态 hover 时弹出提示（当前组别不可用该操作）。

## 验证
- 使用 lv1/lv2/lv3/admin 账号登录：
  - 前端：区域与按钮常显，禁用状态正确；提示文案正确。
  - 主进程：越权 payload 被拒绝。
  - 后端：策略使越权动作跳过并记录“no_permission/probability_skip”。

## 兼容注意
- 不改动现有功能按钮的 ID 与事件绑定；仅通过 `data-permission` 和样式/disabled 属性控制。
- 保持搜索、详情抓取、评论流水既有逻辑不变；仅增加权限判定。