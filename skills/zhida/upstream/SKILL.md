---
name: zhida
version: 2.0.0
description: 使用简洁的问答参数调用知乎直答，支持非流式和流式输出
homepage: https://developer.zhihu.com/console/docs?key=zhida
metadata: {"openclaw":{"emoji":"💬","requires":{"bins":["python3"]}}}
---

# Zhida Skill

通过 `POST /v1/chat/completions` 调用知乎直答。

## 认证

设置 `ZHIHU_ACCESS_SECRET`。可选设置：

- `ZHIHU_OPENAPI_BASE_URL`：默认 `https://developer.zhihu.com`
- `ZHIHU_ZHIDA_URL`：完整 endpoint，优先级更高

## 调用

非流式调用：

```bash
python3 {baseDir}/scripts/zhida.py '{"query":"如何理解 rave 文化","model":"zhida-thinking-1p5"}'
```

流式调用；需要回答文本时指定 `output=text`：

```bash
python3 {baseDir}/scripts/zhida.py '{"query":"简短回答","stream":true,"output":"text"}'
```

请求参数：

- `query` 必填，是用户问题。
- `model` 默认 `zhida-fast-1p5`，也支持 `zhida-thinking-1p5`、`zhida-agent`。
- `stream` 默认 `false`。
- 非流式只支持 `output=json`；流式支持 `output=sse` 或 `output=text`。

## 响应参数

非流式 JSON 包含 `id`、`object`、`created`、`model` 和 `choices`。每个 `choices` 元素包含 `index`、`message` 和 `finish_reason`；`message` 包含 `role`、`reasoning_content` 和 `content`。

流式 `output=sse` 返回 Chat Completions 增量事件和结束事件 `[DONE]`；`output=text` 返回回答正文。

命令失败时以非零状态结束。根据错误信息检查输入参数、模型名称、认证配置、网络状态或调用频率。
