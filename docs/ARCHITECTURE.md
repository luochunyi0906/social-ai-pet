# 当前工程结构 v0.9.0

独立源码kanshan-p0-v0_9_0；Electron45.3.3、React19、TypeScript5.9、Vite7。锁定版本见package-lock。Mac arm64独立应用保留Electron Helper四种原始名称，主可执行文件Kanshan；ad-hoc签名并deep/strict验证，运行依赖全部内置。

主进程desktop/main.cjs只接受白名单IPC与可信frame；preload暴露逐项函数。渲染sandbox/contextIsolation开启，nodeIntegration关闭；拒绝导航、新窗和设备权限。配置独立应用为固定userData/model.env，开发为.env。

- core.cjs：输入、URL、模型结构及legacy schema1校验。
- store-v2.cjs：旧来源类型、收藏去重与迁移基础，不再直接承担新种植状态。
- garden.cjs：schema3，稳定favoriteId/plantId，9地块、单种子关联、资源/阶段、幂等操作与兼容迁移。
- search.cjs：Bing RSS实验入口/Brave，URL规范化、标题匹配、诊断、主进程来源收据。只取得index_only，不抓取正文。
- model.cjs/persona.cjs：HTTPS兼容接口、有限tone、提示词和少量原创示例；会话只存主进程内存最近6轮。
- main.tsx/shared/behavior.mjs：唯一行为控制器，事件优先级、中断与恢复。
- DesktopPet/shared/layout.mjs：透明道具、捕获拖动、边界和标签碰撞拒绝。
- GardenPanel/Plant 与 camp.css：展开后的营地、种子箱、选田确认、手动照料、手账与临时矢量阶段。背景与道具 PNG 由 Vite 复制进应用资源。弹窗中的Fox只消费同一个action/reason，不另建状态机。

load/save/update/garden-action共用串行队列，临时文件+fsync+rename。退出先关闭新请求，再等待写队列。garden-v3优先读取，否则读v2/v1并生成v3；结构损坏停止写入，旧数据字节不覆盖。revision防止旧响应覆盖新状态；最近100次操作签名防重复，其余土地/资源约束继续防重。

用户数据目录沿用看山有伴-v0.3-preview。数据不进应用/源码包。源码包包括当前测试与文档，不包括node_modules及原始DOCX。

桌面窗口：使用 25 ms 指针探测与 `setIgnoreMouseEvents` 按已有透明热区路由。拖动使用 `windowDrag.ts` 的阈值和指针捕获，以及主进程 16 ms 的原生坐标采样。拖动期间暂停命中探测。304 × 176 的透明桌宠由 `desktop/pet-layout.json` 统一定义原生窗口尺寸、角色位置和道具标签间距。角色使用独立透明窗口在屏幕工作区散步，营地和道具留在原地。默认活动范围为全桌面，已有的自由活动开关仍有效。900 × 740 默认营地按整窗范围夹入工作区。屏幕添加、删除及尺寸变化会重新核对边界。窗口位置与活动范围等设置写入 `window-preferences.json`。

角色外貌写入 `window-preferences.json` 的可选 `appearance` 字段，旧档案默认恢复原版。主窗口和自由活动窗口通过共用的 `Companion` 渲染立绘。山洞点击次数保存在当前界面，播放器使用随应用打包的本地 MP4。

检索/模型用唯一请求ID、AbortController和时限；取消/隐藏后的迟到结果双层拒收。种植确认是本地原子提交，关闭面板不撤销已经完成的操作；确认前取消不改变数据。暂停角色不取消已授权业务，明确取消另行终止。

## 知乎平台增量

search.cjs默认zhihu，旧RSS/Brave显式可选；zhihu.cjs解析Code/Data/Items、API摘要与可用元数据。postUrl支持独立answer路径，identity用于兼容去重，sourceUrl保留白名单UTM。store-v2作为兼容层扩展来源可选字段，garden schema3不变；旧收藏不改ID/字段。SourceDetails/PostCard统一取得范围、摘要和元数据展示。

model.cjs新增zhida provider，固定developer.zhihu.com/v1/chat/completions，fast/thinking上下文档位；只发三个正式字段并带秒级时间戳，忽略reasoning_content。现有模型输出JSON/tone校验仍保留，格式错可见失败。OpenAI兼容provider和本机字段保留，provider切换不重写用户密钥。

zhihu-quota为窄IPC：主动确认、固定APIIDs=zhihu_search,zhida_openai，共用取消、25秒、128KB上限；有界数字数组回传，不带凭据。没有自动余额查询或业务重试。MODEL_KEYS白名单新增MODEL_PROVIDER/ZHIDA_MODEL/ZHIHU_ACCESS_SECRET。

## v0.7.1 直答真实格式兼容

真实直答在user轮只有材料JSON时要求补充任务，未执行system中的出题协议。仅对zhida provider，将可信任务与JSON协议同时明确放入本轮user消息；角色对话同样重复有界角色/来源范围规则，并继续以JSON承载用户数据。原始输出仍经过同一个严格问题/tone校验，不进行自由文本冒充结构化成功，不新增隐式重试或二次格式修复调用。
