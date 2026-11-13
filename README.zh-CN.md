# ALAXEE SteamHub

**ALAXEE SteamHub：面向多款 Steam 游戏的浏览器市场汉化扩展。**

v0.4.0 开始支持按游戏独立配置，不再把 Task Bar Hero 写死在翻译核心里。

## 多游戏配置

每款游戏都有独立档案，以 Steam AppID 作为唯一主键，分别保存：

- Steam AppID 和游戏名称。
- 使用的页面适配器（当前为 Steam Community Market）。
- 物品识别字段（当前为 market_hash_name）。
- 独立启用/停用状态。
- 该游戏自己的多语言翻译词库。

打开 Edge / Chrome 扩展管理页，进入 ALAXEE SteamHub 的“扩展选项”，即可：

1. 输入 Steam AppID 和游戏名称，添加游戏。
2. 手工输入物品原始名称、目标语言和准确译名。
3. 批量导入游戏 JSON 数据包。
4. 导出每款游戏独立的数据包，备份或分享词库。
5. 单独启用、停用或删除游戏配置。

数据包示例见 docs/game-pack.example.json。Task Bar Hero 的 taskbarhero.wiki 社区 Wiki 已验证存在中文市场条目和可交叉核对的 Steam listing，但尚未取得自动访问及数据再利用许可，因此当前只登记为候选来源，不会自动抓取。详见 docs/providers/taskbarhero-wiki.md。示例中的物品和译文只是格式演示，不是经过验证的 Task Bar Hero 真实词条。每条词条还可选填 sourceItemId 和 source，用来记录来源词库的物品 ID / Code 与出处；它们只做关联信息和溯源，不替代 Steam market_hash_name 的精确匹配。

## 数据包格式

数据包使用 alaxee-steamhub-game-pack 格式，当前 schemaVersion 为 1。每个词条包含：

- marketHashName：Steam 原始市场物品名称，必须精确一致，区分大小写。
- locale：目标语言，例如 zh-CN。
- translation：准确译文。
- source：可选的数据来源标记。

同一个物品在不同游戏中的词条互相隔离；同一游戏、同一物品、同一语言只能有一条有效译文。导入支持“合并”和“覆盖”：合并遇到不同译文冲突会拒绝，覆盖只替换对应 AppID 的词库。

## Task Bar Hero 数据目录评估

目前发现 Task Bar Hero 的公开粉丝 Wiki 提供约 5,934 条物品记录，并说明物品名称覆盖多种游戏语言。但目前核验到的 items.json 主要包含数值物品 key、英文 name、type、tradable、variant 等字段，没有直接提供已验证的 Steam market_hash_name 对照表，也没有在该 JSON 中发现中文译文字段。

因此 SteamHub 暂不自动抓取或打包这份目录。现在可以把目录中的内部物品 ID 填入 sourceItemId，待确认合法数据使用方式和 Steam 名称映射后，再接入自动目录适配器。详见 docs/providers/tbhindex.md。

## 当前适配范围

首期使用 Steam Community Market 适配器。因此当前能够直接在市场页面展示译文的游戏，需要有 Steam 市场物品链接及对应 AppID。

当前既支持市场列表中的物品链接，也会尝试识别单个物品详情页标题。不使用 Steam Community Market 的游戏，后续可以增加独立的页面识别适配器或数据源，不需要重写游戏注册表和翻译核心。不要把不同游戏的物品 ID、代码格式或页面结构强行混成一套规则。

## 翻译匹配

翻译严格按 AppID + market_hash_name + locale 匹配，不做模糊搜索、不擅自改写大小写。匹配不到时保留 Steam 原文。每个游戏词库保存在浏览器扩展本地存储中，不依赖会过期的远程查询缓存。

## 安全

只申请 storage 权限，用于扩展本地游戏配置、词库和未来数据源缓存。不会读取 Steam Cookie、登录凭据、账户资料、库存或存档，也没有遥测、云同步或远程代码。
