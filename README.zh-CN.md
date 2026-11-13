# ALAXEE SteamHub

**ALAXEE SteamHub：通过 Steam AppID 查找游戏，并为 Steam Community Market 导入精确中文词库。**

## 日常使用

1. 打开扩展选项，在 Steam AppID 输入框粘贴游戏 ID。
2. 点击“查询游戏”。SteamHub 会从 Steam 商店读取游戏名称、图片和开发者信息，不需要手动填写游戏名称。
3. 点击推荐词库的一键导入，或使用 Google / Bing / DuckDuckGo 搜索该游戏的 Wiki。
4. 找到公开 JSON / CSV 数据接口后，把接口地址填入“Wiki / JSON / CSV 数据地址”，点击“识别并导入”。
5. 导入使用安全合并模式：冲突会停止，不会静默覆盖。
6. 打开该游戏的 Steam Community Market 页面检查汉化效果。

Task Bar Hero（AppID 3678970）已内置 1,106 条简体中文 Steam 市场词条，点击“一键导入”即可，不需要外部 URL、CSS 或字段映射。

## 数据源支持边界

Steam AppID 可以查询游戏名称，但 Steam 没有通用 API 用来枚举每款游戏的全部社区 Wiki，也不存在统一的 Wiki 词条数据格式。SteamHub 优先显示已经适配的词库，并提供 Wiki 搜索入口。对于公开 JSON / CSV 数据接口，导入器会自动识别常见的 market_hash_name、marketHashName、zh-Hans、zh-CN 和物品 ID 字段。

普通 Wiki HTML 页面、MediaWiki 页面或只提供内部 ItemKey 的接口，需要对应网站的适配器或该游戏的参考目录。没有精确 Steam market_hash_name 或可反查的来源 ID 时，不能把页面标题猜成市场键。扩展不会批量抓取页面或生成错误匹配。

手工词条、词库搜索/删除、JSON 包导入导出、站点发现、单页 HTML 表格 / 卡片 / 详情解析和 CSS 选择器配置均收纳在“高级管理与调试工具”中。普通使用不需要打开这些工具。

## 隐私与安全

- 游戏信息只在用户点击“查询游戏”后读取 Steam 商店公开 AppID 信息；不读取 Steam 登录状态、Cookie、库存或账户资料。
- 查询前会请求 Steam 商店的可选访问权限。
- 外部 JSON / CSV 源仅在用户粘贴网址并点击读取后访问；请求不发送 Cookie / Referer，拒绝重定向，限制 5 MiB、20 秒。
- 词库保存在浏览器扩展本地存储中。
- 翻译按 AppID + Steam 原始 market_hash_name + locale 精确匹配，不做模糊匹配。
- 不包含遥测、账号、云同步或远程执行代码。

## 开发与验证

- 项目版本：v0.7.0
- npm test：自动化测试。
- npm run check：JavaScript 语法检查。
- 当前 ZIP 用于 Edge / Chrome 本地加载测试；浏览器商店发布需单独授权。
