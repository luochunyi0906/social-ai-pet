# 天气、鼠标、山洞衣柜与窗口互动

## 操作

桌面营地右上角使用手选城市的当前气温，四舍五入到整摄氏度。气温独立于自动换装，在「模型与检索设置」可以选城市、立即更新、查看观测时间及服务错误。服务使用所选城市的公开坐标，通过 Electron 原生网络请求 Open-Meteo。打开雪地追逐开关后，可在紧凑桌宠的雪地台上快速来回移动鼠标。

用主键轻点角色可抬头，约 1.5 秒后进入原入口。1.5 秒内连点三次出现抱头泪眼和擦泪。按住角色移动至少 15 个逻辑点进入拖动，松手后按既有等待与归营规则处理。

衣柜沿用山洞彩蛋里人物实际露面后保存的进度。狐狸 Q 版可在暖木小屋浏览新服装。点缩略图试穿，左右拖动、使用方向键或点视角按钮查看一整圈。点「确认穿上」才保存。自动天气换装可临时优先应用冬装或运动装。体感 17–26°C、晴朗至多云、无撑伞和墨镜需求时，狐狸 Q 版显示用户提供的蓝白日常装。关闭自动换装后恢复手选，桌面气温继续更新。

要试窗口动作，在外貌设置选狐狸 Q 版或恢复原版，并在衣柜使用对应的默认装扮。刘看山走到合适窗口侧边约 38 个逻辑点内会自己爬上去。在刘看山身上双指点按或右键点击，选择「去窗口边上玩」，可让他主动走过去。顶部需要留出约一个桌宠的高度。停靠后，切换到另一个应用窗口可触发下落。暂停、低打扰、隐藏、拖动和打开桌宠面板时会停止自动触发。

## 素材清单

| 类别 | 当前内容 |
| --- | --- |
| 山洞衣柜 | 唐服、明服、民国学堂、汉服、校园休闲、维吾尔族服饰、苗族服饰、蒙古族服饰、藏族服饰、轻便运动装、都市冬装、蓝白雨天装 |
| 层级素材 | 伞、厚衣、围巾、轻装覆盖、墨镜、泪滴和离身雪屑 |
| 原版狐形窗口 | 看向窗边、接近、手臂抓握和腿蹬、翻上顶部、坐姿晃腿、失衡、弧线下落、落地回弹、拍雪和离开 |
| 狐狸 Q 版默认装扮 | 用户新主图、左右走路与跑步帧、背身攀爬帧、分层晃腿、落地和雪屑、发呆眼皮 |

前 11 套使用用户 ZIP 内匹配狐狸 Q 版的前视图，雨天装使用蓝白雨衣和雨伞层。它们可以试穿并保存。原版狐形用矢量骨架驱动窗口动作。狐狸 Q 版默认装扮的走跑和抓边帧提取自用户提供的 `up(1).zip`，在 `src/assets/cave/motion` 保存为透明 WebP 帧条。帧条移除了原 GIF 的整段屏幕位移，位置仍由同一个桌面控制器推进。上沿翻身复用抓边帧，停靠晃腿使用新主图的分层裁切，落地与抖落雪屑使用轻微姿态变化。狐狸 Q 版的天气厚衣和轻装使用新版参考图。左右走路、跑步各 14 帧，背身攀爬 18 帧。服装按原帧对齐，仅更新衣服区域。上沿翻身延续抓边素材，停靠、下落和拍雪沿用同一套穿搭。墨镜使用和走跑同步的独立帧层，爬行时随背身隐藏。抓握时雨伞收起挂在背带上。单独挑选的整图衣柜服装仍需适配攀爬帧。狐狸 Q 版的服装在两分钟发呆时使用轻微歪头，默认主图另外有眼皮过渡。人版轻装使用覆盖层。两类新服装的成品在 `src/assets/cave/weather/motion`，由站立参考图、以原攀爬帧为底图补绘的背面穿搭以及原始动作帧合成。

旋转预览图片位于 `src/assets/cave/turntable`。11 套服装及默认蓝白外观使用用户提供的三视图素材与现有正面图。雨天装侧面和背面由内置 ImageGen 补绘，正面取自当前雨衣图层。每套以四个静态方向展示，另一侧使用侧面镜像。

雨天装侧背面生成提示词

> Use case identity-preserve. Produce only a transparent PNG sprite sheet with two new side/rear views of the exact chibi character in these supplied references wearing his existing rain outfit. Reference one is the current approved character identity and shape. Reference two is the original turnaround with matching head, ears, thick navy outline, painted white-lavender hair and bushy tail, navy pants and white shoes; use middle and right poses as guides. Draw 2 full-body sprites side by side on an actual transparent sheet, centered separately in their halves with generous clear gutters: LEFT exact side profile, character looks screen right; RIGHT exact rear view, hair covers face with no eyes visible. Same size, feet level, all body parts visible, head/body ratio locked to references. Clothing is a plain medium periwinkle blue rain jacket (#5379BB), soft pale off-white zipper and trim, and the same dark pants, white shoes, and fluffy white tail. Include a simple open muted teal-blue hand-held umbrella (#4E85A6) with navy outline, a thin navy stem and pale blue ribs. Match clear painted outlines and the established drawing, no face changes, no generic redesign, no distortions or rendered 3D. Keep tail under the umbrella so silhouette reads clearly. No text, no labels, no background, no drop shadows, no floor. The two drawings will be individually cropped for the local in-app clothing preview.

## 实测记录

- 本机原生签名包从香港实况读取气温 15.6°C，桌面显示 16°C。用隔离档案注入 20.4°C、0°C 和无法取得读数，确认了晴好换回蓝白日常图、关换装恢复手选、标签穿透和切换城市时不保留上一城市的温度。

- macOS 隔离档案检查锁定的穿戴请求和衣柜、实际彩蛋解锁、一次性提示、12 项、试穿后确认、重启恢复及模拟冷雨天气应用衣柜装扮。
- `node tests/desktop-cave-wardrobe.integration.mjs` 检查实际视频解锁、13 组视角、按键及拖动、600 × 560 小窗、试穿取消和重启恢复。
- `node tests/desktop-daydream.integration.mjs` 以可控时钟检查 2 分钟界限、眼皮中间帧和互动重计时。`node tests/desktop-fox-motion.integration.mjs` 用隔离档案和测试光标坐标核对两种归营步态。狐狸 Q 版另用两个独立 AppKit 窗口验证实际抓边、翻上标题栏、晃腿及切窗后的单次甩落。
- 使用两个隔离的原生 macOS 应用窗口验证窗口采样和整个攀爬链。真实切窗触发一次失衡、甩落、落地、拍雪和离开。首次候选包出现的浮点坐标崩溃已修复，坐标由统一移动出口取整。切窗时并发的显示器变更通知现在重新校验边界。
- 使用独立 AppKit 浮窗验证靠近侧边自动触发、爬升与停靠，以及切换应用后的单次落地。攀爬中保留了由同一轮真实天气触发的厚衣。
- 这轮动作素材在签名应用和隔离档案中检查。注入低温、炎热强日照和冷雨观测，实测近距离走回、远距离跑回及真实 AppKit 窗口的自动攀爬，核对动作帧实际播放和停靠、切窗及走开时的穿搭。未解锁的低温测试使用基础走跑帧。
- 原生鼠标事件验证单击抬头和原入口、三连点与擦泪、15 点拖动阈值及悬空动作。雪地追逐以固定随机值验证命中分支及离开停止。
- 天气解析、阈值与确认、晃动检测、窗口范围和窗口调度有自动测试。改用 Electron 原生网络后，签名应用在本机读到香港 Open-Meteo 当前数据，样本体感 12.2℃，触发了厚衣。冷雨组合、切换后恢复手选和随机追逐使用测试输入。炎热、强日照的实况及多屏物理攀爬尚待逐项实测。

窗口验收使用了独立运行的 AppKit 测试应用。测试录屏为本地验收产物。

## 构建与回滚

运行 `npm test` 和 `npm run package:mac`。编译窗口元数据辅助程序需要 macOS Command Line Tools。当前机器存在较新的 SDK 和较旧的链接器，构建使用 `KANSHAN_MAC_SDK=/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk`。辅助程序只读取窗口编号、进程、前台和矩形边界。测试录屏使用单独的系统录屏命令。



接口依据：[Open-Meteo Forecast API](https://open-meteo.com/en/docs)，[Apple CGWindowListCopyWindowInfo](https://developer.apple.com/documentation/coregraphics/cgwindowlistcopywindowinfo(_:_:))。
