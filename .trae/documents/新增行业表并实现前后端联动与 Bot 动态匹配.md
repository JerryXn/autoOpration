**行业数据库扩展方案**

您的需求非常清晰，我们需要将“行业”从一个简单的字符串变为可配置、可扩展的数据库实体，并将其与前端的下拉框和 Bot 配置进行联动。

**方案核心：**

1.  **数据库扩展**：
    *   新增表 `sys_industries`：存储行业的基础信息（名称、代码、描述）。
    *   **联动**：`sys_bot_configs` 表中的 `industry` 字段将逻辑上关联到 `sys_industries`（通过代码或外键）。
    *   **初始化**：插入一条数据 `{'name': '保险', 'code': 'insurance'}`。

2.  **后端 API 实现**：
    *   `ipcMain.handle('get-industries')`：查询 `sys_industries` 表，返回所有启用的行业列表。
    *   `start-auto-op` 接口更新：接收前端传入的 `industry` 参数，并传递给 Python 脚本。

3.  **前端改造**：
    *   在搜索区域增加“行业”下拉框。
    *   在页面加载时（`mount`），调用后端 API 获取行业列表，并动态填充下拉框。
    *   在点击“执行”时，获取选中的行业值，放入 payload 传给后端。

4.  **Python 脚本适配**：
    *   `xhs.py` 增加 `--industry` 参数解析。
    *   将该参数传递给 `ai_reply.py`，以便根据选择的行业去查找对应的 Bot 配置（之前我们已经在 `ai_reply.py` 中实现了 `get_bot_config(industry=...)`，现在只需确保这个参数是从 CLI 动态传入的，而不是写死的 'insurance'）。

**实施步骤：**

1.  **数据库**：
    *   更新 `global.sql`，添加 `sys_industries` 表。
    *   执行 SQL 脚本，创建表并插入“保险”数据。
2.  **后端 (`main.js`)**：
    *   新增 `get-industries` IPC 处理器。
    *   修改 `start-auto-op`，处理并传递 `industry` 参数。
3.  **前端 (`index.html` & `autoop.js`)**：
    *   修改 HTML，添加 `<select id="autoop-industry">`。
    *   修改 JS，实现加载时获取行业列表、点击时传递行业参数的逻辑。
4.  **Python (`xhs.py` & `ai_reply.py`)**：
    *   `xhs.py` 解析 `--industry` 参数，并在初始化 AI 回复逻辑时使用它。
    *   注意：`ai_reply.py` 已经支持 `industry` 参数，只需在调用时传入即可。但目前 `xhs.py` 并没有显式调用 AI 回复的初始化，AI 回复是在 `comment_actions.py` 中触发的。我们需要一种方式将 industry 传递给 `comment_actions.py`。
    *   **传递机制**：最简单的方法是设置一个环境变量 `CURRENT_INDUSTRY`，或者在 `detail_actions.py` / `comment_actions.py` 中增加参数传递链。鉴于代码结构，设置环境变量 `os.environ['CURRENT_INDUSTRY'] = args.industry` 是最轻量且有效的方案。

**补充说明**：
您提到的“目前只有一个可选项，保险，且这个时候需要去搜索”，意味着前端下拉框默认选中“保险”，执行时会带着这个参数去跑流程。这与我们的设计完全一致。