const test = require('node:test');
const assert = require('node:assert');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function createPool() {
  const host = process.env.MYSQL_HOST || '127.0.0.1';
  const port = process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT, 10) : 3306;
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const database = process.env.MYSQL_DATABASE || 'auto_operation';
  return mysql.createPool({ host, port, user, password, database, waitForConnections: true, connectionLimit: 1 });
}

async function upsertUser(pool, username, plainPassword, expiresAt) {
  const hash = await bcrypt.hash(plainPassword, 10);
  try {
    await pool.query('ALTER TABLE users ADD COLUMN expires_at TIMESTAMP NULL');
  } catch (e) {
    if (!e || e.code !== 'ER_DUP_FIELDNAME') throw e;
  }
  await pool.query(
    'INSERT INTO users (username, password_hash, expires_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), expires_at = VALUES(expires_at)',
    [username, hash, expiresAt]
  );
}

test('can connect and select 1', async () => {
  const pool = await createPool();
  try {
    const [rows] = await pool.query('SELECT 1 AS v');
    assert.ok(rows && rows[0] && rows[0].v === 1);
  } finally {
    await pool.end();
  }
});

test('users table exists', async () => {
  const pool = await createPool();
  try {
    const [rows] = await pool.query("SHOW TABLES LIKE 'users'");
    assert.ok(rows && rows.length > 0);
  } finally {
    await pool.end();
  }
});

test('admin credentials valid', async () => {
  const pool = await createPool();
  try {
    const [rows] = await pool.query('SELECT password_hash FROM users WHERE username = ?', ['admin']);
    assert.ok(rows && rows.length > 0);
    const hash = rows[0].password_hash;
    const ok = await bcrypt.compare('admin123', hash);
    assert.ok(ok);
  } finally {
    await pool.end();
  }
});

test('insert user with future expiry and validate', async () => {
  const pool = await createPool();
  try {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await upsertUser(pool, 'unittest_future', 'p@ss', future);
    const [rows] = await pool.query('SELECT password_hash, expires_at FROM users WHERE username = ?', ['unittest_future']);
    assert.ok(rows && rows.length > 0);
    const ok = await bcrypt.compare('p@ss', rows[0].password_hash);
    assert.ok(ok);
    assert.ok(new Date(rows[0].expires_at).getTime() > Date.now());
  } finally {
    await pool.end();
  }
});

test('insert user with past expiry and detect expired', async () => {
  const pool = await createPool();
  try {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await upsertUser(pool, 'unittest_expired', 'p@ss', past);
    const [rows] = await pool.query('SELECT password_hash, expires_at FROM users WHERE username = ?', ['unittest_expired']);
    assert.ok(rows && rows.length > 0);
    const ok = await bcrypt.compare('p@ss', rows[0].password_hash);
    assert.ok(ok);
    assert.ok(new Date(rows[0].expires_at).getTime() < Date.now());
  } finally {
    await pool.end();
  }
});

test('authorization: admin platforms and features', async () => {
  const pool = await createPool();
  try {
    await pool.query('DROP TABLE IF EXISTS user_feature_grants');
    await pool.query('DROP TABLE IF EXISTS platform_features');
    await pool.query('CREATE TABLE IF NOT EXISTS platforms (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, code VARCHAR(32) NOT NULL UNIQUE, name VARCHAR(64) NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id))');
    await pool.query('CREATE TABLE IF NOT EXISTS features (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, code VARCHAR(32) NOT NULL UNIQUE, name VARCHAR(64) NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id))');
    await pool.query('CREATE TABLE IF NOT EXISTS user_platforms (user_id BIGINT UNSIGNED NOT NULL, platform_id BIGINT UNSIGNED NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, platform_id))');
    await pool.query('CREATE TABLE IF NOT EXISTS platform_features (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, platform_id BIGINT UNSIGNED NOT NULL, feature_id BIGINT UNSIGNED NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id), UNIQUE KEY uniq_platform_feature (platform_id, feature_id))');
    await pool.query('CREATE TABLE IF NOT EXISTS user_feature_grants (user_id BIGINT UNSIGNED NOT NULL, platform_feature_id BIGINT UNSIGNED NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, platform_feature_id))');
    await pool.query("INSERT INTO platforms (code, name) VALUES ('xhs','小红书'),('douyin','抖音'),('mp','公众号') ON DUPLICATE KEY UPDATE name=VALUES(name)");
    await pool.query("INSERT INTO features (code, name) VALUES ('publish','发布'),('auto_operation','自动运营') ON DUPLICATE KEY UPDATE name=VALUES(name)");
    const [[admin]] = await pool.query('SELECT id FROM users WHERE username = ?', ['admin']);
    assert.ok(admin && admin.id);
    const [[xhs]] = await pool.query('SELECT id FROM platforms WHERE code = ?', ['xhs']);
    const [[douyin]] = await pool.query('SELECT id FROM platforms WHERE code = ?', ['douyin']);
    await pool.query('INSERT INTO user_platforms (user_id, platform_id) VALUES (?, ?), (?, ?) ON DUPLICATE KEY UPDATE platform_id = VALUES(platform_id)', [admin.id, xhs.id, admin.id, douyin.id]);
    const [[publish]] = await pool.query('SELECT id FROM features WHERE code = ?', ['publish']);
    const [[autoop]] = await pool.query('SELECT id FROM features WHERE code = ?', ['auto_operation']);
    // ensure platform_features rows
    await pool.query('INSERT INTO platform_features (platform_id, feature_id) VALUES (?, ?), (?, ?) ON DUPLICATE KEY UPDATE feature_id = VALUES(feature_id)', [xhs.id, publish.id, xhs.id, autoop.id]);
    const [[pf_pub]] = await pool.query('SELECT id FROM platform_features WHERE platform_id = ? AND feature_id = ?', [xhs.id, publish.id]);
    const [[pf_auto]] = await pool.query('SELECT id FROM platform_features WHERE platform_id = ? AND feature_id = ?', [xhs.id, autoop.id]);
    await pool.query('INSERT INTO user_feature_grants (user_id, platform_feature_id) VALUES (?, ?), (?, ?) ON DUPLICATE KEY UPDATE platform_feature_id = VALUES(platform_feature_id)', [admin.id, pf_pub.id, admin.id, pf_auto.id]);
    const [platRows] = await pool.query(
      'SELECT p.code FROM user_platforms up JOIN platforms p ON p.id = up.platform_id WHERE up.user_id = ? ORDER BY p.code',
      [admin.id]
    );
    const codes = platRows.map(r => r.code);
    assert.deepStrictEqual(codes, ['douyin','xhs']);
    const [featRows] = await pool.query(
      'SELECT f.code FROM user_feature_grants g JOIN platform_features pf ON pf.id = g.platform_feature_id JOIN features f ON f.id = pf.feature_id WHERE g.user_id = ? AND pf.platform_id = ? ORDER BY f.code',
      [admin.id, xhs.id]
    );
    const fcodes = featRows.map(r => r.code);
    assert.deepStrictEqual(fcodes, ['auto_operation','publish']);
  } finally {
    await pool.end();
  }
});

