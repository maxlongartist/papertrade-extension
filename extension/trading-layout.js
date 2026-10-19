// Presentation only. Sidebar content must never determine the chart height.
export const tradingLayoutCSS=`
@media (min-width:761px){
  #page-trade:has(#paperpilot-trading-workspace) #upper{
    min-height:300px;max-height:max(300px,calc(100dvh - 180px));
    flex-basis:clamp(300px,calc((100vw - 380px)*.56),70dvh);
  }
  #page-trade:has(#paperpilot-trading-workspace) .panel-col:has(#panelScroll){
    width:clamp(320px,25vw,420px);min-width:280px;max-width:min(440px,40vw);min-height:0;
  }
  #page-trade:has(#paperpilot-trading-workspace) #panel{min-height:0;min-width:0;flex:1 1 0%;overflow:hidden}
  #page-trade:has(#paperpilot-trading-workspace) #panelScroll{
    min-height:0;min-width:0;flex:1 1 0%;overflow-y:auto;overflow-x:hidden;
    overscroll-behavior-y:contain;scrollbar-gutter:stable;overflow-anchor:none;
  }
  #page-trade:has(#paperpilot-trading-workspace) #chart{min-width:0;min-height:0}
  #page-trade:has(#paperpilot-trading-workspace) :is(#vrsz,#rsz){flex-shrink:0}
}
`;
export function mountTradingLayout({getAnchor}){
  document.getElementById('paperpilot-layout')?.remove();const style=document.createElement('style');style.id='paperpilot-layout';style.textContent=tradingLayoutCSS;document.head.append(style);
  let host,anchor,disposed=false;
  function refresh(){
    if(disposed)return;const panel=getAnchor();if(!panel){host?.remove();host=null;anchor=null;return;}
    if(host?.isConnected&&anchor===panel)return;host?.remove();anchor=panel;
    host=document.createElement('div');host.id='paperpilot-layout-controls';host.style.cssText='display:block;position:sticky;top:0;z-index:12;flex-shrink:0';
    const root=host.attachShadow({mode:'closed'});root.innerHTML=`<style>:host{display:block}@media(max-width:760px){:host{display:none!important}}nav{display:flex;gap:5px;align-items:center;padding:7px;background:#15212bed;border-bottom:1px solid #425362;backdrop-filter:blur(6px)}button{font:600 11px/1.3 system-ui;border:1px solid #465d6f;border-radius:5px;background:#223343;color:#d7e5ee;padding:6px 8px;cursor:pointer;white-space:nowrap}button:hover{background:#344c60}button:focus-visible{outline:2px solid #a9d8ff;outline-offset:1px}#fit{margin-left:auto}</style><nav aria-label="Trading workspace layout"><button type="button" data-target="paperpilot-extension">Trade</button><button type="button" data-target="paperpilot-chart-analysis">Indicators</button><button type="button" data-target="paperpilot-wallets">Wallets</button><button type="button" id="fit" title="Restore automatic chart height and sidebar width. Does not change orders or indicator settings.">Fit layout</button></nav>`;
    for(const button of root.querySelectorAll('[data-target]'))button.onclick=()=>{const target=document.getElementById(button.dataset.target);if(!target||!panel.contains(target))return;const top=panel.scrollTop+target.getBoundingClientRect().top-panel.getBoundingClientRect().top-host.getBoundingClientRect().height-6;panel.scrollTo({top:Math.max(0,top),behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});};
    root.getElementById('fit').onclick=()=>{const page=panel.closest('#page-trade'),upper=page?.querySelector('#upper'),column=panel.closest('.panel-col');upper?.style.removeProperty('flex-basis');column?.style.removeProperty('width');if(page)page.scrollTop=0;window.dispatchEvent(new Event('resize'));};
    panel.prepend(host);
  }
  refresh();return {refresh,dispose(){disposed=true;host?.remove();style.remove();}};
}
