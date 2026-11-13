(() => {
  "use strict";

  const IMPORTER_AGENT = "ALAXEE-SteamHub-Importer";
  const DEFAULT_MAX_SITEMAPS = 8;
  const DEFAULT_MAX_URLS = 500;

  function decodeXml(value) {
    return value
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&apos;/gi, "'");
  }

  function extractLocs(xml) {
    if (typeof xml !== "string") throw new TypeError("Sitemap 内容必须是文本");
    const locations = [];
    const pattern = /<loc\b[^>]*>([\s\S]*?)<\/loc\s*>/gi;
    let match;
    while ((match = pattern.exec(xml)) !== null) {
      const value = decodeXml(match[1].trim());
      if (value) locations.push(value);
    }
    return locations;
  }

  function parseRobots(text, userAgent = IMPORTER_AGENT) {
    const groups = [];
    const sitemaps = [];
    let current = null;

    for (const rawLine of String(text || "").split(/\r?\n/)) {
      const line = rawLine.split("#", 1)[0].trim();
      if (!line) continue;
      const separator = line.indexOf(":");
      if (separator < 0) continue;
      const directive = line.slice(0, separator).trim().toLowerCase();
      const value = line.slice(separator + 1).trim();

      if (directive === "sitemap") {
        if (value) sitemaps.push(value);
        continue;
      }
      if (directive === "user-agent") {
        if (!current || current.rules.length > 0) {
          current = { agents: [], rules: [] };
          groups.push(current);
        }
        current.agents.push(value.toLowerCase());
        continue;
      }
      if ((directive === "allow" || directive === "disallow") && current && value) {
        current.rules.push({ directive, value });
      }
    }

    const agent = userAgent.toLowerCase();
    const specificGroups = groups.filter((group) =>
      group.agents.some((name) => name !== "*" && name && agent.includes(name))
    );
    const wildcardGroups = groups.filter((group) => group.agents.includes("*"));
    const selected = specificGroups.length ? specificGroups : wildcardGroups;
    return { groups: selected, sitemaps };
  }

  function robotsRuleMatches(rule, target) {
    let expression = "^";
    for (const character of rule.value) {
      if (character === "*") expression += ".*";
      else if (character === "$") expression += "$";
      else expression += character.replace(/[.*+?^{}()|[\]\\]/g, "\\$&");
    }
    if (!rule.value.endsWith("$")) expression += ".*";
    return new RegExp(expression).test(target);
  }

  function isRobotsAllowed(targetUrl, robots) {
    const pathAndQuery = targetUrl.pathname + targetUrl.search;
    const rules = robots.groups.flatMap((group) => group.rules)
      .filter((rule) => robotsRuleMatches(rule, pathAndQuery))
      .sort((left, right) =>
        right.value.replace(/\*/g, "").replace(/\$/g, "").length -
        left.value.replace(/\*/g, "").replace(/\$/g, "").length ||
        (left.directive === "allow" ? -1 : 1)
      );
    return !rules.length || rules[0].directive === "allow";
  }

  async function discoverSiteMap(rawUrl, options = {}) {
    const validateUrl = options.validatePublicHttpsUrl;
    const requestPermission = options.requestPermission;
    const fetchText = options.fetchText;
    const maxSitemaps = Number.isSafeInteger(options.maxSitemaps) && options.maxSitemaps > 0
      ? Math.min(options.maxSitemaps, DEFAULT_MAX_SITEMAPS)
      : DEFAULT_MAX_SITEMAPS;
    const maxUrls = Number.isSafeInteger(options.maxUrls) && options.maxUrls > 0
      ? Math.min(options.maxUrls, DEFAULT_MAX_URLS)
      : DEFAULT_MAX_URLS;

    if (typeof validateUrl !== "function" ||
        typeof requestPermission !== "function" ||
        typeof fetchText !== "function") {
      throw new TypeError("站点发现器缺少必要依赖");
    }

    const sourceUrl = validateUrl(rawUrl);
    const origin = sourceUrl.origin;
    const granted = await requestPermission(origin + "/*");
    if (!granted) throw new Error("未获准访问该站点，未读取目录");

    const fetchSameOriginText = async (target) => {
      const url = validateUrl(target);
      if (url.origin !== origin) throw new Error("站点目录包含跨域地址，已跳过");
      return fetchText(url.href);
    };

    let robotsText = "";
    let robotsError = "";
    try {
      const robotsResult = await fetchSameOriginText(origin + "/robots.txt");
      robotsText = robotsResult.text;
    } catch (error) {
      robotsError = error.message || "robots.txt 读取失败";
    }
    const robots = parseRobots(robotsText);

    const discoveredSitemaps = [];
    const initialSitemaps = [];
    if (/\.xml$/i.test(sourceUrl.pathname)) initialSitemaps.push(sourceUrl.href);
    for (const sitemap of robots.sitemaps) {
      try {
        const candidate = new URL(sitemap, origin);
        if (candidate.origin === origin && candidate.protocol === "https:") initialSitemaps.push(candidate.href);
      } catch {}
    }
    if (initialSitemaps.length === 0) initialSitemaps.push(origin + "/sitemap.xml");

    const queue = Array.from(new Set(initialSitemaps));
    const visitedSitemaps = new Set();
    const pageUrls = new Map();
    const errors = [];
    let blockedByRobots = 0;

    while (queue.length > 0 && visitedSitemaps.size < maxSitemaps && pageUrls.size < maxUrls) {
      const sitemapUrl = queue.shift();
      if (visitedSitemaps.has(sitemapUrl)) continue;
      visitedSitemaps.add(sitemapUrl);

      let sitemapText;
      try {
        const result = await fetchSameOriginText(sitemapUrl);
        sitemapText = result.text;
        discoveredSitemaps.push(sitemapUrl);
      } catch (error) {
        errors.push({ url: sitemapUrl, message: error.message || "sitemap 读取失败" });
        continue;
      }

      const locations = extractLocs(sitemapText);
      const isIndex = /<sitemapindex\b/i.test(sitemapText);
      for (const location of locations) {
        let candidate;
        try {
          candidate = validateUrl(new URL(location, sitemapUrl).href);
        } catch {
          continue;
        }
        if (candidate.origin !== origin) continue;

        if (isIndex) {
          if (queue.length + visitedSitemaps.size < maxSitemaps &&
              !visitedSitemaps.has(candidate.href) && !queue.includes(candidate.href)) {
            queue.push(candidate.href);
          }
          continue;
        }

        if (!isRobotsAllowed(candidate, robots)) {
          blockedByRobots += 1;
          continue;
        }
        pageUrls.set(candidate.href, candidate.href);
        if (pageUrls.size >= maxUrls) break;
      }
    }

    return {
      origin,
      sourceUrl: sourceUrl.href,
      robotsUrl: origin + "/robots.txt",
      robotsAvailable: Boolean(robotsText),
      robotsError,
      sitemaps: discoveredSitemaps,
      urls: Array.from(pageUrls.values()),
      blockedByRobots,
      truncated: queue.length > 0 || pageUrls.size >= maxUrls,
      sitemapLimitReached: visitedSitemaps.size >= maxSitemaps && queue.length > 0,
      errors
    };
  }

  globalThis.__ALAXEE_STEAMHUB_SITE_DISCOVERY__ = Object.freeze({
    extractLocs,
    parseRobots,
    isRobotsAllowed,
    discoverSiteMap
  });
})();
