from urllib.parse import urlparse, parse_qs
import os
from pathlib import Path
import random
import time

def normalize_href(href: str) -> str:
    if not href:
        return ""
    if href.startswith("http"):
        base = ""
    else:
        base = "https://www.xiaohongshu.com"
    if "/search_result/" in href:
        u = urlparse(href)
        q = parse_qs(u.query)
        nid = href.split("/search_result/")[1].split("?")[0]
        token = (q.get("xsec_token") or [""])[0]
        return f"{base}/explore/{nid}?xsec_token={token}&xsec_source=pc_search"
    return f"{base}{href}"

# 详情页面处理
def open_and_act(context, href: str, actions: dict = None, industry: str = None):
    if actions is None:
        actions = {}
    
    # 随机间隔时间配置
    # 可以在这里调整 min_sleep 和 max_sleep
    min_sleep = 2.0
    max_sleep = 5.0
    
    if actions.get('delay_range'):
        try:
            parts = str(actions['delay_range']).split('-')
            if len(parts) == 2:
                min_sleep = float(parts[0]) / 1000.0
                max_sleep = float(parts[1]) / 1000.0
        except:
            pass
    
    wait_time = random.uniform(min_sleep, max_sleep)
    print(f"[py] Waiting {wait_time:.2f}s before processing details...", flush=True)
    time.sleep(wait_time)
    
    url = normalize_href(href)
    if not url:
        return
    page = context.new_page()
    print(f"[py] 进入详情页面 {url}", flush=True)
    
    # Performance Optimization: Block unnecessary resources
    # This speeds up loading significantly
    try:
        page.route("**/*.{png,jpg,jpeg,gif,webp,svg,css,woff,woff2}", lambda route: route.abort())
    except:
        pass
    
    try:
        # Use domcontentloaded instead of load to speed up and avoid timeout on slow resources
        page.goto(url, timeout=30000, wait_until='domcontentloaded')
    except Exception as e:
        print(f"[py] Page load timeout or error: {e}", flush=True)
        # Try to close page if load failed completely
        try:
            page.close()
        except:
            pass
        return
        
    # Simulated Browse Time (Wait before any actions)
    browse_min = 5.0
    browse_max = 10.0
    if actions.get('browse_time'):
        try:
            parts = str(actions['browse_time']).split('-')
            if len(parts) == 2:
                browse_min = float(parts[0]) / 1000.0
                browse_max = float(parts[1]) / 1000.0
        except:
            pass
    
    browse_wait = random.uniform(browse_min, browse_max)
    print(f"[py] Simulating browse for {browse_wait:.2f}s...", flush=True)
    time.sleep(browse_wait)
    
    try:
        from db import save_note, save_user
        
        # Extract Note ID
        if '/explore/' in url:
            nid = url.split('/explore/')[1].split('?')[0]
        else:
            nid = ''
            
        if nid and actions.get('record'):
            # 1. Extract Note Info
            try:
                page.wait_for_selector('div.note-content', timeout=5000)
                
                # Title
                title = page.locator('#detail-title').text_content() or ""
                
                # Desc
                desc = page.locator('#detail-desc').text_content() or ""
                
                # User info
                user_link = page.locator('div.author-container a.name')
                user_href = user_link.get_attribute('href') or ""
                # Ensure user_id is not too long (take last part, usually 24 chars, but safe limit 128)
                raw_user_id = user_href.split('/')[-1] if user_href else ""
                user_id = raw_user_id[:128] 
                
                nickname = user_link.text_content() or ""
                avatar = page.locator('div.author-container img.avatar-item').get_attribute('src') or ""
                
                # Stats (Like, Collect, Comment)
                # These selectors depend on XHS layout which changes often.
                # Try to get them safely.
                
                def get_count(selector):
                    try:
                        txt = page.locator(selector).text_content()
                        if not txt or txt == '点赞' or txt == '收藏' or txt == '评论':
                            return 0
                        # Handle '1.2万' etc
                        if '万' in txt:
                            return int(float(txt.replace('万', '')) * 10000)
                        return int(txt)
                    except:
                        return 0

                liked_count = get_count('span.like-wrapper span.count')
                collected_count = get_count('span.collect-wrapper span.count')
                comment_count = get_count('span.chat-wrapper span.count')
                
                # Note Type (Video or Image)
                # Check if video element exists
                note_type = 'video' if page.locator('video').count() > 0 else 'image_text'
                
                # Save User
                if user_id:
                    save_user({
                        'user_id': user_id,
                        'nickname': nickname.strip(),
                        'avatar': avatar
                    })
                
                # Save Note
                save_note({
                    'note_id': nid,
                    'user_id': user_id,
                    'title': title.strip(),
                    'desc': desc.strip(),
                    'type': note_type,
                    'liked_count': liked_count,
                    'collected_count': collected_count,
                    'comment_count': comment_count,
                    'share_count': 0, # Hard to get share count sometimes
                    'note_url': url,
                    'cover_url': "", # Can extract if needed
                    'industry': industry
                })
                
            except Exception as e:
                print(f"[py] Failed to extract/save note info: {e}")
                import traceback
                traceback.print_exc()

    except Exception as e:
        print(f"[py] DB save failed: {e}")
        nid = ''

    # 浏览（默认行为，无需判断）
    
    # 点赞
    if actions.get('like'):
        should_like = True
        if actions.get('like_prob') is not None:
             prob = float(actions.get('like_prob'))
             if random.random() * 100 > prob:
                 should_like = False
                 print(f"[py] Skip Like due to probability {prob}%", flush=True)
        
        if should_like:
            try:
                # Try scroll to like
                like_selector = '#noteContainer span.like-wrapper.like-active > span.like-lottie'
                # Or simplified selector
                like_btn = page.locator('.interact-container .like-wrapper')
                if like_btn.count() > 0:
                    like_btn.first.scroll_into_view_if_needed()
                    like_btn.first.click()
                    print(f"[py] Clicked Like on {nid}", flush=True)
                else:
                     print(f"[py] Like button not found", flush=True)
            except Exception as e:
                 print(f"[py] Like failed: {e}", flush=True)
            time.sleep(random.uniform(0.5, 2))

    # 收藏
    if actions.get('fav'):
        should_fav = True
        if actions.get('fav_prob') is not None:
             prob = float(actions.get('fav_prob'))
             if random.random() * 100 > prob:
                 should_fav = False
                 print(f"[py] Skip Fav due to probability {prob}%", flush=True)

        if should_fav:
            try:
                collect_btn = page.locator('.interact-container .collect-wrapper')
                if collect_btn.count() > 0:
                    collect_btn.first.scroll_into_view_if_needed()
                    collect_btn.first.click()
                    print(f"[py] Clicked Collect on {nid}", flush=True)
                else:
                    print(f"[py] Collect button not found", flush=True)
            except Exception as e:
                print(f"[py] Collect failed: {e}", flush=True)
            time.sleep(random.uniform(0.5, 2))

    # 评论
    if actions.get('comment'):
        should_comment = True
        if actions.get('comment_prob') is not None:
             prob = float(actions.get('comment_prob'))
             if random.random() * 100 > prob:
                 should_comment = False
                 print(f"[py] Skip Comment due to probability {prob}%", flush=True)

        if should_comment:
            try:
                from comment_actions import handle_all_comments
                # Pass note_id to comment handler for logging
                handle_all_comments(page, note_id=nid)
            except Exception as e:
                print(f"[py] Comment action failed: {e}", flush=True)
                pass
    
    try:
        page.close()
    except Exception:
        pass
