# Alaxee SteamHub

ALAXEE's independently maintained Steam translation and browser enhancement project.

## Product direction

- Translation logic and game/item data matching are owned by ALAXEE.
- Prefer a standalone Steam integration over requiring Millennium or Extendium.
- Keep host integration replaceable: a standalone Steam CEF/CDP adapter is the first path being validated; a Millennium adapter is an optional fallback, not the translation core.
- Start with Steam Store and Community Market pages. Support game-specific configurations keyed by Steam AppID.
- For Taskbar Hero (AppID `3678970`), use TBHIndex as an on-demand public data provider where exact item matches can be established. Do not bulk crawl or guess translations.
- Keep all translation data and caches local by default. No Steam account login, inventory reading, cookies, or private game-save access in the initial scope.

## Current status

This repository is being initialized from the standalone CDP injection proof of concept. The first version demonstrates how ALAXEE can enter Steam pages without Millennium/Extendium; it is not yet the finished translator.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the host-independence decision and security boundaries.

## Development

The standalone bridge requires Node.js 22+ and uses built-in Node APIs only.

```powershell
npm test
npm run check
npm start
```

## Scope and safety

- Do not inject scripts into non-Steam origins.
- Keep the Steam CDP endpoint bound to loopback; fail closed if it is exposed on a LAN/public interface.
- Never use `-dev`, disable the CEF sandbox, or accept arbitrary remote CDP endpoints.
- Do not read Steam cookies, authentication tokens, private profiles, inventory, or game save files.
- Respect third-party data-provider terms; only perform low-rate on-demand lookups for visible items.
- Never claim a page translation or proxy route is working without real Steam client verification.
