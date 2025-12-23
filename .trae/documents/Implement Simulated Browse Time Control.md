I will implement the "Simulated Browse Time" (random detail page stay time) as requested.

### 1. Frontend UI Updates (`src/index.html`)
*   In the "Risk Control" (`risk-area`) section, add a new input field:
    *   Label: `模拟浏览(s)` (Simulated Browse)
    *   Input: `text` type (to support range like "5-10"), default value `5-10`.
    *   This will sit alongside the existing `浏览总量` and `随机延迟(s)`.

### 2. Frontend Logic Updates (`src/views/autoop.js`)
*   Get reference to the new input (`autoop-browse-time`).
*   Collect this value when starting auto-op.
*   Pass it in the `payload` to `startAutoOp` (e.g., `payload.browseTime`).

### 3. Backend IPC Updates (`src/main.js`)
*   Update `start-auto-op` handler.
*   Parse `payload.browseTime` (convert "s-s" to "ms-ms" for consistency with other delays, or keep as seconds and let Python handle it. I will convert to milliseconds string "min-max" for consistency).
*   Pass it as a new argument to the Python script: `--browse-time=5000-10000`.

### 4. Python Script Updates (`src/playwright/python/xhs.py` & `detail_actions.py`)
*   **`xhs.py`**:
    *   Add `argparse` argument `--browse-time`.
    *   Pass this value into the `actions` dictionary.
*   **`detail_actions.py`**:
    *   Inside `open_and_act`, **immediately after page load** (before extracting info or interactions), parse the `browse_time` range.
    *   Generate a random sleep duration.
    *   Execute `time.sleep(random_duration)`.
    *   Log the wait action: `[py] Simulating browse for X.Xs`.

### 5. Verification
*   Verify the new input appears in the UI.
*   Verify the value is passed correctly to the backend and Python.
*   Verify the Python script waits *before* performing other actions in the detail page.

This aligns with the user's request to add a specific "stay time" control separate from the "action interval" delay.