require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  const host = process.env.MYSQL_HOST || '127.0.0.1';
  const port = process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT, 10) : 3306;
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const database = process.env.MYSQL_DATABASE || 'auto_operation';

  console.log(`[db] Connecting to ${database} at ${host}:${port}...`);
  const pool = await mysql.createPool({ host, port, user, password, database });

  // List of tables identified as completely unused in the current codebase
  // (Not referenced in src/ or playwright/ logic, except in migration/renaming scripts)
  const tablesToDrop = [
    // Legacy 'paly_' tables
    'paly_actions',
    'paly_comment_batches',
    'paly_comments',
    'paly_notes',
    'paly_users',

    // Unused 'op_' tables (code uses 'notes', 'images', 'xhs_users' etc. without prefix or with different names)
    'op_action_logs',
    'op_comment_fetch_log',
    'op_comment_interactions',
    'op_comment_replies',
    'op_comment_reply_responses',
    'op_images',
    'op_interactions',
    'op_note_tags',
    'op_requests_log',
    'op_tags',
    'op_users_xhs',
    'op_notes', 

    // Unused RBAC tables (code currently relies only on sys_user_roles and sys_role_action_grants)
    'sys_role_feature_action_grants',
    'sys_role_feature_grants',
    // 'sys_roles' // Intentionally KEPT as a dictionary table for future use, even if not queried now.
  ];

  console.log(`[db] Found ${tablesToDrop.length} tables to drop.`);

  for (const table of tablesToDrop) {
    try {
      // Check if table exists first
      const [rows] = await pool.query('SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=? LIMIT 1', [database, table]);
      if (rows.length === 0) {
        console.log(`[skip] Table '${table}' does not exist.`);
        continue;
      }

      // Drop table
      await pool.query(`DROP TABLE \`${table}\``);
      console.log(`[ok] Dropped table '${table}'`);
    } catch (e) {
      console.error(`[err] Failed to drop '${table}':`, e.message);
    }
  }

  console.log('[done] Cleanup finished.');
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
