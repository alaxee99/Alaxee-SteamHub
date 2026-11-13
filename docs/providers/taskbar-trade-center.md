# Task Bar Trade Center: bulk Task Bar Hero item/localization catalog

Checked: 2026-11-13

## Source

- Public repository: https://github.com/nidea1/task-bar-trade-center
- Machine-readable catalog: https://raw.githubusercontent.com/nidea1/task-bar-trade-center/main/internal/catalog/items.json
- Catalog method and field notes: https://github.com/nidea1/task-bar-trade-center/blob/main/docs/item-catalog.md
- Repository code license: MIT (`LICENSE`). The catalog is extracted from Task Bar Hero game assets and in-game locale tables; the repository does not state a separate license for the underlying game text/assets. The generated dictionary is retained in this private repository for personal use and should not be republished as a public game-data mirror.

## What the source provides

The checked JSON contains 7,031 item records and 16 locale keys, including `zh-Hans` and `zh-Hant`. Useful fields include item ID, localized names, grade, type, gear type, level, `marketable`, `deleted`, and optional `market_hash_name` overrides. The documented refresh dated 2026-10-23 says 7,031 records were verified against the installed game's `ItemInfoData` asset and localized Unity string tables.

At the checked snapshot:

- Total item records: 7,031
- Records marked `marketable: true`: 1,127
- Marketable records with a non-empty Simplified Chinese name and generated market key: 1,106 unique keys
- Unique source IDs available from the source catalog: 1,095. The import pack retains 1,070 `sourceItemId` values; the 27 earlier TBH-verified rows preserve their original provenance metadata (including intentionally absent IDs) so they can be merged with the previous seed without needless source-field conflicts. Repeated IDs are omitted when multiple game rows collapse to the same Steam key
- Marketable records excluded due missing English/key/Chinese values: 10 (the Common Plague Fruit grade family in this snapshot)
- Conflicting Chinese translations for a collapsed key: 0

## Steam market name construction

The upstream documentation says that an explicit `market_hash_name` override must take precedence. Otherwise, equipment names are built from English name + grade + variant (`C` for level 90+, `A` below level 90); materials generally use their English name unless an explicit market override is supplied.

Steam Bulk Sell's public commodity JSON (`https://steambulksell.com/data/commodities/3678970.json`) contains 342 unique exact names. After checking the actual Steam listing pages and applying four explicit exceptions below, **all 342 / 342** commodity names reconcile to a Chinese source item by exact key.

Four verified Steam exceptions are stored in `docs/market-catalogs/task-bar-hero-market-name-overrides.csv`:

- Item `516173`: Steam listing is `Dimensional Armor (Beyond) C` although the generic level-80 rule would derive `A`.
- Item `517173`: Steam listing is `Dimensional Armor (Celestial) C` although the generic level-80 rule would derive `A`.
- Item `625173`: Steam listing is `Ethereal Ring (Arcana) C` although the generic level-80 rule would derive `A`.
- Item `150104`: the exact market key is `Plague Fruit` while the Steam page display title is `Plague Fruit (Legendary)`.

These four exceptions are based on current official Steam listing URLs and titles, not fuzzy matching.

## Generated import pack

The generated, import-ready extension pack is `docs/game-pack.taskbar-hero-zh-CN.json`. It contains 1,106 exact `market_hash_name` keys with `zh-CN` values sourced from the game's `zh-Hans` strings. The 27 earlier manually checked TBH Index translations all exactly match the in-game `zh-Hans` values.

This is a dictionary candidate for Steam market name resolution, not a guarantee that all 1,106 keys currently have active sell orders. The game's `marketable` flag is an in-game exchange flag; Steam market availability changes independently. Exact matching preserves the original key and never fuzzy-maps variants.

## Update procedure

1. Fetch a new public `items.json` snapshot and record its source revision/date.
2. Sanitize only fetch-rendering escapes if the JSON transport introduces them; never alter source strings.
3. Apply explicit `market_hash_name` overrides first, then the documented naming convention.
4. Apply the four Steam-verified exceptions only while their official Steam listing URLs/titles still agree.
5. Group identical market keys only when every row has the same `zh-Hans` label. Exclude conflicting or empty keys for review.
6. Compare the resulting keys against Steam Bulk Sell's commodity JSON by exact equality; send unmatched names to a review queue rather than guessing.
7. Rebuild the game pack and validate schema v1, unique `(marketHashName, locale)` keys, source IDs, and a maximum 10,000 translations per game.

## Privacy and redistribution

Do not copy the entire upstream 3.6 MB catalog into SteamHub. The generated pack stores only marketable Steam-facing name keys, Chinese labels, optional item IDs, and attribution. Keep it private; do not publish a mirror of the underlying proprietary game assets or translations.


## Import compatibility

For the 27 earlier manually checked mappings, the bulk pack preserves the prior `source: tbhindex.com` label and the prior presence/absence of `sourceItemId`. This is intentional: a user who already imported `docs/game-pack.tbhindex-seed.json` can merge the full pack without those same keys appearing as conflicting provenance updates. The other bulk-generated entries use `source: task-bar-trade-center` and retain a unique game item ID when available.
