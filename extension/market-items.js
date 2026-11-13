(() => {
  "use strict";

  const API_KEY = "__ALAXEE_STEAMHUB_MARKET_ITEMS__";
  const IDENTITY_KEY = "__ALAXEE_STEAMHUB_ITEM_IDENTITY__";
  if (globalThis[API_KEY]) return;

  function collectMarketListingLinks(root, pageUrl) {
    const identity = globalThis[IDENTITY_KEY];
    if (!identity) throw new Error("Item identity module is not available.");

    const results = new Map();
    const currentPageItem = identity.parseMarketListingUrl(pageUrl);
    if (currentPageItem) {
      results.set(currentPageItem.cacheIdentity, {
        ...currentPageItem,
        href: pageUrl,
        element: null
      });
    }

    if (!root || typeof root.querySelectorAll !== "function") {
      return Array.from(results.values());
    }

    for (const anchor of root.querySelectorAll('a[href*="/market/listings/"]')) {
      if (anchor.hidden || anchor.getAttribute?.("aria-hidden") === "true") continue;
      if (typeof anchor.getClientRects === "function" && anchor.getClientRects().length === 0) continue;

      const href = anchor.href || anchor.getAttribute?.("href");
      const itemKey = identity.parseMarketListingUrl(href, pageUrl);
      if (!itemKey || results.has(itemKey.cacheIdentity)) continue;

      results.set(itemKey.cacheIdentity, {
        ...itemKey,
        href: new URL(href, pageUrl).toString(),
        element: anchor
      });
    }

    return Array.from(results.values());
  }

  Object.defineProperty(globalThis, API_KEY, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: Object.freeze({ collectMarketListingLinks })
  });
})();
