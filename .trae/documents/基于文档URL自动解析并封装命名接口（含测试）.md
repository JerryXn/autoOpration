## 问题纠偏
- 不再使用 doc_id 作为参数或标识
- 直接访问你给的文档 URL（如 `https://api.itapi.cn/user/doc?id=85`），从页面内容提取“接口地址”与“接口名称”，据此生成命名接口（如“小红书热榜”）

## 封装方案
- 新增 `DocParser`：
  - 输入：文档 URL 数组
  - 输出：`{name, endpoint}`（name 来自页面标题，如“小红书热点/360热搜”，endpoint 来自页面中的 `https://api.itapi.cn/api/...`）
  - 实现：请求 HTML → 正则提取接口路径与标题 → 归一化 `name`
- 客户端改造：
  - 只读 `.env` 的 `API_KEY`
  - 提供命名方法（按文档页名称），如：
    - `get_xiaohongshu_hot_items()` → `api/hotnews/xiaohongshu`
    - `get_news_items()` → `api/news/news`
    - `get_hot_7x24_items()` → `api/news/24hours`
    - `get_hot_360_items()` → `api/hotnews/360`
    - `get_kuaishou_hot_items()` → `api/hotnews/kuaishou`
    - `get_tieba_hot_items()` → `api/hotnews/tieba`
    - `get_baidu_hot_items()` → `api/hotnews/baidu`
    - `get_toutiao_hot_items()` → `api/hotnews/toutiao`
    - `get_weixin_hot_items()` → `api/hotnews/weixin`
    - `get_weibo_hot_items()` → `api/hotnews/weibo`
    - `get_douyin_hot_items()` → `api/hotnews/douyin`
    - `get_bilibili_hot_items()` → `api/hotnews/bilibili`
    - `get_all_hot_items()` → `api/hotnews/all`
  - 每个命名方法：调用统一 `call_endpoint(endpoint, {key})` → 归一化为 `{name,url,heat,time}`
- 归一化与解析：
  - `name`：优先 `name/title`
  - `url`：优先 `url/link`
  - `heat`：`viewnum/hot/index/pv/read/views`；支持单位解析（`w/亿`），失败保留原文
  - `time`：`date/publish_time/time`

## 单元测试（打印真实返回）
- 新增测试文件：`test_itapi_named_endpoints.py`
- 用例：
  - `test_parse_doc_urls_to_endpoints`：对每个文档 URL 解析并断言 `{name, endpoint}` 非空
  - `test_named_interface_call_raw_and_items`：逐个命名方法调用，打印“原始返回 success_raw”和前三条统一结构 `sample`
  - `test_heat_parse_units`：校验热度单位解析
  - `test_aggregate_and_dedup`：多源合并、打印数量与样例，并按 `url/name` 去重
- 打印：使用 `-s` 展示测试输出；每条测试均打印原始返回和统一结构样例

## 运行与依赖
- `.env`：只需 `API_KEY`
- 运行：
  - 全部：`pytest -q auto_opration_python/tests/test_itapi_named_endpoints.py -s`
  - 单个接口：例如 `pytest -q auto_opration_python/tests/test_itapi_named_endpoints.py::test_named_interface_call_raw_and_items[xiaohongshu_hot] -s`

## 交付
- 实现 `DocParser` 并更新客户端为命名方法（以上列表）
- 添加覆盖所有接口的命名测试，打印“成功的原始返回”与统一结构样例
- 移除 doc_id 语义的曝光与打印，全面改为“按文档 URL→接口名称→命名方法”