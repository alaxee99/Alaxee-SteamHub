(() => {
  "use strict";

  const API_KEY = "__ALAXEE_STEAMHUB_STORAGE_ADAPTER__";
  const KEY_PREFIX = "alaxee-steamhub:";
  if (globalThis[API_KEY]) return;

  function createChromeStorageAdapter(storageArea) {
    if (!storageArea ||
        typeof storageArea.get !== "function" ||
        typeof storageArea.set !== "function" ||
        typeof storageArea.remove !== "function") {
      throw new TypeError("A Chrome extension StorageArea is required.");
    }

    function assertKey(key) {
      if (typeof key !== "string" || !key.startsWith(KEY_PREFIX)) {
        throw new TypeError("SteamHub storage keys must use the alaxee-steamhub namespace.");
      }
    }

    return Object.freeze({
      async get(key) {
        assertKey(key);
        const result = await storageArea.get(key);
        return result && Object.prototype.hasOwnProperty.call(result, key)
          ? result[key]
          : null;
      },
      async set(key, value) {
        assertKey(key);
        await storageArea.set({ [key]: value });
      },
      async delete(key) {
        assertKey(key);
        await storageArea.remove(key);
      }
    });
  }

  Object.defineProperty(globalThis, API_KEY, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: Object.freeze({ createChromeStorageAdapter })
  });
})();
