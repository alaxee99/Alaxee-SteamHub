import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const extensionRoot = path.join(root, "extension");

async function loadModules(paths, extra = {}) {
  const context = vm.createContext({ URL, Set, Object, Map, Date, Number, String, Promise, Array, TypeError, Error, Math, ...extra });
  for (const relativePath of paths) {
    const source = await readFile(path.join(root, relativePath), "utf8");
    vm.runInContext(source, context, { filename: relativePath });
  }
  return context;
}

const coreFiles = [
  "extension/core/item-identity.js",
  "extension/core/translation-engine.js",
  "extension/core/game-registry.js",
  "extension/core/rate-limiter.js",
  "extension/storage-adapter.js",
  "extension/market-items.js"
];

test("market item identity preserves exact Steam AppID and market_hash_name", async () => {
  const context = await loadModules(coreFiles);
  const identity = context.__ALAXEE_STEAMHUB_ITEM_IDENTITY__;

  const parsed = identity.parseMarketListingUrl(
    "https://steamcommunity.com/market/listings/3678970/Vol%20Soulstone%20-%20Normal?query=x#history"
  );

  assert.equal(parsed.appId, "3678970");
  assert.equal(parsed.marketHashName, "Vol Soulstone - Normal");
  assert.equal(identity.createItemKey({
    appId: parsed.appId,
    marketHashName: parsed.marketHashName.toUpperCase()
  }).marketHashName, "VOL SOULSTONE - NORMAL");
  assert.notEqual(
    identity.createItemKey(parsed).cacheIdentity,
    identity.createItemKey({ ...parsed, marketHashName: parsed.marketHashName.toUpperCase() }).cacheIdentity
  );
});

test("market item parser rejects unsupported domains, protocols and malformed identities", async () => {
  const context = await loadModules(coreFiles);
  const identity = context.__ALAXEE_STEAMHUB_ITEM_IDENTITY__;

  assert.equal(identity.parseMarketListingUrl("http://steamcommunity.com/market/listings/730/item"), null);
  assert.equal(identity.parseMarketListingUrl("https://notsteamcommunity.com/market/listings/730/item"), null);
  assert.equal(identity.parseMarketListingUrl("https://store.steampowered.com/market/listings/730/item"), null);
  assert.equal(identity.parseMarketListingUrl("https://steamcommunity.com/market/listings/0/item"), null);
  assert.equal(identity.parseMarketListingUrl("https://steamcommunity.com/market/listings/730/%E0%A4%A"), null);
  assert.equal(identity.createItemKey({ appId: "abc", marketHashName: "Item" }), null);
  assert.equal(identity.createItemKey({ appId: "730", marketHashName: " Item" }), null);
  assert.equal(identity.createItemKey({ appId: "730", marketHashName: "Item\nName" }), null);
});

test("market-page scanning returns unique exact listing keys and skips hidden anchors", async () => {
  const context = await loadModules(coreFiles);
  const anchors = [
    {
      href: "https://steamcommunity.com/market/listings/3678970/Vol%20Soulstone%20-%20Normal",
      hidden: false,
      getAttribute: () => null,
      getClientRects: () => [1]
    },
    {
      href: "https://steamcommunity.com/market/listings/3678970/Vol%20Soulstone%20-%20Normal",
      hidden: false,
      getAttribute: () => null,
      getClientRects: () => [1]
    },
    {
      href: "https://steamcommunity.com/market/listings/730/AK-47%20%7C%20Redline",
      hidden: false,
      getAttribute: () => null,
      getClientRects: () => [1]
    },
    {
      href: "https://steamcommunity.com/market/listings/730/Hidden",
      hidden: true,
      getAttribute: () => null,
      getClientRects: () => [1]
    },
    {
      href: "https://example.com/market/listings/730/Ignore",
      hidden: false,
      getAttribute: () => null,
      getClientRects: () => [1]
    }
  ];
  const root = { querySelectorAll: () => anchors };
  const scanner = context.__ALAXEE_STEAMHUB_MARKET_ITEMS__;
  const result = scanner.collectMarketListingLinks(root, "https://steamcommunity.com/market/search?appid=3678970");

  assert.equal(result.length, 2);
  assert.deepEqual(result.map((item) => item.marketHashName), [
    "Vol Soulstone - Normal",
    "AK-47 | Redline"
  ]);
});

test("market item detail pages bind the current Steam item name element", async () => {
  const context = await loadModules(coreFiles);
  const scanner = context.__ALAXEE_STEAMHUB_MARKET_ITEMS__;
  const titleElement = { id: "largeiteminfo_item_name" };
  const root = {
    querySelector(selector) {
      if (selector === "#largeiteminfo_item_name") return titleElement;
      return null;
    },
    querySelectorAll() {
      return [];
    }
  };

  const result = scanner.collectMarketListingLinks(
    root,
    "https://steamcommunity.com/market/listings/3678970/Example%20Item"
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].appId, "3678970");
  assert.equal(result[0].marketHashName, "Example Item");
  assert.equal(result[0].element, titleElement);
});

test("translation engine accepts only one exact provider match and caches successful translations", async () => {
  const context = await loadModules(coreFiles);
  const engineApi = context.__ALAXEE_STEAMHUB_TRANSLATION_ENGINE__;
  const identity = context.__ALAXEE_STEAMHUB_ITEM_IDENTITY__;
  const data = new Map();
  const storage = {
    async get(key) { return data.get(key) ?? null; },
    async set(key, value) { data.set(key, value); },
    async delete(key) { data.delete(key); }
  };
  let calls = 0;
  let now = 1000;
  const cache = engineApi.createTranslationCache(storage, { ttlMs: 5000, now: () => now });
  const provider = {
    id: "test-provider",
    async lookup(request) {
      calls += 1;
      return {
        appId: request.appId,
        marketHashName: request.marketHashName,
        locale: request.locale,
        translation: "普通灵魂石",
        source: "test-provider"
      };
    }
  };
  const engine = engineApi.createTranslationEngine({ providers: [provider], cache, now: () => now });
  const item = identity.createItemKey({ appId: "3678970", marketHashName: "Vol Soulstone - Normal" });

  const first = await engine.resolve(item);
  assert.equal(first.status, "translated");
  assert.equal(first.record.translation, "普通灵魂石");
  assert.equal(first.source, "test-provider");

  const second = await engine.resolve(item);
  assert.equal(second.status, "translated");
  assert.equal(second.source, "cache");
  assert.equal(calls, 1);
});

test("translation engine refuses fuzzy, mismatched-locale and duplicate matches", async () => {
  const context = await loadModules(coreFiles);
  const identity = context.__ALAXEE_STEAMHUB_ITEM_IDENTITY__;
  const api = context.__ALAXEE_STEAMHUB_TRANSLATION_ENGINE__;
  const item = identity.createItemKey({ appId: "3678970", marketHashName: "Vol Soulstone - Normal" });

  const wrongKeyEngine = api.createTranslationEngine({
    providers: [{
      id: "wrong-key",
      async lookup() {
        return { appId: "3678970", marketHashName: "Vol Soulstone - Nightmare", locale: "zh-CN", translation: "错误译名" };
      }
    }]
  });
  assert.equal((await wrongKeyEngine.resolve(item)).status, "not-found");

  const wrongLocaleEngine = api.createTranslationEngine({
    providers: [{
      id: "wrong-locale",
      async lookup() {
        return { appId: "3678970", marketHashName: item.marketHashName, locale: "en-US", translation: "Wrong locale" };
      }
    }]
  });
  assert.equal((await wrongLocaleEngine.resolve(item)).status, "not-found");

  const duplicateEngine = api.createTranslationEngine({
    providers: [{
      id: "duplicate",
      async lookup() {
        return [
          { appId: "3678970", marketHashName: item.marketHashName, locale: "zh-CN", translation: "译名甲" },
          { appId: "3678970", marketHashName: item.marketHashName, locale: "zh-CN", translation: "译名乙" }
        ];
      }
    }]
  });
  assert.equal((await duplicateEngine.resolve(item)).status, "ambiguous");
});

test("provider failures are reported separately from verified no-match results", async () => {
  const context = await loadModules(coreFiles);
  const identity = context.__ALAXEE_STEAMHUB_ITEM_IDENTITY__;
  const api = context.__ALAXEE_STEAMHUB_TRANSLATION_ENGINE__;
  const item = identity.createItemKey({ appId: "3678970", marketHashName: "Vol Soulstone - Normal" });

  const unavailable = api.createTranslationEngine();
  assert.equal((await unavailable.resolve(item)).status, "unavailable");

  const failed = api.createTranslationEngine({
    providers: [{
      id: "offline-provider",
      async lookup() { throw new Error("network unavailable"); }
    }]
  });
  assert.equal((await failed.resolve(item)).status, "provider-error");
});

test("translation cache expires stale records and rejects writes under a different exact key", async () => {
  const context = await loadModules(coreFiles);
  const identity = context.__ALAXEE_STEAMHUB_ITEM_IDENTITY__;
  const api = context.__ALAXEE_STEAMHUB_TRANSLATION_ENGINE__;
  const data = new Map();
  const storage = {
    async get(key) { return data.get(key) ?? null; },
    async set(key, value) { data.set(key, value); },
    async delete(key) { data.delete(key); }
  };
  let now = 10;
  const cache = api.createTranslationCache(storage, { ttlMs: 20, now: () => now });
  const item = identity.createItemKey({ appId: "3678970", marketHashName: "Vol Soulstone - Normal" });

  await assert.rejects(
    cache.set(item, "zh-CN", {
      appId: "3678970",
      marketHashName: "Vol Soulstone - Nightmare",
      locale: "zh-CN",
      translation: "错误译名",
      source: "provider"
    }),
    /exact item-key/
  );

  await cache.set(item, "zh-CN", {
    appId: item.appId,
    marketHashName: item.marketHashName,
    locale: "zh-CN",
    translation: "普通灵魂石",
    source: "provider"
  });
  now = 31;
  assert.equal(await cache.get(item, "zh-CN"), null);
  assert.equal(data.size, 0);
});

test("rate-limited providers serialize concurrent lookups", async () => {
  const context = await loadModules(coreFiles);
  const api = context.__ALAXEE_STEAMHUB_RATE_LIMITER__;
  let now = 0;
  const provider = {
    id: "limited",
    async lookup() { return now; }
  };
  const limited = api.createRateLimitedProvider(provider, {
    minIntervalMs: 1000,
    now: () => now,
    sleep: async (ms) => { now += ms; }
  });

  const results = await Promise.all([
    limited.lookup({}),
    limited.lookup({}),
    limited.lookup({})
  ]);
  assert.deepEqual(results, [0, 1000, 2000]);
});


test("game registry keeps profiles and translations isolated by Steam AppID", async () => {
  const context = await loadModules(coreFiles);
  const api = context.__ALAXEE_STEAMHUB_GAME_REGISTRY__;
  const values = new Map();
  const storage = {
    async get(key) { return values.get(key) ?? null; },
    async set(key, value) { values.set(key, value); },
    async delete(key) { values.delete(key); },
    async getAll() { return Object.fromEntries(values); }
  };
  const registry = api.createGameRegistry(storage);

  await registry.addGame({ appId: "3678970", name: "Task Bar Hero" });
  await registry.addGame({ appId: "730", name: "Counter-Strike 2" });

  await registry.upsertTranslation("3678970", {
    marketHashName: "Rare Gem",
    locale: "zh-CN",
    translation: "稀有宝石"
  });
  await registry.upsertTranslation("730", {
    marketHashName: "Rare Gem",
    locale: "zh-CN",
    translation: "稀有宝石（饰品）"
  });

  const first = await registry.get("3678970");
  const second = await registry.get("730");
  assert.equal(first.translations.length, 1);
  assert.equal(second.translations.length, 1);
  assert.notEqual(first.translations[0].translation, second.translations[0].translation);
  assert.deepEqual((await registry.list()).map((pack) => pack.game.appId).sort(), ["3678970", "730"]);

  const provider = api.createGamePackProvider(registry);
  const a = await provider.lookup({ appId: "3678970", marketHashName: "Rare Gem", locale: "zh-CN" });
  const b = await provider.lookup({ appId: "730", marketHashName: "Rare Gem", locale: "zh-CN" });
  assert.equal(a.translation, "稀有宝石");
  assert.equal(b.translation, "稀有宝石（饰品）");

  await registry.setEnabled("730", false);
  assert.equal(await provider.lookup({ appId: "730", marketHashName: "Rare Gem", locale: "zh-CN" }), null);
  assert.equal((await registry.get("3678970")).game.enabled, true);
});

test("game pack import validates schema, merges safely, rejects conflicts, and exports per game", async () => {
  const context = await loadModules(coreFiles);
  const api = context.__ALAXEE_STEAMHUB_GAME_REGISTRY__;
  const values = new Map();
  const storage = {
    async get(key) { return values.get(key) ?? null; },
    async set(key, value) { values.set(key, value); },
    async delete(key) { values.delete(key); },
    async getAll() { return Object.fromEntries(values); }
  };
  const registry = api.createGameRegistry(storage);
  const initial = {
    format: "alaxee-steamhub-game-pack",
    schemaVersion: 1,
    game: {
      appId: "3678970",
      name: "Task Bar Hero",
      adapter: "steam-community-market",
      itemKey: "market_hash_name",
      defaultLocale: "zh-CN"
    },
    translations: [
      { marketHashName: "Soulstone A", locale: "zh-CN", translation: "灵魂石甲" }
    ]
  };

  const imported = await registry.importPack(initial);
  assert.equal(imported.translations.length, 1);

  await registry.importPack({
    ...initial,
    translations: [
      { marketHashName: "Soulstone B", locale: "zh-CN", translation: "灵魂石乙" }
    ]
  }, { mode: "merge" });
  assert.equal((await registry.get("3678970")).translations.length, 2);

  await assert.rejects(
    registry.importPack({
      ...initial,
      translations: [
        { marketHashName: "Soulstone A", locale: "zh-CN", translation: "冲突译文" }
      ]
    }, { mode: "merge" }),
    /Conflicting translation/
  );
  assert.equal((await registry.get("3678970")).translations.find((entry) =>
    entry.marketHashName === "Soulstone A"
  ).translation, "灵魂石甲");

  const replaced = await registry.importPack({
    ...initial,
    translations: [
      { marketHashName: "Soulstone A", locale: "zh-CN", translation: "替换译文" }
    ]
  }, { mode: "replace" });
  assert.equal(replaced.translations.length, 1);
  assert.equal(replaced.translations[0].translation, "替换译文");

  const exported = await registry.exportPack("3678970");
  assert.equal(exported.format, "alaxee-steamhub-game-pack");
  assert.equal(exported.game.appId, "3678970");
  assert.equal(exported.translations.length, 1);
});

test("game pack validation rejects duplicate item-locale keys and unsupported adapters", async () => {
  const context = await loadModules(coreFiles);
  const api = context.__ALAXEE_STEAMHUB_GAME_REGISTRY__;
  const values = new Map();
  const storage = {
    async get(key) { return values.get(key) ?? null; },
    async set(key, value) { values.set(key, value); },
    async delete(key) { values.delete(key); },
    async getAll() { return Object.fromEntries(values); }
  };
  const registry = api.createGameRegistry(storage);
  const pack = {
    format: "alaxee-steamhub-game-pack",
    schemaVersion: 1,
    game: { appId: "3678970", name: "Task Bar Hero" },
    translations: [
      { marketHashName: "Same Key", locale: "zh-CN", translation: "甲" },
      { marketHashName: "Same Key", locale: "zh-CN", translation: "乙" }
    ]
  };

  await assert.rejects(registry.importPack(pack), /duplicate/);
  await assert.rejects(
    registry.importPack({
      ...pack,
      translations: [
        { appId: "730", marketHashName: "Cross Game", locale: "zh-CN", translation: "不应串入" }
      ]
    }),
    /does not match its game pack AppID/
  );
  await assert.rejects(
    registry.importPack({ ...pack, game: { ...pack.game, adapter: "arbitrary-site" }, translations: [] }),
    /supports the steam-community-market/
  );
  await assert.rejects(
    registry.addGame({ appId: "not-an-app-id", name: "Invalid" }),
    /valid Steam AppID/
  );
});

test("game-pack provider connects configured local translations to the translation engine", async () => {
  const context = await loadModules(coreFiles);
  const api = context.__ALAXEE_STEAMHUB_GAME_REGISTRY__;
  const translationApi = context.__ALAXEE_STEAMHUB_TRANSLATION_ENGINE__;
  const values = new Map();
  const storage = {
    async get(key) { return values.get(key) ?? null; },
    async set(key, value) { values.set(key, value); },
    async delete(key) { values.delete(key); },
    async getAll() { return Object.fromEntries(values); }
  };
  const registry = api.createGameRegistry(storage);
  await registry.importPack({
    format: "alaxee-steamhub-game-pack",
    schemaVersion: 1,
    game: { appId: "3678970", name: "Task Bar Hero" },
    translations: [
      { marketHashName: "Vol Soulstone - Normal", locale: "zh-CN", translation: "普通灵魂石" }
    ]
  });

  const provider = api.createGamePackProvider(registry);
  const engine = translationApi.createTranslationEngine({ providers: [provider] });
  const result = await engine.resolve({
    appId: "3678970",
    marketHashName: "Vol Soulstone - Normal"
  });
  assert.equal(result.status, "translated");
  assert.equal(result.record.translation, "普通灵魂石");
  assert.equal(result.record.source, "game-pack:3678970");
});

test("Chrome storage adapter isolates keys under the SteamHub namespace", async () => {
  const context = await loadModules(coreFiles);
  const api = context.__ALAXEE_STEAMHUB_STORAGE_ADAPTER__;
  const values = new Map();
  const storageArea = {
    async get(key) {
      if (key === null) return Object.fromEntries(values);
      return values.has(key) ? { [key]: values.get(key) } : {};
    },
    async set(items) { for (const [key, value] of Object.entries(items)) values.set(key, value); },
    async remove(key) { values.delete(key); }
  };
  const store = api.createChromeStorageAdapter(storageArea);

  await store.set("alaxee-steamhub:translation:test", { translation: "测试" });
  await store.set("alaxee-steamhub:game-pack:v1:3678970", { game: { appId: "3678970" } });
  assert.deepEqual(await store.get("alaxee-steamhub:translation:test"), { translation: "测试" });
  assert.equal(Object.keys(await store.getAll()).length, 2);
  await store.delete("alaxee-steamhub:translation:test");
  assert.equal(await store.get("alaxee-steamhub:translation:test"), null);
  assert.equal(Object.keys(await store.getAll()).length, 1);
  await assert.rejects(store.get("other-extension:data"), /namespace/);
});
