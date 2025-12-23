I will implement probabilistic actions (Like, Favorite, Comment) by adding probability inputs to the UI and updating the backend logic.

### 1. Frontend UI Updates (`src/index.html`)
*   Modify `lv2-area` (Like/Fav) and `lv3-area` (Comment) to include probability inputs next to the checkboxes.
*   Use `<input type="number" min="0" max="100" value="100">` for percentage input.
*   Style them to be compact and aligned with the labels.

### 2. Frontend Logic Updates (`src/views/autoop.js`)
*   Get references to the new probability inputs (`autoop-like-prob`, `autoop-fav-prob`, `autoop-comment-prob`).
*   When starting auto-op, read these values (default to 100 if invalid).
*   Pass these probability values in the `payload.actions` object to `startAutoOp`.
    *   Example: `actions: { like: true, likeProb: 80, ... }`

### 3. Backend IPC Updates (`src/main.js`)
*   Update `start-auto-op` handler to parse the new probability fields from the payload.
*   Pass these values as command-line arguments to the Python script.
    *   `--like-prob=80`
    *   `--fav-prob=50`
    *   `--comment-prob=30`

### 4. Python Script Updates (`src/playwright/python/xhs.py` & `detail_actions.py`)
*   **`xhs.py`**:
    *   Add `argparse` arguments for the probabilities.
    *   Pass these probabilities into the `actions` dictionary passed to `run` and subsequently `open_and_act`.
*   **`detail_actions.py`**:
    *   Inside `open_and_act`, implement the probability logic using `random.random()`.
    *   Before executing 'Like', check: `if actions.get('like') and random.random() * 100 < actions.get('like_prob', 100):`
    *   Apply similar logic for 'Favorite' and 'Comment'.

### 5. Verification
*   I will verify that the inputs appear correctly in the UI.
*   I will ensure the parameters are correctly passed to the Python process.
*   The `random` logic in Python is standard, so testing via code review and dry run logs is sufficient.

This plan covers all your requirements: adding the inputs, passing the data, and implementing the probabilistic behavior using a randomizer.