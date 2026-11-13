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
  assert.equal(manifest.version, "0.6.0");
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
  assert.match(publicPackLoaderSource, /credentials: "omit"/);
  assert.match(publicPackLoaderSource, /redirect: "error"/);
  assert.match(publicPackLoaderSource, /5 \* 1024 \* 1024/);
  assert.match(optionsSource, /registryApi\.normalizePack\(parsed\)/);
  assert.match(optionsSource, /chrome\.permissions\.request/);
  assert.ok(optionsSource.includes("response.body.getReader()"));
  assert.match(optionsSource, /new TextDecoder/);
  assert.ok(optionsSource.includes("window.setTimeout"));
  assert.ok(optionsSource.includes("hostname.startsWith"));
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
    normalizePack: (value) => value
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
