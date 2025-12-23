## 目标调整
- 取消所有 CLI 参数，改为单一配置文件驱动运行。
- 使用 Maven 构建，提供清晰的模块结构与完整注释。
- 保留/继承会话登录态，解决单例锁并复制原目录数据。

## 配置文件
- 文件名：`config.yaml`（项目根目录或 `~/.autoOperation/automation.yaml`）
- 解析库：`jackson-dataformat-yaml`（支持 YAML）
- 示例（带注释）：
```yaml
# 关键词（搜索框输入）
kw: "美食"
# 列表采集上限
limit: 5
# 是否在新标签页打开详情
newTab: true
# 是否打印列表（供核对链接）
saveList: false
# 是否仅采集首屏（不滚动）
noScroll: false
# 平台代码（会话目录名）
plat: "xhs"
# 起始地址（为空则使用默认首页）
url: ""
# 用户数据目录（为空则使用 ~/.autoOperation/playwright/<plat>）
userDataDir: ""
# 随机等待（毫秒）
randomDelayMinMs: 500
randomDelayMaxMs: 1000
# 浏览器语言/时区
locale: "zh-CN"
timezone: "Asia/Shanghai"
# 是否无头（调试时建议 false）
headless: false
```

## 项目结构（Maven）
- 依赖：
  - `com.microsoft.playwright:playwright`
  - `com.fasterxml.jackson.core:jackson-databind`
  - `com.fasterxml.jackson.dataformat:jackson-dataformat-yaml`
  - `org.slf4j:slf4j-api` + `ch.qos.logback:logback-classic`
- 包与类：
  - `app/AutomationApp`：入口，加载 `config.yaml`，串联流程
  - `config/Config`：POJO 与 `ConfigLoader`（查找路径：项目根 → 用户目录）
  - `core/SessionManager`：持久化上下文，锁冲突复制回退（保留登录态）
  - `core/Wait`：随机等待（读取配置的 min/max）
  - `core/Locators`：`getSearchInput/getListCards/getDetailRoot`
  - `core/Actions`：`search`、`openInNewTab`
  - `extract/ListCollector`：`collectSearchList(page, {limit, scroll})`
  - `extract/DetailExtractor`：`extractRequired(page)`（返回最小字段集）
  - `model/ListItem`、`model/NoteSummary`

## 会话登录态与锁处理
- 使用 `launchPersistentContext(userDataDir)` 保留会话
- 捕获 `SingletonLock/profile in use` 错误：
  - 新建目录 `~/.autoOperation/playwright/<plat>-<timestamp>`
  - 复制原目录（跳过锁文件），改用新目录启动

## 流程逻辑（读取配置）
- `AutomationApp`：
  - `Config cfg = ConfigLoader.load()`
  - `SessionManager.start(cfg)` → `page`
  - `Actions.search(page, cfg.kw)`
  - `ListCollector.collect(page, {limit: cfg.limit, scroll: !cfg.noScroll})`
  - 如 `cfg.saveList==true`，打印列表 JSON
  - 打开第一条详情（`cfg.newTab` 控制方式）
  - `DetailExtractor.extractRequired(page)` → 打印单一 JSON

## 输出
- 控制台仅打印：
  - 可选：`{"list": [...]}`（当 `saveList: true`）
  - `{"author":...,"title":...,"text":...,"images":[],"published_at":...,"comments_count":...,"url":...}`

## Maven 构建
- `maven-shade-plugin` 打包 Fat JAR，`Main-Class=app.AutomationApp`
- 运行：`java -jar automation.jar`（无需任何参数）
- 配置查找：优先项目根 `config.yaml`；不存在则使用 `~/.autoOperation/automation.yaml`

## 注释规范
- 所有公共类与方法提供 Javadoc 注释（用途、参数、返回值）
- 关键定位与兜底策略在方法注释中说明。
- `config.yaml` 示例中逐项含中文注释，确保可读。

## 与 Node 集成（保留 npm start）
- 点击“执行”时由 Node 子进程调用：`spawn('java',['-jar','automation.jar'])`
- Java 读取 `config.yaml` 并输出结果；Node 读取 stdout，转发给前端。

## 验证
- 使用已有登录态目录验证首屏与滚动两种模式
- 观察 `images` 列表（含 `live-img/data-src/srcset/background-image`）
- 锁冲突场景验证目录复制回退。

确认后，我将按此方案生成 Maven 项目骨架与实现，并附带 `config.yaml` 模板与注释。