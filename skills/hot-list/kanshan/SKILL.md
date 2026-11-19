# 知乎热榜 · 看山有伴适配
官方 2.0.0 归档见 ../upstream 与 ../manifest.json。原脚本仅依赖 Python 3 标准库，接受 JSON 字符串，执行 HTTPS GET 并输出 JSON，HTTP 或执行失败退出非零。桌宠通过 Electron 主进程的 run({limit},{key,signal}) 调用，沿用小写 limit、HTTP 大写 Limit、知乎 Bearer 和时间戳。应用严格校验 1–30，固定官方地址，校验业务 Code 和数据形状，拒绝不安全链接。不执行 Python 或 Shell。
