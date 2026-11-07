# ALAXEE Steam integration — architecture decision

Date: 2026-11-07

## User-level objective

Keep ALAXEE's translation logic under ALAXEE control and make the Steam host replaceable. Prefer no third-party Steam framework. A Steam adapter may be used when necessary, but it must not own the translation engine or provider/data model.

## Options assessed

| Route | Independence | Main constraint | Decision |
|---|---|---|---|
| Extendium + Chrome extension | Low: depends on Millennium and Extendium | Missing `chrome.tabs` support is documented; `chrome.proxy` support is unverified | Fallback only |
| Millennium native plugin | Low-medium: depends on Millennium | Steam updates and framework remain external dependencies | Secondary fallback |
| Standalone local CDP bridge | High: no Millennium/Extendium | Requires Steam's undocumented `-cef-enable-debugging` flag and a local unauthenticated debug port | First route to validate |
| Modify/rebuild Steam CEF or inject native code | Nominally independent but brittle | Unsupported binary patching creates update and security risks | Reject |
| HTTPS interception / MITM | Framework-independent at runtime | Certificate trust, Steam session privacy, protocol fragility and network-wide side effects | Reject |

## Why standalone CDP is the first experiment

A public project (`kmturley/steam-debug`, CC0-1.0) demonstrates that a Steam desktop client launched with `-cef-enable-debugging` exposes a CDP endpoint on local port 8080 and can be inspected/injected without Millennium. Chromium's maintained protocol defines `Page.addScriptToEvaluateOnNewDocument`, which registers a script for future document creation/navigation.

This is not an official Valve extension API. It is an undocumented Steam launch switch plus Chromium's standard debugging protocol. Steam can change or remove it. The CDP listener has no authentication and grants powerful access to Steam webviews.

The prototype therefore:
- Connects only to loopback addresses.
- Rejects WebSocket endpoints not on loopback and port 8080.
- On Windows checks the actual listening addresses and fails closed if the port is exposed beyond loopback.
- Never passes `-dev`, `-cef-disable-sandbox`, or a remote host.
- Targets only Steam Community / Store page URLs.
- Does not read page text, cookies, session tokens, or account data.

## Long-term architecture

```text
ALAXEE Translation Core (owned by ALAXEE)
  ├─ game/AppID source registry
  ├─ exact item-key resolver (appid + market_hash_name)
  ├─ provider adapters (TBHIndex / explicit fallback sources)
  ├─ local cache + throttling
  ├─ DOM translation rules + MutationObserver scheduler
  └─ user controls / status
       ├─ Edge MV3 adapter
       ├─ Standalone Steam CDP adapter
       └─ Optional Millennium adapter (fallback only)
```

The shared translation core must not import `chrome.*`, Millennium globals or CDP classes. Each host adapter supplies page identity, DOM/document access, navigation lifecycle, storage/cache and UI mounting.

## Community Market language handling

For Steam Community Market URLs (`/market` and `/market/...`) on Steam Community hosts, the bridge sets the supported Simplified Chinese web locale parameter `l=schinese`. Existing search parameters and fragments are preserved. This does not change Steam global language preferences, cookies, account settings, or authentication state.

This localizes Steam's own Community Market interface and any item labels Steam serves in the selected language. It is not a universal translator and does not invent translations for item names Steam does not localize.

## Current boundary

The standalone CDP bridge and market-locale adapter are implemented. A general translation core, exact AppID/item-key registry, and documented TBHIndex lookup adapter remain pending. TBHIndex is used only for verified Task Bar Hero lookups; no undocumented API endpoint or broad market crawler is assumed. The bridge does not control Steam proxy settings or integrate the earlier Chrome extension prototype.
