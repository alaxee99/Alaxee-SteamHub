# ALAXEE SteamHub

ALAXEE SteamHub is a browser-extension-first project for improving Steam Community Market pages with accurate Chinese localization and exact-match item translations.

## Current status

Version 0.3.0 includes:

- Manifest V3 extension restricted to Steam Community Market pages in Edge and Chrome.
- Steam's official Simplified Chinese web locale (`l=schinese`), preserving market paths, filters, query parameters, and URL fragments.
- Market listing URL recognition using the exact `appid + market_hash_name` identity pair.
- A host-independent translation engine with strict exact-match validation.
- A namespaced local translation cache using extension storage and expiry.
- A serialized provider rate limiter.
- No Steam cookies, authentication tokens, private profiles, inventory, saves, or remote code access.

The provider registry is intentionally empty. Item recognition and cache infrastructure are implemented, but item-name translations are not available until a supported data provider is verified.

## Install for local testing

1. Open `edge://extensions` in Microsoft Edge or `chrome://extensions` in Chrome.
2. Enable Developer mode.
3. Select **Load unpacked**.
4. Choose this repository's `extension/` directory (the directory containing `manifest.json`).
5. Open or reload a Steam Community Market page.

This is source for local testing, not a browser-store release.

## Product architecture

The translation engine, AppID registry, exact item matching, provider adapters, throttling, cache, and UI belong to this repository and remain independent of any host environment.

The browser extension is the first host adapter. A Steam desktop CEF/CDP adapter may be revived later as an optional adapter; it is not required for browser functionality.

## Roadmap

1. Browser extension foundation and narrow Steam Market URL scope. **Implemented.**
2. Exact market item identity, translation engine, namespaced local cache, and provider throttling. **Foundation implemented.**
3. Verify and enable a supported provider; TBH Index is currently unconnected pending a documented/approved access method.
4. Add an AppID registry and exact translation records for Task Bar Hero (AppID `3678970`).
5. Add accessible in-page translation controls and status UI.
6. Re-evaluate the optional Steam desktop adapter only if it provides a meaningful additional use case.

See [ARCHITECTURE.md](ARCHITECTURE.md), [AGENTS.md](AGENTS.md), and [docs/providers/tbhindex.md](docs/providers/tbhindex.md).

## Safety

- Static content scripts run only on HTTPS Steam Community Market routes.
- The extension requests only the `storage` permission for its local translation cache.
- Exact matching is case-sensitive and preserves Steam's `market_hash_name`; no fuzzy matching is performed.
- Unknown and ambiguous matches leave original Steam text untouched.
- No bulk data crawling, hidden endpoint reverse engineering, telemetry, accounts, cloud sync, or proxy control.
