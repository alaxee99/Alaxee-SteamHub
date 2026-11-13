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

  const APP_ATTRIBUTE = "data-alaxee-steamhub-app-id";
  const MAX_VISIBLE_ITEMS_PER_PASS = 80;
  const localizedTextNodes = new Map();
  let scanScheduled = false;
  const diagnostics = {
    version: "0.8.2",
    initializedAt: new Date().toISOString(),
    scanCount: 0,
    lastScanAt: null,
    detectedItems: 0,
    translatedNames: 0,
    translatedDetailNodes: 0,
    missingPacks: [],
    disabledGames: [],
    unmatchedNames: [],
    errors: []
  };

  function normalizedText(value) {
    return textLocalizer.normalizeText(value);
  }

  function isTranslatableTextNode(node) {
    const parent = node?.parentElement;
    if (!parent || !normalizedText(node.nodeValue)) return false;
    return !parent.closest("script,style,noscript,textarea,input,button,option,code,pre");
  }

  function findTextNode(root, expectedText) {
    if (!root || typeof document.createTreeWalker !== "function") return null;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const existing = localizedTextNodes.get(node);
      const original = existing?.original ?? node.nodeValue;
      if (normalizedText(original) === expectedText) return node;
      node = walker.nextNode();
    }
    return null;
  }

  function findNameTextNodes(item) {
    const matches = new Set();
    const roots = item.element ? [item.element] : [document.body || document.documentElement];

    for (const root of roots) {
      if (!root || typeof document.createTreeWalker !== "function") continue;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const existing = localizedTextNodes.get(node);
        const original = existing?.original ?? node.nodeValue;
        if (normalizedText(original) === item.marketHashName) matches.add(node);
        node = walker.nextNode();
      }
    }

    for (const [node, record] of localizedTextNodes) {
      if (record.kind === "name" && record.appId === item.appId &&
          record.original === item.marketHashName && node.isConnected) {
        matches.add(node);
      }
    }
    return Array.from(matches);
  }

  function restoreTextNode(node) {
    const record = localizedTextNodes.get(node);
    if (!record) return;
    if (node.isConnected) {
      if (node.nodeValue !== record.original) node.nodeValue = record.original;
      if (record.kind === "name" && node.parentElement) {
        if (record.originalTitle === null) node.parentElement.removeAttribute("title");
        else node.parentElement.setAttribute("title", record.originalTitle);
        node.parentElement.removeAttribute(APP_ATTRIBUTE);
      }
    }
    localizedTextNodes.delete(node);
  }

  function restoreAppText(appId) {
    for (const [node, record] of localizedTextNodes) {
      if (record.appId === appId) restoreTextNode(node);
    }
  }

  function applyNameTranslation(item, translation) {
    const nodes = findNameTextNodes(item);
    if (!translation) {
      for (const node of nodes) {
        const existing = localizedTextNodes.get(node);
        if (existing?.kind === "name") restoreTextNode(node);
      }
      return 0;
    }

    let applied = 0;
    for (const node of nodes) {
      const existing = localizedTextNodes.get(node);
      if (!existing) {
        localizedTextNodes.set(node, {
          appId: item.appId,
          kind: "name",
          original: node.nodeValue,
          originalTitle: node.parentElement?.getAttribute("title") ?? null
        });
      }
      if (node.nodeValue !== translation) node.nodeValue = translation;
      if (node.parentElement) {
        const original = existing?.original ?? localizedTextNodes.get(node).original;
        node.parentElement.title = "原文：" + original;
        node.parentElement.setAttribute(APP_ATTRIBUTE, item.appId);
      }
      applied += 1;
    }
    return applied;
  }

  function applyGameTextTranslations(appId, mappings) {
    const exactMappings = textLocalizer.validateMappings(mappings);
    const root = document.body || document.documentElement;
    if (!root || typeof document.createTreeWalker !== "function") return 0;

    let translatedCount = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (!isTranslatableTextNode(node)) {
        node = walker.nextNode();
        continue;
      }

      let existing = localizedTextNodes.get(node);
      if (existing?.kind === "detail" && existing.appId !== appId) {
        restoreTextNode(node);
        existing = null;
      }
      const original = existing?.original ?? node.nodeValue;
      if (existing?.kind === "name") {
        node = walker.nextNode();
        continue;
      }

      const translated = textLocalizer.translateText(appId, original, exactMappings);
      if (translated) {
        if (!existing) {
          localizedTextNodes.set(node, {
            appId,
            kind: "detail",
            original
          });
        }
        if (node.nodeValue !== translated) {
          node.nodeValue = translated;
          translatedCount += 1;
        }
      } else if (existing?.kind === "detail" && existing.appId === appId) {
        restoreTextNode(node);
      }
      node = walker.nextNode();
    }
    return translatedCount;
  }

  async function processItem(item, processedTextApps) {
    if (item.element?.isConnected === false) return;

    const game = await registry.get(item.appId);
    if (!game) {
      if (!diagnostics.missingPacks.includes(item.appId)) diagnostics.missingPacks.push(item.appId);
      applyNameTranslation(item, "");
      restoreAppText(item.appId);
      return;
    }
    if (!game.game.enabled) {
      if (!diagnostics.disabledGames.includes(item.appId)) diagnostics.disabledGames.push(item.appId);
      applyNameTranslation(item, "");
      restoreAppText(item.appId);
      return;
    }

    if (!processedTextApps.has(item.appId)) {
      diagnostics.translatedDetailNodes += applyGameTextTranslations(item.appId, game.textTranslations || []);
      processedTextApps.add(item.appId);
    }

    const result = await engine.resolve(item, {
      locale: game.game.defaultLocale || "zh-CN"
    });
    if (result.status === "translated") {
      diagnostics.translatedNames += applyNameTranslation(item, result.record.translation);
    } else {
      const restored = applyNameTranslation(item, "");
      if (diagnostics.unmatchedNames.length < 20) {
        diagnostics.unmatchedNames.push({
          appId: item.appId,
          marketHashName: item.marketHashName,
          status: result.status,
          nameNodesFound: restored
        });
      }
    }
  }

  async function scanVisibleItems() {
    if (!document.documentElement) return;
    diagnostics.scanCount += 1;
    diagnostics.lastScanAt = new Date().toISOString();
    diagnostics.translatedNames = 0;
    diagnostics.translatedDetailNodes = 0;
    diagnostics.missingPacks = [];
    diagnostics.disabledGames = [];
    diagnostics.unmatchedNames = [];
    diagnostics.errors = [];

    const items = marketItems.collectMarketListingLinks(document, window.location.href)
      .filter((item) => item.appId && item.marketHashName)
      .slice(0, MAX_VISIBLE_ITEMS_PER_PASS);
    diagnostics.detectedItems = items.length;

    const processedTextApps = new Set();
    for (let index = 0; index < items.length; index += 12) {
      const batch = items.slice(index, index + 12);
      await Promise.all(batch.map(async (item) => {
        try {
          await processItem(item, processedTextApps);
        } catch (error) {
          if (diagnostics.errors.length < 20) {
            diagnostics.errors.push({
              appId: item.appId,
              marketHashName: item.marketHashName,
              message: error?.message || String(error)
            });
          }
        }
      }));
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
    version: "0.8.2",
    getDiagnostics() {
      return Object.freeze({
        ...diagnostics,
        url: window.location.href,
        itemCount: diagnostics.detectedItems,
        localizedNodeCount: localizedTextNodes.size,
        missingPacks: diagnostics.missingPacks.slice(),
        disabledGames: diagnostics.disabledGames.slice(),
        unmatchedNames: diagnostics.unmatchedNames.slice(),
        errors: diagnostics.errors.slice()
      });
    },
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
        mutation.type === "characterData" ||
        Array.from(mutation.addedNodes || []).some((node) =>
          node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE
        )
      );
      if (relevant) scheduleScan();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  chrome.storage.onChanged?.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    const gamePackChanged = Object.keys(changes).some((key) =>
      key.startsWith("alaxee-steamhub:game-pack:v1:")
    );
    if (gamePackChanged) scheduleScan();
  });
})();