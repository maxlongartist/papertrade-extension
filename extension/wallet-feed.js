import {createSSEParser,createWalletReducer,retryDelay} from './wallet-data.js';
// One lifecycle per visible, opted-in page. Abort immediately on disable/route change.
export function startWalletFeed(address,instruments,onUpdate,{fetcher=fetch,now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout}={}){
  let disposed=false,attempt=0,timer,controller,revision=-1,watchdog;
  const update=value=>{if(!disposed)onUpdate(value);};
  async function connect(){
    if(disposed)return;controller=new AbortController();let retryAfter=null,lastAt=now(),snapshot=null;const reduce=createWalletReducer(address,instruments);
    update({status:'connecting',address});
    watchdog=setInterval(()=>{if(now()-lastAt>30000)controller.abort();},5000);
    try{
      const response=await fetcher('/state/user/live?wallet='+encodeURIComponent(address),{credentials:'omit',cache:'no-store',signal:controller.signal});
      if(!response.ok){retryAfter=response.headers.get('Retry-After');throw Error(response.status===429?'Rate limited':'Public feed HTTP '+response.status);}
      if(!response.headers.get('content-type')?.includes('text/event-stream'))throw Error('Unexpected public feed response.');
      const reader=response.body.getReader(),decoder=new TextDecoder();
      const parse=createSSEParser(({event,data})=>{
        // Comments/heartbeat only renew transport freshness, never synthesize positions.
        if(event==='wallet'){
          const next=reduce(JSON.parse(data));if(next.revision<revision)throw Error('Out-of-order wallet snapshot.');
          revision=next.revision;snapshot=next;attempt=0;update({status:'live',...snapshot,receivedAt:now()});
        }
      });
      try{while(!disposed){const {done,value}=await reader.read();if(done)break;lastAt=now();parse(decoder.decode(value,{stream:true}));if(snapshot)update({status:'live',...snapshot,receivedAt:lastAt});}}
      finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
      throw Error('Public feed disconnected');
    }catch(error){if(disposed)return;const delay=retryDelay(attempt++,retryAfter,now());update({status:'retrying',address,error:error.name==='AbortError'?'Feed heartbeat timed out':error.message,retryAt:now()+delay});timer=setTimer(connect,delay);}
    finally{clearInterval(watchdog);}
  }
  void connect();return ()=>{disposed=true;controller?.abort();clearTimer(timer);clearInterval(watchdog);};
}
