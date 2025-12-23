**切换为 CLI 模式的执行方案**

我理解您的困扰。交互式的自动执行确实容易出现状态同步问题。既然您希望回归简单直接的 CLI 模式，并且将所有特定参数（关键词、操作开关、Bot配置等）都通过命令行传递，这是一个非常稳健的决定。

**方案核心：**
1.  **废弃 Watcher**：不再使用 `watcher.py` 和 `task.json` 这种文件监听机制。
2.  **直接调用**：Electron 点击“执行”时，直接使用 `child_process.spawn` 调用 `python src/playwright/python/xhs.py`，并将所有参数通过命令行参数（Args）传递给 Python 脚本。
3.  **参数化改造**：修改 `xhs.py`，使其能够解析命令行参数（如 `--keyword`, `--enable-like`, `--enable-comment` 等）。

**具体实施步骤：**

1.  **修改 `src/playwright/python/xhs.py`**
    *   引入 `argparse` 库。
    *   解析命令行参数：
        *   `--keyword`: 搜索关键词
        *   `--enable-like`: 是否点赞 (flag)
        *   `--enable-fav`: 是否收藏 (flag)
        *   `--enable-comment`: 是否评论 (flag)
        *   `--industry`: 行业（用于查 Bot 配置，默认 insurance）
        *   `--platform`: 平台（用于查 Bot 配置，默认 coze）
    *   将解析出的参数传递给 `run` 函数。

2.  **修改 `src/main.js`**
    *   **移除 Watcher**：删除 `startPythonWatcher` 相关代码。
    *   **重写 `start-auto-op`**：
        *   不再写 `task.json`。
        *   根据前端传入的 `payload`，拼接出 Python 命令行参数列表。
        *   使用 `spawn('python', args, ...)` 直接启动脚本。
        *   保留 `stdout/stderr` 的日志输出，以便在 Electron 控制台看到 Python 的运行情况。
    *   **重写 `stop-auto-op`**：
        *   如果 Python 进程正在运行，调用 `kill()` 终止它。

3.  **前端 (`src/views/autoop.js`)**
    *   前端代码无需大改，只需确保传递给 `start-auto-op` 的 payload 包含所有必要信息（关键词、权限等），目前已经包含了。

**优势**：
*   **原子性**：每次执行都是一个新的独立进程，状态互不干扰。
*   **可控性**：可以直接通过 `stop` 按钮杀掉进程，立即停止。
*   **调试方便**：您甚至可以在终端手动运行生成的命令来测试。

**下一步**：
我将按照此计划修改 `xhs.py` 和 `main.js`，并清理掉不再需要的 `watcher.py`。