# Structured JSON / CSV source mapping

The Options page supports converting a public JSON record array or CSV table into a SteamHub Game Pack v1 without requiring the source to pre-build the SteamHub schema.

## Workflow

1. Open Options → Batch Import → **从公开 JSON / CSV 目录转换词库**.
2. Paste a direct HTTPS data-file URL or select a local .json / .csv file.
3. Choose JSON or CSV and enter the source field names.
4. For JSON objects, set the record path (for example, data.items). Leave it blank when the JSON root is already an array.
5. Map the exact Steam market_hash_name, the localized translation field, and optionally the source item ID.
6. Set target AppID, game name, locale and a short source label.
7. Click **转换为游戏数据包**, review the generated pack in the JSON editor, then choose merge or replace.

The current Task Bar Hero catalog convention can be mapped with:

| Setting | Value |
|---|---|
| Format | JSON record array |
| Record path | leave blank if root is an array |
| Target AppID | 3678970 |
| Locale | zh-CN |
| Steam key field | market_hash_name |
| Translation field | zh-Hans |
| Source ID field | id |

## Mapping rules

- The Steam key must already be the exact Steam market_hash_name. The mapper does not derive equipment variants, remove suffixes, trim keys or fuzzy-match English names.
- The translation field must contain a non-empty string.
- Optional source IDs are provenance only; they do not participate in Steam translation matching.
- Identical duplicate rows with the same translation and source ID are collapsed.
- If one market key has different translations or different source IDs, that key is excluded from the generated pack and counted as a conflict.
- Rows without an exact Steam key or translation are skipped and counted.
- Nested JSON fields support dot paths, such as market.market_hash_name and names.zh-Hans; unsafe prototype-related path segments are rejected.
- CSV supports quoted commas, escaped quotes, CRLF and multiline quoted cells.
- Each conversion is capped at 10,000 records. Remote source reads use HTTPS only, ask for the single origin's optional permission after a click, omit credentials/referrer, reject redirects, and apply a 5 MiB streaming limit and 20-second timeout.

## Scope

This is a structured-data importer, not a general-purpose Wiki crawler. A normal Wiki homepage or HTML article is not automatically a list of game items. A site-specific adapter must discover permitted content pages, understand the page structure and map each item to an exact Steam market key before it can generate reliable dictionary records.

Do not run a bulk crawl where the source's terms prohibit it. TBH Index remains a selective manual cross-check source; its site is not used by this importer. Prefer a documented public JSON/CSV feed or an explicitly supported export when a source offers one.


## Mapping Wiki IDs through a reference Game Pack

A source page may have its own item identifier but no Steam market name. In that case, do not map the displayed item label to Steam by guesswork. Import a reference SteamHub Game Pack into the target game profile first, then use the HTML importer’s **用 Wiki ItemKey / ID 反查已导入的 Steam 目录** mode. Select the Wiki ID column and translation column; the importer joins the source ID exactly to the reference pack's `sourceItemId` and obtains its `marketHashName`.

IDs that are unknown, map to multiple distinct Steam keys, or have conflicting Wiki translations are excluded and reported. A valid reference profile is required. For Task Bar Hero, use `docs/game-pack.taskbar-hero-zh-CN.json` (1,106 Steam keys; 1,070 carry source IDs). The mapping remains exact; this does not turn TBH Index into an automated bulk-crawl target.
