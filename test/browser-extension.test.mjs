import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const extensionRoot = path.join(root, "extension");
const manifest = JSON.parse(await readFile(path.join(extensionRoot, "manifest.json"), "utf8"));
const localeSource = await readFile(path.join(extensionRoot, "market-locale.js"), "utf8");
const contentSource = await readFile(path.join(extensionRoot, "content.js"), "utf8");
const publicPackLoaderSource = await readFile(path.join(extensionRoot, "core/public-pack-loader.js"), "utf8");
const sourceRecordMapperSource = await readFile(path.join(extensionRoot, "core/source-record-mapper.js"), "utf8");
const siteSourceDiscoverySource = await readFile(path.join(extensionRoot, "core/site-source-discovery.js"), "utf8");
const htmlTableParserSource = await readFile(path.join(extensionRoot, "core/html-table-parser.js"), "utf8");
const taskBarHeroReferencePack = JSON.parse(await readFile(path.join(root, "docs/game-pack.taskbar-hero-zh-CN.json"), "utf8"));
const API_KEY = "__ALAXEE_STEAMHUB_MARKET_LOCALE__";

function loadPublicPackLoader() {
  const context = vm.createContext({ URL, TextDecoder, Uint8Array, Object, TypeError, Error });
  vm.runInContext(publicPackLoaderSource, context, { filename: "public-pack-loader.js" });
  return context.__ALAXEE_STEAMHUB_PUBLIC_PACK_LOADER__;
}

function createResponse(bodyText, options = {}) {
  const bytes = new TextEncoder().encode(bodyText);
  let offset = 0;
  const chunkSize = options.chunkSize || 1024;
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    url: options.url ?? "https://packs.example/game-pack.json",
    headers: { get(name) {
      return name.toLowerCase() === "content-length" ? String(options.contentLength ?? bytes.length) : null;
    } },
    body: {
      getReader() {
        return {
          async read() {
            if (offset >= bytes.length) return { done: true };
            const value = bytes.slice(offset, Math.min(offset + chunkSize, bytes.length));
            offset += value.length;
            return { done: false, value };
          },
          async cancel() { return undefined; }
        };
      }
    }
  };
}

function loadSiteSourceDiscovery() {
  const context = vm.createContext({ URL, Object, Set, Map, TypeError, Error, String, Number, Array, RegExp, Promise });
  vm.runInContext(siteSourceDiscoverySource, context, { filename: "site-source-discovery.js" });
  return context.__ALAXEE_STEAMHUB_SITE_DISCOVERY__;
}


function loadHtmlTableParser(DOMParserImpl) {
  const context = vm.createContext({
    Object, Array, String, Number, TypeError, RangeError,
    DOMParser: DOMParserImpl
  });
  vm.runInContext(htmlTableParserSource, context, { filename: "html-table-parser.js" });
  return context.__ALAXEE_STEAMHUB_HTML_TABLE_PARSER__;
}

function loadSourceRecordMapper() {
  const context = vm.createContext({ Object, Map, Set, TypeError, RangeError, String });
  vm.runInContext(sourceRecordMapperSource, context, { filename: "source-record-mapper.js" });
  return context.__ALAXEE_STEAMHUB_SOURCE_RECORD_MAPPER__;
}

function loadLocaleApi() {
  const context = vm.createContext({ URL, Set, Object });
  vm.runInContext(localeSource, context, { filename: "market-locale.js" });
  return context[API_KEY];
}

function runContentScript(href) {
  const replacements = [];
  const location = {
    href,
    replace(value) {
      replacements.push(value);
    }
  };
  const context = vm.createContext({ URL, Set, Object, window: { location } });
  vm.runInContext(localeSource, context, { filename: "market-locale.js" });
  vm.runInContext(contentSource, context, { filename: "content.js" });
  return replacements;
}

test("Manifest V3 content scripts are restricted to HTTPS Steam Community Market routes", async () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, "0.6.1");
  assert.equal(manifest.content_scripts.length, 1);

  const script = manifest.content_scripts[0];
  assert.deepEqual(script.matches, [
    "https://steamcommunity.com/market",
    "https://steamcommunity.com/market/*",
    "https://www.steamcommunity.com/market",
    "https://www.steamcommunity.com/market/*"
  ]);
  assert.deepEqual(script.js, [
    "market-locale.js",
    "core/item-identity.js",
    "core/translation-engine.js",
    "core/rate-limiter.js",
    "core/game-registry.js",
    "market-items.js",
    "storage-adapter.js",
    "content.js"
  ]);
  assert.equal(script.run_at, "document_start");
  assert.equal(script.all_frames, false);
  assert.equal(script.world, "ISOLATED");

  assert.deepEqual(manifest.permissions, ["storage"]);
  assert.deepEqual(manifest.optional_host_permissions, ["https://*/*"]);
  assert.equal(manifest.options_page, "options.html");
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.background, undefined);

  const optionsHtml = await readFile(path.join(extensionRoot, "options.html"), "utf8");
  const optionsSource = await readFile(path.join(extensionRoot, "options.js"), "utf8");
  assert.match(optionsSource, /localeSelect\.options/);
  assert.match(optionsSource, /localeSelect\.append\(localeOption\)/);
  assert.match(optionsHtml, /id="game-app-id"/);
  assert.match(optionsHtml, /id="game-name"/);
  assert.match(optionsHtml, /id="entry-market-name"/);
  assert.match(optionsHtml, /id="entry-translation"/);
  assert.match(optionsHtml, /id="pack-json"/);
  assert.match(optionsHtml, /id="entry-source-id"/);
  assert.match(optionsHtml, /id="entry-source"/);
  assert.match(optionsHtml, /id="manage-game"/);
  assert.match(optionsHtml, /id="entry-search"/);
  assert.match(optionsHtml, /id="entry-list"/);
  assert.match(optionsHtml, /id="entry-prev"/);
  assert.match(optionsHtml, /id="entry-next"/);
  assert.match(optionsHtml, /id="cancel-entry-edit"/);
  assert.match(optionsHtml, /id="pack-file"/);
  assert.match(optionsHtml, /id="pack-url"/);
  assert.match(optionsHtml, /id="load-pack-url"/);
  assert.match(optionsHtml, /普通网页需要专用解析适配器/);
  assert.match(optionsHtml, /id="source-url"/);
  assert.match(optionsHtml, /id="source-record-path"/);
  assert.match(optionsHtml, /id="source-market-field"/);
  assert.match(optionsHtml, /id="source-translation-field"/);
  assert.match(optionsHtml, /id="convert-source"/);
  assert.match(optionsHtml, /id="site-index-url"/);
  assert.match(optionsHtml, /id="html-page-url"/);
  assert.match(optionsHtml, /id="extract-html-page"/);
  assert.match(optionsHtml, /id="html-table-select"/);
  assert.match(optionsHtml, /id="html-market-field"/);
  assert.match(optionsHtml, /id="html-translation-field"/);
  assert.match(optionsHtml, /id="html-mapping-mode"/);
  assert.match(optionsHtml, /id="html-reference-game"/);
  assert.ok(optionsHtml.includes("docs/game-pack.taskbar-hero-zh-CN.json"));
  assert.match(optionsHtml, /id="html-card-candidates"/);
  assert.match(optionsHtml, /id="html-card-selector"/);
  assert.match(optionsHtml, /id="html-card-id-selector"/);
  assert.match(optionsHtml, /id="html-card-translation-selector"/);
  assert.match(optionsHtml, /id="extract-html-cards"/);
  assert.match(optionsHtml, /id="convert-html-cards"/);
  assert.match(optionsSource, /parseHtmlCards/);
  assert.match(optionsSource, /discoverHtmlCardSelectors/);
  assert.match(optionsSource, /buildGamePackFromSourceIds/);
  assert.match(optionsSource, /updateHtmlReferenceTarget/);
  assert.match(optionsSource, /siteDiscoveryApi\.isRobotsAllowed/);
  assert.match(optionsHtml, /html-table-parser.js/);
  assert.match(optionsHtml, /id="analyze-site"/);
  assert.match(optionsHtml, /id="site-discovery-pages"/);
  assert.ok(optionsHtml.includes('src="core/site-source-discovery.js"'));
  assert.ok(optionsSource.includes("siteDiscoveryApi.discoverSiteMap"));
  assert.ok(optionsHtml.includes('src="core/source-record-mapper.js"'));
  assert.match(publicPackLoaderSource, /credentials: "omit"/);
  assert.match(publicPackLoaderSource, /redirect: "error"/);
  assert.match(publicPackLoaderSource, /5 \* 1024 \* 1024/);
  assert.match(optionsSource, /registryApi\.normalizePack\(parsed\)/);
  assert.match(optionsSource, /chrome\.permissions\.request/);
  assert.ok(publicPackLoaderSource.includes("response.body.getReader()"));
  assert.match(publicPackLoaderSource, /new TextDecoder/);
  assert.ok(publicPackLoaderSource.includes("setTimeoutImpl"));
  assert.ok(publicPackLoaderSource.includes("hostname.startsWith"));
  assert.match(optionsHtml, /options.js/);
});

test("recognizes only HTTPS Steam Community Market routes", () => {
  const api = loadLocaleApi();

  assert.equal(api.isCommunityMarketUrl("https://steamcommunity.com/market"), true);
  assert.equal(api.isCommunityMarketUrl("https://steamcommunity.com/market/"), true);
  assert.equal(api.isCommunityMarketUrl("https://steamcommunity.com/market/listings/3678970/item"), true);
  assert.equal(api.isCommunityMarketUrl("https://www.steamcommunity.com/market/listings/"), true);

  assert.equal(api.isCommunityMarketUrl("http://steamcommunity.com/market/"), false);
  assert.equal(api.isCommunityMarketUrl("https://store.steampowered.com/market/"), false);
  assert.equal(api.isCommunityMarketUrl("https://notsteamcommunity.com/market/"), false);
  assert.equal(api.isCommunityMarketUrl("https://steamcommunity.com/marketplace/"), false);
  assert.equal(api.isCommunityMarketUrl("https://steamcommunity.com/id/example/"), false);
  assert.equal(api.isCommunityMarketUrl("file:///market/"), false);
});

test("adds the official Simplified Chinese locale without losing market state", () => {
  const api = loadLocaleApi();
  const input = "https://steamcommunity.com/market/listings/3678970/Example?query=rare&start=20&count=10#history";
  const localized = api.getSimplifiedChineseMarketUrl(input);

  assert.ok(localized);
  const url = new URL(localized);
  assert.equal(url.searchParams.get("l"), "schinese");
  assert.equal(url.searchParams.get("query"), "rare");
  assert.equal(url.searchParams.get("start"), "20");
  assert.equal(url.searchParams.get("count"), "10");
  assert.equal(url.hash, "#history");
});

test("replaces a different locale and does not redirect an already localized page", () => {
  const api = loadLocaleApi();
  const english = api.getSimplifiedChineseMarketUrl("https://steamcommunity.com/market/?l=english&query=test");
  assert.equal(new URL(english).searchParams.get("l"), "schinese");

  assert.equal(
    api.getSimplifiedChineseMarketUrl("https://steamcommunity.com/market/?l=schinese&query=test"),
    null
  );
});

test("content script redirects only when a locale update is required", () => {
  const changed = runContentScript("https://steamcommunity.com/market/listings/3678970/Example?query=test");
  assert.equal(changed.length, 1);
  assert.equal(new URL(changed[0]).searchParams.get("l"), "schinese");
  assert.equal(new URL(changed[0]).searchParams.get("query"), "test");

  const unchanged = runContentScript("https://steamcommunity.com/market/?l=schinese");
  assert.deepEqual(unchanged, []);
});


test("public pack loader accepts only public HTTPS URL origins", () => {
  const api = loadPublicPackLoader();
  assert.equal(api.validatePublicHttpsUrl("https://packs.example/path/data.json#section").href,
    "https://packs.example/path/data.json");
  for (const invalid of [
    "http://packs.example/data.json",
    "https://localhost/data.json",
    "https://thing.local/data.json",
    "https://127.0.0.1/data.json",
    "https://10.0.0.5/data.json",
    "https://192.168.1.2/data.json",
    "https://172.20.0.1/data.json",
    "https://8.8.8.8/data.json",
    "https://[::1]/data.json",
    "https://user:pass@packs.example/data.json",
    "https://packs.example:8443/data.json"
  ]) {
    assert.throws(() => api.validatePublicHttpsUrl(invalid), TypeError, invalid);
  }
});

test("public pack loader requests one origin before fetching and validates the pack", async () => {
  const api = loadPublicPackLoader();
  const calls = [];
  const pack = {
    format: "alaxee-steamhub-game-pack",
    schemaVersion: 1,
    game: { appId: "3678970", name: "Task Bar Hero", adapter: "steam-community-market", itemKey: "market_hash_name", defaultLocale: "zh-CN" },
    translations: [{ marketHashName: "Silver Ingot", locale: "zh-CN", translation: "银锭" }]
  };
  let clearedTimer = false;
  class FakeAbortController { constructor() { this.signal = {}; } abort() { this.aborted = true; } }
  const result = await api.fetchGamePackFromUrl("https://packs.example/game-pack.json", {
    requestPermission(pattern) {
      calls.push(["permission", pattern]);
      return Promise.resolve(true);
    },
    fetchImpl: async (url, request) => {
      calls.push(["fetch", url, request]);
      return createResponse(JSON.stringify(pack), { chunkSize: 7 });
    },
    normalizePack(value) {
      calls.push(["normalize"]);
      return { ...value, normalized: true };
    },
    AbortControllerImpl: FakeAbortController,
    setTimeoutImpl(callback, milliseconds) {
      calls.push(["timeout", milliseconds]);
      return callback;
    },
    clearTimeoutImpl() { clearedTimer = true; }
  });

  assert.equal(calls[0][0], "permission");
  assert.equal(calls[0][1], "https://packs.example/*");
  assert.equal(calls[1][0], "timeout");
  assert.equal(calls[2][0], "fetch");
  assert.equal(calls[2][2].credentials, "omit");
  assert.equal(calls[2][2].redirect, "error");
  assert.equal(calls[2][2].referrerPolicy, "no-referrer");
  assert.match(calls[2][2].headers.Accept, /text\/html/);
  assert.equal(calls[3][0], "normalize");
  assert.equal(result.pack.normalized, true);
  assert.equal(result.pack.translations.length, 1);
  assert.equal(result.sourceUrl, "https://packs.example/game-pack.json");
  assert.equal(clearedTimer, true);
});

test("public pack loader stops when origin permission is denied", async () => {
  const api = loadPublicPackLoader();
  let fetchCalled = false;
  await assert.rejects(api.fetchGamePackFromUrl("https://packs.example/data.json", {
    requestPermission: () => Promise.resolve(false),
    fetchImpl: async () => { fetchCalled = true; },
    normalizePack: (value) => value,
    AbortControllerImpl: class { constructor() { this.signal = {}; } abort() {} },
    setTimeoutImpl: () => 1,
    clearTimeoutImpl: () => {}
  }), /未获准访问/);
  assert.equal(fetchCalled, false);
});

test("public pack loader rejects cross-origin responses and non-pack JSON", async () => {
  const api = loadPublicPackLoader();
  const dependencies = {
    requestPermission: () => Promise.resolve(true),
    normalizePack: (value) => value,
    AbortControllerImpl: class { constructor() { this.signal = {}; } abort() {} },
    setTimeoutImpl: () => 1,
    clearTimeoutImpl: () => {}
  };
  await assert.rejects(api.fetchGamePackFromUrl("https://packs.example/data.json", {
    ...dependencies,
    fetchImpl: async () => createResponse("{}", { url: "https://other.example/data.json" })
  }), /跨站跳转/);
  await assert.rejects(api.fetchGamePackFromUrl("https://packs.example/data.json", {
    ...dependencies,
    fetchImpl: async () => createResponse(JSON.stringify({ items: [] }))
  }), /不是 SteamHub Game Pack/);
});

test("public pack loader enforces a streaming size cap and clears timeout after abort", async () => {
  const api = loadPublicPackLoader();
  let timeoutCleared = false;
  let aborted = false;
  class FakeAbortController { constructor() { this.signal = {}; } abort() { aborted = true; } }
  const overLimit = "x".repeat(5 * 1024 * 1024 + 1);
  await assert.rejects(api.fetchGamePackFromUrl("https://packs.example/data.json", {
    requestPermission: () => Promise.resolve(true),
    fetchImpl: async () => createResponse(overLimit, { chunkSize: 1024 * 1024 }),
    normalizePack: (value) => value,
    AbortControllerImpl: FakeAbortController,
    setTimeoutImpl: () => 99,
    clearTimeoutImpl: (id) => { timeoutCleared = id === 99; }
  }), /超过 5 MiB/);
  assert.equal(aborted, true);
  assert.equal(timeoutCleared, true);
});

test("public pack loader normalizes aborted fetches to a timeout error", async () => {
  const api = loadPublicPackLoader();
  let timeoutCleared = false;
  class FakeAbortController { constructor() { this.signal = {}; } abort() {} }
  const aborted = new Error("aborted");
  aborted.name = "AbortError";
  await assert.rejects(api.fetchGamePackFromUrl("https://packs.example/data.json", {
    requestPermission: () => Promise.resolve(true),
    fetchImpl: async () => { throw aborted; },
    normalizePack: (value) => value,
    AbortControllerImpl: FakeAbortController,
    setTimeoutImpl: () => 123,
    clearTimeoutImpl: (id) => { timeoutCleared = id === 123; }
  }), /读取超时/);
  assert.equal(timeoutCleared, true);
});


test("CSV source parser supports quoted commas, escaped quotes and multiline cells", () => {
  const mapper = loadSourceRecordMapper();
  const records = mapper.parseCsv('market_hash_name,zh-Hans,id\r\nSilver Ingot,"银锭, 银块",142001\r\n"Name ""Quoted""","多行\n译文",142002\r\n');
  assert.equal(records.length, 2);
  assert.equal(records[0].market_hash_name, "Silver Ingot");
  assert.equal(records[0]["zh-Hans"], "银锭, 银块");
  assert.equal(records[1].market_hash_name, 'Name "Quoted"');
  assert.equal(records[1]["zh-Hans"], "多行\n译文");
  assert.throws(() => mapper.parseCsv('name,name\nA,B\n'), /不能重复/);
  assert.throws(() => mapper.parseCsv('name,translation\n"unterminated,译文\n'), /未闭合的引号/);
  assert.equal(mapper.parseCsv("\uFEFFmarket_hash_name,zh-Hans\nSilver Ingot,银锭\n")[0].market_hash_name, "Silver Ingot");
  assert.throws(() => mapper.parseCsv('name,translation\n"quoted"tail,译文\n'), /多余字符/);
  assert.throws(() => mapper.parseCsv("name,translation\nA,译文,extra\n"), /列数/);
});

test("JSON source parser resolves nested record arrays without unsafe property paths", () => {
  const mapper = loadSourceRecordMapper();
  const data = { response: { items: [{ id: 1 }, { id: 2 }] } };
  assert.deepEqual(mapper.parseJsonRecords(data, "response.items"), [{ id: 1 }, { id: 2 }]);
  assert.throws(() => mapper.parseJsonRecords(data, "response.__proto__"), /记录数组/);
  assert.throws(() => mapper.parseJsonRecords({ items: {} }, "items"), /记录数组/);
});

test("source record mapper builds exact game-pack keys and excludes conflicts", () => {
  const mapper = loadSourceRecordMapper();
  const records = [
    { market: { key: "Silver Ingot" }, labels: { zh: "银锭" }, id: 142001 },
    { market: { key: "Silver Ingot" }, labels: { zh: "银锭" }, id: 142001 },
    { market: { key: "Arcane Crystal" }, labels: { zh: "奥术水晶" }, id: 115001 },
    { market: { key: "Conflict Item" }, labels: { zh: "译名甲" }, id: 77 },
    { market: { key: "Conflict Item" }, labels: { zh: "译名乙" }, id: 77 },
    { market: { key: "" }, labels: { zh: "缺键" }, id: 88 },
    { market: { key: "No Translation" }, labels: { zh: "" }, id: 89 },
    { market: { key: " Not Exact" }, labels: { zh: "前后空格不能改写" }, id: 90 }
  ];
  const result = mapper.buildGamePackFromRecords(records, {
    game: { appId: "3678970", name: "Task Bar Hero", adapter: "steam-community-market", itemKey: "market_hash_name" },
    locale: "zh-CN",
    fields: { marketHashName: "market.key", translation: "labels.zh", sourceItemId: "id" },
    source: "test-source"
  });

  assert.equal(result.stats.scanned, 8);
  assert.equal(result.stats.imported, 2);
  assert.equal(result.stats.duplicateRows, 1);
  assert.equal(result.stats.conflictingKeys, 1);
  assert.equal(result.stats.missingMarketKey, 2);
  assert.equal(result.stats.missingTranslation, 1);
  assert.deepEqual(Array.from(result.pack.translations, (entry) => entry.marketHashName), ["Silver Ingot", "Arcane Crystal"]);
  assert.equal(result.pack.translations[0].translation, "银锭");
  assert.equal(result.pack.translations[0].sourceItemId, "142001");
  assert.equal(result.pack.translations[1].source, "test-source");
});



test("source ID mapper joins Wiki ItemKeys to one exact Steam market key and excludes ambiguity", () => {
  const mapper = loadSourceRecordMapper();
  const referencePack = {
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
      { marketHashName: "Mystic Armor (Beyond) A", sourceItemId: "516111", locale: "zh-CN", translation: "神秘盔甲" },
      { marketHashName: "Silver Ingot", sourceItemId: "142001", locale: "zh-CN", translation: "银锭" },
      { marketHashName: "Silver Ingot", sourceItemId: "142001", locale: "zh-CN", translation: "银锭" },
      { marketHashName: "Variant A", sourceItemId: "ambiguous-id", locale: "zh-CN", translation: "甲" },
      { marketHashName: "Variant B", sourceItemId: "ambiguous-id", locale: "zh-CN", translation: "乙" }
    ]
  };
  const records = [
    { itemKey: "516111", name: "神秘盔甲 Wiki 译名" },
    { itemKey: "516111", name: "神秘盔甲 Wiki 译名" },
    { itemKey: "142001", name: "银锭" },
    { itemKey: "unknown-id", name: "未知物品" },
    { itemKey: "ambiguous-id", name: "不能确定" },
    { itemKey: "", name: "缺少 ID" },
    { itemKey: "142001", name: "" },
    { itemKey: "516111", name: "冲突译名" }
  ];
  const result = mapper.buildGamePackFromSourceIds(records, {
    referencePack,
    locale: "zh-CN",
    fields: { sourceItemId: "itemKey", translation: "name" },
    source: "test-wiki"
  });

  assert.equal(result.pack.game.appId, "3678970");
  assert.equal(result.pack.game.name, "Task Bar Hero");
  assert.equal(result.stats.scanned, 8);
  assert.equal(result.stats.referenceIds, 2);
  assert.equal(result.stats.imported, 1);
  assert.equal(result.stats.duplicateRows, 1);
  assert.equal(result.stats.conflictingKeys, 1);
  assert.equal(result.stats.unmatchedSourceId, 1);
  assert.equal(result.stats.ambiguousSourceId, 1);
  assert.equal(result.stats.missingSourceId, 1);
  assert.equal(result.stats.missingTranslation, 1);
  assert.deepEqual(
    Array.from(result.pack.translations, (entry) => [entry.marketHashName, entry.sourceItemId, entry.translation]),
    [["Silver Ingot", "142001", "银锭"]]
  );
  assert.equal(result.pack.translations[0].source, "test-wiki");
});

test("source ID mapper rejects invalid reference packs and unsafe source fields", () => {
  const mapper = loadSourceRecordMapper();
  const base = {
    format: "alaxee-steamhub-game-pack",
    schemaVersion: 1,
    game: { appId: "3678970", name: "Task Bar Hero", adapter: "steam-community-market", itemKey: "market_hash_name" },
    translations: [{ marketHashName: "Known Item", sourceItemId: "100", locale: "zh-CN", translation: "已知物品" }]
  };
  assert.throws(() => mapper.buildGamePackFromSourceIds([], {
    referencePack: { ...base, game: { ...base.game, appId: "invalid" } },
    locale: "zh-CN",
    fields: { sourceItemId: "id", translation: "name" }
  }), /参考词库/);
  assert.throws(() => mapper.buildGamePackFromSourceIds([], {
    referencePack: base,
    locale: "zh-CN",
    fields: { sourceItemId: "__proto__", translation: "name" }
  }), /来源 ID 字段/);
});

test("source record mapper rejects invalid game identity, unsafe fields and excessive rows", () => {
  const mapper = loadSourceRecordMapper();
  assert.equal(mapper.readPath({ safe: { name: "x" } }, "safe.name"), "x");
  assert.equal(mapper.readPath({ safe: {} }, "safe.constructor"), undefined);
  assert.throws(() => mapper.buildGamePackFromRecords([], {
    game: { appId: "0", name: "Bad", adapter: "steam-community-market", itemKey: "market_hash_name" },
    locale: "zh-CN",
    fields: { marketHashName: "name", translation: "zh" }
  }), /AppID/);
  assert.throws(() => mapper.buildGamePackFromRecords([], {
    game: { appId: "3678970", name: "Task Bar Hero", adapter: "steam-community-market", itemKey: "market_hash_name" },
    locale: "zh-CN",
    fields: { marketHashName: "constructor", translation: "zh" }
  }), /市场键字段/);
  assert.throws(() => mapper.parseJsonRecords(Array.from({ length: 10001 }, () => ({}))), /10,000/);
});


test("sitemap parser decodes XML URLs and applies robots allow/disallow precedence", () => {
  const api = loadSiteSourceDiscovery();
  const locations = Array.from(api.extractLocs("<urlset><url><loc>https://wiki.example/a?x=1&amp;y=2</loc></url></urlset>"));
  assert.deepEqual(locations, ["https://wiki.example/a?x=1&y=2"]);

  const robots = api.parseRobots([
    "User-agent: *",
    "Disallow: /private/",
    "Allow: /private/public/",
    "Sitemap: https://wiki.example/sitemap.xml"
  ].join("\n"));
  assert.equal(robots.sitemaps[0], "https://wiki.example/sitemap.xml");
  assert.equal(api.isRobotsAllowed(new URL("https://wiki.example/private/item"), robots), false);
  assert.equal(api.isRobotsAllowed(new URL("https://wiki.example/private/public/item"), robots), true);
  assert.equal(api.isRobotsAllowed(new URL("https://wiki.example/wiki"), robots), true);
});

test("site discovery reads same-origin robots and sitemap indexes without fetching page bodies", async () => {
  const api = loadSiteSourceDiscovery();
  const loader = loadPublicPackLoader();
  const calls = [];
  const sourceFiles = new Map([
    ["https://wiki.example/robots.txt", [
      "User-agent: *",
      "Disallow: /private/",
      "Sitemap: https://wiki.example/sitemap-index.xml"
    ].join("\n")],
    ["https://wiki.example/sitemap-index.xml", [
      "<sitemapindex>",
      "<sitemap><loc>https://wiki.example/sitemap-a.xml</loc></sitemap>",
      "<sitemap><loc>https://wiki.example/sitemap-b.xml</loc></sitemap>",
      "<sitemap><loc>https://other.example/foreign.xml</loc></sitemap>",
      "</sitemapindex>"
    ].join("")],
    ["https://wiki.example/sitemap-a.xml", [
      "<urlset>",
      "<url><loc>https://wiki.example/zh/wiki</loc></url>",
      "<url><loc>https://wiki.example/zh/wiki/gear</loc></url>",
      "<url><loc>https://wiki.example/private/profile</loc></url>",
      "<url><loc>https://other.example/page</loc></url>",
      "</urlset>"
    ].join("")],
    ["https://wiki.example/sitemap-b.xml", [
      "<urlset><url><loc>https://wiki.example/zh/wiki/materials</loc></url></urlset>"
    ].join("")]
  ]);
  const result = await api.discoverSiteMap("https://wiki.example/zh/wiki", {
    validatePublicHttpsUrl: (value) => loader.validatePublicHttpsUrl(value),
    requestPermission: async (pattern) => {
      calls.push(["permission", pattern]);
      return true;
    },
    fetchText: async (url) => {
      calls.push(["fetch", url]);
      if (!sourceFiles.has(url)) throw new Error("not found");
      return { text: sourceFiles.get(url) };
    },
    maxUrls: 3
  });

  assert.deepEqual(calls[0], ["permission", "https://wiki.example/*"]);
  assert.deepEqual(calls.slice(1).map((entry) => entry[1]), [
    "https://wiki.example/robots.txt",
    "https://wiki.example/sitemap-index.xml",
    "https://wiki.example/sitemap-a.xml",
    "https://wiki.example/sitemap-b.xml"
  ]);
  assert.deepEqual(Array.from(result.urls), [
    "https://wiki.example/zh/wiki",
    "https://wiki.example/zh/wiki/gear",
    "https://wiki.example/zh/wiki/materials"
  ]);
  assert.equal(result.blockedByRobots, 1);
  assert.equal(result.truncated, true);
  assert.equal(result.sitemaps.length, 3);
  assert.equal(api.isRobotsAllowed(new URL("https://wiki.example/private/profile"), result.robots), false);
  assert.equal(api.isRobotsAllowed(new URL("https://wiki.example/zh/wiki/gear"), result.robots), true);
  assert.equal(result.errors.length, 0);
});

test("site discovery rejects denied permission and never fetches off-origin sitemap URLs", async () => {
  const api = loadSiteSourceDiscovery();
  const loader = loadPublicPackLoader();
  let fetchCount = 0;
  await assert.rejects(api.discoverSiteMap("https://wiki.example/wiki", {
    validatePublicHttpsUrl: (value) => loader.validatePublicHttpsUrl(value),
    requestPermission: async () => false,
    fetchText: async () => { fetchCount += 1; return { text: "" }; }
  }), /未获准访问/);
  assert.equal(fetchCount, 0);
});


test("HTML table parser extracts header-mapped rows from an inert DOM without reading scripts", () => {
  const makeCell = (tagName, value, spans = {}) => ({
    tagName,
    textContent: value,
    colSpan: spans.colSpan || 1,
    rowSpan: spans.rowSpan || 1
  });
  const makeRow = (cells, table) => ({
    cells,
    closest(selector) { return selector === "table" ? table : null; }
  });
  const makeTable = (rows, options = {}) => {
    const table = {
      caption: { textContent: options.caption || "" },
      querySelectorAll(selector) {
        if (selector === "tr") return rows;
        if (selector === "thead tr") return options.theadRows || [];
        return [];
      },
      getAttribute(name) { return name === "aria-label" ? (options.ariaLabel || "") : null; }
    };
    for (const row of rows) row.closest = (selector) => selector === "table" ? table : null;
    return table;
  };
  const goodTable = makeTable([
    { cells: [makeCell("TH", "Market name"), makeCell("TH", "zh-Hans"), makeCell("TH", "ID")] },
    { cells: [makeCell("TD", "Silver  Ingot"), makeCell("TD", "银锭"), makeCell("TD", "142001")] },
    { cells: [makeCell("TD", "Arcane Crystal"), makeCell("TD", "奥术水晶"), makeCell("TD", "115001")] }
  ], { caption: "Item catalog", ariaLabel: "Public item catalog" });
  const noHeaderTable = makeTable([
    { cells: [makeCell("TD", "not a header"), makeCell("TD", "not data")] }
  ]);
  class FakeDOMParser {
    parseFromString(source, type) {
      assert.equal(type, "text/html");
      assert.match(source, /<script>/i);
      return {
        title: { textContent: "Example Wiki" },
        querySelector(selector) { return selector === "title" ? { textContent: "Example Wiki" } : null; },
        querySelectorAll(selector) {
          if (selector === "table") return [goodTable, noHeaderTable];
          if (selector === "h1, h2, h3") return [{ textContent: "Items" }];
          if (selector.startsWith("script,")) return [{ remove() {} }];
          return [];
        }
      };
    }
  }

  const api = loadHtmlTableParser(FakeDOMParser);
  const result = api.parseHtmlTables("<script>ignored()</script><table></table>", {
    pageUrl: "https://wiki.example/items",
    maxRowsPerTable: 1
  });
  assert.equal(result.pageTitle, "Example Wiki");
  assert.deepEqual(Array.from(result.pageHeadings), ["Items"]);
  assert.equal(result.tableCount, 2);
  assert.equal(result.skippedTables, 1);
  assert.equal(result.tables.length, 1);
  assert.equal(result.tables[0].caption, "Item catalog");
  assert.deepEqual(
    Array.from(result.tables[0].headers, (header) => [header.key, header.label]),
    [["column_1", "Market name"], ["column_2", "zh-Hans"], ["column_3", "ID"]]
  );
  assert.equal(result.tables[0].records.length, 1);
  assert.equal(result.tables[0].records[0].column_1, "Silver  Ingot");
  assert.equal(result.tables[0].records[0].column_2, "银锭");
  assert.equal(result.tables[0].rowCount, 2);
  assert.equal(result.tables[0].truncatedRows, true);
  assert.equal(result.pageUrl, "https://wiki.example/items");
});



test("HTML card discovery suggests repeated item selectors without fetching more pages", () => {
  const createNode = (tagName, options = {}) => ({
    tagName: tagName.toUpperCase(),
    textContent: options.text || "",
    classList: new Set(options.classes || []),
    attributes: options.attributes || {},
    hasAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name); },
    getAttribute(name) { return this.attributes[name] ?? null; },
    matches(selector) {
      if (selector === ".item-card") return this.classList.has("item-card");
      if (selector === "article.item-card") return this.tagName === "ARTICLE" && this.classList.has("item-card");
      if (selector === "article") return this.tagName === "ARTICLE";
      return false;
    },
    querySelector(selector) { return options.descendants?.[selector] || null; }
  });
  const cardOne = createNode("article", { classes: ["item-card"], text: "银锭 Silver Ingot" });
  const cardTwo = createNode("article", { classes: ["item-card"], text: "奥术水晶 Arcane Crystal" });
  const cardThree = createNode("article", { classes: ["item-card"], text: "神秘盔甲 Mystic Armor" });
  const allNodes = [cardOne, cardTwo, cardThree];
  const selectors = {
    "*": allNodes,
    "article": allNodes,
    ".item-card": allNodes,
    "article.item-card": allNodes,
    "[data-item-key]": []
  };
  class FakeDOMParser {
    parseFromString() {
      return {
        querySelectorAll(selector) {
          if (selector.startsWith("script,")) return [];
          return selectors[selector] || [];
        }
      };
    }
  }
  const api = loadHtmlTableParser(FakeDOMParser);
  const candidates = api.discoverHtmlCardSelectors("<article class='item-card'>");
  assert.ok(candidates.some((candidate) => candidate.selector === ".item-card" && candidate.count === 3));
  assert.ok(candidates.some((candidate) => candidate.selector === "article.item-card" && candidate.count === 3));
});

test("HTML card parser extracts exact source IDs and translations with bounded skips", () => {
  const makeField = (text, attributes = {}) => ({
    textContent: text,
    getAttribute(name) { return attributes[name] ?? null; }
  });
  const createCard = (id, translation, title) => {
    const idNode = makeField("", { "data-item-key": id });
    const translationNode = translation ? makeField(translation) : null;
    const titleNode = makeField(title);
    return {
      tagName: "ARTICLE",
      textContent: title + " " + (translation || ""),
      matches(selector) { return selector === ".item-card"; },
      querySelector(selector) {
        if (selector === "[data-item-key]") return idNode;
        if (selector === ".item-name") return translationNode;
        if (selector === "h1, h2, h3, h4, [itemprop='name'], [data-item-name]") return titleNode;
        return null;
      }
    };
  };
  const cards = [
    createCard("516111", "神秘盔甲", "Mystic Armor"),
    createCard("142001", "银锭", "Silver Ingot"),
    createCard("115001", "", "Arcane Crystal")
  ];
  class FakeDOMParser {
    parseFromString() {
      return {
        querySelectorAll(selector) {
          if (selector.startsWith("script,")) return [];
          if (selector === ".item-card") return cards;
          return [];
        }
      };
    }
  }
  const api = loadHtmlTableParser(FakeDOMParser);
  const result = api.parseHtmlCards("<article></article>", {
    cardSelector: ".item-card",
    sourceIdSelector: "[data-item-key]",
    sourceIdAttribute: "auto",
    translationSelector: ".item-name",
    maxCards: 2
  });
  assert.equal(result.totalCards, 3);
  assert.equal(result.scanned, 2);
  assert.equal(result.records.length, 2);
  assert.equal(result.records[0].sourceId, "516111");
  assert.equal(result.records[0].translation, "神秘盔甲");
  assert.equal(result.records[0].title, "Mystic Armor");
  assert.equal(result.missingSourceId, 0);
  assert.equal(result.missingTranslation, 0);
  assert.equal(result.truncated, true);
});

test("HTML card parser fails closed on invalid selectors and empty mappings", () => {
  const card = {
    textContent: "card",
    matches() { return false; },
    querySelector(selector) {
      if (selector === ".bad[") throw new Error("invalid selector");
      return null;
    },
    getAttribute() { return null; }
  };
  class FakeDOMParser {
    parseFromString() {
      return {
        querySelectorAll(selector) {
          if (selector.startsWith("script,")) return [];
          if (selector === ".item-card") return [card];
          return [];
        }
      };
    }
  }
  const api = loadHtmlTableParser(FakeDOMParser);
  assert.throws(() => api.parseHtmlCards("<div></div>", {
    cardSelector: ".item-card",
    translationSelector: ".item-name",
    sourceIdSelector: ".bad["
  }), /选择器无效/);
});

test("HTML table parser rejects oversized pages and tables with ambiguous spanning headers", () => {
  const makeRow = (cells, table) => ({
    cells,
    closest(selector) { return selector === "table" ? table : null; }
  });
  const table = {
    caption: null,
    querySelectorAll(selector) { return selector === "tr" ? this.rows : []; },
    getAttribute() { return null; },
    rows: []
  };
  table.rows = [
    makeRow([{ tagName: "TH", textContent: "Name", colSpan: 2, rowSpan: 1 }], table),
    makeRow([{ tagName: "TD", textContent: "Item", colSpan: 1, rowSpan: 1 }], table)
  ];
  class FakeDOMParser {
    parseFromString() {
      return {
        title: null,
        querySelector() { return null; },
        querySelectorAll(selector) {
          if (selector === "table") return [table];
          return [];
        }
      };
    }
  }
  const api = loadHtmlTableParser(FakeDOMParser);
  assert.throws(() => api.parseHtmlTables("12345", { maxChars: 4 }), /超过 1 MiB/);
  assert.equal(api.parseHtmlTables("<table></table>").skippedTables, 1);
});


test("HTML detail parser extracts one explicit ItemKey and localized name from definition lists", () => {
  const makePair = (label, value) => {
    const dd = { tagName: "DD", textContent: value, nextElementSibling: null };
    const dt = { tagName: "DT", textContent: label, nextElementSibling: dd };
    return [dt, dd];
  };
  const pairs = [
    ...makePair("ItemKey", "516111"),
    ...makePair("简体中文", "神秘盔甲")
  ];
  const heading = { tagName: "H1", textContent: "Mystic Armor" };
  const title = { tagName: "TITLE", textContent: "Mystic Armor · Wiki" };
  class FakeDOMParser {
    parseFromString() {
      return {
        querySelectorAll(selector) {
          if (selector.startsWith("script,")) return [];
          if (selector === "dl dt") return pairs.filter((node) => node.tagName === "DT");
          if (selector === "tr" || selector.startsWith("meta[") || selector === "[itemprop]" ||
              selector.includes("data-item-key")) return [];
          if (selector === "h1, h2, h3") return [heading];
          return [];
        },
        querySelector(selector) {
          if (selector === "h1") return heading;
          if (selector === "title") return title;
          return null;
        }
      };
    }
  }
  const api = loadHtmlTableParser(FakeDOMParser);
  const result = api.parseHtmlDetailRecord("<dl><dt>ItemKey</dt><dd>516111</dd></dl>", {
    pageUrl: "https://wiki.example/item/516111"
  });
  assert.equal(result.pageUrl, "https://wiki.example/item/516111");
  assert.equal(result.pageTitle, "Mystic Armor · Wiki");
  assert.equal(result.title, "Mystic Armor");
  assert.equal(result.sourceId, "516111");
  assert.equal(result.translation, "神秘盔甲");
  assert.equal(result.records.length, 1);
  assert.deepEqual(
    { sourceId: result.records[0].sourceId, translation: result.records[0].translation },
    { sourceId: "516111", translation: "神秘盔甲" }
  );
});

test("HTML detail parser supports key-value table rows and explicit selectors without guessing headings", () => {
  const row = {
    cells: [
      { tagName: "TH", textContent: "Item ID" },
      { tagName: "TD", textContent: "142001" }
    ]
  };
  const translationNode = { tagName: "SPAN", textContent: "银锭" };
  const heading = { tagName: "H1", textContent: "Silver Ingot" };
  class FakeDOMParser {
    parseFromString() {
      return {
        querySelectorAll(selector) {
          if (selector.startsWith("script,")) return [];
          if (selector === "dl dt") return [];
          if (selector === "tr") return [row];
          if (selector === ".localized-name") return [translationNode];
          if (selector === "h1, h2, h3") return [heading];
          return [];
        },
        querySelector(selector) {
          if (selector === "h1") return heading;
          return null;
        }
      };
    }
  }
  const api = loadHtmlTableParser(FakeDOMParser);
  const result = api.parseHtmlDetailRecord("<table></table>", {
    translationSelector: ".localized-name"
  });
  assert.equal(result.sourceId, "142001");
  assert.equal(result.translation, "银锭");
  assert.equal(result.title, "Silver Ingot");
  assert.equal(result.records.length, 1);
});

test("HTML detail parser rejects missing or conflicting identity fields and invalid selectors", () => {
  const makeTerm = (label, value) => ({
    tagName: "DT",
    textContent: label,
    nextElementSibling: { tagName: "DD", textContent: value }
  });
  const terms = [
    makeTerm("ItemKey", "516111"),
    makeTerm("ItemKey", "142001"),
    makeTerm("简体中文", "神秘盔甲")
  ];
  class FakeDOMParser {
    parseFromString() {
      return {
        querySelectorAll(selector) {
          if (selector.startsWith("script,")) return [];
          if (selector === ".invalid[") throw new Error("invalid selector");
          if (selector === "dl dt") return terms;
          if (selector === "tr" || selector.startsWith("meta[") || selector === "[itemprop]" ||
              selector.includes("data-item-key")) return [];
          return [];
        },
        querySelector() { return null; }
      };
    }
  }
  const api = loadHtmlTableParser(FakeDOMParser);
  const ambiguous = api.parseHtmlDetailRecord("<dl></dl>");
  assert.equal(ambiguous.ambiguousSourceId, true);
  assert.equal(ambiguous.records.length, 0);

  const missing = api.parseHtmlDetailRecord("<dl></dl>", {
    sourceIdLabels: ["Missing ID"],
    translationLabels: ["Missing Name"]
  });
  assert.equal(missing.missingSourceId, true);
  assert.equal(missing.missingTranslation, true);
  assert.equal(missing.records.length, 0);

  assert.throws(() => api.parseHtmlDetailRecord("<dl></dl>", {
    sourceIdSelector: ".invalid["
  }), /CSS 选择器无效/);
});

test("Options page wires detail extraction to the existing exact mapping workflow", async () => {
  const optionsHtml = await readFile(path.join(extensionRoot, "options.html"), "utf8");
  const optionsJs = await readFile(path.join(extensionRoot, "options.js"), "utf8");
  for (const id of [
    "html-detail-id-labels",
    "html-detail-translation-labels",
    "html-detail-id-selector",
    "html-detail-translation-selector",
    "extract-html-detail",
    "convert-html-detail",
    "html-detail-preview",
    "html-local-file",
    "html-detail-template"
  ]) {
    assert.match(optionsHtml, new RegExp('id="' + id + '"'));
  }
  assert.match(optionsJs, /parseHtmlDetailRecord\(extractedHtmlSource/);
  assert.match(optionsJs, /html-detail-template/);
  assert.match(optionsJs, /span\.font-mono\.text-xs\.text-text-faint/);
  assert.match(optionsJs, /heading\.pixel/);
  assert.match(optionsJs, /file\.size > 1024 \* 1024/);
  assert.match(optionsJs, /await file\.text\(\)/);
  assert.match(optionsJs, /parseHtmlTables\(localHtml/);
  assert.match(optionsJs, /credentials|chrome\.permissions\.request/);
  assert.match(optionsJs, /buildGamePackFromSourceIds\(extractedHtmlDetailResult\.records/);
  assert.match(optionsJs, /buildGamePackFromRecords\(\s*extractedHtmlDetailResult\.records/);
});


test("HTML detail parser reads explicit meta and itemprop fields", () => {
  const metaId = {
    tagName: "META",
    getAttribute(name) {
      return ({ name: "ItemKey", content: "516111" })[name] || null;
    }
  };
  const localized = {
    tagName: "SPAN",
    textContent: "神秘盔甲",
    getAttribute(name) { return name === "itemprop" ? "zh-Hans" : null; }
  };
  class FakeDOMParser {
    parseFromString() {
      return {
        querySelectorAll(selector) {
          if (selector.startsWith("script,")) return [];
          if (selector === "dl dt" || selector === "tr") return [];
          if (selector === "meta[name], meta[property], meta[itemprop]") return [metaId];
          if (selector === "[itemprop]") return [localized];
          if (selector.includes("data-item-key")) return [];
          if (selector === "h1, h2, h3") return [];
          return [];
        },
        querySelector() { return null; }
      };
    }
  }
  const api = loadHtmlTableParser(FakeDOMParser);
  const result = api.parseHtmlDetailRecord("<meta name='ItemKey' content='516111'>", {
    translationLabels: ["zh-Hans"]
  });
  assert.equal(result.sourceId, "516111");
  assert.equal(result.translation, "神秘盔甲");
  assert.equal(result.records.length, 1);
});


test("TaskBarHeroWiki Minor Ruby detail page uses the current localized DOM and normalizes its item key", () => {
  const itemIdNode = { tagName: "SPAN", textContent: "#110001" };
  const itemHeading = { tagName: "HEADING", textContent: "小红宝石" };
  class FakeDOMParser {
    parseFromString() {
      return {
        querySelectorAll(selector) {
          if (selector.startsWith("script,")) return [];
          if (selector === "dl dt" || selector === "tr" || selector.startsWith("meta[") ||
              selector === "[itemprop]" || selector.includes("data-item-key")) return [];
          if (selector === "span.font-mono.text-xs.text-text-faint") return [itemIdNode];
          if (selector === "heading.pixel") return [itemHeading];
          if (selector === "h1, h2, h3") return [];
          return [];
        },
        querySelector() { return null; }
      };
    }
  }
  const parser = loadHtmlTableParser(FakeDOMParser);
  const parsed = parser.parseHtmlDetailRecord("<heading class='pixel'>小红宝石</heading>", {
    pageUrl: "https://taskbarherowiki.com/items/110001",
    sourceIdSelector: "span.font-mono.text-xs.text-text-faint",
    translationSelector: "heading.pixel"
  });
  assert.equal(parsed.sourceId, "110001");
  assert.equal(parsed.translation, "小红宝石");
  assert.equal(parsed.records.length, 1);

  const mapper = loadSourceRecordMapper();
  const mapped = mapper.buildGamePackFromSourceIds([{
    sourceId: parsed.sourceId,
    translation: parsed.translation
  }], {
    referencePack: taskBarHeroReferencePack,
    locale: "zh-CN",
    fields: { sourceItemId: "sourceId", translation: "translation" },
    source: "taskbarherowiki.com:single-page-id-cross-check"
  });
  assert.equal(mapped.stats.imported, 1);
  assert.deepEqual(
    Array.from(mapped.pack.translations, (entry) => [
      entry.marketHashName, entry.sourceItemId, entry.locale, entry.translation
    ]),
    [["Minor Ruby", "110001", "zh-CN", "小红宝石"]]
  );
});
