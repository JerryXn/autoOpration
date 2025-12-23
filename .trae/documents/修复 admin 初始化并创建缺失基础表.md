## 问题
- 查询报错 1146：`auto_final.users` 不存在，说明当前数据库 `auto_final` 中未创建基础表或曾在其他库初始化。
- 可能原因：初始化脚本未连接到 `auto_final`，或库存在但表未创建。

## 方案
- 在 MySQL 中创建并初始化基础权限/平台相关表（无外键，仅唯一约束与索引），然后插入 `admin` 用户与平台/功能授权。
- 所有语句均使用 `auto_final`，保证后续查询在该库内可用。

## 执行 SQL（拷贝到 MySQL 客户端运行）
```
CREATE DATABASE IF NOT EXISTS `auto_final` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `auto_final`;

CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(64) NOT NULL,
  `password_hash` VARCHAR(100) NOT NULL,
  `expires_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `platforms` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(32) NOT NULL,
  `name` VARCHAR(64) NOT NULL,
  `homepage_url` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_platform_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `features` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(32) NOT NULL,
  `name` VARCHAR(64) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_feature_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `user_platforms` (
  `user_id` BIGINT UNSIGNED NOT NULL,
  `platform_id` BIGINT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `platform_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `platform_features` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `platform_id` BIGINT UNSIGNED NOT NULL,
  `feature_id` BIGINT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_platform_feature` (`platform_id`, `feature_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `user_feature_grants` (
  `user_id` BIGINT UNSIGNED NOT NULL,
  `platform_feature_id` BIGINT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `platform_feature_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `users` (`username`, `password_hash`, `expires_at`)
VALUES ('admin', '$2a$10$LZAGHM/H6X/xfkP8qXRsJuz/YKMY8j.mGztJppo1DqnVnUnFH6uxK', DATE_ADD(NOW(), INTERVAL 3650 DAY))
ON DUPLICATE KEY UPDATE `password_hash` = VALUES(`password_hash`), `expires_at` = VALUES(`expires_at`);

INSERT INTO `platforms` (`code`, `name`, `homepage_url`) VALUES
('xhs', '小红书', 'https://www.xiaohongshu.com/'),
('douyin', '抖音', 'https://www.douyin.com/'),
('ks', '快手', 'https://www.kuaishou.com/'),
('mp', '公众号', 'https://mp.weixin.qq.com/')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `homepage_url` = VALUES(`homepage_url`);

INSERT INTO `features` (`code`, `name`) VALUES
('publish', '发布'),
('auto_operation', '自动运营')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `user_platforms` (`user_id`, `platform_id`)
SELECT u.`id`, p.`id` FROM `users` u JOIN `platforms` p ON p.`code` IN ('xhs','douyin') WHERE u.`username` = 'admin'
ON DUPLICATE KEY UPDATE `user_id` = `user_id`;

INSERT INTO `platform_features` (`platform_id`, `feature_id`)
SELECT p.`id`, f.`id`
FROM `platforms` p JOIN `features` f ON f.`code` IN ('publish','auto_operation')
WHERE p.`code` IN ('xhs','douyin','ks')
ON DUPLICATE KEY UPDATE `feature_id` = VALUES(`feature_id`);

INSERT INTO `user_feature_grants` (`user_id`, `platform_feature_id`)
SELECT u.`id`, pf.`id`
FROM `users` u
JOIN `platforms` p ON p.`code` = 'xhs'
JOIN `features` f ON f.`code` IN ('publish','auto_operation')
JOIN `platform_features` pf ON pf.`platform_id` = p.`id` AND pf.`feature_id` = f.`id`
WHERE u.`username` = 'admin'
ON DUPLICATE KEY UPDATE `user_id` = `user_id`;
```

## 验证
- 运行你提供的六条检查查询，均应返回记录；若仍报错，确认连接库为 `auto_final`（`SELECT DATABASE();`）。

## 后续自动化
- 如需脚本化初始化（不依赖手动 SQL），我会将上述语句整理为一个 npm 脚本，读取 `.env` 并自动执行；确认后我再落地到仓库。