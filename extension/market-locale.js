(() => {
  "use strict";

  const API_KEY = "__ALAXEE_STEAMHUB_MARKET_LOCALE__";
  const MARKET_HOSTS = new Set(["steamcommunity.com", "www.steamcommunity.com"]);
  const SIMPLIFIED_CHINESE_LOCALE = "schinese";

  if (Object.prototype.hasOwnProperty.call(globalThis, API_KEY)) return;

  function isCommunityMarketUrl(value) {
    try {
      const url = new URL(value);
      const host = url.hostname.toLowerCase();
      const isAllowedHost = MARKET_HOSTS.has(host);
      const isMarketPath = url.pathname === "/market" || url.pathname.startsWith("/market/");

      return url.protocol === "https:" && isAllowedHost && isMarketPath;
    } catch {
      return false;
    }
  }

  function getSimplifiedChineseMarketUrl(value) {
    try {
      if (!isCommunityMarketUrl(value)) return null;

      const url = new URL(value);
      if (url.searchParams.get("l") === SIMPLIFIED_CHINESE_LOCALE) return null;

      url.searchParams.set("l", SIMPLIFIED_CHINESE_LOCALE);
      return url.toString();
    } catch {
      return null;
    }
  }

  Object.defineProperty(globalThis, API_KEY, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: Object.freeze({
      isCommunityMarketUrl,
      getSimplifiedChineseMarketUrl
    })
  });
})();
