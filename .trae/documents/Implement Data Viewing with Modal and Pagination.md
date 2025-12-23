# 数据查看区域与弹窗功能实现计划

根据您的最新指示，我将调整界面布局，在 LV3 功能区域之后新增独立的“数据查看”区域，并实现两个数据查看按钮的弹窗与翻页功能。

## 1. 界面布局调整 (Frontend)

### `src/index.html`
*   **新增“数据查看”区域**：
    *   在 `<section id="lv3-area">` 之后，`<section id="risk-area">` 之前，插入一个新的 `<section id="view-area">`。
    *   该区域标题为“数据查看”。
    *   区域内放置两个按钮：
        *   `[查看采集]`：点击查看笔记采集数据。
        *   `[查看评论]`：点击查看评论采集数据。
*   **移除旧按钮**：
    *   移除之前添加在“获取小红书榜单”旁边的“查看采集数据”按钮，保持界面整洁。
*   **添加弹窗组件**：
    *   在 `<body>` 底部添加一个通用的 Modal 模态框结构。
    *   包含：标题栏、表格内容区、底部翻页控制区（上一页、页码/总数、下一页）。

## 2. 交互逻辑实现 (JavaScript)

### `src/views/autoop.js`
*   **事件绑定**：
    *   监听“查看采集”按钮：调用 `getScrapedNotes`，打开弹窗展示 `xhs_notes` 数据。
    *   监听“查看评论”按钮：调用 `getScrapedComments`，打开弹窗展示 `op_comments` 数据。
*   **弹窗逻辑**：
    *   实现 `openDataModal(type)` 函数，根据类型（notes/comments）初始化弹窗。
    *   实现 `loadPage(page)` 函数，处理分页请求和表格渲染。
*   **表格渲染**：
    *   笔记列表展示：标题、类型、点赞/收藏/评论数、采集时间。
    *   评论列表展示：评论内容、作者、点赞数、评论时间、关联笔记ID（可选）。

## 3. 后台接口支持 (Electron Main)

### `src/main.js`
*   **接口确认**：
    *   `get-scraped-notes`: 现有的获取笔记接口，支持分页。
    *   `get-scraped-comments`: **新增接口**，从 `op_comments` 表中分页查询评论数据。
        *   SQL 逻辑：`SELECT * FROM op_comments ORDER BY created_at DESC LIMIT ?, ?`
        *   同时查询总数 `SELECT COUNT(*) FROM op_comments` 用于分页。

### `src/preload.js` & `src/services/ipc.js`
*   暴露 `getScrapedComments` 方法供前端调用。

## 4. 样式美化 (CSS)
*   为“数据查看”区域添加与其他区域（Lv1/Lv2/Lv3）一致的边框和标题样式。
*   为弹窗添加遮罩、居中、滚动条和分页按钮样式。

## 5. 执行步骤
1.  **后端**：在 `src/main.js` 添加 `get-scraped-comments` 接口。
2.  **桥接**：在 `preload.js` 和 `ipc.js` 注册新接口。
3.  **前端结构**：在 `src/index.html` 新增“数据查看”区域和 Modal HTML。
4.  **前端逻辑**：在 `src/views/autoop.js` 编写按钮点击、弹窗显示、数据加载和翻页代码。
5.  **清理**：移除旧的“查看采集数据”按钮代码。