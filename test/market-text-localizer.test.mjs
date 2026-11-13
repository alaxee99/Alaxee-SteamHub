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


test("Task Bar Hero rarity names use the dedicated Simplified Chinese game terminology", () => {
  const localizer = loadLocalizer();
  const cases = [
    ["Common", "普通"],
    ["Uncommon", "罕见"],
    ["Rare", "稀有"],
    ["Legendary", "传奇"],
    ["Immortal", "不朽"],
    ["Arcana", "至宝"],
    ["Beyond", "超凡"],
    ["Celestial", "天界"],
    ["Divine", "神圣"],
    ["Cosmic", "宇宙"]
  ];
  for (const [source, expected] of cases) assert.equal(localizer.translateGrade(source), expected);
  assert.equal(localizer.translateText("3678970", "Common Grade"), "普通品阶");
  assert.equal(localizer.translateText("3678970", "Uncommon Grade"), "罕见品阶");
  assert.equal(localizer.translateText("3678970", "Rare Grade"), "稀有品阶");
  assert.equal(localizer.translateText("3678970", "Legendary Grade"), "传奇品阶");
  assert.equal(localizer.translateText("3678970", "Immortal Grade"), "不朽品阶");
  assert.equal(localizer.translateText("3678970", "Arcana Grade"), "至宝品阶");
  assert.equal(localizer.translateText("3678970", "Beyond Grade"), "超凡品阶");
  assert.equal(localizer.translateText("3678970", "Celestial Grade"), "天界品阶");
  assert.equal(localizer.translateText("3678970", "Divine Grade"), "神圣品阶");
  assert.equal(localizer.translateText("3678970", "Cosmic Grade"), "宇宙品阶");
  assert.equal(localizer.translateGrade("Unknown"), null);
  assert.equal(localizer.translateText("3678970", "Arcana Grade"), "至宝品阶");
  assert.equal(localizer.translateText("3678970", "Beyond Grade"), "超凡品阶");
  assert.equal(localizer.translateText("3678970", "Legendary Grade"), "传奇品阶");
});

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
    textTranslations: [{ sourceText: "Unsafe\u0001Key", translation: "译文" }]
  }), /invalid exact text translation/);
});

test("Task Bar Hero stat glossary and numeric ranges translate with values and tiers intact", () => {
  const localizer = loadLocalizer();
  const cases = [
    ["Attack Damage +3~6 T3", "攻击伤害 +3~6 T3"],
    ["Fire Resistance +5~10% T1", "火焰抗性 +5~10% T1"],
    ["HP Regen Per Sec +1,000~2,000 T9-10", "每秒生命恢复 +1,000~2,000 T9-10"],
    ["Add HP Per Hit +1~2 T3", "每次命中回复生命 +1~2 T3"],
    ["Increase Projectile Damage +60~130% T6-8", "投射物伤害提升 +60~130% T6-8"],
    ["All Elemental Resistance +25~30% T10", "全元素抗性 +25~30% T10"],
    ["Skill Duration Increase +45.3~50% T10", "技能持续时间提升 +45.3~50% T10"],
    ["+20~30% Fire Damage Percent", "火焰伤害加成 +20~30%"],
    ["Area Of Effect +8~9% T2", "范围效果 +8~9% T2"]
  ];

  for (const [original, expected] of cases) {
    assert.equal(localizer.translateText("3678970", original), expected, original);
  }
});

test("Task Bar Hero equipment type descriptors translate known types only", () => {
  const localizer = loadLocalizer();
  assert.equal(localizer.translateText("3678970", "Sword - Lv. 90"), "剑 · 等级 90");
  assert.equal(localizer.translateText("3678970", "Scepter - Lv. 80"), "权杖 · 等级 80");
  assert.equal(localizer.translateText("3678970", "Unknown Relic - Lv. 90"), null);
});

 
test("Task Bar Hero item detail section labels and More modifiers translate", () => {
  const localizer = loadLocalizer();
  const cases = [
    ["Base Stats", "基础属性"],
    ["Inherent Stats", "固有属性"],
    ["Unique Stats", "独特属性"],
    ["Slots", "槽位"],
    ["Requirements", "需求条件"],
    ["39% More Attack Speed", "攻击速度额外提高 39%"],
    ["Axe - Lv. 80", "斧 · 等级 80"],
    ["Requires Lv.80", "需求等级：80"]
  ];
  for (const [original, expected] of cases) {
    assert.equal(localizer.translateText("3678970", original), expected, original);
  }
});

 
test("combined Steam detail text nodes translate stat labels and values", () => {
  const localizer = loadLocalizer();
  const cases = [
    ["Attack Damage 746", "攻击伤害 746"],
    ["Attack Speed 1.19", "攻击速度 1.19"],
    ["Attack Damage 1651", "攻击伤害 1651"],
    ["Attack Speed 1.15", "攻击速度 1.15"],
    ["Armor 10791", "护甲 10791"],
    ["Cooldown Reduction +8.7%", "冷却缩减 +8.7%"],
    ["Critical Damage +94%", "暴击伤害 +94%"],
    ["115% Increased Attack Damage", "攻击伤害提高 115%"],
    ["26% More Attack Speed", "攻击速度额外提高 26%"],
    ["50% Increased Max HP", "最大生命值提高 50%"],
    ["494% Increased Armor", "护甲提高 494%"],
    ["Max HP +741", "最大生命值 +741"],
    ["Elemental Dodge Chance +20.0%", "元素闪避几率 +20.0%"],
    ["Decoration Slot ×2", "装饰槽 ×2"],
    ["Engraving Slot ×1", "雕刻槽 ×1"],
    ["Inscription Slot ×1", "铭刻槽 ×1"]
  ];
  for (const [original, expected] of cases) {
    assert.equal(localizer.translateText("3678970", original), expected, original);
  }
});
