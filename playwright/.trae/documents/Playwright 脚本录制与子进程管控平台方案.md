# 项目目标
- 录制、管理并运行基于 Playwright 的脚本（脚本作为子项目存在）
- 主项目以子进程方式启动脚本，支持监控、通信、暂停、停止、启动
- 构建基础反机器人风控能力与浏览器指纹配置，降低被动阻断风险

## 总体架构
- Orchestrator（主控服务，Node.js/TypeScript）
  - REST + WebSocket 管理脚本与运行实例
  - 调度子进程、维护状态机、记录审计与运行结果
- Worker Runtime（子进程运行时）
  - 实际执行 Playwright 脚本，暴露控制点（pause/resume/stop）
  - 统一装配代理与指纹，采集心跳与指标
- Recorder（脚本录制工具）
  - 集成 `playwright codegen`，输出符合平台模板的脚本
- Shared（共享库）
  - 消息协议、类型定义、日志与公共工具

## 目录结构
- `packages/orchestrator` 主控 API 与调度
- `packages/worker-runtime` 子进程执行器
- `packages/recorder` 录制工具与模板
- `packages/shared` 协议与工具
- `scripts/` 存放已录制脚本（按脚本 ID/名称分目录）
- `data/` 元数据、运行记录、指纹与代理配置

## 脚本生命周期与状态机
- 状态：`idle → starting → running → paused → stopping → stopped → failed`
- 驱动：主控发命令，子进程心跳上报状态与指标

## 子进程管控
- 启动：`spawn('node', ['dist/worker-runtime/run.js', '--script', <id>])`
- 通信：Node IPC（`process.send`/`process.on('message')`）或通过 WebSocket 隧道
- 暂停/恢复：
  - 协作式暂停：在关键 `await` 前检查 `pauseFlag`，进入可中断等待
  - POSIX 硬暂停（可选）：`SIGSTOP`/`SIGCONT`，用于短时冻结
- 停止：
  - 优雅：发送 `STOP`，关闭浏览器与资源，写入结束事件
  - 强制：`SIGTERM` 超时后 `SIGKILL`
- 监控：
  - 心跳：1–3s 周期上报 `cpu/mem/pageUrl/step`
  - 资源：`pidusage` 采集进程资源占用
  - 事件：网络错误、崩溃、超时、验证码探测

## 消息协议（示例）
- 控制：`START {scriptId, args, proxy, fingerprint}`, `PAUSE`, `RESUME`, `STOP`, `STATUS`, `PING`
- 事件：`READY`, `HEARTBEAT {cpu, mem, url}`, `LOG {level, message}`, `ERROR {code, detail}`, `DONE {result}`

## 脚本录制与模板
- 录制：集成 `npx playwright codegen <url>` 交互式录制
- 模板：每个脚本导出统一入口 `run(ctx: RunnerContext): Promise<Result>`
- 元数据：`script.json`（名称、标签、入口 URL、默认代理/指纹、超时配置）
- 清洗：统一等待策略（`locator` + `expect`）、参数化敏感信息、移除固定延时

## 脚本运行器（子进程）
- 浏览器与上下文：
  - `channel: 'chrome'`（尽量使用系统 Chrome 减少 TLS/JA3 差异）
  - 代理：HTTP(S)/SOCKS + 认证，按脚本或实例注入
  - 隔离：每次新建 context，支持持久化 profile 可选
- 控制点：
  - `controls.pause/resume/cancel` 注入到脚本执行流程
  - 包装 `page` 操作（导航、点击、输入、等待）以支持可中断检查
- 产物：步骤截图、HAR、视频（按需），统一保存与清理

## 反机器人风控与指纹
- 启动参数：
  - `headless: false` 或真实 headful；`args: ['--disable-blink-features=AutomationControlled']`
  - `channel: 'chrome'` 以贴近真实客户端特征
- UA 与客户端提示：
  - 自定义 `userAgent` 与 `sec-ch-ua`/`sec-ch-ua-platform`/`sec-ch-ua-mobile`
  - `extraHTTPHeaders` 设置真实 `accept-language` 与相关 Client Hints
- 语言与时区：
  - `locale`、`timezoneId` 与出口 IP 地理一致
- 设备属性：
  - `viewport`、`deviceScaleFactor`、`isMobile`、`hasTouch` 与目标画像匹配
- 权限与特性：
  - `context.grantPermissions`（地理、剪贴板等）
  - `page.addInitScript` 适度覆盖：`navigator.webdriver`、`navigator.plugins`、`navigator.languages`、`Notification.permission` 查询行为、少量 Canvas/WebGL 噪声
- 行为节奏：
  - 人类化操作（随机停顿/鼠标轨迹/滚动）、限速请求，避免并发突刺
- 代理与指纹池：
  - 维护 `FingerprintProfile` 集合与代理池，失败域名黑名单与退避重试
- Cookies/Storage：
  - 可配置持久化或一次性会话，降低跨次关联
- 阻断探测与回退：
  - 发现验证码/阻断页时自动切换备用指纹与代理，或触发人工协助
- 依赖选项：
  - 以原生 Playwright 为主，可评估社区 stealth 插件（版本兼容性与维护度）

## 数据与管理
- 存储：
  - `scripts/` 存脚本代码；`data/scripts.json` 注册表；`data/runs.sqlite` 或 JSON 记录运行
- 调度：
  - 并发限流、优先级队列、重试策略（指数退避）
  - 同一脚本支持多实例，进程与上下文严格隔离

## API 与界面
- REST：
  - `POST /scripts` 上载/注册脚本
  - `POST /runs` 启动实例；`POST /runs/:id/pause|resume|stop`
  - `GET /runs/:id/status` 查询状态
- WebSocket：
  - 订阅心跳、日志与事件流
- 控制台 UI（可选）：
  - 列表、详情、实时日志/指标、截图/视频回放

## 安全与合规
- 不持久化敏感凭据，最小化日志
- 代理与账户使用遵守站点政策与法律法规
- 审计轨迹与失败回放留存

## 里程碑（实施顺序）
1. 初始化项目骨架与消息协议（orchestrator/worker/shared）
2. 集成录制工具并输出统一脚本模板
3. 实现子进程运行器与协作式暂停/优雅停止
4. 打通监控心跳与 REST/WebSocket 控制面
5. 接入基础指纹与反机器人配置（UA/Headers/Locale/Timezone 等）
6. 扩展代理池与指纹池、阻断回退策略
7. 完成测试与稳定性打磨，提供示例脚本与演示 UI