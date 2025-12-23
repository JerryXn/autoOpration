require('dotenv').config();
const mysql = require('mysql2/promise');

async function main(){
  const host = process.env.MYSQL_HOST || '127.0.0.1';
  const port = process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT,10) : 3306;
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const database = process.env.MYSQL_DATABASE || 'auto_operation';
  const pool = await mysql.createPool({ host, port, user, password, database, waitForConnections: true, connectionLimit: 3 });
  async function ensureColumn(table, column, alterSql){
    const [rows] = await pool.query('SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=? LIMIT 1', [database, table, column]);
    if (rows && rows.length) return { ok:true, changed:false };
    await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN ${alterSql}`);
    return { ok:true, changed:true };
  }
  async function ensureTable(name, createSql){
    const [rows] = await pool.query('SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=? LIMIT 1', [database, name]);
    if (rows && rows.length) return { ok:true, created:false };
    await pool.query(createSql);
    return { ok:true, created:true };
  }
  const out = [];
  try{
    const r1 = await ensureColumn('sys_users', 'display_name', 'display_name VARCHAR(128) NULL AFTER `username`');
    out.push({ op:'add_column', table:'sys_users', column:'display_name', changed:r1.changed });
  }catch(e){ out.push({ op:'add_column', table:'sys_users', column:'display_name', error: e && e.message ? e.message : String(e) }); }
  try{
    const createActionLogs = `CREATE TABLE \`op_action_logs\` (\n  \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,\n  \`user_id\` BIGINT,\n  \`note_id\` VARCHAR(64),\n-  \`action\` ENUM('like','collect'),\n+  \`action\` ENUM('like','collect','comment'),\n   \`status\` ENUM('ok','skip','fail'),\n   \`error_msg\` VARCHAR(512),\n   \`page_url\` VARCHAR(2048),\n   \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n   INDEX \`idx_logs_note\` (\`note_id\`),\n   INDEX \`idx_logs_user_time\` (\`user_id\`, \`created_at\`)\n ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;
    const r2 = await ensureTable('op_action_logs', createActionLogs);
    out.push({ op:'create_table', table:'op_action_logs', created:r2.created });
  }catch(e){ out.push({ op:'create_table', table:'op_action_logs', error: e && e.message ? e.message : String(e) }); }
  // 升级 action 枚举，加入 comment
  try{
    const [cols] = await pool.query("SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='op_action_logs' AND COLUMN_NAME='action'", [database]);
    const typ = cols && cols[0] && cols[0].COLUMN_TYPE || '';
    if (/^enum\(/i.test(typ) && !/comment/.test(typ)){
      await pool.query("ALTER TABLE `op_action_logs` MODIFY COLUMN `action` ENUM('like','collect','comment')");
      out.push({ op:'alter_enum', table:'op_action_logs', column:'action', added:'comment' });
    }
  }catch(e){ out.push({ op:'alter_enum', table:'op_action_logs', column:'action', error: e && e.message ? e.message : String(e) }); }
  try{ console.log(JSON.stringify({ ok:true, host, port, database, results: out }, null, 2)); }catch{}
  await pool.end();
}

main().catch(err=>{ console.error(err && err.message ? err.message : err); process.exit(1); });
