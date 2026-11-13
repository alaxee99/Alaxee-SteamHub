# ALAXEE SteamHub

**ALAXEE 自主维护的 Steam 市场中文增强项目。**

正式开发方向为浏览器扩展优先。当前版本从“网页简体中文切换”推进到了“市场物品识别 + 精确匹配翻译核心 + 本地缓存基础”。

## 当前版本 0.3.0

已实现：

- Manifest V3 扩展，只在 HTTPS Steam Community Market 页面运行。
- 自动使用 Steam 官方简体中文网页语言参数 `l=schinese`，保留原有市场路径、筛选参数、搜索参数和 URL fragment。
- 从 Steam 市场物品链接中提取精确的 `appid + market_hash_name`。
- 独立翻译引擎：只接受 AppID、物品 hash name 和目标语言全部精确一致的唯一结果。
- 使用扩展本地存储保存成功的精确翻译，默认 30 天过期。
- Provider 串行限速器，避免并发请求突破数据源频率限制。
- 不读取 Steam Cookie、登录凭据、账户资料、库存或游戏存档。

**目前还没有可用的物品汉化数据源。** 翻译核心和缓存已经准备好，但 Provider 注册表保持为空，不会伪装成已经接入 TBHIndex。

## 本地安装

1. 打开 Edge 的 `edge://extensions`，或 Chrome 的 `chrome://extensions`。
2. 开启“开发人员模式”。
3. 点击“加载解压缩的扩展”。
4. 选择仓库中的 `extension` 文件夹。
5. 打开或刷新 Steam 社区市场网页。

当前是本地开发源码版，不代表已发布到浏览器扩展商店。

## 接下来

1. 核实数据源的公开 API、自动访问许可、跨域策略、限速和缓存政策。
2. 建立 Task Bar Hero（AppID `3678970`）的精确物品数据映射。
3. 接入已验证 Provider，按当前页面可见物品按需查询。
4. 在市场物品名称旁展示中文，并提供原文/译文切换和翻译状态。
5. 有明确价值时，再考虑把 Steam 客户端 CEF/CDP 做成可选适配器。

## TBHIndex 状态

TBHIndex 的公开网页提供装备资料库和 Steam 市场价格信息，但本次没有找到可供扩展稳定调用的公开开发者 API 说明。因此暂不调用网页内部接口、不批量抓取页面，也不假定其许可自动化访问。具体评估见 [docs/providers/tbhindex.md](docs/providers/tbhindex.md)。

## 安全原则

- 扩展只匹配 Steam Community Market HTTPS 路径。
- 只申请 `storage` 权限，用于本地翻译缓存。
- 市场匹配键保留原始大小写和字符，不进行模糊匹配。
- 查不到、匹配不唯一或数据异常时，一律保留 Steam 原文。
- 不增加遥测、账号、云同步、远程代码或代理控制。
