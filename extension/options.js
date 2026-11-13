(() => {
  "use strict";

  const storageApi = globalThis.__ALAXEE_STEAMHUB_STORAGE_ADAPTER__;
  const registryApi = globalThis.__ALAXEE_STEAMHUB_GAME_REGISTRY__;
  const statusNode = document.getElementById("status");
  const gameList = document.getElementById("game-list");
  const gameSelect = document.getElementById("entry-game");

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

  function renderGames(packs) {
    gameList.replaceChildren();
    gameSelect.replaceChildren();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = packs.length ? "选择游戏" : "先添加游戏";
    gameSelect.append(placeholder);

    for (const pack of packs) {
      const option = document.createElement("option");
      option.value = pack.game.appId;
      option.textContent = pack.game.name + " · " + pack.game.appId;
      gameSelect.append(option);

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
  }

  async function refresh() {
    renderGames(await registry.list());
  }

  document.getElementById("add-game-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const appId = document.getElementById("game-app-id").value;
    const name = document.getElementById("game-name").value;
    try {
      await registry.addGame({ appId, name });
      document.getElementById("add-game-form").reset();
      await refresh();
      gameSelect.value = String(Number(appId));
      report("已添加游戏：" + name.trim());
    } catch (error) { report(error.message, true); }
  });

  document.getElementById("add-entry-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const appId = gameSelect.value;
    if (!appId) {
      report("请先选择游戏", true);
      return;
    }

    const marketHashName = document.getElementById("entry-market-name").value;
    const locale = document.getElementById("entry-locale").value;
    const translation = document.getElementById("entry-translation").value;
    try {
      const updated = await registry.upsertTranslation(appId, {
        marketHashName,
        locale,
        translation,
        source: "manual"
      });
      document.getElementById("entry-market-name").value = "";
      document.getElementById("entry-translation").value = "";
      await refresh();
      gameSelect.value = appId;
      report("词条已保存，当前游戏共 " + updated.translations.length + " 条");
    } catch (error) { report(error.message, true); }
  });

  document.getElementById("import-pack").addEventListener("click", async () => {
    const raw = document.getElementById("pack-json").value.trim();
    if (!raw) {
      report("请先粘贴游戏数据包 JSON", true);
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
      await refresh();
      gameSelect.value = imported.game.appId;
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
