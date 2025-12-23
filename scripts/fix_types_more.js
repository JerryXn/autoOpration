require('dotenv').config();
const mysql = require('mysql2/promise');

async function alter(pool, sql){
  try{ await pool.query(sql); console.log('[ok]', sql); } catch(e){ console.log('[fail]', e.code||e.sqlMessage||e.message, sql); }
}

async function main(){
  const host = process.env.MYSQL_HOST || '127.0.0.1';
  const port = process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT,10) : 3306;
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const database = process.env.MYSQL_DATABASE || 'auto_final';
  const pool = await mysql.createPool({ host, port, user, password, database });
  console.log('[db]', database);
  await alter(pool, 'ALTER TABLE `notes` MODIFY `author_id` VARCHAR(64) NULL');
  await alter(pool, 'ALTER TABLE `images` MODIFY `note_id` VARCHAR(64) NOT NULL');
  await alter(pool, 'ALTER TABLE `note_tags` MODIFY `note_id` VARCHAR(64) NOT NULL');
  await alter(pool, 'ALTER TABLE `interactions` MODIFY `note_id` VARCHAR(64) NOT NULL');
  await alter(pool, 'ALTER TABLE `xhs_comment_replies` MODIFY `note_id` VARCHAR(64) NOT NULL');
  await pool.end();
  console.log('done');
}

main().catch((e)=>{ console.error(e); process.exit(1); });

