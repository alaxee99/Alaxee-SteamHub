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
