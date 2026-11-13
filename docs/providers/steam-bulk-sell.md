# Steam Bulk Sell public commodity catalog

Checked: 2026-11-13

## Decision

Use the published per-game JSON file as a bulk **Steam commodity key inventory** for Task Bar Hero. It is a much faster baseline than discovering each commodity through individual listing pages.

- Public catalog: https://steambulksell.com/data/
- Task Bar Hero JSON: https://steambulksell.com/data/commodities/3678970.json
- Per-game catalog is also offered as CSV.
- AppID: `3678970`; context ID: `2`.
- Source update observed: `2026-11-12`.
- Record count: 341 unique `market_hash_name` values.
- Data fields: AppID, context ID, exact Steam `market_hash_name`, Steam display name, icon URL, and listing URL.
- License: Creative Commons Attribution 4.0 International (CC BY 4.0). Attribute Steam Bulk Sell and link to its open-data page.

## Scope limit

This is **not a complete Steam Market inventory**. Steam Bulk Sell explicitly publishes commodity items only, because its list is built for Steam Multisell. It excludes non-commodity listings, including many unique gear variants. Do not compare its 341 rows directly with Steam's broader search-result count.

## Import

The imported copy is stored at `docs/market-catalogs/steam-bulk-sell-3678970.json`. The import preserves source metadata and the CC BY 4.0 attribution. Every source row remains keyed by the exact Steam `market_hash_name` and includes the original listing URL.

Existing verified translations are joined only by exact name equality. Unknown translations remain `null`; this catalog import does not fabricate Chinese labels. `sourceItemId` and TBH ItemKey are not supplied by this data source.

## Intended pipeline

1. Use this 341-row dataset as the first bulk Steam commodity inventory.
2. Join exact market names against TBH Index Market Info pages / other structured game catalogs to retrieve Chinese labels and item metadata.
3. Keep unmatched names in a review queue; do not fuzzy-map variants.
4. Discover non-commodity Steam items from a separate source such as Steam Market search results and the TBH game catalog.
5. Re-import this JSON when the provider publishes a newer `updated` date, preserving source attribution and checking key-level diffs.

## Attribution

Data from [Steam Bulk Sell Open Data](https://steambulksell.com/data/), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Steam names, icons and other platform assets remain the property of Valve and the relevant publishers.
