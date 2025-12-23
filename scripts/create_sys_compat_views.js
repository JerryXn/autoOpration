require('dotenv').config();
const mysql = require('mysql2/promise');

async function existsObject(pool, schema, name){
  const [rows] = await pool.query('SELECT TABLE_NAME, TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=? LIMIT 1', [schema, name]);
  return rows && rows.length > 0 ? rows[0] : null;
}

async function createView(pool, name, target){
  const obj = await existsObject(pool, process.env.MYSQL_DATABASE || pool.config.database || pool.config.connectionConfig?.database, name);
  if (obj){
    console.log('[skip]', name, obj.TABLE_TYPE);
    return;
  }
  const sql = `CREATE VIEW \`${name}\` AS SELECT * FROM \`${target}\``;
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
  const maps = [
    ['platforms','sys_platforms'],
    ['platform_features','sys_platform_features'],
    ['user_platforms','sys_user_platforms'],
    ['user_feature_grants','sys_user_feature_grants'],
    ['features','sys_features'],
    ['creators','sys_creators'],
  ];
  for (const [oldName,newName] of maps){ await createView(pool, oldName, newName); }
  await pool.end();
  console.log('views created');
}

main().catch((e)=>{ console.error(e); process.exit(1); });
