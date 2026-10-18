export function mountOverview(root,send) {
  root.innerHTML=`<style>:host{display:block}.overview{font:13px system-ui;background:#12191e;color:#e6edf1;padding:16px;width:340px;box-sizing:border-box}*{box-sizing:border-box}h1{font-size:16px;margin:0 0 8px}.muted{color:#9eafbb;font-size:11px;line-height:1.5}.health{margin:12px 0;color:#c1ddcb}.health[data-warning=true],.warning{color:#ffc38c}.item{border:1px solid #34434d;border-radius:7px;padding:11px;margin:9px 0}.title{font-weight:650}.detail{font-size:11px;line-height:1.5;color:#aebfca;margin:5px 0}.warning{font-size:11px;line-height:1.5;margin:6px 0}button,a{font:600 12px system-ui}button{padding:8px 12px;background:#d6e6ef;color:#14242e;border:0;border-radius:5px;cursor:pointer}button:disabled{opacity:.4;cursor:default}.bar{display:flex;align-items:center;justify-content:space-between;margin-top:12px}a{color:#b7dfee}.status{font-size:11px;line-height:1.5;margin-top:10px;min-height:16px}#overviewRefresh{background:#25353f;color:#dceaf2}#overviewItems{max-height:260px;overflow:auto}</style><section class="overview"><h1>Papertrade tools · beta</h1><div class="muted">Manual pairs · limits · SL / TP</div><div id="overviewHealth" class="health" role="status">Reading extension status…</div><div id="overviewQuotes" class="muted"></div><div id="overviewQueue"></div><div id="overviewItems"></div><div class="bar"><button id="overviewRefresh">Refresh</button><a href="https://exchange.papertrade.xyz/trade/btc" target="_blank" rel="noopener">Open BTC ↗</a></div><div id="overviewStatus" class="status" role="status"></div><p class="muted">Manage opens the page; it sends no trade. Keep the managing tab open and wallet authorized. This lists extension tracking, not all wallet positions.</p><p class="muted">Independent extension. <a href="https://github.com/maxlongartist/papertrade-extension/blob/main/PRIVACY.md" target="_blank" rel="noopener">Privacy</a> · <a href="https://github.com/maxlongartist/papertrade-extension/issues/new/choose" target="_blank" rel="noopener">Support</a></p></section>`;
  const $=id=>root.querySelector('#'+id), doc=root.ownerDocument;
  let disposed=false,polling=false,data=null,stale=true,listKey='',pollError=false,lastSuccess=0;
  const managing=new Set();
  function render() {
    const warnings=data?.items.filter(i=>i.warning).length??0;
    $('overviewHealth').dataset.warning=String(stale||warnings>0);
    $('overviewHealth').textContent=stale?'Status unavailable · refresh before managing':data.items.length?`${data.items.length} tracked item${data.items.length===1?'':'s'}${warnings?' · '+warnings+(warnings===1?' needs':' need')+' attention':''}`:'No active tracked items';
    $('overviewQuotes').textContent=stale?'Quote ages unavailable while status is disconnected.':data?data.quotes.map(q=>q.market+': '+(q.ageMs==null?'no quote':(q.ageMs/1000).toFixed(1)+'s old')).join(' · '):'';
    const key=JSON.stringify([stale,data?.items.map(({observedAt,...item})=>item),[...managing]]);
    if(key===listKey)return;listKey=key;
    const cards=(data?.items??[]).map(item=>{
      const card=doc.createElement('div');card.className='item';
      const title=doc.createElement('div');title.className='title';title.textContent=item.market+' · '+item.title;
      const detail=doc.createElement('div');detail.className='detail';detail.textContent=item.status.replaceAll('_',' ') + (item.positionIds.length?' · #'+item.positionIds.join(' / #'):'');
      card.append(title,detail);
      if(item.warning){const warning=doc.createElement('div');warning.className='warning';warning.textContent=item.warning;card.append(warning);}
      const button=doc.createElement('button'),id=item.kind+':'+item.id;
      button.textContent=managing.has(id)?'Opening…':'Manage on page';button.disabled=stale||managing.has(id);
      button.onclick=async()=>{
        if(stale||managing.has(id))return;
        managing.add(id);render();
        try{const r=await send({type:'manageItem',kind:item.kind,id:item.id});if(r.error)throw Error(r.error);$('overviewStatus').textContent=r.opened?'Market page opened. Restore or re-arm tracking there.':'Managing tab opened.';}
        catch(error){$('overviewStatus').textContent=error.message;void poll();}
        finally{managing.delete(id);if(!disposed)render();}
      };
      card.append(button);return card;
    });
    $('overviewItems').replaceChildren(...cards);
  }
  async function poll() {
    if(polling||disposed)return;polling=true;$('overviewRefresh').disabled=true;
    try{const r=await send({type:'overview'});if(disposed)return;if(r.error)throw Error(r.error);data=r;lastSuccess=Date.now();stale=false;if(pollError){$('overviewStatus').textContent='';pollError=false;}render();}
    catch(error){if(disposed)return;stale=true;pollError=true;render();$('overviewStatus').textContent=error.message;}
    finally{polling=false;if(!disposed)$('overviewRefresh').disabled=false;}
  }
  $('overviewRefresh').onclick=()=>{ $('overviewStatus').textContent='';void poll(); };
  const timer=setInterval(()=>{if(data&&Date.now()-lastSuccess>6000){stale=true;render();}void poll();},2000);void poll();
  return ()=>{disposed=true;clearInterval(timer);};
}
