(() => {
  "use strict";

  const storageApi = globalThis.__ALAXEE_STEAMHUB_STORAGE_ADAPTER__;
  const registryApi = globalThis.__ALAXEE_STEAMHUB_GAME_REGISTRY__;
  const publicPackLoaderApi = globalThis.__ALAXEE_STEAMHUB_PUBLIC_PACK_LOADER__;
  const sourceMapperApi = globalThis.__ALAXEE_STEAMHUB_SOURCE_RECORD_MAPPER__;
  const siteDiscoveryApi = globalThis.__ALAXEE_STEAMHUB_SITE_DISCOVERY__;
  const htmlTableParserApi = globalThis.__ALAXEE_STEAMHUB_HTML_TABLE_PARSER__;
  const statusNode = document.getElementById("status");
  const gameList = document.getElementById("game-list");
  const gameSelect = document.getElementById("entry-game");
  const manageGameSelect = document.getElementById("manage-game");
  const entryList = document.getElementById("entry-list");
  const entrySearch = document.getElementById("entry-search");
  const pageInfo = document.getElementById("entry-page-info");
  const previousPageButton = document.getElementById("entry-prev");
  const nextPageButton = document.getElementById("entry-next");
  const entryForm = document.getElementById("add-entry-form");
  const submitEntryButton = entryForm.querySelector('button[type="submit"]');
  const cancelEditButton = document.getElementById("cancel-entry-edit");
  const PAGE_SIZE = 30;

  let cachedPacks = [];
  let currentPage = 0;
  let editingIdentity = null;
  let extractedHtmlTables = [];
  let extractedHtmlPage = null;
  let discoveredSite = null;

  if (!storageApi || !registryApi || !publicPackLoaderApi || !sourceMapperApi || !siteDiscoveryApi || !htmlTableParserApi || typeof chrome === "undefined" || !chrome.storage?.local) {
    statusNode.textContent = "扩展存储不可用";
    return;
  }

  const storage = storageApi.createChromeStorageAdapter(chrome.storage.local);
  const registry = registryApi.createGameRegistry(storage);

  function report(message, isError = false) {
    statusNode.textContent = message;
    statusNode.style.color = isError ? "#f0a6b0" : "";
  }

  function createButton(label, className, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className || "";
    button.textContent = label;
    button.addEventListener("click", handler);
    return button;
  }

  function downloadJson(filename, value) {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function resetEntryForm() {
    const selectedAppId = gameSelect.value;
    editingIdentity = null;
    document.getElementById("entry-market-name").value = "";
    document.getElementById("entry-source-id").value = "";
    document.getElementById("entry-source").value = "";
    document.getElementById("entry-locale").value = "zh-CN";
    document.getElementById("entry-translation").value = "";
    submitEntryButton.textContent = "保存词条";
    cancelEditButton.hidden = true;
    if (selectedAppId) gameSelect.value = selectedAppId;
  }

  function startEditing(appId, entry) {
    editingIdentity = {
      appId,
      marketHashName: entry.marketHashName,
      locale: entry.locale
    };
    gameSelect.value = appId;
    document.getElementById("entry-market-name").value = entry.marketHashName;
    document.getElementById("entry-source-id").value = entry.sourceItemId || "";
    document.getElementById("entry-source").value = entry.source || "";
    const localeSelect = document.getElementById("entry-locale");
    if (!Array.from(localeSelect.options).some((option) => option.value === entry.locale)) {
      const localeOption = document.createElement("option");
      localeOption.value = entry.locale;
      localeOption.textContent = entry.locale;
      localeSelect.append(localeOption);
    }
    localeSelect.value = entry.locale;
    document.getElementById("entry-translation").value = entry.translation;
    submitEntryButton.textContent = "保存修改";
    cancelEditButton.hidden = false;
    entryForm.scrollIntoView?.({ block: "center" });
    document.getElementById("entry-translation").focus();
    report("正在编辑：" + entry.marketHashName);
  }

  function renderGames(packs) {
    const selectedEntryGame = gameSelect.value;
    const selectedManageGame = manageGameSelect.value;
    gameList.replaceChildren();
    gameSelect.replaceChildren();
    manageGameSelect.replaceChildren();

    const entryPlaceholder = document.createElement("option");
    entryPlaceholder.value = "";
    entryPlaceholder.textContent = packs.length ? "选择游戏" : "先添加游戏";
    gameSelect.append(entryPlaceholder);

    const managePlaceholder = document.createElement("option");
    managePlaceholder.value = "";
    managePlaceholder.textContent = packs.length ? "选择要管理的游戏" : "暂无游戏";
    manageGameSelect.append(managePlaceholder);

    for (const pack of packs) {
      const option = document.createElement("option");
      option.value = pack.game.appId;
      option.textContent = pack.game.name + " · " + pack.game.appId;
      gameSelect.append(option);

      const manageOption = document.createElement("option");
      manageOption.value = pack.game.appId;
      manageOption.textContent = pack.game.name + " · " + pack.game.appId;
      manageGameSelect.append(manageOption);

      const card = document.createElement("article");
      card.className = "game-card";

      const info = document.createElement("div");
      info.className = "game-info";
      const name = document.createElement("p");
      name.className = "game-name";
      name.textContent = pack.game.name;
      const meta = document.createElement("p");
      meta.className = "game-meta";
      meta.textContent = "AppID " + pack.game.appId + " · " +
        pack.translations.length + " 条词条 · " + pack.game.adapter;
      info.append(name, meta);

      const actions = document.createElement("div");
      actions.className = "game-actions";

      const toggleLabel = document.createElement("label");
      toggleLabel.className = "toggle";
      const toggle = document.createElement("input");
      toggle.type = "checkbox";
      toggle.checked = pack.game.enabled;
      toggle.addEventListener("change", async () => {
        try {
          await registry.setEnabled(pack.game.appId, toggle.checked);
          report(toggle.checked ? "已启用该游戏" : "已停用该游戏");
          await refresh();
        } catch (error) {
          report(error.message, true);
          toggle.checked = !toggle.checked;
        }
      });
      toggleLabel.append(toggle, document.createTextNode("启用"));

      actions.append(
        createButton("导出", "", async () => {
          try {
            const exported = await registry.exportPack(pack.game.appId);
            downloadJson("steamhub-game-" + pack.game.appId + ".json", exported);
            report("已导出 " + pack.game.name);
          } catch (error) { report(error.message, true); }
        }),
        createButton("删除", "danger", async () => {
          if (!window.confirm("删除“" + pack.game.name + "”及其本地翻译词库？此操作不可撤销。")) return;
          try {
            await registry.remove(pack.game.appId);
            if (editingIdentity?.appId === pack.game.appId) resetEntryForm();
            await refresh();
            report("已删除 " + pack.game.name);
          } catch (error) { report(error.message, true); }
        })
      );
      card.append(info, toggleLabel, actions);
      gameList.append(card);
    }

    if (!packs.length) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "还没有游戏配置。先添加 AppID，再录入词条或导入该游戏的数据包。";
      gameList.append(empty);
    }

    if (packs.some((pack) => pack.game.appId === selectedEntryGame)) {
      gameSelect.value = selectedEntryGame;
    }
    if (packs.some((pack) => pack.game.appId === selectedManageGame)) {
      manageGameSelect.value = selectedManageGame;
    } else if (packs.length) {
      manageGameSelect.value = packs[0].game.appId;
    }
  }

  function renderDictionary(packs = cachedPacks) {
    const appId = manageGameSelect.value;
    const pack = packs.find((candidate) => candidate.game.appId === appId);
    entryList.replaceChildren();

    if (!pack) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "选择一款游戏，查看和管理它的独立词库。";
      entryList.append(empty);
      pageInfo.textContent = "0 条词条";
      previousPageButton.disabled = true;
      nextPageButton.disabled = true;
      return;
    }

    const term = entrySearch.value.trim().toLocaleLowerCase();
    const entries = pack.translations
      .filter((entry) => {
        if (!term) return true;
        return [
          entry.marketHashName,
          entry.translation,
          entry.locale,
          entry.sourceItemId || "",
          entry.source || ""
        ].some((value) => value.toLocaleLowerCase().includes(term));
      })
      .sort((a, b) =>
        a.marketHashName.localeCompare(b.marketHashName) ||
        a.locale.localeCompare(b.locale)
      );

    const pageCount = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
    currentPage = Math.min(currentPage, pageCount - 1);
    const pageEntries = entries.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = pack.translations.length
        ? "没有匹配的词条。请调整搜索关键词。"
        : "这款游戏还没有词条。可在上方录入，或导入 JSON 数据包。";
      entryList.append(empty);
    }

    for (const entry of pageEntries) {
      const row = document.createElement("article");
      row.className = "translation-row";

      const info = document.createElement("div");
      info.className = "translation-info";
      const marketName = document.createElement("p");
      marketName.className = "translation-market-name";
      marketName.textContent = entry.marketHashName;
      const translatedName = document.createElement("p");
      translatedName.className = "translation-value";
      translatedName.textContent = entry.translation;
      const metadata = document.createElement("p");
      metadata.className = "translation-meta";
      metadata.textContent = entry.locale + " · 来源：" + (entry.source || "manual") +
        (entry.sourceItemId ? " · 来源 ID：" + entry.sourceItemId : "");
      info.append(marketName, translatedName, metadata);

      const actions = document.createElement("div");
      actions.className = "translation-actions";
      actions.append(
        createButton("编辑", "", () => startEditing(pack.game.appId, entry)),
        createButton("删除", "danger", async () => {
          if (!window.confirm(
            "确定删除“" + entry.marketHashName + "”的 " + entry.locale + " 翻译？此操作不可撤销。"
          )) return;
          try {
            await registry.removeTranslation(pack.game.appId, {
              marketHashName: entry.marketHashName,
              locale: entry.locale
            });
            if (editingIdentity?.appId === pack.game.appId &&
                editingIdentity.marketHashName === entry.marketHashName &&
                editingIdentity.locale === entry.locale) {
              resetEntryForm();
            }
            await refresh();
            report("已删除词条：" + entry.marketHashName);
          } catch (error) { report(error.message, true); }
        })
      );
      row.append(info, actions);
      entryList.append(row);
    }

    const start = entries.length ? currentPage * PAGE_SIZE + 1 : 0;
    const end = Math.min((currentPage + 1) * PAGE_SIZE, entries.length);
    pageInfo.textContent = start + "–" + end + " / " + entries.length + " 条词条";
    previousPageButton.disabled = currentPage <= 0;
    nextPageButton.disabled = currentPage >= pageCount - 1;
  }

  function updateHtmlReferenceTarget() {
    const appId = document.getElementById("html-reference-game").value;
    const pack = cachedPacks.find((candidate) => candidate.game.appId === appId);
    if (!pack) return;
    document.getElementById("html-app-id").value = pack.game.appId;
    document.getElementById("html-game-name").value = pack.game.name;
  }

  function renderHtmlReferenceGames() {
    const selector = document.getElementById("html-reference-game");
    const previous = selector.value;
    const eligible = cachedPacks.map((pack) => ({
      pack,
      ids: new Set(pack.translations
        .filter((entry) => entry.sourceItemId)
        .map((entry) => entry.sourceItemId))
    })).filter((item) => item.ids.size > 0);

    selector.replaceChildren();
    if (!eligible.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "尚无带来源 ID 的参考词库；先导入 Steam 目录";
      selector.append(option);
      selector.disabled = true;
      return;
    }

    for (const item of eligible) {
      const option = document.createElement("option");
      option.value = item.pack.game.appId;
      option.textContent = item.pack.game.name + " · AppID " + item.pack.game.appId +
        " · " + item.ids.size + " 个可反查 ID";
      selector.append(option);
    }
    selector.disabled = false;
    selector.value = eligible.some((item) => item.pack.game.appId === previous)
      ? previous
      : eligible.find((item) => item.pack.game.appId === "3678970")?.pack.game.appId ||
        eligible[0].pack.game.appId;
    updateHtmlReferenceTarget();
  }

  function updateHtmlMappingMode() {
    const sourceIdMode = document.getElementById("html-mapping-mode").value === "source-id";
    const referenceWrap = document.getElementById("html-reference-game-wrap");
    const keyLabel = document.getElementById("html-key-field-label");
    const sourceIdWrap = document.getElementById("html-source-id-field-wrap");
    const appIdWrap = document.getElementById("html-app-id-wrap");
    const gameNameWrap = document.getElementById("html-game-name-wrap");
    referenceWrap.hidden = !sourceIdMode;
    sourceIdWrap.hidden = sourceIdMode;
    appIdWrap.hidden = sourceIdMode;
    gameNameWrap.hidden = sourceIdMode;
    keyLabel.firstChild.textContent = sourceIdMode ? "游戏内部 ItemKey / ID 列" : "Steam market_hash_name 列";
    document.getElementById("html-app-id").disabled = sourceIdMode;
    document.getElementById("html-game-name").disabled = sourceIdMode;
    if (sourceIdMode) updateHtmlReferenceTarget();
  }

  async function refresh() {
    cachedPacks = await registry.list();
    renderGames(cachedPacks);
    renderDictionary(cachedPacks);
    renderHtmlReferenceGames();
    updateHtmlMappingMode();
  }

  document.getElementById("add-game-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const appId = document.getElementById("game-app-id").value;
    const name = document.getElementById("game-name").value;
    try {
      await registry.addGame({ appId, name });
      document.getElementById("add-game-form").reset();
      await refresh();
      gameSelect.value = appId.trim();
      report("已添加游戏：" + name.trim());
    } catch (error) { report(error.message, true); }
  });

  entryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const appId = gameSelect.value;
    if (!appId) {
      report("请先选择游戏", true);
      return;
    }

    if (editingIdentity && editingIdentity.appId !== appId) {
      report("编辑中的词条属于另一款游戏，请取消编辑后再切换游戏", true);
      return;
    }

    const input = {
      marketHashName: document.getElementById("entry-market-name").value,
      sourceItemId: document.getElementById("entry-source-id").value,
      source: document.getElementById("entry-source").value,
      locale: document.getElementById("entry-locale").value,
      translation: document.getElementById("entry-translation").value
    };

    try {
      if (editingIdentity) {
        await registry.updateTranslation(appId, editingIdentity, input);
        report("词条修改已保存");
      } else {
        const updated = await registry.upsertTranslation(appId, input);
        report("词条已保存，当前游戏共 " + updated.translations.length + " 条");
      }

      resetEntryForm();
      currentPage = 0;
      await refresh();
      gameSelect.value = appId;
      manageGameSelect.value = appId;
      renderDictionary();
    } catch (error) { report(error.message, true); }
  });

  cancelEditButton.addEventListener("click", () => {
    resetEntryForm();
    report("已取消词条编辑");
  });

  gameSelect.addEventListener("change", () => {
    if (editingIdentity && editingIdentity.appId !== gameSelect.value) {
      resetEntryForm();
      report("已取消跨游戏编辑");
    }
  });

  manageGameSelect.addEventListener("change", () => {
    currentPage = 0;
    renderDictionary();
  });

  entrySearch.addEventListener("input", () => {
    currentPage = 0;
    renderDictionary();
  });

  previousPageButton.addEventListener("click", () => {
    currentPage = Math.max(0, currentPage - 1);
    renderDictionary();
  });

  nextPageButton.addEventListener("click", () => {
    currentPage += 1;
    renderDictionary();
  });

  document.getElementById("load-pack-url").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const urlInput = document.getElementById("pack-url");
    const rawUrl = urlInput.value.trim();
    if (!rawUrl) {
      report("请先粘贴公开 JSON 数据包 URL", true);
      return;
    }

    button.disabled = true;
    try {
      const loaded = await publicPackLoaderApi.fetchGamePackFromUrl(rawUrl, {
        requestPermission: (originPattern) => chrome.permissions.request({ origins: [originPattern] }),
        normalizePack: (parsed) => registryApi.normalizePack(parsed)
      });
      document.getElementById("pack-json").value = JSON.stringify(loaded.pack, null, 2);
      report("已读取公开数据包：" + loaded.pack.game.name + " · " +
        loaded.pack.translations.length + " 条；请选择合并或覆盖后再导入");
    } catch (error) {
      report(error.message || "读取远程数据包失败", true);
    } finally {
      button.disabled = false;
    }
  });

  document.getElementById("analyze-site").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const rawUrl = document.getElementById("site-index-url").value.trim();
    const summary = document.getElementById("site-discovery-summary");
    const list = document.getElementById("site-discovery-pages");
    if (!rawUrl) {
      report("请先粘贴 Wiki 或网站入口 URL", true);
      return;
    }

    button.disabled = true;
    list.replaceChildren();
    discoveredSite = null;
    extractedHtmlTables = [];
    extractedHtmlPage = null;
    try {
      const result = await siteDiscoveryApi.discoverSiteMap(rawUrl, {
        validatePublicHttpsUrl: (value) => publicPackLoaderApi.validatePublicHttpsUrl(value),
        requestPermission: (originPattern) => chrome.permissions.request({ origins: [originPattern] }),
        fetchText: (url) => publicPackLoaderApi.fetchPublicTextFromUrl(url, {
          requestPermission: () => Promise.resolve(true),
          maxBytes: 1024 * 1024,
          timeoutMs: 10000
        })
      });

      discoveredSite = result;
      summary.textContent = "站点：" + result.origin +
        " · sitemap：" + result.sitemaps.length +
        " · 同域页面：" + result.urls.length +
        " · robots 拦截：" + result.blockedByRobots +
        (result.truncated ? " · 已达到预览上限" : "") +
        (result.robotsAvailable ? "" : " · 未读取到 robots.txt");
      for (const url of result.urls.slice(0, 30)) {
        const item = document.createElement("li");
        const link = document.createElement("a");
        link.href = url;
        link.target = "_blank";
        link.rel = "noreferrer";
        link.textContent = url;
        const choose = createButton("选作解析页面", "quiet", () => {
          document.getElementById("html-page-url").value = url;
          report("已选择页面；点击“读取并分析表格”后才会下载该页面");
        });
        item.append(link, choose);
        list.append(item);
      }
      if (result.urls.length > 30) {
        const more = document.createElement("li");
        more.textContent = "另有 " + (result.urls.length - 30) + " 个页面未显示";
        list.append(more);
      }
      if (result.errors.length) {
        summary.textContent += " · sitemap 错误：" + result.errors.length;
      }
      report("站点页面目录已分析；这一步没有抓取页面正文");
    } catch (error) {
      summary.textContent = "";
      report(error.message || "站点发现失败", true);
    } finally {
      button.disabled = false;
    }
  });

  function selectedHtmlTable() {
    const selector = document.getElementById("html-table-select");
    const index = Number(selector.value);
    return Number.isInteger(index) ? extractedHtmlTables.find((table) => table.index === index) || null : null;
  }

  function populateHtmlColumnSelect(selectId, headers, placeholder, includeEmpty = false) {
    const select = document.getElementById(selectId);
    select.replaceChildren();
    const first = document.createElement("option");
    first.value = "";
    first.textContent = placeholder;
    select.append(first);
    if (includeEmpty) {
      const empty = document.createElement("option");
      empty.value = "__none__";
      empty.textContent = "不记录来源 ID";
      select.append(empty);
    }
    for (const header of headers) {
      const option = document.createElement("option");
      option.value = header.key;
      option.textContent = header.label + " · " + header.key;
      select.append(option);
    }
    select.disabled = headers.length === 0;
  }

  function renderSelectedHtmlTable() {
    const table = selectedHtmlTable();
    const preview = document.getElementById("html-table-preview");
    const convertButton = document.getElementById("convert-html-table");
    preview.replaceChildren();
    if (!table) {
      preview.append(Object.assign(document.createElement("p"), {
        className: "empty",
        textContent: "当前页面没有可预览的结构化表格。"
      }));
      convertButton.disabled = true;
      return;
    }

    const sample = document.createElement("table");
    sample.className = "html-preview-grid";
    const head = document.createElement("thead");
    const headerRow = document.createElement("tr");
    for (const header of table.headers) {
      const cell = document.createElement("th");
      cell.textContent = header.label;
      headerRow.append(cell);
    }
    head.append(headerRow);
    sample.append(head);
    const body = document.createElement("tbody");
    for (const record of table.records.slice(0, 5)) {
      const row = document.createElement("tr");
      for (const header of table.headers) {
        const cell = document.createElement("td");
        cell.textContent = record[header.key] || "";
        row.append(cell);
      }
      body.append(row);
    }
    sample.append(body);
    preview.append(sample);

    populateHtmlColumnSelect("html-market-field", table.headers, "选择 Steam 原始键列");
    populateHtmlColumnSelect("html-translation-field", table.headers, "选择译文列");
    populateHtmlColumnSelect("html-source-id-field", table.headers, "选择来源 ID 列", true);
    convertButton.disabled = false;
  }

  document.getElementById("html-mapping-mode").addEventListener("change", updateHtmlMappingMode);
  document.getElementById("html-reference-game").addEventListener("change", updateHtmlReferenceTarget);
  document.getElementById("html-table-select").addEventListener("change", renderSelectedHtmlTable);

  document.getElementById("extract-html-page").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const rawUrl = document.getElementById("html-page-url").value.trim();
    const summary = document.getElementById("html-page-summary");
    if (!rawUrl) {
      report("请先从站点目录选择或粘贴一个 HTML 页面 URL", true);
      return;
    }

    button.disabled = true;
    extractedHtmlTables = [];
    extractedHtmlPage = null;
    document.getElementById("html-table-select").replaceChildren();
    document.getElementById("html-table-select").disabled = true;
    document.getElementById("html-table-preview").replaceChildren();
    document.getElementById("convert-html-table").disabled = true;
    try {
      const pageUrl = publicPackLoaderApi.validatePublicHttpsUrl(rawUrl);
      if (!discoveredSite) {
        throw new Error("请先分析站点目录，以读取并应用同站 robots.txt 规则");
      }
      if (discoveredSite.origin !== pageUrl.origin) {
        throw new Error("页面必须与已分析的 Wiki / 网站入口保持同源");
      }
      if (discoveredSite.robotsError && !/\bHTTP 404\b/.test(discoveredSite.robotsError)) {
        throw new Error("未能可靠读取 robots.txt，已停止页面读取：" + discoveredSite.robotsError);
      }
      if (!siteDiscoveryApi.isRobotsAllowed(pageUrl, discoveredSite.robots)) {
        throw new Error("robots.txt 禁止读取该页面，已停止");
      }

      const loaded = await publicPackLoaderApi.fetchPublicTextFromUrl(pageUrl.href, {
        requestPermission: (originPattern) => chrome.permissions.request({ origins: [originPattern] }),
        maxBytes: 1024 * 1024,
        timeoutMs: 10000
      });
      const result = htmlTableParserApi.parseHtmlTables(loaded.text, {
        pageUrl: loaded.sourceUrl,
        maxTables: 20,
        maxRowsPerTable: 500
      });
      extractedHtmlTables = result.tables;
      extractedHtmlPage = result;
      const selector = document.getElementById("html-table-select");
      if (!result.tables.length) {
        selector.append(Object.assign(document.createElement("option"), {
          value: "",
          textContent: "没有识别到可映射的数据表格"
        }));
      } else {
        for (const table of result.tables) {
          const option = document.createElement("option");
          option.value = String(table.index);
          option.textContent = (table.caption || table.ariaLabel || ("表格 " + (table.index + 1))) +
            " · " + table.rowCount + " 行 · " + table.headers.length + " 列";
          selector.append(option);
        }
        selector.value = String(result.tables[0].index);
      }
      selector.disabled = !result.tables.length;
      summary.textContent = (result.pageTitle ? result.pageTitle + " · " : "") +
        "识别 " + result.tables.length + " 张可映射表格 · 跳过 " + result.skippedTables +
        " 张无表头 / 不支持跨行列的表格" +
        (result.truncatedTables ? " · 表格数量已截断至 20 张" : "");
      renderSelectedHtmlTable();
      report(result.tables.length
        ? "页面表格已提取；请检查预览并手动映射字段"
        : "页面读取完成，但未发现可映射表格", !result.tables.length);
    } catch (error) {
      summary.textContent = "";
      report(error.message || "HTML 页面提取失败", true);
    } finally {
      button.disabled = false;
    }
  });

  document.getElementById("convert-html-table").addEventListener("click", () => {
    const summary = document.getElementById("html-conversion-summary");
    try {
      const table = selectedHtmlTable();
      if (!table || !extractedHtmlPage) throw new Error("请先读取并选择一张页面表格");
      const marketField = document.getElementById("html-market-field").value;
      const translationField = document.getElementById("html-translation-field").value;
      const sourceIdMode = document.getElementById("html-mapping-mode").value === "source-id";
      if (!marketField || !translationField || marketField === translationField) {
        throw new Error("请选择不同的 ID / Steam 市场键列和译文列");
      }
      const locale = document.getElementById("html-locale").value;
      const source = document.getElementById("html-source-label").value.trim() || "wiki-html";
      let mapped;
      if (sourceIdMode) {
        const referencePack = cachedPacks.find((candidate) =>
          candidate.game.appId === document.getElementById("html-reference-game").value
        );
        if (!referencePack) throw new Error("请先导入并选择带来源 ID 的 Steam 参考词库");
        mapped = sourceMapperApi.buildGamePackFromSourceIds(table.records, {
          referencePack,
          locale,
          fields: { sourceItemId: marketField, translation: translationField },
          source
        });
      } else {
        const sourceIdField = document.getElementById("html-source-id-field").value;
        mapped = sourceMapperApi.buildGamePackFromRecords(table.records, {
          game: {
            appId: document.getElementById("html-app-id").value.trim(),
            name: document.getElementById("html-game-name").value.trim(),
            adapter: "steam-community-market",
            itemKey: "market_hash_name"
          },
          locale,
          fields: {
            marketHashName: marketField,
            translation: translationField,
            sourceItemId: sourceIdField && sourceIdField !== "__none__" ? sourceIdField : ""
          },
          source
        });
      }
      const validated = registryApi.normalizePack(mapped.pack);
      document.getElementById("pack-json").value = JSON.stringify(validated, null, 2);
      const stats = mapped.stats;
      summary.textContent = "页面 " + new URL(extractedHtmlPage.pageUrl).pathname +
        " · 扫描 " + stats.scanned + " 行 · 生成 " + stats.imported +
        " 条 · 重复 " + stats.duplicateRows + " · 冲突 " + stats.conflictingKeys +
        (sourceIdMode
          ? " · 未匹配 ID " + stats.unmatchedSourceId + " · 歧义 ID " + stats.ambiguousSourceId +
            " · 缺 ID " + stats.missingSourceId + " · 缺译文 " + stats.missingTranslation
          : " · 缺键 " + stats.missingMarketKey + " · 缺译文 " + stats.missingTranslation);
      report(sourceIdMode ? "Wiki ID 已按参考目录精确反查；请检查生成的 JSON" : "HTML 表格已转换；请检查生成的 JSON，并选择合并或覆盖");
    } catch (error) {
      summary.textContent = "";
      report(error.message || "HTML 表格转换失败", true);
    }
  });

  document.getElementById("load-source-url").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const rawUrl = document.getElementById("source-url").value.trim();
    if (!rawUrl) {
      report("请先粘贴 JSON / CSV 数据源 URL", true);
      return;
    }
    button.disabled = true;
    try {
      const loaded = await publicPackLoaderApi.fetchPublicTextFromUrl(rawUrl, {
        requestPermission: (originPattern) => chrome.permissions.request({ origins: [originPattern] })
      });
      document.getElementById("source-data").value = loaded.text;
      const pathname = new URL(loaded.sourceUrl).pathname.toLowerCase();
      if (pathname.endsWith(".csv")) {
        document.getElementById("source-format").value = "csv";
      } else {
        document.getElementById("source-format").value = "json";
      }
      report("已读取公开来源：" + loaded.byteLength.toLocaleString() + " 字节；请配置字段并转换");
    } catch (error) {
      report(error.message || "读取公开来源失败", true);
    } finally {
      button.disabled = false;
    }
  });

  document.getElementById("source-file").addEventListener("change", async (event) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("来源文件超过 5 MiB 上限");
      }
      document.getElementById("source-data").value = await file.text();
      document.getElementById("source-format").value = file.name.toLowerCase().endsWith(".csv") ? "csv" : "json";
      report("已读取来源文件：" + file.name);
    } catch (error) {
      report(error.message || "读取来源文件失败", true);
    } finally {
      event.currentTarget.value = "";
    }
  });

  document.getElementById("convert-source").addEventListener("click", () => {
    const summary = document.getElementById("source-conversion-summary");
    try {
      const raw = document.getElementById("source-data").value;
      if (!raw.trim()) throw new Error("请先读取或粘贴来源数据");
      const format = document.getElementById("source-format").value;
      const records = format === "csv"
        ? sourceMapperApi.parseCsv(raw)
        : sourceMapperApi.parseJsonRecords(JSON.parse(raw), document.getElementById("source-record-path").value.trim());

      const mapped = sourceMapperApi.buildGamePackFromRecords(records, {
        game: {
          appId: document.getElementById("source-app-id").value.trim(),
          name: document.getElementById("source-game-name").value.trim(),
          adapter: "steam-community-market",
          itemKey: "market_hash_name"
        },
        locale: document.getElementById("source-locale").value,
        fields: {
          marketHashName: document.getElementById("source-market-field").value.trim(),
          translation: document.getElementById("source-translation-field").value.trim(),
          sourceItemId: document.getElementById("source-id-field").value.trim()
        },
        source: document.getElementById("source-label").value.trim()
      });
      const validated = registryApi.normalizePack(mapped.pack);
      document.getElementById("pack-json").value = JSON.stringify(validated, null, 2);
      const stats = mapped.stats;
      summary.textContent = "扫描 " + stats.scanned + " 条 · 生成 " + stats.imported +
        " 条 · 重复 " + stats.duplicateRows + " · 冲突 " + stats.conflictingKeys +
        " · 缺键 " + stats.missingMarketKey + " · 缺译文 " + stats.missingTranslation;
      report("已生成数据包，请检查内容并选择合并或覆盖");
    } catch (error) {
      summary.textContent = "";
      report(error.message || "来源转换失败", true);
    }
  });

  document.getElementById("pack-file").addEventListener("change", async (event) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      document.getElementById("pack-json").value = await file.text();
      report("已读取数据包文件：" + file.name);
    } catch (error) {
      report("读取文件失败：" + error.message, true);
    } finally {
      event.currentTarget.value = "";
    }
  });

  document.getElementById("import-pack").addEventListener("click", async () => {
    const raw = document.getElementById("pack-json").value.trim();
    if (!raw) {
      report("请先选择或粘贴游戏数据包 JSON", true);
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      const mode = document.getElementById("import-mode").value;
      const validated = registryApi.normalizePack(parsed);
      const existing = await registry.get(validated.game.appId);
      if (mode === "replace" && existing) {
        const accepted = window.confirm(
          "将覆盖 " + existing.game.name + "（AppID " + validated.game.appId +
          "）的全部本地词条，不能自动恢复。建议先导出备份。继续吗？"
        );
        if (!accepted) {
          report("已取消覆盖导入");
          return;
        }
      }

      const imported = await registry.importPack(validated, { mode });
      currentPage = 0;
      await refresh();
      gameSelect.value = imported.game.appId;
      manageGameSelect.value = imported.game.appId;
      renderDictionary();
      report("已导入 " + imported.game.name + "：共 " + imported.translations.length + " 条词条");
    } catch (error) {
      report(error.message || "数据包导入失败", true);
    }
  });

  document.getElementById("refresh-games").addEventListener("click", () => {
    refresh().then(() => report("游戏列表已刷新")).catch((error) => report(error.message, true));
  });

  refresh().then(() => report("本地游戏配置已加载"))
    .catch((error) => report(error.message, true));
})();
