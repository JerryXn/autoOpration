## 目标
- 在仓库中新建独立录制目录存放脚本
- 点击“执行”时进入录制模式，阻断既有自动化流程
- 提供录制、回放、验证的完整链路，并复用登录态

## 目录与入口
- 新建目录：`recordings/playwright`
- 录制输出文件：`recordings/playwright/xhs_like_collect.py`
- 回放入口：直接运行生成的脚本 `python recordings/playwright/xhs_like_collect.py`

## 录制方式（Codegen）
- 环境准备：`pip install playwright` 与 `playwright install`
- 录制命令（复用登录态）：
  - `playwright codegen https://www.xiaohongshu.com --target=python -o recordings/playwright/xhs_like_collect.py --user-data-dir ~/.autoOperation/playwright/default`
- 操作步骤：在弹出浏览器内完成登录、搜索、进入详情、点击点赞与收藏；右侧生成脚本后保存

## 模式开关与阻断逻辑
- 在 `user_flow_xhs.py` 增加 CLI 开关：`--record-script`
- 当检测到 `--record-script`：
  - 直接启动上面的 codegen 命令并返回
  - 跳过既有的搜索、详情、点赞/收藏、数据库等所有流程
- UI 按钮“执行”传入 `--record-script` 以启用录制模式

## 回放与验证
- 回放运行：`python recordings/playwright/xhs_like_collect.py`
- 为生成脚本补充持久化与可视化：
  - 使用 `sync_playwright()` 打开浏览器并指定 `user_data_dir=~/.autoOperation/playwright/default`
  - 在脚本中开启 Trace 与视频以便复盘：
    - `context.tracing.start(screenshots=True, snapshots=True, sources=True)`
    - 执行后 `context.tracing.stop(path="recordings/playwright/trace.zip")`
    - `browser.new_context(record_video_dir="recordings/playwright/videos", record_video_size={"width":1280, "height":720})`
- Trace 回放：`playwright show-trace recordings/playwright/trace.zip`

## 选择器稳定性
- 录制后将关键定位替换为稳定选择器：
  - 点赞：`use[xlink\:href="#like"]` 或 `svg.reds-icon.like-icon`
  - 收藏：`use[xlink\:href="#collect"]` 或 `svg.reds-icon.collect-icon`
- 保留 `scroll_into_view_if_needed()` 与 `wait_for_selector()` 确保点击成功

## 安全与配置
- 不写入 Cookie 内容到仓库，脚本仅复用本地 `user_data_dir`
- 可在 `.gitignore` 添加 `recordings/playwright/*.zip` 与 `recordings/playwright/videos/*`

## 后续扩展
- 若需要录制评论流程，生成 `xhs_comment.py` 并同样受 `--record-script` 控制
- 可增加 `--record-target=<file>` 指定录制输出文件名
- 可在录制完成后自动打开 `show-trace` 帮助快速确认录制效果