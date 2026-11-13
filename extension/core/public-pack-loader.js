(() => {
  "use strict";

  const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
  const DEFAULT_TIMEOUT_MS = 20000;

  function validatePublicHttpsUrl(rawUrl) {
    if (typeof rawUrl !== "string" || rawUrl.length > 4096) {
      throw new TypeError("URL 无效或过长");
    }

    let url;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new TypeError("URL 格式无效");
    }

    const hostname = url.hostname.toLowerCase();
    const privateIPv4 = /^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2[0-9]|3[01])\.|0\.)/;
    const isIpv4Literal = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);

    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443") ||
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      privateIPv4.test(hostname) ||
      isIpv4Literal ||
      hostname.startsWith("[")
    ) {
      throw new TypeError("仅允许公开 HTTPS 地址；不支持本机、局域网或带凭据的 URL");
    }

    url.hash = "";
    return url;
  }

  async function fetchGamePackFromUrl(rawUrl, options = {}) {
    const url = validatePublicHttpsUrl(rawUrl);
    const requestPermission = options.requestPermission;
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    const normalizePack = options.normalizePack;
    const AbortControllerImpl = options.AbortControllerImpl || globalThis.AbortController;
    const setTimeoutImpl = options.setTimeoutImpl || globalThis.setTimeout;
    const clearTimeoutImpl = options.clearTimeoutImpl || globalThis.clearTimeout;
    const maxBytes = Number.isSafeInteger(options.maxBytes) && options.maxBytes > 0
      ? Math.min(options.maxBytes, DEFAULT_MAX_BYTES)
      : DEFAULT_MAX_BYTES;
    const timeoutMs = Number.isSafeInteger(options.timeoutMs) && options.timeoutMs > 0
      ? Math.min(options.timeoutMs, DEFAULT_TIMEOUT_MS)
      : DEFAULT_TIMEOUT_MS;

    if (typeof requestPermission !== "function" ||
        typeof fetchImpl !== "function" ||
        typeof normalizePack !== "function" ||
        typeof AbortControllerImpl !== "function" ||
        typeof setTimeoutImpl !== "function" ||
        typeof clearTimeoutImpl !== "function") {
      throw new TypeError("远程数据包读取器缺少必要依赖");
    }

    const permissionPattern = url.origin + "/*";
    // Call the permission API before the first await so a click handler can preserve user activation.
    const permissionRequest = requestPermission(permissionPattern);
    const granted = await permissionRequest;
    if (!granted) {
      throw new Error("未获准访问该站点，未读取数据");
    }

    const controller = new AbortControllerImpl();
    const timeoutId = setTimeoutImpl(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url.href, {
        method: "GET",
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        referrerPolicy: "no-referrer",
        headers: { Accept: "application/json, text/plain;q=0.9" },
        signal: controller.signal
      });

      if (!response || !response.ok) {
        throw new Error("数据源返回 HTTP " + (response?.status ?? "未知状态"));
      }
      if (response.url && new URL(response.url).origin !== url.origin) {
        throw new Error("数据源发生跨站跳转，已停止读取");
      }
      const declaredLength = Number(response.headers?.get?.("content-length") || 0);
      if (declaredLength > maxBytes) {
        controller.abort();
        throw new Error("数据包超过 5 MiB 上限");
      }
      if (!response.body || typeof response.body.getReader !== "function") {
        throw new Error("数据源没有返回可读取的内容");
      }

      const reader = response.body.getReader();
      const chunks = [];
      let totalBytes = 0;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        totalBytes += chunk.value.byteLength;
        if (totalBytes > maxBytes) {
          controller.abort();
          await reader.cancel().catch(() => {});
          throw new Error("数据包超过 5 MiB 上限");
        }
        chunks.push(chunk.value);
      }

      const bytes = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      const raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.format !== "alaxee-steamhub-game-pack" || parsed.schemaVersion !== 1) {
        throw new Error("该 URL 返回的不是 SteamHub Game Pack v1。普通 Wiki 页面需要独立解析适配器。");
      }

      return {
        pack: normalizePack(parsed),
        sourceUrl: url.href,
        byteLength: totalBytes
      };
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error("读取超时（20 秒）");
      }
      throw error;
    } finally {
      clearTimeoutImpl(timeoutId);
    }
  }

  globalThis.__ALAXEE_STEAMHUB_PUBLIC_PACK_LOADER__ = Object.freeze({
    validatePublicHttpsUrl,
    fetchGamePackFromUrl
  });
})();
