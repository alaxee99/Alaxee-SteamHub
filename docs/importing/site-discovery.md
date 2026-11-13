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
