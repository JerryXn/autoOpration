INSERT INTO sys_roles(code,name) VALUES
('lv1','基础'),('lv2','进阶'),('lv3','高级'),('admin','管理员')
ON DUPLICATE KEY UPDATE name=VALUES(name);

INSERT INTO platforms(code,name) VALUES
('xhs','小红书')
ON DUPLICATE KEY UPDATE name=VALUES(name);

INSERT IGNORE INTO sys_users(id, username, password_hash, expires_at)
VALUES (1, 'admin', '$2a$10$EZr14fbne1eY3ksEQdAH1.NdOuuqQy2fAMeTnEE69/8PGXDktP2ce', DATE_ADD(NOW(), INTERVAL 365 DAY));

INSERT INTO sys_users(username,password_hash,expires_at)
VALUES
('lv1_user','$2a$10$EZr14fbne1eY3ksEQdAH1.NdOuuqQy2fAMeTnEE69/8PGXDktP2ce', DATE_ADD(NOW(), INTERVAL 365 DAY)),
('lv2_user','$2a$10$EZr14fbne1eY3ksEQdAH1.NdOuuqQy2fAMeTnEE69/8PGXDktP2ce', DATE_ADD(NOW(), INTERVAL 365 DAY)),
('lv3_user','$2a$10$EZr14fbne1eY3ksEQdAH1.NdOuuqQy2fAMeTnEE69/8PGXDktP2ce', DATE_ADD(NOW(), INTERVAL 365 DAY))
ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash), expires_at=VALUES(expires_at);

INSERT INTO sys_user_roles(user_id, role_code)
SELECT 1, 'admin' WHERE EXISTS (SELECT 1 FROM sys_users WHERE id=1)
ON DUPLICATE KEY UPDATE role_code=VALUES(role_code);

INSERT INTO sys_user_roles(user_id, role_code)
SELECT id, 'lv1' FROM sys_users WHERE username='lv1_user'
ON DUPLICATE KEY UPDATE role_code=VALUES(role_code);

INSERT INTO sys_user_roles(user_id, role_code)
SELECT id, 'lv2' FROM sys_users WHERE username='lv2_user'
ON DUPLICATE KEY UPDATE role_code=VALUES(role_code);

INSERT INTO sys_user_roles(user_id, role_code)
SELECT id, 'lv3' FROM sys_users WHERE username='lv3_user'
ON DUPLICATE KEY UPDATE role_code=VALUES(role_code);

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

INSERT INTO sys_user_platforms(user_id, platform_id, enabled)
SELECT 1, p.id, 1 FROM platforms p WHERE p.code='xhs' AND EXISTS (SELECT 1 FROM sys_users WHERE id=1)
ON DUPLICATE KEY UPDATE platform_id=VALUES(platform_id), enabled=VALUES(enabled);

INSERT INTO sys_user_platforms(user_id, platform_id, enabled)
SELECT u.id, p.id, 1 FROM sys_users u JOIN platforms p ON p.code='xhs' WHERE u.username IN ('lv1_user','lv2_user','lv3_user')
ON DUPLICATE KEY UPDATE platform_id=VALUES(platform_id), enabled=VALUES(enabled);
