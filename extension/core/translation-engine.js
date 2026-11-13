(() => {
  "use strict";

  const API_KEY = "__ALAXEE_STEAMHUB_TRANSLATION_ENGINE__";
  const IDENTITY_KEY = "__ALAXEE_STEAMHUB_ITEM_IDENTITY__";
  const CACHE_VERSION = 1;
  const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

  if (globalThis[API_KEY]) return;

  function createTranslationCache(storage, options = {}) {
    if (!storage || typeof storage.get !== "function" ||
        typeof storage.set !== "function" || typeof storage.delete !== "function") {
      throw new TypeError("Translation cache requires get, set, and delete storage methods.");
    }

    const ttlMs = Number.isFinite(options.ttlMs) && options.ttlMs > 0
      ? options.ttlMs
      : DEFAULT_TTL_MS;
    const now = typeof options.now === "function" ? options.now : Date.now;
    const identity = globalThis[IDENTITY_KEY];

    if (!identity) throw new Error("Item identity module must load before the translation engine.");

    function cacheKey(itemKey, locale) {
      const validated = identity.createItemKey(itemKey);
      if (!validated || typeof locale !== "string" || !locale.trim()) {
        throw new TypeError("A valid item key and locale are required.");
      }
      return `alaxee-steamhub:translation:v1:${validated.cacheIdentity}:${encodeURIComponent(locale)}`;
    }

    async function get(itemKey, locale) {
      const key = cacheKey(itemKey, locale);
      const entry = await storage.get(key);
      if (!entry) return null;
      if (entry.version !== CACHE_VERSION || !Number.isFinite(entry.expiresAt)) {
        await storage.delete(key);
        return null;
      }

      const record = entry.record;
      const validatedKey = identity.createItemKey(record);
      const validSourceItemId = record?.sourceItemId === undefined ||
        (typeof record.sourceItemId === "string" &&
         record.sourceItemId.length > 0 &&
         record.sourceItemId.length <= 128 &&
         record.sourceItemId === record.sourceItemId.trim() &&
         !/[\u0000-\u001f\u007f]/.test(record.sourceItemId));
      const isExact = validatedKey &&
        validatedKey.appId === itemKey.appId &&
        validatedKey.marketHashName === itemKey.marketHashName &&
        record.locale === locale &&
        typeof record.translation === "string" &&
        record.translation.trim().length > 0 &&
        typeof record.source === "string" &&
        record.source.length > 0 &&
        validSourceItemId;

      if (!isExact || entry.expiresAt <= now()) {
        await storage.delete(key);
        return null;
      }
      return Object.freeze({ ...record });
    }

    async function set(itemKey, locale, record) {
      const key = cacheKey(itemKey, locale);
      const validated = identity.createItemKey(record);
      const validSourceItemId = record.sourceItemId === undefined ||
        (typeof record.sourceItemId === "string" &&
         record.sourceItemId.length > 0 &&
         record.sourceItemId.length <= 128 &&
         record.sourceItemId === record.sourceItemId.trim() &&
         !/[\u0000-\u001f\u007f]/.test(record.sourceItemId));
      if (!validated ||
          validated.appId !== itemKey.appId ||
          validated.marketHashName !== itemKey.marketHashName ||
          record.locale !== locale ||
          typeof record.translation !== "string" ||
          !record.translation.trim() ||
          typeof record.source !== "string" ||
          !record.source.trim() ||
          !validSourceItemId) {
        throw new TypeError("Refusing to cache a translation without an exact item-key and locale match.");
      }

      const normalized = Object.freeze({
        appId: validated.appId,
        marketHashName: validated.marketHashName,
        locale,
        translation: record.translation,
        source: record.source,
        ...(record.sourceItemId ? { sourceItemId: record.sourceItemId } : {}),
        updatedAt: Number.isFinite(record.updatedAt) ? record.updatedAt : now()
      });

      await storage.set(key, {
        version: CACHE_VERSION,
        expiresAt: now() + ttlMs,
        record: normalized
      });
      return normalized;
    }

    async function remove(itemKey, locale) {
      await storage.delete(cacheKey(itemKey, locale));
    }

    return Object.freeze({ get, set, delete: remove });
  }

  function validateProviderRecord(record, itemKey, locale, providerId, now) {
    const identity = globalThis[IDENTITY_KEY];
    if (!record || typeof record !== "object") return null;

    const candidate = identity.createItemKey(record);
    const validSourceItemId = record.sourceItemId === undefined ||
      (typeof record.sourceItemId === "string" &&
       record.sourceItemId.length > 0 &&
       record.sourceItemId.length <= 128 &&
       record.sourceItemId === record.sourceItemId.trim() &&
       !/[\u0000-\u001f\u007f]/.test(record.sourceItemId));
    if (!candidate ||
        candidate.appId !== itemKey.appId ||
        candidate.marketHashName !== itemKey.marketHashName ||
        record.locale !== locale ||
        typeof record.translation !== "string" ||
        !record.translation.trim() ||
        !validSourceItemId) {
      return null;
    }

    return Object.freeze({
      appId: candidate.appId,
      marketHashName: candidate.marketHashName,
      locale,
      translation: record.translation,
      source: typeof record.source === "string" && record.source.trim()
        ? record.source
        : providerId,
      ...(typeof record.sourceItemId === "string" && record.sourceItemId
        ? { sourceItemId: record.sourceItemId }
        : {}),
      updatedAt: Number.isFinite(record.updatedAt) ? record.updatedAt : now()
    });
  }

  function createTranslationEngine(options = {}) {
    const identity = globalThis[IDENTITY_KEY];
    if (!identity) throw new Error("Item identity module must load before the translation engine.");

    const providers = Array.isArray(options.providers) ? options.providers.slice() : [];
    const cache = options.cache || null;
    const defaultLocale = options.locale || "zh-CN";
    const now = typeof options.now === "function" ? options.now : Date.now;

    for (const provider of providers) {
      if (!provider || typeof provider.id !== "string" || !provider.id.trim() ||
          typeof provider.lookup !== "function") {
        throw new TypeError("Every translation provider must have an id and lookup function.");
      }
    }

    async function resolve(input, context = {}) {
      const itemKey = identity.createItemKey(input);
      if (!itemKey) return Object.freeze({ status: "invalid-item-key" });

      const locale = context.locale || defaultLocale;
      if (typeof locale !== "string" || !locale.trim()) {
        return Object.freeze({ status: "invalid-locale" });
      }

      if (cache) {
        const cached = await cache.get(itemKey, locale);
        if (cached) return Object.freeze({ status: "translated", source: "cache", record: cached });
      }

      if (providers.length === 0) {
        return Object.freeze({ status: "unavailable", reason: "no-provider-configured" });
      }

      let providerFailures = 0;
      for (const provider of providers) {
        if (context.signal?.aborted) {
          return Object.freeze({ status: "aborted" });
        }

        try {
          const response = await provider.lookup({
            appId: itemKey.appId,
            marketHashName: itemKey.marketHashName,
            locale,
            signal: context.signal
          });

          if (response == null) continue;
          const candidates = Array.isArray(response) ? response : [response];
          const exactMatches = candidates.filter((candidate) => {
            const candidateKey = identity.createItemKey(candidate);
            return candidateKey &&
              candidateKey.appId === itemKey.appId &&
              candidateKey.marketHashName === itemKey.marketHashName;
          });

          if (exactMatches.length > 1) {
            return Object.freeze({
              status: "ambiguous",
              provider: provider.id,
              matchCount: exactMatches.length
            });
          }

          if (exactMatches.length === 0) continue;

          const record = validateProviderRecord(
            exactMatches[0], itemKey, locale, provider.id, now
          );
          if (!record) continue;

          if (cache) await cache.set(itemKey, locale, record);
          return Object.freeze({ status: "translated", source: provider.id, record });
        } catch (error) {
          if (context.signal?.aborted) return Object.freeze({ status: "aborted" });
          providerFailures += 1;
        }
      }

      return Object.freeze({
        status: providerFailures > 0 ? "provider-error" : "not-found"
      });
    }

    return Object.freeze({ resolve });
  }

  Object.defineProperty(globalThis, API_KEY, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: Object.freeze({ createTranslationCache, createTranslationEngine })
  });
})();
