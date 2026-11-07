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
      "all:initial", "position:fixed", "right:16px", "bottom:16px",
      "z-index:2147483647", "pointer-events:auto"
    ].join(";");

    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
      :host { all:initial; color-scheme:dark; }
      .launcher {
        width:42px;height:42px;padding:0;display:grid;place-items:center;
        border:1px solid rgba(190,177,255,.42);border-radius:14px;
        background:linear-gradient(145deg,rgba(27,31,52,.96),rgba(43,34,66,.96));
        box-shadow:0 8px 24px rgba(0,0,0,.32),inset 0 1px rgba(255,255,255,.12);
        cursor:pointer;position:relative;transition:transform .18s ease,border-color .18s ease;
      }
      .launcher:hover { transform:translateY(-2px);border-color:rgba(211,194,255,.72); }
      .launcher:focus-visible,.action:focus-visible { outline:2px solid #a9e8f2;outline-offset:3px; }
      .mark { width:31px;height:31px;display:grid;place-items:center; }
      svg { width:29px;height:29px;overflow:visible; }
      .x { fill:none;stroke:url(#g);stroke-width:4.2;stroke-linecap:round; }
      .orbit { fill:none;stroke:url(#o);stroke-width:1.8;stroke-linecap:round;stroke-dasharray:9 4 17 7;animation:orbit 22s linear infinite; }
      .star { fill:#fff8e9;transform-box:fill-box;transform-origin:center;animation:breathe 4.8s ease-in-out infinite; }
      .status-dot { position:absolute;right:5px;top:5px;width:7px;height:7px;border-radius:50%;
        background:#8be1cf;box-shadow:0 0 9px rgba(139,225,207,.7);border:1px solid rgba(20,25,42,.9); }
      .popover {
        position:absolute;right:0;bottom:52px;width:236px;padding:13px;
        border:1px solid rgba(180,164,255,.32);border-radius:14px;
        background:linear-gradient(145deg,rgba(20,25,42,.98),rgba(34,28,54,.98));
        color:#f3f0ff;box-shadow:0 14px 38px rgba(0,0,0,.4),inset 0 1px rgba(255,255,255,.08);
        backdrop-filter:blur(18px);font:12px/1.4 Inter,"Segoe UI",sans-serif;
      }
      .popover[hidden] { display:none; }
      .top { display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:11px; }
      .title { font-size:12px;font-weight:750;letter-spacing:.25px; }
      .version { color:#a9a2c1;font-size:10px; }
      .row { display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0;border-top:1px solid rgba(255,255,255,.08); }
      .label { color:#aaa4c1; }
      .value { color:#e8e3f5;font-weight:600;text-align:right; }
      .connected { color:#8be1cf; }
      .footer { margin-top:9px;color:#9690ad;font-size:10px; }
      .action { width:100%;margin-top:11px;padding:8px 10px;border:1px solid rgba(190,177,255,.24);
        border-radius:9px;background:rgba(255,255,255,.07);color:#e9e4f5;font:600 11px Inter,"Segoe UI",sans-serif;cursor:pointer; }
      .action:hover { background:rgba(255,255,255,.13); }
      @keyframes orbit { to { stroke-dashoffset:-74; } }
      @keyframes breathe { 0%,100%{opacity:.72;transform:scale(.92)}50%{opacity:1;transform:scale(1.16)} }
      @media(prefers-reduced-motion:reduce){.orbit,.star,.launcher{animation:none;transition:none}}
    `;

    const launcher = document.createElement("button");
    launcher.className = "launcher";
    launcher.type = "button";
    launcher.setAttribute("aria-label", "打开 ALAXEE SteamHub 快捷面板");
    launcher.setAttribute("aria-expanded", "false");
    launcher.innerHTML = `
      <span class="mark" aria-hidden="true">
        <svg viewBox="0 0 48 48">
          <defs>
            <linearGradient id="g" x1="9" y1="9" x2="41" y2="40"><stop stop-color="#FFD88A"/><stop offset=".48" stop-color="#D99CFF"/><stop offset="1" stop-color="#69DDF2"/></linearGradient>
            <linearGradient id="o" x1="7" y1="39" x2="43" y2="13"><stop stop-color="#8D8CFF"/><stop offset=".55" stop-color="#F2BC9B"/><stop offset="1" stop-color="#8AE8FF"/></linearGradient>
          </defs>
          <path class="orbit" d="M6.5 35.2c7.1 8.3 29.3 8.3 35.2-18.7"/>
          <path class="x" d="M13 12.5 35 35.5M35 12.5 13 35.5"/>
          <path d="M37.2 7.2v6.1m-3.05-3.05h6.1" stroke="#FFE5B6" stroke-width="1.3" stroke-linecap="round"/>
          <circle class="star" cx="37.2" cy="10.25" r="1.7"/>
        </svg>
      </span>
      <span class="status-dot" aria-hidden="true"></span>`;

    const popover = document.createElement("section");
    popover.className = "popover";
    popover.hidden = true;
    popover.setAttribute("aria-label", "ALAXEE SteamHub 快捷面板");

    const top = document.createElement("div");
    top.className = "top";
    const title = document.createElement("div");
    title.className = "title";
    title.textContent = "ALAXEE STEAMHUB";
    const version = document.createElement("div");
    version.className = "version";
    version.textContent = `v${VERSION}`;
    top.append(title, version);

    const connectionRow = document.createElement("div");
    connectionRow.className = "row";
    const connectionLabel = document.createElement("span");
    connectionLabel.className = "label";
    connectionLabel.textContent = "桥接状态";
    const connectionValue = document.createElement("span");
    connectionValue.className = "value connected";
    connectionValue.textContent = "已连接";
    connectionRow.append(connectionLabel, connectionValue);

    const pageRow = document.createElement("div");
    pageRow.className = "row";
    const pageLabel = document.createElement("span");
    pageLabel.className = "label";
    pageLabel.textContent = "当前页面";
    const pageValue = document.createElement("span");
    pageValue.className = "value";
    pageValue.textContent = pageKind(location.hostname);
    pageRow.append(pageLabel, pageValue);

    const footer = document.createElement("div");
    footer.className = "footer";
    footer.textContent = "本地运行 · 不读取 Steam 账号凭据";

    const close = document.createElement("button");
    close.type = "button";
    close.className = "action";
    close.textContent = "收起面板";
    close.addEventListener("click", () => setOpen(false));

    popover.append(top, connectionRow, pageRow, footer, close);

    function setOpen(open) {
      popover.hidden = !open;
      launcher.setAttribute("aria-expanded", String(open));
      launcher.setAttribute("aria-label", open ? "关闭 ALAXEE SteamHub 快捷面板" : "打开 ALAXEE SteamHub 快捷面板");
    }

    launcher.addEventListener("click", () => setOpen(popover.hidden));
    close.addEventListener("click", () => setOpen(false));
    shadow.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !popover.hidden) {
        setOpen(false);
        launcher.focus();
      }
    });
    document.addEventListener("pointerdown", (event) => {
      if (!host.contains(event.target) && !event.composedPath().includes(host)) setOpen(false);
    });

    shadow.append(style, popover, launcher);
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
