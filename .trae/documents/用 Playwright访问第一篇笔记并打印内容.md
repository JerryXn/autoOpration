## 目标
- 在小红书网页中访问列表中的第一篇可访问的笔记（跳过受限页），在进入详情页后提取核心内容并打印到控制台与浮窗日志。

## 执行流程
1. 打开探索页：`https://www.xiaohongshu.com/explore`
2. 列表候选定位：遍历候选选择器集合，找到第一个可见且未访问的元素
3. 进入详情：中心点鼠标点击进入详情页
4. 受限检测：若命中“暂时无法浏览/返回首页”或 URL 包含 `/404?`，则返回列表并选择下一候选，重复第 2–4 步 [循环]
5. 内容提取：在详情页执行 DOM 解析，采集笔记 ID、URL、标题、作者、正文文本、图片链接（首图与所有图）
6. 打印输出：将采集的对象打印到控制台（`console.log`）与浮窗日志（`window.__overlayLog`）

## 选择器集合
- 列表候选（open_next_item/browse_list）
  - `a[href^="/explore/"]`
  - `a[href*="/explore/"]`
  - `a[href*="/discovery/item"]`
  - `[role="link"] a[href*="/explore/"]`
  - `.note-item a[href*="/explore/"]`
  - `.feeds a[href*="/explore/"]`
  - `[data-note-id], .note-item, article[role="article"]`
- 详情页内容
  - 标题：`h1,h2,[data-title]`
  - 作者：`a[href*="/user/profile"], [data-author], .author a`
  - 正文：`[data-content], .content, article, .note-content`
  - 图片：`img`（过滤宽高阈值）

## 技术实现要点
- 在 Playwright 执行器（runner）新增方法：
  - `pickFirstCandidate()`：用候选集合选择第一个可见候选，保存坐标与 ID
  - `openCandidate()`：鼠标点击进入详情
  - `isRestricted()`：受限页检测
  - `extractNote()`：在详情页 `page.evaluate` 提取字段并返回对象 `{ id,url,title,author,text,images }`
  - `printNote()`：`console.log('[NOTE]', JSON.stringify(obj))` 并调用 `__overlayLog(obj)`
- 调度策略：进入受限页时回退并选择下一条 [循环]，直到成功进入正常详情页或候选耗尽。
- 覆盖选择器：如果浮窗设置了自定义选择器，优先使用；否则使用默认集合。

## 输出格式
- 控制台：`[NOTE] { id, url, title, author, text, images }`
- 浮窗日志：追加同样对象，便于视觉确认

## 验证
- 运行 `npm run pw:open -- --plat xhs` 打开持久化浏览器
- 使用浮窗点击“下一步”或“开始/暂停”，观察日志序列：`query_selector_next → program_click → detect_restricted → (back_to_list) → open_next_item → ... → extractNote → printNote`
- 确认控制台与浮窗打印出第一篇笔记内容；若首条受限，流程会自动跳过并取下一条。

## 说明
- 本任务只打印内容，不做数据库写入；若需要写库，可在下一步把 `extractNote()` 的结果通过 IPC 回主进程复用现有入库函数。