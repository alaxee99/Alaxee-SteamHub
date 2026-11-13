# TBH Index: primary Task Bar Hero market reference

Assessment date: 2026-11-13

## Decision

**Use TBH Index's Chinese Market Info detail pages as the primary human-readable source for Task Bar Hero market translations. Use Steam Community Market as the canonical list of exact item keys.**

No API or maintainer contact is needed for the current workflow: SteamHub is collecting a small, manually verified set of publicly readable pages for a private local dictionary. Do not turn this into a high-volume crawler. TBH Index's Terms of Service prohibit excessive scraping, interfering with or overloading its servers/APIs, and unauthorized access.

The useful division of responsibility is:

1. Steam Community Market search establishes which market items currently exist and provides the exact `market_hash_name`.
2. TBH Index's Simplified Chinese `/zh/market/item/{slug}` page gives the localized market-facing Chinese name and links directly to the corresponding Steam listing.
3. The linked Wiki item page provides additional game-catalog metadata such as `ItemKey`, `GearKey`, grade, type, level, stats and drop sources where exposed.

**Do not take the Wiki article heading as the preferred market translation when a separate localized Market Info page exists.** The article title may include an internal variant suffix that the market-facing localized label omits.

## Whole-site map

The Chinese homepage is https://tbhindex.com/zh and the localized Wiki directory is https://tbhindex.com/zh/wiki. The site advertises 19 interface languages and its own game-data snapshot Ver 1.3.2. The Wiki directory groups 18 reference areas across items, stages/monsters, heroes/combat and planning tools.

For SteamHub's market dictionary, prioritise these sections:

| Section | Published / observed coverage | What it contributes | Use in the market dictionary |
|---|---:|---|---|
| Gear | 1,576 in the page copy; one live rendering showed 1,590 rows | Equipment names, grade, slot, level, stats, Steam price | High; only when an exact Steam listing exists |
| Materials | Page copy says 189; page title says 143; link directory showed 159 | Materials, grade, effects, uses, prices | High; only when an exact Steam listing exists |
| Market Info | 1,757 tracked items in a recent page snapshot | Chinese-facing market names, grade/type, price, volume and individual market-detail pages | **Primary translation bridge** |
| Monsters | Heading says 74; body says 77; the list includes repeated boss/difficulty variants | Monster names and combat stats | Not a Steam item dictionary |
| Chests | 120 boxes | Chest names, grade odds, loot tables | Not a Steam item dictionary unless a chest is itself listed on Steam |
| Runes | 253 nodes, 29 distinct rune names | Account-wide progression and per-level effects | Not a Steam item dictionary |
| Stages | The page headline/FAQ says 192, while the summary table breaks down 30 + 53 + 53 + 53 = 189 | Stage names, waves, boss multipliers, drops | Separate terminology dictionary if needed |
| Heroes / skills / buffs / effects / guides | Separate reference pages | Game terminology and mechanics | Future in-game UI glossary, not market item names |

These counts are **not a clean, internally consistent export contract**. For example, the Materials page itself shows three different counts (143 in the page title, 189 in its text, and 159 in its browse list). The Gear listing copy says 1,576, while a live page rendering showed 1,590. Monster and Stage pages also disagree between headline and body counts. Treat advertised totals as navigation clues, not proof that every row is present.

## Canonical market coverage: Steam first

The Steam Community Market search page for AppID `3678970` currently reports **1,098 results**:

https://steamcommunity.com/market/search?appid=3678970&l=english

The TBH Index Market Info page showed **1,757 tracked items** in its latest inspected snapshot:

https://tbhindex.com/zh/market

Those numbers describe different sets and must not be treated as equivalent. The Steam result count is the baseline for currently discoverable market listings; TBH Index's larger tracked set may include historic, inactive, differently classified or otherwise non-current records. A dictionary claiming current full Steam Market coverage must be measured against Steam's current result set, not the larger TBH headline number.

Counts change over time. Record the collection date and re-check the Steam total before describing coverage as complete.

## Verified localized market mappings

The following are individually checked across TBH Index and the official Steam Community Market:

| Steam `market_hash_name` | TBH Index Chinese market label | Source catalog ID | Evidence |
|---|---|---:|---|
| `Mystic Armor (Beyond) A` | 神秘盔甲 | `516111` | TBH Market Info page links to the exact Steam listing and to Wiki item `516111` |
| `Silver Ingot` | 银锭 | `142001` | TBH Chinese Wiki item page exposes ItemKey 142001; Steam listing title is exact |
| `Kingdom 50th Anniversary Coin` | 王国50周年纪念币 | Not copied yet | TBH localized Market Info page shows the Chinese and English names; Steam listing title matches |
| `Starlight Sapphire` | 星光蓝宝石 | Not recorded | TBH Chinese Market Info label, direct Steam listing link and Steam listing title match |
| `Arcane Crystal` | 奥术水晶 | Not recorded | TBH Chinese Market Info label, direct Steam listing link and Steam listing title match |
| `Enchanted Ruby` | 附魔红宝石 | Not recorded | TBH Chinese Market Info label, direct Steam listing link and Steam listing title match |
| `Scroll of Arcana Inscription` | 奥术铭文卷轴 | Not recorded | TBH Chinese Market Info label, direct Steam listing link and Steam listing title match |

Evidence pages:

- Mystic Armor Market Info: https://tbhindex.com/zh/market/item/mystic-armor-beyond
- Mystic Armor Wiki: https://tbhindex.com/zh/wiki/gear/mystic-armor-beyond-516111
- Steam Mystic Armor: https://steamcommunity.com/market/listings/3678970/Mystic%20Armor%20(Beyond)%20A
- Silver Ingot Wiki: https://tbhindex.com/zh/wiki/materials/silver-ingot-rare-142001
- Steam Silver Ingot: https://steamcommunity.com/market/listings/3678970/Silver%20Ingot
- Kingdom Coin Market Info: https://tbhindex.com/zh/market/item/kingdom-50th-anniversary-coin-immortal
- Steam Kingdom Coin: https://steamcommunity.com/market/listings/3678970/Kingdom%2050th%20Anniversary%20Coin
- Starlight Sapphire Market Info: https://tbhindex.com/zh/market/item/starlight-sapphire-arcana
- Starlight Sapphire Wiki: https://tbhindex.com/wiki/materials/starlight-sapphire-arcana-115004
- Steam Starlight Sapphire: https://steamcommunity.com/market/listings/3678970/Starlight%20Sapphire
- Arcane Crystal Market Info: https://tbhindex.com/zh/market/item/arcane-crystal-arcana
- Arcane Crystal Wiki: https://tbhindex.com/wiki/materials/arcane-crystal-arcana-115001
- Steam Arcane Crystal: https://steamcommunity.com/market/listings/3678970/Arcane%20Crystal
- Enchanted Ruby Market Info: https://tbhindex.com/zh/market/item/enchanted-ruby-arcana
- Enchanted Ruby Wiki: https://tbhindex.com/wiki/materials/enchanted-ruby-arcana-115003
- Steam Enchanted Ruby: https://steamcommunity.com/market/listings/3678970/Enchanted%20Ruby
- Scroll of Arcana Inscription Market Info: https://tbhindex.com/zh/market/item/scroll-of-arcana-inscription-arcana
- Scroll of Arcana Inscription Wiki: https://tbhindex.com/wiki/materials/scroll-of-arcana-inscription-arcana-135001
- Steam Scroll of Arcana Inscription: https://steamcommunity.com/market/listings/3678970/Scroll%20of%20Arcana%20Inscription

The four newly added sourceItemId fields are intentionally omitted: the Wiki routes were confirmed, but the fetched readable page content did not explicitly expose an ItemKey value. The route suffix is not treated as proof of the catalog key.


- Mystic Armor Market Info: https://tbhindex.com/zh/market/item/mystic-armor-beyond
- Mystic Armor Wiki: https://tbhindex.com/zh/wiki/gear/mystic-armor-beyond-516111
- Steam Mystic Armor: https://steamcommunity.com/market/listings/3678970/Mystic%20Armor%20(Beyond)%20A
- Silver Ingot Wiki: https://tbhindex.com/zh/wiki/materials/silver-ingot-rare-142001
- Steam Silver Ingot: https://steamcommunity.com/market/listings/3678970/Silver%20Ingot
- Kingdom Coin Market Info: https://tbhindex.com/zh/market/item/kingdom-50th-anniversary-coin-immortal
- Steam Kingdom Coin: https://steamcommunity.com/market/listings/3678970/Kingdom%2050th%20Anniversary%20Coin

### Important label distinction

The Mystic Armor Wiki article title is `神秘盔甲A`, but the corresponding TBH localized **Market Info** page displays `神秘盔甲` and links directly to Steam's `Mystic Armor (Beyond) A` listing. For the Steam Market overlay, use the Market Info label `神秘盔甲`. This is a market-facing label choice, not an unresolved conflict between two translations.

## Starter pack

A small, importable, personally maintained starter pack is available at:

`docs/game-pack.tbhindex-seed.json`

It contains seven checked mappings: three original entries plus four newly cross-checked Arcana materials/inscription entries. It is intentionally **not** represented as a complete dictionary. Each record uses Steam's exact market hash name as its matching key; `sourceItemId` is optional provenance metadata, never the resolver key.

## Collection rules

For each new record:

1. Start from a real Steam Community Market listing for AppID `3678970`; copy its exact market hash name without altering punctuation, spacing, case or suffixes.
2. Open the matching TBH Index localized Market Info page and record its Chinese market-facing name.
3. Follow its full Wiki page link only when the internal `ItemKey` is useful; store the ID only when it is visibly verified.
4. If the market detail page, Wiki item, and Steam listing do not agree on identity, leave the entry out until resolved.
5. Store source label `tbhindex.com`. Keep source page URLs and verification notes in the research ledger, not in the matching key.
6. Keep unverified, stale, non-tradable and ambiguous rows separate from the verified game pack.

Use normal public page navigation and small, deliberate batches. Do not reverse-engineer private endpoints, bypass site controls, overload the site, or automatically crawl the whole catalogue. This local collection is not a public mirror of TBH Index.

## Other community references

Other community sites remain useful for cross-checking missing names and game-version differences, but their counts are not interchangeable:

- `taskbarhero.wiki`: secondary item/drop/market cross-check.
- `taskbarherowiki.com`: auxiliary catalog; the inspected `/data/items.json` exposed English names and item metadata but not the required Chinese-to-Steam crosswalk.
- `tbherohelper.com`: auxiliary data reference; its reported game version and collection counts differ from TBH Index.

**Current status: TBH Index selected as the primary Chinese market-name reference; a seven-entry verified local seed exists; full current-market coverage has not yet been established.**

## Latest collection batch (2026-11-13)

Four additional records were checked in a small batch. For each item, the TBH Simplified Chinese Market Info page showed the Chinese market label and English market name, linked directly to the matching AppID 3678970 Steam listing, and linked to the corresponding Wiki article. The official Steam listing title independently matched the exact dictionary key.

- `Starlight Sapphire` → `星光蓝宝石`
- `Arcane Crystal` → `奥术水晶`
- `Enchanted Ruby` → `附魔红宝石`
- `Scroll of Arcana Inscription` → `奥术铭文卷轴`

The Wiki route suffixes are retained only in the evidence URLs. Since the fetched readable page content did not explicitly expose the actual `ItemKey` field, `sourceItemId` remains unset for these four records.
