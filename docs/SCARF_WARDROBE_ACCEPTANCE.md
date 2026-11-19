# 围巾表情与衣柜三视图

桌宠运行于 macOS Electron 45，界面使用 Vite、React 和 TypeScript。进入营地后点击刘看山打开聊天。通过「回家」→「衣柜」→「服装设定」浏览新增套装。现有可穿戴装扮位于「可穿戴套装」。

## 表情资源

| 原文件 | 本地 ID | 含义 |
| --- | --- | --- |
| `01.gif` | `scarf_ack` | 收到，用于自然确认 |
| `02.gif` | `scarf_hello` | 嗨，用于问候 |
| `03.gif` | `scarf_thanks` | 谢谢，用于回应关心 |
| `04.gif` | `scarf_curious` | 好奇，用于澄清及主动好奇心邀请 |
| `05.gif` | `scarf_celebrate` | 庆祝，用于播种实际保存成功后的反馈 |
| `06.gif` | `scarf_sleepy` | 哈欠，用于晚安语境 |
| `07.gif` | `scarf_hug` | 抱抱，用于温和支持 |
| `08.gif` | `scarf_cheer` | 加油，用于学习与努力目标 |

各 GIF 都有 16 帧，透明画布为 240 × 240，每帧 120 毫秒。集成资源使用逐帧像素一致的 PNG 帧图和静态代表帧，逐一核对了 128 帧及 8 张代表图。保留原图中的跳跃、文字与特效。注册信息、素材校验值及替代文字见 `desktop/scarf-stickers.json`。

直答沿用单次流式请求，模型可以在回答末尾返回形如 `[[LKS_STICKER:scarf_hello]]` 的选择标记。流式解析缓冲跨片段的标记，只查本地白名单。取消和失败会丢弃未确认的表情，原有上下文授权继续生效。会话仍存于 `chat-v1.json`，在助手消息中附上表情 ID、资源包标识和替代文字；新旧消息都可读。使用已有的自动表情开关。

播放器在收到或主动点击时逐帧播放一轮，随后显示静态代表帧。历史记录加载时显示静态图。页面隐藏、贴纸离开可视区或启用减少动态效果时，停止播放。主动好奇心接入现有邀请和冷却条件。庆祝使用当前地块已有反馈区域，只在播种存档完成后出现，不弹出聊天。贴纸播放与成年刘看山的身体动作各自管理。

## 衣柜资源

| 原文件 | 套装 ID | 显示名称 |
| --- | --- | --- |
| `1.png` | `camp-scarf` | 营地围巾套装 |
| `2.png` | `white-explorer` | 白袍探索套装 |
| `3.png` | `garden-cardigan` | 小花园开衫 |
| `4.png` | `warm-apron` | 温暖围裙套装 |
| `5.png` | `academy-suit` | 学院西装套装 |
| `6.png` | `tartan-coat` | 秋冬格纹外套 |
| `7.png` | `color-puzzle` | 彩色拼图毛衣 |
| `8.png` | `blue-hoodie` | 蓝色日常卫衣 |
| `9.png` | `gamer-hoodie` | 游戏玩家套装 |
| `10.png` | `teal-casual` | 青绿休闲套装 |
| `11.png` | `yellow-puzzle` | 黄色拼图毛衣 |
| `12.png` | `lilac-cardigan` | 淡紫针织开衫 |

每套保留内容与原图一致的 1536 × 1024 PNG，三个单视角裁成独立无损 WebP，保留白底以保护角色轮廓。围巾、小花园开衫、蓝色日常卫衣优先显示。所有新套装均标记「仅预览」，其走、跑、坐和睡眠的动作资产尚未提供。现有的森林引路者仍可穿戴。

## 修改位置

| 文件 | 修改内容 |
| --- | --- |
| `desktop/scarf-stickers.json`、`desktop/chat-stickers.cjs` | 表情资源、白名单、语义和播放元数据 |
| `desktop/chat-model.cjs`、`desktop/chat-session.cjs`、`desktop/companion-chat.cjs`、`desktop/main.cjs` | 模型选图协议、消息存档、主动开场、播种保存后的反馈 |
| `src/ChatPanel.tsx`、`src/ChatSticker.tsx`、`src/chat-stickers.css`、`src/GardenPanel.tsx` | 贴纸展示、单次播放、历史回看与场景反馈 |
| `src/HomeRoom.tsx`、`src/WardrobeDesigns.tsx`、`src/home.css`、`desktop/outfits/forest-guide.json` | 衣柜页签、套装卡和三视图 |
| `src/main.tsx`、`src/types.ts` | 场景状态与消息字段 |
| `src/assets/chat-stickers/scarf/`、`src/assets/wardrobe-designs/` | 两组新素材 |
| `tests/chat-stickers.test.mjs`、`tests/desktop-scarf-wardrobe.integration.mjs`、`tests/desktop-stickers.integration.mjs`、`tests/desktop-camp-art.integration.mjs` | 自动化和原生验收 |

## 验收结果

- 真实知乎直答 `zhida-fast-1p5`。问候返回挥手，准备学习返回加油，需要澄清时返回好奇，化学式问题返回纯文字。四轮均收到 HTTP 200，重开和重播也通过。前一轮调试遇到过限流，最终复测使用隔开的独立会话。
- 本地原生验证。覆盖跨片段标记和推理字段隐藏、取消、失败和重试、切换会话、持久化恢复、播放一次和重播、减少动态效果、主动好奇心、真实播种存盘后的贴纸反馈及旧表情选择器。
- 衣柜验证。逐套解码 12 套的正、侧、背及原三视图，验证返回房间、旧套装穿戴、睡眠与唤醒、收回桌面。900 × 740 和 600 × 560 截图以逻辑像素输出。
- 已在单屏实际应用验证角色和营地独立拖动、近距离步行、远距离跑回及营地坐标移动后的归位。未复测多显示器，也未新建系统闹钟。既有小屋回归覆盖 QQ 音乐接收请求、Mac 时钟入口和非法闹钟时间处理。
- 单元测试 105 项通过。使用 `KANSHAN_LIVE_SCARF=1 node tests/desktop-scarf-wardrobe.integration.mjs` 可用本机配置独立复测真实接口。省略环境变量则使用测试响应并以独立的临时用户目录运行。

## 回退

备份位于工程的 `backups/scarf-wardrobe-20261119/`。它包含修改前的 `source.tar.gz`、原 macOS 运行包 `看山有伴.previous-bundle` 和本机私密目录 `private/` 下的 `chat-v1.json`、`outfit-preference.json`。

1. 退出桌宠。将当前的 `release/看山有伴.app` 移到一个安全目录并去掉 `.app` 后缀，给备份的 `看山有伴.previous-bundle` 留一份副本。用 `ditto` 将其复制回 `release/看山有伴.app`，再从该路径启动。
2. 如需回退源码，先保留本轮文件，然后把 `source.tar.gz` 解到空目录核对。只复制上方清单涉及的原文件回工程。备份内原本没有的文件，可从当前工程移到单独的留存目录，包括本说明、`src/WardrobeDesigns.tsx`、两个新 JSON 清单、两个新增素材目录及新集成测试。
3. 存档默认保留。如旧版无法读取包含新贴纸的会话，退出桌宠后先把当前 `chat-v1.json` 与 `outfit-preference.json` 分开留存，再按需要将对应备份复制回 `~/Library/Application Support/看山有伴-林间预览/`。这一步会回到备份那一刻的数据，请保留之后的记录副本。

源码快照 SHA-256 为 `f513a8bf76bf11b7db7736f0e0aa9d0d4b30e836c31da929ae25031b21785bb4`。
