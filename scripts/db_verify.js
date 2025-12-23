require('dotenv').config();
const mysql = require('mysql2/promise');

async function existsTable(pool, schema, table){
  const [rows] = await pool.query('SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=? LIMIT 1', [schema, table]);
  return rows && rows.length > 0;
}

async function getColumns(pool, schema, table){
  const [rows] = await pool.query('SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=?', [schema, table]);
  return rows || [];
}

async function getIndexes(pool, schema, table){
  const [rows] = await pool.query('SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? ORDER BY INDEX_NAME, SEQ_IN_INDEX', [schema, table]);
  return rows || [];
}

async function countRows(pool, table){
  try{ const [rows] = await pool.query(`SELECT COUNT(*) AS c FROM \`${table}\``); return rows[0]?.c || 0; }catch{ return null; }
}

async function main(){
  const host = process.env.MYSQL_HOST || '127.0.0.1';
  const port = process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT,10) : 3306;
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const database = process.env.MYSQL_DATABASE || 'auto_final';
  const pool = await mysql.createPool({ host, port, user, password, database });
  const [dbRow] = await pool.query('SELECT DATABASE() AS db');
  console.log('[db]', dbRow[0].db);

  const tables = ['op_notes','op_requests_log','op_comment_fetch_log','op_comment_replies','op_comment_reply_responses'];
  for (const t of tables){
    const ex = await existsTable(pool, database, t);
    console.log(`[table] ${t} exists=${ex}`);
    if (!ex) continue;
    const cnt = await countRows(pool, t);
    console.log(`[count] ${t} = ${cnt}`);
    const cols = await getColumns(pool, database, t);
    if (t==='op_notes'){
      const plat = cols.find(c=>c.COLUMN_NAME==='platform_id');
      console.log('[notes.platform_id]', plat ? { nullable: plat.IS_NULLABLE, default: plat.COLUMN_DEFAULT } : 'missing');
      const noteId = cols.find(c=>c.COLUMN_NAME==='note_id');
      const noteUrl = cols.find(c=>c.COLUMN_NAME==='note_url');
      console.log('[notes.columns] note_id exists=', !!noteId, 'note_url exists=', !!noteUrl);
      const idx = await getIndexes(pool, database, 'notes');
      const uniqNoteId = idx.find(i=>i.INDEX_NAME==='uniq_note_id');
      const uniqNoteUrl = idx.find(i=>i.INDEX_NAME==='uniq_note_url');
      console.log('[notes.index] uniq_note_id=', !!uniqNoteId, 'uniq_note_url=', !!uniqNoteUrl);
    }
    if (t==='op_requests_log'){
    const statusCol = cols.find(c=>c.COLUMN_NAME==='status');
    console.log('[requests_log.status]', statusCol ? { data_type: statusCol.DATA_TYPE } : 'missing');
    const tsCol = cols.find(c=>c.COLUMN_NAME==='ts');
    console.log('[requests_log.ts]', tsCol ? { data_type: tsCol.DATA_TYPE } : 'missing');
    const pc = cols.find(c=>c.COLUMN_NAME==='page_count');
    const ac = cols.find(c=>c.COLUMN_NAME==='acc_count');
    console.log('[requests_log.columns] page_count=', !!pc, 'acc_count=', !!ac);
  }
    if (t==='op_comment_fetch_log'){
      const cursor = cols.find(c=>c.COLUMN_NAME==='cursor');
      const count = cols.find(c=>c.COLUMN_NAME==='count');
      const ts = cols.find(c=>c.COLUMN_NAME==='ts');
      console.log('[comment_fetch_log.columns] cursor=', !!cursor, 'count=', !!count, 'ts=', !!ts);
    }
  }
  await pool.end();
}

main().catch((e)=>{ console.error(e); process.exit(1); });
