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
  const exec = async(sql)=>{ try{ await pool.query(sql); console.log('[ok]', sql); } catch(e){ console.log('[skip]', e.code||e.sqlMessage||e.message); } };
  await exec('ALTER TABLE `notes` MODIFY `platform_id` BIGINT UNSIGNED NULL DEFAULT NULL');
  await exec('ALTER TABLE `requests_log` MODIFY `status` INT NULL');
  await pool.end();
  console.log('constraints migrated');
}

main().catch(e=>{ console.error(e); process.exit(1); });

