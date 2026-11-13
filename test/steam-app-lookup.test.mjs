import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source=await readFile(path.join(root,"extension/core/steam-app-lookup.js"),"utf8");
function loadApi(){
 const context=vm.createContext({URL,Object,String,Number,TypeError,RangeError,Error,TextDecoder,TextEncoder,Uint8Array,Array,Promise,Date,Math,AbortController,setTimeout,clearTimeout});
 vm.runInContext(source,context,{filename:"steam-app-lookup.js"});
 return context.__ALAXEE_STEAMHUB_STEAM_APP_LOOKUP__;
}
function response(payload,url="https://store.steampowered.com/api/appdetails"){
 const text=JSON.stringify(payload);
 return {ok:true,status:200,url,headers:{get:name=>name.toLowerCase()==="content-length"?String(text.length):null},async text(){return text;}};
}
test("Steam AppID lookup validates numeric IDs",()=>{
 const api=loadApi();
 for(const value of ["","0","-1","abc","12/34","12345678901"])assert.throws(()=>api.normalizeAppId(value),/AppID/);
 assert.equal(api.normalizeAppId(" 3678970 "),"3678970");
});
test("Steam AppID lookup requests only Store access and returns sanitized metadata",async()=>{
 const api=loadApi();let permission="",requestUrl="";
 const result=await api.lookupSteamApp("3678970",{
  requestPermission:async value=>{permission=value;return true;},
  fetchImpl:async(url,init)=>{
   requestUrl=url;assert.equal(init.credentials,"omit");assert.equal(init.redirect,"error");assert.equal(init.referrerPolicy,"no-referrer");
   return response({"3678970":{success:true,data:{steam_appid:3678970,type:"game",name:"Task Bar Hero",header_image:"https://shared.akamai.steamstatic.com/store_item_assets/header.jpg",website:"https://www.nugemstudio.com/",developers:["Nugem Studio"],publishers:["Nugem Studio"]}}});
  }
 });
 assert.equal(permission,"https://store.steampowered.com/*");
 assert.match(requestUrl,/appids=3678970/);assert.match(requestUrl,/l=schinese/);
 assert.equal(result.name,"Task Bar Hero");assert.equal(result.website,"https://www.nugemstudio.com/");
 assert.deepEqual(Array.from(result.developers),["Nugem Studio"]);
});
test("Steam AppID lookup rejects missing apps, non-game apps and cross-origin responses",async()=>{
 const api=loadApi(),permission=async()=>true;
 await assert.rejects(api.lookupSteamApp("3678970",{requestPermission:permission,fetchImpl:async()=>response({"3678970":{success:false}})}),/没有找到/);
 await assert.rejects(api.lookupSteamApp("3678970",{requestPermission:permission,fetchImpl:async()=>response({"3678970":{success:true,data:{steam_appid:3678970,type:"dlc",name:"DLC"}}})}),/不是可配置的 Steam 游戏/);
 await assert.rejects(api.lookupSteamApp("3678970",{requestPermission:permission,fetchImpl:async()=>response({"3678970":{success:true,data:{steam_appid:3678970,type:"game",name:"Game"}}},"https://evil.example/result")}),/跨站跳转/);
});
test("Steam AppID lookup does not fetch when optional permission is denied",async()=>{
 const api=loadApi();let fetched=false;
 await assert.rejects(api.lookupSteamApp("3678970",{requestPermission:async()=>false,fetchImpl:async()=>{fetched=true;}}),/允许一次 Steam 商店访问/);
 assert.equal(fetched,false);
});
