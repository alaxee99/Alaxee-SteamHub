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

Task Bar Hero 的主中文市场参考源为 TBH Index（tbhindex.com）。本地导入示例见 `docs/game-pack.tbhindex-seed.json`，包含 12 条逐项核对的真实市场映射；格式占位示例仍见 `docs/game-pack.example.json`。当前采用的匹配流程是：先以 Steam 官方市场搜索结果确定 AppID 3678970 的真实 `market_hash_name`，再从 TBH Index 的 `/zh/market/item/` 页面取中文市场名称，最后从关联 Wiki 页面补充可验证的 ItemKey。注意 TBH Index 的市场目录显示 1,757 条跟踪记录，而 Steam 当前搜索显示 1,098 条；两者不是同一个集合。Gear、Materials、Monsters、Stages 等 Wiki 分类页本身也存在标题数、正文数和实际列表数不一致的情况，因此不能用网站宣传总数直接宣称完整。逐条采集采用正常页面访问和小批量核对，不做高频整站爬取。详细规则、已验证映射和覆盖差异见 `docs/providers/tbhindex.md`；逐条来源索引见 `docs/tbh-market-coverage.csv`。

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

只申请 storage 权限，用于扩展本地游戏配置、词库和未来数据源缓存。不会读取 Steam Cookie、登录凭据、账户资料、库存或存档，也没有遥测、云同步或远程代码。
