# Public source URL import

The extension Options page supports two direct HTTPS source workflows:

- **SteamHub Game Pack URL:** loads an already-built JSON pack using schema version 1.
- **Structured JSON / CSV URL:** loads a public data file so the user can map its record fields into a SteamHub Game Pack. See `docs/importing/structured-json-csv.md`.

## Use a public Game Pack URL

1. Open ALAXEE SteamHub → Options → **批量导入数据包**.
2. Paste a direct URL to a JSON file that follows `alaxee-steamhub-game-pack` schema version 1.
3. Click **读取链接** and approve access to that origin when Chrome/Edge prompts.
4. Review the loaded JSON and choose **合并（冲突时拒绝）** or **覆盖该游戏词库**.
5. For replace mode, export a backup first; replace affects only the AppID in the pack.

Current Task Bar Hero pack URL:

`https://raw.githubusercontent.com/alaxee99/Alaxee-SteamHub/feat/browser-extension-first/docs/game-pack.taskbar-hero-zh-CN.json`

## Shared remote-read controls

- Only HTTPS URLs without embedded credentials or custom ports are accepted.
- The extension asks for access to the single URL origin after an explicit click; no broad required host permission is added.
- No cookies, credentials, referrer, or Steam session data are sent.
- Cross-origin redirects are rejected.
- The response is streamed with a 5 MiB size cap and a 20-second timeout.
- A Game Pack URL must pass the existing schema validator before it is placed into the import editor.

## Discover a Wiki site map

The same Options panel also includes a bounded site discovery preview. Paste a public HTTPS Wiki homepage or sitemap URL, then click **发现页面目录**. SteamHub reads the same-origin robots.txt and sitemap documents, follows sitemap-index files within limits, applies robots rules and displays up to 30 candidate page links.

It does not download page bodies, follow ordinary HTML links, or generate translations. This identifies the candidate content pages; a site-specific adapter is still needed to extract rows and map each one to an exact Steam market key. See `docs/importing/site-discovery.md`.
## Scope boundary

A public source URL does not automatically mean a whole website can be safely or correctly imported. The structured mode reads only the supplied JSON or CSV resource; it does not follow links, enumerate sitemaps or crawl a website. A normal Wiki HTML page or homepage needs a dedicated page adapter to discover permitted content pages, interpret their structure and map items to exact Steam market keys.

Do not bulk-crawl a source whose terms prohibit it. TBH Index remains a selective manual cross-check source; it is not crawled by this importer. See `docs/providers/tbhindex.md` and `AGENTS.md`.
