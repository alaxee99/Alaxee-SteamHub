(() => {
  "use strict";

  const DEFAULT_MAX_CHARS = 1024 * 1024;
  const DEFAULT_MAX_TABLES = 20;
  const DEFAULT_MAX_ROWS_PER_TABLE = 500;

  function textOf(node) {
    return String(node?.textContent || "").replace(/[\r\n\t]+/g, " ").trim();
  }

  function directCells(row) {
    return Array.from(row?.cells || []);
  }

  function parseHtmlTables(html, options = {}) {
    if (typeof html !== "string") throw new TypeError("HTML 页面内容必须是文本");
    const maxChars = Number.isSafeInteger(options.maxChars) && options.maxChars > 0
      ? Math.min(options.maxChars, DEFAULT_MAX_CHARS)
      : DEFAULT_MAX_CHARS;
    const maxTables = Number.isSafeInteger(options.maxTables) && options.maxTables > 0
      ? Math.min(options.maxTables, DEFAULT_MAX_TABLES)
      : DEFAULT_MAX_TABLES;
    const maxRowsPerTable = Number.isSafeInteger(options.maxRowsPerTable) && options.maxRowsPerTable > 0
      ? Math.min(options.maxRowsPerTable, DEFAULT_MAX_ROWS_PER_TABLE)
      : DEFAULT_MAX_ROWS_PER_TABLE;

    if (html.length > maxChars) throw new RangeError("HTML 页面超过 1 MiB 解析上限");
    const Parser = options.DOMParserImpl || globalThis.DOMParser;
    if (typeof Parser !== "function") throw new TypeError("当前环境不支持安全的 DOMParser");
    const parsedDocument = new Parser().parseFromString(html, "text/html");
    if (!parsedDocument || typeof parsedDocument.querySelectorAll !== "function") {
      throw new TypeError("HTML 页面解析失败");
    }

    // DOMParser creates an inert document. Remove active/irrelevant nodes as an additional
    // boundary; parsed nodes are never attached to the extension document.
    for (const node of parsedDocument.querySelectorAll(
      "script, style, noscript, iframe, object, embed, form, svg, canvas, template"
    )) {
      node.remove?.();
    }

    const pageTitle = textOf(parsedDocument.querySelector?.("title"));
    const pageHeadings = Array.from(parsedDocument.querySelectorAll("h1, h2, h3"))
      .map(textOf)
      .filter(Boolean)
      .slice(0, 10);
    const sourceUrl = typeof options.pageUrl === "string" ? options.pageUrl : "";
    const candidateTables = Array.from(parsedDocument.querySelectorAll("table")).slice(0, maxTables);
    const tables = [];
    let skippedTables = 0;

    for (let index = 0; index < candidateTables.length; index += 1) {
      const table = candidateTables[index];
      const rows = Array.from(table.querySelectorAll("tr"))
        .filter((row) => typeof row.closest !== "function" || row.closest("table") === table);
      if (!rows.length) {
        skippedTables += 1;
        continue;
      }

      let headerIndex = rows.findIndex((row) => {
        const cells = directCells(row);
        return cells.length > 0 && cells.every((cell) =>
          String(cell.tagName || "").toUpperCase() === "TH"
        );
      });
      if (headerIndex < 0) {
        const theadRows = Array.from(table.querySelectorAll("thead tr"));
        headerIndex = theadRows.length ? rows.indexOf(theadRows[0]) : -1;
      }
      if (headerIndex < 0) {
        skippedTables += 1;
        continue;
      }

      const headerCells = directCells(rows[headerIndex]);
      if (!headerCells.length || headerCells.some((cell) =>
        Number(cell.colSpan || 1) !== 1 || Number(cell.rowSpan || 1) !== 1
      )) {
        skippedTables += 1;
        continue;
      }

      const headers = headerCells.map((cell, columnIndex) => ({
        key: "column_" + (columnIndex + 1),
        label: textOf(cell) || ("未命名列 " + (columnIndex + 1))
      }));
      const records = [];
      let rowCount = 0;
      for (const row of rows.slice(headerIndex + 1)) {
        const cells = directCells(row);
        if (!cells.length || cells.every((cell) => !textOf(cell))) continue;
        if (cells.some((cell) => Number(cell.colSpan || 1) !== 1 || Number(cell.rowSpan || 1) !== 1)) {
          continue;
        }
        const record = Object.create(null);
        for (let columnIndex = 0; columnIndex < headers.length; columnIndex += 1) {
          record[headers[columnIndex].key] = textOf(cells[columnIndex]);
        }
        rowCount += 1;
        if (records.length < maxRowsPerTable) records.push(record);
      }

      if (!records.length) {
        skippedTables += 1;
        continue;
      }

      tables.push({
        index,
        caption: textOf(table.caption),
        ariaLabel: String(table.getAttribute?.("aria-label") || "").trim(),
        headers,
        records,
        rowCount,
        truncatedRows: rowCount > records.length
      });
    }

    return {
      pageUrl: sourceUrl,
      pageTitle,
      pageHeadings,
      tableCount: candidateTables.length,
      skippedTables,
      truncatedTables: candidateTables.length > maxTables,
      tables
    };
  }


  const MAX_CARD_SELECTORS = 30;
  const DEFAULT_MAX_CARDS = 500;
  const AUTO_ID_ATTRIBUTES = ["data-item-key", "data-item-id", "data-itemid", "data-id", "data-key"];

  function createInertDocument(html, Parser) {
    if (typeof Parser !== "function") throw new TypeError("当前环境不支持安全的 DOMParser");
    const parsedDocument = new Parser().parseFromString(html, "text/html");
    if (!parsedDocument || typeof parsedDocument.querySelectorAll !== "function") {
      throw new TypeError("HTML 页面解析失败");
    }
    for (const node of parsedDocument.querySelectorAll(
      "script, style, noscript, iframe, object, embed, form, svg, canvas, template"
    )) {
      node.remove?.();
    }
    return parsedDocument;
  }

  function getCardText(node) {
    return textOf(node).replace(/ +/g, " ");
  }

  function discoverHtmlCardSelectors(html, options = {}) {
    if (typeof html !== "string") throw new TypeError("HTML 页面内容必须是文本");
    const maxChars = Number.isSafeInteger(options.maxChars) && options.maxChars > 0
      ? Math.min(options.maxChars, DEFAULT_MAX_CHARS)
      : DEFAULT_MAX_CHARS;
    if (html.length > maxChars) throw new RangeError("HTML 页面超过 1 MiB 解析上限");

    const Parser = options.DOMParserImpl || globalThis.DOMParser;
    const parsedDocument = createInertDocument(html, Parser);
    const selectors = new Map();
    const addSelector = (selector, score, reason) => {
      if (!selectors.has(selector)) selectors.set(selector, { selector, score, reasons: new Set([reason]) });
      else {
        const current = selectors.get(selector);
        current.score = Math.max(current.score, score);
        current.reasons.add(reason);
      }
    };

    for (const element of parsedDocument.querySelectorAll("*")) {
      const tag = String(element.tagName || "").toLowerCase();
      if (tag === "article") addSelector("article", 6, "article");
      for (const attribute of AUTO_ID_ATTRIBUTES) {
        if (element.hasAttribute?.(attribute)) {
          addSelector("[" + attribute + "]", 18, attribute);
        }
      }
      const classes = Array.from(element.classList || []);
      for (const className of classes) {
        if (/^(?:item|card|product|entry|equipment|listing)(?:[-_]|$)|(?:^|[-_])(?:item|card|product|entry|equipment|listing)(?:[-_]|$)/i.test(className) &&
            /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(className)) {
          addSelector("." + className, 12, "semantic-class");
          if (/^[a-z][a-z0-9-]*$/.test(tag)) {
            addSelector(tag + "." + className, 13, "tag-and-class");
          }
        }
      }
    }

    const candidates = [];
    for (const candidate of selectors.values()) {
      let nodes;
      try {
        nodes = Array.from(parsedDocument.querySelectorAll(candidate.selector));
      } catch {
        continue;
      }
      if (nodes.length < 2 || nodes.length > DEFAULT_MAX_CARDS) continue;
      const sampleText = getCardText(nodes[0]).slice(0, 120);
      const averageTextLength = nodes.reduce((sum, node) => sum + getCardText(node).length, 0) / nodes.length;
      if (averageTextLength < 2 || averageTextLength > 4000) continue;
      candidates.push({
        selector: candidate.selector,
        count: nodes.length,
        score: candidate.score + (averageTextLength >= 12 && averageTextLength <= 1200 ? 3 : 0),
        reasons: Array.from(candidate.reasons),
        sampleText
      });
    }

    candidates.sort((left, right) =>
      right.score - left.score || left.count - right.count || left.selector.localeCompare(right.selector)
    );
    return candidates.slice(0, MAX_CARD_SELECTORS);
  }

  function findCardField(card, selector) {
    if (!selector) return null;
    if (typeof card.matches === "function" && card.matches(selector)) return card;
    return card.querySelector(selector);
  }

  function readCardId(node, card, attribute) {
    if (attribute === "textContent") return getCardText(node || card);
    const targets = node === card ? [card] : [node, card];
    if (attribute === "auto") {
      for (const target of targets) {
        for (const name of AUTO_ID_ATTRIBUTES) {
          const value = target?.getAttribute?.(name);
          if (typeof value === "string" && value.trim()) return value.trim();
        }
      }
      return "";
    }
    if (!/^[A-Za-z_:][A-Za-z0-9_.:-]{0,63}$/.test(attribute)) {
      throw new TypeError("来源 ID 属性名无效");
    }
    for (const target of targets) {
      const value = target?.getAttribute?.(attribute);
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
  }

  function parseHtmlCards(html, options = {}) {
    if (typeof html !== "string") throw new TypeError("HTML 页面内容必须是文本");
    const maxChars = Number.isSafeInteger(options.maxChars) && options.maxChars > 0
      ? Math.min(options.maxChars, DEFAULT_MAX_CHARS)
      : DEFAULT_MAX_CHARS;
    const maxCards = Number.isSafeInteger(options.maxCards) && options.maxCards > 0
      ? Math.min(options.maxCards, DEFAULT_MAX_CARDS)
      : DEFAULT_MAX_CARDS;
    if (html.length > maxChars) throw new RangeError("HTML 页面超过 1 MiB 解析上限");

    const cardSelector = typeof options.cardSelector === "string" ? options.cardSelector.trim() : "";
    const sourceIdSelector = typeof options.sourceIdSelector === "string" ? options.sourceIdSelector.trim() : "";
    const translationSelector = typeof options.translationSelector === "string"
      ? options.translationSelector.trim()
      : "";
    const sourceIdAttribute = typeof options.sourceIdAttribute === "string"
      ? options.sourceIdAttribute.trim()
      : "auto";
    if (!cardSelector || cardSelector.length > 256) throw new TypeError("请指定有效的商品卡片 CSS 选择器");
    if (!translationSelector || translationSelector.length > 256) {
      throw new TypeError("请指定商品译文 CSS 选择器");
    }
    if (sourceIdSelector.length > 256) throw new TypeError("来源 ID CSS 选择器过长");

    const Parser = options.DOMParserImpl || globalThis.DOMParser;
    const parsedDocument = createInertDocument(html, Parser);
    let cards;
    try {
      cards = Array.from(parsedDocument.querySelectorAll(cardSelector));
    } catch {
      throw new TypeError("商品卡片 CSS 选择器无效");
    }
    const totalCards = cards.length;
    const records = [];
    let missingSourceId = 0;
    let missingTranslation = 0;

    for (const card of cards.slice(0, maxCards)) {
      let idNode;
      let translationNode;
      try {
        idNode = sourceIdSelector ? findCardField(card, sourceIdSelector) : card;
        translationNode = findCardField(card, translationSelector);
      } catch {
        throw new TypeError("来源 ID 或译文 CSS 选择器无效");
      }
      const sourceId = readCardId(idNode, card, sourceIdAttribute);
      const translation = getCardText(translationNode);
      const titleNode = findCardField(card, "h1, h2, h3, h4, [itemprop='name'], [data-item-name]");
      const title = titleNode ? getCardText(titleNode) : "";
      if (!sourceId) missingSourceId += 1;
      if (!translation) missingTranslation += 1;
      if (!sourceId || !translation) continue;
      records.push({ sourceId, translation, title });
    }

    return {
      cardSelector,
      totalCards,
      scanned: Math.min(totalCards, maxCards),
      records,
      missingSourceId,
      missingTranslation,
      skipped: missingSourceId + missingTranslation,
      truncated: totalCards > maxCards
    };
  }



  const DEFAULT_DETAIL_SOURCE_LABELS = [
    "ItemKey", "Item Key", "Item ID", "ItemId", "ID", "物品ID", "物品 ID"
  ];
  const DEFAULT_DETAIL_TRANSLATION_LABELS = [
    "简体中文", "简体中文名", "中文名称", "中文名", "Chinese Name", "zh-CN", "zh-Hans"
  ];

  function normalizeDetailLabel(value) {
    return String(value || "").trim().toLowerCase().replace(/[\s_\-:：()（）\[\]]/g, "");
  }

  function parseDetailLabels(value, fallback) {
    const values = Array.isArray(value)
      ? value
      : typeof value === "string" && value.trim()
        ? value.split(/[|\n;]/)
        : fallback;
    return new Set(values.map(normalizeDetailLabel).filter(Boolean));
  }

  function parseHtmlDetailRecord(html, options = {}) {
    if (typeof html !== "string") throw new TypeError("HTML 页面内容必须是文本");
    const maxChars = Number.isSafeInteger(options.maxChars) && options.maxChars > 0
      ? Math.min(options.maxChars, DEFAULT_MAX_CHARS)
      : DEFAULT_MAX_CHARS;
    if (html.length > maxChars) throw new RangeError("HTML 页面超过 1 MiB 解析上限");

    const Parser = options.DOMParserImpl || globalThis.DOMParser;
    const parsedDocument = createInertDocument(html, Parser);
    const entries = [];
    const addEntry = (label, value) => {
      const cleanLabel = String(label || "").trim();
      const cleanValue = getCardText({ textContent: value || "" });
      if (cleanLabel && cleanValue) entries.push({ label: cleanLabel, value: cleanValue });
    };

    // Definition lists are the most explicit format for single-item property pages.
    for (const term of parsedDocument.querySelectorAll("dl dt")) {
      let sibling = term.nextElementSibling;
      while (sibling && String(sibling.tagName || "").toUpperCase() !== "DD" &&
          String(sibling.tagName || "").toUpperCase() !== "DT") {
        sibling = sibling.nextElementSibling;
      }
      if (sibling && String(sibling.tagName || "").toUpperCase() === "DD") {
        addEntry(textOf(term), textOf(sibling));
      }
    }

    // Only simple two-cell rows are interpreted as key/value properties.
    for (const row of parsedDocument.querySelectorAll("tr")) {
      const cells = Array.from(row.cells || []);
      if (cells.length !== 2) continue;
      const firstTag = String(cells[0]?.tagName || "").toUpperCase();
      if (firstTag !== "TH" && typeof cells[0]?.getAttribute !== "function") continue;
      addEntry(textOf(cells[0]), textOf(cells[1]));
    }

    for (const meta of parsedDocument.querySelectorAll("meta[name], meta[property], meta[itemprop]")) {
      const label = meta.getAttribute?.("name") || meta.getAttribute?.("property") ||
        meta.getAttribute?.("itemprop") || "";
      addEntry(label, meta.getAttribute?.("content") || "");
    }

    for (const element of parsedDocument.querySelectorAll("[itemprop]")) {
      if (String(element.tagName || "").toUpperCase() === "META") continue;
      addEntry(
        element.getAttribute?.("itemprop") || "",
        element.getAttribute?.("content") || textOf(element)
      );
    }

    for (const element of parsedDocument.querySelectorAll(
      "[data-item-key], [data-item-id], [data-itemid], [data-id], [data-key]"
    )) {
      for (const attribute of AUTO_ID_ATTRIBUTES) {
        const value = element.getAttribute?.(attribute);
        if (value) addEntry("ItemKey", value);
      }
    }

    const readSelectorValues = (selector, attribute, fieldName) => {
      if (!selector) return null;
      if (selector.length > 256) throw new TypeError(fieldName + " CSS 选择器过长");
      if (attribute !== "auto" && attribute !== "textContent" &&
          !/^[A-Za-z_:][A-Za-z0-9_.:-]{0,63}$/.test(attribute)) {
        throw new TypeError(fieldName + " 属性名无效");
      }
      let nodes;
      try {
        nodes = Array.from(parsedDocument.querySelectorAll(selector));
      } catch {
        throw new TypeError(fieldName + " CSS 选择器无效");
      }
      const values = [];
      for (const node of nodes) {
        let value = "";
        if (attribute === "textContent") {
          value = textOf(node);
        } else if (attribute === "auto") {
          if (String(node.tagName || "").toUpperCase() === "META") {
            value = node.getAttribute?.("content") || "";
          }
          if (!value) {
            for (const name of AUTO_ID_ATTRIBUTES) {
              value = node.getAttribute?.(name) || "";
              if (value) break;
            }
          }
          if (!value) value = node.getAttribute?.("value") || "";
          if (!value) value = textOf(node);
        } else {
          value = node.getAttribute?.(attribute) || "";
        }
        const clean = getCardText({ textContent: value });
        if (clean && !values.includes(clean)) values.push(clean);
      }
      return values;
    };

    const resolveLabel = (labels) => {
      const matches = entries.filter((entry) => labels.has(normalizeDetailLabel(entry.label)));
      const values = Array.from(new Set(matches.map((entry) => entry.value)));
      return {
        value: values.length === 1 ? values[0] : "",
        ambiguous: values.length > 1,
        matchedLabels: Array.from(new Set(matches.map((entry) => entry.label))),
        values
      };
    };

    const sourceIdSelector = typeof options.sourceIdSelector === "string"
      ? options.sourceIdSelector.trim()
      : "";
    const translationSelector = typeof options.translationSelector === "string"
      ? options.translationSelector.trim()
      : "";
    const sourceIdAttribute = typeof options.sourceIdAttribute === "string"
      ? options.sourceIdAttribute.trim() || "auto"
      : "auto";
    const translationAttribute = typeof options.translationAttribute === "string"
      ? options.translationAttribute.trim() || "textContent"
      : "textContent";

    const sourceIdResultRaw = sourceIdSelector
      ? (() => {
          const values = readSelectorValues(sourceIdSelector, sourceIdAttribute, "来源 ID");
          return {
            value: values.length === 1 ? values[0] : "",
            ambiguous: values.length > 1,
            matchedLabels: [],
            values
          };
        })()
      : resolveLabel(parseDetailLabels(options.sourceIdLabels, DEFAULT_DETAIL_SOURCE_LABELS));
    // Some Wiki themes display numeric item keys with a decorative leading hash.
    // Normalize only source IDs; never alter Steam market keys or localized text.
    const normalizedSourceIds = Array.from(new Set(
      sourceIdResultRaw.values
        .map((value) => String(value).trim().replace(/^#\s*/, ""))
        .filter(Boolean)
    ));
    const sourceIdResult = {
      ...sourceIdResultRaw,
      value: normalizedSourceIds.length === 1 ? normalizedSourceIds[0] : "",
      ambiguous: normalizedSourceIds.length > 1,
      values: normalizedSourceIds
    };

    const translationResult = translationSelector
      ? (() => {
          const values = readSelectorValues(translationSelector, translationAttribute, "译文");
          return {
            value: values.length === 1 ? values[0] : "",
            ambiguous: values.length > 1,
            matchedLabels: [],
            values
          };
        })()
      : resolveLabel(parseDetailLabels(options.translationLabels, DEFAULT_DETAIL_TRANSLATION_LABELS));

    const heading = parsedDocument.querySelector("h1");
    const ogTitle = parsedDocument.querySelector('meta[property="og:title"]');
    const titleNode = parsedDocument.querySelector("title");
    const title = textOf(heading) ||
      String(ogTitle?.getAttribute?.("content") || "").trim() ||
      textOf(titleNode);
    const pageTitle = textOf(titleNode) || title;
    const pageHeadings = Array.from(parsedDocument.querySelectorAll("h1, h2, h3"))
      .map(textOf)
      .filter(Boolean)
      .slice(0, 10);

    const valid = Boolean(
      sourceIdResult.value && translationResult.value &&
      !sourceIdResult.ambiguous && !translationResult.ambiguous
    );
    const record = valid
      ? { sourceId: sourceIdResult.value, translation: translationResult.value, title }
      : null;

    return {
      pageUrl: typeof options.pageUrl === "string" ? options.pageUrl : "",
      pageTitle,
      pageHeadings,
      title,
      sourceId: sourceIdResult.value,
      translation: translationResult.value,
      sourceIdCandidates: sourceIdResult.values,
      translationCandidates: translationResult.values,
      sourceIdLabels: sourceIdResult.matchedLabels,
      translationLabels: translationResult.matchedLabels,
      missingSourceId: !sourceIdResult.value && !sourceIdResult.ambiguous,
      missingTranslation: !translationResult.value && !translationResult.ambiguous,
      ambiguousSourceId: sourceIdResult.ambiguous,
      ambiguousTranslation: translationResult.ambiguous,
      records: record ? [record] : []
    };
  }


  globalThis.__ALAXEE_STEAMHUB_HTML_TABLE_PARSER__ = Object.freeze({
    parseHtmlTables,
    discoverHtmlCardSelectors,
    parseHtmlCards,
    parseHtmlDetailRecord
  });
})();
