-- 数据库与表初始化
CREATE DATABASE IF NOT EXISTS `auto_operation`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `auto_operation`;

CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(64) NOT NULL,
  `password_hash` VARCHAR(100) NOT NULL,
  `expires_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 预置一个管理员账户：用户名 admin，密码 admin123
INSERT INTO `users` (`username`, `password_hash`, `expires_at`)
VALUES ('admin', '$2a$10$LZAGHM/H6X/xfkP8qXRsJuz/YKMY8j.mGztJppo1DqnVnUnFH6uxK', DATE_ADD(NOW(), INTERVAL 365 DAY))
ON DUPLICATE KEY UPDATE `password_hash` = VALUES(`password_hash`), `expires_at` = VALUES(`expires_at`);

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

INSERT INTO `platforms` (`code`, `name`, `homepage_url`) VALUES
('xhs', '小红书', 'https://www.xiaohongshu.com/'),
('douyin', '抖音', 'https://www.douyin.com/'),
('mp', '公众号', 'https://mp.weixin.qq.com/'),
('ks', '快手', 'https://www.kuaishou.com/')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `homepage_url` = VALUES(`homepage_url`);

INSERT INTO `features` (`code`, `name`) VALUES
('publish', '发布'),
('auto_operation', '自动运营')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

CREATE TABLE IF NOT EXISTS `feature_actions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `feature_id` BIGINT UNSIGNED NOT NULL,
  `code` VARCHAR(64) NOT NULL,
  `name` VARCHAR(64) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_feature_action_code` (`code`),
  CONSTRAINT `fk_action_feature` FOREIGN KEY (`feature_id`) REFERENCES `features` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `feature_actions` (`feature_id`, `code`, `name`)
SELECT f.`id`, 'publish_image', '发布-图片' FROM `features` f WHERE f.`code` = 'publish'
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `feature_actions` (`feature_id`, `code`, `name`)
SELECT f.`id`, 'publish_video', '发布-视频' FROM `features` f WHERE f.`code` = 'publish'
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `feature_actions` (`feature_id`, `code`, `name`)
SELECT f.`id`, 'auto_like', '自动运营-点赞' FROM `features` f WHERE f.`code` = 'auto_operation'
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `feature_actions` (`feature_id`, `code`, `name`)
SELECT f.`id`, 'auto_comment', '自动运营-评论' FROM `features` f WHERE f.`code` = 'auto_operation'
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `feature_actions` (`feature_id`, `code`, `name`)
SELECT f.`id`, 'auto_favorite', '自动运营-收藏' FROM `features` f WHERE f.`code` = 'auto_operation'
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `feature_actions` (`feature_id`, `code`, `name`)
SELECT f.`id`, 'auto_view', '自动运营-浏览' FROM `features` f WHERE f.`code` = 'auto_operation'
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

CREATE TABLE IF NOT EXISTS `user_platforms` (
  `user_id` BIGINT UNSIGNED NOT NULL,
  `platform_id` BIGINT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `platform_id`),
  CONSTRAINT `fk_up_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_up_platform` FOREIGN KEY (`platform_id`) REFERENCES `platforms` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `platform_features` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `platform_id` BIGINT UNSIGNED NOT NULL,
  `feature_id` BIGINT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_platform_feature` (`platform_id`, `feature_id`),
  CONSTRAINT `fk_pf_platform` FOREIGN KEY (`platform_id`) REFERENCES `platforms` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pf_feature` FOREIGN KEY (`feature_id`) REFERENCES `features` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `user_feature_grants` (
  `user_id` BIGINT UNSIGNED NOT NULL,
  `platform_feature_id` BIGINT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `platform_feature_id`),
  CONSTRAINT `fk_ufg_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ufg_pf` FOREIGN KEY (`platform_feature_id`) REFERENCES `platform_features` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `user_platforms` (`user_id`, `platform_id`)
SELECT u.`id`, p.`id`
FROM `users` u JOIN `platforms` p ON p.`code` IN ('xhs','douyin')
WHERE u.`username` = 'admin'
ON DUPLICATE KEY UPDATE `user_id` = `user_id`;

INSERT INTO `platform_features` (`platform_id`, `feature_id`)
SELECT p.`id`, f.`id` FROM `platforms` p JOIN `features` f ON f.`code` IN ('publish','auto_operation') WHERE p.`code` IN ('xhs','douyin','ks')
ON DUPLICATE KEY UPDATE `feature_id` = VALUES(`feature_id`);

INSERT INTO `user_feature_grants` (`user_id`, `platform_feature_id`)
SELECT u.`id`, pf.`id`
FROM `users` u
JOIN `platforms` p ON p.`code` = 'xhs'
JOIN `features` f ON f.`code` IN ('publish','auto_operation')
JOIN `platform_features` pf ON pf.`platform_id` = p.`id` AND pf.`feature_id` = f.`id`
WHERE u.`username` = 'admin'
ON DUPLICATE KEY UPDATE `user_id` = `user_id`;
CREATE TABLE IF NOT EXISTS media_files (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  logical_name VARCHAR(255) NOT NULL,
  physical_name VARCHAR(255) NOT NULL,
  storage_path VARCHAR(512) NOT NULL,
  mime VARCHAR(128) DEFAULT NULL,
  size BIGINT UNSIGNED DEFAULT NULL,
  sha256 CHAR(64) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_media_user (user_id),
  UNIQUE KEY uniq_user_logical (user_id, logical_name)
);

CREATE TABLE IF NOT EXISTS parsed_contents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  platform_code VARCHAR(32) DEFAULT NULL,
  type ENUM('image_text','video') NOT NULL,
  title VARCHAR(255) DEFAULT NULL,
  content TEXT DEFAULT NULL,
  cover_refs JSON DEFAULT NULL,
  image_refs JSON DEFAULT NULL,
  video_ref VARCHAR(255) DEFAULT NULL,
  status ENUM('draft','ready','published') NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pc_user (user_id),
  KEY idx_pc_platform (platform_code),
  KEY idx_pc_type (type)
);

-- 平台创作者（跨平台笔记作者）
CREATE TABLE IF NOT EXISTS creators (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  platform_id BIGINT UNSIGNED NOT NULL,
  external_id VARCHAR(128) NOT NULL,
  name VARCHAR(255) DEFAULT NULL,
  profile_url VARCHAR(512) DEFAULT NULL,
  avatar_url VARCHAR(512) DEFAULT NULL,
  extra JSON DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_creator_platform_external (platform_id, external_id),
  KEY idx_creator_platform (platform_id),
  CONSTRAINT fk_creator_platform FOREIGN KEY (platform_id) REFERENCES platforms (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 跨平台笔记主体
CREATE TABLE IF NOT EXISTS notes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  platform_id BIGINT UNSIGNED NOT NULL,
  note_platform_id VARCHAR(128) NOT NULL,
  url TEXT DEFAULT NULL,
  title VARCHAR(512) DEFAULT NULL,
  author_id BIGINT UNSIGNED DEFAULT NULL,
  note_type ENUM('image_text','video') NOT NULL,
  is_restricted TINYINT(1) NOT NULL DEFAULT 0,
  published_at TIMESTAMP NULL DEFAULT NULL,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  extra JSON DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_note_platform (platform_id, note_platform_id),
  KEY idx_note_platform (platform_id),
  KEY idx_note_author (author_id),
  CONSTRAINT fk_note_platform FOREIGN KEY (platform_id) REFERENCES platforms (id) ON DELETE CASCADE,
  CONSTRAINT fk_note_author FOREIGN KEY (author_id) REFERENCES creators (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 笔记媒体（图片/视频等）
CREATE TABLE IF NOT EXISTS note_media (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  note_id BIGINT UNSIGNED NOT NULL,
  media_order INT UNSIGNED NOT NULL,
  media_type ENUM('image','video') NOT NULL,
  url TEXT DEFAULT NULL,
  width INT UNSIGNED DEFAULT NULL,
  height INT UNSIGNED DEFAULT NULL,
  duration_ms INT UNSIGNED DEFAULT NULL,
  extra JSON DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_note_media_order (note_id, media_order),
  KEY idx_note_media_note (note_id),
  CONSTRAINT fk_note_media_note FOREIGN KEY (note_id) REFERENCES notes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 兼容已存在的表结构，将 url 字段扩展为 TEXT，避免长查询串导致写入失败
ALTER TABLE notes MODIFY COLUMN url TEXT;
ALTER TABLE note_media MODIFY COLUMN url TEXT;

-- 浏览会话
CREATE TABLE IF NOT EXISTS browse_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  platform_id BIGINT UNSIGNED NOT NULL,
  entry_url VARCHAR(1024) DEFAULT NULL,
  keyword VARCHAR(255) DEFAULT NULL,
  device_fingerprint VARCHAR(255) DEFAULT NULL,
  extra JSON DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_browse_platform (platform_id),
  CONSTRAINT fk_browse_platform FOREIGN KEY (platform_id) REFERENCES platforms (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 详情页进入记录
CREATE TABLE IF NOT EXISTS note_visits (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id BIGINT UNSIGNED NOT NULL,
  note_id BIGINT UNSIGNED NOT NULL,
  restricted TINYINT(1) NOT NULL DEFAULT 0,
  extra JSON DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_visit_session (session_id),
  KEY idx_visit_note (note_id),
  CONSTRAINT fk_visit_session FOREIGN KEY (session_id) REFERENCES browse_sessions (id) ON DELETE CASCADE,
  CONSTRAINT fk_visit_note FOREIGN KEY (note_id) REFERENCES notes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
