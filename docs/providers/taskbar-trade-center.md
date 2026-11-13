# Task Bar Trade Center: bulk Task Bar Hero item/localization catalog

Checked: 2026-11-13

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
- The bundled pack had 1,106 game-derived unique Steam keys before the manually verified C-variant addition; v0.9.5 now contains 1,107 exact market-name entries.
- The upstream source item ID is optional provenance; it is never a substitute for Steam's exact `market_hash_name` matching key.

## Steam market identity: important source update

The older `docs/item-catalog.md` text describes a level-based fallback (`C` at level 90+, otherwise `A`). That rule is not sufficient for all current marketable gear.

The upstream Task Bar Trade Center changelog for v0.14.3 (2026-10-28) records a Steam client SDK adapter that reads actual item definitions and verified Steam market names, then checks AppID, canonical market name, marketability and item tags. Its `internal/catalog/market_identity.go` computes a definition ID as `ItemKey * 1000 + 900` and only accepts a matching Steam definition. See:

- https://github.com/nidea1/task-bar-trade-center/blob/main/CHANGELOG.md#0143---2026-10-28
- https://github.com/nidea1/task-bar-trade-center/blob/main/internal/catalog/market_identity.go

A batch comparison of the public item catalog found **14 pairs** of marketable equipment records with the same English name, grade, gear type and level 80, but distinct ItemKeys ending in `171` and `173`. The level-only generator cannot distinguish those pairs. Three C variants were previously documented (`Dimensional Armor (Beyond) C`, `Dimensional Armor (Celestial) C`, and `Ethereal Ring (Arcana) C`); v0.9.5 adds the live-verified `Dimensional Axe (Cosmic) C`. The other ten `...173` candidates remain in the review queue until their exact Steam market names are checked; do not bulk-convert them by suffix inference.

## Steam commodity inventory

Steam Bulk Sell's public commodity JSON (`https://steambulksell.com/data/commodities/3678970.json`) contains 342 unique exact names. The current pack matches **342 / 342** commodity keys by exact equality. This validates the commodity subset only, not all unique gear variants or the complete Steam Market inventory.

## Exact market-name overrides

The override ledger is `docs/market-catalogs/taskbar-hero-market-name-overrides.csv`. It records five Steam-facing exceptions: three verified level-80 C variants, the newly observed Dimensional Axe C name, and the Plague Fruit listing whose canonical market key omits the grade shown in the detail-page title. For the Dimensional Axe C row, the Steam name is verified but the matching upstream source ItemKey is intentionally left unset until it is independently confirmed.

## Generated import pack

The import-ready pack is `docs/game-pack.taskbar-hero-zh-CN.json`. It now contains 1,107 exact `market_hash_name` keys and 14 detail-text mappings. The 1,106 base game-derived market names use the game's `zh-Hans` labels; one additional C-variant key was added after checking the live Steam Market title.

This is a verified dictionary subset, not a claim that every marketable item has a unique Steam listing key or that every listing currently has sell orders. Steam's commodity file covers commodities only. Unique gear needs exact Steam definition/market-name verification; never fuzzy-map or infer A/C from a level or numeric suffix alone.

## Update procedure

1. Fetch a new upstream `items.json` snapshot and record its source revision/date.
2. Compare all 7,031 source rows and isolate all `marketable` entries, missing names, duplicate semantic groups and duplicate ItemKeys.
3. Preserve explicit `market_hash_name` overrides.
4. For marketable equipment with colliding English name + grade + type + level, obtain the exact Steam market name from verified Steam definition metadata or a directly checked listing; do not use the old level-only heuristic.
5. Join Chinese `zh-Hans` labels only after the exact Steam key is established. Exclude conflicting or empty mappings for review.
6. Compare all exact keys against the Steam Bulk Sell commodity JSON; send non-commodity gear variants to a separate verified-key review queue.
7. Validate schema v1, unique `(marketHashName, locale)` keys, source IDs, detail text mappings, and the 10,000-entry per-game limit.

## Privacy and redistribution

Do not copy the entire upstream 3.6 MB catalog into SteamHub. The generated pack stores only marketable Steam-facing name keys, Chinese labels, optional item IDs, and attribution. Keep it private; do not publish a mirror of the underlying proprietary game assets or translations.


## Import compatibility

For the 27 earlier manually checked mappings, the bulk pack preserves the prior `source: tbhindex.com` label and the prior presence/absence of `sourceItemId`. This is intentional: a user who already imported `docs/game-pack.tbhindex-seed.json` can merge the full pack without those same keys appearing as conflicting provenance updates. The other bulk-generated entries use `source: task-bar-trade-center` and retain a unique game item ID when available.
