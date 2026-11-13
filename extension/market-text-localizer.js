(() => {
  "use strict";

  const API_KEY = "__ALAXEE_STEAMHUB_GAME_TEXT_LOCALIZER__";
  const TASK_BAR_HERO_APP_ID = "3678970";
  if (globalThis[API_KEY]) return;

  const EXACT_TERMS = Object.freeze({
    "Arcana Grade": "奥术品阶",
    "Inherent Stats": "固有属性",
    "Common Grade": "普通品阶",
    "Uncommon Grade": "优秀品阶",
    "Rare Grade": "稀有品阶",
    "Legendary Grade": "传奇品阶",
    "Immortal Grade": "不朽品阶",
    "Beyond Grade": "超越品阶",
    "Celestial Grade": "天界品阶",
    "Divine Grade": "神圣品阶",
    "Cosmic Grade": "宇宙品阶",
    "Attack Speed": "攻击速度",
    "Attack Damage": "攻击伤害",
    "Critical Chance": "暴击几率",
    "Critical Chance Multiplier": "暴击几率倍率",
    "Cooldown Reduction": "冷却缩减",
    "Max HP": "最大生命值",
    "HP Regen": "生命恢复",
    "HP Regen Per Sec": "每秒生命恢复",
    "Armor": "护甲",
    "Strength": "力量",
    "Intelligence": "智力",
    "Agility": "敏捷",
    "Movement Speed": "移动速度",
    "Decoration Slot": "装饰槽",
    "Engraving Slot": "雕刻槽",
    "Inscription Slot": "铭刻槽",
    "Amulet": "护符",
    "Bracer": "护腕",
    "Earring": "耳环",
    "Ring": "戒指",
    "Helmet": "头盔",
    "Body": "胸甲",
    "Gloves": "手套",
    "Boots": "靴子",
    "Weapon": "武器",
    "Off-hand": "副手",
    "Marketable": "可在市场交易",
    "Alchemy value": "炼金价值",
    "Cube EXP": "魔方经验",
    "Inherent Stat": "固有属性"
  });

  const STAT_NAMES = Object.freeze({
    "Attack Speed": "攻击速度",
    "Attack Damage": "攻击伤害",
    "Critical Chance": "暴击几率",
    "Critical Chance Multiplier": "暴击几率倍率",
    "Cooldown Reduction": "冷却缩减",
    "Max HP": "最大生命值",
    "HP Regen": "生命恢复",
    "HP Regen Per Sec": "每秒生命恢复",
    "Armor": "护甲",
    "Movement Speed": "移动速度",
    "Strength": "力量",
    "Intelligence": "智力",
    "Agility": "敏捷"
  });

  const SLOT_NAMES = Object.freeze({
    "Decoration": "装饰",
    "Engraving": "雕刻",
    "Inscription": "铭刻"
  });

  const ITEM_TYPES = Object.freeze({
    "Amulet": "护符",
    "Bracer": "护腕",
    "Earring": "耳环",
    "Ring": "戒指",
    "Helmet": "头盔",
    "Body": "胸甲",
    "Gloves": "手套",
    "Boots": "靴子",
    "Weapon": "武器",
    "Off-hand": "副手"
  });

  function normalizeText(value) {
    return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  }

  function validateMappings(mappings) {
    if (mappings instanceof Map) return mappings;
    if (mappings === undefined || mappings === null) return new Map();
    if (!Array.isArray(mappings)) return new Map();

    const result = new Map();
    for (const entry of mappings) {
      const sourceText = normalizeText(entry?.sourceText);
      const translation = normalizeText(entry?.translation);
      if (!sourceText || !translation || sourceText.length > 1000 || translation.length > 1000) continue;
      result.set(sourceText, translation);
    }
    return result;
  }

  function translateTaskBarHeroText(value) {
    const text = normalizeText(value);
    if (!text) return null;

    if (EXACT_TERMS[text]) return EXACT_TERMS[text];

    let match = text.match(/^(\d+(?:\.\d+)?)% Increased (Attack Speed|Attack Damage|Critical Chance|Critical Chance Multiplier|Max HP|Movement Speed)$/);
    if (match && STAT_NAMES[match[2]]) return STAT_NAMES[match[2]] + "提高 " + match[1] + "%";

    match = text.match(/^(\d+(?:\.\d+)?)% (Cooldown Reduction|Critical Chance|Critical Chance Multiplier)$/);
    if (match && STAT_NAMES[match[2]]) return STAT_NAMES[match[2]] + " " + match[1] + "%";

    match = text.match(/^All Skill Level \+(\d+)$/);
    if (match) return "所有技能等级 +" + match[1];

    match = text.match(/^Requires Lv\.?\s*(\d+)$/i);
    if (match) return "需求等级：" + match[1];

    match = text.match(/^(Decoration|Engraving|Inscription) Slot ×(\d+)$/);
    if (match) return SLOT_NAMES[match[1]] + "槽 ×" + match[2];

    match = text.match(/^(Amulet|Bracer|Earring|Ring|Helmet|Body|Gloves|Boots|Weapon|Off-hand)\s*-\s*Lv\.?\s*(\d+)$/);
    if (match) return ITEM_TYPES[match[1]] + " · 等级 " + match[2];

    match = text.match(/^(\d+(?:\.\d+)?)% Increased (.+)$/);
    if (match && STAT_NAMES[match[2]]) return STAT_NAMES[match[2]] + "提高 " + match[1] + "%";

    return null;
  }

  function translateSingleLine(appId, value, exactMappings) {
    const original = String(value ?? "");
    const bullet = original.match(/^(\s*[-•]\s*)/);
    const prefix = bullet ? bullet[1] : "";
    const body = bullet ? original.slice(bullet[1].length) : original;
    const normalizedBody = normalizeText(body);
    if (!normalizedBody) return null;

    const exact = exactMappings.get(normalizedBody);
    const localized = exact || (String(appId) === TASK_BAR_HERO_APP_ID
      ? translateTaskBarHeroText(normalizedBody)
      : null);
    return localized && normalizeText(localized) !== normalizedBody
      ? prefix + localized
      : null;
  }

  function translateText(appId, value, mappings) {
    const original = String(value ?? "");
    if (!normalizeText(original)) return null;

    const exactMappings = validateMappings(mappings);
    const segments = original.split(/(\r\n|\n|\r)/);
    let changed = false;
    const translated = segments.map((segment, index) => {
      if (index % 2 === 1) return segment;
      const next = translateSingleLine(appId, segment, exactMappings);
      if (next === null) return segment;
      changed = true;
      return next;
    }).join("");
    return changed ? translated : null;
  }

  Object.defineProperty(globalThis, API_KEY, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: Object.freeze({
      normalizeText,
      validateMappings,
      translateTaskBarHeroText,
      translateText
    })
  });
})();