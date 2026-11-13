(() => {
  "use strict";

  const API_KEY = "__ALAXEE_STEAMHUB_GAME_TEXT_LOCALIZER__";
  const TASK_BAR_HERO_APP_ID = "3678970";
  if (globalThis[API_KEY]) return;

  const EXACT_TERMS = Object.freeze({
    "Common Grade": "普通品阶",
    "Uncommon Grade": "罕见品阶",
    "Rare Grade": "稀有品阶",
    "Legendary Grade": "传奇品阶",
    "Immortal Grade": "不朽品阶",
    "Arcana Grade": "至宝品阶",
    "Beyond Grade": "超凡品阶",
    "Celestial Grade": "天界品阶",
    "Divine Grade": "神圣品阶",
    "Cosmic Grade": "宇宙品阶",
    "Inherent Stats": "固有属性",
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

  const GRADE_NAMES = Object.freeze({
    Common: "普通",
    Uncommon: "罕见",
    Rare: "稀有",
    Legendary: "传奇",
    Immortal: "不朽",
    Arcana: "至宝",
    Beyond: "超凡",
    Celestial: "天界",
    Divine: "神圣",
    Cosmic: "宇宙"
  });

  const STAT_NAMES = Object.freeze({
    "Attack Speed": "攻击速度",
    "Attack Damage": "攻击伤害",
    "Critical Chance": "暴击几率",
    "Critical Damage": "暴击伤害",
    "Critical Chance Multiplier": "暴击几率倍率",
    "Max HP": "最大生命值",
    "Armor": "护甲",
    "Movement Speed": "移动速度",
    "Area Of Effect": "范围效果",
    "Base Attack Count Reduction": "基础攻击次数减少",
    "Basic Attack Requirement Reduction": "基础攻击所需次数减少",
    "Cooldown Reduction": "冷却缩减",
    "Skill Range": "技能范围",
    "Skill Range Expansion": "技能范围扩展",
    "Fire Resistance": "火焰抗性",
    "Cold Resistance": "冰霜抗性",
    "Lightning Resistance": "闪电抗性",
    "Chaos Resistance": "混沌抗性",
    "Dodge Chance": "闪避几率",
    "Block Chance": "格挡几率",
    "Max Dodge Chance": "最大闪避几率",
    "Max Block Chance": "最大格挡几率",
    "Multistrike": "多重打击",
    "HP Leech": "生命偷取",
    "Life Leech": "生命偷取",
    "Projectile Count": "投射物数量",
    "HP Regen": "生命恢复",
    "HP Regen Per Sec": "每秒生命恢复",
    "Physical Damage Percent": "物理伤害加成",
    "Fire Damage Percent": "火焰伤害加成",
    "Cold Damage Percent": "冰霜伤害加成",
    "Lightning Damage Percent": "闪电伤害加成",
    "Chaos Damage Percent": "混沌伤害加成",
    "Max Fire Resistance": "最大火焰抗性",
    "Max Cold Resistance": "最大冰霜抗性",
    "Max Lightning Resistance": "最大闪电抗性",
    "Max Chaos Resistance": "最大混沌抗性",
    "Max All Elemental Resistance": "最大全元素抗性",
    "Add HP Per Hit": "每次命中回复生命",
    "Add HP Per Kill": "击杀回复生命",
    "Damage Reduction": "伤害减免",
    "Physical Damage Reduction": "物理伤害减免",
    "Fire Damage Reduction": "火焰伤害减免",
    "Cold Damage Reduction": "冰霜伤害减免",
    "Lightning Damage Reduction": "闪电伤害减免",
    "Chaos Damage Reduction": "混沌伤害减免",
    "Damage Absorption": "伤害吸收",
    "Damage Addition": "伤害追加",
    "Physical Damage Addition": "物理伤害追加",
    "Fire Damage Addition": "火焰伤害追加",
    "Cold Damage Addition": "冰霜伤害追加",
    "Lightning Damage Addition": "闪电伤害追加",
    "Chaos Damage Addition": "混沌伤害追加",
    "Increase Exp Amount": "经验获取提升",
    "Additional Exp": "额外经验",
    "Increase Gold Amount": "金币获取提升",
    "Additional Gold": "额外金币",
    "Increased Chest Quantity": "宝箱数量提升",
    "Cast Speed": "施法速度",
    "Skill Heal Increase": "技能治疗效果提升",
    "Skill Duration Increase": "技能持续时间提升",
    "All Elemental Resistance": "全元素抗性",
    "Increase Projectile Damage": "投射物伤害提升",
    "Increase Melee Damage": "近战伤害提升",
    "Increase Area Of Effect Damage": "范围伤害提升",
    "Increase Summon Damage": "召唤物伤害提升",
    "Projectile Speed": "投射物速度",
    "Add All Skill Level": "所有技能等级",
    "All Skill Level": "所有技能等级",
    "Elemental Block Chance": "元素格挡几率",
    "Elemental Dodge Chance": "元素闪避几率",
    "Max Elemental Block Chance": "最大元素格挡几率",
    "Max Elemental Dodge Chance": "最大元素闪避几率",
    "Basic Attack Range Increase": "基础攻击范围提升",
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
    "Armor": "护甲",
    "Accessory": "饰品",
    "Sword": "剑",
    "Shield": "盾牌",
    "Bow": "弓",
    "Staff": "法杖",
    "Orb": "法球",
    "Scepter": "权杖",
    "Tome": "魔典",
    "Crossbow": "弩",
    "Axe": "斧",
    "Hatchet": "手斧",
    "Bolt": "弩箭",
    "Arrow": "箭矢",
    "Weapon": "武器",
    "Off-hand": "副手"
  });

  function normalizeText(value) {
    return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  }

  function translateGrade(value) {
    const grade = normalizeText(value);
    return Object.prototype.hasOwnProperty.call(GRADE_NAMES, grade)
      ? GRADE_NAMES[grade]
      : null;
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
    if (STAT_NAMES[text]) return STAT_NAMES[text];


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

    match = text.match(/^(Amulet|Bracer|Earring|Ring|Helmet|Body|Gloves|Boots|Armor|Accessory|Sword|Shield|Bow|Staff|Orb|Scepter|Tome|Crossbow|Axe|Hatchet|Bolt|Arrow|Weapon|Off-hand)\s*-\s*Lv\.?\s*(\d+)$/);
    if (match) return ITEM_TYPES[match[1]] + " · 等级 " + match[2];

    match = text.match(/^(\d+(?:\.\d+)?)% Increased (.+)$/);
    if (match && STAT_NAMES[match[2]]) return STAT_NAMES[match[2]] + "提高 " + match[1] + "%";

    const numericValue = "[+-]?(?:\\d[\\d,]*(?:\\.\\d+)?)(?:~[+-]?(?:\\d[\\d,]*(?:\\.\\d+)?))?%?";
    const valuePattern = new RegExp("^(" + numericValue + ")(?:\\s+(T\\d+(?:-\\d+)?))?$");
    const statNames = Object.keys(STAT_NAMES).sort((a, b) => b.length - a.length);
    for (const statName of statNames) {
      const prefix = statName + " ";
      if (text.startsWith(prefix)) {
        const valueMatch = text.slice(prefix.length).match(valuePattern);
        if (valueMatch) {
          return STAT_NAMES[statName] + " " + valueMatch[1] +
            (valueMatch[2] ? " " + valueMatch[2] : "");
        }
      }

      const suffix = " " + statName;
      if (text.endsWith(suffix)) {
        const leadingValue = text.slice(0, -suffix.length);
        if (new RegExp("^" + numericValue + "$").test(leadingValue)) {
          return STAT_NAMES[statName] + " " + leadingValue;
        }
      }
    }

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
      translateGrade,
      validateMappings,
      translateTaskBarHeroText,
      translateText
    })
  });
})();