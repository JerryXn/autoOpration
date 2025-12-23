require('dotenv').config();
const mysql = require('mysql2/promise');

async function main(){
  const host = process.env.MYSQL_HOST || '127.0.0.1';
  const port = process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT,10) : 3306;
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const database = process.env.MYSQL_DATABASE || 'auto_final';
  const pool = await mysql.createPool({ host, port, user, password, database });
  console.log('[db]', database);
  const tables = ['comments', 'xhs_comment_replies', 'comment_fetch_log'];
  for (const t of tables){
    try{
      const [rows] = await pool.query('SHOW CREATE TABLE `'+t+'`');
      console.log('CREATE TABLE '+t+':');
      console.log(rows[0]['Create Table']);
    }catch(e){
      console.log('[err] show create', t, e.message);
    }
    try{
      const [rows] = await pool.query('SELECT COLUMN_NAME,DATA_TYPE,CHARACTER_MAXIMUM_LENGTH,IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=?', [database, t]);
      console.log('COLUMNS '+t+':');
      for (const r of rows){
        console.log(r.COLUMN_NAME, r.DATA_TYPE, r.CHARACTER_MAXIMUM_LENGTH, r.IS_NULLABLE);
      }
    }catch(e){
      console.log('[err] columns', t, e.message);
    }
  }
  await pool.end();
}

main().catch((e)=>{ console.error(e); process.exit(1); });

