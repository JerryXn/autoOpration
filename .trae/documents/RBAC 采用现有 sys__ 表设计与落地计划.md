**答案与调整**

* 不需要 `feature_actions`（也不强依赖 `sys_feature_actions`）。我们可以直接用角色-平台-动作三元表来表达授权，动作用约定的代码字符串即可（如 `auto_view/auto_like/auto_favorite/auto_comment`）。

**最简 RBAC 设计（不引入动作注册表）**

* 新增三表：

```sql
CREATE TABLE IF NOT EXISTS sys_roles (
  code VARCHAR(16) PRIMARY KEY,
  name VARCHAR(64) NOT NULL
);

CREATE TABLE IF NOT EXISTS sys_user_roles (
  user_id BIGINT NOT NULL,
  role_code VARCHAR(16) NOT NULL,
  PRIMARY KEY (user_id, role_code)
);

CREATE TABLE IF NOT EXISTS sys_role_action_grants (
  role_code VARCHAR(16) NOT NULL,
  platform_code VARCHAR(32) NOT NULL,
  action_code VARCHAR(64) NOT NULL,
  PRIMARY KEY (role_code, platform_code, action_code)
);
```

* 约定动作代码（无需建表）：

  * `auto_view`（浏览/搜索/详情）

  * `auto_like`（点赞）

  * `auto_favorite`（收藏）

  * `auto_comment`（评论/回复，或后续区分 `auto_reply`）

**初始化角色与授权**

* 角色：

```sql
INSERT INTO sys_roles(code,name) VALUES
('lv1','基础'),('lv2','进阶'),('lv3','高级'),('admin','管理员')
ON DUPLICATE KEY UPDATE name=VALUES(name);
```

* 授权（以 xhs 为例）：

```sql
-- lv1：仅浏览
INSERT INTO sys_role_action_grants(role_code, platform_code, action_code) VALUES
('lv1','xhs','auto_view')
ON DUPLICATE KEY UPDATE action_code=VALUES(action_code);

-- lv2：浏览+点赞+收藏
INSERT INTO sys_role_action_grants(role_code, platform_code, action_code) VALUES
('lv2','xhs','auto_view'),('lv2','xhs','auto_like'),('lv2','xhs','auto_favorite')
ON DUPLICATE KEY UPDATE action_code=VALUES(action_code);

-- lv3：浏览+点赞+收藏+评论
INSERT INTO sys_role_action_grants(role_code, platform_code, action_code) VALUES
('lv3','xhs','auto_view'),('lv3','xhs','auto_like'),('lv3','xhs','auto_favorite'),('lv3','xhs','auto_comment')
ON DUPLICATE KEY UPDATE action_code=VALUES(action_code);

-- admin：当前动作全量（不依赖任何注册表）
INSERT INTO sys_role_action_grants(role_code, platform_code, action_code) VALUES
('admin','xhs','auto_view'),('admin','xhs','auto_like'),('admin','xhs','auto_favorite'),('admin','xhs','auto_comment')
ON DUPLICATE KEY UPDATE action_code=VALUES(action_code);
```

* 用户绑定角色（使用你已有的 `sys_users`）：

```sql
INSERT INTO sys_user_roles(user_id, role_code)
SELECT id, 'lv1' FROM sys_users WHERE username='alice'
ON DUPLICATE KEY UPDATE role_code=VALUES(role_code);
INSERT INTO sys_user_roles(user_id, role_code)
SELECT id, 'lv2' FROM sys_users WHERE username='bob'
ON DUPLICATE KEY UPDATE role_code=VALUES(role_code);
INSERT INTO sys_user_roles(user_id, role_code)
SELECT id, 'lv3' FROM sys_users WHERE username='carol'
ON DUPLICATE KEY UPDATE role_code=VALUES(role_code);
INSERT INTO sys_user_roles(user_id, role_code)
SELECT id, 'admin' FROM sys_users WHERE username='root'
ON DUPLICATE KEY UPDATE role_code=VALUES(role_code);
```

**按钮与执行绑定（RBAC）**

* 按钮常显，禁用逻辑不变；映射：

  * `canBrowse`↔`auto_view`，`canLike`↔`auto_like`，`canFav`↔`auto_favorite`，`canComment`↔`auto_comment`

* 主进程：登录后查询 `sys_user_roles`→合并 `sys_role_action_grants`（按平台 `xhs`）得到允许的动作集合；生成 `permissions` 布尔并返回前端；`start-auto-op` 校验越权（like/fav/comment），越权拒绝；把权限映射为 `XHS_ACTION_POLICIES_JSON`（无权概率=0）传 Python。

* 后端：控制器读取 `XHS_ACTION_POLICIES_JSON`，无权动作直接跳过并记录原因；不触发 Playwright 点击或输入。

**兼容性**

* 不再依赖 `feature_actions`/`sys_feature_actions`，避免 1146。

* 不写不存在的列（如 `description`），避免 1054。

**下一步**

* 我将替换迁移脚本为上述三表与初始化 SQL，并更新主进程查询从 `sys_role_action_grants` 计算权限，保持现有逻辑不变。

