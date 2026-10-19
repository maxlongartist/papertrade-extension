import {parseTapeBatch} from './trade-tape-data.js';
// One public WebSocket per visible tape. No recovery/replay is advertised by this
// channel; reconnects explicitly report a gap instead of inventing missing fills.
export function startTapeFeed(onUpdate,{socket=url=>new WebSocket(url),now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout,random=Math.random}={}){
  let disposed=false,current=null,retry=null,watchdog=null,attempt=0,lastFrameAt=0;
  const update=value=>{if(!disposed)onUpdate(value);};
  function retire(ws,message){
    if(disposed||current!==ws)return;current=null;clearTimer(watchdog);watchdog=null;try{ws?.close();}catch{}
    const delay=Math.min(60000,2000*2**Math.min(attempt++,5))+Math.floor(random()*500);
    update({status:'retrying',message,retryAt:now()+delay});retry=setTimer(()=>{retry=null;connect();},delay);
  }
  function watch(ws){clearTimer(watchdog);watchdog=setTimer(()=>{if(current!==ws)return;if(now()-lastFrameAt>=30000)retire(ws,'Public tape heartbeat timed out.');else watch(ws);},5000);}
  function connect(){
    if(disposed)return;let ws;
    try{ws=socket('wss://stream.papertrade.xyz/connection/websocket');}catch{ws={close(){}};current=ws;retire(ws,'Public tape connection unavailable.');return;}
    current=ws;let connected=false,subscribed=false,healthySince=null;lastFrameAt=now();watch(ws);update({status:'connecting'});
    ws.onopen=()=>{if(current!==ws)return;try{ws.send(JSON.stringify({id:1,connect:{}}));}catch{retire(ws,'Public tape connection unavailable.');}};
    ws.onmessage=event=>{
      if(current!==ws||disposed)return;
      try{
        if(typeof event.data!=='string'||event.data.length>262144)throw Error('Oversized public tape frame.');
        const lines=event.data.split('\n');if(lines.length>64)throw Error('Oversized public tape frame.');
        for(const line of lines){if(!line.trim())continue;const frame=JSON.parse(line);
          if(!Object.keys(frame).length){lastFrameAt=now();ws.send('{}');if(subscribed)update({status:'live',heartbeat:true});continue;}
          if(frame.error||frame.push?.disconnect||frame.push?.unsubscribe)throw Error('Public tape subscription interrupted.');
          if(frame.id===1&&frame.connect&&!connected){connected=true;ws.send(JSON.stringify({id:2,subscribe:{channel:'public:trades'}}));lastFrameAt=now();continue;}
          if(frame.id===2&&frame.subscribe){
            if(!connected||frame.subscribe.recoverable||frame.subscribe.wasRecovering)throw Error('Unsupported tape recovery.');
            subscribed=true;healthySince=now();lastFrameAt=now();update({status:'live',connected:true});continue;
          }
          if(frame.push?.channel==='public:trades'&&frame.push.pub){
            if(!subscribed)throw Error('Trade arrived before subscription confirmation.');
            const trades=parseTapeBatch(frame.push.pub.data,now());lastFrameAt=now();if(now()-healthySince>=30000)attempt=0;
            update({status:'live',trades,receivedAt:now()});
          }
        }
      }catch(error){retire(ws,error.message);}
    };
    ws.onerror=()=>retire(ws,'Public tape connection unavailable.');ws.onclose=()=>retire(ws,'Public tape disconnected.');
  }
  connect();return ()=>{if(disposed)return;disposed=true;clearTimer(retry);clearTimer(watchdog);const ws=current;current=null;try{ws?.close();}catch{}};
}
