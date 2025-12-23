## 目标与原则
- 完全融合 /auto_opration_python 到 Electron 项目，逻辑与行为保持等价；不再依赖任何 Python 文件。
- “自动运营”窗口勾选项与关键字直接映射 CLI/运行参数；最大化复用统一配置。
- 明确并保留 Python 项目的 SQL 依赖（日志/作者/内容/图片/标签/评论/交互/回复/拉取记录等），统一为 MySQL，并解决命名冲突。

## 命名冲突与方案
- 后台系统用户表继续使用 `users`（系统登录用户）。
- 平台作者表统一命名为 `creators`（避免与保留字/后台 `users` 冲突）。
- 内容表统一使用 `notes`（为 Python 需求做字段超集）。
- 兼容 Python 表名：如已有同名冲突（如 `users` 用于作者），提供迁移重命名为 `xhs_creators` 或直接迁至 `creators`；旧引用通过视图或代码改造消除。

## 全局 SQL（MySQL，含注释，覆盖 Python 依赖）
- 保留现有权限/平台相关（沿用 db/init.sql）：`users/platforms/features/platform_features/user_platforms/user_feature_grants/feature_actions`。
- 新增/统一内容侧模型（字段超集以容纳 Python 依赖）：
```
-- 采集/请求日志（搜索分页与状态）
CREATE TABLE IF NOT EXISTS requests_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  keyword VARCHAR(128) NOT NULL,
  page INT NOT NULL DEFAULT 1,
  page_size INT NOT NULL DEFAULT 20,
  status VARCHAR(32) NOT NULL,
  page_count INT DEFAULT NULL,
  acc_count INT DEFAULT NULL,
  has_more TINYINT(1) DEFAULT 0,
  ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  text_head VARCHAR(255) DEFAULT NULL,
  error_msg VARCHAR(512) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_req_kw_page (keyword, page)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 平台作者（替代 Python 的 users 用法）
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
  KEY idx_creator_platform (platform_id),
  CONSTRAINT fk_creators_platform FOREIGN KEY (platform_id) REFERENCES platforms(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 内容主表（字段超集，兼容 Python notes）
CREATE TABLE IF NOT EXISTS notes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  platform_id BIGINT UNSIGNED NOT NULL,
  note_platform_id VARCHAR(64) NOT NULL,
  url VARCHAR(255) DEFAULT NULL,
  title VARCHAR(255) DEFAULT NULL,
  `desc` TEXT DEFAULT NULL,
  note_type ENUM('image_text','video') DEFAULT 'image_text',
  `time` TIMESTAMP NULL DEFAULT NULL,
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
  CONSTRAINT fk_notes_platform FOREIGN KEY (platform_id) REFERENCES platforms(id),
  CONSTRAINT fk_notes_author FOREIGN KEY (author_id) REFERENCES creators(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 交互统计快照（可选，保留 Python interactions 表语义）
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
  KEY idx_inter_note (note_id),
  CONSTRAINT fk_inter_note FOREIGN KEY (note_id) REFERENCES notes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 图片（保留 Python images 表语义；Node 媒体写入此表）
CREATE TABLE IF NOT EXISTS images (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  note_id BIGINT UNSIGNED NOT NULL,
  url VARCHAR(1024) NOT NULL,
  meta_json JSON DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_img_note (note_id),
  CONSTRAINT fk_img_note FOREIGN KEY (note_id) REFERENCES notes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 标签（保留 Python note_tags 语义）
CREATE TABLE IF NOT EXISTS note_tags (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  note_id BIGINT UNSIGNED NOT NULL,
  tag VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tag_note (note_id),
  CONSTRAINT fk_tag_note FOREIGN KEY (note_id) REFERENCES notes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 评论抓取日志（保留 Python comment_fetch_log 语义）
CREATE TABLE IF NOT EXISTS comment_fetch_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  note_id BIGINT UNSIGNED NOT NULL,
  cursor VARCHAR(255) DEFAULT NULL,
  status VARCHAR(32) DEFAULT NULL,
  count INT DEFAULT NULL,
  has_more TINYINT(1) DEFAULT 0,
  ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  error_msg VARCHAR(512) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_cfl_note (note_id),
  CONSTRAINT fk_cfl_note FOREIGN KEY (note_id) REFERENCES notes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 评论（保留 Python comments 语义）
CREATE TABLE IF NOT EXISTS comments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  comment_id VARCHAR(64) NOT NULL,
  note_id BIGINT UNSIGNED NOT NULL,
  user_id VARCHAR(64) DEFAULT NULL,
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
  KEY idx_comment_note (note_id),
  CONSTRAINT fk_comment_note FOREIGN KEY (note_id) REFERENCES notes(id)
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
```
- 说明：以上为 Python 项目用到的表语义的完整覆盖；其中作者统一入 `creators`，内容统一入 `notes`（字段超集无损）；图片入 `images`；交互/标签/评论/AI 相关保留原表职责。

## 代码改造（逐入库检查并对应变更）
- 统一 MySQL 语法；移除主进程中混入的 Postgres `ON CONFLICT` SQL：`src/main.js:346-354`, `src/main.js:429-433`。
- 主进程入库函数对应关系：
  - 平台 upsert：`src/main.js:286` → `platforms`
  - 作者 upsert：`src/main.js:289-297` → 改为写 `creators`
  - 内容 upsert：`src/main.js:298-307` → 写 `notes` 超集字段（含 is_restricted/published_at 等）
  - 媒体 upsert：`src/main.js:309-317` → 改为写 `images`（或双写 `note_media` 与 `images`，以兼容）
  - 会话 insert：`src/main.js:318-324` → `browse_sessions`
  - 访问 insert：`src/main.js:325-330` → `note_visits`
- 新增仓储层 `src/db/repo.js` 封装：`upsertPlatform/upsertCreator/upsertNote/upsertImage/upsertInteractions/insertBrowseSession/insertNoteVisit/insertComment/insertCommentInteraction/insertReply/insertReplyResponse/logRequest`。
- 详情解析字段映射：严格输出 7 字段供前端展示；入库同时填充超集字段（desc/cover/card/model/交互计数等）。

## UI 参数联动（映射 Python 运行语义）
- keyword → `requests_log.keyword`、会话入库 `browse_sessions.keyword`。
- like/fav/comment/record → 控制是否写入 `interactions`/`comments`/`comment_fetch_log`/`xhs_comment_replies` 等。
- limit/delayRange/type/captureEnabled → 运行节奏与入库开关映射。

## 运行与实现
- 新增 Node 模块：`src/automation/xhs/{runner.js, cli.js, params.js}`；复用 Playwright 层；逻辑流程保持等价（搜索→列表→详情→互动）。
- 主进程恢复 `start-auto-op`，合并 UI+配置参数，调用 `runner.run(options)`；仓储层统一入库（保证所有 Python 依赖表被正确写入）。

## 验证清单
- 列表与详情采集稳定（含不翻页/懒加载触发）。
- 详情 7 字段展示正确，图片列表不为空（含 live-img/data-src/srcset/background-image）。
- 勾选联动生效；评论与交互相关表正确写入；请求/评论抓取日志完整。
- 数据库唯一约束与 upsert 行为正确；无 Postgres 方言；命名冲突消除（作者统一为 creators）。

请确认以上融合与 SQL 方案；确认后我将开始实施：新增/迁移表结构、改造每一个入库点、统一语法并完成端到端联调。