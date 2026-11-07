import { readFile } from "node:fs/promises";
import { isSea } from "node:sea";
import { getSimplifiedChineseMarketUrl, isSteamPageUrl, runBridge } from "./src/bridge.mjs";

if (!isSea()) {
  throw new Error("This entry point must run inside the packaged ALAXEE SteamHub executable.");
}

if (process.argv[2] === "--self-test") {
  const runtime = await readFile(new URL("./src/page-runtime.js", import.meta.url), "utf8");
  if (!runtime.includes("ALAXEE · STANDALONE BRIDGE")) {
    throw new Error("The embedded Steam page runtime is missing or invalid.");
  }
  if (!isSteamPageUrl("https://steamcommunity.com/market/")) {
    throw new Error("The embedded Steam URL matcher failed its smoke test.");
  }
  if (getSimplifiedChineseMarketUrl("https://steamcommunity.com/market/?foo=bar") !==
      "https://steamcommunity.com/market/?foo=bar&l=schinese") {
    throw new Error("The embedded Steam Market locale helper failed its smoke test.");
  }
  console.log("ALAXEE SteamHub SEA self-test passed. Runtime and page assets are embedded.");
} else {
  const controller = new AbortController();
  process.once("SIGINT", () => controller.abort());
  process.once("SIGTERM", () => controller.abort());
  await runBridge({ signal: controller.signal });
}
