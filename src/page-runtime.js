(() => {
  "use strict";

  const VERSION = "0.1.0";
  const GLOBAL_KEY = "__ALAXEE_STEAM_STANDALONE_BRIDGE__";
  const BADGE_ID = "alaxee-steam-bridge-probe";
  const STEAM_ROOTS = ["steamcommunity.com", "steampowered.com", "steamstatic.com"];

  function isSteamHost(hostname) {
    const host = String(hostname || "").toLowerCase().replace(/\.$/, "");
    return STEAM_ROOTS.some((root) => host === root || host.endsWith(`.${root}`));
  }

  function pageKind(hostname) {
    const host = String(hostname || "").toLowerCase();
    if (host === "steamcommunity.com" || host.endsWith(".steamcommunity.com")) return "Steam Community / Market";
    if (host === "store.steampowered.com" || host.endsWith(".steampowered.com")) return "Steam Store";
    return "Steam page";
  }

  function mountProbeBadge() {
    if (!isSteamHost(location.hostname) || !document.documentElement) return false;
    if (document.getElementById(BADGE_ID)) return true;

    const host = document.createElement("div");
    host.id = BADGE_ID;
    host.style.cssText = [
      "all:initial", "position:fixed", "right:18px", "bottom:18px",
      "z-index:2147483647", "pointer-events:auto"
    ].join(";");

    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; color-scheme: dark; }
      .panel {
        display:flex; align-items:center; gap:10px; padding:9px 12px;
        border:1px solid rgba(180,164,255,.34); border-radius:13px;
        background:linear-gradient(135deg,rgba(20,25,42,.96),rgba(34,28,54,.95));
        color:#f3f0ff; box-shadow:0 12px 34px rgba(0,0,0,.34),inset 0 1px rgba(255,255,255,.1);
        font:12px/1.25 Inter,"Segoe UI",sans-serif; backdrop-filter:blur(18px);
      }
      .mark { width:27px;height:27px;display:grid;place-items:center;flex:none;border-radius:9px;
        background:linear-gradient(145deg,rgba(141,140,255,.24),rgba(105,221,242,.14));
        border:1px solid rgba(205,188,255,.28); }
      svg { width:24px;height:24px;overflow:visible; }
      .x { fill:none;stroke:url(#g);stroke-width:4.2;stroke-linecap:round; }
      .orbit { fill:none;stroke:url(#o);stroke-width:1.8;stroke-linecap:round;stroke-dasharray:9 4 17 7;animation:orbit 22s linear infinite; }
      .star { fill:#fff8e9;transform-box:fill-box;transform-origin:center;animation:breathe 4.8s ease-in-out infinite; }
      .copy { min-width:0; }
      .headline { font-weight:750;letter-spacing:.3px;white-space:nowrap; }
      .sub { margin-top:3px;color:#b9b3d0;font-size:10px;white-space:nowrap; }
      .status { width:7px;height:7px;margin-left:2px;border-radius:50%;background:#8be1cf;box-shadow:0 0 10px rgba(139,225,207,.65); }
      button { width:19px;height:19px;border:0;border-radius:6px;background:rgba(255,255,255,.08);color:#c9c2dc;font:14px/1 sans-serif;cursor:pointer; }
      button:hover { background:rgba(255,255,255,.18);color:#fff; }
      @keyframes orbit { to { stroke-dashoffset:-74; } }
      @keyframes breathe { 0%,100%{opacity:.72;transform:scale(.92)}50%{opacity:1;transform:scale(1.16)} }
      @media(prefers-reduced-motion:reduce){.orbit,.star{animation:none}}
    `;

    const panel = document.createElement("div");
    panel.className = "panel";
    const mark = document.createElement("div");
    mark.className = "mark";
    mark.innerHTML = `
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <defs>
          <linearGradient id="g" x1="9" y1="9" x2="41" y2="40"><stop stop-color="#FFD88A"/><stop offset=".48" stop-color="#D99CFF"/><stop offset="1" stop-color="#69DDF2"/></linearGradient>
          <linearGradient id="o" x1="7" y1="39" x2="43" y2="13"><stop stop-color="#8D8CFF"/><stop offset=".55" stop-color="#F2BC9B"/><stop offset="1" stop-color="#8AE8FF"/></linearGradient>
        </defs>
        <path class="orbit" d="M6.5 35.2c7.1 8.3 29.3 8.3 35.2-18.7"/>
        <path class="x" d="M13 12.5 35 35.5M35 12.5 13 35.5"/>
        <path d="M37.2 7.2v6.1m-3.05-3.05h6.1" stroke="#FFE5B6" stroke-width="1.3" stroke-linecap="round"/>
        <circle class="star" cx="37.2" cy="10.25" r="1.7"/>
      </svg>`;
    const copy = document.createElement("div");
    copy.className = "copy";
    const headline = document.createElement("div");
    headline.className = "headline";
    headline.textContent = "ALAXEE · STANDALONE BRIDGE";
    const sub = document.createElement("div");
    sub.className = "sub";
    sub.textContent = `${pageKind(location.hostname)} · 页面注入验证中`;
    copy.append(headline, sub);
    const status = document.createElement("span");
    status.className = "status";
    status.title = "本地 CDP 注入已连接";
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "×";
    close.title = "关闭此验证标记";
    close.setAttribute("aria-label", "关闭 ALAXEE 验证标记");
    close.addEventListener("click", () => host.remove(), { once: true });
    panel.append(mark, copy, status, close);
    shadow.append(style, panel);
    document.documentElement.append(host);
    return true;
  }

  const api = Object.freeze({ version: VERSION, mode: "standalone-cdp-probe", isSteamHost, mountProbeBadge });
  try {
    Object.defineProperty(globalThis, GLOBAL_KEY, {
      configurable: true, enumerable: false, writable: false, value: api
    });
  } catch {
    globalThis[GLOBAL_KEY] = api;
  }

  const mountWhenReady = () => {
    if (mountProbeBadge()) return;
    const observer = new MutationObserver(() => {
      if (mountProbeBadge()) observer.disconnect();
    });
    observer.observe(document, { childList: true, subtree: true });
  };

  if (document.documentElement) mountWhenReady();
  else document.addEventListener("DOMContentLoaded", mountWhenReady, { once: true });
  window.addEventListener("pageshow", mountWhenReady);
})();
