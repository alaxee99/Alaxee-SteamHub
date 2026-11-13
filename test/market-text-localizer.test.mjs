import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(path.join(root, "extension/market-text-localizer.js"), "utf8");

function loadLocalizer() {
  const context = vm.createContext({ Object, Map, Set, String, RegExp, Array });
  vm.runInContext(source, context, { filename: "market-text-localizer.js" });
  return context.__ALAXEE_STEAMHUB_GAME_TEXT_LOCALIZER__;
}

test("Task Bar Hero item descriptions and attributes translate while retaining numbers", () => {
  const localizer = loadLocalizer();
  assert.equal(localizer.translateText("3678970", "22% Increased Attack Speed"), "攻击速度提高 22%");
  assert.equal(localizer.translateText("3678970", "All Skill Level +2"), "所有技能等级 +2");
  assert.equal(localizer.translateText("3678970", "43% Increased Critical Chance Multiplier"), "暴击几率倍率提高 43%");
  assert.equal(localizer.translateText("3678970", "Decoration Slot ×2"), "装饰槽 ×2");
  assert.equal(localizer.translateText("3678970", "Requires Lv.90"), "需求等级：90");
});

test("exact mappings are matched exactly and do not fuzzy-match", () => {
  const localizer = loadLocalizer();
  const mappings = [{ sourceText: "Exact Original Detail", translation: "精确详情译文" }];
  assert.equal(localizer.translateText("3678970", "Exact Original Detail", mappings), "精确详情译文");
  assert.equal(localizer.translateText("440", "Exact Original Detail", mappings), "精确详情译文");
  assert.equal(localizer.translateText("440", "22% Increased Attack Speed"), null);
  assert.equal(localizer.translateText("3678970", "Exact Original Detail Extra", mappings), null);
});

test("multiline details and bullet prefixes are translated without changing line breaks", () => {
  const localizer = loadLocalizer();
  assert.equal(
    localizer.translateText("3678970", "  - 22% Increased Attack Speed\n- All Skill Level +2"),
    "  - 攻击速度提高 22%\n- 所有技能等级 +2"
  );
});

test("unknown descriptions remain untouched", () => {
  const localizer = loadLocalizer();
  assert.equal(localizer.translateText("3678970", "Uncatalogued property 123"), null);
  assert.equal(localizer.translateText("440", "Uncatalogued property 123"), null);
});

test("game pack exact mappings reject duplicate or unsafe entries", async () => {
  const registrySource = await readFile(path.join(root, "extension/core/game-registry.js"), "utf8");
  const identitySource = await readFile(path.join(root, "extension/core/item-identity.js"), "utf8");
  const context = vm.createContext({ Object, Map, Set, String, Number, Date, RegExp, Array, URL });
  vm.runInContext(identitySource, context, { filename: "item-identity.js" });
  vm.runInContext(registrySource, context, { filename: "game-registry.js" });
  const api = context.__ALAXEE_STEAMHUB_GAME_REGISTRY__;
  const base = {
    format: api.PACK_FORMAT,
    schemaVersion: api.PACK_VERSION,
    game: { appId: "3678970", name: "Task Bar Hero" },
    translations: [],
    textTranslations: [{ sourceText: "Inherent Stats", translation: "固有属性" }]
  };
  assert.equal(api.normalizePack(base).textTranslations[0].translation, "固有属性");
  assert.throws(() => api.normalizePack({
    ...base,
    textTranslations: [
      { sourceText: "Inherent Stats", translation: "固有属性" },
      { sourceText: "Inherent Stats", translation: "内在属性" }
    ]
  }), /duplicate exact text translation keys/);
  assert.throws(() => api.normalizePack({
    ...base,
    textTranslations: [{ sourceText: "Unsafe\nKey", translation: "译文" }]
  }), /invalid exact text translation/);
});