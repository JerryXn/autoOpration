-- 全局SQL（MySQL）——融合 auto_opration_python 的依赖并统一到当前项目
-- 说明：保留现有权限/平台相关表，新增或统一内容侧模型，解决命名冲突与方言问题

-- 采集/请求日志（搜索分页与状态）
CREATE TABLE IF NOT EXISTS requests_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  keyword VARCHAR(128) NOT NULL,
  page INT NOT NULL DEFAULT 1,
  page_size INT NOT NULL DEFAULT 20,
  status VARCHAR(32) NOT NULL,
  page_total INT DEFAULT NULL,
  acc_total INT DEFAULT NULL,
  has_more TINYINT(1) DEFAULT 0,
  ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  text_head VARCHAR(255) DEFAULT NULL,
  error_msg VARCHAR(512) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_req_kw_page (keyword, page)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 平台作者（替代 Python 的 users 用法，避免与系统 users 冲突）
CREATE TABLE IF NOT EXISTS creators (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  platform_id BIGINT UNSIGNED NOT NULL,
  external_id VARCHAR(64) NOT NULL,
  name VARCHAR(128) DEFAULT NULL,
  profile_url VARCHAR(255) DEFAULT NULL,
  avatar_url VARCHAR(255) DEFAULT NULL,
  extra JSON DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_creator (platform_id, external_id),
  KEY idx_creator_platform (platform_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 内容主表（字段超集，兼容 Python notes）
CREATE TABLE IF NOT EXISTS notes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  platform_id BIGINT UNSIGNED NOT NULL,
  note_platform_id VARCHAR(64) NOT NULL,
  url VARCHAR(255) DEFAULT NULL,
  title VARCHAR(255) DEFAULT NULL,
  description TEXT DEFAULT NULL,
  note_type ENUM('image_text','video') DEFAULT 'image_text',
  note_time TIMESTAMP NULL DEFAULT NULL,
  author_id BIGINT UNSIGNED DEFAULT NULL,
  cover_url VARCHAR(1024) DEFAULT NULL,
  card_type VARCHAR(64) DEFAULT NULL,
  model_type VARCHAR(64) DEFAULT NULL,
  nickname VARCHAR(128) DEFAULT NULL,
  avatar VARCHAR(1024) DEFAULT NULL,
  liked_count INT DEFAULT NULL,
  collected_count INT DEFAULT NULL,
  comment_count INT DEFAULT NULL,
  share_count INT DEFAULT NULL,
  is_liked TINYINT(1) DEFAULT 0,
  is_collected TINYINT(1) DEFAULT 0,
  xsec_token VARCHAR(255) DEFAULT NULL,
  raw_json JSON DEFAULT NULL,
  is_restricted TINYINT(1) NOT NULL DEFAULT 0,
  published_at TIMESTAMP NULL DEFAULT NULL,
  extra JSON DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_note (platform_id, note_platform_id),
  KEY idx_note_author (author_id),
  KEY idx_note_platform (platform_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 交互统计快照（保留 Python interactions 表语义）
CREATE TABLE IF NOT EXISTS interactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  note_id BIGINT UNSIGNED NOT NULL,
  liked_count INT DEFAULT NULL,
  collected_count INT DEFAULT NULL,
  comment_count INT DEFAULT NULL,
  share_count INT DEFAULT NULL,
  is_liked TINYINT(1) DEFAULT 0,
  is_collected TINYINT(1) DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_inter_note (note_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 图片（保留 Python images 表语义）
CREATE TABLE IF NOT EXISTS images (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  note_id BIGINT UNSIGNED NOT NULL,
  url VARCHAR(1024) NOT NULL,
  meta_json JSON DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_img_note (note_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 标签（保留 Python note_tags 语义）
CREATE TABLE IF NOT EXISTS note_tags (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  note_id BIGINT UNSIGNED NOT NULL,
  tag VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tag_note (note_id),
  UNIQUE KEY uniq_note_tag (note_id, tag)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 评论抓取日志（保留 Python comment_fetch_log 语义）
CREATE TABLE IF NOT EXISTS comment_fetch_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  note_id BIGINT UNSIGNED NOT NULL,
  cursor_token VARCHAR(255) DEFAULT NULL,
  status VARCHAR(32) DEFAULT NULL,
  fetched_count INT DEFAULT NULL,
  has_more TINYINT(1) DEFAULT 0,
  ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  error_msg VARCHAR(512) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_cfl_note (note_id),
  KEY idx_cfl_cursor (cursor_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 评论（保留 Python comments 语义）
CREATE TABLE IF NOT EXISTS comments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  comment_id VARCHAR(64) NOT NULL,
  note_id BIGINT UNSIGNED NOT NULL,
  commenter_id VARCHAR(64) DEFAULT NULL,
  parent_comment_id VARCHAR(64) DEFAULT NULL,
  root_comment_id VARCHAR(64) DEFAULT NULL,
  level INT DEFAULT NULL,
  content TEXT DEFAULT NULL,
  content_html TEXT DEFAULT NULL,
  image_urls JSON DEFAULT NULL,
  is_author TINYINT(1) DEFAULT 0,
  is_hot TINYINT(1) DEFAULT 0,
  is_deleted TINYINT(1) DEFAULT 0,
  comment_time TIMESTAMP NULL DEFAULT NULL,
  comment_ts BIGINT DEFAULT NULL,
  raw_json JSON DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_comment (comment_id),
  KEY idx_comment_note (note_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 评论交互（保留 Python comment_interactions 语义）
CREATE TABLE IF NOT EXISTS comment_interactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  comment_id VARCHAR(64) NOT NULL,
  like_count INT DEFAULT NULL,
  reply_count INT DEFAULT NULL,
  is_liked TINYINT(1) DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_cinter_comment (comment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- AI 评论回复（保留 Python xhs_comment_replies 语义）
CREATE TABLE IF NOT EXISTS xhs_comment_replies (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  note_id BIGINT UNSIGNED NOT NULL,
  comment_id VARCHAR(64) NOT NULL,
  comment_page_url VARCHAR(255) DEFAULT NULL,
  raw_text TEXT DEFAULT NULL,
  cleaned_text TEXT DEFAULT NULL,
  ai_answer TEXT DEFAULT NULL,
  decision VARCHAR(64) DEFAULT NULL,
  status VARCHAR(32) DEFAULT NULL,
  error_text VARCHAR(512) DEFAULT NULL,
  http_status INT DEFAULT NULL,
  provider VARCHAR(64) DEFAULT NULL,
  bot_id VARCHAR(64) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- AI 回复响应（保留 Python xhs_comment_reply_responses 语义）
CREATE TABLE IF NOT EXISTS xhs_comment_reply_responses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reply_id BIGINT UNSIGNED NOT NULL,
  resp_json JSON DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_reply_resp (reply_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Bot 配置表
CREATE TABLE IF NOT EXISTS sys_bot_configs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  industry VARCHAR(64) NOT NULL,
  platform VARCHAR(64) NOT NULL,
  bot_id VARCHAR(128) NOT NULL,
  token VARCHAR(255) NOT NULL,
  description VARCHAR(255) DEFAULT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_bot_industry (industry),
  UNIQUE KEY uniq_bot_conf (platform, bot_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 行业配置表
CREATE TABLE IF NOT EXISTS sys_industries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(64) NOT NULL,
  description VARCHAR(255) DEFAULT NULL,
  is_active TINYINT(1) DEFAULT 1,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_industry_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
