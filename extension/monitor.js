export function monitorView({connected,visible,positionsReady,accountReady,tick},now=Date.now()){
 if(!connected)return {label:'Extension disconnected',warning:true,detail:'Refresh Papertrade to reconnect. Check native Positions and Status for pending actions.'};
 if(!visible)return {label:'Page hidden · timing may be delayed',warning:true,detail:'Return to this trading tab. Keep Chrome open and your wallet authorized.'};
 if(!accountReady)return {label:'Wallet check needed',warning:true,detail:'Connect and authorize your wallet in Papertrade. Check the controls before trading.'};
 if(!positionsReady)return {label:'Positions check needed',warning:true,detail:'Open Papertrade’s Positions tab and leave it visible.'};
 const fresh=tick&&[tick.sourceAt,tick.receivedAt].every(t=>Number.isFinite(t)&&t<=now+1000&&now-t<1500);
 if(!fresh)return {label:'Price data unavailable or delayed',warning:true,detail:'New entries and price-triggered exits may wait for fresh data. Check native Positions.'};
 return {label:'Data and Positions checks available',warning:false,detail:'Execution still depends on wallet authorization and native controls. Keep this tab open.'};
}
export function mountMonitor(root,send,checkPage){
 root.innerHTML='<style>:host{display:block}section{font:11px/1.5 system-ui;border:1px solid #496359;border-radius:6px;background:#17232a;color:#bfd9c8;margin:12px 0;padding:10px}b{display:block;height:3em;overflow:auto}section[data-warning=true]{color:#ffd081;border-color:#80693c}p{height:4.5em;overflow:auto;margin:4px 0 0}a{color:#b0d5eb}</style><section data-warning="true"><b id="monitorLabel">Checking monitoring conditions…</b><p id="monitorDetail" role="status">No execution guarantee. Keep native Positions visible.</p><a href="https://github.com/maxlongartist/papertrade-extension/issues/new/choose" target="_blank" rel="noopener">Report a problem</a> · <a href="https://github.com/maxlongartist/papertrade-extension/blob/main/PRIVACY.md" target="_blank" rel="noopener">Privacy</a></section>';
 let disposed=false,busy=false;const setText=(id,text)=>{const el=root.querySelector('#'+id);if(el.textContent!==text)el.textContent=text;};
 async function poll(){if(disposed||busy)return;busy=true;let view;try{const page=checkPage(),state=await send({type:'state'});if(state.error)throw Error(state.error);view=monitorView({...page,connected:true,tick:state.ticks?.[page.market]});}catch{view=monitorView({connected:false});}finally{busy=false;}if(disposed)return;setText('monitorLabel',view.label);setText('monitorDetail',view.detail);root.querySelector('section').dataset.warning=String(view.warning);}
 const timer=setInterval(()=>void poll(),1000);void poll();return ()=>{disposed=true;clearInterval(timer);};
}
