(() => {
  "use strict";

  const marketLocale = globalThis.__ALAXEE_STEAMHUB_MARKET_LOCALE__;
  if (!marketLocale || !window.location) return;

  const localizedUrl = marketLocale.getSimplifiedChineseMarketUrl(window.location.href);
  if (localizedUrl) {
    window.location.replace(localizedUrl);
  }
})();
