# ALAXEE SteamHub

**ALAXEE SteamHub：面向多款 Steam 游戏的浏览器市场汉化扩展。**

v0.6.0 在多游戏独立配置基础上，增加词库搜索、单条编辑和删除，不再把 Task Bar Hero 写死在翻译核心里。

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
5. 在词库管理区按原名、译文、语言、来源或物品 ID 搜索，并分页查看词条。
6. 编辑或删除单条词条，不必重新导入整个数据包。
7. 单独启用、停用或删除游戏配置。

Task Bar Hero 现在优先使用批量结构化数据，而不是逐页手工录入。完整导入包见 `docs/game-pack.taskbar-hero-zh-CN.json`，包含 1,106 条唯一的简体中文 Steam 市场键，可直接通过扩展选项中的 JSON 导入功能导入。主数据来自公开的 Task Bar Trade Center 游戏物品目录（7,031 条记录、16 种语言，含 `zh-Hans`、marketable、grade、level 和 Item ID）；Steam Bulk Sell 的公开 commodity JSON 提供 342 个精确 Steam 市场键，完成四个已核实命名例外后与词库 342/342 精确对齐。前述 27 条逐页核对词条仍保留在 `docs/game-pack.tbhindex-seed.json`，TBH Index 作为补充人工核验来源，不再承担逐条生成整个词库的任务。注意 1,106 条表示游戏目录中可交易物品推导出的唯一市场键，不等同于当前有挂单的 Steam 商品数量；未匹配时扩展仍按精确键保留原文。数据来源、变体命名、四个 Steam 例外及更新流程见 `docs/providers/taskbar-trade-center.md`；342 条 commodity 原始目录见 `docs/market-catalogs/steam-bulk-sell-3678970.json`。

## 通过公开 JSON 链接导入

扩展选项中的“批量导入数据包”支持粘贴一个公开 HTTPS JSON 数据包直链。首次读取时只请求该链接所在站点的可选访问权限；不发送 Cookie、登录凭据或 Referer，拒绝跨站跳转，并限制读取大小为 5 MiB、最长 20 秒。读取完成后仍需在文本框检查数据，并明确选择合并或覆盖。

该入口只接受 `alaxee-steamhub-game-pack` v1，不会把任意 Wiki 首页、HTML、站点地图或 CSV 自动转换成词库。普通 Wiki 需要站点专用解析器，把页面记录映射到精确的 Steam `market_hash_name` 后才能生成词条。详细说明见 `docs/importing/public-json-url.md`。

Task Bar Hero 当前数据包直链：

`https://raw.githubusercontent.com/alaxee99/Alaxee-SteamHub/feat/browser-extension-first/docs/game-pack.taskbar-hero-zh-CN.json`

## 数据包格式

数据包使用 alaxee-steamhub-game-pack 格式，当前 schemaVersion 为 1。每个词条包含：

- marketHashName：Steam 原始市场物品名称，必须精确一致，区分大小写。
- locale：目标语言，例如 zh-CN。
- translation：准确译文。
- source：可选的数据来源标记。
- sourceItemId：可选的游戏目录物品 ID / Code，仅作来源关联信息。

同一个物品在不同游戏中的词条互相隔离；同一游戏、同一物品、同一语言只能有一条有效译文。导入支持“合并”和“覆盖”：合并遇到不同译文冲突会拒绝，覆盖只替换对应 AppID 的词库。单条编辑和删除则只作用于选中的 AppID + market_hash_name + locale。

## Task Bar Hero 数据目录评估

taskbarherowiki.com、taskbarhero.wiki 等其他公开社区站点仅作为辅助交叉核对来源。它们的记录数、数据版本和 ID 体系各不相同，不能直接与 TBH Index 的数据合并计数。详见 docs/providers/taskbarhero-wiki.md 和 docs/providers/tbhindex.md。

## 当前适配范围

首期使用 Steam Community Market 适配器。因此当前能够直接在市场页面展示译文的游戏，需要有 Steam 市场物品链接及对应 AppID。

当前既支持市场列表中的物品链接，也会尝试识别单个物品详情页标题。不使用 Steam Community Market 的游戏，后续可以增加独立的页面识别适配器或数据源，不需要重写游戏注册表和翻译核心。不要把不同游戏的物品 ID、代码格式或页面结构强行混成一套规则。

## 翻译匹配

翻译严格按 AppID + market_hash_name + locale 匹配，不做模糊搜索、不擅自改写大小写。匹配不到时保留 Steam 原文。每个游戏词库保存在浏览器扩展本地存储中，不依赖会过期的远程查询缓存。

## 安全

安装时只要求 storage 权限；用户主动读取公开 JSON 链接时，扩展才会针对该链接所在的单一 HTTPS 源申请可选访问权限。不会读取 Steam Cookie、登录凭据、账户资料、库存或存档，也没有遥测、云同步或远程代码。
