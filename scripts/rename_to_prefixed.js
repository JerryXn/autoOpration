require('dotenv').config();
const mysql = require('mysql2/promise');

async function existsTable(pool, schema, table){
  const [rows] = await pool.query('SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=? LIMIT 1', [schema, table]);
  return rows && rows.length > 0;
}

async function renameIfExists(pool, schema, oldName, newName){
  const hasOld = await existsTable(pool, schema, oldName);
  const hasNew = await existsTable(pool, schema, newName);
  if (!hasOld){
    console.log('[skip] missing', oldName);
    return;
  }
  if (hasNew){
    console.log('[skip] exists', newName);
    return;
  }
  const sql = `RENAME TABLE \`${oldName}\` TO \`${newName}\``;
  try{ await pool.query(sql); console.log('[ok]', sql); }catch(e){ console.log('[fail]', e.code||e.sqlMessage||e.message, sql); }
}

async function main(){
  const host = process.env.MYSQL_HOST || '127.0.0.1';
  const port = process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT,10) : 3306;
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const database = process.env.MYSQL_DATABASE || 'auto_final';
  const pool = await mysql.createPool({ host, port, user, password, database });
  console.log('[db]', database);
  const ops = [
    ['notes','op_notes'],
    ['interactions','op_interactions'],
    ['images','op_images'],
    ['tags','op_tags'],
    ['note_tags','op_note_tags'],
    ['comments','op_comments'],
    ['comment_interactions','op_comment_interactions'],
    ['comment_fetch_log','op_comment_fetch_log'],
    ['requests_log','op_requests_log'],
    ['xhs_comment_replies','op_comment_replies'],
    ['xhs_comment_reply_responses','op_comment_reply_responses'],
    ['xhs_users','op_users_xhs'],
    ['users','sys_users'],
    ['platforms','sys_platforms'],
    ['platform_features','sys_platform_features'],
    ['user_platforms','sys_user_platforms'],
    ['user_feature_grants','sys_user_feature_grants'],
    ['features','sys_features'],
    ['creators','sys_creators']
  ];
  for (const [oldName,newName] of ops){ await renameIfExists(pool, database, oldName, newName); }
  await pool.end();
  console.log('rename done');
}

main().catch((e)=>{ console.error(e); process.exit(1); });
