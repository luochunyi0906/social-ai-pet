---
name: zhida
version: 2.0.0-kanshan.1
description: 使用完整会话消息调用知乎直答的桌宠适配版
---

# 看山有伴的知乎直答

知乎官方原件及来源见同级目录中的 `manifest.json` 和 `upstream/`。桌宠使用 Electron 主进程中的 JavaScript 适配脚本 `zhida.cjs`。

主进程调用 `run({ messages }, { config, signal, timeoutMs, fetchImpl, onDelta })`。消息按原顺序传入，可含 `system`、`user`、`assistant` 和已纳入消息的会话摘要，末条由用户发言。摘要生成也使用同一入口。当前支持 `zhida-fast-1p5` 和 `zhida-thinking-1p5`。

每次运行向固定的知乎 HTTPS 地址发一次请求。聊天可传 onDelta 启用流式输出，会话摘要沿用非流式输出，二者都只使用 model、messages、stream，使用主进程提供的配置、会话取消信号和现有 HTTP 校验。只取回答正文。运行时无需 Python、外部命令或 Codex。
