(() => {
  "use strict";

  const marketLocale = globalThis.__ALAXEE_STEAMHUB_MARKET_LOCALE__;
  if (!marketLocale || !window.location) return;

  const localizedUrl = marketLocale.getSimplifiedChineseMarketUrl(window.location.href);
  if (localizedUrl) {
    window.location.replace(localizedUrl);
    return;
  }

  const marketItems = globalThis.__ALAXEE_STEAMHUB_MARKET_ITEMS__;
  const translationApi = globalThis.__ALAXEE_STEAMHUB_TRANSLATION_ENGINE__;
  const registryApi = globalThis.__ALAXEE_STEAMHUB_GAME_REGISTRY__;
  const storageApi = globalThis.__ALAXEE_STEAMHUB_STORAGE_ADAPTER__;
  const textLocalizer = globalThis.__ALAXEE_STEAMHUB_GAME_TEXT_LOCALIZER__;

  if (!marketItems || !translationApi || !registryApi || !storageApi || !textLocalizer ||
      typeof chrome === "undefined" || !chrome.storage?.local) {
    return;
  }

  const storage = storageApi.createChromeStorageAdapter(chrome.storage.local);
  const registry = registryApi.createGameRegistry(storage);
  const provider = registryApi.createGamePackProvider(registry);
  const engine = translationApi.createTranslationEngine({
    providers: [provider],
    locale: "zh-CN"
  });

  const NAME_ORIGINAL_ATTRIBUTE = "data-alaxee-steamhub-original-name";
  const TEXT_ORIGINAL_ATTRIBUTE = "data-alaxee-steamhub-original-text";
  const APP_ATTRIBUTE = "data-alaxee-steamhub-app-id";
  const MAX_VISIBLE_ITEMS_PER_PASS = 80;
  let scanScheduled = false;

  function normalizedText(value) {
    return textLocalizer.normalizeText(value);
  }

  function findNameTarget(item) {
    const candidates = [];
    const addTree = (root) => {
      if (!root || root.nodeType !== Node.ELEMENT_NODE) return;
      candidates.push(root);
      if (typeof root.querySelectorAll === "function") {
        candidates.push(...root.querySelectorAll(
          ".market_listing_item_name, #largeiteminfo_item_name, h1, h2, [class*='item_name']"
        ));
      }
    };

    addTree(item.element);
    if (!candidates.some((element) => normalizedText(element.textContent) === item.marketHashName)) {
      for (const selector of [
        "#largeiteminfo_item_name",
        "#largeiteminfo .market_listing_nav .market_listing_item_name",
        ".market_listing_nav .market_listing_item_name",
        "h1",
        "h2"
      ]) {
        for (const element of document.querySelectorAll(selector)) candidates.push(element);
      }
    }

    const exact = candidates.filter((element) =>
      element?.isConnected !== false &&
      normalizedText(element.textContent) === item.marketHashName
    );
    return exact.sort((a, b) =>
      (a.querySelectorAll?.("*").length || 0) - (b.querySelectorAll?.("*").length || 0)
    )[0] || null;
  }

  function restoreElement(element, attribute) {
    if (!element?.hasAttribute?.(attribute)) return;
    const original = element.getAttribute(attribute);
    element.removeAttribute(attribute);
    element.removeAttribute(APP_ATTRIBUTE);
    element.textContent = original;
    if (attribute === NAME_ORIGINAL_ATTRIBUTE) {
      element.title = original;
    }
  }

  function applyNameTranslation(item, translation) {
    const target = findNameTarget(item);
    if (!target) return;

    if (!translation) {
      restoreElement(target, NAME_ORIGINAL_ATTRIBUTE);
      return;
    }

    if (!target.hasAttribute(NAME_ORIGINAL_ATTRIBUTE)) {
      target.setAttribute(NAME_ORIGINAL_ATTRIBUTE, target.textContent);
    }
    target.setAttribute(APP_ATTRIBUTE, item.appId);
    target.textContent = translation;
    target.title = "原文：" + target.getAttribute(NAME_ORIGINAL_ATTRIBUTE);
  }

  function restoreAppText(appId) {
    for (const element of document.querySelectorAll(
      "[" + APP_ATTRIBUTE + "='" + appId + "'][" + TEXT_ORIGINAL_ATTRIBUTE + "]"
    )) {
      restoreElement(element, TEXT_ORIGINAL_ATTRIBUTE);
    }
    for (const element of document.querySelectorAll(
      "[" + APP_ATTRIBUTE + "='" + appId + "'][" + NAME_ORIGINAL_ATTRIBUTE + "]"
    )) {
      restoreElement(element, NAME_ORIGINAL_ATTRIBUTE);
    }
  }

  function applyGameTextTranslations(appId, mappings) {
    const selectors = "p,span,div,li,dt,dd,strong,b,h1,h2,h3";
    for (const element of document.querySelectorAll(selectors)) {
      if (element.closest?.("[data-alaxee-steamhub-translation-skip]")) continue;
      const childElements = Array.from(element.children || []);
      if (childElements.length && !childElements.every((child) => child.tagName === "BR")) continue;

      const existingOriginal = element.getAttribute(TEXT_ORIGINAL_ATTRIBUTE);
      const original = existingOriginal === null ? element.textContent : existingOriginal;
      const translated = textLocalizer.translateText(appId, original, mappings);

      if (!translated) {
        if (existingOriginal !== null) restoreElement(element, TEXT_ORIGINAL_ATTRIBUTE);
        continue;
      }
      if (existingOriginal === null) element.setAttribute(TEXT_ORIGINAL_ATTRIBUTE, element.textContent);
      element.setAttribute(APP_ATTRIBUTE, appId);
      element.textContent = translated;
      element.title = "原文：" + original;
    }
  }

  async function processItem(item, processedTextApps) {
    if (item.element?.isConnected === false) return;

    const game = await registry.get(item.appId);
    if (!game || !game.game.enabled) {
      applyNameTranslation(item, "");
      restoreAppText(item.appId);
      return;
    }

    if (!processedTextApps.has(item.appId)) {
      applyGameTextTranslations(item.appId, game.textTranslations || []);
      processedTextApps.add(item.appId);
    }

    const result = await engine.resolve(item, {
      locale: game.game.defaultLocale || "zh-CN"
    });
    if (result.status === "translated") {
      applyNameTranslation(item, result.record.translation);
    } else {
      applyNameTranslation(item, "");
    }
  }

  async function scanVisibleItems() {
    if (!document.documentElement) return;
    const items = marketItems.collectMarketListingLinks(document, window.location.href)
      .filter((item) => item.appId && item.marketHashName)
      .slice(0, MAX_VISIBLE_ITEMS_PER_PASS);

    const processedTextApps = new Set();
    for (let index = 0; index < items.length; index += 12) {
      const batch = items.slice(index, index + 12);
      await Promise.all(batch.map((item) =>
        processItem(item, processedTextApps).catch(() => undefined)
      ));
    }
  }

  function scheduleScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    window.setTimeout(() => {
      scanScheduled = false;
      scanVisibleItems().catch(() => undefined);
    }, 180);
  }

  const api = Object.freeze({
    version: "0.8.0",
    scanMarketItems() {
      return marketItems.collectMarketListingLinks(document, window.location.href)
        .map(({ element, ...item }) => item);
    },
    translateItem(itemKey, options) {
      return engine.resolve(itemKey, options);
    },
    refresh() {
      return scanVisibleItems();
    }
  });

  Object.defineProperty(globalThis, "__ALAXEE_STEAMHUB__", {
    configurable: false,
    enumerable: false,
    writable: false,
    value: api
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleScan, { once: true });
  } else {
    scheduleScan();
  }

  if (typeof MutationObserver === "function" && document.documentElement) {
    const observer = new MutationObserver((mutations) => {
      const relevant = mutations.some((mutation) =>
        Array.from(mutation.addedNodes || []).some((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return false;
          return !node.hasAttribute?.(TEXT_ORIGINAL_ATTRIBUTE) &&
            !node.hasAttribute?.(NAME_ORIGINAL_ATTRIBUTE);
        })
      );
      if (relevant) scheduleScan();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  chrome.storage.onChanged?.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    const gamePackChanged = Object.keys(changes).some((key) =>
      key.startsWith("alaxee-steamhub:game-pack:v1:")
    );
    if (gamePackChanged) scheduleScan();
  });
})();