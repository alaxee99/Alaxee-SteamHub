# Alaxee SteamHub agent rules

## Product direction
- Own the translation core, item matching, provider adapters, cache, and UI in this repository.
- Keep Steam host integration replaceable. Standalone CDP is the preferred first path; Millennium/Extendium may be optional compatibility adapters only.
- Do not silently make Millennium or Extendium runtime requirements.
- Use per-game configuration keyed by Steam AppID. Taskbar Hero is AppID 3678970.
- Preserve exact-match semantics: do not invent Chinese item names when provider lookup is missing or ambiguous.

## Privacy and security
- Do not read Steam cookies, auth/session tokens, Steam account credentials, private profiles, inventory, or save files.
- The Steam CDP bridge may connect only to 127.0.0.1, localhost, or ::1 on the configured fixed port.
- Fail closed if the debugging port is bound beyond loopback or advertises a non-loopback WebSocket URL.
- Never use -dev, disable the CEF sandbox, expose debugging ports to LAN/public networks, or attach to arbitrary websites.
- Never add telemetry, remote code, accounts, or cloud sync without explicit product approval.

## Data providers
- TBHIndex lookups are on-demand for visible Steam Market items, rate-limited and cached locally.
- Do not bulk crawl TBHIndex, bypass restrictions, or assume an undocumented endpoint is a stable API.
- Store source, match key, locale, and lookup timestamp with cached translations.
- If an exact match is not available, leave the original Steam text unchanged.

## Engineering
- Prefer Node built-ins and dependency-free JavaScript unless a concrete need justifies a dependency.
- Keep translation logic independent of Chrome, Steam CEF, CDP, and Millennium APIs.
- Separate host adapters from page translation core.
- Add tests for domain matching, item-key normalization, rate limiting, cache expiry, and injection safety.
- Respect prefers-reduced-motion in injected UI.

## Verification
- Run npm test and npm run check before each implementation PR.
- Distinguish automated tests from Steam client runtime verification.
- Never claim Steam translation is complete until verified in the actual Steam desktop client.

## Scope control
- Keep changes small and independently verifiable.
- Do not change the user's Steam installation or settings without explicit authorization.
- Do not publish binaries or extension packages to a store without explicit approval.
