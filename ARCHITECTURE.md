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

## Multi-game architecture

```text
ALAXEE SteamHub
  ├─ Game registry (one profile per Steam AppID)
  │    ├─ game name + enabled state
  │    ├─ page adapter ID
  │    └─ item-key strategy
  ├─ Versioned game packs
  │    ├─ exact item identifiers
  │    ├─ locale-specific translations
  │    └─ source / provenance metadata
  ├─ Exact resolver (AppID + market_hash_name + locale)
  ├─ Translation cache + expiry (for remote providers)
  └─ Host adapters
       ├─ Edge / Chrome Steam Market adapter (first)
       └─ Steam CEF/CDP adapter (optional later)
```

Every game has its own profile and dictionary. Identical item names in two games never share a translation because AppID is part of the identity. Game packs are versioned and can be manually edited, imported, exported, enabled, disabled, or removed from the extension options page.

The registry and pack format are host-independent. The first adapter supports Steam Community Market using market_hash_name. Other game surfaces can add a different adapter and item-key strategy without rewriting the registry or translation resolver; they are not implicitly claimed to work in this release.

## Current implementation

- Manifest V3 static content scripts run only on HTTPS Steam Community Market routes.
- Steam's official Community Market language parameter l=schinese is applied while preserving the original path, query parameters, and fragment.
- Listing links are parsed into an exact appid + market_hash_name pair. Market hash names are case-sensitive and are not lowercased, trimmed, or fuzzy-normalized.
- The game registry supports independent profiles keyed by Steam AppID.
- The options page supports manual game registration, manual translation entry (including optional source-catalog item ID/code and source label), searchable per-game dictionary management, exact single-entry edit/delete, JSON pack import/export, per-game enable/disable, and per-game deletion. Dictionary editing keys are AppID + market hash name + locale; edits that rename an item refuse to overwrite another entry, and an empty source ID explicitly clears that metadata.
- Pack imports validate the versioned schema and reject duplicate item/locale keys. Merge import rejects conflicting translations; replace import replaces only that game's dictionary.
- The translation engine accepts a provider record only when AppID, exact market hash name, and locale match and there is exactly one candidate.
- Local game packs are persistent extension-local dictionaries. The 30-day translation cache remains available for future remote providers; local packs do not depend on expiring cache entries.
- Visible market listing links and the current item title on a Steam Market detail page are scanned. Exact local matches are displayed alongside the original Steam item name. Dynamic page updates and game-pack changes trigger a refresh.

## Game pack data model

A pack uses format alaxee-steamhub-game-pack, schema version 1. The optional sourceItemId field is backward-compatible with earlier schema-v1 packs:

- game.appId: Steam AppID and primary game-profile key.
- game.name: display name.
- game.adapter: steam-community-market in this release.
- game.itemKey: market_hash_name in this release.
- translations[].sourceItemId: the exact source-catalog item ID/code, stored as a cross-reference only; it is not used to match the Steam page.
- game.defaultLocale: default translation locale.
- game.enabled: per-game enable state.
- translations[]: exact market hash name, optional sourceItemId from the game's own catalog, locale, translation, source, and update timestamp.

At most 10,000 translation records are accepted per game. The same exact item key may have separate translations for different locales, but duplicate item/locale pairs are rejected. During merge, conflicting translations or conflicting non-empty source item IDs are rejected.

A provider record is usable only when AppID, exact market hash name, and locale match. Missing or ambiguous matches leave the original Steam text unchanged. See the example game pack at docs/game-pack.example.json.

Task Bar Hero is AppID 3678970. TBH Index (tbhindex.com) is the primary human reference selected for current item/Steam-name cross-checking because its localized item pages expose internal ItemKey values and exact Steam Market names. It is not an automated provider: its terms restrict excessive scraping and no supported API/CORS or bulk reuse permission has been confirmed. taskbarhero.wiki remains a secondary market cross-check; taskbarherowiki.com and tbherohelper.com remain auxiliary catalog references with non-comparable version and row-count definitions. See docs/providers/tbhindex.md and docs/providers/taskbarhero-wiki.md.

## Privacy and permissions

The extension requests only the storage permission for local game profiles, dictionaries, and provider cache. It does not need cookies, tabs, webRequest, scripting, debugger, nativeMessaging, broad host permissions, or remote code. Game packs are kept in the extension's storage area, not Steam page localStorage.

The extension does not read authentication state, account information, private inventory, or saves. It does not add telemetry, account login, cloud sync, or proxy control.

## Provider access rules

Do not reverse-engineer undocumented front-end endpoints or bulk scrape a provider's website. Before enabling a provider, verify its documented access method, automated-use permission, CORS behavior, rate limits, attribution, and cache policy. Query only market items currently visible to the user and preserve the exact-match requirement.

## Verification boundary

Automated tests cover URL scope, game-profile isolation, pack import/export, exact dictionary entry update/delete and collision protection, item-key extraction, exact match validation, cache expiry, provider throttling, and storage namespacing. They cannot prove that Steam serves every page component in Simplified Chinese or that the extension works across real Steam Market navigation. Those claims require manual verification in Edge / Chrome.

Item-name translation is available only for exact entries in an enabled local game pack or a verified future provider.
