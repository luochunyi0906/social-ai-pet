# 刘看山是活的 · 陪听、捏脸与看山敲敲

## 怎么用

- **陪听**。右键或双指点按刘看山，选择「陪听」。当前默认输出切到可识别的耳机时，桌宠在原地戴耳机并出现一个小入口。只想看看时可以收起小面板。手动戴耳机、摘下或结束陪听均可在面板内操作。与当前输出设备的判定独立。
- **捏脸**。在桌面上的狐狸 Q 版或人版脸颊停约 400 毫秒，等轻微亮点出现，再按住该侧往外拉。松手后脸颊回弹。快速按住拖仍可拖动整只角色，短点击仍可使用原入口。当前支持可定位的站立立绘，整图衣柜和强日照墨镜时暂停该热点。
- **看山敲敲**。在桌面刘看山身上快速双指点两下，或连按两次鼠标右键，即可开始并敲第一下。之后用普通左键点他继续敲。再次双指点两下或按 Escape 退出。单次双指点按仍打开原生菜单，里面也有「敲敲」。第 5 和第 10 下各有一次反馈。音量固定为低音量，陪听时静音。

面板显示音频路由或手动状态。林间夜曲是程序实际播放的固定曲目，提供播放、暂停和音量。现有「选本地歌曲」和「打开 QQ 音乐」仍由 QQ 音乐客户端负责播放。收起、暂停、隐藏、休眠和路由改变会停止小面板产生的声音。陪听动作与音乐节奏各自独立。

## 素材和主要代码

| 内容 | 文件 | 用途 |
| --- | --- | --- |
| 蓝白 Q 版和人版原立绘 | [角色素材](../src/assets/cave/) | 复用当前模型、外貌编号和各自动作 |
| 戴耳机底图 | [蓝白日常](../src/assets/cave/interactions/listening.webp) · [轻装](../src/assets/cave/interactions/listening-hot.webp) · [人版](../src/assets/cave/interactions/listening-human.webp) | 当独立耳机戴在头上时使用，天气衣着与当前外貌继续对应原素材 |
| Q 版左右闭眼纹理 | [左眼](../src/assets/cave/interactions/eye-left.webp) · [右眼](../src/assets/cave/interactions/eye-right.webp) | 局部裁切，保留基础立绘，支持单眼和双眼表情 |
| 独立耳机、扶耳机手、局部脸颊、眯眼及耳朵图层 | [FaceInteractionArt](../src/FaceInteractionArt.tsx) | 按 Q 版和人版注册对应坐标。捏脸只拉伸带边缘渐变的脸颊区域，位移向上限衰减 |
| 蓝白软槌、碰击星、短文字提示、桌面上浮提示 | [DesktopKnock](../src/DesktopKnock.tsx) 与 [动作样式](../src/pet-interactions.css) | 对照上传参考图制作分层道具和动画 |
| 林间夜曲、软槌短音 | [夜曲](../public/room/night-music.wav) · [离线合成短音](../public/room/soft-tap.wav) | 夜曲沿用项目资源。软槌短音为新制音效，前置约 65 毫秒用于对齐击中 |
| 音频默认输出 | [原生辅助程序](../desktop/native/audio-output.m) · [状态与防抖](../desktop/listening.cjs) | 通过 Core Audio 监听默认输出，补读同一设备的出声端口。可识别硬件端口和受约束的耳机设备名称，未知输出支持手动。 [Apple Core Audio](https://developer.apple.com/documentation/coreaudio/audioobjectaddpropertylistener%28_%3A_%3A_%3A_%3A%29) |
| 手势与桌面调度 | [useCheekGesture](../src/useCheekGesture.ts) · [现有归营调度](../desktop/roaming.cjs) | 悬停准备后优先捕获脸颊，有效向外才拉扯。中断时释放指针并恢复归营计时 |

原版狐形保持自己的立绘，支持使用两个面板。狐狸 Q 版和人版使用各自的脸部定位。头显和局部脸部效果在站立素材上表现。优先播放正在运行的走跑、攀爬或拖起动画，回到站立后再显示当前陪听状态。日常耳机属于本次普通互动道具，山洞衣柜服装仍经过原有解锁检查。

## 衣柜与人版天气

右键选择「回家」，在暖木小屋打开衣柜。原版只保留绿色「森林引路者」，可通过「恢复默认装扮」切回白色刘看山。狐狸 Q 版的六套山洞服装沿用彩蛋解锁。走路、跑步、抓窗、翻上窗沿、坐稳、落地、拖起和归营都会保留手选服装。原版保留同一圆身、黑鼻和细黑手脚，服装与三视图同源。

人版沿用日常蓝白装，并增加 [短袖](../src/assets/cave/weather/human/hot.webp)、[雨衣](../src/assets/cave/weather/human/rain.webp) 和 [墨镜风衣](../src/assets/cave/weather/human/sun.webp)。发现山洞彩蛋后，可以在衣柜分别试穿并保存。选择「恢复自动换装」按手选城市的观测切换。人版和狐狸 Q 版仍优先使用手选服装。自动换装下，已解锁的三种外观遇雨穿蓝色戴帽雨衣，低温沿用日常或用户手选服装。雨天优先于高温和强日照表现。

三种雨衣的正面使用用户提供的透明立绘。原版侧身、人版侧面和背面、Q 版侧面、背面及悬空使用内置 imagegen 参照对应原图补齐。补绘提示词要求保留原角色比例、配色和浅蓝透明材质，让帽口和衣领连成一体，保留帽檐、反光和五官，背景透明。Q 版走跑和攀爬将同一套雨帽对齐到动作帧。雨衣造型隐藏额外的陪听耳机道具，陪听状态和控制仍可使用。

原版和人版切窗后保留雨衣，落地直接站立，再交回原有归营计时。录制动作参考 GIF 时，窗沿和地面是用于观察动作的参考线。Q 版的雨衣单独预留帽尖边界。

### 狐狸 Q 版六套服装

山洞彩蛋解锁后，衣柜里可试穿及确认明服、汉服、民国学堂、苗族服饰、藏族服饰和都市冬装大衣。转台可拖动一圈，每 45° 一帧。正脸、左侧和背面使用「拟人服饰」提供的透明三视图，右侧和四分之三角度使用内置 imagegen 补绘。补绘按原图保留头饰、衣领、袖口、纹样、配件和比例。蓝白雨衣随既有天气规则出现，手选仍优先。退役服装的旧记录回到默认外观。

[服装资源目录](../src/assets/cave/outfits-q)包含站立、提起、左右走跑、攀爬和坐姿逐帧图。动作取用对应参考图的袖口和鞋，保持帽饰及衣身原画。确认穿上前会解码所需动作图和转台。日常外观的视线及陪听服饰叠层使用原画自己的坐标；六套参考立绘保留原画配饰和脸部，音频状态照常生效。制作时使用 `python3 scripts/import-fox-reference-wardrobe.py <三视图目录> <补绘目录> src/assets/cave/outfits-q`。补绘输入按服装 ID 命名，原生参考原图保留在用户资料目录。

### 人版与原版的动作和衣柜

原版默认造型使用[原版三视图](../src/assets/wardrobe-designs/default)分层驱动手脚。[人版角度图](../src/assets/cave/weather/human/angles) 与现有五张正面立绘配合，[人版动作](../src/HumanBodyMotion.tsx) 使用实际图层来抬腿、屈膝、抓窗与摆腿。衣柜支持正面、侧面、背面与镜像侧面。三种形态沿用同一原生窗口定位和位移控制。

人版新角度图使用内置 imagegen。先以原正面为角色参考，生成同一站姿的左侧和背面双栏透明素材，保留白发、身形、手脚与挎包。再以该双栏素材为编辑底图，分别参考现有正面短袖、雨衣、墨镜风衣，保持各角度的角色与站位，只更换衣服。晴装的墨镜仅出现在能看到脸的一侧。

森林引路者素材与 `INFJ_forest_guide.zip` 中的 32 帧 PNG 和预览 GIF 逐文件一致。正面待机和水晶引路动作直接用原稿。转台每 45° 一帧，其他七面用内置 imagegen 参照原稿补齐。走跑使用两个补绘侧面和原有步态时间，攀爬与翻越使用补绘背面及分层手脚，停靠、下落和站立继续保留披风、挎包与水晶杖。恢复默认后，原版在冷天和热天都显示白色原貌，已解锁的戴帽雨衣在降雨时触发。

[森林资源](../src/assets/outfits/forest-guide)可由 `python3 scripts/import-forest-wardrobe.py <补绘图> src/assets/outfits/forest-guide` 重新登记。内置 imagegen 提示词见 [FOREST_WARDROBE.md](FOREST_WARDROBE.md)。

旧存档仍保留森林引路者的选择。已收起的服装会显示原版默认外观，直到用户主动确认新的装扮。

## 走跑和爬窗的动作参考

三种形态的默认动作与穿衣对照 GIF 位于分发目录「互动验收／动作GIF」。GIF 由应用使用的角色组件重放，其中窗边和地面是用于观察动作的参考线。原版及人版不同天气装的步态计算脚落地、转髋、屈膝和摆手。默认人版走路读取用户提供的 8 帧原画，经过透明抠图及落脚线对齐后进入桌面归营和接近窗沿的流程。人版走路可用 `python3 scripts/import-human-walk.py walk_cycle_preview.gif human-walk.webp` 重新登记。爬窗时按交替抓握计算手臂位置。狐狸 Q 版继续使用现有逐帧动作，重新配合移动速度和播放周期。衣服由各形态的同一组动作驱动。

如需重做 GIF，可使用 `node scripts/capture-motion-gifs.mjs /tmp/kanshan-motion-gifs` 导出默认参考。追加 `dressed` 导出穿衣对照。需要本机 Playwright Chromium 和 FFmpeg。也可通过环境变量 `KANSHAN_CHROMIUM_PATH` 指定已安装的 Chromium 可执行文件。

## 复验

打包后运行 `node tests/desktop-wear-weather.integration.mjs`，使用隔离档案逐套确认桌面立绘、解锁、重启和人版天气。天气测试使用固定观测数据。用 `KANSHAN_FOX_OUTFIT=ming node tests/desktop-fox-motion.integration.mjs` 检查穿着归营，用 `KANSHAN_FOX_OUTFIT=ming node tests/desktop-dressed-window.integration.mjs` 检查独立 AppKit 窗口上的渲染及切窗。用 `KANSHAN_TEST_FORM=classic` 或 `KANSHAN_TEST_FORM=human` 运行同一脚本，也会检查穿着走跑与爬窗。`node tests/desktop-pet-interactions.integration.mjs` 验证二次副键进入、原地敲击、节流、声音和隐藏清理，也覆盖陪听与捏脸。实际天气服务与物理双指触控以本机设备设置为准。

## 备份和回滚

如需回退，退出桌宠后恢复先前的应用和对应源码包。用户数据留在原路径。
