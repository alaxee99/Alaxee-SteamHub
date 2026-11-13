(() => {
  "use strict";

  const PACK_FORMAT = "alaxee-steamhub-game-pack";
  const PACK_SCHEMA_VERSION = 1;
  const MAX_RECORDS = 10000;
  const MAX_FIELD_PATH = 256;

  function isSafePath(path) {
    if (typeof path !== "string" || path.length === 0 || path.length > MAX_FIELD_PATH) return false;
    return path.split(".").every((part) =>
      /^[A-Za-z_$][A-Za-z0-9_$-]*$/.test(part) &&
      part !== "__proto__" && part !== "prototype" && part !== "constructor"
    );
  }

  function readPath(record, path) {
    if (!isSafePath(path)) return undefined;
    let value = record;
    for (const part of path.split(".")) {
      if (value === null || typeof value !== "object" ||
          !Object.prototype.hasOwnProperty.call(value, part)) {
        return undefined;
      }
      value = value[part];
    }
    return value;
  }

  function parseCsv(text) {
    if (typeof text !== "string") throw new TypeError("CSV 内容必须是文本");
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;

    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (quoted) {
        if (character === '"') {
          if (text[index + 1] === '"') {
            field += '"';
            index += 1;
          } else {
            quoted = false;
          }
        } else {
          field += character;
        }
        continue;
      }

      if (character === '"' && field.length === 0) {
        quoted = true;
      } else if (character === ",") {
        row.push(field);
        field = "";
      } else if (character === "\n" || character === "\r") {
        if (character === "\r" && text[index + 1] === "\n") index += 1;
        row.push(field);
        field = "";
        if (row.some((cell) => cell !== "")) rows.push(row);
        row = [];
      } else {
        field += character;
      }
    }
    if (quoted) throw new TypeError("CSV 包含未闭合的引号");
    row.push(field);
    if (row.some((cell) => cell !== "")) rows.push(row);
    if (rows.length < 2) throw new TypeError("CSV 至少需要一行表头和一行数据");

    const headers = rows[0].map((header) => header.trim());
    if (headers.some((header) => !header)) throw new TypeError("CSV 表头不能为空");
    if (new Set(headers).size !== headers.length) throw new TypeError("CSV 表头不能重复");

    return rows.slice(1).map((cells, index) => {
      const record = Object.create(null);
      for (let column = 0; column < headers.length; column += 1) {
        record[headers[column]] = cells[column] ?? "";
      }
      return record;
    });
  }

  function parseJsonRecords(value, recordPath = "") {
    let records = value;
    if (recordPath) records = readPath(value, recordPath);
    if (!Array.isArray(records)) {
      throw new TypeError("JSON 数据必须是记录数组；如数组嵌套在对象中，请填写记录路径");
    }
    if (records.length > MAX_RECORDS) {
      throw new RangeError("单次最多转换 10,000 条记录");
    }
    return records;
  }

  function buildGamePackFromRecords(records, options = {}) {
    if (!Array.isArray(records)) throw new TypeError("来源记录必须是数组");
    if (records.length > MAX_RECORDS) throw new RangeError("单次最多转换 10,000 条记录");

    const game = options.game;
    const locale = options.locale;
    const fields = options.fields || {};
    const source = typeof options.source === "string" ? options.source.trim() : "";

    if (!game || typeof game !== "object" ||
        typeof game.appId !== "string" || !/^[1-9]\d{0,9}$/.test(game.appId) ||
        typeof game.name !== "string" || !game.name.trim()) {
      throw new TypeError("必须提供有效的游戏 AppID 和名称");
    }
    if (game.adapter !== "steam-community-market" || game.itemKey !== "market_hash_name") {
      throw new TypeError("当前转换器只生成 Steam market_hash_name 数据包");
    }
    if (typeof locale !== "string" || !/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(locale)) {
      throw new TypeError("目标语言代码无效");
    }
    if (!isSafePath(fields.marketHashName) || !isSafePath(fields.translation) ||
        (fields.sourceItemId && !isSafePath(fields.sourceItemId))) {
      throw new TypeError("必须指定安全、有效的 Steam 市场键字段和译文字段");
    }
    if (source.length > 128) throw new TypeError("数据来源标记不能超过 128 个字符");

    const stats = {
      scanned: records.length,
      imported: 0,
      duplicateRows: 0,
      missingMarketKey: 0,
      missingTranslation: 0,
      conflictingKeys: 0
    };
    const entriesByKey = new Map();
    const conflictedKeys = new Set();

    for (const record of records) {
      const rawKey = readPath(record, fields.marketHashName);
      const rawTranslation = readPath(record, fields.translation);
      const rawSourceId = fields.sourceItemId ? readPath(record, fields.sourceItemId) : undefined;

      if (typeof rawKey !== "string" || !rawKey || rawKey.trim() !== rawKey || rawKey.length > 512) {
        stats.missingMarketKey += 1;
        continue;
      }
      if (typeof rawTranslation !== "string" || !rawTranslation.trim() || rawTranslation.length > 1000) {
        stats.missingTranslation += 1;
        continue;
      }

      const entry = {
        marketHashName: rawKey,
        locale,
        translation: rawTranslation.trim(),
        ...(rawSourceId !== undefined && rawSourceId !== null && String(rawSourceId).trim()
          ? { sourceItemId: String(rawSourceId).trim() }
          : {}),
        ...(source ? { source } : {})
      };

      if (conflictedKeys.has(rawKey)) {
        stats.duplicateRows += 1;
        continue;
      }

      const previous = entriesByKey.get(rawKey);
      if (!previous) {
        entriesByKey.set(rawKey, entry);
        continue;
      }
      if (previous.translation === entry.translation &&
          (previous.sourceItemId || "") === (entry.sourceItemId || "")) {
        stats.duplicateRows += 1;
        continue;
      }

      entriesByKey.delete(rawKey);
      conflictedKeys.add(rawKey);
      stats.conflictingKeys += 1;
    }

    const translations = Array.from(entriesByKey.values());
    stats.imported = translations.length;
    return {
      pack: {
        format: PACK_FORMAT,
        schemaVersion: PACK_SCHEMA_VERSION,
        game: {
          appId: game.appId,
          name: game.name.trim(),
          adapter: "steam-community-market",
          itemKey: "market_hash_name",
          defaultLocale: locale,
          enabled: game.enabled !== false
        },
        translations
      },
      stats
    };
  }

  globalThis.__ALAXEE_STEAMHUB_SOURCE_RECORD_MAPPER__ = Object.freeze({
    parseCsv,
    parseJsonRecords,
    buildGamePackFromRecords,
    readPath
  });
})();
