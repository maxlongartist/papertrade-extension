import {fitAxis,groupLevels} from './wallet-data.js';
const ns='http://www.w3.org/2000/svg';
const color=l=>l.kind==='liquidation'?'#e9b968':l.side==='long'?'#77dfa0':'#ff9b9b';
export function mountNativeOverlay({getLevels,getDraft,setDraft,onStatus=()=>{}}){
  let host,root,svg,canvas,axis,drag=null,signature='',disposed=false,lastStatus='';
  const status=text=>{if(text!==lastStatus){lastStatus=text;onStatus(text);}};
  const node=(tag,attrs={},text)=>{const e=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!=null)e.textContent=text;return e;};
  function finish(){if(!drag)return;const field=drag.field;drag=null;setDraft(field,getDraft()?.[field],{dragging:false});signature='';render();}
  function render(){
    if(disposed)return;const chart=document.querySelector('#chart'),next=chart?.querySelector('canvas#cv');
    if(!next||document.visibilityState!=='visible'){host?.remove();host=null;axis=null;status('Chart unavailable · list remains available');return;}
    if(!host||canvas!==next||!host.isConnected){host?.remove();canvas=next;host=document.createElement('div');host.id='paperpilot-chart-overlay';host.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:8;overflow:hidden';root=host.attachShadow({mode:'closed'});svg=node('svg',{'aria-label':'Public wallet levels and order drafts',style:'position:absolute;overflow:hidden;pointer-events:none;font:11px system-ui'});root.append(svg);chart.append(host);signature='';
      svg.addEventListener('pointerdown',e=>{const handle=e.target.closest('[data-draft]');if(!handle||!axis)return;e.preventDefault();e.stopPropagation();const d=getDraft();if(!d||d.mode==='position'&&handle.dataset.draft==='price')return;drag={field:handle.dataset.draft,y:e.clientY,price:Number(d[handle.dataset.draft]),axis:{...axis},route:location.pathname};svg.setPointerCapture(e.pointerId);});
      svg.addEventListener('pointermove',e=>{if(!drag)return;if(drag.route!==location.pathname){drag=null;signature='';return;}const value=Math.max(.01,Math.round((drag.price+(e.clientY-drag.y)/drag.axis.slope*(e.shiftKey?.1:1))*100)/100);setDraft(drag.field,value,{dragging:true});signature='';render();});
      svg.addEventListener('pointerup',finish);svg.addEventListener('pointercancel',finish);
      svg.addEventListener('keydown',e=>{const h=e.target.closest('[data-draft]');if(!h||!['ArrowUp','ArrowDown'].includes(e.key))return;const d=getDraft();if(!d||d.mode==='position'&&h.dataset.draft==='price')return;e.preventDefault();const field=h.dataset.draft;setDraft(field,Math.max(.01,Number(d[field])+(e.key==='ArrowUp'?1:-1)),{dragging:false});signature='';render();svg.querySelector(`[data-draft="${field}"]`)?.focus();});
    }
    const rect=canvas.getBoundingClientRect(),chartRect=chart.getBoundingClientRect();
    Object.assign(svg.style,{left:rect.left-chartRect.left+'px',top:rect.top-chartRect.top+'px',width:rect.width+'px',height:rect.height+'px'});svg.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);
    let geometry;try{const raw=canvas.getAttribute('data-paperpilot-axis');if(!raw||raw.length>30000)throw Error();geometry=JSON.parse(raw);if(geometry.route!==location.pathname||Math.abs(geometry.width-rect.width)>1||Math.abs(geometry.height-rect.height)>1||Date.now()-geometry.at>3000||geometry.at>Date.now()+1000||!Array.isArray(geometry.points)||geometry.points.length>100)throw Error();axis=fitAxis(geometry.points,rect.width,rect.height);}catch{axis=null;}
    if(!axis){svg.replaceChildren();signature='';drag=null;status('Waiting for a verified chart scale · pan or zoom to refresh');return;}
    const draft=getDraft(),levels=getLevels();
    const visible=levels.filter(l=>{const y=axis.slope*l.price+axis.intercept;return y>=12&&y<=rect.height-38;}).length;
    status(drag?'Dragging draft · save/arm in the ticket to apply':`Chart scale verified · ${visible}/${levels.length} wallet levels in view${visible<levels.length?' · zoom out to see more':''}. Drafts require Save / Arm.`);const key=JSON.stringify([axis,levels,draft,drag?.field]);if(key===signature)return;signature=key;svg.replaceChildren();
    const right=Math.max(0,Math.min(axis.right,rect.width-30)),height=rect.height-26;
    for(const group of groupLevels(levels,axis)){
      if(group.y<12||group.y>height-12)continue;const first=group.items[0],c=group.side==='mixed'?'#c6d6ed':color(first),g=node('g',{'data-wallet-level':'',style:'pointer-events:visiblePainted'});
      g.append(node('line',{x1:0,x2:right,y1:group.y,y2:group.y,stroke:c,'stroke-opacity':'.6','stroke-dasharray':first.kind==='liquidation'?'2 5':'6 4'}));
      const longs=group.items.filter(l=>l.side==='long').length;
      const label=group.items.length>1?`${first.kind==='liquidation'?'Liq':'Entries'} · ${longs}L / ${group.items.length-longs}S · ${group.items.length} positions`:`${first.kind==='liquidation'?'Liq':first.side==='long'?'L':'S'} $${first.price.toLocaleString(undefined,{maximumFractionDigits:2})}`;
      if(group.maxY>group.minY)g.append(node('rect',{x:0,y:group.minY,width:right,height:Math.max(2,group.maxY-group.minY),fill:c,'fill-opacity':'.15'}));
      g.append(node('rect',{x:6,y:group.y-9,width:Math.min(right,210),height:18,rx:3,fill:'#111b24','fill-opacity':'.94'}),node('text',{x:11,y:group.y+4,fill:c},label));
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
