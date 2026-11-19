# 有界技术核查

查看日期：2026-11-17。仅研究当前阻塞的两个项目，不下载执行陌生仓库脚本。

| 项目/版本 | 官方来源与具体文件 | 许可证 | 核查层次 | 决定与限制 |
|---|---|---|---|---|
| Electron 45.3.3 | https://github.com/electron/electron ; docs/tutorial/security.md ; docs/tutorial/custom-window-interactions.md ; docs/tutorial/custom-window-styles.md ; LICENSE | MIT | 阅读官方文档、核对官方 release 与安装包；实际运行结果见 ACCEPTANCE | 使用 sandbox、contextIsolation、白名单桥接与透明窗口。透明不自动等于穿透，macOS/Windows 转发鼠标需要额外处理，本轮不宣称整桌面点击穿透 |
| PDF.js / pdfjs-dist 6.5.438 | https://github.com/mozilla/pdf.js ; src/display/api.js（getDocument 官方 API 文档与示例）；LICENSE；https://mozilla.github.io/pdf.js/getting_started/ | Apache-2.0 | 阅读官方文档、LICENSE、已公开安全通告，锁定当前注册表版本；解析运行见 ACCEPTANCE | 关闭 isEvalSupported，仅本地提取文字，不执行附件/脚本，不把 PDF 当指令；无 OCR，扫描页、加密 PDF 明确失败 |

Electron 官方安全与窗口文档：
https://www.electronjs.org/docs/latest/tutorial/security
https://www.electronjs.org/docs/latest/tutorial/context-isolation
https://www.electronjs.org/docs/latest/tutorial/custom-window-interactions
https://www.electronjs.org/docs/latest/tutorial/custom-window-styles

PDF.js 历史通告仅作为边界核查，不代表当前版本仍受影响：
https://github.com/mozilla/pdf.js/security/advisories/GHSA-wgrm-67xf-hhpq

知乎使用 `https://www.zhihu.com/search?type=content&q=...`。开发期发起页面核验时，联网阅读工具无法访问该页面，因此不宣称成功检索或找到帖子。应用只构造安全编码的搜索入口；真实打开是否成功仍依赖用户浏览器与登录环境。

没有使用 AIRI 或多 Agent 框架：本轮无需语音/实时 3D/多人服务，不为引入框架增加当前成本。

## v0.2 补充核查

查看日期：2026-11-17。本轮未新增依赖。

- Node 24 TLS 官方文档说明 tls.setDefaultCACertificates/tls.getCACertificates 用于当前进程线程的信任根配置：https://nodejs.org/download/release/v24.22.2/docs/api/tls.html 。本机 HTTPS 协议测试只在隔离测试进程信任临时测试证书，测试结束恢复；不修改系统钥匙串，不使用 NODE_TLS_REJECT_UNAUTHORIZED=0。
- DeepSeek 官方 Chat Completions 与 JSON 输出文档用于核对兼容接口结构和可选 response_format： https://api-docs.deepseek.com/api/create-chat-completion/ 与 https://api-docs.deepseek.com/guides/json_mode/ 。仅为协议交叉核对，没有选择或推荐具体付费服务，没有实际调用 DeepSeek。

文档声明、测试注入与实际网络区分：测试进程注入的 fetch 只验证应用错误路径；本机HTTPS服务器验证真实TLS/HTTP传输；两者都不代表外部模型已接通或语义已通过。
