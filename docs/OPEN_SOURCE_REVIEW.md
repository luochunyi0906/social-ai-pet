# 开源方案研究与采用决定

核查日期：2026-11-17（Asia/Hong_Kong）。四个仓库均可访问、未归档；功能依据维护者README/文档，未安装整套项目。费用和适配程度为本项目工程判断，不是维护者承诺。

| 项目与类型 | 可借鉴部分 | 适配程度 | 许可证、Mac与维护证据 | 限制与成本 | 本轮采用方式 |
|---|---|---|---|---|---|
| [AIRI](https://github.com/moeru-ai/airi)，角色伙伴应用 | 角色与模型能力分层、角色表达组织、持续陪伴入口 | 机制高，整套迁移低 | 主仓库MIT；README支持macOS；本次可读取发布页有v0.15.2、11月9日发布记录，不能据缓存断言它是最新版本 | 大型工程及语音/游戏等能力会扩大依赖和验收范围；云模型另计费用 | 借鉴分层，保持现有Electron，不拷贝源码、人格或角色素材 |
| [Open-LLM-VTuber](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber)，桌面角色/对话应用 | 透明宠物模式、鼠标穿透、对话与表现分开、可中断流程 | 交互思路高，整套后端迁移低 | 后端MIT；[前端为单独许可证](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber-Web/blob/main/LICENSE)；Live2D样例素材又有独立条件。README支持Mac，发布页列v1.2.1 | 不能把全部前端和Live2D素材按后端MIT复制；语音、视觉功能增加资源和权限范围 | 仅借鉴机制，自己实现透明命中与取消，不引入摄像头、屏幕监视、录音 |
| [LangGraph](https://github.com/langchain-ai/langgraph)，Agent编排框架 | 有界会话状态、取消与持久化分离、检查点与恢复思想 | 原则高，当前引入完整框架收益低 | MIT；Python核心可在Mac运行；官方也提供JS/TS版本链接；可读取发布页包含2026年11月发布记录 | Python侧车或新框架会增加打包维护；框架不自带角色人格或模型权重 | 保持现有请求ID/AbortController与唯一行为控制器，会话仅保留最近6轮并可清除 |
| [Qwen3](https://github.com/QwenLM/Qwen3) / [Qwen3-4B模型卡](https://huggingface.co/Qwen/Qwen3-4B)，开放权重模型 | 中文理解、角色提示、未来本地推理和LoRA候选 | 候选，未安装未实测 | Qwen3-4B模型卡标Apache-2.0；模型不是Mac桌面应用，部署需推理运行时，README提供部署路线 | 模型文件和上下文占内存；本机速度与峰值内存未测，不承诺M1流畅。API托管有服务成本 | 本轮不下载权重、不训练；沿用已实现的HTTPS兼容接口，先解决实际模型配置与盲评 |

## 实际复用清单

没有新增上述项目依赖，没有复制它们的代码、角色、提示词或训练数据。本轮为机制借鉴：伙伴交互分层、可中断请求、少量人工示例、有界会话。透明窗口直接按[Electron官方窗口文档](https://www.electronjs.org/docs/latest/api/browser-window)和[鼠标穿透说明](https://www.electronjs.org/docs/latest/tutorial/custom-window-interactions)实现。

现有Electron、React、dotenv、PDF.js等锁定依赖继续使用，许可证随各依赖及Electron运行时保留。后续若真正摘用上游模块，须按具体文件许可证补充声明，不能用本次机制研究替代授权核查。

## 为什么暂不微调

当前连真实模型基线输出都没有，无法证明问题来自权重而非提示、上下文或检索质量。先用22个场景盲评原始提示与角色提示；若仍有稳定的风格问题，再收集团队原创且授权明确的对话样例，划分不进入提示/训练的留出集，评估Qwen3-4B的LoRA候选。数据清洗、算力/内存与训练费用需先测量。本轮没有训练权重，不把人设提示调校称为训练完成。

## 原始来源

- AIRI README与[许可证](https://github.com/moeru-ai/airi/blob/main/LICENSE)、[发布页](https://github.com/moeru-ai/airi/releases)。
- Open-LLM-VTuber README、[后端许可证](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber/blob/main/LICENSE)、[发布页](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber/releases)。
- LangGraph README、[MIT许可证](https://github.com/langchain-ai/langgraph/blob/main/LICENSE)、[发布页](https://github.com/langchain-ai/langgraph/releases)。
- Qwen3官方仓库与Qwen3-4B官方模型卡。未将社区移植版本的许可证当成原模型许可证。
