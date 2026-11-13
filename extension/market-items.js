(() => {
  "use strict";

  const API_KEY = "__ALAXEE_STEAMHUB_MARKET_ITEMS__";
  const IDENTITY_KEY = "__ALAXEE_STEAMHUB_ITEM_IDENTITY__";
  if (globalThis[API_KEY]) return;

  function findListingContainer(anchor, root) {
    // Steam's search overview uses a table row around each listing link.
    // Prefer the row because the anchor itself may have no layout box even
    // while its child text is visible (for example, display: contents).
    const rowSelectors = [
      "tr.market_listing_row",
      ".market_listing_row",
      ".market_listing_searchresult",
      "[id^='result_']"
    ];
    for (const selector of rowSelectors) {
      const row = anchor.closest?.(selector);
      if (row) return row;
    }

    const nameCell = anchor.closest?.(".market_listing_item_name_cell");
    if (nameCell) return nameCell;

    // Current Steam search pages use generated CSS classes and may not expose
    // stable row wrappers. The anchor itself contains the exact market name
    // and has its own block layout, so do not guess an arbitrary parent node.
    return anchor;
  }

  function collectMarketListingLinks(root, pageUrl) {
    const identity = globalThis[IDENTITY_KEY];
    if (!identity) throw new Error("Item identity module is not available.");

    const results = new Map();
    const searchPageAppId = identity.parseMarketSearchPageAppId(pageUrl);
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
      if (!itemKey || (searchPageAppId && itemKey.appId !== searchPageAppId) ||
          results.has(itemKey.cacheIdentity)) continue;

      const container = findListingContainer(anchor, root);
      if (container.hidden || container.getAttribute?.("aria-hidden") === "true") continue;

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
