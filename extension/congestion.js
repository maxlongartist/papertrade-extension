const ageLimit=5000;
const integer=n=>Number.isSafeInteger(n)&&n>=0;
function gas(value){if(typeof value!=='string'||!/^\d{1,40}$/.test(value))throw Error('Invalid gas field');return BigInt(value);}
// Mirrors the current public Papertrade Status gas-backlog model (2026-10-17).
export function parsePressure(data,receivedAt=Date.now()) {
  const s=data?.snapshot,c=s?.chain;
  if(typeof data?.queueRevision!=='string'||data.queueRevision.length>200||s?.schemaVersion!==1||s.source!=='relayer-postgres'||s.ok!==true||s.stale!==false||!integer(s.ts)||s.ts>receivedAt+1000||receivedAt-s.ts>=ageLimit)throw Error('Pressure snapshot unavailable or stale');
  if(c?.source!=='state-postgres'||c.ok!==true||c.stale!==false||!integer(c.latestBlockNumber)||!integer(c.latestBlockTimestampMs)||receivedAt-c.latestBlockTimestampMs>10000||c.latestBlockTimestampMs>receivedAt+1000||!Array.isArray(c.blocks)||!c.blocks.length||c.blocks.length>5)throw Error('Chain observation unavailable');
  const limit=gas(s.blockGasLimit),submitted=gas(s.totalSubmittedGas),queued=gas(s.totalQueuedGas),total=gas(s.totalPendingGas);
  if(limit===0n||total!==submitted+queued||!integer(s.pendingCount))throw Error('Inconsistent pressure snapshot');
  let tx=0,previous=null;
  for(const b of c.blocks){
    if(!integer(b.number)||!integer(b.timestampMs)||!integer(b.transactionCount)||(previous!==null&&b.number!==previous+1)||gas(b.gasLimit)===0n||gas(b.gasUsed)>gas(b.gasLimit)||gas(b.papertradeGasUsed)>gas(b.gasUsed))throw Error('Invalid block history');
    tx+=b.transactionCount;previous=b.number;
  }
  const last=c.blocks.at(-1);
  if(last.number!==c.latestBlockNumber||last.timestampMs!==c.latestBlockTimestampMs)throw Error('Inconsistent latest block');
  const needed=total===0n?0n:(total+limit-1n)/limit;
  if(needed>1000000n)throw Error('Queue estimate exceeds supported range');
  return {source:'public-stream',sourceAt:s.ts,receivedAt,pending:s.pendingCount,neededBlocks:Number(needed),clearSeconds:s.pendingCount?Math.max(3,Number(needed)):0,
    avgTxPerBlock:tx/c.blocks.length,submittedGas:String(submitted),queuedGas:String(queued),blockGasLimit:String(limit),latestBlock:c.latestBlockNumber,
    level:needed<=1n?'LOW':needed<=5n?'MEDIUM':'HIGH',backlogBlocks:Number(total)/Number(limit)};
}
export function pressureView(snapshot,now=Date.now(),error=null,trend='Collecting trend') {
  if(!snapshot||error||now-snapshot.sourceAt>=ageLimit||now-snapshot.receivedAt>=ageLimit||snapshot.sourceAt>now+1000||snapshot.receivedAt>now+1000)
    return {live:false,level:'UNKNOWN',reason:error??'Waiting for fresh public queue data.',sourceAt:snapshot?.sourceAt??null,receivedAt:snapshot?.receivedAt??null};
  return {...snapshot,live:true,trend};
}
export function createPressureFeed({socket=url=>new WebSocket(url),now=()=>Date.now(),schedule=setTimeout,cancel=clearTimeout,onPublication=()=>{}}={}) {
  let ws,job=null,idle=null,watchdog=null,snapshot=null,error='Connecting to public queue data.',lastRead=0,attempt=0,stopped=false,samples=[];
  function armIdle(){if(idle)cancel(idle);idle=schedule(()=>{if(now()-lastRead>=60000)stop();else armIdle();},Math.max(1,60000-(now()-lastRead)));}
  function stop(){stopped=true;if(job)cancel(job);if(idle)cancel(idle);if(watchdog)cancel(watchdog);job=idle=watchdog=null;const old=ws;ws=null;samples=[];old?.close();error='Queue feed idle. Waiting for a new connection.';}
  function retry(){if(stopped||job)return;const delay=Math.min(30000,2000*2**Math.min(attempt++,4));job=schedule(()=>{job=null;connect();},delay);}
  function retire(current,reason){
    if(ws!==current)return;
    ws=null;if(watchdog)cancel(watchdog);watchdog=null;samples=[];error=reason;
    // Invalidate the transport before closing: late callbacks cannot revive it.
    try{current.close();}catch{}
    retry();
  }
  function armWatchdog(current){if(watchdog)cancel(watchdog);watchdog=schedule(()=>{watchdog=null;retire(current,'No fresh public queue data for 10 seconds. Reconnecting.');},10000);}
  function connect(){
    if(stopped||ws&&[0,1].includes(ws.readyState))return;
    let current;
    try{current=socket('wss://stream.papertrade.xyz/connection/websocket');}catch{error='Public queue connection unavailable.';retry();return;}
    ws=current;armWatchdog(current);
    current.onopen=()=>{if(ws!==current)return;try{current.send(JSON.stringify({id:1,connect:{}}));}catch{retire(current,'Public queue connection unavailable.');}};
    current.onmessage=event=>{
      if(ws!==current)return;
      try{
        if(typeof event.data!=='string'||event.data.length>131072)throw Error('Invalid queue message');
        const lines=event.data.split('\n');if(lines.length>32)throw Error('Oversized queue message');
        for(const line of lines){if(!line.trim())continue;const frame=JSON.parse(line);
          if(!Object.keys(frame).length){current.send('{}');continue;}
          if(frame.error||frame.push?.disconnect||frame.push?.unsubscribe){retire(current,'Public queue subscription unavailable.');return;}
          if(frame.id===1&&frame.connect){current.send(JSON.stringify({id:2,subscribe:{channel:'pressure:current'}}));continue;}
          const data=frame.push?.channel==='pressure:current'?frame.push.pub?.data:frame.id===2?frame.subscribe?.publications?.at(-1)?.data:null;
          if(!data)continue;
          const next=parsePressure(data,now());
          if(snapshot&&next.sourceAt<=snapshot.sourceAt)continue;
          snapshot=next;error=null;attempt=0;armWatchdog(current);samples.push(next);samples=samples.filter(s=>next.sourceAt-s.sourceAt<=15000);
          onPublication(data);
        }
      }catch(e){error=e.message;}
    };
    current.onerror=()=>retire(current,'Public queue connection unavailable.');
    current.onclose=()=>retire(current,'Public queue disconnected.');
  }
  function view(){
    const baseline=samples.find(s=>snapshot&&snapshot.sourceAt-s.sourceAt>=5000);
    const change=baseline&&snapshot?snapshot.backlogBlocks-baseline.backlogBlocks:null;
    return pressureView(snapshot,now(),error,change==null?'Collecting trend':change>=1?'Queue growing':change<=-1?'Queue easing':'Queue broadly steady');
  }
  return {get(){lastRead=now();if(stopped)stopped=false;if(!idle)armIdle();if(!job)connect();return view();},peek:view,stop};
}
