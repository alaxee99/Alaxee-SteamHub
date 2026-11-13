(() => {
"use strict";
const SOURCES=Object.freeze({
 "3678970":Object.freeze([Object.freeze({
  id:"taskbarhero-bundled-dictionary",name:"Task Bar Hero 中文词库",
  provider:"Task Bar Trade Center 游戏物品目录",description:"1,106 条市场名称译文；附 10 条详情/属性精确译文和常见数值属性规则。未收录的独特描述保留原文。",
  locale:"zh-CN",translationCount:1106,detailTranslationCount:10,assetPath:"data/taskbar-hero-zh-CN.json",
  accessLabel:"内置词库 · 无需联网",personalUseNote:"数据包仅用于本地个人使用，不作为公开数据镜像再分发"
 })])
});
function listSources(appId){return(SOURCES[String(appId)]||[]).map(source=>({...source}));}
function buildSearchLinks(gameName){
 const name=String(gameName||"").trim();if(!name)return [];
 const query='"'+name+'" game wiki items database';
 return [
  {id:"google",label:"Google",url:"https://www.google.com/search?q="+encodeURIComponent(query)},
  {id:"bing",label:"Bing",url:"https://www.bing.com/search?q="+encodeURIComponent(query)},
  {id:"duckduckgo",label:"DuckDuckGo",url:"https://duckduckgo.com/?q="+encodeURIComponent(query)}
 ];
}
globalThis.__ALAXEE_STEAMHUB_GAME_SOURCE_CATALOG__=Object.freeze({listSources,buildSearchLinks});
})();
