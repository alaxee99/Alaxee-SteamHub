# Wiki site discovery

Options → Batch Import → **分析 Wiki / 网站目录（站点发现）** accepts a public HTTPS homepage or sitemap URL and builds a bounded same-origin page directory preview.

## Discovery behavior

1. Validates the user-supplied HTTPS URL and requests access to that single origin after the button click.
2. Reads the same-origin robots.txt.
3. Uses sitemap URLs declared in robots.txt. If no sitemap is declared, it tries /sitemap.xml. If the user supplied an XML URL directly, it also treats that URL as a sitemap entry.
4. Resolves sitemap indexes up to 8 sitemap documents and collects at most 500 same-origin page URLs. Each robots / sitemap response is capped at 1 MiB with a 10-second timeout.
5. Applies the selected robots.txt Allow / Disallow rules to discovered page URLs.
6. Shows the count and a preview of up to 30 discovered URLs.

## What it does not do

- Does not fetch the discovered page bodies.
- Does not recursively follow ordinary HTML links.
- Does not bypass robots rules, cross-origin sitemap entries, or HTTPS validation.
- Does not infer Steam market names or create dictionary entries.
- Does not determine whether a site's Terms of Service permit bulk reuse; robots.txt is not a reuse license.

## Next adapter stage

A site-specific adapter must use the discovered URL list to extract structured records from the relevant page type, handle pagination or lazy-loaded content where permitted, and map every record to an exact Steam market_hash_name. The adapter must also verify the source's automated-access and redistribution constraints before fetching page content in batches.

TBH Index is not a target for automated bulk crawling in this project. Its public pages remain selective manual cross-checks. Use this discovery flow with sources whose terms allow the intended access, and prefer documented JSON / CSV feeds when available.


## Single-page HTML table extraction

The site directory now offers a manual **选作解析页面** action. The extension fetches a page only after the user clicks **读取并分析表格**. The request is limited to one explicitly selected HTTPS page on the analyzed origin, requests that origin's optional host permission, omits credentials, rejects redirects, and uses a 1 MiB / 10-second fetch budget.

The HTML parser uses the extension options page's inert `DOMParser` document. It never inserts source markup into the extension UI and reads only explicit table rows and header cells. It skips tables without a recognizable header and tables with spanning header/data cells that could shift column alignment. Limits are 20 tables per page and 500 data rows per table. Preview text is rendered with DOM text nodes.

The page fetch is enabled only after a successful site-directory analysis. The selected page must match that directory's origin and pass the parsed robots.txt rules; if robots.txt cannot be read for a reason other than HTTP 404, page reading fails closed. The request explicitly accepts HTML, uses the same 1 MiB / 10-second cap, and still sends no credentials.

The user must manually choose the exact Steam `market_hash_name` column, translation column, locale, and optional source ID column. A generic item-name column is not treated as a Steam market key. The resulting Game Pack is staged in the JSON editor; merge/replace remains a separate explicit action.

This is a bounded generic table extractor, not permission to crawl a site. It does not follow links, paginate, run JavaScript, load lazy content, submit forms, or fetch more pages. Review source terms before using extracted data; no site terms or redistribution rights are inferred. TBH Index remains excluded from automated bulk crawling.


## Exact source-ID reverse mapping

Wiki tables often expose a game-internal `ItemKey` or numeric item ID instead of Steam's `market_hash_name`. The HTML table mapper now supports two explicit modes:

1. **Direct market key:** choose the column that already contains the exact Steam `market_hash_name`.
2. **Source ID lookup:** choose an imported SteamHub game profile as the reference catalog, map the Wiki's exact ItemKey / ID column and translation column, then join the ID against that profile's `translations[].sourceItemId`.

The join is exact and case-sensitive. A source ID that maps to multiple distinct market names in the reference catalog is ambiguous and excluded. Unknown IDs, missing IDs, missing translations, duplicate rows and conflicting translations are counted separately. No item-name or variant inference is performed.

For Task Bar Hero, the repository includes `docs/game-pack.taskbar-hero-zh-CN.json` as a Steam reference catalog: 1,106 exact market keys, 1,070 with source IDs. The current catalog's source IDs are unique. For example, ItemKey `516111` maps to `Mystic Armor (Beyond) A`; `142001` maps to `Silver Ingot`. Import the reference Game Pack into the extension once before using this lookup mode.

This only makes records from an individually selected, permitted page mappable. It does not authorize crawling all Wiki pages or bypass site terms. TBH Index remains excluded from automated bulk crawling.


## Repeated HTML item-card extraction

The same explicitly fetched page can also be analyzed as a repeated item-card grid. Candidate CSS selectors are suggested from repeated semantic classes such as `.item-card`, `.product-card`, `article`, and data attributes such as `[data-item-key]`. Suggestions are only structural hints; the user selects or edits the card selector.

The user configures three pieces of page structure:
- Card selector: identifies one repeated item block.
- ID selector + attribute: reads an exact source ID (default attribute detection checks `data-item-key`, `data-item-id`, `data-itemid`, `data-id`, and `data-key`).
- Translation selector: reads the localized item label inside each card.

The parser returns only text values and exact IDs. It does not infer the item's Steam key from a display name. The result is limited to 500 cards, previews at most 8 records, skips cards missing an ID or translation, and reuses the already fetched HTML body without another request. Select **Wiki ItemKey / ID** mode to join IDs against an imported reference Game Pack, or **direct market key** mode only when the selected ID node contains an exact Steam `market_hash_name`.

This generic extractor does not run scripts, execute JavaScript, load lazy content, follow links, paginate, or fetch any additional page. CSS selectors are user-defined and must be checked against the page preview. The source's automated-access and reuse terms still apply.


## Single-item HTML detail-page extraction

The same selected and already-fetched HTML page can be parsed as one item detail record. The detail parser reads explicit key/value pairs from definition lists (dt / dd), simple two-cell key/value rows, semantic meta values and itemprop values. It recognizes configured source-ID labels such as ItemKey / Item ID and configured localized-name labels such as 简体中文 / Chinese Name. Labels are exact after case / spacing / punctuation normalization; they are not fuzzy-matched.

For site-specific pages, the user may provide a CSS selector for the source ID and/or translation node. A selector overrides the corresponding label matching. The page heading is displayed as context only and is never silently treated as a translation. Multiple different values for the selected ID or translation are marked ambiguous and cannot be converted. The preview shows the extracted ID, translation, page title and matched labels.

A valid detail record contains exactly one source ID and one translation. It enters the same direct-exact-market-key or imported-reference-pack ItemKey mapping path as table/card records. The generated Game Pack remains staged for review; merge / replace must be chosen separately. Extraction reuses the selected page body and performs no second request, link traversal, pagination, JavaScript execution or bulk page fetching.


## Real-page compatibility check: TaskBarHeroWiki Minor Ruby

A manual one-item inspection was performed on the [Minor Ruby detail page](https://taskbarherowiki.com/items/110001). The page exposes Item ID #110001 and the English item name Minor Ruby. In the inspected rendered DOM, the ID node selector was `span.font-mono.text-xs.text-text-faint > span:nth-child(2)` and the heading selector was `h1.text-white.text-4xl.font-bold`.

The inspected page did not expose a visible Simplified Chinese item name; its page language was English. Do not map the English heading into the zh-CN locale. The existing Task Bar Hero reference Game Pack independently contains the exact record sourceItemId 110001 → marketHashName Minor Ruby, with 小红宝石 as its Chinese translation. A regression test pins that exact one-item ID join. The source page terms restrict use to personal, non-commercial informational purposes and prohibit bulk scraping without prior written consent; this compatibility check does not authorize crawling its catalog.