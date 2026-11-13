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

  if (!marketItems || !translationApi || !registryApi || !storageApi ||
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

  const LABEL_ATTRIBUTE = "data-alaxee-steamhub-translation";
  const MAX_VISIBLE_ITEMS_PER_PASS = 80;
  let scanScheduled = false;

  function ensureStyles() {
    if (document.getElementById("alaxee-steamhub-market-style")) return;
    const style = document.createElement("style");
    style.id = "alaxee-steamhub-market-style";
    style.textContent =
      ".alaxee-steamhub-translation{" +
      "display:inline-block;margin:3px 0 0 7px;padding:2px 7px;" +
      "border:1px solid rgba(126,190,210,.28);border-radius:6px;" +
      "background:rgba(22,43,57,.78);color:#9ce4eb;" +
      "font:600 11px/1.45 Inter,'Segoe UI',sans-serif;" +
      "vertical-align:middle;white-space:normal}" +
      "@media(prefers-reduced-motion:reduce){.alaxee-steamhub-translation{transition:none}}";
    (document.head || document.documentElement).append(style);
  }

  function updateTranslationLabel(anchor, item, translation) {
    if (!anchor?.parentElement) return;

    const next = anchor.nextElementSibling;
    const existing = next?.hasAttribute(LABEL_ATTRIBUTE) ? next : null;

    if (!translation) {
      existing?.remove();
      return;
    }

    if (existing) {
      if (existing.textContent !== translation) existing.textContent = translation;
      return;
    }

    const label = document.createElement("span");
    label.className = "alaxee-steamhub-translation";
    label.setAttribute(LABEL_ATTRIBUTE, "");
    label.dataset.appId = item.appId;
    label.dataset.marketHashName = item.marketHashName;
    label.textContent = translation;
    label.title = "ALAXEE SteamHub · " + item.appId + " · " + item.marketHashName;
    anchor.insertAdjacentElement("afterend", label);
  }

  async function processItem(item) {
    if (!item.element || !item.element.isConnected) return;

    const game = await registry.get(item.appId);
    if (!game || !game.game.enabled) {
      updateTranslationLabel(item.element, item, "");
      return;
    }

    const result = await engine.resolve(item, {
      locale: game.game.defaultLocale || "zh-CN"
    });
    if (result.status === "translated") {
      updateTranslationLabel(item.element, item, result.record.translation);
    } else {
      updateTranslationLabel(item.element, item, "");
    }
  }

  async function scanVisibleItems() {
    if (!document.documentElement) return;
    ensureStyles();

    const items = marketItems.collectMarketListingLinks(document, window.location.href)
      .filter((item) => item.element)
      .slice(0, MAX_VISIBLE_ITEMS_PER_PASS);

    for (let index = 0; index < items.length; index += 12) {
      const batch = items.slice(index, index + 12);
      await Promise.all(batch.map((item) => processItem(item).catch(() => undefined)));
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
    version: "0.4.0",
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
          return !node.hasAttribute?.(LABEL_ATTRIBUTE) &&
            !node.closest?.("[data-alaxee-steamhub-translation]");
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
