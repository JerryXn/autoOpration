import os
import time
from pathlib import Path
import sys
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import Playwright, sync_playwright, expect


def run(playwright: Playwright) -> None:
    # 复用已有登录态：优先使用环境变量，其次使用家目录路径，最后使用仓库内 profiles/xhs
    candidates = [
        os.getenv("XHS_USER_DATA_DIR"),
        os.path.expanduser("~/.autoOperation/playwright/default"),
        str(Path(__file__).resolve().parents[2] / "auto_opration_python" / "profiles" / "xhs"),
    ]
    user_dir = next((p for p in candidates if p and os.path.exists(p)), candidates[1])
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    context = playwright.chromium.launch_persistent_context(user_data_dir=user_dir, headless=False)
    page = context.new_page()
    page.goto("https://www.xiaohongshu.com/explore")
    page.get_by_role("textbox", name="搜索小红书").click()
    page.get_by_role("textbox", name="搜索小红书").fill("保险")
    page.get_by_role("textbox", name="搜索小红书").press("Enter")
    page.wait_for_selector('#global > div.main-container > div.with-side-bar.main-content > div > div > div.search-layout__main > div.feeds-container', timeout=60000)
    container = page.locator('#global > div.main-container > div.with-side-bar.main-content > div > div > div.search-layout__main > div.feeds-container').first
    from detail_actions import open_and_act
    items = container.locator('> section').all()
    for it in items:
        href = it.locator('div > a.cover.mask.ld').first.get_attribute('href') or it.locator('a[href^="/explore/"]').first.get_attribute('href') or it.locator('a.cover').first.get_attribute('href')
        if href:
            open_and_act(context, href)
    context.close()

with sync_playwright() as playwright:
    run(playwright)
