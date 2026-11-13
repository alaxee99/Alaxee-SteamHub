(() => {
  "use strict";

  const API_KEY = "__ALAXEE_STEAMHUB_GAME_REGISTRY__";
  const STORAGE_PREFIX = "alaxee-steamhub:game-pack:v1:";
  const PACK_FORMAT = "alaxee-steamhub-game-pack";
  const PACK_VERSION = 1;
  const ADAPTER = "steam-community-market";
  const ITEM_KEY = "market_hash_name";
  const MAX_TRANSLATIONS_PER_GAME = 10000;

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

  function validateSourceItemId(value) {
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value !== "string" && !(typeof value === "number" && Number.isSafeInteger(value))) {
      return null;
    }
    const identifier = String(value);
    if (!identifier || identifier.length > 128 || identifier !== identifier.trim() ||
        /[\u0000-\u001f\u007f]/.test(identifier)) return null;
    return identifier;
  }

  function normalizeTranslation(input, appId, defaultSource) {
    if (!input || typeof input !== "object") return null;
    const marketHashName = validateMarketHashName(input.marketHashName);
    const locale = validateLocale(input.locale || "zh-CN");
    const translation = typeof input.translation === "string" ? input.translation.trim() : "";
    const source = typeof input.source === "string" && input.source.trim()
      ? input.source.trim().slice(0, 128)
      : defaultSource;
    const sourceItemId = validateSourceItemId(input.sourceItemId);

    if (input.sourceItemId !== undefined && input.sourceItemId !== null &&
        input.sourceItemId !== "" && sourceItemId === null) return null;
    if (!marketHashName || !locale || !translation || translation.length > 1000) return null;
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(translation)) return null;

    return Object.freeze({
      appId,
      marketHashName,
      locale,
      translation,
      source,
      ...(sourceItemId ? { sourceItemId } : {}),
      updatedAt: Number.isFinite(input.updatedAt) ? input.updatedAt : Date.now()
    });
  }

  function normalizeTextTranslations(input) {
    if (input === undefined || input === null) return Object.freeze([]);
    if (!Array.isArray(input) || input.length > 4000) {
      throw new TypeError("Game pack textTranslations must be an array with at most 4000 entries.");
    }

    const seen = new Set();
    const mappings = input.map((entry) => {
      const sourceText = typeof entry?.sourceText === "string" ? entry.sourceText.trim() : "";
      const translation = typeof entry?.translation === "string" ? entry.translation.trim() : "";
      if (!sourceText || sourceText.length > 1000 ||
          /[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f]/.test(sourceText) ||
          !translation || translation.length > 1000 ||
          /[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f]/.test(translation)) {
        throw new TypeError("Game pack contains an invalid exact text translation.");
      }
      if (seen.has(sourceText)) {
        throw new TypeError("Game pack contains duplicate exact text translation keys.");
      }
      seen.add(sourceText);
      return Object.freeze({ sourceText, translation });
    });
    return Object.freeze(mappings);
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
      if (entry?.appId !== undefined && normalizeAppId(entry.appId) !== appId) {
        throw new TypeError("A translation entry AppID does not match its game pack AppID.");
      }
      const normalized = normalizeTranslation(entry, appId, `game-pack:${appId}`);
      if (!normalized) throw new TypeError("Game pack contains an invalid translation entry.");

      const uniqueKey = normalized.locale + "\u0000" + normalized.marketHashName;
      if (seen.has(uniqueKey)) {
        throw new TypeError("Game pack contains duplicate market item and locale entries.");
      }
      seen.add(uniqueKey);
      return normalized;
    });

    const textTranslations = normalizeTextTranslations(input.textTranslations);

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
      translations: Object.freeze(translations),
      ...(textTranslations.length ? { textTranslations } : {})
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
      let textTranslations = incoming.textTranslations || [];

      if (existing && mode === "merge") {
        const byIdentity = new Map(existing.translations.map((entry) => [
          entry.locale + "\u0000" + entry.marketHashName, entry
        ]));

        for (const entry of incoming.translations) {
          const key = entry.locale + "\u0000" + entry.marketHashName;
          const previous = byIdentity.get(key);
          if (previous &&
              (previous.translation !== entry.translation ||
               (previous.sourceItemId && entry.sourceItemId &&
                previous.sourceItemId !== entry.sourceItemId) ||
               (previous.source && entry.source && previous.source !== entry.source))) {
            throw new Error(
              `Conflicting translation provenance or source item ID for AppID ${incoming.game.appId}: ${entry.marketHashName} (${entry.locale}). Choose replace to overwrite the game pack.`
            );
          }
          byIdentity.set(key, {
            ...previous,
            ...entry,
            sourceItemId: entry.sourceItemId || previous?.sourceItemId
          });
        }
        translations = Array.from(byIdentity.values());

        const textBySource = new Map((existing.textTranslations || []).map((entry) => [
          entry.sourceText, entry
        ]));
        for (const entry of incoming.textTranslations || []) {
          const previous = textBySource.get(entry.sourceText);
          if (previous && previous.translation !== entry.translation) {
            throw new Error(`Conflicting exact text translation for AppID ${incoming.game.appId}: ${entry.sourceText}. Choose replace to overwrite the game pack.`);
          }
          textBySource.set(entry.sourceText, entry);
        }
        textTranslations = Array.from(textBySource.values());
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
        translations,
        textTranslations
      });
      await storage.set(storageKey(pack.game.appId), pack);
      return pack;
    }

    async function upsertTranslation(appId, input) {
      const current = await get(appId);
      if (!current) throw new Error("Register this game before adding translations.");

      const hasExplicitSource = typeof input?.source === "string" && input.source.trim().length > 0;
      const entry = normalizeTranslation(input, current.game.appId, "manual");
      if (!entry) throw new TypeError("Enter an exact market hash name, locale, and translation.");

      const key = entry.locale + "\u0000" + entry.marketHashName;
      const previous = current.translations.find(
        (candidate) => candidate.locale + "\u0000" + candidate.marketHashName === key
      );
      const normalizedEntry = {
        ...entry,
        source: hasExplicitSource ? entry.source : (previous?.source || entry.source),
        sourceItemId: entry.sourceItemId || previous?.sourceItemId
      };
      const translations = current.translations.filter(
        (candidate) => candidate.locale + "\u0000" + candidate.marketHashName !== key
      );
      translations.push(normalizedEntry);
      if (translations.length > MAX_TRANSLATIONS_PER_GAME) {
        throw new TypeError(`A game may contain at most ${MAX_TRANSLATIONS_PER_GAME} translation entries.`);
      }

      const updated = normalizePack({ ...current, translations });
      await storage.set(storageKey(appId), updated);
      return updated;
    }

    async function updateTranslation(appId, previousIdentity, input) {
      const current = await get(appId);
      if (!current) throw new Error("Game profile was not found.");

      const previousMarketHashName = validateMarketHashName(previousIdentity?.marketHashName);
      const previousLocale = validateLocale(previousIdentity?.locale);
      if (!previousMarketHashName || !previousLocale) {
        throw new TypeError("A valid existing market hash name and locale are required.");
      }

      const previous = current.translations.find((candidate) =>
        candidate.marketHashName === previousMarketHashName &&
        candidate.locale === previousLocale
      );
      if (!previous) throw new Error("Translation entry was not found.");

      const entry = normalizeTranslation(input, current.game.appId, "manual");
      if (!entry) throw new TypeError("Enter an exact market hash name, locale, and translation.");

      const collision = current.translations.find((candidate) =>
        candidate.marketHashName === entry.marketHashName &&
        candidate.locale === entry.locale &&
        !(candidate.marketHashName === previousMarketHashName &&
          candidate.locale === previousLocale)
      );
      if (collision) {
        throw new Error("Another translation already uses this market item and locale.");
      }

      const normalizedEntry = {
        ...entry,
        source: input?.source === undefined ? previous.source : entry.source,
        ...(input?.sourceItemId === undefined
          ? (previous.sourceItemId ? { sourceItemId: previous.sourceItemId } : {})
          : (entry.sourceItemId ? { sourceItemId: entry.sourceItemId } : {}))
      };
      const translations = current.translations.filter((candidate) =>
        !(candidate.marketHashName === previousMarketHashName &&
          candidate.locale === previousLocale)
      );
      translations.push(normalizedEntry);

      const updated = normalizePack({ ...current, translations });
      await storage.set(storageKey(appId), updated);
      return updated;
    }

    async function removeTranslation(appId, identity) {
      const current = await get(appId);
      if (!current) throw new Error("Game profile was not found.");

      const marketHashName = validateMarketHashName(identity?.marketHashName);
      const locale = validateLocale(identity?.locale);
      if (!marketHashName || !locale) {
        throw new TypeError("A valid market hash name and locale are required.");
      }

      const exists = current.translations.some((entry) =>
        entry.marketHashName === marketHashName && entry.locale === locale
      );
      if (!exists) throw new Error("Translation entry was not found.");

      const updated = normalizePack({
        ...current,
        translations: current.translations.filter((entry) =>
          !(entry.marketHashName === marketHashName && entry.locale === locale)
        )
      });
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

    return Object.freeze({ get, list, addGame, importPack, upsertTranslation, updateTranslation, removeTranslation, setEnabled, remove, exportPack });
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
          ...(entry.sourceItemId ? { sourceItemId: entry.sourceItemId } : {}),
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
