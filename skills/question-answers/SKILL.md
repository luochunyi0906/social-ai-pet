# 知乎问题回答 · 桌宠 Skill
这是桌宠对知乎问题回答 API 的本地封装。通过固定的 HTTPS GET 路径 /api/v1/content/question_answers 请求单页回答摘要，复用主进程 Bearer 密钥及当前秒级时间戳。每次由用户主动打开或点击下一页。只使用服务返回的 NextOffset，不推算，不自动翻页。不运行外部命令，运行时为 Electron。
