import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const RUNTIME_PATH = path.join(ROOT, "src", "page-runtime.js");
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 8080;
const DEFAULT_POLL_MS = 1500;
const execFileAsync = promisify(execFile);

export function isSteamPageUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    return ["steamcommunity.com", "steampowered.com", "steamstatic.com"]
      .some((root) => host === root || host.endsWith(`.${root}`));
  } catch {
    return false;
  }
}

export function getSimplifiedChineseMarketUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const isCommunityHost = host === "steamcommunity.com" ||
      host.endsWith(".steamcommunity.com") ||
      host === "community.steamstatic.com";
    const isMarketPath = url.pathname === "/market" || url.pathname.startsWith("/market/");
    if ((url.protocol !== "http:" && url.protocol !== "https:") ||
        !isCommunityHost ||
        !isMarketPath) {
      return null;
    }
    if (url.searchParams.get("l") === "schinese") return null;
    url.searchParams.set("l", "schinese");
    return url.toString();
  } catch {
    return null;
  }
}

export function filterSteamTargets(targets) {
  if (!Array.isArray(targets)) return [];
  return targets.filter((target) =>
    target &&
    target.type === "page" &&
    typeof target.id === "string" &&
    typeof target.webSocketDebuggerUrl === "string" &&
    isSteamPageUrl(target.url)
  );
}

export function assertLoopbackWebSocketUrl(value, expectedPort = DEFAULT_PORT) {
  const url = new URL(value);
  if (url.protocol !== "ws:" && url.protocol !== "wss:") {
    throw new Error("Steam CDP returned an unsupported WebSocket protocol.");
  }
  if (!LOOPBACK_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error(`Refusing non-loopback CDP endpoint: ${url.hostname}`);
  }
  if (Number(url.port || (url.protocol === "wss:" ? 443 : 80)) !== Number(expectedPort)) {
    throw new Error(`Refusing CDP endpoint on unexpected port ${url.port || "default"}.`);
  }
  if (!url.pathname.startsWith("/devtools/")) {
    throw new Error("Refusing an unexpected CDP WebSocket path.");
  }
  return url.toString();
}

function parseArgs(argv) {
  const args = { host: DEFAULT_HOST, port: DEFAULT_PORT, pollMs: DEFAULT_POLL_MS };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === "--help" || value === "-h") args.help = true;
    else if (value === "--host") args.host = argv[++i];
    else if (value === "--port") args.port = Number(argv[++i]);
    else if (value === "--poll-ms") args.pollMs = Number(argv[++i]);
    else throw new Error(`Unknown argument: ${value}`);
  }
  if (!LOOPBACK_HOSTS.has(String(args.host).toLowerCase())) {
    throw new Error("Only localhost/127.0.0.1/::1 CDP connections are allowed.");
  }
  if (!Number.isInteger(args.port) || args.port < 1 || args.port > 65535) throw new Error("Invalid --port.");
  if (!Number.isInteger(args.pollMs) || args.pollMs < 500) throw new Error("--poll-ms must be at least 500.");
  return args;
}

function help() {
  return `ALAXEE Steam Standalone Bridge 0.1.0

Usage:
  node src/bridge.mjs [--port 8080] [--poll-ms 1500]

This prototype connects only to a local Steam CEF CDP endpoint. It does not
connect to remote hosts and does not read Steam cookies, tokens, or page text.

Steam must be started with -cef-enable-debugging before this helper runs.
`;
}

async function fetchJson(url, timeoutMs = 1800) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: "error" });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
  return response.json();
}

async function assertWindowsLoopbackBinding(port) {
  if (process.platform !== "win32") return;
  const command = `(Get-NetTCPConnection -State Listen -LocalPort ${Number(port)} -ErrorAction Stop | Select-Object -ExpandProperty LocalAddress) -join ','`;
  let stdout;
  try {
    ({ stdout } = await execFileAsync("powershell.exe", ["-NoLogo", "-NoProfile", "-Command", command], {
      timeout: 7000,
      windowsHide: true,
      maxBuffer: 16 * 1024
    }));
  } catch (error) {
    throw new Error(`Could not verify the CDP listener binding; refusing to attach: ${error.message}`);
  }
  const addresses = String(stdout).split(/[\r\n,]+/).map((value) => value.trim()).filter(Boolean);
  if (addresses.length === 0) throw new Error("Could not confirm a listening Steam CDP socket; refusing to attach.");
  const allowed = new Set(["127.0.0.1", "::1"]);
  const unsafe = addresses.filter((address) => !allowed.has(address.replace(/^\[|\]$/g, "")));
  if (unsafe.length > 0) {
    throw new Error(`Steam CDP is listening beyond loopback (${unsafe.join(", ")}); refusing to attach.`);
  }
}

class CdpClient {
  constructor(webSocket) {
    this.webSocket = webSocket;
    this.nextId = 1;
    this.pending = new Map();
    this.closed = false;

    webSocket.addEventListener("message", (event) => {
      let message;
      try { message = JSON.parse(String(event.data)); }
      catch { return; }
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(message.error.message || "CDP command failed"));
      else pending.resolve(message.result ?? {});
    });

    const failPending = (reason) => {
      this.closed = true;
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(reason);
      }
      this.pending.clear();
    };
    webSocket.addEventListener("close", () => failPending(new Error("Steam CDP target disconnected.")));
    webSocket.addEventListener("error", () => failPending(new Error("Steam CDP WebSocket error.")));
  }

  static async connect(url, timeoutMs = 8000) {
    if (typeof WebSocket !== "function") throw new Error("Node.js built-in WebSocket is unavailable. Node.js 22+ is required.");
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timed out connecting to Steam CDP target.")), timeoutMs);
      ws.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      ws.addEventListener("error", () => { clearTimeout(timer); reject(new Error("Unable to open Steam CDP target WebSocket.")); }, { once: true });
    });
    return new CdpClient(ws);
  }

  send(method, params = {}, timeoutMs = 10000) {
    if (this.closed || this.webSocket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("Steam CDP target is not connected."));
    }
    const id = this.nextId++;
    const message = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try { this.webSocket.send(message); }
      catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  close() {
    try { this.webSocket.close(); } catch { /* already closed */ }
  }
}

async function connectTarget(target, runtimeSource, expectedPort) {
  const safeUrl = assertLoopbackWebSocketUrl(target.webSocketDebuggerUrl, expectedPort);
  const client = await CdpClient.connect(safeUrl);
  try {
    await client.send("Page.enable");
    await client.send("Page.addScriptToEvaluateOnNewDocument", { source: runtimeSource });
    const localizedMarketUrl = getSimplifiedChineseMarketUrl(target.url);
    if (localizedMarketUrl) {
      // Steam Community supports this official locale parameter. Preserve the
      // search/listing query and fragment; do not change the global Steam language.
      await client.send("Page.navigate", { url: localizedMarketUrl });
      console.log("[ALAXEE] Applied Steam Community Market Simplified Chinese locale.");
    } else {
      await client.send("Runtime.evaluate", {
        expression: runtimeSource,
        awaitPromise: false,
        returnByValue: true
      });
    }
    return client;
  } catch (error) {
    client.close();
    throw error;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runBridge({ host = DEFAULT_HOST, port = DEFAULT_PORT, pollMs = DEFAULT_POLL_MS, signal } = {}) {
  if (!LOOPBACK_HOSTS.has(String(host).toLowerCase())) throw new Error("Remote CDP access is disabled by design.");
  const base = `http://${host === "[::1]" ? "[::1]" : host}:${port}`;
  const runtimeSource = await readFile(RUNTIME_PATH, "utf8");
  const attached = new Map();
  let warnedEndpoint = false;
  let announcedNoPages = false;

  console.log(`[ALAXEE] Standalone Steam bridge listening for local CDP at ${base}`);
  console.log("[ALAXEE] Only Steam Store/Community page targets are eligible for injection.");
  console.log("[ALAXEE] Market pages use Steam Simplified Chinese locale; no account data is read.");

  while (!signal?.aborted) {
    try {
      const version = await fetchJson(`${base}/json/version`);
      if (version?.webSocketDebuggerUrl) assertLoopbackWebSocketUrl(version.webSocketDebuggerUrl, port);
      await assertWindowsLoopbackBinding(port);
      warnedEndpoint = false;

      const targets = filterSteamTargets(await fetchJson(`${base}/json/list`));
      const activeIds = new Set(targets.map((target) => target.id));

      for (const [id, entry] of attached) {
        if (!activeIds.has(id)) {
          entry.client.close();
          attached.delete(id);
        }
      }

      for (const target of targets) {
        if (attached.has(target.id)) {
          attached.get(target.id).url = target.url;
          continue;
        }
        try {
          const client = await connectTarget(target, runtimeSource, port);
          attached.set(target.id, { client, url: target.url, title: target.title || "" });
          console.log(`[ALAXEE] Attached to Steam page target (${new URL(target.url).hostname}).`);
        } catch (error) {
          console.warn(`[ALAXEE] Could not attach to ${target.url}: ${error.message}`);
        }
      }

      if (targets.length === 0 && !announcedNoPages) {
        console.log("[ALAXEE] CDP is ready. Open a Steam Store or Community/Market page to test injection.");
        announcedNoPages = true;
      }
      if (targets.length > 0) announcedNoPages = false;
    } catch (error) {
      if (!warnedEndpoint) {
        console.warn(`[ALAXEE] Waiting for Steam CEF CDP: ${error.message}`);
        warnedEndpoint = true;
      }
    }
    await delay(pollMs);
  }

  for (const entry of attached.values()) entry.client.close();
  attached.clear();
  console.log("[ALAXEE] Bridge stopped. Steam remains running; exit Steam normally to close its CDP listener.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log(help());
    } else {
      const controller = new AbortController();
      process.once("SIGINT", () => controller.abort());
      process.once("SIGTERM", () => controller.abort());
      await runBridge({ host: args.host, port: args.port, pollMs: args.pollMs, signal: controller.signal });
    }
  } catch (error) {
    console.error(`[ALAXEE] ${error.message}`);
    process.exitCode = 1;
  }
}
