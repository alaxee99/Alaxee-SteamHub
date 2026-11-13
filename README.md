# ALAXEE SteamHub

ALAXEE SteamHub is a multi-game browser extension for improving Steam Community Market pages with exact-match Chinese translations.

## Current status — v0.6.0

- Manifest V3 extension restricted to Steam Community Market pages.
- Per-game profiles keyed by Steam AppID; each game has its own enable state and translation dictionary.
- Settings page supports manual game registration, searchable dictionary management (single-entry edit/delete), JSON game-pack import/export, per-game enable/disable, and deletion.
- Game-pack schema is versioned and supports up to 10,000 exact translation entries per game.
- Market item identity uses the exact appid + market_hash_name pair.
- Local dictionaries are resolved by exact AppID, market hash name, and locale; no fuzzy matching.
- Local game packs are persistent extension data. The 30-day translation cache remains available for future remote providers.
- A Steam market adapter is implemented first. Other game surfaces that do not use Steam Community Market require their own adapter; they are not silently treated as supported.

TBH Index (tbhindex.com) is the primary Chinese market-name reference for Task Bar Hero. SteamHub uses Steam's current AppID 3678970 Market search results as the canonical source of exact item keys, then cross-checks each item's Chinese name on TBH Index's localized Market Info page and its internal ItemKey on the linked Wiki page. A small three-entry personal-use seed is available at docs/game-pack.tbhindex-seed.json. TBH Index currently displays 1,757 tracked market records while Steam's current search reports 1,098 results; those sets are not interchangeable. Several Wiki category pages also have inconsistent headline and rendered counts. See docs/providers/tbhindex.md.

## Configure games

Open the extension's Options page from edge://extensions or chrome://extensions.

For each game:

1. Enter its Steam AppID and display name.
2. Enter exact item keys and translations manually, or import a game pack JSON file.
3. Enable or disable the game independently.
4. Search the selected game's dictionary and edit or delete an individual item/locale entry.
5. Export the game's pack to back it up or share it.

A schema-only pack example is available at docs/game-pack.example.json. A separate three-entry personally verified starter pack is available at docs/game-pack.tbhindex-seed.json; it is not a complete Task Bar Hero dictionary. The separate taskbarhero.wiki site remains a secondary market cross-check only; see docs/providers/taskbarhero-wiki.md. Each entry may also include `sourceItemId`, an optional exact ID from the game's own catalog; this is metadata for cross-referencing and does not replace Steam's exact `market_hash_name` match.

## Convert a structured JSON / CSV source

The Options page can also turn public JSON record arrays or CSV tables into a SteamHub Game Pack. Supply the target AppID and map the exact Steam market_hash_name, localized text and optional source ID fields. JSON supports nested record paths such as data.items; CSV supports quoted commas and multiline cells. Duplicate identical rows are collapsed; conflicting translations or source IDs are excluded and reported. See docs/importing/structured-json-csv.md.

This handles structured source data, not arbitrary Wiki HTML. A website-specific page adapter is still needed to discover permitted pages and extract exact Steam listing identities.
## Import a public Game Pack URL

The Options page accepts a direct HTTPS URL to a JSON file using the `alaxee-steamhub-game-pack` v1 schema. After an explicit click, the extension requests optional access to that one HTTPS origin, fetches without cookies or referrer, rejects redirects, and enforces a 5 MiB streaming limit and 20-second timeout. The fetched pack is validated and placed in the JSON editor; the user must still choose merge or replace.

This is not a generic Wiki crawler. A Wiki homepage, HTML page, sitemap or CSV is not a Game Pack. Turning site pages into translations requires a source-specific parser and exact Steam `market_hash_name` mapping. See `docs/importing/public-json-url.md`.

Current Task Bar Hero pack URL:

`https://raw.githubusercontent.com/alaxee99/Alaxee-SteamHub/feat/browser-extension-first/docs/game-pack.taskbar-hero-zh-CN.json`

## Install for local testing

1. Open edge://extensions in Microsoft Edge or chrome://extensions in Chrome.
2. Enable Developer mode.
3. Select Load unpacked and choose the repository's extension/ directory.
4. Open the extension's Details page and select Extension options, or open its options page directly.
5. Add a game and import or enter translations before opening its Steam Market page.

This is source for local testing, not a browser-store release.

## Privacy and data handling

- The extension requires storage for local game packs and translation cache. A user-triggered public JSON import may request optional access to the supplied HTTPS origin only.
- It does not read Steam cookies, authentication tokens, account details, private inventory, or save files.
- Imported packs are stored locally in the browser's extension storage.
- Merge import rejects conflicting translations; replace import replaces only the selected game's pack.
- No telemetry, account login, cloud sync, bulk crawling, or remote code is included.

See ARCHITECTURE.md, AGENTS.md, and docs/providers/tbhindex.md.
