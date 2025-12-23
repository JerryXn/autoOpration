**Bot 配置管理方案**

为了实现多 Bot 的灵活管理，我们将引入一个新的数据库表 `sys_bot_configs` 来专门存储 Bot ID、Token、行业、平台等信息，并支持根据“行业”或“平台”进行查询。

**方案详情：**

1.  **数据库设计**：
    *   新增表 `sys_bot_configs`。
    *   字段：
        *   `id` (PK, Auto Inc)
        *   `industry` (行业，如 'insurance', 'education')
        *   `platform` (平台，如 'coze', 'dify')
        *   `bot_id` (Bot 唯一标识)
        *   `token` (API 访问令牌)
        *   `description` (描述)
        *   `is_active` (是否启用，默认 1)
        *   `created_at`, `updated_at`

2.  **数据初始化**：
    *   创建表后，立即插入您提供的那条保险行业的 Coze Bot 配置。
    *   Bot ID: `7579886550863839272`
    *   Token: `4Kc57w22MoeYdYrgP7D4gbLWCg` (取自之前的上下文)
    *   Industry: `insurance` (映射“保险”)
    *   Platform: `coze`

3.  **代码适配 (`ai_reply.py` & `db.py`)**：
    *   修改 `db.py`，增加一个 `get_bot_config(industry)` 函数，从数据库中读取配置，而不是依赖环境变量。
    *   修改 `ai_reply.py`，不再从 `os.getenv` 读取，而是调用 `db.get_bot_config`。
    *   **动态性**：这意味着未来如果关键词是“留学”，您可以去查“education”行业的 Bot，实现精细化运营。目前我们先默认用“insurance”。

**实施步骤：**

1.  **更新 SQL 文件 (`db/global.sql`)**：添加 `sys_bot_configs` 表结构定义。
2.  **执行迁移脚本**：应用新的 SQL 变更到数据库。
3.  **插入数据**：执行 SQL 插入您指定的保险 Bot 配置。
4.  **修改 Python 代码**：更新 `db.py` 和 `ai_reply.py` 以支持从数据库读取配置。

(注：由于您提到“token你自己知道”，我将使用之前 `.env` 中确认的那个 Key。如果不正确，请随时纠正。)