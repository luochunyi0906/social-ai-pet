# 看山有伴 · 主动陪伴、独立拖动与等你来答

## 打开方式

退出旧桌宠后，打开项目里的 `release/看山有伴.app`。

- 主动聊天在「模型与检索设置」中开启，默认关闭。若希望刘看山主动聊热榜，同时在「今日好奇心 → 今日热榜 → 推送设置」开启每日提醒。主动开场沿用这套热榜缓存和每日调度。
- 拖住刘看山可以单独移动角色。用雪地营地右下角的小把手移动营地，松手后从结束互动开始等 15 秒。目标为营地当前站位。点击离营角色可聊天，在聊天窗口关闭后重新计时。暂停、睡眠和隐藏暂停归位。
- 「等你来答」位于「营地 → 好奇心山洞 → 今日热榜 → 等你来答」。默认按主题。按账号推荐对应本机 Access Secret 所属的知乎账号。
- 「查看视觉示例」使用固定五条示例，正式结果只来自知乎。查看问题回答摘要需要点击独立按钮，并可按服务返回的下一页偏移继续。

## 接入与数据

官方知乎 CLI Skill 0.7.5 包含两个不同的命令。桌宠保留了官方定义及相关 HTTP 和 CLI 文档，从 Electron 主进程运行两个独立的适配入口，沿用本机密钥和秒级时间戳，无需安装外部 CLI 或 Python。[官方 CLI Skill](https://developer-cdn.zhihu.com/zhihu-cli/releases/stable/skill/zhihu-cli-skill.zip)

| 功能 | 运行入口 | 数据与限制 |
| --- | --- | --- |
| 等你来答 | `skills/question-recommendations/index.cjs` | `/api/v1/user/question_recommendations`。账号模式省略 `Query`，主题模式去掉首尾空白。只有标题和链接。 |
| 回答摘要 | `skills/question-answers/index.cjs` | `/api/v1/content/question_answers`。摘要和截取文本来自知乎服务。只用返回的 `NextOffset` 翻页。 |
| 共享额度 | `desktop/search.cjs` | 用户主动查询 `question_discovery`，没有接口结果时显示暂不可查。 |
| 主动开场 | `desktop/companion-chat.cjs`、`src/CompanionInvitation.tsx` | 开场用本地文案，从成功取得的当日热榜或日常话题挑选。仅在记忆中找到明确邀请时跟进旧事。用户接话后才将开场存入会话并授权调用模型。 |
| 离营行为 | `desktop/roaming.cjs`、`src/RoamingCompanion.tsx` | 独立透明角色窗口，复用同一个角色动作与装扮。默认形象使用已有步行动画。森林引路者缺少步行帧，使用平滑位置移动。 |

推荐缓存保存在 `question-recommendations-v1.json`，按密钥指纹和提交条件隔离。原密钥不进缓存或渲染层。收藏使用既有手账，主动聊天频率和当日去重保存在 `companion-chat-v1.json`。已接话的开场和具体来源使用现有会话文件。没有接话时不会为每次邀请创建会话。

新增页面仍以 900 × 740 为目标。参考图 1383 × 1137 像素，纸面板预计从逻辑 x=13、y=135 开始，采用原阅读页 58%／42% 双栏。文字、控件和滚动区域独立。成年角色沿用现有正面素材，参考图角色为侧转效果。保留原生无边框窗，用返回箭头代替参考图左上角示意灯。小窗切换列表与详情。真实内容的换行取决于知乎返回标题。

## 回退

完整开发开始前的源码快照为 `/tmp/kanshan-companion-rollback.mTSnXU/source.tar.gz`，SHA-256 为 `1a5f0775c60469e97e2bd2b88c22823b12edd6f6eed783fec6c9a66cfa00a769`。新增推荐前的快照为 `/tmp/kanshan-recommendation-rollback.soAvOO/source.tar.gz`。系统退出桌宠后可换回保留的上一个签名应用。回退前保留最新源码和用户资料，按变更范围恢复源码或替换应用，原手账、会话与本机配置留在应用数据目录。

## 源码索引

- 交互与页面位于 `src/main.tsx`、`DesktopPet.tsx`、`desktop-pet.css`、`ModelPanel.tsx`、`ChatPanel.tsx`、`HotList.tsx`、`HotIcon.tsx`、`Recommendations.tsx`、`recommendations.css`、`QuestionAnswers.tsx`、`CompanionInvitation.tsx`、`RoamingCompanion.tsx` 和 `types.ts`。
- 原生宿主及扩展位于 `desktop/main.cjs`、`preload.cjs`、`skills.cjs`、`search.cjs`、`chat-model.cjs`、`chat-session.cjs`、`companion-chat.cjs`、`roaming.cjs` 和 `recommendations.cjs`。
- 官方参考与两个适配位于 `skills/zhihu-cli-reference/`、`skills/question-recommendations/` 和 `skills/question-answers/`。打包入口是 `scripts/package-mac.cjs`。
- 回归入口是 `tests/companion-extension.test.mjs` 与 `tests/desktop-companion-extension.integration.mjs`。营地拖动的旧测试按新的独立把手更新。

## 验收结果

- 最终签名包在 Mac 实机启动。真实热榜于香港时间 03:42:14 获取，刘看山发出邀请，用户接话后真实直答 HTTP 200。请求使用原条目的链接，重开保留开场和会话。同一日热榜邀请未重复。
- Mac 单屏实测中，营地在 (24, 714) 保持原位，独立角色到 (1356, 70)。确认 15 秒前保持原地、随后位置开始变化、途中点击能截停。聊天打开超过 15 秒时角色未移动，关闭后归回营地移动后的站位。未使用物理多显示器验收。
- 两种真实推荐均为 HTTP 200、业务 Code 0，各返回 5 条。主题输入首尾空白被去掉，账号请求只有 `Count=5`。清空输入、切页和修改表单不发新请求。原文链接核对至原生打开入口，实测收藏、标题范围的聊天卡片、回答摘要和重启缓存。
- 真实问题回答返回摘要和服务偏移。缺失偏移中止、空结果和各业务错误通过模拟测试。共享额度真实接口返回 `question_discovery`。
- 89 项单测通过。专注标记、睡眠、稍后、当天安静及普通日常开场在受控时钟下核对。未等设备自然跨日，也未完全退出当前 Codex 客户端再试。
- 900 × 740 逻辑像素截图按 CSS 像素从实际桌面窗口导出，五条例题在同一屏可见。文件在 `artifacts/companion-extension/`，同目录 `acceptance.json` 是脱敏的实机记录。
- 旧签名包已保留于 `/tmp/kanshan-companion-rollback.mTSnXU/看山有伴.app`。
