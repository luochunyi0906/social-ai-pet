# 知乎开放平台评估与本轮采用

核对日期：2026-11-18（香港时间）。已在浏览器打开并阅读官方目录与下列核心页面。API/CLI/MCP/Skill是接口或接入方式，直答是模型服务；它们不是同一个“桌宠大模型”。

| 能力 | 对好奇心花园的用途 | 本轮决定与限制 |
|---|---|---|
| 知乎搜索 API | 关键词→真实问题/回答/文章、摘要、作者与原文 | 已实际鉴权；原生与三主题适配器测试均10/10，存在歧义结果，见V071_LIVE_ACCEPTANCE.md |
| 直答 API | 刘看山对话、主动材料的问题提炼、依据摘要解读 | 已实现独立provider，默认zhida-fast-1p5；不发送未正式支持的长度/JSON参数，不读reasoning_content；真实出题和聊天JSON已通过样本验证；完整22场景语言评测待完成 |
| 额度查询 | 查询搜索/直答每日限免次数，判断鉴权与额度 | 已在原生应用查询成功；手动联网，不自动轮询；不是钱包余额，不推断未返回项为无限或0 |
| 全网搜索 | 补充非知乎网站资料 | 已研究未接入；官方明确Filter不支持zhihu.com及子域，应使用zhihu_search做站内检索 |
| 问题推荐 | 根据主题发现真实待探索问题 | 下一优先项；默认不使用账户画像，应先让用户明确选主题 |
| 问题回答 | 用户主动展开问题下回答摘要 | 下一优先项；Summary是接口摘要/截取，不是全文；使用服务分页字段，不能按返回条数猜偏移 |
| 热榜 | 山洞里可选的“今天看看” | 后续用户主动查看，不加自动推送；热榜不是个性化相关性证据 |
| 知识库列表/上传/检索 | 用户明确授权后的资料检索 | 后续独立范围；首次初始化、知识库范围和上传授权需处理，不自动把当前文件或收藏上传 |
| 我的创作全文/评论/数据 | 本人创作回顾与分析 | 当前不接入；不能据此获得任意他人的文章全文 |
| OAuth及用户关注/收藏夹 | 将用户授权的知乎账户资料引入花园 | 当前不接入；通用搜索/直答只用Access Secret，不必为其引入OAuth。跨用户数据另有授权、费用与删除设计 |
| PDF解析 | 文字提取失败时的可选云解析 | 保持现有本机PDF.js；云解析需要上传，不能静默替代本地只读流程 |
| PPT生成 | 将选定知乎内容转为分享成果 | 范围之外；异步任务/幂等/下载需独立设计，暂不加入桌宠主链 |
| CLI / MCP / Skill | 给开发Agent封装平台能力 | 已研究，未安装或修改全局客户端；独立Electron直接HTTP调用，减少分发依赖和权限面 |

## 鉴权与传输

Access Secret从[知乎个人中心](https://developer.zhihu.com/profile)获取，填写本机model.env的ZHIHU_ACCESS_SECRET，不是OpenAI的API Key。主进程按请求生成秒级X-Request-Timestamp，时间需与服务端相差不超过10分钟。Bearer和Content-Type只发往固定developer.zhihu.com接口，禁止重定向；密钥不回传前端、不随应用或源码包分发。

## 精确接口边界

- 站内搜索GET `/api/v1/content/zhihu_search`：Query大小写精确，Count=10；不发送site:前缀，不把多关键词标题全匹配当成有效API结果的必要条件。Code=0和Data结构校验后才处理结果。
- 真实URL支持问题、`/question/…/answer/…`、`/answer/…`和专栏；两种回答URL按稳定回答标识去重，不改旧收藏ID。保留白名单UTM溯源参数用于打开，规范URL用于展示与校验。
- ContentText只作接口摘要，可能截断；没有摘要时标api_metadata，有摘要时标api_excerpt，旧RSS/Brave仍标index_only。作者、互动数据和时间只有接口提供且通过类型校验才展示。头像/认证图不自动外链加载。
- 直答POST `/v1/chat/completions`：仅model/messages/stream，当前只接fast/thinking两档支持上下文的模型。沿用已有角色提示和有限tone校验，不承诺接口支持response_format。缺密钥时无调用；错误不转为模拟成功。
- 额度GET `/api/v1/quota?APIIDs=zhihu_search,zhida_openai`：成功Code=0不代表余额充足；Data为空是无可展示配置项，不代表零或无限。接口只查询每日限免次数。

## 服务价格（本次核对，不写死到产品）

官方价格页按成功调用次数计量，人民币含税、元/千次；站内搜索20元/千次，直答Agent20元/千次，全网搜索5元/千次，热榜10元/千次。免费额度后依次使用体验余额、充值余额；余额不足时不执行。未成功的鉴权/参数/限流请求不计费。每日免费额度属于限时优惠，同一账户多个Secret共享，按北京时间00:00重置；具体次数及租户授权以账户实际查询为准。没有购买或充值。

## 官方来源

- [鉴权](https://developer.zhihu.com/docs?key=authorization)
- [知乎搜索](https://developer.zhihu.com/docs?key=zhihu_search)
- [全网搜索](https://developer.zhihu.com/docs?key=global_search)
- [直答](https://developer.zhihu.com/docs?key=zhida)
- [额度查询](https://developer.zhihu.com/docs?key=quota)
- [服务价格](https://developer.zhihu.com/docs?key=billing_price)
- [问题推荐](https://developer.zhihu.com/docs?key=question_recommendations) / [问题回答](https://developer.zhihu.com/docs?key=question_answers)
- [热榜](https://developer.zhihu.com/docs?key=hot_list)
- [知识库检索](https://developer.zhihu.com/docs?key=knowledge_search)
- [OAuth](https://developer.zhihu.com/docs?key=zhihu_oauth_integrated)
- [PDF解析](https://developer.zhihu.com/docs?key=pdf_parse) / [PPT生成](https://developer.zhihu.com/docs?key=ppt_generation)
- [CLI](https://developer.zhihu.com/docs?key=zhihu_cli) / [MCP](https://developer.zhihu.com/docs?key=unified_mcp)
