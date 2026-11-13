(() => {
  "use strict";

  const runtimeStatus = globalThis.__ALAXEE_STEAMHUB_RUNTIME_STATUS__;
  function publishRuntimeStatus(tone, title, details) {
    runtimeStatus?.update({ tone, title, details });
  }
  publishRuntimeStatus("info", "SteamHub 正在启动", ["版本：0.8.4", "正在初始化 Steam 市场适配器…"]);

  const marketLocale = globalThis.__ALAXEE_STEAMHUB_MARKET_LOCALE__;
  if (!marketLocale || !window.location) {
    publishRuntimeStatus("error", "扩展脚本初始化失败", ["缺少页面 URL 或市场语言模块。", "请检查扩展是否正确加载。"]);
    return;
  }

  const localizedUrl = marketLocale.getSimplifiedChineseMarketUrl(window.location.href);
  if (localizedUrl) {
    publishRuntimeStatus("info", "正在切换 Steam 语言", ["将页面切换到简体中文参数后重新检查。"]);
    window.location.replace(localizedUrl);
    return;
  }

  const marketItems = globalThis.__ALAXEE_STEAMHUB_MARKET_ITEMS__;
  const translationApi = globalThis.__ALAXEE_STEAMHUB_TRANSLATION_ENGINE__;
  const registryApi = globalThis.__ALAXEE_STEAMHUB_GAME_REGISTRY__;
  const storageApi = globalThis.__ALAXEE_STEAMHUB_STORAGE_ADAPTER__;
  const textLocalizer = globalThis.__ALAXEE_STEAMHUB_GAME_TEXT_LOCALIZER__;

  const missingDependencies = [];
  if (!marketItems) missingDependencies.push("市场商品识别模块");
  if (!translationApi) missingDependencies.push("翻译引擎");
  if (!registryApi) missingDependencies.push("游戏词库注册表");
  if (!storageApi) missingDependencies.push("本地存储适配器");
  if (!textLocalizer) missingDependencies.push("详情文本翻译模块");
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    missingDependencies.push("扩展本地存储权限");
  }
  if (missingDependencies.length) {
    publishRuntimeStatus("error", "扩展初始化不完整", ["缺少：" + missingDependencies.join("、"), "请确认加载的是完整的 SteamHub 扩展目录。"]);
    return;
  }

  let storage;
  let registry;
  let provider;
  let engine;
  try {
    storage = storageApi.createChromeStorageAdapter(chrome.storage.local);
    registry = registryApi.createGameRegistry(storage);
    provider = registryApi.createGamePackProvider(registry);
    engine = translationApi.createTranslationEngine({
      providers: [provider],
      locale: "zh-CN"
    });
  } catch (error) {
    publishRuntimeStatus("error", "扩展初始化失败", [error?.message || String(error)]);
    return;
  }

  const APP_ATTRIBUTE = "data-alaxee-steamhub-app-id";
  const MAX_VISIBLE_ITEMS_PER_PASS = 80;
  const localizedTextNodes = new Map();
  let scanScheduled = false;
  const diagnostics = {
    version: "0.8.4",
    initializedAt: new Date().toISOString(),
    scanCount: 0,
    lastScanAt: null,
    detectedItems: 0,
    matchedItems: 0,
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

  function getPrimaryAppId() {
    const identity = globalThis.__ALAXEE_STEAMHUB_ITEM_IDENTITY__;
    const listing = identity?.parseMarketListingUrl(window.location.href);
    if (listing?.appId) return listing.appId;
    try {
      return identity?.normalizeAppId(new URL(window.location.href).searchParams.get("appid")) || null;
    } catch {
      return null;
    }
  }

  function preserveMarketNameSuffix(marketHashName, translation) {
    const source = String(marketHashName || "");
    const translated = String(translation || "").trimEnd();
    const suffixMatch = source.match(/((?:\s+\([^()]+\))*)(?:\s+([A-Z]))?$/);
    if (!suffixMatch) return translated;

    const parentheticalSuffix = suffixMatch[1] || "";
    const variantLetter = suffixMatch[2] || "";
    if (!parentheticalSuffix && !variantLetter) return translated;

    let result = translated;
    if (parentheticalSuffix && !result.includes(parentheticalSuffix.trim())) {
      result += parentheticalSuffix;
    }
    if (variantLetter && !new RegExp("(?:^|\\\\s)" + variantLetter + "$").test(result)) {
      result += " " + variantLetter;
    }
    return result;
  }

  function publishDiagnostics() {
    const connectedNodes = Array.from(localizedTextNodes.entries())
      .filter(([node]) => node.isConnected);
    const primaryAppId = diagnostics.primaryAppId;
    const currentNodes = primaryAppId
      ? connectedNodes.filter(([, record]) => record.appId === primaryAppId)
      : connectedNodes;
    diagnostics.translatedNames = currentNodes.filter(([, record]) => record.kind === "name").length;
    diagnostics.translatedDetailNodes = currentNodes.filter(([, record]) => record.kind === "detail").length;

    const primaryMissing = primaryAppId
      ? diagnostics.missingPacks.includes(primaryAppId)
      : diagnostics.missingPacks.length > 0;
    const primaryDisabled = primaryAppId
      ? diagnostics.disabledGames.includes(primaryAppId)
      : diagnostics.disabledGames.length > 0;
    const primaryErrors = diagnostics.errors.filter((entry) => !entry.appId || !primaryAppId || entry.appId === primaryAppId);
    const primaryUnmatched = diagnostics.unmatchedNames.filter((entry) => !primaryAppId || entry.appId === primaryAppId);
    const hasPrimaryTranslation = diagnostics.translatedNames > 0 || diagnostics.translatedDetailNodes > 0;

    let tone = "info";
    let title = "页面已检查，暂无可翻译内容";
    if (hasPrimaryTranslation) {
      tone = "success";
      title = "汉化已生效";
    } else if (primaryErrors.length) {
      tone = "error";
      title = "SteamHub 运行异常";
    } else if (primaryMissing) {
      tone = "warning";
      title = "未找到该商品所属游戏的本地词库";
    } else if (primaryDisabled) {
      tone = "warning";
      title = "该游戏的汉化已关闭";
    } else if (diagnostics.detectedItems === 0) {
      tone = "warning";
      title = "未识别到 Steam 市场商品";
    } else if (primaryUnmatched.length) {
      tone = "warning";
      title = "商品已识别，但词库没有命中";
    } else if (diagnostics.errors.length) {
      tone = "error";
      title = "部分关联商品处理异常";
    }

    const details = [
      "版本：0.8.4",
      "当前页面 AppID：" + (primaryAppId || "未识别"),
      "页面识别商品：" + diagnostics.detectedItems,
      "已命中词条：" + diagnostics.matchedItems,
      "当前游戏已替换名称节点：" + diagnostics.translatedNames,
      "当前游戏已替换详情节点：" + diagnostics.translatedDetailNodes
    ];
    const unrelatedMissing = diagnostics.missingPacks.filter((appId) => appId !== primaryAppId);
    const unrelatedDisabled = diagnostics.disabledGames.filter((appId) => appId !== primaryAppId);
    if (primaryMissing) details.push("当前游戏缺少本地词库：" + primaryAppId);
    if (unrelatedMissing.length) details.push("其他关联商品缺少词库（不影响当前商品）： " + unrelatedMissing.join("、"));
    if (primaryDisabled) details.push("当前游戏已关闭汉化：" + primaryAppId);
    if (unrelatedDisabled.length) details.push("其他关联商品已关闭汉化：" + unrelatedDisabled.join("、"));
    if (primaryUnmatched.length) {
      details.push("当前游戏未命中示例：" + primaryUnmatched.slice(0, 3).map((item) => item.marketHashName).join("；"));
    }
    if (primaryErrors.length) {
      details.push("当前商品处理错误：" + primaryErrors.slice(0, 3).map((item) => item.message).join("；"));
    } else if (diagnostics.errors.length) {
      details.push("其他关联商品错误：" + diagnostics.errors.slice(0, 3).map((item) => item.message).join("；"));
    }
    details.push("诊断时间：" + (diagnostics.lastScanAt || "等待首次扫描"));
    runtimeStatus?.update({ tone, title, details });
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
      diagnostics.matchedItems += 1;
      const safeTranslation = preserveMarketNameSuffix(item.marketHashName, result.record.translation);
      diagnostics.translatedNames += applyNameTranslation(item, safeTranslation);
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
    diagnostics.matchedItems = 0;
    diagnostics.primaryAppId = getPrimaryAppId();
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
    publishDiagnostics();
  }

  function scheduleScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    window.setTimeout(() => {
      scanScheduled = false;
      scanVisibleItems().catch((error) => {
        diagnostics.errors = [{ message: error?.message || String(error) }];
        publishDiagnostics();
      });
    }, 180);
  }

  const api = Object.freeze({
    version: "0.8.4",
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
    translateMarketName(marketHashName, translation) {
      return preserveMarketNameSuffix(marketHashName, translation);
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