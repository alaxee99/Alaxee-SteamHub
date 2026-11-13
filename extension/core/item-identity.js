(() => {
  "use strict";

  const API_KEY = "__ALAXEE_STEAMHUB_ITEM_IDENTITY__";
  const ALLOWED_HOSTS = new Set(["steamcommunity.com", "www.steamcommunity.com"]);
  const LISTING_PATH = /^\/market\/listings\/([1-9]\d*)\/(.+)$/;

  if (globalThis[API_KEY]) return;

  function normalizeAppId(value) {
    const text = String(value ?? "");
    if (!/^[1-9]\d*$/.test(text)) return null;

    const numeric = Number(text);
    if (!Number.isSafeInteger(numeric) || numeric <= 0) return null;
    return String(numeric);
  }

  function createItemKey(input) {
    if (!input || typeof input !== "object") return null;

    const appId = normalizeAppId(input.appId);
    const marketHashName = input.marketHashName;

    if (!appId || typeof marketHashName !== "string") return null;
    if (marketHashName.length === 0 || marketHashName.length > 512) return null;
    if (marketHashName !== marketHashName.trim()) return null;
    if (/[\u0000-\u001f\u007f]/.test(marketHashName)) return null;

    return Object.freeze({
      appId,
      marketHashName,
      cacheIdentity: `steam-market-item:v1:${appId}:${encodeURIComponent(marketHashName)}`
    });
  }

  function parseMarketListingUrl(value, baseUrl) {
    try {
      const url = baseUrl ? new URL(value, baseUrl) : new URL(value);
      if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())) return null;

      const match = url.pathname.match(LISTING_PATH);
      if (!match) return null;

      const appId = normalizeAppId(match[1]);
      let marketHashName;
      try {
        marketHashName = decodeURIComponent(match[2].replace(/\/+$/, ""));
      } catch {
        return null;
      }

      return createItemKey({ appId, marketHashName });
    } catch {
      return null;
    }
  }

  function parseMarketSearchPageAppId(value) {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())) return null;
      if (!/^\/market\/search\/?$/.test(url.pathname)) return null;
      return normalizeAppId(url.searchParams.get("appid"));
    } catch {
      return null;
    }
  }

  Object.defineProperty(globalThis, API_KEY, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: Object.freeze({ normalizeAppId, createItemKey, parseMarketListingUrl, parseMarketSearchPageAppId })
  });
})();
