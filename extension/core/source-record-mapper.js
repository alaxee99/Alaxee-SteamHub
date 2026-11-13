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
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;
    let closedQuote = false;

    const finishField = () => {
      row.push(field);
      field = "";
      closedQuote = false;
    };
    const finishRow = () => {
      finishField();
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
    };

    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (quoted) {
        if (character === '"') {
          if (text[index + 1] === '"') {
            field += '"';
            index += 1;
          } else {
            quoted = false;
            closedQuote = true;
          }
        } else {
          field += character;
        }
        continue;
      }

      if (closedQuote) {
        if (character === ",") {
          finishField();
        } else if (character === "\n" || character === "\r") {
          if (character === "\r" && text[index + 1] === "\n") index += 1;
          finishRow();
        } else {
          throw new TypeError("CSV 引号结束后存在多余字符");
        }
      } else if (character === '"' && field.length === 0) {
        quoted = true;
      } else if (character === '"') {
        throw new TypeError("CSV 未加引号的字段中包含引号");
      } else if (character === ",") {
        finishField();
      } else if (character === "\n" || character === "\r") {
        if (character === "\r" && text[index + 1] === "\n") index += 1;
        finishRow();
      } else {
        field += character;
      }
    }

    if (quoted) throw new TypeError("CSV 包含未闭合的引号");
    finishRow();
    if (rows.length < 2) throw new TypeError("CSV 至少需要一行表头和一行数据");

    const headers = rows[0].map((header) => header.trim());
    if (headers.some((header) => !header)) throw new TypeError("CSV 表头不能为空");
    if (new Set(headers).size !== headers.length) throw new TypeError("CSV 表头不能重复");

    return rows.slice(1).map((cells, index) => {
      if (cells.length !== headers.length) {
        throw new TypeError("CSV 第 " + (index + 2) + " 行的列数与表头不一致");
      }
      const record = Object.create(null);
      for (let column = 0; column < headers.length; column += 1) {
        record[headers[column]] = cells[column];
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


  function buildGamePackFromSourceIds(records, options = {}) {
    if (!Array.isArray(records)) throw new TypeError("来源记录必须是数组");
    if (records.length > MAX_RECORDS) throw new RangeError("单次最多转换 10,000 条记录");

    const referencePack = options.referencePack;
    const locale = options.locale;
    const fields = options.fields || {};
    const source = typeof options.source === "string" ? options.source.trim() : "";

    if (!referencePack || typeof referencePack !== "object" ||
        referencePack.format !== PACK_FORMAT || referencePack.schemaVersion !== PACK_SCHEMA_VERSION ||
        !referencePack.game || referencePack.game.adapter !== "steam-community-market" ||
        referencePack.game.itemKey !== "market_hash_name" ||
        typeof referencePack.game.appId !== "string" ||
        !/^[1-9]\\d{0,9}$/.test(referencePack.game.appId) ||
        typeof referencePack.game.name !== "string" || !referencePack.game.name.trim() ||
        !Array.isArray(referencePack.translations)) {
      throw new TypeError("必须选择有效的 SteamHub 参考词库");
    }
    if (typeof locale !== "string" || !/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(locale)) {
      throw new TypeError("目标语言代码无效");
    }
    if (!isSafePath(fields.sourceItemId) || !isSafePath(fields.translation)) {
      throw new TypeError("必须指定安全、有效的来源 ID 字段和译文字段");
    }
    if (source.length > 128) throw new TypeError("数据来源标记不能超过 128 个字符");

    const marketNamesBySourceId = new Map();
    const ambiguousReferenceIds = new Set();
    for (const entry of referencePack.translations) {
      if (typeof entry?.marketHashName !== "string" ||
          !entry.marketHashName || entry.marketHashName.trim() !== entry.marketHashName ||
          entry.marketHashName.length > 512) continue;
      const rawId = entry.sourceItemId;
      if ((typeof rawId !== "string" && !(typeof rawId === "number" && Number.isSafeInteger(rawId))) ||
          !String(rawId) || String(rawId) !== String(rawId).trim()) continue;
      const sourceId = String(rawId);
      if (ambiguousReferenceIds.has(sourceId)) continue;
      const previous = marketNamesBySourceId.get(sourceId);
      if (previous && previous !== entry.marketHashName) {
        marketNamesBySourceId.delete(sourceId);
        ambiguousReferenceIds.add(sourceId);
      } else {
        marketNamesBySourceId.set(sourceId, entry.marketHashName);
      }
    }

    const stats = {
      scanned: records.length,
      imported: 0,
      duplicateRows: 0,
      missingSourceId: 0,
      missingTranslation: 0,
      unmatchedSourceId: 0,
      ambiguousSourceId: 0,
      conflictingKeys: 0,
      referenceIds: marketNamesBySourceId.size
    };
    const entriesByKey = new Map();
    const conflictedKeys = new Set();

    for (const record of records) {
      const rawId = readPath(record, fields.sourceItemId);
      const rawTranslation = readPath(record, fields.translation);

      if ((typeof rawId !== "string" && !(typeof rawId === "number" && Number.isSafeInteger(rawId))) ||
          !String(rawId) || String(rawId) !== String(rawId).trim() || String(rawId).length > 128) {
        stats.missingSourceId += 1;
        continue;
      }
      const sourceId = String(rawId);
      if (ambiguousReferenceIds.has(sourceId)) {
        stats.ambiguousSourceId += 1;
        continue;
      }
      const marketHashName = marketNamesBySourceId.get(sourceId);
      if (!marketHashName) {
        stats.unmatchedSourceId += 1;
        continue;
      }
      if (typeof rawTranslation !== "string" || !rawTranslation.trim() ||
          rawTranslation.length > 1000) {
        stats.missingTranslation += 1;
        continue;
      }

      const entry = {
        marketHashName,
        sourceItemId: sourceId,
        locale,
        translation: rawTranslation.trim(),
        ...(source ? { source } : {})
      };

      if (conflictedKeys.has(marketHashName)) {
        stats.duplicateRows += 1;
        continue;
      }

      const previous = entriesByKey.get(marketHashName);
      if (!previous) {
        entriesByKey.set(marketHashName, entry);
        continue;
      }
      if (previous.translation === entry.translation &&
          previous.sourceItemId === entry.sourceItemId) {
        stats.duplicateRows += 1;
        continue;
      }

      entriesByKey.delete(marketHashName);
      conflictedKeys.add(marketHashName);
      stats.conflictingKeys += 1;
    }

    const translations = Array.from(entriesByKey.values());
    stats.imported = translations.length;
    return {
      pack: {
        format: PACK_FORMAT,
        schemaVersion: PACK_SCHEMA_VERSION,
        game: {
          appId: referencePack.game.appId,
          name: referencePack.game.name.trim(),
          adapter: "steam-community-market",
          itemKey: "market_hash_name",
          defaultLocale: locale,
          enabled: referencePack.game.enabled !== false
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
    buildGamePackFromSourceIds,
    readPath
  });
})();
