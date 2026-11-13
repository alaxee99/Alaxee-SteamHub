import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pack=JSON.parse(await readFile(path.join(root,"extension/data/taskbar-hero-zh-CN.json"),"utf8"));
test("bundled Task Bar Hero pack has 1,116 exact Steam market translations",()=>{
 assert.equal(pack.format,"alaxee-steamhub-game-pack");assert.equal(pack.schemaVersion,1);
 assert.equal(pack.game.appId,"3678970");assert.equal(pack.translations.length,1116);
 assert.ok(pack.translations.every(entry=>entry.marketHashName&&entry.translation&&entry.locale==="zh-CN"));
});
test("quick source catalog includes the bundled Task Bar Hero pack and web search links",async()=>{
 const source=await readFile(path.join(root,"extension/core/game-source-catalog.js"),"utf8");
 assert.ok(source.includes('"3678970"'));assert.ok(source.includes("data/taskbar-hero-zh-CN.json"));
 assert.ok(source.includes("buildSearchLinks"));
});
