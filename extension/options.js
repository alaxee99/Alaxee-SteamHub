(() => {
  "use strict";

  const storageApi = globalThis.__ALAXEE_STEAMHUB_STORAGE_ADAPTER__;
  const registryApi = globalThis.__ALAXEE_STEAMHUB_GAME_REGISTRY__;
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

  if (!storageApi || !registryApi || typeof chrome === "undefined" || !chrome.storage?.local) {
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

  async function refresh() {
    cachedPacks = await registry.list();
    renderGames(cachedPacks);
    renderDictionary(cachedPacks);
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

    let sourceUrl;
    try {
      sourceUrl = new URL(rawUrl);
    } catch {
      report("URL 格式无效", true);
      return;
    }

    const hostname = sourceUrl.hostname.toLowerCase();
    const privateIPv4 = /^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2[0-9]|3[01])\.|0\.)/;
    if (sourceUrl.protocol !== "https:" || sourceUrl.username || sourceUrl.password ||
        (sourceUrl.port && sourceUrl.port !== "443") ||
        hostname === "localhost" || hostname.endsWith(".localhost") ||
        hostname.endsWith(".local") || privateIPv4.test(hostname) ||
        hostname === "[::1]" || hostname.startsWith("fc") || hostname.startsWith("fd") ||
        hostname.startsWith("fe80:")) {
      report("仅允许公开 HTTPS 地址；不支持本机、局域网或带凭据的 URL", true);
      return;
    }

    sourceUrl.hash = "";
    const permissionPattern = sourceUrl.origin + "/*";
    const maximumBytes = 5 * 1024 * 1024;
    button.disabled = true;
    try {
      const granted = await chrome.permissions.request({ origins: [permissionPattern] });
      if (!granted) {
        throw new Error("未获准访问该站点，未读取数据");
      }

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 20000);
      let response;
      try {
        response = await fetch(sourceUrl.href, {
          method: "GET",
          credentials: "omit",
          cache: "no-store",
          redirect: "error",
          referrerPolicy: "no-referrer",
          headers: { Accept: "application/json, text/plain;q=0.9" },
          signal: controller.signal
        });
      } finally {
        window.clearTimeout(timeoutId);
      }

      if (!response.ok) {
        throw new Error("数据源返回 HTTP " + response.status);
      }
      if (response.url && new URL(response.url).origin !== sourceUrl.origin) {
        throw new Error("数据源发生跨站跳转，已停止读取");
      }
      const declaredLength = Number(response.headers.get("content-length") || 0);
      if (declaredLength > maximumBytes) {
        throw new Error("数据包超过 5 MiB 上限");
      }

      if (!response.body) {
        throw new Error("数据源没有返回可读取的内容");
      }
      const reader = response.body.getReader();
      const chunks = [];
      let totalBytes = 0;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        totalBytes += chunk.value.byteLength;
        if (totalBytes > maximumBytes) {
          controller.abort();
          await reader.cancel().catch(() => {});
          throw new Error("数据包超过 5 MiB 上限");
        }
        chunks.push(chunk.value);
      }
      const bytes = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      const raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.format !== "alaxee-steamhub-game-pack" || parsed.schemaVersion !== 1) {
        throw new Error("该 URL 返回的不是 SteamHub Game Pack v1。普通 Wiki 页面需要独立的站点解析适配器。");
      }

      const validated = registryApi.normalizePack(parsed);
      document.getElementById("pack-json").value = JSON.stringify(validated, null, 2);
      report("已读取公开数据包：" + validated.game.name + " · " + validated.translations.length + " 条；请选择合并或覆盖后再导入");
    } catch (error) {
      const message = error.name === "AbortError" ? "读取超时（20 秒）" : error.message;
      report(message || "读取远程数据包失败", true);
    } finally {
      button.disabled = false;
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
