import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertLoopbackWebSocketUrl, filterSteamTargets, isSteamPageUrl } from "../src/bridge.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test("recognizes Steam Community and Store subdomains only", () => {
  assert.equal(isSteamPageUrl("https://steamcommunity.com/market/listings/"), true);
  assert.equal(isSteamPageUrl("https://www.steamcommunity.com/market/"), true);
  assert.equal(isSteamPageUrl("https://store.steampowered.com/app/1/"), true);
  assert.equal(isSteamPageUrl("https://help.steampowered.com/en/"), true);
  assert.equal(isSteamPageUrl("https://notsteamcommunity.com/market/"), false);
  assert.equal(isSteamPageUrl("file:///C:/Steam/page.html"), false);
  assert.equal(isSteamPageUrl("steam://openurl/https://steamcommunity.com"), false);
});

test("filters out workers, browser targets and non-Steam websites", () => {
  const targets = filterSteamTargets([
    { id: "1", type: "page", url: "https://steamcommunity.com/market/", webSocketDebuggerUrl: "ws://localhost:8080/devtools/page/1" },
    { id: "2", type: "page", url: "https://example.com", webSocketDebuggerUrl: "ws://localhost:8080/devtools/page/2" },
    { id: "3", type: "service_worker", url: "https://steamcommunity.com/sw.js", webSocketDebuggerUrl: "ws://localhost:8080/devtools/page/3" },
    { id: "4", type: "browser", url: "", webSocketDebuggerUrl: "ws://localhost:8080/devtools/browser/4" }
  ]);
  assert.deepEqual(targets.map((target) => target.id), ["1"]);
});

test("rejects non-loopback and unexpected CDP endpoints", () => {
  assert.equal(assertLoopbackWebSocketUrl("ws://127.0.0.1:8080/devtools/page/1"), "ws://127.0.0.1:8080/devtools/page/1");
  assert.equal(assertLoopbackWebSocketUrl("ws://localhost:8080/devtools/browser/test"), "ws://localhost:8080/devtools/browser/test");
  assert.throws(() => assertLoopbackWebSocketUrl("ws://192.168.1.50:8080/devtools/page/1"), /non-loopback/);
  assert.throws(() => assertLoopbackWebSocketUrl("ws://127.0.0.1:9222/devtools/page/1"), /unexpected port/);
  assert.throws(() => assertLoopbackWebSocketUrl("https://127.0.0.1:8080/devtools/page/1"), /WebSocket protocol/);
});

test("page runtime is self-contained and only displays a probe on Steam hosts", async () => {
  const runtime = await readFile(path.join(root, "src", "page-runtime.js"), "utf8");
  assert.match(runtime, /steamcommunity\.com/);
  assert.match(runtime, /steampowered\.com/);
  assert.match(runtime, /ALAXEE · STANDALONE BRIDGE/);
  assert.doesNotMatch(runtime, /chrome\.runtime|document\.cookie|localStorage|sessionStorage/);
  assert.match(runtime, /prefers-reduced-motion/);
});

test("Windows launcher uses the CEF debug flag without enabling dev mode", async () => {
  const launcher = await readFile(path.join(root, "scripts", "Start-AlaxeeSteamBridge.ps1"), "utf8");
  assert.ok(launcher.includes("-cef-enable-debugging"));
  assert.match(launcher, /ArgumentList @\('-cef-enable-debugging'\)/);
  assert.doesNotMatch(launcher, /ArgumentList[^\r\n]*(?:-dev|cef-disable-sandbox|gamepadui)/);
  assert.ok(launcher.includes("Wait-SteamCdpLoopback"));
});
