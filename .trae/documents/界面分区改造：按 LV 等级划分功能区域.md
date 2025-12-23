## 目标
- 在“自动运营”操作界面中，按权限等级划分为三个功能区域：lv1、lv2、lv3。
- 将对应等级的功能列表和控件，移入到各自的区域中，所有功能常显；不同组登录后仍按权限自动禁用并提示。
- 保持现有执行逻辑不变（start/stop、筛选、限速），仅调整界面布局和绑定。

## 分区与内容
- lv1 功能区域（浏览/搜索/详情抓取）
  - 浏览开关（browse）
  - 搜索筛选：类型、排序、发布时间、搜索范围、位置距离、关键词
  - 采集开关（captureEnabled）和记录开关（record）
  - 详情页行为说明（保持现有自动打开与抓取逻辑）
  - 速率设置（每次数量/每分钟/每小时/随机延迟）
- lv2 功能区域（互动：点赞/收藏）
  - 点赞开关（like）
  - 收藏开关（fav）
  - 可选：二级说明（上限/策略在后端统一）
- lv3 功能区域（评论/回复）
  - 评论开关（comment）
  - 策略入口（概率、最大操作数、每笔记最大评论数；仍由后端策略控制，前端仅展示说明或简要输入框）

## 界面改造（HTML）
- 在 `#autoop-card` 内，创建三个分区容器：`#lv1-functions`、`#lv2-functions`、`#lv3-functions`
- 将现有控件重新分组到分区中：
  - lv1：browse、筛选表单、capture/record、limits（count/perMin/perHour/delayRange）
  - lv2：like、fav（并继续保留 data-permission 标识）
  - lv3：comment（并保留 data-permission 标识）
- 每个分区添加区块标题与说明，并为按钮/输入添加 `data-permission`：
  - `auto_view`→`data-permission="canBrowse"`
  - `auto_like`→`data-permission="canLike"`
  - `auto_favorite`→`data-permission="canFav"`
  - `auto_comment`→`data-permission="canComment"`
- 保留顶部执行按钮（start/stop），不纳入某一分区，避免误解为只能对某一区执行。

## 行为绑定（JS）
- 在 `views/autoop.js`：
  - 新增分区引用并在 `mount` 时渲染应用。
  - `applyPermissions()` 遍历 `data-permission` 元素，按 `state.user.group` 或 `localStorage.userGroup` 计算布尔权限后置灰禁用，并设置 `title` 提示。
  - 保持 `payload` 结构不变：`actions: { browse, like, fav, comment, record }`；`filters` 按现有方式构造；`limits` 保留。

## RBAC 兼容
- 常显分区和控件；不同组登录后禁用对应区内的控件（例如 lv2 用户在 lv3 区看到评论开关但置灰不可点）。
- 主进程执行校验与后端策略控制（已接入），越权仍会被拒绝或跳过，界面调整不改变执行路径。

## 视觉与文案
- 在每个分区标题右侧显示徽章（如“仅浏览/搜索/详情抓取”、“可点赞与收藏”、“可评论与回复”）。
- Hover 或禁用提示文本：当前组别不可用该操作。

## 验证
- 登录不同用户组（lv1/lv2/lv3/admin）渲染：
  - 所有分区与按钮常显；禁用状态和提示正确；
  - 执行时主进程与后端仍拒绝越权动作。

## 说明（终端报错）
- 终端的 `[migrate] Unknown column 'platform_code'` 来自早期迁移脚本的字段引用；界面改造与此无关。后续我将隔离和修正迁移脚本以不再执行错误 SQL（移除 platform_code 引用），但本次仅进行界面分区改造。

## 交付项
- 更新 `src/index.html`：新增 `#lv1-functions/#lv2-functions/#lv3-functions` 分区容器并移动控件。
- 更新 `src/views/autoop.js`：应用分区渲染与权限禁用。
- 保持现有 IPC 与后端逻辑不变。