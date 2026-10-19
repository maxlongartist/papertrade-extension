import {createSSEParser,createWalletReducer,retryDelay} from './wallet-data.js';

// Page-local and public-feed-only: never delays order execution or existing streams.
export function createWalletRetryCoordinator(now=Date.now){
  let until=0;
  return {
    postpone(delay){until=Math.max(until,now()+Math.min(3600000,Math.max(0,delay)));},
    remaining(){return Math.max(0,until-now());}
  };
}

// One lifecycle per visible, opted-in page. Abort immediately on disable/route change.
export function startWalletFeed(address,instruments,onUpdate,{
  fetcher=fetch,now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout,
  random=Math.random,retryCoordinator,setWatchdog=setInterval,clearWatchdog=clearInterval
}={}){
  let disposed=false,attempt=0,timer,controller,revision=-1,watchdog;
  const update=value=>{if(!disposed)onUpdate(value);};
  const stagger=delay=>delay+Math.floor(Math.max(0,Math.min(1,Number(random())||0))*Math.min(1000,delay*.2));
  const schedule=(delay,error)=>{
    const wait=stagger(delay);
    update({status:'retrying',address,error,retryAt:now()+wait});
    if(!disposed)timer=setTimer(connect,wait);
  };
  async function connect(){
    if(disposed)return;
    const cooldown=retryCoordinator?.remaining()??0;
    if(cooldown>0){schedule(cooldown,'Wallet feeds cooling down after rate limit');return;}
    controller=new AbortController();
    const startedAt=now(),reduce=createWalletReducer(address,instruments);
    let retryAfter=null,lastAt=startedAt,firstSnapshotAt=null,snapshot=null,publication='snapshot',rateLimited=false,timeoutReason='Feed heartbeat timed out';
    update({status:'connecting',address});
    watchdog=setWatchdog(()=>{
      if(snapshot===null&&now()-startedAt>=30000){timeoutReason='No initial wallet snapshot received';controller.abort();}
      else if(now()-lastAt>=30000)controller.abort();
    },5000);
    try{
      const response=await fetcher('/state/user/live?wallet='+encodeURIComponent(address),{credentials:'omit',cache:'no-store',signal:controller.signal});
      if(!response.ok){
        retryAfter=response.headers.get('Retry-After');rateLimited=response.status===429;
        throw Error(rateLimited?'Rate limited':'Public feed HTTP '+response.status);
      }
      if(!response.headers.get('content-type')?.includes('text/event-stream'))throw Error('Unexpected public feed response.');
      const reader=response.body.getReader(),decoder=new TextDecoder();
      const parse=createSSEParser(({event,data})=>{
        // Comments renew transport freshness, never synthesize initial positions.
        if(event==='wallet'){
          const frame=JSON.parse(data),next=reduce(frame);
          publication=Object.hasOwn(frame,'baseAccountRevision')?'update':'snapshot';
          if(next.revision<revision)throw Error('Out-of-order wallet snapshot.');
          revision=next.revision;snapshot=next;firstSnapshotAt??=now();
          update({status:'live',...snapshot,publication,receivedAt:now()});
        }
      });
      try{
        while(!disposed){
          const {done,value}=await reader.read();if(done)break;
          lastAt=now();parse(decoder.decode(value,{stream:true}));
          // A single valid snapshot on a flapping transport is not a recovery.
          if(snapshot){if(now()-firstSnapshotAt>=30000)attempt=0;update({status:'live',...snapshot,publication,receivedAt:lastAt});}
        }
      }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
      throw Error('Public feed disconnected');
    }catch(error){
      if(disposed)return;
      const delay=Math.max(rateLimited?5000:0,retryDelay(attempt++,retryAfter,now()));
      if(rateLimited)retryCoordinator?.postpone(delay);
      schedule(delay,error.name==='AbortError'?timeoutReason:error.message);
    }finally{clearWatchdog(watchdog);}
  }
  void connect();
  return ()=>{disposed=true;controller?.abort();clearTimer(timer);clearWatchdog(watchdog);};
}
