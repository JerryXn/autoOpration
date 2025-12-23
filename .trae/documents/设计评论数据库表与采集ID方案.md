## 命名约定
- 所有表名增加统一前缀：`paly_`（示例：`paly_comments`、`paly_actions`）
- 主键/外键命名遵循表前缀，以便区分模块与防冲突

## 字段来源与解析（摘要）
- comment_id：DOM `div.comment-item` 的 `id`（如 `comment-69369c1d...`），作为评论唯一键（字符串）
- note_id：来自详情页 URL `/explore/{note_id}`
- author_name/author_user_id：作者名与 `data-user-id`（后续增强）
- content/date/location/top：与现有解析一致；时间存原文与规范化两份（后续增强）

## 表设计（含前缀）
### 1. `paly_notes`
- `id` VARCHAR(64) PRIMARY KEY（`note_id`）
- `title` VARCHAR(255)
- `source_url` VARCHAR(512)
- `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP

### 2. `paly_users`（可选增强）
- `id` VARCHAR(64) PRIMARY KEY（`user_id`）
- `nickname` VARCHAR(128)
- `avatar_url` VARCHAR(512)
- `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP

### 3. `paly_comments`（去除 likes/replies）
- `comment_id` VARCHAR(128) PRIMARY KEY
- `note_id` VARCHAR(64) NOT NULL REFERENCES `paly_notes(id)`
- `parent_comment_id` VARCHAR(128) NULL（子评论指向主评论）
- `author_user_id` VARCHAR(64) NULL
- `author_name` VARCHAR(128) NOT NULL
- `content` TEXT NOT NULL
- `comment_time_text` VARCHAR(64)
- `comment_time` DATETIME NULL
- `location` VARCHAR(64) NULL
- `is_top` TINYINT(1) DEFAULT 0
- `scan_batch` INT DEFAULT 0
- `source_url` VARCHAR(512)
- `raw_json` JSON
- `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
- `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
- 索引：`idx_paly_comments_note_time(note_id, comment_time)`、`idx_paly_comments_author(author_user_id)`、`idx_paly_comments_top(note_id, is_top)`、`ftx_paly_comments_content(content)`

### 4. `paly_actions`（记录“我”的操作）
- `id` BIGINT PRIMARY KEY AUTO_INCREMENT
- `actor_user_id` VARCHAR(64) NOT NULL（当前账户）
- `note_id` VARCHAR(64) NOT NULL
- `target_comment_id` VARCHAR(128) NULL
- `action_type` ENUM('like','collect','comment','share') NOT NULL
- `content` TEXT NULL（评论内容）
- `success` TINYINT(1) DEFAULT 1
- `metadata` JSON NULL
- `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
- 约束：`uk_paly_actor_note_action(actor_user_id, note_id, action_type, target_comment_id)` 唯一
- 索引：`idx_paly_actions_note(note_id, action_type)`、`idx_paly_actions_actor(actor_user_id, created_at)`

### 5. `paly_comment_batches`（采集批次日志）
- `id` BIGINT PRIMARY KEY AUTO_INCREMENT
- `note_id` VARCHAR(64) NOT NULL
- `batch_no` INT NOT NULL
- `new_count` INT NOT NULL
- `end_reached` TINYINT(1) DEFAULT 0（遇到 `div.end-container`）
- `comment_total_hint` INT NULL
- `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
- 索引：`idx_paly_batches_note(note_id)`

## 示例 DDL（MySQL）
```sql
CREATE TABLE paly_notes (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255),
  source_url VARCHAR(512),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE paly_comments (
  comment_id VARCHAR(128) PRIMARY KEY,
  note_id VARCHAR(64) NOT NULL,
  parent_comment_id VARCHAR(128),
  author_user_id VARCHAR(64),
  author_name VARCHAR(128) NOT NULL,
  content TEXT NOT NULL,
  comment_time_text VARCHAR(64),
  comment_time DATETIME,
  location VARCHAR(64),
  is_top TINYINT(1) DEFAULT 0,
  scan_batch INT DEFAULT 0,
  source_url VARCHAR(512),
  raw_json JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_paly_comments_note_time (note_id, comment_time),
  KEY idx_paly_comments_author (author_user_id),
  KEY idx_paly_comments_top (note_id, is_top),
  FULLTEXT KEY ftx_paly_comments_content (content),
  CONSTRAINT fk_paly_comments_note FOREIGN KEY (note_id) REFERENCES paly_notes(id)
) ENGINE=InnoDB;

CREATE TABLE paly_actions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  actor_user_id VARCHAR(64) NOT NULL,
  note_id VARCHAR(64) NOT NULL,
  target_comment_id VARCHAR(128),
  action_type ENUM('like','collect','comment','share') NOT NULL,
  content TEXT,
  success TINYINT(1) DEFAULT 1,
  metadata JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_paly_actor_note_action (actor_user_id, note_id, action_type, target_comment_id),
  KEY idx_paly_actions_note (note_id, action_type),
  KEY idx_paly_actions_actor (actor_user_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE paly_comment_batches (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  note_id VARCHAR(64) NOT NULL,
  batch_no INT NOT NULL,
  new_count INT NOT NULL,
  end_reached TINYINT(1) DEFAULT 0,
  comment_total_hint INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_paly_batches_note (note_id)
) ENGINE=InnoDB;

CREATE TABLE paly_users (
  id VARCHAR(64) PRIMARY KEY,
  nickname VARCHAR(128),
  avatar_url VARCHAR(512),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
```

## 入库策略
- 评论：`INSERT ... ON DUPLICATE KEY UPDATE`，以 `comment_id` 去重更新（如 `comment_time/location/is_top/raw_json`）。
- 行为：每次“我”的操作写入 `paly_actions`；若重复，唯一键保障幂等；失败标记 `success=0` 并记录 `metadata`。
- 批次：每轮扫描记录 `paly_comment_batches`，标记 `end_reached` 或达到 `comment_total_hint`。

## 后续增强
- 解析 `author_user_id`、`parent_comment_id` 并填充至表。
- 时间规范化（`comment_time_text` → `comment_time`）规则：相对时间（“2小时前”）→ 绝对时间，月日格式→补全年份。
- 大规模数据下为 `content` 建立专用检索服务或分词索引。

请确认以上前缀方案与表结构；确认后我将按此创建表并对接当前采集流程的入库逻辑。