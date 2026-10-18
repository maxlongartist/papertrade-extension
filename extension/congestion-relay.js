import {createPressureFeed} from './congestion.js';
// Chrome's isolated content world uses the native document origin for this public
// WebSocket. Never bridge page messages, wallet state, or trade controls.
export function startPagePressureRelay(send,{isActive,makeFeed=createPressureFeed,schedule=setInterval,cancel=clearInterval}={}){
 let running=false,disposed=false;
 const publish=publication=>{void Promise.resolve().then(()=>send({type:'pagePressure',publication})).catch(()=>{});};
 const feed=makeFeed({onPublication:publication=>{if(!disposed&&running&&isActive())publish(publication);}});
 function tick(){
  if(disposed)return;
  if(isActive()){running=true;feed.get();}
  else if(running){running=false;feed.stop();publish(null);}
 }
 const timer=schedule(tick,1000);tick();
 return {tick,dispose(){if(disposed)return;disposed=true;cancel(timer);feed.stop();if(running)publish(null);running=false;}};
}
