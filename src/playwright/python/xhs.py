import os
import time
import random
import argparse
from pathlib import Path
import sys
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import Playwright, sync_playwright, expect


def run(playwright: Playwright, keyword: str = "保险", actions: dict = None, time_range: int = 0, sort_type: str = 'general', note_type: str = '0', scope: str = '0', industry: str = '', max_count: int = 200, delay_range: str = '1000-3000', browse_time: str = '5000-10000') -> None:
    if actions is None:
        actions = {}
    
    # Store delay_range in actions so detail_actions can use it
    actions['delay_range'] = delay_range
    actions['browse_time'] = browse_time
    
    # Parse global delay range for filters
    delay_min_ms = 1000
    delay_max_ms = 3000
    if delay_range:
        try:
            parts = delay_range.split('-')
            if len(parts) == 2:
                delay_min_ms = int(parts[0])
                delay_max_ms = int(parts[1])
        except:
            pass

    def random_sleep():
        """Sleep for a random time within the configured delay range."""
        ms = random.randint(delay_min_ms, delay_max_ms)
        s = ms / 1000.0
        print(f"[xhs] Sleeping for {s:.2f}s...", flush=True)
        time.sleep(s)

    if industry:
        os.environ['CURRENT_INDUSTRY'] = industry
        
    # 复用已有登录态：优先使用环境变量，其次使用家目录路径，最后使用仓库内 profiles/xhs
    candidates = [
        os.getenv("XHS_USER_DATA_DIR"),
        os.path.expanduser("~/.autoOperation/playwright/default"),
    ]
    user_dir = next((p for p in candidates if p and os.path.exists(p)), candidates[1])
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    
    print(f"[xhs] Starting with keyword='{keyword}', actions={actions}, time_range={time_range}, sort={sort_type}, type={note_type}, scope={scope}, industry={industry}")
    
    context = playwright.chromium.launch_persistent_context(
        user_data_dir=user_dir,
        headless=False,
        args=[
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ],
        viewport={'width': 1280, 'height': 800}
    )

    # Monitor for browser close
    def on_close(page):
        print("[py] Browser closed by user, exiting script...", flush=True)
        os._exit(0) # Force exit immediately
        
    context.on("close", lambda: on_close(None))
    
    if context.pages:
        page = context.pages[0]
    else:
        page = context.new_page()
        
    page.on("close", on_close)

    # Stealth scripts
    page.add_init_script("""
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
        });
    """)
    
    print("[py] Navigating to Xiaohongshu...", flush=True)
    page.goto("https://www.xiaohongshu.com/explore")
    page.get_by_role("textbox", name="搜索小红书").click()
    page.get_by_role("textbox", name="搜索小红书").fill(keyword)
    page.get_by_role("textbox", name="搜索小红书").press("Enter")
    page.wait_for_selector('#global > div.main-container > div.with-side-bar.main-content > div > div > div.search-layout__main > div.feeds-container', timeout=60000)
    
    # Apply Filters
    try:
        print("[xhs] Waiting for filter bar...", flush=True)
        # Wait for network idle to ensure filters are loaded
        try:
            page.wait_for_load_state('networkidle', timeout=5000)
        except:
            pass

        # Define Maps
        sort_map = {
            'general': '综合',
            'time_descending': '最新',
            'popularity_descending': '最热',
            'comment_descending': '评论最多', 
            'collect_descending': '收藏最多'
        }

        # Locate Filter Button
        # Updated Selector (Dec 2025): Use 'div.filter:has-text("筛选")'
        filter_btn = page.locator('div.filter:has-text("筛选")').first
        has_filter_btn = filter_btn.count() > 0
        
        if has_filter_btn:
            print("[xhs] Filter button found", flush=True)
            # Must click to open the menu now (hover might not work)
            try:
                if not page.locator('div.channel:has-text("视频")').first.is_visible():
                    filter_btn.click()
                    time.sleep(1.0)
            except:
                pass
        else:
            print("[xhs] Filter button NOT found", flush=True)

        # Helper to ensure filter panel is open
        def ensure_panel_open():
            # Check if panel is likely open by looking for unique text in the panel
            # We try '排序依据' first
            if page.locator('text="排序依据"').first.is_visible():
                return True
            
            # If not, check if '笔记类型' is visible (in case '排序依据' is scrolled out or changed)
            if page.locator('text="笔记类型"').first.is_visible():
                return True
            
            print("[xhs] Opening filter panel...", flush=True)
            filter_btn = page.locator('div.filter:has-text("筛选")').first
            
            # If filter button not found by text, try generic class
            if filter_btn.count() == 0:
                 filter_btn = page.locator('.filter').first
            
            if filter_btn.is_visible():
                # Try clicking multiple times if needed
                for attempt in range(2):
                    try:
                        print(f"[xhs] Clicking filter button (attempt {attempt+1})...", flush=True)
                        # Try clicking the inner span which usually captures the event better
                        span_btn = filter_btn.locator('span').first
                        if span_btn.is_visible():
                            span_btn.click(force=True)
                        else:
                            filter_btn.click(force=True)
                        
                        # Wait for panel
                        try:
                            page.locator('text=排序依据').or_(page.locator('text=笔记类型')).first.wait_for(state='visible', timeout=2000)
                            return True
                        except:
                            if attempt == 0:
                                print("[xhs] Panel not detected, retrying click...", flush=True)
                                time.sleep(1.0)
                            else:
                                print("[xhs] Panel did not open after retries", flush=True)
                    except Exception as e:
                         print(f"[xhs] Error clicking filter: {e}", flush=True)
                         
                return False
            else:
                 print("[xhs] Filter button not visible for click", flush=True)
            return False

        # Helper to click option in the new panel
        def click_panel_option(value, label):
            if not ensure_panel_open():
                print(f"[xhs] Cannot select {label}: Panel not open", flush=True)
                return False
            
            # Apply random delay before clicking an option
            random_sleep()

            print(f"[xhs] Attempting to select {label}: {value}", flush=True)
            # Find the option text
            # Usually it's a simple text element inside the panel
            # We try precise text match first
            el = page.locator(f'text="{value}"').first
            if el.is_visible():
                try:
                    el.click()
                    print(f"[xhs] Clicked {label}: {value}", flush=True)
                    # Wait for potential reload/update
                    time.sleep(2.0)
                    return True
                except Exception as e:
                    print(f"[xhs] Failed to click {value}: {e}", flush=True)
            else:
                 print(f"[xhs] Option '{value}' not visible", flush=True)
            return False

        # Apply Filters Sequentially
        
        # 1. Sort
        sort_map = {
            'general': '综合',
            'time_descending': '最新',
            'popularity_descending': '最热', # Map to "最热" if "最热" exists, or "最多点赞"/"最多收藏"
            'comment_descending': '最多评论', 
            'collect_descending': '最多收藏'
        }
        target_sort = sort_map.get(sort_type)
        if target_sort and target_sort != '综合':
             click_panel_option(target_sort, "sort")

        # 2. Note Type
        # Menu items: 不限, 视频, 图文
        if note_type != '0':
            target_label = None
            if note_type == 'video': target_label = '视频'
            elif note_type == 'image_text': target_label = '图文'
            
            if target_label:
                click_panel_option(target_label, "type")

        # 3. Publish Time
        # Menu items: 不限, 一天内, 一周内, 半年内
        time_map = {1: '一天内', 7: '一周内', 180: '半年内'}
        if time_range > 0:
            t_label = time_map.get(time_range)
            if t_label:
                click_panel_option(t_label, "time")
            else:
                print(f"[xhs] Time range {time_range} not supported", flush=True)

        # 4. Search Scope
        # Menu items: 不限, 已看过, 未看过, 已关注
        scope_map = {'1': '已看过', '2': '未看过', '3': '已关注'}
        if scope != '0':
            s_label = scope_map.get(scope)
            if s_label:
                click_panel_option(s_label, "scope")
            
        print("[xhs] Filters applied (if any), waiting for results to reload...", flush=True)
        time.sleep(2.0)


    except Exception as e:
        print(f"[xhs] Failed to apply filters: {e}", flush=True)
        import traceback
        traceback.print_exc()

    container = page.locator('#global > div.main-container > div.with-side-bar.main-content > div > div > div.search-layout__main > div.feeds-container').first
    from detail_actions import open_and_act
    items = container.locator('> section').all()
    
    count = 0
    print(f"[xhs] Found {len(items)} items, target max: {max_count}", flush=True)
    
    for it in items:
        if count >= max_count:
            print(f"[xhs] Reached max count {max_count}, stopping.", flush=True)
            break
            
        href = it.locator('div > a.cover.mask.ld').first.get_attribute('href') or it.locator('a[href^="/explore/"]').first.get_attribute('href') or it.locator('a.cover').first.get_attribute('href')
        if href:
            open_and_act(context, href, actions, industry=industry)
            count += 1
            
    context.close()

if __name__ == "__main__":
    try:
        print("[xhs] Script launched", flush=True)
        parser = argparse.ArgumentParser(description='XHS Auto Operation')
        parser.add_argument('--keyword', type=str, default='保险', help='Search keyword')
        parser.add_argument('--enable-like', action='store_true', help='Enable like action')
        parser.add_argument('--enable-fav', action='store_true', help='Enable favorite action')
        parser.add_argument('--enable-comment', action='store_true', help='Enable comment action')
        parser.add_argument('--enable-browse', action='store_true', help='Enable browse action')
        parser.add_argument('--enable-record', action='store_true', help='Enable record action')
        parser.add_argument('--like-prob', type=int, default=100, help='Probability of like action (0-100)')
        parser.add_argument('--fav-prob', type=int, default=100, help='Probability of fav action (0-100)')
        parser.add_argument('--comment-prob', type=int, default=100, help='Probability of comment action (0-100)')
        parser.add_argument('--time-range', type=int, default=0, help='Time range filter in days (0=unlimited)')
        parser.add_argument('--sort', type=str, default='general', help='Sort type')
        parser.add_argument('--note-type', type=str, default='0', help='Note type')
        parser.add_argument('--scope', type=str, default='0', help='Search scope')
        parser.add_argument('--industry', type=str, default='', help='Industry code')
        parser.add_argument('--max-count', type=int, default=200, help='Max items to process')
        parser.add_argument('--delay-range', type=str, default='1000-3000', help='Delay range in ms (e.g. 1000-3000)')
        parser.add_argument('--browse-time', type=str, default='5000-10000', help='Browse time in ms (e.g. 5000-10000)')
        
        args = parser.parse_args()
        
        actions_map = {
            'like': args.enable_like,
            'like_prob': args.like_prob,
            'fav': args.enable_fav,
            'fav_prob': args.fav_prob,
            'comment': args.enable_comment,
            'comment_prob': args.comment_prob,
            'browse': args.enable_browse,
            'record': args.enable_record
        }
        
        print(f"[xhs] Arguments parsed: {args}", flush=True)
        
        with sync_playwright() as playwright:
            try:
                run(playwright, keyword=args.keyword, actions=actions_map, time_range=args.time_range, sort_type=args.sort, note_type=args.note_type, scope=args.scope, industry=args.industry, max_count=args.max_count, delay_range=args.delay_range, browse_time=args.browse_time)
            except Exception as e:
                print(f"[xhs] Critical Error: {e}", file=sys.stderr, flush=True)
                import traceback
                traceback.print_exc()
                sys.exit(1)
    except Exception as e:
        print(f"[xhs] Main Error: {e}", file=sys.stderr, flush=True)
        sys.exit(1)
