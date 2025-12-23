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
  try{
    await pool.query('ALTER TABLE `requests_log` MODIFY `ts` BIGINT NULL');
    console.log('[ok] requests_log.ts converted to BIGINT');
  }catch(e){
    console.log('[fail]', e.code||e.sqlMessage||e.message);
  }
  await pool.end();
}

main().catch((e)=>{ console.error(e); process.exit(1); });

