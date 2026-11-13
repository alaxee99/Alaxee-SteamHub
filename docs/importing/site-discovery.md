# Wiki site discovery

Options → Batch Import → **分析 Wiki / 网站目录（站点发现）** accepts a public HTTPS homepage or sitemap URL and builds a bounded same-origin page directory preview.

## Discovery behavior

1. Validates the user-supplied HTTPS URL and requests access to that single origin after the button click.
2. Reads the same-origin robots.txt.
3. Uses sitemap URLs declared in robots.txt. If no sitemap is declared, it tries /sitemap.xml. If the user supplied an XML URL directly, it also treats that URL as a sitemap entry.
4. Resolves sitemap indexes up to 8 sitemap documents and collects at most 500 same-origin page URLs.
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
