import re
import json
import time
import random
import os
import sys
from pathlib import Path

def open_comment_editor(page):
    try:
        sel = '#noteContainer > div.interaction-container > div.interactions.engage-bar > div > div > div.input-box > div.interact-container > div > div.right > span.comment-wrapper > span'
        page.locator(sel).first.scroll_into_view_if_needed()
        page.locator(sel).first.click()
    except Exception:
        pass

def _text_safe(el):
    try:
        return (el.inner_text() or '').strip()
    except Exception:
        return ''

def extract_comment_total(page):
    try:
        t = _text_safe(page.locator('div.total').first)
        m = re.search(r'(\d+)', t)
        return int(m.group(1)) if m else 0
    except Exception:
        return 0

def extract_comment_items(page):
    out = []
    try:
        lists = page.locator('div.list-container').all()
        for lc in lists:
            items = lc.locator('div.comment-item').all()
            for it in items:
                try:
                    cid = it.get_attribute('id') or ''
                    cls = (it.get_attribute('class') or '')
                    is_sub = 'comment-item-sub' in cls
                    if is_sub:
                        continue
                    parent_id = None
                    name = _text_safe(it.locator('div.author .name').first)
                    content = _text_safe(it.locator('div.content .note-text').first)
                    date_text = _text_safe(it.locator('div.info .date span').first)
                    location = _text_safe(it.locator('div.info .date .location').first)
                    like_text = _text_safe(it.locator('div.interactions .like .count').first)
                    reply_text = _text_safe(it.locator('div.interactions .reply .count').first)
                    top_flag = it.locator('div.labels .top').count() > 0
                    out.append({
                        'id': cid,
                        'level': 1,
                        'parent_comment_id': parent_id,
                        'author': name,
                        'content': content,
                        'date': date_text,
                        'location': location,
                        'likes': like_text,
                        'replies': reply_text,
                        'top': top_flag,
                    })
                except Exception:
                    continue
    except Exception:
        return out
    return out

def output_comment_data(page):
    total = extract_comment_total(page)
    items = extract_comment_items(page)

def handle_comments(page):
    try:
        open_comment_editor(page)
        page.wait_for_selector('div.list-container', timeout=10000)
        output_comment_data(page)
    except Exception:
        pass

def scan_all_comments(page, max_rounds: int = 50):
    seen = {}
    rounds = 0
    no_change = 0
    total_hint = extract_comment_total(page)
    while rounds < max_rounds:
        try:
            page.wait_for_selector('div.list-container', timeout=5000)
        except Exception:
            try:
                open_comment_editor(page)
                page.wait_for_selector('div.list-container', timeout=5000)
            except Exception:
                pass
        items = extract_comment_items(page)
        for it in items:
            k = (it.get('id') or '') + '|' + (it.get('author') or '') + '|' + (it.get('content') or '')
            if k and k not in seen:
                seen[k] = it
        prev = len(seen)
        try:
            show_more = page.locator('div.show-more')
            cnt = show_more.count()
            if cnt > 0:
                for i in range(cnt):
                    try:
                        show_more.nth(i).scroll_into_view_if_needed()
                        show_more.nth(i).click()
                        time.sleep(random.uniform(0.2, 0.6))
                    except Exception:
                        continue
            else:
                page.evaluate('window.scrollBy(0, Math.floor(document.body.scrollHeight * 0.6))')
                time.sleep(random.uniform(0.4, 1.0))
        except Exception:
            time.sleep(random.uniform(0.4, 1.0))
        items2 = extract_comment_items(page)
        for it in items2:
            k = (it.get('id') or '') + '|' + (it.get('author') or '') + '|' + (it.get('content') or '')
            if k and k not in seen:
                seen[k] = it
        cur = len(seen)
        if cur == prev:
            no_change += 1
        else:
            no_change = 0
        if total_hint and cur >= total_hint:
            break
        if no_change >= 5:
            break
        rounds += 1
    return list(seen.values())

def _current_note_id(page):
    try:
        url = page.url or ''
        if '/explore/' in url:
            return url.split('/explore/')[1].split('?')[0]
        if '/search_result/' in url:
            return url.split('/search_result/')[1].split('?')[0]
    except Exception:
        return ''
    return ''

def handle_all_comments(page):
    try:
        open_comment_editor(page)
        page.wait_for_selector('div.list-container', timeout=10000)
        all_items = scan_until_total(page)
        total = extract_comment_total(page)
        if total < len(all_items):
            total = len(all_items)
        try:
            from db import save_comments, save_ai_log
            from ai_reply import get_coze_reply
            
            url = page.url or ''
            nid = _current_note_id(page)
            # insert_comments_skip(nid, url, all_items, scan_batch=0)
            # insert_batch_log(nid, 0, len(all_items), False, total)
            save_comments(nid, all_items)
            
            # Simple AI Reply Logic Demo
            # Find a comment to reply to (e.g., the first one, or randomly)
            if all_items:
                target_comment = all_items[0]
                content = target_comment.get('content')
                if content:
                    reply = get_coze_reply(content)
                    if reply:
                        print(f"[ai] Generated reply for '{content[:10]}...': {reply[:20]}...")
                        # Here you would add logic to post the reply back to the page
                        # page.locator(...).fill(reply) ...
                        # For now, just logging it as requested.

        except Exception:
            pass
    except Exception:
        pass

def scroll_comments(page):
    try:
        page.evaluate('''
            () => {
                const lcs = Array.from(document.querySelectorAll('div.list-container'));
                let scrolled = false;
                for (const lc of lcs) {
                    if (lc && lc.scrollBy) {
                        lc.scrollBy(0, Math.floor(lc.scrollHeight * 0.6));
                        scrolled = true;
                    } else if (lc) {
                        lc.scrollTop = lc.scrollTop + Math.floor(lc.scrollHeight * 0.6);
                        scrolled = true;
                    }
                }
                if (!scrolled) {
                    window.scrollBy(0, Math.floor(document.body.scrollHeight * 0.6));
                }
                const items = Array.from(document.querySelectorAll('div.comment-item'));
                if (items.length) {
                    const last = items[items.length - 1];
                    last.scrollIntoView({behavior: 'instant', block: 'end'});
                }
                return true;
            }
        ''')
    except Exception:
        pass
    try:
        page.keyboard.press('PageDown')
    except Exception:
        pass
    time.sleep(random.uniform(0.3, 0.8))

def scan_until_total(page, max_rounds: int = 300):
    total = extract_comment_total(page)
    seen = {}
    rounds = 0
    while rounds < max_rounds:
        try:
            page.wait_for_selector('div.list-container', timeout=3000)
        except Exception:
            try:
                open_comment_editor(page)
                page.wait_for_selector('div.list-container', timeout=3000)
            except Exception:
                pass
        items = extract_comment_items(page)
        new_batch = []
        for it in items:
            k = (it.get('id') or '') + '|' + (it.get('author') or '') + '|' + (it.get('content') or '')
            if k and k not in seen:
                seen[k] = it
                new_batch.append(it)
        try:
            from db import save_comments
            url = page.url or ''
            nid = _current_note_id(page)
            if nid:
                # insert_note_skip(nid, None, url)
                pass
            # insert_comments_skip(nid, url, items, scan_batch=rounds)
            # insert_batch_log(nid, rounds, len(new_batch), False, total)
            save_comments(nid, new_batch)
        except Exception:
            pass
        try:
            end_cnt = page.locator('div.end-container').count()
            if end_cnt and end_cnt > 0:
                try:
                    # from db import insert_batch_log, insert_note_skip
                    url = page.url or ''
                    nid = _current_note_id(page)
                    # if nid:
                    #     insert_note_skip(nid, None, url)
                    # insert_batch_log(nid, rounds, 0, True, total)
                    pass
                except Exception:
                    pass
                break
        except Exception:
            pass
        if total and len(seen) >= total:
            break
        try:
            scroll_comments(page)
        except Exception:
            scroll_comments(page)
        rounds += 1
    return list(seen.values())
