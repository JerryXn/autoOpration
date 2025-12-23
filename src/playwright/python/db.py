import os
import pymysql
from dbutils.pooled_db import PooledDB
import traceback
import json

# Global connection pool
_pool = None

def init_pool():
    global _pool
    if _pool is None:
        try:
            _pool = PooledDB(
                creator=pymysql,
                mincached=2,
                maxcached=5,
                maxshared=3,
                maxconnections=10,
                blocking=True,
                host=os.environ.get("MYSQL_HOST", "127.0.0.1"),
                port=int(os.environ.get("MYSQL_PORT", 3306)),
                user=os.environ.get("MYSQL_USER", "root"),
                password=os.environ.get("MYSQL_PASSWORD", ""),
                database=os.environ.get("MYSQL_DATABASE", "auto_operation"),
                charset='utf8mb4',
                cursorclass=pymysql.cursors.DictCursor
            )
            print("[db] Connection pool initialized.")
        except Exception as e:
            print(f"[db] Failed to init pool: {e}")
            _pool = None

def get_connection():
    global _pool
    if _pool is None:
        init_pool()
    return _pool.connection()

def get_bot_config(industry='insurance', platform='coze'):
    """
    Fetch bot config (bot_id, token, etc.) for a given industry.
    """
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            # First try exact industry match
            sql = "SELECT * FROM sys_bot_configs WHERE industry=%s AND is_active=1 LIMIT 1"
            cursor.execute(sql, (industry,))
            row = cursor.fetchone()
            
            if not row:
                print(f"[db] No bot config found for industry='{industry}'")
                return None
            
            return row
    except Exception as e:
        print(f"[db] Error getting bot config: {e}")
        return None
    finally:
        conn.close()

def save_note(note_data):
    """
    Save or update XHS note.
    note_data: {
        'note_id': str,
        'user_id': str,
        'title': str,
        'desc': str,
        'type': str,
        'liked_count': int,
        'collected_count': int,
        'comment_count': int,
        'share_count': int,
        'note_url': str,
        'cover_url': str,
        'industry': str
    }
    """
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            # Upsert (Insert or Update)
            sql = """
            INSERT INTO xhs_notes (
                note_id, user_id, title, `desc`, `type`, 
                liked_count, collected_count, comment_count, share_count, 
                note_url, cover_url, industry, last_visited_at
            ) VALUES (
                %(note_id)s, %(user_id)s, %(title)s, %(desc)s, %(type)s,
                %(liked_count)s, %(collected_count)s, %(comment_count)s, %(share_count)s,
                %(note_url)s, %(cover_url)s, %(industry)s, NOW()
            ) ON DUPLICATE KEY UPDATE
                user_id = VALUES(user_id),
                title = VALUES(title),
                `desc` = VALUES(`desc`),
                liked_count = VALUES(liked_count),
                collected_count = VALUES(collected_count),
                comment_count = VALUES(comment_count),
                last_visited_at = NOW();
            """
            cursor.execute(sql, note_data)
        conn.commit()
        print(f"[db] Saved note {note_data.get('note_id')}")
    except Exception as e:
        print(f"[db] Error saving note: {e}")
        traceback.print_exc()
    finally:
        conn.close()

def save_user(user_data):
    """
    Save or update XHS user.
    user_data: { 'user_id': str, 'nickname': str, 'avatar': str }
    """
    if not user_data.get('user_id'):
        return

    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            sql = """
            INSERT INTO xhs_users (user_id, nickname, avatar, created_at, updated_at)
            VALUES (%(user_id)s, %(nickname)s, %(avatar)s, NOW(), NOW())
            ON DUPLICATE KEY UPDATE
                nickname = VALUES(nickname),
                avatar = VALUES(avatar),
                updated_at = NOW()
            """
            cursor.execute(sql, user_data)
        conn.commit()
    except Exception as e:
        print(f"[db] Error saving user: {e}")
    finally:
        conn.close()

def save_ai_log(log_data):
    """
    Save AI interaction log.
    log_data: {
        'note_id': str,
        'bot_id': str,
        'input_context': str,
        'prompt_used': str,
        'ai_response': str,
        'status': str,
        'error_msg': str
    }
    """
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            sql = """
            INSERT INTO ai_interaction_logs (
                note_id, bot_id, input_context, prompt_used, ai_response, status, error_msg, created_at
            ) VALUES (
                %(note_id)s, %(bot_id)s, %(input_context)s, %(prompt_used)s, %(ai_response)s, %(status)s, %(error_msg)s, NOW()
            )
            """
            cursor.execute(sql, log_data)
        conn.commit()
        print(f"[db] Saved AI log for note {log_data.get('note_id')}")
    except Exception as e:
        print(f"[db] Error saving AI log: {e}")
    finally:
        conn.close()

def save_comments(note_id, comments_list):
    """
    Save scraped comments to xhs_comments.
    comments_list: list of dicts from comment_actions
    """
    if not comments_list:
        return
        
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            sql = """
            INSERT INTO xhs_comments (comment_id, note_id, user_id, content, like_count, created_at)
            VALUES (%(id)s, %(note_id)s, %(user_id)s, %(content)s, %(likes)s, NOW())
            ON DUPLICATE KEY UPDATE
                like_count = VALUES(like_count),
                content = VALUES(content)
            """
            
            # Prepare data
            data_to_insert = []
            for c in comments_list:
                # Handle '1.2万' in likes
                likes = 0
                try:
                    l_str = str(c.get('likes', '0'))
                    if '万' in l_str:
                        likes = int(float(l_str.replace('万', '')) * 10000)
                    else:
                        likes = int(l_str)
                except:
                    pass
                    
                data_to_insert.append({
                    'id': c.get('id'),
                    'note_id': note_id,
                    'user_id': c.get('author'), # Using author name as user_id for now if id is not available or to display
                    'content': c.get('content'),
                    'likes': likes
                })
                
            cursor.executemany(sql, data_to_insert)
        conn.commit()
        print(f"[db] Saved {len(data_to_insert)} comments for note {note_id}")
    except Exception as e:
        print(f"[db] Error saving comments: {e}")
    finally:
        conn.close()


