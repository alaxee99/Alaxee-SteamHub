# TBH Index primary reference assessment

Assessment date: 2026-11-13

## Decision

**Primary community reference for Task Bar Hero market-item mapping; not yet an automated SteamHub provider.**

The source is substantially more useful for this product than a generic item dump because its item pages can connect three different identities:

1. The game's own catalog key (`ItemKey` / `GearKey`).
2. The localized item display name.
3. The exact Steam Community Market item name.

That cross-reference is what SteamHub needs. The source remains a fan site, not the game developer or an official Steam data contract.

## Verified public coverage

The site's current public pages identify their game-data snapshot as Task Bar Hero Ver 1.3.2 and say the data is re-extracted after game patches. Publicly advertised coverage includes:

- 1,576 obtainable gear items.
- 189 crafting materials.
- 253 runes.
- 77 monsters.
- 192 stages.
- 120 chest boxes.
- A separate Market Info catalogue showing 1,751 tracked items.
- 19 interface/localization languages.

These are the site's published counts, not an independent proof that every row has been checked against the current game build. Counts from different sections and other sites are not necessarily comparable: a page may count unique item definitions, grade/level variants, market-tradable entries, or expanded data rows.

Primary pages:
- https://tbhindex.com/
- https://tbhindex.com/wiki
- https://tbhindex.com/wiki/gear
- https://tbhindex.com/wiki/materials
- https://tbhindex.com/wiki/runes
- https://tbhindex.com/market

## Verified Steam-market cross-reference

A Simplified Chinese item page was inspected:

https://tbhindex.com/zh/wiki/gear/mystic-armor-beyond-516111

It identifies the localized item as **神秘盔甲A**, Beyond grade, Armor, level 50. Its metadata identifies `ItemKey 516111` and `GearKey 516111`. The page explicitly states that the corresponding Steam Community Market name is `Mystic Armor (Beyond) A`.

This is a verified example of the mapping SteamHub needs:

| Field | Value |
|---|---|
| Steam AppID | `3678970` |
| Steam `market_hash_name` | `Mystic Armor (Beyond) A` |
| TBH Index `ItemKey` | `516111` |
| TBH Index `GearKey` | `516111` |
| Locale | `zh-CN` |
| Localized display name | `神秘盔甲A` |
| Provenance | `tbhindex.com` |

A game-pack record can therefore be represented as:

```json
{
  "marketHashName": "Mystic Armor (Beyond) A",
  "sourceItemId": "516111",
  "locale": "zh-CN",
  "translation": "神秘盔甲A",
  "source": "tbhindex.com"
}
```

The Steam market hash name remains the matching key. The TBH Index ID is only a cross-reference and must never replace it.

## Important coverage qualification: Farming page

The supplied page, https://tbhindex.com/zh/wiki/farming, is a farming-efficiency calculator, not the master item catalogue.

Its own explanation says:
- There are 168 farmable stages out of 189 stages in that calculation.
- Reference clear-time rankings currently cover 108 of those 168 farmable stages.
- The remaining 60 Plaguelands hard-mode stages are still awaiting measured clear times.

Therefore this specific calculator is intentionally incomplete for measured farming rankings. It should not be treated as evidence that the whole TBH Index database is incomplete, nor should it be used as a source for the Steam translation dictionary. Use the Gear, Materials, Market, and individual item pages for item mapping.

## Comparison with other public resources

The counts below describe what each site publicly advertises or what was visible in its inspected data. They are not interchangeable row counts.

| Source | Publicly visible coverage | Localization / Steam mapping | Recommended role |
|---|---|---|---|
| **tbhindex.com** | Ver 1.3.2; 1,576 gear, 189 materials, 253 runes, 77 monsters, 192 stages, 120 chests; market page says 1,751 tracked items | 19 languages; inspected Chinese item page exposes localized title, internal ItemKey and exact Steam market name | **Primary reference** for manual validation and a future maintainer-approved adapter |
| taskbarhero.wiki | Public database page previously showed 45 datasets / 25,757 rows; market page showed 935 tradable listings | Chinese market routes and localized item pages exist; a sample mapping was inspected | Secondary cross-check for missing items; not the only catalogue |
| taskbarherowiki.com | Public pages advertise 5,934 item records and 10 languages | The inspected `/data/items.json` exposed numeric keys, English names and item metadata, but no Chinese field or exact Steam `market_hash_name` crosswalk in that payload | Auxiliary internal-ID catalogue only until its localized export and market mapping are confirmed |
| tbherohelper.com | Public database page showed 6,596 records across 14 collections and game-version label `1.00.21` | UI advertises 16 locales; no exact Steam crosswalk was established in this assessment | Secondary reference only; establish version equivalence and field mapping before use |

Do not infer that a site with a larger headline record count is more complete. For this product, exact Steam item coverage and a proven localized-name-to-market-name link matter more than the total number of rows.

## Access, terms, and reuse limits

The public TBH Index Terms of Service describe the site as an unofficial fan tool and state that game data and market prices are sourced from public game files and Steam Community Market. The terms prohibit interfering with or overloading its servers/APIs, unauthorized access, and excessive scraping. They also distinguish the game's IP from the site's own code, design, and original prose.

No public developer API contract, extension CORS guarantee, rate limit, cache policy, or explicit bulk-data redistribution license was found in the pages inspected. Public readability and a localized page do not grant SteamHub permission to mirror the full catalogue.

Until the maintainer confirms an approved access method and reuse terms:

- Do not bulk-crawl the catalogue or Market pages.
- Do not reverse-engineer undocumented endpoints.
- Do not bundle or redistribute a copy of the site's dataset.
- Keep manual research to individually inspected, exact item cross-references.
- Do not add any network permission or provider request to the browser extension.

The Terms of Service are published at https://tbhindex.com/ja/terms. The About page identifies maintainer contact routes, but SteamHub has not contacted the maintainer.

## Integration plan

1. Use TBH Index as the first human verification source for Task Bar Hero market items.
2. For each candidate, record the exact Steam market title, AppID, localized name, internal ItemKey, locale, source URL and verification date.
3. Independently verify the Steam listing's exact `market_hash_name`; reject ambiguous matches.
4. Add verified records to a versioned local game pack only after the reuse basis is clear. Keep `sourceItemId` and `source` as provenance metadata.
5. Prefer a documented or maintainer-approved on-demand provider over a scraper. Query only visible market items and preserve exact matching.

**Current status: primary reference selected; automated provider and full-catalog import remain blocked on access/reuse approval.**
