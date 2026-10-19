// Display-only calculations. No execution authority or inferred liquidation levels.
export const intervals={'1m':60000,'5m':300000,'15m':900000,'1h':3600000};
export const mapMarkets={BTC:{id:0,scale:10},ETH:{id:1,scale:100}};
export function analysisSettings(value={}){
  return {ema:value.ema!==false,vwap:value.vwap!==false,heatmap:value.heatmap!==false,period:Number.isInteger(value.period)&&value.period>=2&&value.period<=200?value.period:20,interval:Object.hasOwn(intervals,value.interval)?value.interval:'1m',range:['auto','0.1','0.25','0.5','1','2','5','10','25'].includes(value.range)?value.range:'auto'};
}
export function parseCandles(raw,market,interval,now=Date.now()){
  const step=intervals[interval];if(!step||!Array.isArray(raw)||raw.length>5000)throw Error('Invalid candle history');
  const seen=new Set();return raw.map(c=>{
    const t=c?.t,T=c?.T,o=Number(c?.o),h=Number(c?.h),l=Number(c?.l),close=Number(c?.c),volume=Number(c?.v);
    if(!['o','h','l','c','v'].every(k=>typeof c?.[k]==='number'||typeof c?.[k]==='string'&&/^\d+(\.\d+)?$/.test(c[k]))||c?.s!==market||c?.i!==interval||!Number.isSafeInteger(t)||t<=0||t%step!==0||t>now||T!==t+step-1||![o,h,l,close,volume].every(Number.isFinite)||Math.min(o,h,l,close)<=0||volume<0||h<Math.max(o,l,close)||l>Math.min(o,h,close)||seen.has(t))throw Error('Invalid candle or market mismatch');
    seen.add(t);return {t,T,o,h,l,c:close,v:volume};
  }).sort((a,b)=>a.t-b.t);
}
export function indicatorSeries(candles,period,interval,now=Date.now()){
  if(!Number.isInteger(period)||period<2||period>200||!intervals[interval])throw Error('Invalid indicator settings');
  const step=intervals[interval],ema=[],vwap=[];let seed=[],e,previous,day=-1,total=0,weighted=0,complete=false,emaBreak=true;
  for(const c of candles){
    const gap=previous!==undefined&&c.t!==previous+step;if(gap){seed=[];e=undefined;emaBreak=true;}
    const session=Math.floor(c.t/86400000);if(session!==day){day=session;total=0;weighted=0;complete=c.t===session*86400000;}else if(gap)complete=false;
    const time=Math.min(c.t+step/2,now); // Native candle centers; current candle remains provisional.
    if(e===undefined){seed.push(c.c);if(seed.length===period)e=seed.reduce((a,b)=>a+b,0)/period;}else e+=2/(period+1)*(c.c-e);
    if(e!==undefined){ema.push({time,value:e,break:emaBreak});emaBreak=false;}
    total+=c.v;weighted+=(c.h+c.l+c.c)/3*c.v;
    if(complete&&total>0)vwap.push({time,value:weighted/total,break:c.t===session*86400000});
    previous=c.t;
  }
  const last=candles.at(-1);if(last&&last.T>=now)for(const values of [ema,vwap])if(values.length&&values.at(-1).time<now)values.push({...values.at(-1),time:now,break:false});
  return {ema,vwap};
}
const uint=x=>typeof x==='string'&&/^\d{1,78}$/.test(x);
function bucket(raw){if(!Array.isArray(raw)||raw.length!==4||!raw.slice(0,2).every(uint)||!raw.slice(2).every(x=>Number.isSafeInteger(x)&&x>=0))throw Error('Invalid liquidation bucket');const long=Number(raw[0])/1e18,short=Number(raw[1])/1e18;if(!Number.isFinite(long+short)||long>1e18||short>1e18||(long===0)!==(raw[2]===0)||(short===0)!==(raw[3]===0))throw Error('Invalid liquidation size');return {long,short,longCount:raw[2],shortCount:raw[3]};}
export function parseLiquidationMap(raw,market,range,now=Date.now()){
  const m=mapMarkets[market];if(!m||raw?.ok!==true||raw.instrumentId!==m.id||raw.range!==range||!uint(raw.priceScale)||Number(raw.priceScale)!==m.scale||!uint(raw.fromRaw)||!uint(raw.toRaw)||!Array.isArray(raw.buckets)||raw.buckets.length!==150||!uint(raw.source?.block)||!Number.isSafeInteger(raw.source.at)||!Number.isSafeInteger(raw.source.priceAt)||Math.max(raw.source.at,raw.source.priceAt)>now+5000||Math.min(raw.source.at,raw.source.priceAt)<now-60000)throw Error('Invalid or stale liquidation map');
  const from=Number(raw.fromRaw)/m.scale,to=Number(raw.toRaw)/m.scale;if(!(from>0&&to>from&&Number.isFinite(to)))throw Error('Invalid liquidation price range');
  return {from,to,range,at:raw.source.at,priceAt:raw.source.priceAt,block:raw.source.block,buckets:raw.buckets.map((b,i)=>({...bucket(b),low:from+(to-from)*i/150,high:from+(to-from)*(i+1)/150})),below:bucket(raw.below),above:bucket(raw.above)};
}
// The native chart uses local HH:mm[:ss] ticks. Resolve only a live, sub-day
// time scale, with 3+ agreeing ticks; never guess dates on a panned chart.
export function fitTimeAxis(samples,width,height,now=Date.now()){
  if(!Array.isArray(samples)||samples.length>100||new Date(now).getTimezoneOffset()!==new Date(now-86400000).getTimezoneOffset())return null;
  const ticks=samples.filter(p=>Number.isFinite(p.x)&&p.x>=0&&p.x<=width-40&&p.y>height-22&&p.y<height&&/^\d{2}:\d{2}(:\d{2})?$/.test(p.label)).sort((a,b)=>a.x-b.x);
  if(ticks.length<3)return null;const date=new Date(now),results=[];
  const candidates=p=>{const [h,m,s=0]=p.label.split(':').map(Number);if(h>23||m>59||s>59)return [];return [-1,0,1].map(offset=>new Date(date.getFullYear(),date.getMonth(),date.getDate()+offset,h,m,s).getTime());};
  // Native axes use epoch-aligned nice-step ticks (1/2/5 * 10^n seconds).
  // HH:mm truncates seconds: recover the unique grid timestamp inside that
  // minute rather than fitting a line to inaccurate rounded labels.
  const precise=ticks.every(p=>p.label.split(':').length===3),steps=precise?[0]:Array.from({length:5},(_,i)=>[1,2,5].map(v=>v*10**i*1000)).flat().filter(v=>v>=60000);
  for(const step of steps)for(const firstBase of candidates(ticks[0])){
    const resolve=base=>step?Math.ceil(base/step)*step:base;
    const firstTime=resolve(firstBase);if(step&&firstTime>=firstBase+60000)continue;
    const points=[{...ticks[0],time:firstTime}];let valid=true;
    for(const p of ticks.slice(1)){const time=candidates(p).map(base=>({base,time:resolve(base)})).find(v=>(!step||v.time<v.base+60000)&&v.time>points.at(-1).time&&v.time-points.at(-1).time<86400000)?.time;if(time===undefined){valid=false;break;}points.push({...p,time});}
    if(!valid)continue;const first=points[0],last=points.at(-1),slope=(last.x-first.x)/(last.time-first.time),intercept=first.x-slope*first.time,xNow=slope*now+intercept;
    if(!(slope>0)||points.some(p=>Math.abs(p.x-(slope*p.time+intercept))>.75)||width/slope>=86400000||xNow<0||xNow>width)continue;
    const result={slope,intercept,from:-intercept/slope,to:(width-intercept)/slope};if(!results.some(r=>Math.abs((r.intercept-intercept)/slope)<.5&&Math.abs(r.slope/slope-1)<1e-9))results.push(result);
  }
  return results.length===1?results[0]:null;
}
export function seriesPath(series,xAxis,yAxis,from,to){
  let path='',pen=false;const first=series.findIndex(p=>p.time>=from);if(first<0)return '';let end=series.findIndex(p=>p.time>to);if(end<0)end=series.length-1;
  // Include neighboring samples so a line crosses a narrow live viewport.
  for(const p of series.slice(Math.max(0,first-1),end+1)){const x=xAxis.slope*p.time+xAxis.intercept,y=yAxis.slope*p.value+yAxis.intercept;if(!Number.isFinite(x+y)){pen=false;continue;}path+=(pen&&!p.break?'L':'M')+x.toFixed(2)+','+y.toFixed(2);pen=true;}return path;
}
export function mapRangeForAxis(axis,height){
  const high=-axis.intercept/axis.slope,low=(height-axis.intercept)/axis.slope,mid=(high+low)/2,percent=(high-low)/2/mid*100*1.4;
  return ['0.1','0.25','0.5','1','2','5','10','25'].find(r=>Number(r)>=percent)||'25';
}
