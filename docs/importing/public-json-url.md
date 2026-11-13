# Public Game Pack URL import

The extension Options page can load an already-built public JSON game pack from a direct HTTPS URL.

## Use

1. Open ALAXEE SteamHub → Options → **批量导入数据包**.
2. Paste a direct URL to a JSON file that follows `alaxee-steamhub-game-pack` schema version 1.
3. Click **读取链接** and approve access to that origin when Chrome/Edge prompts.
4. Review the loaded JSON and choose **合并（冲突时拒绝）** or **覆盖该游戏词库**.
5. For replace mode, export a backup first; replace affects only the AppID in the pack.

Current Task Bar Hero pack URL:

`https://raw.githubusercontent.com/alaxee99/Alaxee-SteamHub/feat/browser-extension-first/docs/game-pack.taskbar-hero-zh-CN.json`

## What this does and does not do

- Reads one user-supplied JSON resource; it does not follow links, enumerate a sitemap, or crawl a website.
- Accepts only the SteamHub Game Pack v1 schema. A Wiki HTML page, homepage URL, sitemap, CSV, or unrelated JSON is not an importable pack.
- A website-specific adapter is required to turn page content into exact `market_hash_name` translation records. HTML page structure, pagination, lazy loading, locale variants and item identity differ between sites.
- No cookies, credentials, referrer, or Steam session data are sent. Cross-origin redirects are rejected.
- Only HTTPS URLs without embedded credentials or custom ports are accepted. The extension asks for access to the single URL origin after an explicit click; it does not retain broader required host permissions.
- The response is capped at 5 MiB and a 20-second timeout. Malformed JSON, invalid packs, duplicate keys and schema errors are rejected before the existing merge/replace flow.

## Why URL import is separate from Wiki crawling

A copied Wiki URL is a useful starting point, but one page does not necessarily contain all of a site's content. A complete importer would need to discover permitted pages, follow pagination and lazy-loaded records, understand each page's data structure, and map each record to a verified Steam market key. Generic HTML-to-dictionary guessing would introduce false translations.

For Task Bar Hero, the existing bulk game catalog is already a structured source with `zh-Hans` names and marketability metadata. It is the preferred bulk source; TBH Index remains a selective public-page cross-check. Do not bulk crawl TBH Index or reverse-engineer undocumented endpoints; see `docs/providers/tbhindex.md` and the repository's `AGENTS.md` rules.
