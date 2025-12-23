require('dotenv').config();
const mysql = require('mysql2/promise');

async function main(){
  const host = process.env.MYSQL_HOST || '127.0.0.1';
  const port = process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT,10) : 3306;
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const database = process.env.MYSQL_DATABASE || 'auto_final';
  const pool = await mysql.createPool({ host, port, user, password, database, multipleStatements: true });
  let pid = 0;
  try{
    const [rows] = await pool.query('SELECT id FROM sys_platforms WHERE code=? LIMIT 1', ['xhs']);
    pid = rows && rows[0] && rows[0].id ? parseInt(rows[0].id,10) : 0;
  }catch{
    try{
      const [rows] = await pool.query('SELECT id FROM platforms WHERE code=? LIMIT 1', ['xhs']);
      pid = rows && rows[0] && rows[0].id ? parseInt(rows[0].id,10) : 0;
    }catch{}
  }
  const platId = pid || null;
  const sqls = [
    platId ? `UPDATE op_notes SET platform_id=${platId} WHERE platform_id IS NULL` : null,
    `UPDATE op_notes SET note_platform_id=note_id WHERE (note_platform_id IS NULL OR note_platform_id='') AND note_id IS NOT NULL AND note_id<>''`,
    `UPDATE op_notes SET url=note_url WHERE (url IS NULL OR url='') AND note_url IS NOT NULL AND note_url<>''`,
    `UPDATE op_notes SET url=CONCAT('https://www.xiaohongshu.com/explore/', note_id) WHERE (url IS NULL OR url='') AND (note_url IS NULL OR note_url='') AND note_id IS NOT NULL AND note_id<>''`,
  ].filter(Boolean);
  for (const s of sqls){
    try{ const [r] = await pool.query(s); console.log('[ok]', s, 'affected=', r && r.affectedRows); }catch(e){ console.log('[err]', e.code||e.sqlMessage||e.message, s); }
  }
  await pool.end();
}

main().catch((e)=>{ console.error(e); process.exit(1); });

