require('dotenv').config();
const mysql = require('mysql2/promise');

async function existsColumn(pool, schema, table, column){
  const [rows] = await pool.query('SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=? LIMIT 1', [schema, table, column]);
  return rows && rows.length > 0;
}

async function main(){
  const host = process.env.MYSQL_HOST || '127.0.0.1';
  const port = process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT,10) : 3306;
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const database = process.env.MYSQL_DATABASE || 'auto_final';
  const pool = await mysql.createPool({ host, port, user, password, database });
  console.log('[db]', database);
  // ensure comments.user_id exists
  if (!(await existsColumn(pool, database, 'comments', 'user_id'))){
    await pool.query('ALTER TABLE `comments` ADD COLUMN `user_id` VARCHAR(64) NULL');
    console.log('[ok] add comments.user_id');
  } else {
    console.log('[skip] comments.user_id exists');
  }
  // ensure comment_fetch_log columns exist (already), no change needed for names since SQL uses backticks
  await pool.end();
}

main().catch((e)=>{ console.error(e); process.exit(1); });

