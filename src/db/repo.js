const mysql = require('mysql2/promise');

let _pool = null;
async function getPool(){
  if (_pool) return _pool;
  const host = process.env.MYSQL_HOST || '127.0.0.1';
  const port = process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT,10) : 3306;
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const database = process.env.MYSQL_DATABASE || 'auto_operation';
  _pool = await mysql.createPool({ host, port, user, password, database, waitForConnections: true, connectionLimit: 5 });
  return _pool;
}

async function upsertPlatform(code, name){
  const pool = await getPool();
  await pool.query('INSERT INTO platforms (code, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name)', [code, name]);
}

async function upsertCreator(platformCode, externalId, name, profileUrl, avatarUrl, extra){
  const pool = await getPool();
  const [[plat]] = await pool.query('SELECT id FROM platforms WHERE code=?', [platformCode]);
  if (!plat) return;
  await pool.query(
    'INSERT INTO creators (platform_id, external_id, name, profile_url, avatar_url, extra) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), profile_url=VALUES(profile_url), avatar_url=VALUES(avatar_url), extra=VALUES(extra)',
    [plat.id, externalId, name || null, profileUrl || null, avatarUrl || null, extra || null]
  );
}

async function upsertNote(platformCode, notePlatformId, url, title, authorExternalId, fields){
  const pool = await getPool();
  const [[plat]] = await pool.query('SELECT id FROM platforms WHERE code=?', [platformCode]);
  if (!plat) return;
  const [[creator]] = await pool.query('SELECT id FROM creators WHERE platform_id=? AND external_id=?', [plat.id, authorExternalId]);
  const authorId = creator ? creator.id : null;
  const {
    description=null, noteType='image_text', noteTime=null, coverUrl=null, cardType=null, modelType=null,
    nickname=null, avatar=null, likedCount=null, collectedCount=null, commentCount=null, shareCount=null,
    isLiked=0, isCollected=0, xsecToken=null, rawJson=null, isRestricted=0, publishedAt=null, extra=null
  } = fields || {};
  await pool.query(
    'INSERT INTO notes (platform_id, note_platform_id, url, title, description, note_type, note_time, author_id, cover_url, card_type, model_type, nickname, avatar, liked_count, collected_count, comment_count, share_count, is_liked, is_collected, xsec_token, raw_json, is_restricted, published_at, extra) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE url=VALUES(url), title=VALUES(title), description=VALUES(description), note_type=VALUES(note_type), note_time=VALUES(note_time), author_id=VALUES(author_id), cover_url=VALUES(cover_url), card_type=VALUES(card_type), model_type=VALUES(model_type), nickname=VALUES(nickname), avatar=VALUES(avatar), liked_count=VALUES(liked_count), collected_count=VALUES(collected_count), comment_count=VALUES(comment_count), share_count=VALUES(share_count), is_liked=VALUES(is_liked), is_collected=VALUES(is_collected), xsec_token=VALUES(xsec_token), raw_json=VALUES(raw_json), is_restricted=VALUES(is_restricted), published_at=VALUES(published_at), updated_at=CURRENT_TIMESTAMP, extra=VALUES(extra)'
    , [plat.id, notePlatformId, url||null, title||null, description||null, noteType||'image_text', noteTime||null, authorId, coverUrl||null, cardType||null, modelType||null, nickname||null, avatar||null, likedCount, collectedCount, commentCount, shareCount, isLiked?1:0, isCollected?1:0, xsecToken||null, rawJson||null, isRestricted?1:0, publishedAt||null, extra||null]
  );
}

async function upsertImage(notePlatformId, order, url, meta){
  const pool = await getPool();
  const [[note]] = await pool.query('SELECT id FROM notes WHERE note_platform_id=?', [notePlatformId]);
  if (!note) return;
  await pool.query('INSERT INTO images (note_id, url, meta_json) VALUES (?, ?, ?)', [note.id, url||null, meta||null]);
}

async function insertBrowseSession(platformCode, entryUrl, keyword){
  const pool = await getPool();
  const [[plat]] = await pool.query('SELECT id FROM platforms WHERE code=?', [platformCode]);
  if (!plat) return null;
  const [res] = await pool.query('INSERT INTO browse_sessions (platform_id, entry_url, keyword, device_fingerprint, extra) VALUES (?, ?, ?, ?, ?)', [plat.id, entryUrl||null, keyword||null, null, null]);
  return res && res.insertId ? res.insertId : null;
}

async function insertNoteVisit(sessionId, notePlatformId, restricted){
  const pool = await getPool();
  const [[note]] = await pool.query('SELECT id FROM notes WHERE note_platform_id=?', [notePlatformId]);
  if (!note) return;
  await pool.query('INSERT INTO note_visits (session_id, note_id, restricted, extra) VALUES (?, ?, ?, ?)', [sessionId, note.id, restricted?1:0, null]);
}

async function logRequest({ keyword, page, pageSize, status, pageTotal, accTotal, hasMore, textHead, errorMsg }){
  const pool = await getPool();
  await pool.query(
    'INSERT INTO requests_log (keyword, page, page_size, status, page_total, acc_total, has_more, text_head, error_msg) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    , [keyword||'', page||1, pageSize||20, status||'ok', pageTotal||null, accTotal||null, hasMore?1:0, textHead||null, errorMsg||null]
  );
}

module.exports = {
  getPool,
  upsertPlatform,
  upsertCreator,
  upsertNote,
  upsertImage,
  insertBrowseSession,
  insertNoteVisit,
  logRequest,
};
