## 结论（基于你提供的 raw_json）
- 该条目包含 `id` 与 `xsec_token`，解析函数会生成 `note_url`，因此“URL 为空”的情况更可能发生在系统表 `notes(url)`，而非采集表 `op_notes(note_url)`。
- 图片在搜索结果中嵌套为 `note_card.image_list[].info_list[].url`，直接按顶层 `image_list` 写库会拿不到 URL，导致 `op_images` 为空；需要从详情 `feed` 或对该结构做深度提取。

## 只读排查 SQL（在 `auto_final`）
- 验证采集表是否完整（按标题或 id）：
```
SELECT note_id,note_url,title,JSON_VALID(raw_json) AS jv,
       JSON_EXTRACT(raw_json,'$.note_card.image_list[0].info_list[0].url') AS sample_img
FROM op_notes
WHERE note_id='662b044100000000010330ee' OR title LIKE '元气早午餐%'
LIMIT 5;
```
- 对比系统表是否“看起来空”：
```
SELECT id,url,title FROM notes WHERE title LIKE '元气早午餐%' LIMIT 5;
```
- 分类统计（采集表）：
```
SELECT 
  COUNT(*) AS total,
  SUM(CASE WHEN raw_json IS NULL THEN 1 ELSE 0 END) AS no_raw,
  SUM(CASE WHEN JSON_VALID(raw_json)=0 THEN 1 ELSE 0 END) AS invalid_json,
  SUM(CASE WHEN note_url IS NULL THEN 1 ELSE 0 END) AS no_url
FROM op_notes;
```
- 解析缺失（原文有但缺 id）示例：
```
SELECT note_id,title
FROM op_notes
WHERE JSON_VALID(raw_json)=1
  AND (JSON_EXTRACT(raw_json,'$.id') IS NULL AND JSON_EXTRACT(raw_json,'$.note_id') IS NULL)
LIMIT 20;
```
- URL 构造失败（有 id 但没有生成 URL）：
```
SELECT note_id,title,
  JSON_EXTRACT(raw_json,'$.xsec_token') AS raw_token,
  JSON_EXTRACT(raw_json,'$.user.xsec_token') AS raw_user_token
FROM op_notes
WHERE JSON_VALID(raw_json)=1
  AND (JSON_EXTRACT(raw_json,'$.id') IS NOT NULL OR JSON_EXTRACT(raw_json,'$.note_id') IS NOT NULL)
  AND note_url IS NULL
LIMIT 20;
```

## 预期判断
- 若系统表 `notes(url)` 为空但 `op_notes(note_url)` 正常：原因是查看了非采集目标表；可用视图或迁移对齐。
- 若 `op_notes.raw_json` 为空：属“未获取原文”，检查是否关闭了 `store_raw_row` 或仅走搜索页简项。
- 若 `raw_json` 有值但 `image_list` 为嵌套结构：属“解析缺失图片 URL”，需要追加对 `info_list[].url` 的提取或走详情 `feed`。

## 下一步
- 我将按上述 SQL 执行只读排查并输出分类结果与示例行；若确认为解析缺失，将给出具体字段提取方案（`image_list[].info_list[].url` 与主题路径）。