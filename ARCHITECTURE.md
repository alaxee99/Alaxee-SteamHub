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
  ├─ Game/AppID registry
  ├─ Exact item-key resolver (appid + market_hash_name)
  ├─ Provider adapters (verified sources only)
  ├─ Local cache + throttling
  ├─ DOM translation rules + MutationObserver scheduler
  └─ Translation UI / user controls
       ├─ Edge / Chrome Manifest V3 adapter  (first)
       └─ Steam CEF/CDP adapter              (optional later)
```

The core must not import `chrome.*`, `browser.*`, Steam CEF/CDP classes, or Millennium globals. Host adapters supply page identity, DOM access, navigation lifecycle, local storage, and UI mounting.

## First browser-extension slice

- Manifest V3 with static content scripts.
- Inject only on HTTPS Steam Community Market routes.
- Run in the browser's isolated content-script world.
- Use Steam's official Community Market language parameter `l=schinese`.
- Preserve existing market paths, query parameters, and fragments.
- Request no extension API permissions and no broad host permissions; static content-script match patterns define the supported pages.
- Do not read cookies, authentication state, account information, private inventory, or saves.

This first slice localizes Steam's own Community Market interface. It does **not** translate item names that Steam does not localize.

## Translation data model

A market item is resolved using the exact identity pair:

- `appid`: Steam application identifier.
- `market_hash_name`: Steam's exact market item key.

A provider result is usable only when the source and key establish an unambiguous exact match. Cache records should include provider/source, AppID, market hash name, locale, translation, and lookup timestamp. Missing or ambiguous matches must not replace the original text.

Taskbar Hero is AppID `3678970`. TBHIndex is a candidate provider for this game only after its data access path and usage terms are verified. The extension must query only items visible to the user, with rate limiting and local caching; no bulk crawl is allowed.

## Privacy and permissions

The initial extension uses only declarative content-script matching. It does not need a background service worker, `cookies`, `tabs`, `webRequest`, `scripting`, `debugger`, `nativeMessaging`, or remote code. Add a capability only when an implemented feature needs it, and keep the requested site scope narrow.

## Verification boundary

Automated tests cover manifest scope and locale URL handling. They cannot prove that Steam serves every page component in Simplified Chinese or that the extension works across real Steam Market navigation. Those claims require manual verification in Edge / Chrome.

Item-name translation is a separate milestone and must not be inferred from the locale redirect working.
