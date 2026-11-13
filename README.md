# ALAXEE SteamHub

ALAXEE SteamHub is a browser-extension-first project for improving Steam Community Market pages with accurate Chinese localization and, later, exact-match item translations.

## Current status

The first browser extension slice:

- Runs only on Steam Community Market pages in Edge and Chrome.
- Applies Steam's official Simplified Chinese web locale (`l=schinese`).
- Preserves the existing market path, search parameters, filters, and URL fragment.
- Does not read Steam cookies, account credentials, inventory, or private profile data.
- Does not yet translate item names. Steam's own locale support is not a substitute for the planned item-translation engine.

## Install for local testing

1. Open `edge://extensions` in Microsoft Edge or `chrome://extensions` in Chrome.
2. Enable Developer mode.
3. Select **Load unpacked**.
4. Choose this repository's `extension/` directory (the directory containing `manifest.json`).
5. Open or reload a Steam Community Market page.

The extension is currently distributed as source for local testing. No browser-store publication or signed package is implied.

## Product architecture

The translation engine, AppID registry, exact item matching, provider adapters, throttling, cache, and UI belong to this repository and must remain independent of any host environment.

The browser extension is the first host adapter. A Steam desktop CEF/CDP adapter may be revived later as an optional adapter; it must not become a prerequisite for browser functionality.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the implementation decision and [AGENTS.md](AGENTS.md) for development constraints.

## Roadmap

1. Browser extension foundation and narrow Steam Market URL scope.
2. Host-independent translation core and per-game AppID registry.
3. Exact item-key matching using `appid + market_hash_name`.
4. Verified, low-rate, on-demand provider lookups with local caching.
5. Accessible in-page translation controls and status UI.
6. Optional Steam desktop adapter only if it provides a meaningful additional use case.

Taskbar Hero uses Steam AppID `3678970`. TBHIndex may be used only after its relevant data access path and terms are verified. Missing or ambiguous matches must leave the original Steam text unchanged.
