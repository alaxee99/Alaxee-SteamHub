# TBH Index provider assessment

Assessment date: 2026-11-13

## What is publicly verifiable

- TBH Index describes itself as an independent Task Bar Hero reference site.
- Its public wiki describes a gear database and says item pages include live Steam Market prices.
- Its public site says the database covers 1,576 gear items and supports 19 languages.
- These facts establish that the site is a potentially useful human-facing reference. They do not establish a supported third-party API contract.

References:
- https://tbhindex.com/
- https://tbhindex.com/wiki
- https://tbhindex.com/wiki/gear

## Integration status

**Not connected.** During this assessment, no public developer API reference, supported endpoint contract, authentication guidance, CORS statement, rate limit, or automated-access permission was found in the publicly discoverable pages.

Do not infer or reverse-engineer a private JSON endpoint from the site's front-end implementation. Do not scrape wiki pages or bulk-export the catalogue.

## Requirements before enabling a provider

1. Confirm a documented endpoint or obtain explicit maintainer approval for a supported integration.
2. Confirm the allowed request origin, browser-extension CORS behavior, usage limits, attribution requirements, and cache policy.
3. Query only a currently rendered Steam Market item after the user views it.
4. Match on the exact pair `appid + market_hash_name`; no fuzzy fallback.
5. Persist source, exact match key, locale, translation, and retrieval timestamp.
6. Leave Steam's original item text unchanged when the provider returns no exact result, multiple conflicting results, or an invalid response.

Until those conditions are met, the provider registry remains empty and the UI must not imply that TBH Index translations are available.


## Separate resource: TaskbarHerowiki.com (not taskbarhero.wiki)

A separate public resource, [Task Bar Hero Wiki](https://www.taskbarherowiki.com/), advertises a 5,934-item database and says its item, hero, and stage names use the game's own localizations across ten languages. A public `/data/items.json` response was inspected for this integration work. The observed item records include fields such as numeric `key`, English `name`, `type`, `tradable`, `variant`, and item stats; the inspected payload did not expose a Chinese translation field or a Steam `market_hash_name` crosswalk.

A third-party helper repository documents the enriched dataset under `https://www.taskbarherowiki.com/data/*.json` and describes it as CORS-enabled, but that is not a first-party API or license grant:
- https://github.com/enginc4n/taskbar-hero-wiki-helper
- https://www.taskbarherowiki.com/data/items.json
- https://www.taskbarherowiki.com/zh

**Integration decision:** do not fetch this catalog from the extension or redistribute its data in SteamHub yet. The current verified use is as a candidate source of external item IDs and catalog metadata. SteamHub now stores an optional `sourceItemId` on each exact `market_hash_name` translation record, so an independently verified mapping can connect the Steam market item to the game's internal item record. Actual Chinese translations still require a confirmed localized data export or maintainer-approved source, and the dataset's redistribution terms must be checked before bundling it.
