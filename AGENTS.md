# ALAXEE SteamHub agent rules

## Product direction

- Browser extension is the first product host and the primary development target.
- Support many games through independent profiles keyed by Steam AppID; do not hardcode Task Bar Hero into the translation engine.
- Each game profile owns its display name, enabled state, page adapter, item-key strategy, and translation dictionary.
- Own the translation core, item matching, per-game registry, versioned game-pack format, provider adapters, cache, throttling, and UI in this repository.
- Keep the translation core independent of Chromium APIs, Steam CEF/CDP, and Millennium.
- A Steam desktop CEF/CDP adapter may be developed later as an optional compatibility adapter; it must not be a dependency of the browser extension.
- Task Bar Hero is AppID 3678970, but it is one game profile rather than a special case.
- Preserve exact-match semantics: do not invent Chinese item names when provider lookup is missing or ambiguous.

## Privacy and security

- The initial extension may run only on HTTPS Steam Community Market routes: steamcommunity.com/market, steamcommunity.com/market/*, and their www equivalents.
- Prefer static Manifest V3 content scripts and the narrowest possible match patterns.
- The storage permission is allowed only for extension-local game profiles, dictionaries, and translation cache; never use page-origin storage for these records.
- Do not add other API permissions or broader host permissions unless a concrete feature requires them and the change is reviewed.
- Public JSON pack URL import may request one HTTPS origin through `optional_host_permissions` only after an explicit click; fetch with omitted credentials, reject redirects, cap payloads, and never crawl links or inject scripts.
- Do not read Steam cookies, auth/session tokens, Steam account credentials, private profiles, inventory, or save files.
- Do not add telemetry, remote code, accounts, cloud sync, or proxy control without explicit product approval.
- Do not silently connect to local debugging ports or launch/modify the Steam client from the browser extension.

## Game packs and adapters

- Use a versioned alaxee-steamhub-game-pack schema for portable per-game configuration and translation data.
- Every translation identity includes AppID, exact Steam market hash name, and locale.
- Optional sourceItemId stores the exact ID/code from the chosen source catalog; source stores a human-readable provenance label. Neither replaces or may be guessed from market_hash_name.
- The first adapter supports Steam Community Market market_hash_name; do not claim games with different page structures or item identifiers are supported until a dedicated adapter is implemented and tested.
- Pack imports must validate the entire input before writing, reject duplicate exact keys, reject cross-AppID records and conflicting translation, source label, or sourceItemId mappings, and make merge/replace behavior explicit.
- Never silently overwrite a conflicting translation during merge.
- A game disabled or deleted by the user must not continue displaying translations from stale cache entries.

## Data providers

- Provider lookups are on-demand for visible Steam Market items, rate-limited, and cached locally.
- Do not bulk crawl TBHIndex, bypass restrictions, or assume an undocumented endpoint is a stable API.
- Verify the provider's access method, CORS behavior, attribution, automated-access permission and redistribution terms before implementation. A public page or privacy policy alone is not an API/redistribution grant.
- Store source, exact match key, locale, translation, and lookup timestamp with cached translations.
- If an exact match is not available or is ambiguous, leave the original text unchanged.

## Engineering

- Prefer Node built-ins and dependency-free JavaScript unless a concrete need justifies a dependency.
- Keep host adapters separate from the translation core.
- Do not introduce a bundler, framework, background service worker, or permissions merely for future possibilities.
- Keep content scripts in the browser's isolated world; avoid MAIN-world execution unless a demonstrated Steam-page integration requirement makes it necessary.
- Respect prefers-reduced-motion in any injected UI.
- Test URL matching, locale URL preservation, game-profile isolation, pack validation, import conflict behavior, item-key normalization, exact matching, rate limiting, cache expiry, and injection safety.

## Verification

- Run npm test and npm run check before each implementation PR.
- Distinguish automated tests from real Edge/Chrome Steam Market verification.
- Never claim item translation is complete until visible exact matches have been verified in a real browser session.
- Do not publish browser-store packages or Windows installers without explicit approval.

## Scope control

- Keep changes small and independently verifiable.
- Do not change the user's Steam installation, browser settings, or installed extensions without explicit authorization.
