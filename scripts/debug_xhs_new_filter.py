import os
import time
from playwright.sync_api import sync_playwright

def debug_new_filter_panel():
    candidates = [
        os.getenv("XHS_USER_DATA_DIR"),
        os.path.expanduser("~/.autoOperation/playwright/default"),
    ]
    user_dir = next((p for p in candidates if p and os.path.exists(p)), candidates[1])
    
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=user_dir,
            headless=False,
            args=['--disable-blink-features=AutomationControlled'],
            viewport={'width': 1280, 'height': 800}
        )
        page = context.pages[0] if context.pages else context.new_page()
        
        try:
            page.goto("https://www.xiaohongshu.com/search_result?keyword=%E4%BF%9D%E9%99%A9&source=web_explore_feed")
            page.wait_for_load_state('networkidle', timeout=10000)
            
            print("--- Step 1: Click Filter Button ---")
            # Try specific selector mentioned by user/found previously
            filter_btn = page.locator('div.filter:has-text("筛选")').first
            if filter_btn.is_visible():
                print("Clicking Filter button...")
                filter_btn.click()
                time.sleep(2) # Wait for panel to open
                
                print("\n--- Step 2: Search for Panel Elements ---")
                
                # Search for keywords from the user's screenshot
                keywords = ["排序依据", "最多点赞", "发布时间", "一天内", "搜索范围", "已看过"]
                
                found_panel = False
                
                for kw in keywords:
                    els = page.locator(f'text="{kw}"').all()
                    print(f"Keyword '{kw}': Found {len(els)} elements")
                    
                    for i, el in enumerate(els):
                        if el.is_visible():
                            print(f"  [Visible] Element {i}: {el.evaluate('el => el.outerHTML')}")
                            # Get parent container to understand structure
                            parent = el.locator('..')
                            print(f"  Parent HTML: {parent.evaluate('el => el.outerHTML')[:300]}...")
                            
                            # Try to find the container class for the whole option group
                            # e.g. the container for "最新", "最多点赞" etc.
                            found_panel = True
                
                if found_panel:
                    print("\n--- Step 3: Analyze Structure for Selectors ---")
                    # Try to dump the structure of one option group (e.g. Sort)
                    sort_group = page.locator('text="排序依据"').first.locator('xpath=following-sibling::div')
                    if sort_group.count() > 0:
                         print(f"Sort Group HTML: {sort_group.evaluate('el => el.outerHTML')}")
                    else:
                         # Maybe it's not a sibling? Try parent's sibling or child
                         print("Could not directly locate sort group sibling.")

            else:
                print("Filter button not found.")
                
        except Exception as e:
            print(f"Error: {e}")
        finally:
            context.close()

if __name__ == "__main__":
    debug_new_filter_panel()
