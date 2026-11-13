# Steam Bulk Sell public commodity catalog

Checked: 2026-11-13

## Decision

Use the published per-game JSON file as a bulk **Steam commodity key inventory** for Task Bar Hero. It is a much faster baseline than discovering each commodity through individual listing pages.

- Public catalog: https://steambulksell.com/data/
- Task Bar Hero JSON: https://steambulksell.com/data/commodities/3678970.json
- Per-game catalog is also offered as CSV.
- AppID: `3678970`; context ID: `2`.
- Source update observed: `2026-11-12`.
- Record count in the fetched JSON: 342 unique `market_hash_name` values. The site's summary page displayed 341, so the direct file is authoritative for this import snapshot and the discrepancy is recorded.
- Data fields: AppID, context ID, exact Steam `market_hash_name`, Steam display name, icon URL, and listing URL.
- License: Creative Commons Attribution 4.0 International (CC BY 4.0). Attribute Steam Bulk Sell and link to its open-data page.

## Scope limit

This is **not a complete Steam Market inventory**. Steam Bulk Sell explicitly publishes commodity items only, because its list is built for Steam Multisell. It excludes non-commodity listings, including many unique gear variants. Do not compare its 342 rows directly with Steam's broader search-result count.

## Import

The imported copy is stored at `docs/market-catalogs/steam-bulk-sell-3678970.json`. The import preserves source metadata and the CC BY 4.0 attribution. Every source row remains keyed by the exact Steam `market_hash_name` and includes the original listing URL.

The catalog's 342 exact market names were joined to the generated `zh-CN` game catalog by exact equality: 342 / 342 keys matched after four Steam-verified exceptions. Each record now includes the Chinese translation and optional game `sourceItemId`. The Steam Bulk Sell source itself does not provide Chinese text or game ItemKey metadata.

## Intended pipeline

1. Use this 341-row dataset as the first bulk Steam commodity inventory.
2. Join exact market names against the Task Bar Trade Center `zh-Hans` game catalog and retain source item IDs where unique.
3. Keep unmatched names in a review queue; do not fuzzy-map variants.
4. Use the full game catalog's marketable rows and documented Steam naming rule to generate non-commodity gear candidates; use Steam listing checks only for exceptions.
5. Re-import this JSON when the provider publishes a newer `updated` date, preserving source attribution and checking key-level diffs.

## Attribution

Data from [Steam Bulk Sell Open Data](https://steambulksell.com/data/), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Steam names, icons and other platform assets remain the property of Valve and the relevant publishers.


## Reconciliation result (2026-11-13)

The fetched JSON contains 342 unique rows (despite the directory summary saying 341). All 342 `market_hash_name` values now join to the generated Simplified Chinese pack by exact key. Three level-80 equipment names use C variants confirmed by official Steam listing titles, contrary to the generic level-based rule; Legendary Plague Fruit uses the exact key `Plague Fruit` although the Steam display title includes `(Legendary)`. The four overrides are documented in `docs/market-catalogs/taskbar-hero-market-name-overrides.csv`.
