## 差异定位
- 应用流程（src/main.js → Python）
  - Python 在 `auto_opration_python` 目录作为工作目录运行，读取 `config/config.yaml`。
  - `browser.user_data_dir: ./profiles/xhs` → 解析为 `auto_opration_python/profiles/xhs`。
  - `BrowserService.start()` 使用 `launch_persistent_context(user_data_dir)`，`BrowserOperator.ensure_login()` 在 `https://www.xiaohongshu.com` 等待登录态，并用 `storage_state` 生成接口 Cookie（`main_xhs.py:100–110`）。
- 单元测试当前行为
  - 直接 `launch_persistent_context`，未执行 `ensure_login`；仅依赖目录中已有 Cookie。
  - 测试运行的工作目录可能不同，若路径解析未统一，将导致使用错目录（无 Cookie）。

## 根因
- 路径与工作目录：应用的 Python 以 `auto_opration_python` 为 `cwd`，相对路径解析到 `auto_opration_python/profiles/xhs`；而单测如果以仓库根运行，必须显式定位到同一绝对目录。
- 登录验证流程：应用在打开入口后会执行 `ensure_login` 检测并持久化；单测没有这一步，若 Cookie 不存在或过期，会被视为未登录。

## 统一方案
- 路径统一：在测试基类中读取 `auto_opration_python/config/config.yaml`，将 `browser.user_data_dir` 解析为绝对路径（相对 `auto_opration_python` 而非当前工作目录）。
- 登录态校验：在单测执行前，先打开 `https://www.xiaohongshu.com`，调用 `ctx.storage_state()` 校验包含 `xiaohongshu.com` Cookies；缺失则明确报错提示登录态缺失。
- 可选：提供 `ensure_login` 测试辅助（仿照 `BrowserOperator.ensure_login`）在测试里也执行一次入口导航 + 登录检查，避免 Cookie 过期导致误判。

## 具体改动
- base_login.py：读取配置并解析绝对路径（相对 `auto_opration_python`）。
- 单测：改为 `chromium.launch_persistent_context(user_data_dir(), headless=False)`；在进入目标页前先打开入口并断言 `storage_state` 中存在 `xiaohongshu.com` 的 Cookie；再执行点赞/收藏点击。
- 文档：在 README 增加“测试继承登录态说明”，明确需要先在应用中登录一次。

## 验证
- 启动应用登录一次，执行单测，断言通过且点击成功；若登录态缺失，单测会给出明确失败原因，并引导先登录。