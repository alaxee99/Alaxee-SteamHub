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

The current primary human reference for Task Bar Hero item mapping is TBH Index (tbhindex.com): it publishes a broad Ver 1.3.2 catalogue, 19 locales, and individual item pages that can expose the internal ItemKey, localized title, and exact Steam Market item name. The Farming calculator page itself is incomplete for measured rankings (108 of 168 farmable stages), so item mapping uses its Gear / Materials / Market pages instead. TBH Index is not connected as an automated provider: its terms restrict excessive scraping, and no supported API/CORS or bulk redistribution permission has been verified. See docs/providers/tbhindex.md for the source comparison and coverage limits.

## Configure games

Open the extension's Options page from edge://extensions or chrome://extensions.

For each game:

1. Enter its Steam AppID and display name.
2. Enter exact item keys and translations manually, or import a game pack JSON file.
3. Enable or disable the game independently.
4. Search the selected game's dictionary and edit or delete an individual item/locale entry.
5. Export the game's pack to back it up or share it.

A pack example is available at docs/game-pack.example.json. Its translation entries are illustrative placeholders, not a complete or verified Task Bar Hero dictionary. The separate taskbarhero.wiki site remains a secondary market cross-check only; see docs/providers/taskbarhero-wiki.md. Each entry may also include `sourceItemId`, an optional exact ID from the game's own catalog; this is metadata for cross-referencing and does not replace Steam's exact `market_hash_name` match.

## Install for local testing

1. Open edge://extensions in Microsoft Edge or chrome://extensions in Chrome.
2. Enable Developer mode.
3. Select Load unpacked and choose the repository's extension/ directory.
4. Open the extension's Details page and select Extension options, or open its options page directly.
5. Add a game and import or enter translations before opening its Steam Market page.

This is source for local testing, not a browser-store release.

## Privacy and data handling

- The extension requests only the storage permission for local game packs and translation cache.
- It does not read Steam cookies, authentication tokens, account details, private inventory, or save files.
- Imported packs are stored locally in the browser's extension storage.
- Merge import rejects conflicting translations; replace import replaces only the selected game's pack.
- No telemetry, account login, cloud sync, bulk crawling, or remote code is included.

See ARCHITECTURE.md, AGENTS.md, and docs/providers/tbhindex.md.
