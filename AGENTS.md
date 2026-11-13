# ALAXEE SteamHub agent rules

## Product direction

- Browser extension is the first product host and the primary development target.
- Own the translation core, item matching, per-game AppID registry, provider adapters, cache, throttling, and UI in this repository.
- Keep the translation core independent of Chromium APIs, Steam CEF/CDP, and Millennium.
- A Steam desktop CEF/CDP adapter may be developed later as an optional compatibility adapter; it must not be a dependency of the browser extension.
- Use per-game configuration keyed by Steam AppID. Taskbar Hero is AppID 3678970.
- Preserve exact-match semantics: do not invent Chinese item names when provider lookup is missing or ambiguous.

## Privacy and security

- The initial extension may run only on HTTPS Steam Community Market routes: `steamcommunity.com/market`, `steamcommunity.com/market/*`, and their `www` equivalents.
- Prefer static Manifest V3 content scripts and the narrowest possible match patterns.
- Do not add API permissions or broader host permissions unless a concrete feature requires them and the change is reviewed.
- Do not read Steam cookies, auth/session tokens, Steam account credentials, private profiles, inventory, or save files.
- Do not add telemetry, remote code, accounts, cloud sync, or proxy control without explicit product approval.
- Do not silently connect to local debugging ports or launch/modify the Steam client from the browser extension.

## Data providers

- TBHIndex lookups are on-demand for visible Steam Market items, rate-limited, and cached locally.
- Do not bulk crawl TBHIndex, bypass restrictions, or assume an undocumented endpoint is a stable API.
- Verify the provider's access method and terms before implementation.
- Store source, match key, locale, and lookup timestamp with cached translations.
- If an exact match is not available, leave the original Steam text unchanged.

## Engineering

- Prefer Node built-ins and dependency-free JavaScript unless a concrete need justifies a dependency.
- Keep host adapters separate from the translation core.
- Do not introduce a bundler, framework, background service worker, or permissions merely for future possibilities.
- Keep content scripts in the browser's isolated world; avoid MAIN-world execution unless a demonstrated Steam-page integration requirement makes it necessary.
- Respect prefers-reduced-motion in any injected UI.
- Test URL matching, locale URL preservation, item-key normalization, exact matching, rate limiting, cache expiry, and injection safety as each capability is added.

## Verification

- Run `npm test` and `npm run check` before each implementation PR.
- Distinguish automated tests from real Edge/Chrome Steam Market verification.
- Never claim item translation is complete until visible exact matches have been verified in a real browser session.
- Do not publish browser-store packages or Windows installers without explicit approval.

## Scope control

- Keep changes small and independently verifiable.
- Do not change the user's Steam installation, browser settings, or installed extensions without explicit authorization.
