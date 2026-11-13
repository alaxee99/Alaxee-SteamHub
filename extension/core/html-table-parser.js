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

  globalThis.__ALAXEE_STEAMHUB_HTML_TABLE_PARSER__ = Object.freeze({
    parseHtmlTables
  });
})();
