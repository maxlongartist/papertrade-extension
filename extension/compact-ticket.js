// Compact presentation over the existing order form and execution pipeline.
export function mountCompactTicket(root,{getTicket,setTicket,getTick,getBalance=()=>null,getTerms,getLiquidations}){
  const $=id=>root.querySelector('#'+id),form=$('form');let disposed=false,pending=null;const dirty=new Set();
  root.querySelector('.box').classList.add('compact-ticket');root.querySelector('.title').textContent='Trade · '+(root.querySelector('.title').textContent.split('·')[1]?.trim()??'');
  const style=document.createElement('style');style.textContent=`
  .compact-ticket{padding:12px;margin-top:0}.compact-ticket .connection-slot{height:2.8em;margin:3px 0}.compact-ticket .connection-slot:has(#connectionError[hidden]):has(#notice:empty){display:none}.compact-ticket .live{height:1.5em}.compact-ticket #ticket,.compact-ticket #liquidation{display:none}.compact-ticket label{font-size:11px}.compact-ticket input{padding:8px;font-size:14px}.compact-ticket #price{font-size:18px}.compact-ticket .sides{margin:8px 0}.compact-ticket .sides button{padding:4px 8px;font-size:11px}.compact-ticket .meta{font-size:10px;margin:6px 0}.compact-ticket details{margin-top:9px}.compact-ticket #submit{display:none}.compact-ticket form:has(#cancelEdit:not([hidden])) #submit{display:block}.compact-ticket .footer{font-size:10px}.ticket-modes{display:flex;gap:5px;margin:10px 0}.ticket-modes button{flex:1;padding:8px 4px;border:0;border-bottom:2px solid transparent;border-radius:0;background:transparent}.ticket-modes button[aria-selected=true]{color:#d6e6f0;border-bottom-color:#a8c8dd}.ticket-sizing,.ticket-actions,.ticket-liquidations{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ticket-actions{margin-top:10px}.ticket-actions button{font-weight:650;padding:12px 4px}.ticket-actions #buy{background:#8fdbb1;color:#10281d;border-color:#8fdbb1}.ticket-actions #sell{background:#f0a2ad;color:#38121a;border-color:#f0a2ad}.ticket-price{display:flex;gap:8px;align-items:end}.ticket-price label{flex:1}.ticket-price button{margin-bottom:1px;height:39px}.ticket-liquidations{font-size:10px;color:#e7c47d;margin-top:9px;line-height:1.5;min-height:3em}.ticket-balance{font-size:11px;color:#a2b6c8;line-height:1.5;min-height:1.5em}.ticket-mode-hint{min-height:2.8em;line-height:1.4;color:#91a7ba;font-size:10px;margin:8px 0}.compact-ticket #orders .empty{margin:4px 0}.compact-ticket .orders-title{margin:10px 0 0}`;root.append(style);
  const sizing=document.createElement('div');sizing.innerHTML='<div class="ticket-balance" id="available"></div><div class="ticket-modes" role="tablist" aria-label="Order type"><button type="button" data-mode="limit" role="tab">Limit</button><button type="button" data-mode="market" role="tab">Market</button><button type="button" data-mode="trigger" role="tab">Trigger</button></div><div class="ticket-sizing"><label>Margin · USDC<input id="compactMargin" type="number" min="0.01" step="0.01" required></label><label>Leverage · ×<input id="compactLeverage" type="number" min="1" step="1" required></label></div>';
  form.prepend(sizing);const size=document.createElement('div');size.id='positionSize';size.className='ticket-balance';sizing.append(size);
  for(const [value,label]of [['market','Market now'],['trigger','Trigger price']]){const option=document.createElement('option');option.value=value;option.textContent=label;$('entryMode').append(option);}
  const priceLabel=$('price').closest('label'),priceRow=document.createElement('div');priceRow.className='ticket-price';priceLabel.before(priceRow);priceRow.append(priceLabel);const mid=document.createElement('button');mid.type='button';mid.textContent='Mid';mid.id='mid';priceRow.append(mid);
  const advanced=document.createElement('details');advanced.id='entryAdvanced';advanced.innerHTML='<summary>Execution settings</summary>';priceRow.after(advanced);
  const behavior=$('entryMode').closest('label'),tolerance=$('tolerance').closest('label'),note=tolerance.nextElementSibling;advanced.append(behavior,tolerance,note);
  const hint=document.createElement('div');hint.id='modeHint';hint.className='ticket-mode-hint';advanced.after(hint);
  const actions=document.createElement('div');actions.className='ticket-actions';actions.innerHTML='<button type="button" id="buy">Buy / Long</button><button type="button" id="sell">Sell / Short</button>';form.append(actions);
  const liq=document.createElement('div');liq.className='ticket-liquidations';liq.innerHTML='<span id="longLiquidation"></span><span id="shortLiquidation"></span>';form.append(liq);
  const ordersTitle=$('activeOrdersTitle'),orders=$('orders');form.after(ordersTitle,orders);
  root.querySelector('#levelChart').closest('details').open=false;
  const editing=()=>!$('cancelEdit').hidden;
  const mode=()=>['market','trigger'].includes($('entryMode').value)?$('entryMode').value:'limit';
  function quote(){const t=getTick(),time=Date.now();return t&&time-t.sourceAt<=2000&&time-t.receivedAt<=2000&&t.sourceAt<=time+1000&&Number.isFinite(t.price??t.mid)?t.price??t.mid:null;}
  function error(message){$('entryError').textContent=message;$('entryError').hidden=false;}
  async function prepare(){
    if(editing())return getTicket();
    const margin=Number($('compactMargin').value),leverage=Number($('compactLeverage').value);
    if(!Number.isFinite(margin)||margin<=0||!Number.isSafeInteger(leverage)||leverage<1)throw Error('Enter a positive margin and whole-number leverage.');
    if(pending)await pending;
    const native=getTicket();if(!native.ok)throw Error(native.error);
    if(native.margin===margin&&native.leverage===leverage){dirty.clear();return native;}
    if(typeof setTicket!=='function')throw Error('Native sizing controls unavailable. Refresh Papertrade.');
    pending=Promise.resolve().then(()=>setTicket({margin,leverage}));try{const result=await pending;dirty.clear();return result;}finally{pending=null;}
  }
  function update(){
    if(disposed)return;const edit=editing(),kind=mode(),terms=getTerms(),blocked=$('submit').disabled||edit||Boolean(pending)||getTicket().ready===false;
    for(const [id,key]of [['compactMargin','margin'],['compactLeverage','leverage']]){const el=$(id);el.disabled=edit;if(edit||!dirty.has(id)&&root.activeElement!==el&&!pending)if(Number.isFinite(terms?.[key]))el.value=terms[key];}
    for(const button of root.querySelectorAll('[data-mode]')){button.disabled=edit||Boolean(pending);button.setAttribute('aria-selected',String(button.dataset.mode===kind));}
    $('buy').disabled=blocked;$('sell').disabled=blocked;
    const price=quote();$('price').disabled=kind==='market';$('price').required=kind!=='market';mid.disabled=kind==='market'||price===null;
    if(kind==='market')$('price').value=price??'';
    const label=priceLabel.firstChild;label.textContent=kind==='market'?'Reference price · USD':kind==='trigger'?'Trigger price · USD':'Limit price · USD';
    $('modeHint').textContent=kind==='market'?'Market: submit now using fresh quotes. Unsubmitted requests expire after 10s.':kind==='trigger'?'Trigger: long at/above this price; short at/below it. Missed tolerance waits; final fill may differ.':'Limit: long at this price or lower; short at this price or higher. Final market fill may differ.';
    const notional=Number($('compactMargin').value)*Number($('compactLeverage').value),entry=Number($('price').value);$('positionSize').textContent=Number.isFinite(notional)&&notional>0?'Notional ≈ $'+notional.toLocaleString('en-US',{maximumFractionDigits:2})+(entry>0&&Number.isFinite(notional/entry)?' · '+(notional/entry).toLocaleString('en-US',{maximumFractionDigits:8})+' '+root.querySelector('.title').textContent.split('·').at(-1).trim():''):'Notional —';
    const balance=getBalance();$('available').textContent='Available: '+(balance==null?'—':balance)+' · Margin is per position';
    const values=getLiquidations();for(const side of ['long','short'])$(side+'Liquidation').textContent=(side==='long'?'Long':'Short')+' liq. '+(values[side].price==null?'—':'≈ $'+values[side].price.toLocaleString('en-US',{maximumFractionDigits:2}));
  }
  for(const button of root.querySelectorAll('[data-mode]'))button.onclick=()=>{if(editing())return;$('entryMode').value=button.dataset.mode;$('entryMode').dispatchEvent(new Event('change',{bubbles:true}));update();};
  mid.onclick=()=>{const reference=quote(),tick=getTick(),price=reference===null?null:Number.isFinite(tick?.mid)?tick.mid:reference;if(price!==null){$('price').value=price;$('price').dispatchEvent(new Event('input',{bubbles:true}));}};
  for(const id of ['compactMargin','compactLeverage']){$(id).addEventListener('input',()=>dirty.add(id));$(id).addEventListener('change',()=>{void prepare().catch(e=>error(e.message));});$(id).addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();void prepare().catch(x=>error(x.message));}});}
  for(const [id,side]of [['buy','long'],['sell','short']])$(id).onclick=()=>{if(editing()||$('submit').disabled)return;$(side).click();form.requestSubmit();};
  form.addEventListener('input',update);form.addEventListener('change',update);
  const timer=setInterval(update,250);update();return {prepare,update,mode,dispose(){disposed=true;clearInterval(timer);form.removeEventListener('input',update);form.removeEventListener('change',update);}};
}
