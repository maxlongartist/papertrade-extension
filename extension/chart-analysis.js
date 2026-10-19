import {analysisSettings,intervals,mapMarkets,parseCandles,indicatorSeries,parseLiquidationMap,fitTimeAxis,seriesPath,mapRangeForAxis} from './chart-analysis-data.js';
import {fitAxis} from './wallet-data.js';
const key='papertrade.chartAnalysis.v1',ns='http://www.w3.org/2000/svg';
export function mountChartAnalysis(root,{market,storage=chrome.storage.local,fetcher=fetch}={}){
  root.innerHTML=`<style>:host{display:block;margin:12px 0;color:#d9e4eb;font:12px/1.5 system-ui}section{border:1px solid #34434d;border-radius:8px;background:#151e24;padding:12px}header{display:flex;justify-content:space-between;align-items:center}h3{font-size:14px;margin:0}label{display:inline-flex;align-items:center;gap:5px;margin:7px 12px 0 0}input[type=number]{width:55px}input,select{color:#dae5ef;background:#202b35;border:1px solid #485764;border-radius:4px;padding:4px;max-width:100%}summary{cursor:pointer;color:#aebfcb}p{margin:7px 0 0;color:#9fb4c1}#readings{min-height:36px;font-variant-numeric:tabular-nums;color:#d5e3ee}#status{height:72px;overflow:auto;overflow-wrap:anywhere}small{color:#a0b5bf}input:focus-visible,select:focus-visible{outline:2px solid #bad9ef}</style>
  <section aria-label="Chart indicators"><header><h3>Chart indicators</h3><small>Read only</small></header>
  <label style="color:#b5a5ff"><input id="ema" type="checkbox">EMA</label><label style="color:#f4d47c"><input id="vwap" type="checkbox">VWAP</label><label><input id="heatmap" type="checkbox">Liquidation map</label>
  <div id="readings"></div><p id="status" role="status"></p><details><summary>Indicator settings &amp; sources</summary>
  <label>EMA period <input id="period" type="number" min="2" max="200" step="1" aria-label="EMA period"></label><label>Candles <select id="interval"><option>1m</option><option>5m</option><option>15m</option><option>1h</option></select></label>
  <label>Map range ± <select id="range"><option value="auto">Auto · visible chart</option>${['0.1','0.25','0.5','1','2','5','10','25'].map(x=>`<option value="${x}">${x}%</option>`).join('')}</select></label>
  <p>EMA uses candle closes (SMA seed). VWAP uses (high + low + close) / 3 weighted by base volume, resetting at 00:00 UTC. Both use Hyperliquid candles; the current candle is provisional. Candle interval is independent of the native chart.</p>
  <p>Lines follow verified native LIVE chart axes; use LIVE / RESET if alignment is unavailable. Historical panned views are hidden. Gaps break lines; incomplete session volume hides VWAP.</p>
  <p>Map: actual Papertrade open-position liquidation buckets, refreshed every 5 seconds. Green = long liquidations; red = short. Bars show USDC notional relative to the largest visible bucket. This is a current snapshot projected across the chart, not historical liquidity or a prediction. Positions beyond the requested range are excluded from the bands.</p>
  <p>This panel makes only public-data requests; no wallet, signing, trading, or analytics requests. Public requests go directly to Papertrade and Hyperliquid; browser/network providers see those requests.</p></details></section>`;
  const q=id=>root.getElementById(id);let settings=analysisSettings(),loaded=false,disposed=false,revision=0,saving=Promise.resolve(),candles=[],candleAt=0,map=null,nextCandle=0,nextMap=0,candleBusy=false,mapBusy=false,candleFailures=0,mapFailures=0,candleBlockedUntil=0,mapBlockedUntil=0,errors={candle:'',map:''},autoRange='0.1',overlay,svg,signature='',wasActive=false;
  const controllers=new Set();
  function putSettings(){for(const id of ['ema','vwap','heatmap'])q(id).checked=settings[id];for(const id of ['period','interval','range'])q(id).value=settings[id];}
  function save(){const value={...settings};saving=saving.catch(()=>{}).then(()=>storage.set({[key]:value})).catch(()=>{});}
  for(const id of ['ema','vwap','heatmap','period','interval','range'])q(id).onchange=()=>{
    if(id==='period'&&(!Number.isInteger(Number(q(id).value))||Number(q(id).value)<2||Number(q(id).value)>200)){q(id).setCustomValidity('Choose a whole number from 2 to 200.');q(id).reportValidity();return;}q(id).setCustomValidity('');
    const old=settings;settings=analysisSettings({...settings,[id]:['ema','vwap','heatmap'].includes(id)?q(id).checked:id==='period'?Number(q(id).value):q(id).value});revision++;loaded=true;abort();
    if(old.interval!==settings.interval||old.period!==settings.period){candles=[];candleAt=0;nextCandle=0;}if(old.range!==settings.range){map=null;nextMap=0;}signature='';save();tick();
  };
  putSettings();const initial=revision;void Promise.resolve().then(()=>storage.get(key)).then(value=>{if(disposed||initial!==revision)return;settings=analysisSettings(value?.[key]);putSettings();}).catch(()=>{}).finally(()=>{loaded=true;if(!disposed)tick();});
  function active(){return loaded&&!disposed&&document.visibilityState==='visible'&&document.documentElement.getAttribute('data-paperpilot-tools-hidden')!=='true'&&/^\/trade\//.test(location.pathname);}
  function abort(){for(const c of controllers)c.abort();controllers.clear();}
  async function request(url,options={}){
    const controller=new AbortController();controllers.add(controller);const timeout=setTimeout(()=>controller.abort(),8000);
    try{const response=await fetcher(url,{...options,credentials:'omit',cache:'no-store',signal:controller.signal});if(!response.ok){const error=Error(response.status===429?'Rate limited; backing off':`Public feed HTTP ${response.status}`);const retry=response.headers.get('Retry-After'),seconds=Number(retry);error.rateLimited=response.status===429;error.retryMs=Number.isFinite(seconds)&&seconds>0?seconds*1000:Math.max(0,Date.parse(retry)-Date.now());throw error;}const text=await response.text();if(text.length>2000000)throw Error('Public response too large');return JSON.parse(text);}finally{clearTimeout(timeout);controllers.delete(controller);}
  }
  function delay(failures,error){return Math.max(Math.min(60000,5000*2**Math.min(failures,4)),Math.min(300000,error.retryMs||0));}
  async function loadCandles(){
    if(candleBusy)return;candleBusy=true;const epoch=revision,chosen={...settings},now=Date.now(),step=intervals[chosen.interval],start=Math.floor(Math.min(Math.floor(now/86400000)*86400000,now-step*chosen.period*6)/step)*step;
    try{const raw=await request('https://api.hyperliquid.xyz/info',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'candleSnapshot',req:{coin:market,interval:chosen.interval,startTime:candles.length?Math.max(start,candles.at(-1).t-step):start,endTime:now}})});if(epoch!==revision||!active())return;
      const incoming=parseCandles(raw,market,chosen.interval);if(!incoming.length)throw Error('No candle history returned');const merged=new Map(candles.map(c=>[c.t,c]));for(const c of incoming)merged.set(c.t,c);const values=[...merged.values()].filter(c=>c.t>=start).sort((a,b)=>a.t-b.t).slice(-5000);
      if(Date.now()-values.at(-1).T>45000)throw Error('Candle source is stale');candles=values;candleAt=Date.now();candleFailures=0;errors.candle='';nextCandle=Date.now()+15000;signature='';
    }catch(error){if(epoch===revision&&active()){errors.candle=error.name==='AbortError'?'Candle request interrupted':error.message;nextCandle=Date.now()+delay(++candleFailures,error);if(error.rateLimited)candleBlockedUntil=nextCandle;}}finally{candleBusy=false;}
  }
  async function loadMap(){
    if(mapBusy)return;mapBusy=true;const epoch=revision,range=settings.range==='auto'?autoRange:settings.range;
    try{const raw=await request(`/query/markets/${mapMarkets[market].id}/liquidation-map?range=${range}`);if(epoch!==revision||!active())return;map=parseLiquidationMap(raw,market,range);mapFailures=0;errors.map='';nextMap=Date.now()+5000;signature='';}
    catch(error){if(epoch===revision&&active()){errors.map=error.name==='AbortError'?'Map request interrupted':error.message;nextMap=Date.now()+delay(++mapFailures,error);if(error.rateLimited)mapBlockedUntil=nextMap;}}finally{mapBusy=false;}
  }
  function node(tag,attrs,text){const e=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));if(text)e.textContent=text;return e;}
  function clear(){svg?.replaceChildren();signature='';}
  function render(){
    if(disposed)return;const now=Date.now(),enabled=settings.ema||settings.vwap||settings.heatmap;
    if(!mapMarkets[market]){q('status').textContent='Chart indicators currently support BTC and ETH.';return;}
    if(!active()||!enabled){clear();if(!enabled)q('readings').textContent='';q('status').textContent=!enabled?'Indicators off.':loaded?'Indicators paused while the tab or tools are hidden.':'Loading indicator settings…';return;}
    const chart=document.querySelector('#chart'),canvas=chart?.querySelector('canvas#cv');if(!chart||!canvas){clear();q('status').textContent='Waiting for the native chart.';return;}
    if(!overlay||!overlay.isConnected){overlay?.remove();overlay=document.createElement('div');overlay.id='paperpilot-analysis-overlay';overlay.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:7';const shadow=overlay.attachShadow({mode:'closed'});svg=node('svg',{'aria-label':'EMA VWAP and liquidation map',style:'position:absolute;overflow:hidden;pointer-events:none;font:10px system-ui'});shadow.append(svg);chart.append(overlay);}
    const rect=canvas.getBoundingClientRect(),cr=chart.getBoundingClientRect();Object.assign(svg.style,{left:rect.left-cr.left+'px',top:rect.top-cr.top+'px',width:rect.width+'px',height:rect.height+'px'});svg.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);
    let geometry,axis;try{const raw=canvas.getAttribute('data-paperpilot-axis');if(!raw||raw.length>40000)throw Error();geometry=JSON.parse(raw);if(geometry.route!==location.pathname||Math.abs(geometry.width-rect.width)>1||Math.abs(geometry.height-rect.height)>1||now-geometry.at>3000||geometry.at>now+1000)throw Error();axis=fitAxis(geometry.points,rect.width,rect.height);}catch{};
    if(axis&&settings.range==='auto'){const range=mapRangeForAxis(axis,rect.height-26);if(range!==autoRange){autoRange=range;nextMap=0;}}
    const freshCandle=candleAt&&now-candleAt<45000,freshMap=map&&now-Math.min(map.at,map.priceAt)<20000,series=freshCandle?indicatorSeries(candles,settings.period,settings.interval,now):{ema:[],vwap:[]};
    const fmt=v=>Number.isFinite(v)?'$'+v.toLocaleString(undefined,{maximumFractionDigits:2}):'—';q('readings').textContent=[settings.ema?`EMA ${settings.period} (${settings.interval}) ${fmt(series.ema.at(-1)?.value)}`:'',settings.vwap?`UTC VWAP (${settings.interval}) ${fmt(series.vwap.at(-1)?.value)}`:''].filter(Boolean).join(' · ');
    const live=Boolean(chart.querySelector('.live-btn:not(.reset)')),right=axis?Math.min(axis.right-5,rect.width-40):0,timeAxis=axis&&live?fitTimeAxis(geometry.times,right+40,rect.height,now):null;
    const messages=[];if(settings.ema||settings.vwap){messages.push(errors.candle||(!freshCandle?'Loading Hyperliquid candles…':`Hyperliquid · updated ${Math.floor((now-candleAt)/1000)}s ago`));if(settings.vwap&&freshCandle&&!series.vwap.length)messages.push('VWAP unavailable: complete UTC session volume required.');if(axis&&freshCandle){const outside=[settings.ema&&series.ema.at(-1),settings.vwap&&series.vwap.at(-1)].filter(Boolean).filter(p=>axis.slope*p.value+axis.intercept<0||axis.slope*p.value+axis.intercept>rect.height-26).length;if(outside)messages.push(`${outside} indicator level(s) outside price view; choose a wider native timeframe.`);}if(!timeAxis)messages.push('Indicator lines need a verified LIVE time scale; press native LIVE / RESET.');}
    if(settings.heatmap)messages.push(errors.map||(freshMap?`Papertrade map ±${map.range}% · block ${map.block} · ${Math.max(0,Math.floor((now-Math.min(map.at,map.priceAt))/1000))}s old`:'Waiting for a fresh Papertrade liquidation map…'));if(!axis)messages.push('Waiting for a verified price scale; pan / zoom to refresh.');const message=messages.join(' · ');if(q('status').textContent!==message)q('status').textContent=message;
    if(!axis){clear();return;}
    const sig=JSON.stringify([axis,timeAxis,settings,candleAt,freshCandle,map?.block,freshMap,rect.width,rect.height]);if(sig===signature)return;signature=sig;svg.replaceChildren();
    const height=rect.height-26,defs=node('defs',{}),clip=node('clipPath',{id:'analysis-plot-clip'});clip.append(node('rect',{x:0,y:0,width:right,height}));defs.append(clip);const plot=node('g',{'clip-path':'url(#analysis-plot-clip)'});svg.append(defs,plot);
    if(settings.heatmap&&freshMap){const visibleBuckets=map.buckets.filter(b=>axis.slope*b.low+axis.intercept>=0&&axis.slope*b.high+axis.intercept<=height),max=Math.max(1,...visibleBuckets.map(b=>b.long+b.short)),barWidth=Math.min(120,right*.2);let count=0;
      for(const b of map.buckets){const y1=axis.slope*b.high+axis.intercept,y2=axis.slope*b.low+axis.intercept;if(y2<0||y1>height||b.long+b.short===0)continue;const top=Math.max(0,y1),bottom=Math.min(height,y2),h=Math.max(.5,bottom-top),total=b.long+b.short,intensity=total/max;count++;
        for(const [side,color,size,offset]of [['long','#40c9aa',b.long,0],['short','#ed849d',b.short,b.long/max*barWidth]]){if(!size)continue;const w=size/max*barWidth,g=node('g',{'data-heatmap-side':side});g.append(node('rect',{x:0,y:top,width:right,height:h,fill:color,'fill-opacity':(.025+.12*size/max).toFixed(3)}),node('rect',{x:right-offset-w,y:top,width:Math.max(.3,w),height:h,fill:color,'fill-opacity':.35+.5*intensity}));g.append(node('title',{},`${side.toUpperCase()} liquidations · ${fmt(b.low)}–${fmt(b.high)} · ${fmt(size)} notional · ${side==='long'?b.longCount:b.shortCount} positions`));plot.append(g);}
      }
      const caption=`Papertrade liq map · ${count} visible buckets · block ${map.block}`;svg.append(node('rect',{x:3,y:height-21,width:Math.min(right-6,caption.length*5.6+10),height:18,rx:3,fill:'#13222f','fill-opacity':'.88'}),node('text',{x:8,y:height-8,fill:'#bad8df','data-map-caption':''},caption));
    }
    if(timeAxis&&freshCandle)for(const [id,color,show]of [['ema','#b5a5ff',settings.ema],['vwap','#f4d47c',settings.vwap]])if(show){const path=seriesPath(series[id],timeAxis,axis,timeAxis.from,timeAxis.to);if(path)plot.append(node('path',{'data-indicator':id,d:path,fill:'none',stroke:color,'stroke-width':1.8,'stroke-linejoin':'round'}));}
  }
  function tick(){
    if(disposed)return;const enabled=settings.ema||settings.vwap||settings.heatmap,run=active()&&enabled&&Boolean(mapMarkets[market]);document.documentElement.toggleAttribute('data-paperpilot-analysis-enabled',run);if(run)document.documentElement.setAttribute('data-paperpilot-analysis-enabled','true');
    if(!run&&wasActive)abort();wasActive=run;
    if(run){const now=Date.now();if((settings.ema||settings.vwap)&&now>=Math.max(nextCandle,candleBlockedUntil))void loadCandles();if(settings.heatmap&&now>=Math.max(nextMap,mapBlockedUntil))void loadMap();}render();
  }
  const timer=setInterval(tick,250);document.addEventListener('visibilitychange',tick);tick();return ()=>{disposed=true;revision++;abort();clearInterval(timer);document.removeEventListener('visibilitychange',tick);overlay?.remove();document.documentElement.removeAttribute('data-paperpilot-analysis-enabled');};
}
