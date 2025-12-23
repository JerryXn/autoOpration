**目标**

* 使用你现有的表族（sys\_users/sys\_user\_platforms/…），不新增自定义 users 表。

* 建立最简 RBAC 三表（角色、用户-角色、角色-动作授权），并对 admin(id=1) 和各级别用户完成绑定。

* 动作以字符串代码表达，不依赖 feature\_actions。

**建表（仅角色相关，最小字段）**

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

**动作代码约定（不建额外表）**

* `auto_view`（浏览/搜索/详情）

* `auto_like`（点赞）

* `auto_favorite`（收藏）

* `auto_comment`（评论/回复，后续可拆分 `auto_reply`）

**初始化角色**

```sql
INSERT INTO sys_roles(code,name) VALUES
('lv1','基础'),('lv2','进阶'),('lv3','高级'),('admin','管理员')
ON DUPLICATE KEY UPDATE name=VALUES(name);
```

**角色授权（以 xhs 为例，其他平台按需扩展）**

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

-- admin：当前动作全量（无需依赖注册表）
INSERT INTO sys_role_action_grants(role_code, platform_code, action_code) VALUES
('admin','xhs','auto_view'),('admin','xhs','auto_like'),('admin','xhs','auto_favorite'),('admin','xhs','auto_comment')
ON DUPLICATE KEY UPDATE action_code=VALUES(action_code);
```

**用户绑定（充分考虑 admin=1 与其他用户）**

* admin：优先按 id=1 绑定，若找不到则按用户名回退

```sql
-- admin(id=1) 绑定 admin 角色（存在则更新）
INSERT INTO sys_user_roles(user_id, role_code)
SELECT 1, 'admin'
WHERE EXISTS (SELECT 1 FROM sys_users WHERE id=1)
ON DUPLICATE KEY UPDATE role_code=VALUES(role_code);

-- 如不存在 id=1，但存在用户名 'admin'，也绑定
INSERT INTO sys_user_roles(user_id, role_code)
SELECT id, 'admin' FROM sys_users WHERE username='admin'
ON DUPLICATE KEY UPDATE role_code=VALUES(role_code);
```

* 其他示例用户（若已存在则绑定对应级别；不存在则忽略，不插入未知结构列）

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
```

**平台启用（可选，若你的权限链路需要 sys\_user\_platforms 控制可见性）**

```sql
-- 为 admin(id=1) 启用 xhs 平台（存在则保持）
INSERT INTO sys_user_platforms(user_id, platform_code, enabled)
SELECT 1, 'xhs', 1 WHERE EXISTS (SELECT 1 FROM sys_users WHERE id=1)
ON DUPLICATE KEY UPDATE enabled=VALUES(enabled);

-- 为其他示例用户启用 xhs
INSERT INTO sys_user_platforms(user_id, platform_code, enabled)
SELECT id, 'xhs', 1 FROM sys_users WHERE username IN ('alice','bob','carol')
ON DUPLICATE KEY UPDATE enabled=VALUES(enabled);
```

**说明**

* 全程仅使用现有的 `sys_*` 表族，不写不存在的列（避免 1054）。

* 不依赖 `feature_actions`/`sys_feature_actions`（避免 1146）。

* 动作授权以字符串代码表达，通过 `sys_role_action_grants` 管理；主进程按用户角色合并授权后，映射为前端禁用态和后端策略（无权概率=0）。

**下一步**

* 我将把上述 SQL 合并到迁移文件，并更新主进程登录与权限计算从 `sys_user_roles/sys_role_action_grants/sys_user_platforms` 生成 `{permissions}`，前端已按布尔禁用，后端已按策略跳过无权动作。

