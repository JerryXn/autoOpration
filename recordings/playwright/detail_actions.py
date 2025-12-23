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
def open_and_act(context, href: str):
    time.sleep(random.uniform(0.5, 3))
    url = normalize_href(href)
    if not url:
        return
    page = context.new_page()
    print("进入详情页面"+url)
    page.goto(url)
    try:
        import sys
        sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
        sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'auto_opration_python'))
        from auto_opration_python.src.storage.sql_repo import insert_action_skip, insert_note_skip
        nid = url.split('/explore/')[1].split('?')[0] if '/explore/' in url else ''
        if nid:
            insert_note_skip(nid, None, url)
        actor = os.getenv('ACTOR_USER_ID') or 'me'
    except Exception:
        insert_action_skip = None
        insert_note_skip = None
        nid = ''
        actor = 'me'
    try:
        page.locator('#noteContainer > div.interaction-container > div.interactions.engage-bar > div > div > div.input-box > div.interact-container > div > div.left > span.like-wrapper.like-active > span.like-lottie').first.scroll_into_view_if_needed()
        page.locator('#noteContainer > div.interaction-container > div.interactions.engage-bar > div > div > div.input-box > div.interact-container > div > div.left > span.like-wrapper.like-active > span.like-lottie').first.click()
        if insert_action_skip and nid:
            insert_action_skip(actor, nid, None, 'like', None, True, {'selector':'like'})
    except Exception:
        if insert_action_skip and nid:
            insert_action_skip(actor, nid, None, 'like', None, False, {'selector':'like'})
    time.sleep(random.uniform(0.5, 2))
    try:
        page.wait_for_selector('#note-page-collect-board-guide > svg', timeout=10000)
        page.locator('#note-page-collect-board-guide > svg').first.scroll_into_view_if_needed()
        page.locator('#note-page-collect-board-guide > svg').first.click()
        if insert_action_skip and nid:
            insert_action_skip(actor, nid, None, 'collect', None, True, {'selector':'collect'})
    except Exception:
        if insert_action_skip and nid:
            insert_action_skip(actor, nid, None, 'collect', None, False, {'selector':'collect'})
    time.sleep(random.uniform(0.5, 2))
    try:
        from comment_actions import handle_all_comments
        handle_all_comments(page)
    except Exception:
        pass
    try:
        page.close()
    except Exception:
        pass
