## 目标
- 引入 RBAC（基于角色的访问控制），定义用户、角色（lv1/lv2/lv3/admin）、权限与策略；
- 登录后加载当前用户的角色与权限，在界面常显按钮但按权限禁用；
- 主进程与后端在执行时再次校验，确保脚本不越权。

## SQL 设计与数据
- 表结构：
  1) users(id, username, password_hash, role_code, status, created_at)
  2) roles(code, name, description)
  3) role_permissions(role_code, can_browse, can_search, can_like, can_fav, can_comment)
  4) role_policies(role_code, action['browse'|'like'|'fav'|'comment'], probability INT, max_total INT, per_note_max INT)
- 初始化：
  - 角色：lv1/lv2/lv3/admin
  - 权限：lv1 仅 browse/search；lv2 +like/+fav；lv3 +comment；admin 全部
  - 策略示例：lv2(like=100/50, fav=100/30)、lv3(comment=100/20/perNoteMax=2)
- 密码使用安全哈希（bcrypt/argon2）存储。

## 主进程集成
- 登录成功后：查询 `users`→关联 `role_permissions/role_policies`→返回 `{ user:{name, role_code}, permissions, policies }`。
- `start-auto-op`：校验 payload 的动作不越权；越权拒绝；将 `policies` 序列化为 `XHS_ACTION_POLICIES_JSON` 与现有 `XHS_SEARCH_FILTERS_JSON` 一起传给 Python。

## 前端绑定（按钮常显、按权限禁用）
- 为按钮/开关标注 `data-action` 与 `data-permission`（现有已加 `data-permission`）。
- 渲染时根据 `permissions` 设置禁用态：置灰且不可点击，hover/tooltip 显示禁用原因；顶部显示当前角色徽章（lv1/lv2/lv3/admin）。
- 点击拦截：禁用态直接阻止，不发送 IPC。

## 后端 Python 绑定
- 控制器 `ActionController`：读取 `XHS_ACTION_POLICIES_JSON` 与权限；
  - 对无权限动作：概率=0 或 max_total=0；`should_*` 直接返回跳过（reason=no_permission）。
  - 现已接入评论；后续接入点赞/收藏的 `should_like/should_fav` 并绑定 Playwright 点击动作。
- 风控与限速沿用既有实现（failPauseThreshold、next_delay）。

## 端到端校验
- lv1：按钮常显但点赞/收藏/评论禁用；payload 若包含越权动作被主进程拒绝；Python 控制器也跳过。
- lv2：点赞/收藏可用；评论禁用与越权拒绝；
- lv3：全部可用，评论受策略（概率/最大总数/每笔记）。
- admin：全部可用，策略可调整。

## 交付步骤
1) 添加 SQL 迁移与种子数据；
2) 主进程：登录查询并返回 `permissions/policies`；执行校验与透传策略；
3) 前端：根据 `permissions` 应用禁用与提示；
4) Python：控制器读取权限与策略，统一约束；
5) 测试：
   - 单元：权限矩阵、策略判定；
   - 集成：lv1/lv2/lv3/admin 登录→按钮禁用/可用→主进程拒绝/允许→后端执行/跳过链路。

## 安全与兼容
- 不修改现有功能路径，仅增加权限检查；
- 所有新增配置支持默认安全（无权限则禁用）。

确认后我将按以上步骤逐项落地实现，确保不破坏既有功能。