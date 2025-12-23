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
  // Normalize existing values: set non-numeric to 0
  await pool.query("UPDATE `requests_log` SET `status`='0' WHERE `status` IS NULL OR `status` REGEXP '^[^0-9]' OR `status` REGEXP '[A-Za-z]'");
  try{
    await pool.query('ALTER TABLE `requests_log` MODIFY `status` INT NULL');
    console.log('[ok] status column converted to INT');
  }catch(e){
    console.log('[fail]', e.code||e.sqlMessage||e.message);
  }
  await pool.end();
}

main().catch((e)=>{ console.error(e); process.exit(1); });

