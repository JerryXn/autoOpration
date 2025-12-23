## 功能目标
- 双击应用后打开首页窗口，页面包含“运行程序”按钮
- 点击按钮后打开新浏览器窗口并跳转到 `https://www.xiaohongshu.com/`
- 支持打包为 macOS 与 Windows 可执行/安装包

## 技术选型
- 桌面框架：Electron（跨平台、内置Chromium与Node集成）
- 打包工具：electron-builder（产出 `dmg`/`nsis` 等格式）
- 安全机制：`contextIsolation` + `preload` + IPC，仅暴露按钮事件所需 API

## 目录与文件
- `package.json`：应用元信息、脚本与打包配置
- `src/main.js`：主进程，创建首页窗口、监听“运行程序”事件并开新窗口
- `src/preload.js`：在渲染进程暴露 `runProgram()`，与主进程安全通信
- `src/index.html`：首页 UI，包含“运行程序”按钮

## 实现步骤
1. 初始化项目：在目标目录执行 `npm init -y`
2. 安装依赖：`npm install --save-dev electron electron-builder`
3. 编写主进程：创建首页 `BrowserWindow`，注册 `ipcMain` 事件，按钮触发时创建新窗口，`loadURL` 指向小红书
4. 编写 `preload.js`：通过 `contextBridge` 暴露 `runProgram()`，内部发送 `ipcRenderer` 事件
5. 编写 `index.html`：渲染按钮并绑定 `window.api.runProgram()`
6. 脚本与打包配置：在 `package.json` 添加 `start`、`dist:mac`、`dist:win` 及 `build` 字段（`appId`、`productName`、目标平台）

## 打包与运行
- 开发运行：`npm run start`
- 打包 macOS：`npm run dist:mac`，产物位于 `dist/`
- 打包 Windows：
  - 在 Windows 上执行 `npm run dist:win`
  - 如需在 macOS 交叉打包 Windows，先安装 `wine` 后再执行

## 验证要点
- 启动应用后出现首页窗口，按钮可点击
- 点击按钮后弹出新 Electron 窗口并正确跳转到小红书
- 打包产物可在目标平台正常安装/运行

## 可选方案（如需）
- 使用系统默认浏览器打开：按钮触发改为 `shell.openExternal('https://www.xiaohongshu.com/')`，不创建第二个应用窗口
- 首页增强：增加日志、状态提示、后续自动化任务入口

## 交付内容
- 最小可运行工程与打包配置，四个核心文件（`package.json`、`src/main.js`、`src/preload.js`、`src/index.html`）
- 已验证的开发启动与打包脚本

请确认该方案，我将立即在指定目录创建文件并执行安装与打包。