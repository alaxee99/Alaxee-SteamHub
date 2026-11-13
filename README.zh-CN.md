# ALAXEE SteamHub

**ALAXEE 自主维护的 Steam 市场中文增强项目。**

项目调整为 **浏览器扩展优先**：先在 Edge / Chrome 的 Steam 社区市场网页中实现功能，不再把 Steam 客户端注入作为首要运行条件。

## 当前版本

当前仅完成浏览器扩展基础：

- 只在 Steam Community Market 页面运行。
- 自动使用 Steam 官方简体中文网页语言参数 `l=schinese`。
- 保留原有市场路径、搜索参数、筛选参数和 URL fragment。
- 不读取 Steam Cookie、登录凭据、账户资料、库存或游戏存档。
- **尚未实现物品名称汉化。** 当前只是切换 Steam 官方网页界面语言，不代表游戏物品名称已经完成翻译。

## 在 Edge 中安装测试

1. 打开 `edge://extensions`。
2. 打开左下角或页面中的“开发人员模式”。
3. 点击“加载解压缩的扩展”。
4. 选择仓库中的 `extension` 文件夹（其中包含 `manifest.json`）。
5. 打开或刷新 Steam 社区市场页面。

Chrome 对应入口为 `chrome://extensions`。修改扩展源文件后，需要在扩展管理页点击刷新，并重新加载市场页面。

当前提供的是本地开发版源码，不代表已经发布到 Edge Add-ons 或 Chrome Web Store。

## 后续开发顺序

1. 完成浏览器扩展基础与市场页面适配。
2. 建立与浏览器、Steam CEF 无关的翻译核心。
3. 以 `appid + market_hash_name` 作为精确物品匹配键。
4. 建立按需查询、限速和本地缓存。
5. 实现页面内中文翻译展示、状态和用户控制。
6. 有明确价值时，再把 Steam 客户端 CEF/CDP 作为可选适配器。

Taskbar Hero 的 Steam AppID 为 `3678970`。TBHIndex 只有在确认具体数据访问方式与使用条款后才接入；不得批量爬取或猜测物品译名。无法精确匹配时保留 Steam 原文。

## 架构与安全

- 浏览器扩展是第一宿主；翻译核心不得依赖 `chrome.*`、Steam CEF 或 Millennium。
- 扩展只匹配 HTTPS Steam Community Market 路径，不注入其他网站。
- 不申请 `cookies`、`tabs`、`webRequest`、`debugger` 等非必要权限。
- 不加入遥测、账号体系、云同步、远程代码或代理控制，除非另行明确批准。
- Steam 客户端旧 CEF/CDP 原型保留为独立历史开发分支，不属于当前浏览器扩展运行依赖。

详见 [ARCHITECTURE.md](ARCHITECTURE.md) 和 [AGENTS.md](AGENTS.md)。
