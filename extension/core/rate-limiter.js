(() => {
  "use strict";

  const API_KEY = "__ALAXEE_STEAMHUB_RATE_LIMITER__";
  if (globalThis[API_KEY]) return;

  function createRateLimitedProvider(provider, options = {}) {
    if (!provider || typeof provider.lookup !== "function" ||
        typeof provider.id !== "string" || !provider.id.trim()) {
      throw new TypeError("A provider with id and lookup function is required.");
    }

    const minIntervalMs = Number.isFinite(options.minIntervalMs) && options.minIntervalMs >= 0
      ? options.minIntervalMs
      : 1000;
    const now = typeof options.now === "function" ? options.now : Date.now;
    const sleep = typeof options.sleep === "function"
      ? options.sleep
      : (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    let nextAllowedAt = 0;
    let queue = Promise.resolve();

    return Object.freeze({
      id: provider.id,
      lookup(request) {
        const task = queue.then(async () => {
          if (request?.signal?.aborted) throw new Error("Provider lookup aborted.");
          const waitMs = Math.max(0, nextAllowedAt - now());
          if (waitMs > 0) await sleep(waitMs);
          if (request?.signal?.aborted) throw new Error("Provider lookup aborted.");

          nextAllowedAt = now() + minIntervalMs;
          return provider.lookup(request);
        });

        queue = task.catch(() => undefined);
        return task;
      }
    });
  }

  Object.defineProperty(globalThis, API_KEY, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: Object.freeze({ createRateLimitedProvider })
  });
})();
