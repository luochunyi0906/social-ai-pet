# 知乎直答 Skill 接入与种子箱布局验收

2026 年 11 月 19 日 · 看山有伴 v0.9.9 · Apple 芯片 Mac

## 启动与配置

打开 `release/看山有伴.app`，或双击项目里的 `Launch-Kanshan.command`。在营地点「和刘看山聊聊」，填入消息并确认发送本轮和必要的会话上下文。

直答使用本机 `model.env` 或环境变量。独立应用的主要配置路径为 `~/Library/Application Support/看山有伴-林间预览/model.env`。这个预览版还可沿用同一账号在旧预览配置中已保存的知乎密钥，隔离测试使用本机已有的密钥及独立的测试档案。

| 配置项 | 用途 |
| --- | --- |
| `CHAT_PROVIDER=zhida` | 默认聊天服务 |
| `ZHIDA_MODEL=zhida-fast-1p5` | 默认模型，可显式改为 `zhida-thinking-1p5` |
| `ZHIHU_ACCESS_SECRET` | 本机配置的知乎访问密钥，仅由主进程读取 |

## 安装与实际调用

| 路径 | 职责 |
| --- | --- |
| `skills/zhida/upstream/SKILL.md`、`skills/zhida/upstream/scripts/zhida.py` | 从知乎官方下载、逐文件校验的 2.0.0 原件 |
| `skills/zhida/manifest.json` | 记录下载地址、压缩包和文件哈希、上游版本、桌宠运行入口 |
| `skills/zhida/kanshan/SKILL.md`、`zhida.cjs` | 桌宠适配说明和 JavaScript 执行脚本，接收完整 `messages` |
| `desktop/skills.cjs` | 主进程加载并注册 `zhida`，只执行已登记的本机实现 |
| `desktop/chat-model.cjs` | 直答回答和摘要经已注册 Skill 执行，其他模型继续走各自原有路径 |
| `desktop/model.cjs` | 共用 HTTPS 传输、鉴权、取消、超时、业务错误和完成状态校验 |
| `scripts/package-mac.cjs` | 将原件和桌宠适配版一起纳入 `Contents/Resources/app/skills/zhida/` |
| `src/camp.css` | 将种子箱本体和标签整体上移，为 A1 植物预留空间 |

[知乎直答 Skill 官方下载](https://developer.zhihu.com/download/zhida_skills.zip)

发送路径为「聊天面板 → 主进程会话服务 → 组装近期对话及必要摘要 → 直答 Skill → 知乎 → 保存并显示回复」。答复只取正文。普通回复经同一入口发一次非流式 POST。到达预算并需要压缩时，摘要是单独的一次有界请求。桌宠使用随包提供的 Electron Node 运行时，无需安装 Python、启用 Codex、启动开发服务器或调用 Shell。

## 实测与覆盖范围

| 验收事项 | 结果 | 依据 |
| --- | --- | --- |
| 文件集成 | 通过 | 核对签名应用中官方 `SKILL.md`、Python 工具的 SHA-256 与适配入口 |
| 技能注册 | 通过 | 独立桌宠启动后，主进程返回 `skillId=zhida` |
| 真实直答 | 通过 | UI 点击发送，三次均 HTTP 200 且成功存入回答正文。每次恰好一条普通回复请求，耗时 2.6–4.0 秒 |
| 真实会话记忆 | 通过 | 即时追问答出「雪松，12 月 8 日」。退出并重启桌宠后答出「小林、雪松、12 月 8 日」。核对请求中有按序的历史用户和助手消息 |
| 摘要、隔离、取消、失败重试 | 模拟回归通过 | 在当前发布应用跑 9 组原生界面用例。模拟验证摘要传递、原始消息保留、隔离及中断，不用于评价模型回答质量 |
| 标签可读性 | 通过 | 新发与恢复的消息分别显示「你：」和「刘看山：」 |
| 种子箱与花朵 | 通过 | 900×740、720×620、600×620 下，箱体和标签离 A1 花朵的最小垂直间距分别为 30、24、20 CSS 像素。点击箱子标签能选种，点击 A1 能查看植物 |
| 完全退出 Codex 后再启动 | 未执行 | 本轮通过已签名的独立 Mac 应用、隔离档案和仅含系统路径的运行环境完成测试，验收时 ChatGPT/Codex 客户端仍开着 |

真实用例用虚构资料，记录在 `artifacts/chat-real-zhida-skill.json`。模拟回归在 `artifacts/chat-fixture-zhida.json`。实际应用截图为 `artifacts/native-seed-clearance-900x740.png`、`native-seed-clearance-720x620.png` 和 `native-seed-clearance-600x620.png`。另有 83 项单测与 6 项传输测试通过。

## 回退

需要回滚时，先退出桌宠，再用此前保留的应用包或源码恢复。应用数据目录继续沿用。
