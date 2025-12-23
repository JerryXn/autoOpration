
-- Table for storing XHS Notes
CREATE TABLE IF NOT EXISTS `xhs_notes` (
  `note_id` varchar(64) NOT NULL,
  `user_id` varchar(64) DEFAULT NULL COMMENT 'Author ID',
  `title` varchar(512) DEFAULT NULL,
  `desc` text,
  `type` varchar(32) DEFAULT 'image_text' COMMENT 'video or image_text',
  `liked_count` int DEFAULT 0,
  `collected_count` int DEFAULT 0,
  `comment_count` int DEFAULT 0,
  `share_count` int DEFAULT 0,
  `note_url` varchar(512) DEFAULT NULL,
  `cover_url` varchar(512) DEFAULT NULL,
  `industry` varchar(64) DEFAULT NULL COMMENT 'Associated industry code',
  `last_visited_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`note_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_industry` (`industry`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table for storing AI Interaction Logs
CREATE TABLE IF NOT EXISTS `ai_interaction_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `note_id` varchar(64) NOT NULL,
  `bot_id` varchar(64) DEFAULT NULL,
  `input_context` text COMMENT 'Content sent to AI (comments, note desc, etc.)',
  `prompt_used` text COMMENT 'System prompt or instructions',
  `ai_response` text COMMENT 'Raw response from AI',
  `status` varchar(32) DEFAULT 'success' COMMENT 'success, failed',
  `error_msg` text,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_note_id` (`note_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Ensure xhs_users exists (from previous dump, but good to ensure)
CREATE TABLE IF NOT EXISTS `xhs_users` (
  `user_id` varchar(64) NOT NULL,
  `nickname` varchar(255) DEFAULT NULL,
  `avatar` varchar(512) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
