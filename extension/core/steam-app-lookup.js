(() => {
"use strict";
const ORIGIN="https://store.steampowered.com";
const MAX_BYTES=1024*1024;
function normalizeAppId(value){
 const id=String(value??"").trim();
 if(!/^[1-9]\d{0,9}$/.test(id))throw new TypeError("请输入有效的 Steam AppID（纯数字）");
 return id;
}
function safeHttps(value){
 if(typeof value!=="string"||!value)return "";
 try{const url=new URL(value);return url.protocol==="https:"&&!url.username&&!url.password?url.href:"";}
 catch{return "";}
}
async function readBounded(response){
 const size=Number(response.headers?.get?.("content-length"));
 if(Number.isFinite(size)&&size>MAX_BYTES)throw new RangeError("Steam 返回的数据超过读取上限");
 if(!response.body?.getReader){
  const text=await response.text();
  if(new TextEncoder().encode(text).byteLength>MAX_BYTES)throw new RangeError("Steam 返回的数据超过读取上限");
  return text;
 }
 const reader=response.body.getReader(),decoder=new TextDecoder("utf-8",{fatal:true});
 let bytes=0,text="";
 try{
  while(true){
   const chunk=await reader.read();if(chunk.done)break;
   bytes+=chunk.value.byteLength;
   if(bytes>MAX_BYTES){await reader.cancel().catch(()=>{});throw new RangeError("Steam 返回的数据超过读取上限");}
   text+=decoder.decode(chunk.value,{stream:true});
  }
  return text+decoder.decode();
 }finally{reader.releaseLock?.();}
}
async function lookupSteamApp(rawId,options={}){
 const appId=normalizeAppId(rawId);
 const fetchImpl=options.fetchImpl||globalThis.fetch;
 const AbortControllerImpl=options.AbortControllerImpl||globalThis.AbortController;
 const setTimer=options.setTimeoutImpl||globalThis.setTimeout;
 const clearTimer=options.clearTimeoutImpl||globalThis.clearTimeout;
 if(typeof fetchImpl!=="function"||typeof AbortControllerImpl!=="function")throw new Error("当前环境不支持 Steam 游戏查询");
 if(typeof options.requestPermission!=="function"||!(await options.requestPermission(ORIGIN+"/*"))){
  throw new Error("需要允许一次 Steam 商店访问，才能根据 AppID 查询游戏名称");
 }
 const url=new URL("/api/appdetails",ORIGIN);
 url.searchParams.set("appids",appId);url.searchParams.set("l","schinese");
 url.searchParams.set("cc","us");url.searchParams.set("filters","basic");
 const controller=new AbortControllerImpl(),timeout=setTimer(()=>controller.abort(),options.timeoutMs||12000);
 try{
  const response=await fetchImpl(url.href,{
   method:"GET",credentials:"omit",referrerPolicy:"no-referrer",redirect:"error",
   cache:"no-store",headers:{Accept:"application/json"},signal:controller.signal
  });
  if(!response.ok)throw new Error("Steam 商店查询失败（HTTP "+response.status+"）");
  if(response.url&&new URL(response.url).origin!==ORIGIN)throw new Error("Steam 查询发生了非预期的跨站跳转，已停止");
  const payload=JSON.parse(await readBounded(response)),entry=payload?.[appId];
  if(!entry?.success||!entry.data||String(entry.data.steam_appid)!==appId)throw new Error("没有找到对应的 Steam 游戏，请检查 AppID");
  const data=entry.data;
  if(data.type!=="game"||typeof data.name!=="string"||!data.name.trim())throw new Error("该 AppID 对应的不是可配置的 Steam 游戏");
  return {
   appId,name:data.name.trim().slice(0,200),type:data.type,
   headerImage:safeHttps(data.header_image),website:safeHttps(data.website),
   developers:Array.isArray(data.developers)?data.developers.filter(x=>typeof x==="string").slice(0,5):[],
   publishers:Array.isArray(data.publishers)?data.publishers.filter(x=>typeof x==="string").slice(0,5):[],
   shortDescription:typeof data.short_description==="string"?data.short_description.trim().slice(0,500):"",
   fetchedAt:Date.now()
  };
 }catch(error){
  if(error?.name==="AbortError")throw new Error("Steam 游戏查询超时，请稍后重试");
  throw error;
 }finally{clearTimer(timeout);}
}
globalThis.__ALAXEE_STEAMHUB_STEAM_APP_LOOKUP__=Object.freeze({normalizeAppId,lookupSteamApp});
})();
