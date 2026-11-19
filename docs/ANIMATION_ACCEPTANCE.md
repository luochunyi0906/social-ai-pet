# 刘看山动画第一轮验收

验收日期 2026 年 11 月 19 日，香港时间。运行环境为苹果芯片 Mac 原生 Electron 桌宠。原生用例使用隔离数据目录。

## 素材

核对的原包是 `liukanshan_animation_assets_master.zip`。其后上传的同名加编号副本与原包 SHA-256 一致，均为 `8ec445c826d4809ca18b247c5ab348eea5a22f5506f0461678d5c070dbedcc54`。原始上传包保留。README 中的 10 个动作和 8 个表情与文件不符。实际为 5 个基础动作、9 个表情，共 89 帧。逐帧核实了编号、256 × 256 RGBA 画布和 y=232 的角色基线。逐个核对了 GIF 帧数。GIF 预览的延时按百分之一秒取整，程序按登记的 PNG 帧率播放。

- 清掉 `act_sleep` 第 2、3 帧画面右侧的分离残片。使用整帧平移校准 `act_sit` 第 5 帧和 `act_sleep` 第 2–4 帧。保留固定画布和纵向落点。
- `act_idle` 8 帧循环。 `emo_thinking` 取前 3 张已坐稳的姿势往返播放，避开后段的大幅动作和问号。
- `act_sit` 一次播放，结束保留第 6 帧。两种一次性站立反馈结束后按当前模式恢复。
- 按最新确认，实际睡觉继续显示原有被窝。校正后的 `act_sleep` 素材已登记，睡眠状态仍由统一控制器保护。
- 自定义装扮沿用该套装自己的动作和休息画面，默认角色序列未覆盖换装。
- 运行时全身 PNG 一帧一张，统一坐标，无逐帧裁切缩放。主窗口预解码五个上线片段，分离窗口接收同一播放起点。其余素材可由注册表扩展。暂停、隐藏和减少动态设置会停止无用帧循环。

## 真实事件与画面

| 场景 | 画面 | 退出规则 |
| --- | --- | --- |
| 普通且无任务 | `act_idle` | 进入任务、反馈或切换模式 |
| 开山洞、主动选择新的真实问题 | `emo_curious` 一次 | 回到当前姿态，等待开始时可抢占 |
| 聊天、搜索、主动刷新热榜、推荐和回答摘要请求 | `emo_thinking` | 可显示结果进入界面、错误、超时、取消或关闭时停 |
| 主进程确认新增收藏 | `emo_happy` 一次 | 数据先提交，重复或失败不播 |
| 专注／低打扰 | `act_sit` 一次，再 `sit_hold` | 待办任务结束后仍坐着，直至退出专注或进入睡眠 |
| 床铺进入睡眠 | 原被窝 `sleep_hold` | 仅由现有唤醒流程改变桌宠睡眠，后台回调不改变姿态 |

聊天当前为非流式。首次可展示正文和等待结束在同一次界面更新，内部推理不会进入画面。各请求有独立作用域与标识，晚到事件无法结束同作用域的新请求或跨作用域停止等待。取消先更新动画，再请求主进程终止任务。聊天和检索的主进程互斥规则仍由业务层决定。闹钟仍由 Mac「时钟」保存和响铃。本轮核对了原入口和资源，未额外创建或重设闹钟。

## 验证结果

- `npm test` 97 项通过。新增测试覆盖迟到结束、作用域隔离、避免重复启动、坐姿保持、睡眠优先和素材登记。
- Mac 原生夹具测试通过正文结束、取消、迟到回包、HTTP 503、超时、搜索取消、收藏新增与重复、专注、休眠期间晚到回复、收起及唤醒。系统拖拽真实移动分离窗口，光标位置由夹具控制。分离窗口实际跟随专注坐姿。夹具使用隔离收藏和会话。
- Mac 原生真实请求分别通过知乎直答和检索，真实正文和真实检索结果进入界面后均结束思考。此次真实请求未修改个人会话或收藏。
- 核对了睡眠时仍能打开音乐及闹钟面板，检查系统闹钟能力状态。未重测系统实际响铃。原生应用签名验证通过。
- 桌面待机、小屋睡眠以及营地收藏和坐姿的实际运行截图见 `artifacts/animation`。其中收藏截图有明确夹具标识。
- 未接入跑步、新的自主行走策略和其它表情触发。定制装扮的素材能力由各套装决定。

## 代码位置

- `src/shared/animation.mjs` 和 `src/ActorAnimation.tsx` 管理模式、分域请求、一次动作和共享播放时钟。
- `src/Companion.tsx`、`src/RoamingCompanion.tsx`、`src/desktop-pet.css` 和 `src/types.ts` 渲染角色并传递动画快照。
- `src/main.tsx`、`src/ChatPanel.tsx`、`src/SearchPanel.tsx`、`src/HotList.tsx`、`src/Recommendations.tsx`、`src/QuestionAnswers.tsx` 提交业务事件。
- `desktop/main.cjs` 向前端返回经过串行写入确认的收藏新增状态，并验证分离窗口动画数据。
- `src/assets/companion` 与 `scripts/import-companion-frames.cjs` 登记、校验并适配素材。`tests/actor-animation.test.mjs` 和 `tests/desktop-animation.integration.mjs` 为本轮测试。

## 回退

回退基线位于项目根目录的 `deliveries/v0_9_9`，含上一验收版的 `kanshan_p0_source_v0_9_9.zip`、`kanshan_macos_v0_9_9.zip` 和 `SHA256.json`。修改前核对了源码包与工作区的文件字节，差异为零。当前动画版是新开发构建，沿用应用的版本号和用户数据位置。

1. 先退出「看山有伴」。在单独临时目录解开上一验收版源码包和 macOS 应用包。
2. 对照上方代码清单，仅替换既有文件 `desktop/main.cjs`、`src/main.tsx`、`src/Companion.tsx`、`src/RoamingCompanion.tsx`、`src/desktop-pet.css`、`src/types.ts`、`src/ChatPanel.tsx`、`src/SearchPanel.tsx`、`src/HotList.tsx`、`src/Recommendations.tsx`、`src/QuestionAnswers.tsx`。如验收后又有修改，先逐文件合并。
3. 移除本轮新增的 `src/ActorAnimation.tsx`、`src/shared/animation.mjs`、`src/assets/companion`、`scripts/import-companion-frames.cjs`、`tests/actor-animation.test.mjs` 和 `tests/desktop-animation.integration.mjs`。
4. 用旧 macOS 应用包中解出的 `看山有伴.app` 替换 `release/看山有伴.app` 并重新启动。重新构建时可以从源码运行项目原有的打包流程。回退范围是工程代码和应用包，用户收藏、个人配置、原始素材包及系统闹钟不需要迁移。
