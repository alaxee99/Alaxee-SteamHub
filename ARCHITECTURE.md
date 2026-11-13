# ALAXEE SteamHub architecture

Date: 2026-11-13

## Product decision

Build the browser extension first. The primary use case is improving Steam Community Market pages opened in a normal browser, so a Steam desktop injection runtime is not justified as the first delivery path.

| Host option | Decision | Trade-off |
|---|---|---|
| Edge / Chrome Manifest V3 extension | First implementation | Simple install and update path; works only in browser tabs, not inside the Steam desktop client |
| Standalone Steam CEF/CDP adapter | Optional later adapter | Reuses the same core but requires Steam launch flags and a powerful unauthenticated local debugging endpoint |
| Millennium / Extendium | Compatibility fallback only | Adds a third-party framework dependency |
| Steam binary patching / native injection | Reject | Fragile across Steam updates and increases security risk |
| HTTPS interception / MITM | Reject | Unnecessary certificate, privacy, and network-wide risks |

The previous standalone CDP proof of concept remains on its separate development branch. It is not part of the browser extension's dependency graph.

## Target architecture

```text
ALAXEE Translation Core
  ├─ Market item identity (appid + exact market_hash_name)
  ├─ AppID/game registry
  ├─ Exact-match translation resolver
  ├─ Verified provider adapters
  ├─ Namespaced extension-local cache + expiry
  ├─ Per-provider serialized rate limiter
  └─ DOM translation rules + UI
       ├─ Edge / Chrome Manifest V3 adapter  (first)
       └─ Steam CEF/CDP adapter              (optional later)
```

The identity and translation modules do not import `chrome.*`, `browser.*`, Steam CEF/CDP classes, or Millennium. Host adapters supply page identity, DOM access, storage, and UI mounting.

## Current implementation

- Manifest V3 static content scripts run only on HTTPS Steam Community Market routes.
- Steam's official Community Market language parameter `l=schinese` is applied while preserving the original path, query parameters, and fragment.
- Listing links are parsed into an exact `appid + market_hash_name` pair. Market hash names are case-sensitive and are not lowercased, trimmed, or fuzzy-normalized.
- The translation engine accepts a provider record only when AppID, exact market hash name, and locale match and there is exactly one candidate.
- Successful exact translations can be stored in a namespaced extension-local cache with a default 30-day TTL.
- Provider lookups can be serialized through a configurable minimum-interval limiter.
- The provider registry is currently empty. No item-name translation is claimed to be available yet.

## Translation data model

A market item is resolved using the exact identity pair:

- `appid`: Steam application identifier.
- `market_hash_name`: Steam's exact market item key.

A provider record contains the same identity pair, locale, translation, and source. Cache metadata adds a retrieval timestamp and expiry. A result with a different key, different locale, empty translation, or multiple exact candidates is rejected. Original Steam text remains unchanged unless a unique exact translation is available.

Task Bar Hero is AppID `3678970`. TBHIndex is a candidate provider for this game only after its data access path and usage terms are verified. See [the provider assessment](docs/providers/tbhindex.md).

## Privacy and permissions

The extension requests only the `storage` permission for its local translation cache. It does not need a background service worker, `cookies`, `tabs`, `webRequest`, `scripting`, `debugger`, `nativeMessaging`, broad host permissions, or remote code. Cache records are kept in the extension's storage area, not Steam page localStorage. Add any other capability only when an implemented feature demonstrably needs it.

The extension does not read authentication state, account information, private inventory, or saves. It does not add telemetry, account login, cloud sync, or proxy control.

## Provider access rules

Do not reverse-engineer undocumented front-end endpoints or bulk scrape a provider's website. Before enabling a provider, verify its documented access method, automated-use permission, CORS behavior, rate limits, attribution, and cache policy. Query only market items currently visible to the user and preserve the exact-match requirement.

## Verification boundary

Automated tests cover URL scope, item-key extraction, exact match validation, cache expiry, provider throttling, and storage namespacing. They cannot prove that Steam serves every page component in Simplified Chinese or that the extension works across real Steam Market navigation. Those claims require manual verification in Edge / Chrome.

Item-name translation remains unavailable until a verified provider is enabled and real exact matches are checked.
