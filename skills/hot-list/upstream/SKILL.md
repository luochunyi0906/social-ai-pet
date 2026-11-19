---
name: hot-list
version: 2.0.0
description: 获取知乎热榜标题、摘要、缩略图和内容链接
homepage: https://developer.zhihu.com/console/docs?key=hot_list
metadata: {"openclaw":{"emoji":"🔥","requires":{"bins":["python3"]}}}
---

# Hot List Skill

通过 `GET /api/v1/content/hot_list` 获取知乎热榜。

## 认证

设置 `ZHIHU_ACCESS_SECRET`。可选设置：

- `ZHIHU_OPENAPI_BASE_URL`：默认 `https://developer.zhihu.com`
- `ZHIHU_HOT_LIST_URL`：完整 endpoint，优先级更高

## 调用

```bash
python3 {baseDir}/scripts/hot-list.py '{"limit":10}'
```

`limit` 默认 30，并限制到 1-30。

## 响应参数

- `Code`：状态码，`0` 表示成功。
- `Message`：状态说明。
- `Data.Total`：热榜结果总数。
- `Data.Items`：热榜列表；每项包含 `Title`、`Url`、`ThumbnailUrl` 和 `Summary`。

命令失败时以非零状态结束。根据错误信息检查认证配置、网络状态或调用频率。
