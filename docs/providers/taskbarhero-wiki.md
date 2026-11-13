# TaskBarHero.wiki secondary community data source assessment

Assessment date: 2026-11-13

Priority: secondary cross-check only. TBH Index at [tbhindex.com](https://tbhindex.com/) is now the primary human reference for Task Bar Hero market-item mapping. See [the source comparison and coverage assessment](tbhindex.md).

## What is verifiable

The separate community site [taskbarhero.wiki](https://taskbarhero.wiki/) is distinct from [taskbarherowiki.com](https://www.taskbarherowiki.com/).

Its public database page says it contains 45 extracted datasets and 25,757 rows, including 5,944 item rows and 5,760 gear rows. Its public market page exposes 935 tradable market entries and has localized routes, including Simplified Chinese. The site describes itself as a community-made, datamined fan project and explicitly says it is not affiliated with or endorsed by the game developer.

References:
- https://taskbarhero.wiki/zh-hans
- https://taskbarhero.wiki/database
- https://taskbarhero.wiki/zh-hans/market
- https://taskbarhero.wiki/privacy

## A verifiable cross-reference example

One sample mapping can be checked manually across the community wiki and Steam Market:

| Field | Observed value |
|---|---|
| Steam AppID | `3678970` |
| Wiki item route | `/zh-hans/items/516111-mystic-armor` |
| Wiki catalog route ID | `516111` |
| Simplified Chinese name | `神秘盔甲` |
| Wiki rarity / category | Beyond / Armor, level 50 |
| Steam Market listing name | `Mystic Armor (Beyond) A` |

The localized Wiki market detail route is `/zh-hans/market/516111-mystic-armor`; the corresponding Steam Market listing is publicly visible at:

https://steamcommunity.com/market/listings/3678970/Mystic%20Armor%20(Beyond)%20A

This demonstrates why the translation record needs two separate identifiers: Steam's exact `market_hash_name` and the source catalog's own item ID. The latter is provenance/cross-reference metadata only and must not be substituted for the Steam match key.

## Access and licensing limits

The pages above are publicly readable, and the privacy page describes site analytics and local language preference. However, the public legal/footer navigation inspected for this assessment did not provide a documented developer API, an automated-access policy, an explicit CORS contract, rate limits, or a data redistribution license. A privacy policy is not an API grant or redistribution license. The site's footer also says game content, names, and assets remain the property of their respective owners.

Therefore:

- Do not scrape all 935 market rows or 5,944 item records.
- Do not reverse-engineer private client endpoints or bundle the community site's full dataset.
- Do not enable an automatic extension request until the maintainers confirm an allowed access method, CORS behavior, rate limits, attribution, and caching/reuse terms.
- A user may manually record an independently verified mapping in a local game pack. Set `source` to `taskbarhero.wiki` and `sourceItemId` to the Wiki catalog ID; retain the exact Steam `market_hash_name` as the matching key.
- When an approved source contract exists, implement it as a dedicated provider adapter and query only visible items on demand.

## Current SteamHub status

**Candidate source only; not connected.** SteamHub 0.6.0 stores optional `sourceItemId` and source/provenance text in each translation entry. The generic provider contract and exact match resolver are ready for a later approved adapter, but no community Wiki requests are made by the extension.
