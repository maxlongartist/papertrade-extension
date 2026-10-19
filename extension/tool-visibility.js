// Presentation only: never unmounts controls or changes order/watch state.
const preference='papertrade.toolsHidden.v1';
const targets=['paperpilot-trading-workspace','paperpilot-extension','paperpilot-manual-pair','paperpilot-network-queue','paperpilot-wallets','paperpilot-trade-tape','paperpilot-monitor','paperpilot-tool-tabs','paperpilot-chart-overlay','paperpilot-chart-analysis','paperpilot-analysis-overlay'];
export function mountToolVisibility({getAnchor,storage=chrome.storage.local}={}){
  let hidden=false,revision=0,disposed=false,saving=Promise.resolve();
  const style=document.createElement('style');style.id='paperpilot-visibility-style';
  style.textContent=[...targets.map(id=>`:root[data-paperpilot-tools-hidden="true"] #${id}`),':root[data-paperpilot-tools-hidden="true"] [data-paperpilot-position]'].join(',')+'{display:none!important}';
  document.head.append(style);
  const button=document.createElement('button');button.id='paperpilot-visibility-toggle';button.type='button';button.setAttribute('aria-controls',targets.join(' '));
  button.style.cssText='position:fixed;top:50%;transform:translateY(-50%);width:30px;height:112px;z-index:10000;display:flex;align-items:center;justify-content:center;writing-mode:vertical-rl;border:1px solid #647d92;border-radius:7px;font:600 12px system-ui;cursor:pointer;box-shadow:0 2px 10px #0005;pointer-events:auto';document.body.append(button);
  function render(){
    if(disposed)return;
    const value=String(hidden);if(document.documentElement.getAttribute('data-paperpilot-tools-hidden')!==value)document.documentElement.setAttribute('data-paperpilot-tools-hidden',value);
    const text=hidden?'Show tools ›':'‹ Hide tools';if(button.textContent!==text)button.textContent=text;
    button.setAttribute('aria-label',hidden?'Show Papertrade extension tools':'Hide Papertrade extension tools');button.setAttribute('aria-expanded',String(!hidden));
    button.title=hidden?'Show extension panels and overlays.':'Hide extension panels and overlays. Active order monitoring keeps running.';
    button.style.background=hidden?'#d6e6f0':'#1c2938';button.style.color=hidden?'#14222b':'#d6e6f0';
    const anchor=getAnchor();button.hidden=!anchor;button.style.display=anchor?'flex':'none';
    if(anchor){const rect=(anchor.closest('.panel-col')??anchor).getBoundingClientRect();button.style.left=Math.max(4,Math.min(window.innerWidth-34,rect.left-32))+'px';}
  }
  function setHidden(value){if(disposed)return;revision++;hidden=value;render();const savedValue=hidden;saving=saving.catch(()=>{}).then(()=>storage.set({[preference]:savedValue})).catch(()=>{});}
  button.onclick=()=>setHidden(!hidden);
  const initialRevision=revision;void Promise.resolve().then(()=>storage.get(preference)).then(data=>{if(disposed||revision!==initialRevision)return;hidden=data[preference]===true;render();}).catch(()=>{});
  window.addEventListener('resize',render);render();
  return {refresh:render,show(){setHidden(false);},dispose(){if(disposed)return;disposed=true;window.removeEventListener('resize',render);button.remove();style.remove();document.documentElement.removeAttribute('data-paperpilot-tools-hidden');}};
}
