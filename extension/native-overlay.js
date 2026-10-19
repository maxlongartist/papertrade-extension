import {fitAxis,namedWalletGroups,labelRows} from './wallet-data.js';
const ns='http://www.w3.org/2000/svg';
const color=l=>l.kind==='liquidation'?'#e9b968':l.side==='long'?'#77dfa0':'#ff9b9b';
export function mountNativeOverlay({getLevels,getActivity=()=>[],getDraft,setDraft,onStatus=()=>{}}){
  let host,root,svg,rail,ticker,canvas,axis,drag=null,signature='',disposed=false,lastStatus='';
  const status=text=>{if(text!==lastStatus){lastStatus=text;onStatus(text);}};
  const node=(tag,attrs={},text)=>{const e=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!=null)e.textContent=text;return e;};
  function finish(){if(!drag)return;const field=drag.field;drag=null;setDraft(field,getDraft()?.[field],{dragging:false});signature='';render();}
  function render(){
    if(disposed)return;const chart=document.querySelector('#chart'),next=chart?.querySelector('canvas#cv');
    if(!next||document.visibilityState!=='visible'){host?.remove();host=null;axis=null;status('Chart unavailable · list remains available');return;}
    if(!host||canvas!==next||!host.isConnected){host?.remove();canvas=next;host=document.createElement('div');host.id='paperpilot-chart-overlay';host.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:8;overflow:hidden';root=host.attachShadow({mode:'closed'});svg=node('svg',{'aria-label':'Public wallet levels and order drafts',style:'position:absolute;overflow:hidden;pointer-events:none;font:11px system-ui'});root.append(svg);rail=document.createElement('div');rail.setAttribute('data-offscreen-wallets','');rail.style.cssText='position:absolute;right:80px;top:58px;width:230px;max-height:175px;overflow:auto;background:#101a26ed;color:#d4e4f0;border-radius:5px;font:11px/1.6 system-ui;pointer-events:auto';ticker=document.createElement('div');ticker.setAttribute('data-wallet-moves','');ticker.style.cssText='position:absolute;left:8px;top:7px;width:min(440px,70%);max-height:46px;overflow:auto;background:#101a26ed;color:#d4e4f0;border-radius:4px;font:11px/1.6 system-ui;pointer-events:auto';root.append(rail,ticker);chart.append(host);signature='';
      svg.addEventListener('pointerdown',e=>{const handle=e.target.closest('[data-draft]');if(!handle||!axis)return;e.preventDefault();e.stopPropagation();const d=getDraft();if(!d||d.mode==='position'&&handle.dataset.draft==='price')return;drag={field:handle.dataset.draft,y:e.clientY,price:Number(d[handle.dataset.draft]),axis:{...axis},route:location.pathname};svg.setPointerCapture(e.pointerId);});
      svg.addEventListener('pointermove',e=>{if(!drag)return;if(drag.route!==location.pathname){drag=null;signature='';return;}const value=Math.max(.01,Math.round((drag.price+(e.clientY-drag.y)/drag.axis.slope*(e.shiftKey?.1:1))*100)/100);setDraft(drag.field,value,{dragging:true});signature='';render();});
      svg.addEventListener('pointerup',finish);svg.addEventListener('pointercancel',finish);
      svg.addEventListener('keydown',e=>{const h=e.target.closest('[data-draft]');if(!h||!['ArrowUp','ArrowDown'].includes(e.key))return;const d=getDraft();if(!d||d.mode==='position'&&h.dataset.draft==='price')return;e.preventDefault();const field=h.dataset.draft;setDraft(field,Math.max(.01,Number(d[field])+(e.key==='ArrowUp'?1:-1)),{dragging:false});signature='';render();svg.querySelector(`[data-draft="${field}"]`)?.focus();});
    }
    const rect=canvas.getBoundingClientRect(),chartRect=chart.getBoundingClientRect();
    Object.assign(svg.style,{left:rect.left-chartRect.left+'px',top:rect.top-chartRect.top+'px',width:rect.width+'px',height:rect.height+'px'});svg.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);
    let geometry;try{const raw=canvas.getAttribute('data-paperpilot-axis');if(!raw||raw.length>30000)throw Error();geometry=JSON.parse(raw);if(geometry.route!==location.pathname||Math.abs(geometry.width-rect.width)>1||Math.abs(geometry.height-rect.height)>1||Date.now()-geometry.at>3000||geometry.at>Date.now()+1000||!Array.isArray(geometry.points)||geometry.points.length>100)throw Error();axis=fitAxis(geometry.points,rect.width,rect.height);}catch{axis=null;}
    if(!axis){svg.replaceChildren();rail.replaceChildren();ticker.replaceChildren();signature='';drag=null;status('Waiting for a verified chart scale · pan or zoom to refresh');return;}
    const draft=getDraft(),levels=getLevels(),moves=getActivity().filter(e=>Date.now()-e.at<30000).slice(0,3);
    const visible=levels.filter(l=>{const y=axis.slope*l.price+axis.intercept;return y>=12&&y<=rect.height-38;}).length;
    status(drag?'Dragging draft · save/arm in the ticket to apply':`Chart scale verified · ${visible}/${levels.length} wallet levels in view${visible<levels.length?' · zoom out to see more':''}. Drafts require Save / Arm.`);const key=JSON.stringify([axis,levels,draft,drag?.field,moves]);if(key===signature)return;signature=key;svg.replaceChildren();
    const right=Math.max(0,Math.min(axis.right,rect.width-30)),height=rect.height-26;
    const groups=namedWalletGroups(levels,axis),inView=groups.filter(g=>g.y>=12&&g.y<=height-12),rows=labelRows(inView,65,height-12);
    rail.replaceChildren();ticker.replaceChildren();
    const outside=groups.filter(g=>g.y<12||g.y>height-12);
    if(outside.length){const heading=document.createElement('b');heading.textContent='Outside price view · '+outside.length+' levels';rail.append(heading);for(const g of outside.slice(0,50)){const p=g.items[0],row=document.createElement('div');row.setAttribute('data-offscreen-wallet',p.address);row.textContent=`${g.y<12?'↑':'↓'} ${p.name||p.address.slice(0,8)} · ${p.kind==='liquidation'?'Liq ':''}${p.side} $${p.price.toLocaleString()}${g.items.length>1?' · '+g.items.length+' positions':''}`;row.title=g.items.map(l=>`${l.name} · ${l.kind} ${l.side} #${l.id} · $${l.price}`).join('\n');row.style.color=color(p);rail.append(row);}}
    if(rows.length<inView.length){const more=document.createElement('div');more.textContent=(inView.length-rows.length)+' additional levels · narrow wallet filters';rail.append(more);}
    for(const e of moves){const line=document.createElement('div');line.textContent=`${e.name} · ${e.action==='removed'?'no longer open':e.action.toUpperCase()} ${e.side} #${e.id} · $${e.entry.toLocaleString()}`;ticker.append(line);}
    for(const group of rows){
      const first=group.items[0],c=group.side==='mixed'?'#c6d6ed':color(first),g=node('g',{'data-wallet-level':'','data-wallet-address':first.address,style:'pointer-events:visiblePainted'});
      g.append(node('line',{x1:0,x2:right,y1:group.y,y2:group.y,stroke:c,'stroke-opacity':'.6','stroke-dasharray':first.kind==='liquidation'?'2 5':'6 4'}));
      const longs=group.items.filter(l=>l.side==='long').length,name=first.name||first.address.slice(0,6)+'…'+first.address.slice(-4);
      const description=group.items.length>1?`${longs}L/${group.items.length-longs}S · ${group.items.length} positions`:`${first.side==='long'?'LONG':'SHORT'} $${first.price.toLocaleString(undefined,{maximumFractionDigits:2})}`;
      const label=`${name.length>22?name.slice(0,21)+'…':name} · ${first.kind==='liquidation'?'Liq ':''}${description}`;
      if(group.maxY>group.minY)g.append(node('rect',{x:0,y:group.minY,width:right,height:Math.max(2,group.maxY-group.minY),fill:c,'fill-opacity':'.15'}));
      const labelWidth=Math.min(right-10,Math.max(160,label.length*6+10));
      if(Math.abs(group.labelY-group.y)>1)g.append(node('line',{x1:labelWidth+6,x2:labelWidth+20,y1:group.labelY,y2:group.y,stroke:c,'stroke-opacity':'.7'}));
      g.append(node('rect',{x:6,y:group.labelY-9,width:labelWidth,height:18,rx:3,fill:'#111b24','fill-opacity':'.94'}),node('text',{x:11,y:group.labelY+4,fill:c},label));
      g.append(node('title',{},group.items.map(l=>`${l.name||l.address}\n${l.address}\n${l.side} #${l.id} · ${l.leverage}× · $${l.notional.toLocaleString()} notional\n${l.kind} $${l.price}`).join('\n\n')));svg.append(g);
    }
    if(draft)for(const [field,label,c]of [['price','Entry','#bedffc'],['stopLoss','SL','#ff9b9b'],['takeProfit','TP','#77dfa0']]){
      const price=draft[field],y=axis.slope*price+axis.intercept;if(!Number.isFinite(price)||price<=0||y<12||y>height-12)continue;
      const editable=!(field==='price'&&draft.mode==='position'),g=node('g',editable?{'data-draft':field,tabindex:0,role:'slider','aria-label':label+' draft on main chart','aria-valuenow':price,'aria-valuemin':'.01','aria-valuemax':'10000000',style:'pointer-events:visiblePainted;cursor:ns-resize'}:{});
      const x=Math.max(6,right-194);g.append(node('line',{x1:0,x2:right,y1:y,y2:y,stroke:c,'stroke-width':2}),node('rect',{x,y:y-10,width:188,height:20,rx:3,fill:'#162c3a'}),node('text',{x:x+5,y:y+4,fill:c},`${label} $${price.toFixed(2)} · ${editable?'DRAFT':'position'}`),node('title',{},'Dragging changes the ticket draft only. Save/arm in the ticket to apply.'));svg.append(g);
    }
  }
  document.documentElement.setAttribute('data-paperpilot-chart-enabled','true');
  const timer=setInterval(render,200);render();return ()=>{disposed=true;clearInterval(timer);host?.remove();document.documentElement.removeAttribute('data-paperpilot-chart-enabled');document.querySelector('#cv')?.removeAttribute('data-paperpilot-axis');};
}
