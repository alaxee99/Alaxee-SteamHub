(() => {
  "use strict";

  const API_KEY = "__ALAXEE_STEAMHUB_GAME_REGISTRY__";
  const STORAGE_PREFIX = "alaxee-steamhub:game-pack:v1:";
  const PACK_FORMAT = "alaxee-steamhub-game-pack";
  const PACK_VERSION = 1;
  const ADAPTER = "steam-community-market";
  const ITEM_KEY = "market_hash_name";
  const MAX_TRANSLATIONS_PER_GAME = 5000;

  if (globalThis[API_KEY]) return;

  function normalizeAppId(value) {
    const text = String(value ?? "");
    if (!/^[1-9]\d*$/.test(text)) return null;
    const number = Number(text);
    return Number.isSafeInteger(number) ? String(number) : null;
  }

  function storageKey(appId) {
    const normalized = normalizeAppId(appId);
    if (!normalized) throw new TypeError("A valid Steam AppID is required.");
    return STORAGE_PREFIX + normalized;
  }

  function validateGameName(value) {
    if (typeof value !== "string") return null;
    const name = value.trim();
    if (!name || name.length > 100 || /[\u0000-\u001f\u007f]/.test(name)) return null;
    return name;
  }

  function validateMarketHashName(value) {
    if (typeof value !== "string" || !value || value.length > 512) return null;
    if (value !== value.trim() || /[\u0000-\u001f\u007f]/.test(value)) return null;
    return value;
  }

  function validateLocale(value) {
    if (typeof value !== "string" || !/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(value)) return null;
    return value;
  }

  function normalizeTranslation(input, appId, defaultSource) {
    if (!input || typeof input !== "object") return null;
    const marketHashName = validateMarketHashName(input.marketHashName);
    const locale = validateLocale(input.locale || "zh-CN");
    const translation = typeof input.translation === "string" ? input.translation.trim() : "";
    const source = typeof input.source === "string" && input.source.trim()
      ? input.source.trim().slice(0, 128)
      : defaultSource;

    if (!marketHashName || !locale || !translation || translation.length > 1000) return null;
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(translation)) return null;

    return Object.freeze({
      appId,
      marketHashName,
      locale,
      translation,
      source,
      updatedAt: Number.isFinite(input.updatedAt) ? input.updatedAt : Date.now()
    });
  }

  function normalizePack(input) {
    if (!input || typeof input !== "object" ||
        input.format !== PACK_FORMAT || input.schemaVersion !== PACK_VERSION) {
      throw new TypeError("Unsupported game pack format or schema version.");
    }

    const appId = normalizeAppId(input.game?.appId);
    const name = validateGameName(input.game?.name);
    const adapter = input.game?.adapter || ADAPTER;
    const itemKey = input.game?.itemKey || ITEM_KEY;
    const defaultLocale = validateLocale(input.game?.defaultLocale || "zh-CN");
    if (input.game?.enabled !== undefined && typeof input.game.enabled !== "boolean") {
      throw new TypeError("Game enabled state must be a boolean.");
    }

    if (!appId || !name) throw new TypeError("Game pack requires a valid Steam AppID and game name.");
    if (adapter !== ADAPTER || itemKey !== ITEM_KEY) {
      throw new TypeError("This release supports the steam-community-market / market_hash_name adapter only.");
    }
    if (!defaultLocale) throw new TypeError("Game pack has an invalid default locale.");

    if (!Array.isArray(input.translations) || input.translations.length > MAX_TRANSLATIONS_PER_GAME) {
      throw new TypeError(`Game pack translations must be an array with at most ${MAX_TRANSLATIONS_PER_GAME} entries.`);
    }

    const seen = new Set();
    const translations = input.translations.map((entry) => {
      const normalized = normalizeTranslation(entry, appId, `game-pack:${appId}`);
      if (!normalized) throw new TypeError("Game pack contains an invalid translation entry.");

      const uniqueKey = normalized.locale + "\u0000" + normalized.marketHashName;
      if (seen.has(uniqueKey)) {
        throw new TypeError("Game pack contains duplicate market item and locale entries.");
      }
      seen.add(uniqueKey);
      return normalized;
    });

    return Object.freeze({
      format: PACK_FORMAT,
      schemaVersion: PACK_VERSION,
      game: Object.freeze({
        appId,
        name,
        adapter,
        itemKey,
        defaultLocale,
        enabled: input.game.enabled !== false
      }),
      translations: Object.freeze(translations)
    });
  }

  function createGameRegistry(storage) {
    if (!storage || typeof storage.get !== "function" ||
        typeof storage.set !== "function" || typeof storage.delete !== "function" ||
        typeof storage.getAll !== "function") {
      throw new TypeError("Game registry requires get, set, delete, and getAll storage methods.");
    }

    async function get(appId) {
      const key = storageKey(appId);
      const pack = await storage.get(key);
      if (!pack) return null;
      try {
        return normalizePack(pack);
      } catch {
        return null;
      }
    }

    async function list() {
      const all = await storage.getAll();
      return Object.entries(all || {})
        .filter(([key]) => key.startsWith(STORAGE_PREFIX))
        .map(([, value]) => {
          try { return normalizePack(value); }
          catch { return null; }
        })
        .filter(Boolean)
        .sort((a, b) => a.game.name.localeCompare(b.game.name));
    }

    async function addGame(input) {
      const appId = normalizeAppId(input?.appId);
      const name = validateGameName(input?.name);
      if (!appId || !name) throw new TypeError("Enter a valid Steam AppID and game name.");

      const key = storageKey(appId);
      if (await storage.get(key)) throw new Error(`Steam AppID ${appId} is already registered.`);

      const pack = normalizePack({
        format: PACK_FORMAT,
        schemaVersion: PACK_VERSION,
        game: { appId, name, adapter: ADAPTER, itemKey: ITEM_KEY, defaultLocale: input.defaultLocale || "zh-CN" },
        translations: []
      });
      await storage.set(key, pack);
      return pack;
    }

    async function importPack(input, options = {}) {
      const incoming = normalizePack(input);
      const mode = options.mode || "merge";
      if (mode !== "merge" && mode !== "replace") {
        throw new TypeError("Import mode must be merge or replace.");
      }

      const existing = await get(incoming.game.appId);
      let translations = incoming.translations.slice();

      if (existing && mode === "merge") {
        const byIdentity = new Map(existing.translations.map((entry) => [
          entry.locale + "\u0000" + entry.marketHashName, entry
        ]));

        for (const entry of incoming.translations) {
          const key = entry.locale + "\u0000" + entry.marketHashName;
          const previous = byIdentity.get(key);
          if (previous && previous.translation !== entry.translation) {
            throw new Error(
              `Conflicting translation for AppID ${incoming.game.appId}: ${entry.marketHashName} (${entry.locale}). Choose replace to overwrite the game pack.`
            );
          }
          byIdentity.set(key, entry);
        }
        translations = Array.from(byIdentity.values());
      }

      if (translations.length > MAX_TRANSLATIONS_PER_GAME) {
        throw new TypeError(`A game may contain at most ${MAX_TRANSLATIONS_PER_GAME} translation entries.`);
      }

      const pack = normalizePack({
        ...incoming,
        game: {
          ...incoming.game,
          enabled: existing ? existing.game.enabled : incoming.game.enabled
        },
        translations
      });
      await storage.set(storageKey(pack.game.appId), pack);
      return pack;
    }

    async function upsertTranslation(appId, input) {
      const current = await get(appId);
      if (!current) throw new Error("Register this game before adding translations.");

      const entry = normalizeTranslation(input, current.game.appId, "manual");
      if (!entry) throw new TypeError("Enter an exact market hash name, locale, and translation.");

      const key = entry.locale + "\u0000" + entry.marketHashName;
      const translations = current.translations.filter(
        (candidate) => candidate.locale + "\u0000" + candidate.marketHashName !== key
      );
      translations.push(entry);
      if (translations.length > MAX_TRANSLATIONS_PER_GAME) {
        throw new TypeError(`A game may contain at most ${MAX_TRANSLATIONS_PER_GAME} translation entries.`);
      }

      const updated = normalizePack({ ...current, translations });
      await storage.set(storageKey(appId), updated);
      return updated;
    }

    async function setEnabled(appId, enabled) {
      if (typeof enabled !== "boolean") throw new TypeError("enabled must be a boolean.");
      const current = await get(appId);
      if (!current) throw new Error("Game profile was not found.");
      const updated = normalizePack({
        ...current,
        game: { ...current.game, enabled }
      });
      await storage.set(storageKey(appId), updated);
      return updated;
    }

    async function remove(appId) {
      await storage.delete(storageKey(appId));
    }

    async function exportPack(appId) {
      const pack = await get(appId);
      if (!pack) throw new Error("Game profile was not found.");
      return {
        format: pack.format,
        schemaVersion: pack.schemaVersion,
        game: { ...pack.game },
        translations: pack.translations.map((entry) => ({ ...entry }))
      };
    }

    return Object.freeze({ get, list, addGame, importPack, upsertTranslation, setEnabled, remove, exportPack });
  }

  function createGamePackProvider(registry) {
    if (!registry || typeof registry.get !== "function") {
      throw new TypeError("A game registry is required.");
    }

    return Object.freeze({
      id: "local-game-packs",
      async lookup(request) {
        const appId = normalizeAppId(request?.appId);
        const marketHashName = validateMarketHashName(request?.marketHashName);
        const locale = validateLocale(request?.locale);
        if (!appId || !marketHashName || !locale) return null;

        const pack = await registry.get(appId);
        if (!pack || !pack.game.enabled) return null;

        const matches = pack.translations.filter((entry) =>
          entry.marketHashName === marketHashName && entry.locale === locale
        );
        if (matches.length !== 1) return matches.length > 1 ? matches : null;

        const entry = matches[0];
        return {
          appId,
          marketHashName,
          locale,
          translation: entry.translation,
          source: entry.source,
          updatedAt: entry.updatedAt
        };
      }
    });
  }

  Object.defineProperty(globalThis, API_KEY, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: Object.freeze({
      PACK_FORMAT,
      PACK_VERSION,
      ADAPTER,
      ITEM_KEY,
      normalizeAppId,
      normalizePack,
      createGameRegistry,
      createGamePackProvider
    })
  });
})();
