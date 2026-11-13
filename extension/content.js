(() => {
  "use strict";

  const marketLocale = globalThis.__ALAXEE_STEAMHUB_MARKET_LOCALE__;
  if (!marketLocale || !window.location) return;

  const localizedUrl = marketLocale.getSimplifiedChineseMarketUrl(window.location.href);
  if (localizedUrl) {
    window.location.replace(localizedUrl);
    return;
  }

  const identity = globalThis.__ALAXEE_STEAMHUB_ITEM_IDENTITY__;
  const marketItems = globalThis.__ALAXEE_STEAMHUB_MARKET_ITEMS__;
  const translationApi = globalThis.__ALAXEE_STEAMHUB_TRANSLATION_ENGINE__;
  const storageApi = globalThis.__ALAXEE_STEAMHUB_STORAGE_ADAPTER__;

  if (!identity || !marketItems || !translationApi || !storageApi ||
      typeof chrome === "undefined" || !chrome.storage?.local) {
    return;
  }

  const storage = storageApi.createChromeStorageAdapter(chrome.storage.local);
  const cache = translationApi.createTranslationCache(storage);
  const engine = translationApi.createTranslationEngine({
    providers: [],
    cache,
    locale: "zh-CN"
  });

  const api = Object.freeze({
    version: "0.3.0",
    scanMarketItems() {
      return marketItems.collectMarketListingLinks(document, window.location.href)
        .map(({ element, ...item }) => item);
    },
    translateItem(itemKey, options) {
      return engine.resolve(itemKey, options);
    }
  });

  Object.defineProperty(globalThis, "__ALAXEE_STEAMHUB__", {
    configurable: false,
    enumerable: false,
    writable: false,
    value: api
  });
})();
