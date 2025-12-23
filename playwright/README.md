# Playwright 脚本平台

- 启动主控服务：`npm start`
- 录制新脚本：`npm run record https://example.com my-script`
- 启动脚本实例：
  - `POST http://localhost:3000/runs` JSON: `{ "scriptId": "example", "fingerprintId": "cn-chrome-win", "proxyId": "proxy-cn-1", "retry": true }`
  - 保持登录（两种方式）：
    - 存储状态文件：`{"scriptId":"example","persistLogin":true,"persistMode":"state","storageKey":"example"}`，运行后保存到 `data/storage/example.json`，下次运行自动加载
    - 持久化用户目录：`{"scriptId":"example","persistLogin":true,"persistMode":"profile","userDataDir":"data/profile/example"}`，复用浏览器 Profile（含 Cookie/LocalStorage）
- 暂停/恢复/停止：
  - `POST /runs/:id/pause`、`POST /runs/:id/resume`、`POST /runs/:id/stop`
- 订阅事件：连接 `ws://localhost:3000` 接收心跳与事件
  - 新消息事件：当启用聊天监听时，接收 `type: CHAT_MESSAGE`，payload 包含 `text/html/ts`
## 聊天框持续监听
- 启用方式：在启动请求中传入 `options.watch.chatSelector`
  - 示例：`{"scriptId":"chat-watch","options":{"watch":{"chatSelector":"#chat"}}}`
- 事件接收：订阅 `ws://localhost:3000`，处理 `CHAT_MESSAGE`
- 适配提示：根据实际站点的聊天容器选择器设置 `chatSelector`，如 `.chat-list`、`[data-testid="messages"]`

## RPA 级对话（视觉 LLM 谈单）
- 启动 Agent 服务（需配置 `LLM_API_URL`/`LLM_API_KEY`）：订阅事件并调用远程模型生成行动计划
- 模式：
  - `assist`：仅生成计划，需人工确认后执行
  - `auto`：自动执行，含速率限制与风控校验
- 行动指令转发：`POST /runs/:id/actions`，Worker 执行 `SEND_MESSAGE/CLICK/TYPE/WAIT`
- 视觉接入：Agent 可按需请求页面截图并随上下文传给模型（站点适配）
 - 运行时输入框适配：通过 `options.watch.chatInputSelector` 指定输入框；缺省时会在 `chatSelector` 下寻找 `input/textarea`
