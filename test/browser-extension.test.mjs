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
const API_KEY = "__ALAXEE_STEAMHUB_MARKET_LOCALE__";

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
  assert.equal(manifest.options_page, "options.html");
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.background, undefined);

  const optionsHtml = await readFile(path.join(extensionRoot, "options.html"), "utf8");
  assert.match(optionsHtml, /id="game-app-id"/);
  assert.match(optionsHtml, /id="game-name"/);
  assert.match(optionsHtml, /id="entry-market-name"/);
  assert.match(optionsHtml, /id="entry-translation"/);
  assert.match(optionsHtml, /id="pack-json"/);
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
