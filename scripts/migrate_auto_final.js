require('dotenv').config();
const mysql = require('mysql2/promise');

async function existsColumn(pool, schema, table, column){
  const [rows] = await pool.query('SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=? LIMIT 1', [schema, table, column]);
  return rows && rows.length > 0;
}
async function existsIndex(pool, schema, table, index){
  const [rows] = await pool.query('SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND INDEX_NAME=? LIMIT 1', [schema, table, index]);
  return rows && rows.length > 0;
}
async function addColumn(pool, table, columnDef){
  console.log('[addColumn]', table, columnDef);
  await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN ${columnDef}`);
}
async function addUnique(pool, table, indexName, columns){
  console.log('[addUnique]', table, indexName, columns);
  await pool.query(`ALTER TABLE \`${table}\` ADD UNIQUE KEY \`${indexName}\` (${columns.map(c=>`\`${c}\``).join(', ')})`);
}

async function main(){
  const host = process.env.MYSQL_HOST || '127.0.0.1';
  const port = process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT,10) : 3306;
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const database = process.env.MYSQL_DATABASE || 'auto_final';
  console.log('[db]', database);
  const pool = await mysql.createPool({ host, port, user, password, database, multipleStatements: true });

  // notes columns for python compatibility
  const notesCols = [
    ['note_id','VARCHAR(64) NULL'],
    ['note_url','VARCHAR(512) NULL'],
    ['desc','TEXT NULL'],
    ['note_type','INT NULL'],
    ['time','BIGINT NULL'],
    ['author_id','VARCHAR(64) NULL'],
    ['cover_url','VARCHAR(512) NULL'],
    ['created_at','DATETIME NULL'],
    ['updated_at','DATETIME NULL'],
  ];
  for (const [col, def] of notesCols){
    if (!(await existsColumn(pool, database, 'notes', col))){
      await addColumn(pool, 'notes', `\`${col}\` ${def}`);
    }
  }
  if (!(await existsIndex(pool, database, 'notes', 'uniq_note_id'))){
    await addUnique(pool, 'notes', 'uniq_note_id', ['note_id']);
  }
  if (!(await existsIndex(pool, database, 'notes', 'uniq_note_url'))){
    await addUnique(pool, 'notes', 'uniq_note_url', ['note_url']);
  }

  // requests_log compatibility
  const reqCols = [ ['page_count','INT NULL'], ['acc_count','INT NULL'], ['status','INT NULL'] ];
  for (const [col, def] of reqCols){
    if (!(await existsColumn(pool, database, 'requests_log', col))){
      await addColumn(pool, 'requests_log', `\`${col}\` ${def}`);
    }
  }

  // comment_fetch_log compatibility
  const cflCols = [ ['cursor','VARCHAR(256) NULL'], ['count','INT NULL'], ['ts','BIGINT NULL'] ];
  for (const [col, def] of cflCols){
    if (!(await existsColumn(pool, database, 'comment_fetch_log', col))){
      await addColumn(pool, 'comment_fetch_log', `\`${col}\` ${def}`);
    }
  }

  // AI tables
  await pool.query(`CREATE TABLE IF NOT EXISTS xhs_comment_replies (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    note_id VARCHAR(64) NOT NULL,
    comment_id VARCHAR(64) NOT NULL,
    comment_page_url TEXT NULL,
    raw_text TEXT NULL,
    cleaned_text TEXT NULL,
    ai_answer TEXT NULL,
    decision ENUM('send','cancel') NOT NULL,
    status ENUM('success','failed','skipped') NOT NULL,
    error_text TEXT NULL,
    http_status INT NULL,
    provider VARCHAR(32) NULL,
    bot_id VARCHAR(64) NULL,
    created_at DATETIME DEFAULT NOW(),
    updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
    INDEX idx_xcr_note_comment (note_id, comment_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS xhs_comment_reply_responses (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    reply_id BIGINT NOT NULL,
    resp_json JSON NULL,
    created_at DATETIME DEFAULT NOW(),
    INDEX idx_reply_resp (reply_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.end();
  console.log('migrated');
}

main().catch((e)=>{ console.error(e); process.exit(1); });

