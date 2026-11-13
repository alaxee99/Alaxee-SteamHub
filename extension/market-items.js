(() => {
  "use strict";

  const API_KEY = "__ALAXEE_STEAMHUB_MARKET_ITEMS__";
  const IDENTITY_KEY = "__ALAXEE_STEAMHUB_ITEM_IDENTITY__";
  if (globalThis[API_KEY]) return;

  function findListingContainer(anchor, root, marketHashName) {
    const rowSelectors = [
      ".market_listing_row",
      ".market_listing_searchresult",
      "[id^='result_']"
    ];
    for (const selector of rowSelectors) {
      const row = anchor.closest?.(selector);
      if (row) return row;
    }

    const anchorText = String(anchor.textContent || "").replace(/\s+/g, " ").trim();
    if (anchorText === marketHashName || anchorText.includes(marketHashName)) return anchor;

    const parent = anchor.parentElement;
    if (!parent || parent === root || parent.tagName === "BODY" || parent.tagName === "HTML") {
      return anchor;
    }
    const siblingListingLinks = typeof parent.querySelectorAll === "function"
      ? parent.querySelectorAll('a[href*="/market/listings/"]')
      : [];
    return siblingListingLinks.length <= 1 ? parent : anchor;
  }

  function collectMarketListingLinks(root, pageUrl) {
    const identity = globalThis[IDENTITY_KEY];
    if (!identity) throw new Error("Item identity module is not available.");

    const results = new Map();
    const currentPageItem = identity.parseMarketListingUrl(pageUrl);
    if (currentPageItem) {
      const titleSelectors = [
        "#largeiteminfo .market_listing_nav .market_listing_item_name",
        ".market_listing_nav .market_listing_item_name",
        "#largeiteminfo_item_name",
        ".item-name",
        "h1",
        "h2"
      ];
      const titleCandidates = typeof root?.querySelectorAll === "function"
        ? titleSelectors.flatMap((selector) => Array.from(root.querySelectorAll(selector)))
        : [];
      const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim();
      const titleElement = titleCandidates.find((element) =>
        normalizeText(element.textContent) === currentPageItem.marketHashName
      ) || (typeof root?.querySelector === "function"
        ? root.querySelector("#largeiteminfo_item_name")
        : null);

      results.set(currentPageItem.cacheIdentity, {
        ...currentPageItem,
        href: pageUrl,
        element: titleElement
      });
    }

    if (!root || typeof root.querySelectorAll !== "function") {
      return Array.from(results.values());
    }

    const anchors = new Set([
      ...root.querySelectorAll('a[href*="/market/listings/"]'),
      ...root.querySelectorAll("a.market_listing_row_link")
    ]);
    for (const anchor of anchors) {
      if (anchor.hidden || anchor.getAttribute?.("aria-hidden") === "true") continue;

      const href = anchor.href || anchor.getAttribute?.("href");
      const itemKey = identity.parseMarketListingUrl(href, pageUrl);
      if (!itemKey || results.has(itemKey.cacheIdentity)) continue;

      const container = findListingContainer(anchor, root, itemKey.marketHashName);
      if (container.hidden || container.getAttribute?.("aria-hidden") === "true") continue;
      if (typeof container.getClientRects === "function" && container.getClientRects().length === 0) continue;

      results.set(itemKey.cacheIdentity, {
        ...itemKey,
        href: new URL(href, pageUrl).toString(),
        element: container
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
