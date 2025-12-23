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
  action_code VARCHAR(64) NOT NULL,
  platform_id BIGINT NOT NULL,
  PRIMARY KEY (role_code, action_code, platform_id)
);

-- 兼容迁移：如已有旧列 platform_code，则转换为 platform_id 后删除旧列
ALTER TABLE sys_role_action_grants ADD COLUMN platform_id BIGINT NULL;
UPDATE sys_role_action_grants s SET s.platform_id = (SELECT p.id FROM platforms p WHERE p.code = s.platform_code) WHERE s.platform_id IS NULL;
ALTER TABLE sys_role_action_grants DROP PRIMARY KEY;
ALTER TABLE sys_role_action_grants DROP COLUMN platform_code;
ALTER TABLE sys_role_action_grants MODIFY COLUMN platform_id BIGINT NOT NULL;
ALTER TABLE sys_role_action_grants ADD PRIMARY KEY (role_code, action_code, platform_id);

INSERT INTO sys_roles(code,name) VALUES
('lv1','基础'),('lv2','进阶'),('lv3','高级'),('admin','管理员')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 授权（以 xhs 为例）
INSERT INTO sys_role_action_grants(role_code, action_code, platform_id)
SELECT 'lv1','auto_view', p.id FROM platforms p WHERE p.code='xhs'
ON DUPLICATE KEY UPDATE action_code=VALUES(action_code);

INSERT INTO sys_role_action_grants(role_code, action_code, platform_id)
SELECT 'lv2','auto_view', p.id FROM platforms p WHERE p.code='xhs'
ON DUPLICATE KEY UPDATE action_code=VALUES(action_code);
INSERT INTO sys_role_action_grants(role_code, action_code, platform_id)
SELECT 'lv2','auto_like', p.id FROM platforms p WHERE p.code='xhs'
ON DUPLICATE KEY UPDATE action_code=VALUES(action_code);
INSERT INTO sys_role_action_grants(role_code, action_code, platform_id)
SELECT 'lv2','auto_favorite', p.id FROM platforms p WHERE p.code='xhs'
ON DUPLICATE KEY UPDATE action_code=VALUES(action_code);

INSERT INTO sys_role_action_grants(role_code, action_code, platform_id)
SELECT 'lv3','auto_view', p.id FROM platforms p WHERE p.code='xhs'
ON DUPLICATE KEY UPDATE action_code=VALUES(action_code);
INSERT INTO sys_role_action_grants(role_code, action_code, platform_id)
SELECT 'lv3','auto_like', p.id FROM platforms p WHERE p.code='xhs'
ON DUPLICATE KEY UPDATE action_code=VALUES(action_code);
INSERT INTO sys_role_action_grants(role_code, action_code, platform_id)
SELECT 'lv3','auto_favorite', p.id FROM platforms p WHERE p.code='xhs'
ON DUPLICATE KEY UPDATE action_code=VALUES(action_code);
INSERT INTO sys_role_action_grants(role_code, action_code, platform_id)
SELECT 'lv3','auto_comment', p.id FROM platforms p WHERE p.code='xhs'
ON DUPLICATE KEY UPDATE action_code=VALUES(action_code);

INSERT INTO sys_role_action_grants(role_code, action_code, platform_id)
SELECT 'admin','auto_view', p.id FROM platforms p WHERE p.code='xhs'
ON DUPLICATE KEY UPDATE action_code=VALUES(action_code);
INSERT INTO sys_role_action_grants(role_code, action_code, platform_id)
SELECT 'admin','auto_like', p.id FROM platforms p WHERE p.code='xhs'
ON DUPLICATE KEY UPDATE action_code=VALUES(action_code);
INSERT INTO sys_role_action_grants(role_code, action_code, platform_id)
SELECT 'admin','auto_favorite', p.id FROM platforms p WHERE p.code='xhs'
ON DUPLICATE KEY UPDATE action_code=VALUES(action_code);
INSERT INTO sys_role_action_grants(role_code, action_code, platform_id)
SELECT 'admin','auto_comment', p.id FROM platforms p WHERE p.code='xhs'
ON DUPLICATE KEY UPDATE action_code=VALUES(action_code);

-- 用户绑定（充分考虑 admin=1 与用户名）
INSERT INTO sys_user_roles(user_id, role_code)
SELECT 1, 'admin'
WHERE EXISTS (SELECT 1 FROM sys_users WHERE id=1)
ON DUPLICATE KEY UPDATE role_code=VALUES(role_code);

INSERT INTO sys_user_roles(user_id, role_code)
SELECT id, 'admin' FROM sys_users WHERE username='admin'
ON DUPLICATE KEY UPDATE role_code=VALUES(role_code);

INSERT INTO sys_user_roles(user_id, role_code)
SELECT id, 'lv1' FROM sys_users WHERE username='alice'
ON DUPLICATE KEY UPDATE role_code=VALUES(role_code);

INSERT INTO sys_user_roles(user_id, role_code)
SELECT id, 'lv2' FROM sys_users WHERE username='bob'
ON DUPLICATE KEY UPDATE role_code=VALUES(role_code);

INSERT INTO sys_user_roles(user_id, role_code)
SELECT id, 'lv3' FROM sys_users WHERE username='carol'
ON DUPLICATE KEY UPDATE role_code=VALUES(role_code);

-- 平台启用（可选）：为 admin(id=1) 与示例用户启用 xhs
ALTER TABLE sys_user_platforms ADD COLUMN enabled TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE sys_user_platforms ADD COLUMN platform_id BIGINT;
UPDATE sys_user_platforms up SET up.platform_id = (SELECT p.id FROM platforms p WHERE p.code='xhs') WHERE up.platform_id IS NULL;
ALTER TABLE sys_user_platforms DROP PRIMARY KEY;
ALTER TABLE sys_user_platforms DROP COLUMN platform_code;
ALTER TABLE sys_user_platforms MODIFY COLUMN platform_id BIGINT NOT NULL;
ALTER TABLE sys_user_platforms ADD PRIMARY KEY (user_id, platform_id);
INSERT INTO sys_user_platforms(user_id, platform_id, enabled)
SELECT 1, p.id, 1 FROM platforms p WHERE p.code='xhs' AND EXISTS (SELECT 1 FROM sys_users WHERE id=1)
ON DUPLICATE KEY UPDATE platform_id=VALUES(platform_id), enabled=VALUES(enabled);

INSERT INTO sys_user_platforms(user_id, platform_id, enabled)
SELECT u.id, p.id, 1 FROM sys_users u JOIN platforms p ON p.code='xhs' WHERE u.username IN ('admin','alice','bob','carol')
ON DUPLICATE KEY UPDATE platform_id=VALUES(platform_id), enabled=VALUES(enabled);
