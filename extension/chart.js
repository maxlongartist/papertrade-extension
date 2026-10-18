import {chartQuoteView,chartMoveRisk} from './chart-data.js';
// Independent price scale: does not guess the native canvas's zoom/axis mapping.
export function mountLevelChart(root,{getDraft,setDraft,getTick}) {
  root.innerHTML='<div style="font-size:11px;color:#9aacb9">Position mark · drag levels (Shift = fine) or focus a handle and use ↑/↓ ($1). Changes are drafts until you save.</div><div class="quote-status" role="status" style="font-size:10px;color:#9aacb9;margin:4px 0;line-height:1.4;min-height:2.8em"></div><svg viewBox="0 0 300 180" style="display:block;width:100%;touch-action:none;background:#10171d;border-radius:6px" aria-label="Order level chart"></svg><div class="risk" tabindex="0" style="font-size:11px;color:#9aacb9;margin-top:6px"></div>';
  const svg=root.querySelector('svg'),risk=root.querySelector('.risk'),quoteStatus=root.querySelector('.quote-status');let scale,dragging=null,dragStart=null,last='',disposed=false;
  const escape=x=>String(x).replace(/[&<>"']/g,'');
  function renderRisk(d){
    const {loss,gain}=chartMoveRisk(d),text=`Estimated move PnL: SL ${loss==null?'—':'$'+loss.toFixed(2)} · TP ${gain==null?'—':'$'+gain.toFixed(2)}. Excludes fees, early lead and slippage; liquidation may occur first.`;
    if(risk.textContent!==text)risk.textContent=text;
  }
  function update(){
    if(disposed)return;
    const d=getDraft(),quote=chartQuoteView(getTick()),live=quote.price;
    const status=dragging?'Live reference paused while dragging':quote.status==='current'?'Current position mark':quote.status==='stale'?'Price snapshot stale · draft levels only':'Position mark unavailable · draft levels only';
    if(quoteStatus.textContent!==status)quoteStatus.textContent=status;renderRisk(d);
    if(dragging){svg.querySelector('[data-live-reference]')?.remove();return;}
    const levels=[['Entry',d.price,'#b8d9f0','price'],['SL',d.stopLoss,'#ef9b93','stopLoss'],['TP',d.takeProfit,'#97d4ae','takeProfit']].filter(x=>Number.isFinite(x[1])&&x[1]>0);const values=[...levels.map(x=>x[1]),live].filter(Number.isFinite);const key=JSON.stringify({d,live,status:quote.status});if(key===last)return;last=key;if(!values.length){scale=null;svg.innerHTML='<text x="6" y="24" fill="#8398a5" font-size="10">Enter a draft level to preview it.</text>';return;}
    const min=Math.min(...values),max=Math.max(...values),pad=Math.max(10,(max-min)*.15);scale={min:min-pad,max:max+pad};const y=p=>160-(p-scale.min)/(scale.max-scale.min)*140;
    svg.innerHTML=`<text x="6" y="13" fill="#7e929f" font-size="9">Independent price scale · ${escape(d.mode==='position'?'Position exits':'Entry draft')}</text>`+Array.from({length:4},(_,i)=>{const p=scale.min+(scale.max-scale.min)*i/3;return `<line x1="0" x2="300" y1="${y(p)}" y2="${y(p)}" stroke="#27343e"/><text x="240" y="${y(p)-3}" fill="#8398a5" font-size="9">${p.toFixed(2)}</text>`;}).join('')+(Number.isFinite(live)?`<line data-live-reference x1="0" x2="300" y1="${y(live)}" y2="${y(live)}" stroke="#ffffff" stroke-dasharray="2 4"/>`:'')+levels.map(([label,price,color,field])=>`<g data-field="${field}" role="slider" tabindex="0" aria-label="${label} chart level" aria-valuenow="${price}" aria-valuemin="0.01" aria-valuemax="10000000" style="cursor:ns-resize"><line x1="0" x2="300" y1="${y(price)}" y2="${y(price)}" stroke="${color}" stroke-width="2"/><rect x="0" y="${y(price)-10}" width="132" height="20" rx="3" fill="#1b2832"/><text x="6" y="${y(price)+3}" fill="${color}" font-size="11">${label} $${price.toFixed(2)}</text></g>`).join('');
  }
  svg.addEventListener('keydown',e=>{const handle=e.target.closest('[data-field]');if(!handle||(getDraft().mode==='position'&&handle.dataset.field==='price')||!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();setDraft(handle.dataset.field,Math.max(.01,Number(handle.getAttribute('aria-valuenow'))+(e.key==='ArrowUp'?1:-1)));last='';update();svg.querySelector(`[data-field="${handle.dataset.field}"]`)?.focus();});
  svg.addEventListener('pointerdown',e=>{const handle=e.target.closest('[data-field]');if(!handle||(getDraft().mode==='position'&&handle.dataset.field==='price'))return;e.preventDefault();dragging=handle.dataset.field;dragStart={y:e.clientY,price:Number(handle.getAttribute('aria-valuenow'))};svg.setPointerCapture(e.pointerId);update();});
  svg.addEventListener('pointermove',e=>{
    if(!dragging||!scale)return;
    const box=svg.getBoundingClientRect(),p=Math.max(.01,dragStart.price-(e.clientY-dragStart.y)/box.height*180/140*(scale.max-scale.min)*(e.shiftKey ? .1 : 1));
    setDraft(dragging,Math.round(p*100)/100,{dragging:true});
    const draft=getDraft(),actual=draft[dragging],g=svg.querySelector(`[data-field="${dragging}"]`);
    renderRisk(draft);
    if(g&&Number.isFinite(actual)){
      const oldY=160-(dragStart.price-scale.min)/(scale.max-scale.min)*140,newY=160-(actual-scale.min)/(scale.max-scale.min)*140;
      g.setAttribute('transform',`translate(0,${newY-oldY})`);g.setAttribute('aria-valuenow',String(actual));
      g.querySelector('text').textContent=({price:'Entry',stopLoss:'SL',takeProfit:'TP'}[dragging])+' $'+actual.toFixed(2);
    }
  });
  const finish=()=>{const field=dragging;dragging=null;if(field&&Number.isFinite(getDraft()[field]))setDraft(field,getDraft()[field],{dragging:false});last='';update();};svg.addEventListener('pointerup',finish);svg.addEventListener('pointercancel',finish);
  const timer=setInterval(update,250);update();const dispose=()=>{disposed=true;clearInterval(timer);};dispose.refresh=update;return dispose;
}
