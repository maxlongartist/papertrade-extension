import {decodeBbo,decodeBook,fresh} from './core.js';
const markets=['BTC','ETH'];
export function createMarketFeed({onQuote=()=>{},onStatus=()=>{},socket=url=>new WebSocket(url),now=()=>Date.now(),schedule=setTimeout,cancel=clearTimeout}={}){
 let ws=null,retry=null,watchdog=null,stopped=true,attempt=0,startedAt=0;
 let progress={},sourceTimes={};
 const status=value=>onStatus(value);
 function armRetry(){if(stopped||retry!==null)return;const delay=Math.min(30000,2000*2**Math.min(attempt++,4));retry=schedule(()=>{retry=null;connect();},delay);}
 function retire(current,reason){if(ws!==current)return;ws=null;if(watchdog!==null)cancel(watchdog);watchdog=null;status(reason);try{current.close();}catch{}armRetry();}
 function armWatchdog(current){
  if(watchdog!==null)cancel(watchdog);
  const due=Math.min(...markets.map(m=>(progress[m]??startedAt)+10000));
  watchdog=schedule(()=>{watchdog=null;if(ws!==current)return;const stalled=markets.filter(m=>now()-(progress[m]??startedAt)>=10000);if(stalled.length)retire(current,'Reconnecting · '+stalled.join(' / ')+' feed stalled');else armWatchdog(current);},Math.max(1,due-now()));
 }
 function connect(){
  if(stopped||retry!==null||ws&&[0,1].includes(ws.readyState))return;
  let current;status('Connecting');
  try{current=socket('wss://api.hyperliquid.xyz/ws');}catch{status('Reconnecting · price connection unavailable');armRetry();return;}
  ws=current;startedAt=now();progress={};sourceTimes={};armWatchdog(current);
  current.onopen=()=>{if(ws!==current)return;try{status('Waiting for BTC / ETH quotes');for(const coin of markets)for(const type of ['bbo','l2Book'])current.send(JSON.stringify({method:'subscribe',subscription:{type,coin}}));}catch{retire(current,'Reconnecting · price subscription unavailable');}};
  current.onmessage=event=>{
   if(ws!==current)return;
   let tick;
   try{if(typeof event.data!=='string'||event.data.length>1048576)return;const {channel,data}=JSON.parse(event.data);if(!['bbo','l2Book'].includes(channel))return;tick=channel==='bbo'?decodeBbo(data,now()):decodeBook(data,now());if(!markets.includes(tick.market)||!fresh(tick,now())||tick.sourceAt<(sourceTimes[tick.market]??-Infinity))return;}catch{return;}
   if(tick.sourceAt>(sourceTimes[tick.market]??-Infinity)){
    sourceTimes[tick.market]=tick.sourceAt;progress[tick.market]=now();armWatchdog(current);
    if(markets.every(m=>progress[m]!=null)){attempt=0;status('Live');}
   }
   // Storage/page errors belong to the engine and must not become unhandled
   // rejections or mistaken transport retries.
   try{void Promise.resolve(onQuote(tick)).catch(()=>{});}catch{}
  };
  current.onerror=()=>retire(current,'Reconnecting · price connection error');
  current.onclose=()=>retire(current,'Reconnecting · price connection closed');
 }
 return {
  start(){stopped=false;connect();},
  ping(){if(ws?.readyState!==1)return;const current=ws;try{current.send(JSON.stringify({method:'ping'}));}catch{retire(current,'Reconnecting · price ping failed');}},
  stop(){stopped=true;if(retry!==null)cancel(retry);if(watchdog!==null)cancel(watchdog);retry=watchdog=null;const old=ws;ws=null;try{old?.close();}catch{}status('Disconnected');},
 };
}
