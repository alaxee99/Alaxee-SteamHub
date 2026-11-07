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

test("Windows launchers use the bundled executable and need no Node.js installation", async () => {
  const launcher = await readFile(path.join(root, "scripts", "Start-AlaxeeSteamBridge.ps1"), "utf8");
  const attach = await readFile(path.join(root, "scripts", "Attach-ToRunningSteam.ps1"), "utf8");
  assert.match(launcher, /^[\x00-\x7F]*$/, "The PowerShell launcher must remain ASCII-only for Windows PowerShell 5.1.");
  assert.match(attach, /^[\x00-\x7F]*$/, "The attach script must remain ASCII-only for Windows PowerShell 5.1.");
  assert.ok(launcher.includes("AlaxeeSteamBridge.exe"));
  assert.ok(attach.includes("AlaxeeSteamBridge.exe"));
  assert.doesNotMatch(launcher, /Resolve-NodeExecutable|node\.exe|node src/);
  assert.doesNotMatch(attach, /Resolve-NodeExecutable|node\.exe|node src/);
  assert.ok(launcher.includes("-cef-enable-debugging"));
  assert.match(launcher, /ArgumentList @\('-cef-enable-debugging'\)/);
  assert.doesNotMatch(launcher, /ArgumentList[^\r\n]*(?:-dev|cef-disable-sandbox|gamepadui)/);
  assert.ok(launcher.includes("Wait-SteamCdpLoopback"));
});

test("the Windows SEA entry point checks bundled assets and starts the bridge", async () => {
  const entry = await readFile(path.join(root, "build", "sea-entry.mjs"), "utf8");
  assert.ok(entry.includes('from "node:sea"'));
  assert.ok(entry.includes("isSea()"));
  assert.ok(entry.includes("--self-test"));
  assert.ok(entry.includes('new URL("./src/page-runtime.js", import.meta.url)'));
  assert.ok(entry.includes("runBridge({ signal: controller.signal })"));
});

test("Windows installer is scoped to SteamHub data and supports an explicit keep-data uninstall", async () => {
  const installer = await readFile(path.join(root, "installer", "ALAXEE-SteamHub.iss"), "utf8");
  assert.equal(installer.charCodeAt(0), 0xfeff, "Inno Setup script must retain its UTF-8 BOM for Chinese installer messages.");
  assert.match(installer, /PrivilegesRequired=lowest/);
  assert.match(installer, /ArchitecturesAllowed=x64/);
  assert.match(installer, /Uninstallable=yes/);
  assert.match(installer, /DefaultDirName=\{localappdata\}\\Programs\\ALAXEE\\SteamHub/);
  assert.ok(installer.includes("Stop-AlaxeeSteamBridge.ps1"));
  assert.ok(installer.includes("WindowsPowerShell\\v1.0\\powershell.exe"));
  assert.ok(installer.includes("StopScriptLog :="), "Uninstall hook must define a persistent diagnostic log path.");
  assert.ok(installer.includes("LaunchSucceeded := Exec("), "Uninstall hook must record whether PowerShell actually launched.");
  assert.ok(installer.includes("FileExists(StopScript)"), "Uninstall hook must fail closed if the bundled stopper is missing.");
  assert.match(installer, /DelTree\(LocalDataPath, True, True, True\)/);
  assert.equal((installer.match(/DelTree\(/g) || []).length, 1, "Only the dedicated SteamHub data directory may be recursively deleted.");
  assert.match(installer, /UninstallParameterExists\('\/KEEPLOCALDATA'\)/);
  assert.match(installer, /Supabase 云端账号和跨设备同步数据不会被删除/);
  assert.match(installer, /Name: "\{autoprograms\}\\ALAXEE SteamHub"/);
  assert.doesNotMatch(installer, /SteamLibrary|steamapps|steam\.exe/i, "The installer must not target Steam installation or save paths.");

  const verify = await readFile(path.join(root, "scripts", "Verify-WindowsInstaller.ps1"), "utf8");
  assert.match(verify, /^[\x00-\x7F]*$/, "Installer verification must remain ASCII-only.");
  const stop = await readFile(path.join(root, "scripts", "Stop-AlaxeeSteamBridge.ps1"), "utf8");
  assert.match(stop, /^[\x00-\x7F]*$/, "The process stopper must remain ASCII-only.");
  assert.ok(stop.includes("[System.IO.Path]::GetFullPath"));
  assert.ok(stop.includes("Stop-Process -Id"));
  assert.ok(stop.includes("[System.StringComparison]::OrdinalIgnoreCase"));
  assert.ok(verify.includes("/KEEPLOCALDATA"));
  assert.ok(verify.includes("$keepUninstallLogPath"), "Keep-data uninstall must write an Inno Setup diagnostic log.");
  assert.ok(verify.includes("$purgeUninstallLogPath"), "Full-cleanup uninstall must write an Inno Setup diagnostic log.");
  assert.ok(verify.includes("purge-data-test.sentinel"));
  assert.ok(verify.includes("OtherProduct-"));
  assert.ok(verify.includes("steamapps\\userdata"));
  assert.ok(verify.includes("process shutdown"));
  assert.ok(verify.includes("Assert-ExternalFilesPreserved"));
  assert.ok(verify.includes("Get-RegisteredInstallRoot"));
  assert.ok(verify.includes("InstallLocation"));
  assert.ok(verify.includes("DisplayIcon"));
  assert.ok(verify.includes("UninstallString"));
  assert.ok(verify.includes("Remove-DirectoryOnlyWhenEmpty"));
  assert.doesNotMatch(verify, /Remove-Item -LiteralPath \$programsAlaxeeRoot/);
  assert.doesNotMatch(verify, /Remove-Item -LiteralPath \$alaxeeDataRoot/);
  assert.ok(verify.includes("Remove-Item -LiteralPath $otherProgramRoot -Recurse -Force"));
  assert.ok(verify.includes("Remove-Item -LiteralPath $otherDataRoot -Recurse -Force"));
  assert.ok(verify.includes("Start-Process -FilePath"));
});

test("packaging selects Inno Setup 7 rather than a stale compiler shim", async () => {
  const build = await readFile(path.join(root, "scripts", "Build-WindowsPackage.ps1"), "utf8");
  const workflow = await readFile(path.join(root, ".github", "workflows", "ci.yml"), "utf8");
  assert.ok(build.includes("Inno Setup 7 compiler"));
  assert.ok(build.includes("$compilerCandidates | Where-Object"));
  assert.match(build, /compilerDetails -match 'Inno Setup 7'/);
  assert.doesNotMatch(build, /Inno Setup 6/);
  assert.ok(workflow.includes("Install Inno Setup 7.1.1"));
  assert.ok(workflow.includes("Inno Setup 7 compiler"));
  assert.doesNotMatch(workflow, /Inno Setup 6/);
});

test("all Windows PowerShell scripts are ASCII-only for Windows PowerShell 5.1", async () => {
  const scriptPaths = [
    "scripts/Assert-SteamCdpLoopback.ps1",
    "scripts/Attach-ToRunningSteam.ps1",
    "scripts/Build-WindowsPackage.ps1",
    "scripts/Start-AlaxeeSteamBridge.ps1",
    "scripts/Stop-AlaxeeSteamBridge.ps1",
    "scripts/Verify-WindowsInstaller.ps1"
  ];
  for (const relativePath of scriptPaths) {
    const script = await readFile(path.join(root, relativePath), "utf8");
    assert.match(script, /^[\x00-\x7F]*$/, relativePath + " must stay ASCII-only for Windows PowerShell 5.1.");
  }

  const guard = await readFile(path.join(root, "scripts", "Assert-SteamCdpLoopback.ps1"), "utf8");
  assert.ok(guard.includes("$ws.DnsSafeHost"), "IPv6 loopback hostnames must be normalized without bracket parsing.");

  const build = await readFile(path.join(root, "scripts", "Build-WindowsPackage.ps1"), "utf8");
  assert.ok(build.includes("--build-sea"));
  assert.ok(build.includes("vfsArchive"));
  assert.ok(build.includes("--self-test"));
  assert.ok(build.includes("ISCC.exe"));
  assert.ok(build.includes("Verify-WindowsInstaller.ps1"));
  assert.ok(build.includes("Stop-AlaxeeSteamBridge.ps1"));
  assert.ok(build.includes("ALAXEE-SteamHub-Setup-x64.exe"));
});
