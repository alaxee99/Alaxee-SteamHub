(() => {
  "use strict";

  const API_KEY = "__ALAXEE_STEAMHUB_RUNTIME_STATUS__";
  if (globalThis[API_KEY]) return;

  const state = {
    tone: "info",
    title: "SteamHub 正在启动",
    details: ["扩展内容脚本已载入，正在检查运行状态。"]
  };
  let host = null;
  let titleNode = null;
  let detailNode = null;
  let panelNode = null;
  let pendingObserver = null;
  let pendingMountListener = null;

  function render() {
    if (!titleNode || !detailNode) return;
    titleNode.textContent = state.title;
    titleNode.dataset.tone = state.tone;
    detailNode.textContent = state.details.join("\n");
  }

  function stopPendingMount() {
    if (pendingObserver) pendingObserver.disconnect();
    pendingObserver = null;
    if (pendingMountListener && typeof document?.removeEventListener === "function") {
      document.removeEventListener("DOMContentLoaded", pendingMountListener);
    }
    pendingMountListener = null;
  }

  function dismiss() {
    stopPendingMount();
    if (host?.isConnected) host.remove();
    host = null;
    titleNode = null;
    detailNode = null;
    panelNode = null;
  }

  function mount() {
    if (host?.isConnected) return true;
    if (!document?.createElement || !document.documentElement) return false;

    host = document.createElement("div");
    host.setAttribute("data-alaxee-steamhub-runtime-status", "0.9.5");
    host.style.cssText = "all:initial!important;position:fixed!important;right:12px!important;bottom:12px!important;z-index:2147483647!important;";

    const shadow = typeof host.attachShadow === "function"
      ? host.attachShadow({ mode: "open" })
      : host;
    const style = document.createElement("style");
    style.textContent = [
      ":host{all:initial;font-family:Arial,'Microsoft YaHei',sans-serif;color:#e8edf5;}",
      ".shell{all:initial;font-family:Arial,'Microsoft YaHei',sans-serif;color:#e8edf5;}",
      ".toggle{all:initial;display:block;max-width:min(360px,calc(100vw - 24px));box-sizing:border-box;padding:7px 11px;border:1px solid rgba(255,255,255,.18);border-radius:9px;background:rgba(22,27,36,.92);box-shadow:0 4px 18px rgba(0,0,0,.22);color:#e8edf5;font:12px/1.35 Arial,'Microsoft YaHei',sans-serif;cursor:pointer;}",
      ".toggle[data-tone='success']{border-color:rgba(61,190,130,.65);}",
      ".toggle[data-tone='warning']{border-color:rgba(225,171,67,.7);}",
      ".toggle[data-tone='error']{border-color:rgba(226,91,91,.75);}",
      ".panel{box-sizing:border-box;width:min(370px,calc(100vw - 24px));max-height:42vh;overflow:auto;margin:0 0 7px;padding:10px 12px;border:1px solid rgba(255,255,255,.16);border-radius:10px;background:rgba(17,21,29,.97);box-shadow:0 5px 22px rgba(0,0,0,.28);}",
      ".panel[hidden]{display:none;}",
      ".details{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;color:#c8d0dc;font:11px/1.55 Consolas,monospace;}"
    ].join("");
    const shell = document.createElement("div");
    shell.className = "shell";
    panelNode = document.createElement("div");
    panelNode.className = "panel";
    panelNode.hidden = true;
    detailNode = document.createElement("pre");
    detailNode.className = "details";
    panelNode.append(detailNode);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "toggle";
    button.addEventListener("click", () => {
      panelNode.hidden = !panelNode.hidden;
    });
    titleNode = button;
    shell.append(panelNode, button);
    shadow.append(style, shell);
    document.documentElement.append(host);
    render();
    return true;
  }

  function mountWhenAvailable() {
    if (mount()) {
      stopPendingMount();
      return true;
    }

    if (!pendingMountListener && typeof document?.addEventListener === "function") {
      pendingMountListener = () => {
        if (mount()) {
          render();
          stopPendingMount();
        }
      };
      document.addEventListener("DOMContentLoaded", pendingMountListener, { once: true });
    }

    if (!pendingObserver && typeof MutationObserver === "function" && document) {
      pendingObserver = new MutationObserver(() => {
        if (mount()) {
          render();
          stopPendingMount();
        }
      });
      pendingObserver.observe(document, { childList: true, subtree: true });
    }
    return false;
  }

  const api = Object.freeze({
    update(next) {
      if (next && typeof next === "object") {
        if (typeof next.tone === "string") state.tone = next.tone;
        if (typeof next.title === "string") state.title = next.title;
        if (Array.isArray(next.details)) state.details = next.details.map((value) => String(value));
      }
      mountWhenAvailable();
      render();
    },
    snapshot() {
      return Object.freeze({
        tone: state.tone,
        title: state.title,
        details: state.details.slice()
      });
    }
  });

  Object.defineProperty(globalThis, API_KEY, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: api
  });

})();