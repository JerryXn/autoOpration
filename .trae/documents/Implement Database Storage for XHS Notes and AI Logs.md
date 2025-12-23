I have analyzed your request and the existing database schema (`src/db/auto_final.sql`).

You need to store:
1.  **XHS Note Content**: Details of the notes you visit (title, desc, likes, etc.).
2.  **Note Details**: More in-depth info if available.
3.  **AI Interactions**: Inputs sent to AI and replies received.

Based on the existing schema, I see you already have `xhs_users` and some system tables (`sys_industries`, `sys_bot_configs`), but **missing tables for Notes and AI Logs**.

I will create a new SQL file `db/update_schema.sql` to add these tables and then update the Python code to use them.

### Database Schema Design Plan

1.  **`xhs_notes` Table**: To store note basics.
    *   `note_id` (Primary Key, varchar)
    *   `user_id` (Foreign Key to `xhs_users`)
    *   `title` (varchar)
    *   `desc` (text)
    *   `type` (video/image)
    *   `liked_count`, `collected_count`, `comment_count` (int)
    *   `note_url` (varchar)
    *   `industry` (varchar, linking to your industry filter)
    *   `created_at`, `last_visited_at`

2.  **`ai_interaction_logs` Table**: To store AI dialogs.
    *   `id` (Primary Key, Auto Inc)
    *   `note_id` (Foreign Key to `xhs_notes`)
    *   `bot_id` (varchar, from `sys_bot_configs`)
    *   `input_context` (text - what we sent to AI, e.g., comments + note content)
    *   `prompt_used` (text)
    *   `ai_response` (text)
    *   `status` (success/failed)
    *   `created_at`

3.  **`xhs_comments` Table** (Optional but recommended): To store comments we scraped that were sent to AI.
    *   `comment_id`
    *   `note_id`
    *   `content`

### Python Implementation Plan

1.  **Enhance `db.py`**:
    *   Add `dbutils` based `PooledDB` for robust connection pooling.
    *   Add methods `save_note()`, `save_user()`, `save_ai_log()`.

2.  **Update `detail_actions.py`**:
    *   Extract note title/desc/stats.
    *   Call `db.save_note()`.

3.  **Update `comment_actions.py` / `ai_reply.py`**:
    *   When AI is called, log the input and output to `ai_interaction_logs`.

### Execution Steps
1.  Create `db/update_schema.sql`.
2.  Apply the schema to the database.
3.  Install `dbutils` (Python package) for pooling.
4.  Refactor `src/playwright/python/db.py` to use pooling and add insert methods.
5.  Integrate saving logic into `xhs.py`, `detail_actions.py`, and `ai_reply.py`.