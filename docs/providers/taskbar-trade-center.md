# Task Bar Trade Center: bulk Task Bar Hero item/localization catalog

Checked: 2026-11-14

## Source

- Public repository: https://github.com/nidea1/task-bar-trade-center
- Machine-readable catalog: https://raw.githubusercontent.com/nidea1/task-bar-trade-center/main/internal/catalog/items.json
- Catalog method and field notes: https://github.com/nidea1/task-bar-trade-center/blob/main/docs/item-catalog.md
- Repository code license: MIT (`LICENSE`). The catalog is extracted from Task Bar Hero game assets and in-game locale tables; the repository does not state a separate license for the underlying game text/assets. The generated dictionary is retained in this private repository for personal use and should not be republished as a public game-data mirror.

## What the source provides

The checked upstream `items.json` snapshot contains 7,031 item records and 16 locale keys, including `zh-Hans` and `zh-Hant`. Useful fields include item ID, localized names, grade, type, gear type, level, `marketable`, `deleted`, and optional `market_hash_name` overrides. The documented asset refresh is dated 2026-10-23.

At the checked snapshot:

- Total item records: 7,031
- Records marked `marketable: true`: 1,127
- Marketable rows without an English or Simplified Chinese name: 10
- The bundled pack had 1,106 game-derived unique Steam keys before the manually verified C-variant addition; v0.9.6 now contains 1,116 exact market-name entries.
- The upstream source item ID is optional provenance; it is never a substitute for Steam's exact `market_hash_name` matching key.

## Steam market identity: important source update

The older `docs/item-catalog.md` text describes a level-based fallback (`C` at level 90+, otherwise `A`). That rule is not sufficient for all current marketable gear.

The upstream Task Bar Trade Center changelog for v0.14.3 (2026-10-28) records a Steam client SDK adapter that reads actual item definitions and verified Steam market names, then checks AppID, canonical market name, marketability and item tags. Its `internal/catalog/market_identity.go` computes a definition ID as `ItemKey * 1000 + 900` and only accepts a matching Steam definition. See:

- https://github.com/nidea1/task-bar-trade-center/blob/main/CHANGELOG.md#0143---2026-10-28
- https://github.com/nidea1/task-bar-trade-center/blob/main/internal/catalog/market_identity.go

A batch comparison of the public item catalog found **14 pairs** of marketable equipment records with the same English name, grade, gear type and level 80, but distinct ItemKeys ending in `171` and `173`. The level-only generator cannot distinguish those pairs. Steam search verified C listings for 13 of the 14 duplicate groups. Three C variants were already documented (`Dimensional Armor (Beyond) C`, `Dimensional Armor (Celestial) C`, and `Ethereal Ring (Arcana) C`); v0.9.5 added `Dimensional Axe (Cosmic) C`; v0.9.6 adds the remaining nine confirmed names. `Ethereal Bracer (Cosmic) C` was not found; its A listing exists, so no C key is invented. The nine new exact names were verified in one AppID-scoped Steam search batch on 2026-11-14.

## Steam commodity inventory

Steam Bulk Sell's public commodity JSON (`https://steambulksell.com/data/commodities/3678970.json`) contains 342 unique exact names. The current pack matches **342 / 342** commodity keys by exact equality. This validates the commodity subset only, not all unique gear variants or the complete Steam Market inventory.

## Exact market-name overrides

The override ledger is `docs/market-catalogs/taskbar-hero-market-name-overrides.csv`. It records fourteen Steam-facing exceptions: thirteen verified level-80 C-variant listings and the Plague Fruit listing whose canonical market key omits the grade shown in the detail-page title. The nine v0.9.6 additions include exact Steam listing URLs; their source ItemKeys are intentionally unset until independently verified.

## Generated import pack

The import-ready pack is `docs/game-pack.taskbar-hero-zh-CN.json`. It now contains 1,116 exact `market_hash_name` keys and 18 detail-text mappings. The 1,106-key baseline plus ten subsequently verified C-variant names (one in v0.9.5 and nine in v0.9.6) use the corresponding game's `zh-Hans` base labels.

This is a verified dictionary subset, not a claim that every marketable item has a unique Steam listing key or that every listing currently has sell orders. Steam's commodity file covers commodities only. Unique gear needs exact Steam definition/market-name verification; never fuzzy-map or infer A/C from a level or numeric suffix alone.

## Update procedure

1. Fetch a new upstream `items.json` snapshot and record its source revision/date.
2. Compare all 7,031 source rows and isolate all `marketable` entries, missing names, duplicate semantic groups and duplicate ItemKeys.
3. Preserve explicit `market_hash_name` overrides.
4. For marketable equipment with colliding English name + grade + type + level, obtain the exact Steam market name from verified Steam definition metadata or a directly checked listing; do not use the old level-only heuristic.
5. Join Chinese `zh-Hans` labels only after the exact Steam key is established. Exclude conflicting or empty mappings for review.
6. Compare all exact keys against the Steam Bulk Sell commodity JSON; send non-commodity gear variants to a separate verified-key review queue.
7. Validate schema v1, unique `(marketHashName, locale)` keys, source IDs, detail text mappings, and the 10,000-entry per-game limit.


 
## Detail-page localization audit (2026-11-14)

A four-page live sample was checked across a scepter, crossbow, armor, and bracer, in addition to the earlier axe detail page. The sample exposed three reusable classes of content:

- **Structured stats:** 77 `STAT_NAMES` labels plus numeric/pct patterns cover split text nodes (for example `Attack Damage` + `746`) and combined nodes (for example `Attack Speed 1.19`). Base-stat numbers remain unchanged; only their labels are localized.
- **Reusable format rules:** `More` and `Increased` modifiers, signed numeric values, decimal values, grade labels, type/level strings, `Requires Lv.N`, and `Decoration/Engraving/Inscription Slot ×N` all use shared patterns. No per-item DOM selector is required for the split/combined Base Stats variants.
- **Fixed unique effects:** four exact effects are now in the pack: Axe Spin duration, Heal skill cooldown, Crossbow Turret cooldown, and the Chaos Resistance lock rule. The repeated Steam commodity disclaimer is also translated once as a shared exact phrase.

The browser sample also verified `Elemental Dodge Chance +20.0%` through the generic stat/value rule. The sample is not a complete census of all unique item effects; newly encountered unique sentences should be added in batches after reviewing multiple pages, not by guessing translations from item names.

## Privacy and redistribution

Do not copy the entire upstream 3.6 MB catalog into SteamHub. The generated pack stores only marketable Steam-facing name keys, Chinese labels, optional item IDs, and attribution. Keep it private; do not publish a mirror of the underlying proprietary game assets or translations.


## Import compatibility

For the 27 earlier manually checked mappings, the bulk pack preserves the prior `source: tbhindex.com` label and the prior presence/absence of `sourceItemId`. This is intentional: a user who already imported `docs/game-pack.tbhindex-seed.json` can merge the full pack without those same keys appearing as conflicting provenance updates. The other bulk-generated entries use `source: task-bar-trade-center` and retain a unique game item ID when available.


## 内置词库版本同步（SteamHub 0.9.8）

- 已存在的 Task Bar Hero 游戏档案会在市场页首次扫描时同步扩展内置词库，不再要求用户先删除旧档案或手动重新导入。
- 同步只追加缺失的精确名称和详情词条；已有冲突译文保留，并在运行诊断中报告冲突数量。
- 对已知旧版内置术语 `Arcana Grade → 奥术品阶` 执行一次精确兼容迁移，更新为 `至宝品阶`；其他自定义详情译文不会被覆盖。
- 同步版本记录保存在扩展本地存储中；删除游戏档案时同时清理对应同步标记。
- 单轮可见商品扫描上限由 80 提升为 200；重叠触发的扫描串行执行，并对超出上限的条目给出数量诊断。
