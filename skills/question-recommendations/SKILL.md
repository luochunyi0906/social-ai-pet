# 知乎问题推荐 · 桌宠 Skill
应用封装知乎开放平台 GET /api/v1/user/question_recommendations。输入 mode（account 或 topic）、count（默认 5，范围 1–20）、query（仅 topic，trim 后非空）；账号模式省略 Query。只使用 Title 和 Url，不预生成摘要。密钥与秒级时间戳由主进程注入。运行时为 Electron，页面主动点击才请求。
