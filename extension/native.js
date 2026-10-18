import {readAccount,verifyAccount} from './account.js';
import {entryWindow,papertradePrice,positionMarkPrice,entryPriceAllowed,entryExitConflict} from './core.js';
function fields(document) {
  const margin = document.querySelector('#page-trade #im');
  const leverage = document.querySelector('#page-trade #il');
  const go = document.querySelector('#page-trade #go');
  if (!margin || !leverage || !go || margin.type !== 'number' || leverage.type !== 'number') throw Error('Native ticket not found. Reload the desktop BTC/ETH trade page.');
  return { margin, leverage, go };
}
export function readTicket(document) {
  try {
    const { margin, leverage, go } = fields(document);
    return { ok: true, margin: Number(margin.value), leverage: Number(leverage.value), ready: !go.disabled && go.getAttribute('data-trade-action') === 'open', action: go.textContent.trim() };
  } catch (error) { return { ok: false, error: error.message }; }
}
export function probeNative(document, order) {
  const market = location.pathname.split('/')[2]?.toUpperCase();
  if (market !== order.market) throw Error('Wrong market tab.');
  const ticket = readTicket(document);
  if (!ticket.ok) throw Error(ticket.error);
  if (!ticket.ready) throw Error(`Papertrade is not ready: ${ticket.action || 'disabled ticket'}. Connect/authorize your wallet and set a valid margin/leverage first.`);
  if(order.stopLoss != null || order.takeProfit != null) assertFullPositions(document);
  const owner = order.owner ? verifyAccount(document,order) : readAccount(document,order.market);
  return { ok: true, precisionSupported:true, owner, ...ticket };
}
function directionButton(document, side) {
  const label = side === 'long' ? '⬈ Long' : '⬊ Short';
  const matches = [...document.querySelectorAll('#page-trade button')].filter(b => b.textContent.trim() === label);
  if (matches.length !== 1) throw Error('Native direction control changed.');
  return matches[0];
}
export async function executeNative(document, order,{assertEntry=()=>{}}={}) {
  assertEntry();
  if (!Number.isFinite(order.deadline) || Date.now() > order.deadline) throw Error('Execution expired before reaching the page. Nothing clicked.');
  probeNative(document, order);
  const { margin, leverage } = fields(document);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  const set = (input, value) => {
    setter.call(input, String(value));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const directionBefore=directionButton(document,order.side);
  const prepare=Number(margin.value)!==order.margin || Number(leverage.value)!==order.leverage || directionBefore.getAttribute('aria-pressed')!=='true';
  if(directionBefore.getAttribute('aria-pressed')!=='true')directionBefore.click();
  if(Number(margin.value)!==order.margin)set(margin,order.margin);
  if(Number(leverage.value)!==order.leverage)set(leverage,order.leverage);
  if(prepare)await new Promise(resolve=>setTimeout(resolve,100));
  const current = fields(document), direction = directionButton(document, order.side);
  if (Date.now() > order.deadline) throw Error('Execution timed out while preparing the native ticket. Nothing clicked.');
  if (Number(current.margin.value) !== order.margin || Number(current.leverage.value) !== order.leverage || direction.getAttribute('aria-pressed') !== 'true') throw Error('Papertrade did not retain requested margin, leverage or direction. Nothing submitted.');
  if (current.go.disabled || current.go.getAttribute('data-trade-action') !== 'open') throw Error(`Native submit is unavailable: ${current.go.textContent.trim()}. Nothing clicked.`);
  if(order.stopLoss != null || order.takeProfit != null) assertFullPositions(document);
  let bindingSnapshotComplete=false;try{assertFullPositions(document);bindingSnapshotComplete=true;}catch{}
  const beforePositionIds = readPositions(document).map(p => p.positionId);
  let executionCheck=null;
  if(order.entryTolerance!=null) {
    const nodes=[...document.querySelectorAll('#assetPill .prw.numeric')];
    const nativePrice=nodes.length===1?Number(nodes[0].textContent.replace(/[$,\s]/g,'')):NaN;
    const tick=order.referenceQuote,checkedAt=Date.now();
    if(!Number.isFinite(nativePrice)||nativePrice<=0 || !entryWindow(order,tick,checkedAt) || !entryPriceAllowed(order,nativePrice) || entryExitConflict(order,nativePrice) || Math.abs(nativePrice-papertradePrice(tick))>order.entryTolerance) {
      return {ok:true,clicked:false,deferred:true,message:'Price check missed entry window. Nothing clicked; waiting for a fresh quote and Papertrade price near target.'};
    }
    executionCheck={nativePrice,referenceBid:tick.bid,referenceAsk:tick.ask,referenceMark:positionMarkPrice(tick),checkedAt,sourceAt:tick.sourceAt,target:order.price,tolerance:order.entryTolerance};
  }
  verifyAccount(document,order);assertEntry();
  const clickedAt=Date.now();if(clickedAt>order.deadline)throw Error('Execution expired before click. Nothing clicked.');
  // Once the native click is attempted, an exception cannot prove no submission.
  try { current.go.click(); }
  catch { return {ok:false,clicked:null,clickAttemptedAt:clickedAt,beforePositionIds,bindingSnapshotComplete,executionCheck,error:'Native submit click outcome is uncertain. Check Positions / Status; no automatic retry.'}; }
  return { ok: true, clicked: true, clickedAt, beforePositionIds, bindingSnapshotComplete, executionCheck, message: 'Native submit clicked once. Awaiting venue confirmation; check Positions / Status.' };
}

export function readPositions(document) {
  return [...document.querySelectorAll('.pt-card[role="listitem"][aria-label]')].flatMap(row => {
    const label = /^([A-Z][A-Z0-9]{0,15}) (long|short) position (\d+)$/.exec(row.getAttribute('aria-label') ?? '');
    if (!label) return [];
    const cells = [...row.querySelectorAll('.pt-cell')];
    const leverage = Number(/^(\d+)\s*×/.exec(row.querySelector('.pt-sub')?.textContent?.trim() ?? '')?.[1]);
    const margin = Number(cells[8]?.textContent?.replace(/[$,\s]/g, ''));
    const entryPrice = Number(cells[2]?.textContent?.replace(/[$,\s]/g, ''));
    const markPrice=Number(cells[3]?.textContent?.replace(/[$,\s]/g,''));
    return [{markPrice,market:label[1],side:label[2],positionId:label[3],margin,leverage,entryPrice}];
  });
}
export async function closeNative(document, order) {
  if (!Number.isFinite(order.deadline) || Date.now() > order.deadline) throw Error('Close deadline expired. Nothing clicked.');
  const matches = [...document.querySelectorAll('.pt-card[role="listitem"][aria-label]')].filter(row => row.getAttribute('aria-label') === `${order.market} ${order.side} position ${order.positionId}`);
  if (matches.length !== 1) throw Error('Bound position is not available in native Positions. Keep Positions visible.');
  const button = matches[0].querySelector('button.pt-close-btn');
  if (!button || button.disabled || button.getAttribute('aria-label') !== `Close ${order.market} position ${order.positionId}` || button.textContent.trim() !== 'Close') throw Error('Native position Close is unavailable or pending.');
  if (Date.now() > order.deadline) throw Error('Close deadline expired.');
  const checkedAt=Date.now(),nativePrice=Number(document.querySelector('#assetPill .prw.numeric')?.textContent?.replace(/[$,\s]/g,''));
  const cells=[...(matches[0].querySelectorAll?.('.pt-cell')??[])],markPrice=Number(cells[3]?.textContent?.replace(/[$,\s]/g,''));
  const checkedPrice=order.exitPriceMode==='mark'?markPrice:nativePrice;
  const executionCheck={priceBasis:order.exitPriceMode==='mark'?'position mark':'chart/legacy',checkedPrice:Number.isFinite(checkedPrice)&&checkedPrice>0?checkedPrice:null,nativeMark:Number.isFinite(markPrice)&&markPrice>0?markPrice:null,checkedAt,nativePrice:Number.isFinite(nativePrice)&&nativePrice>0?nativePrice:null,triggerToCheckMs:Number.isFinite(order.triggeredExitAt)?checkedAt-order.triggeredExitAt:null,sourceToCheckMs:Number.isFinite(order.triggerQuoteSourceAt)?checkedAt-order.triggerQuoteSourceAt:null};
  if(order.exitReason==='take profit') {
    const lead=order.exitLead??0,level=order.side==='long'?order.takeProfit-lead:order.takeProfit+lead;
    if(!Number.isFinite(checkedPrice)||checkedPrice<=0||!Number.isFinite(level)||(order.side==='long'?checkedPrice<level-.005:checkedPrice>level+.005))return {ok:true,clicked:false,deferred:true,executionCheck,message:'TP price reversed outside the early-trigger allowance. Nothing clicked; SL remains active and TP keeps watching.'};
  }
  verifyAccount(document,order);
  const clickedAt=Date.now();if(clickedAt>order.deadline)throw Error('Close deadline expired before click. Nothing clicked.');
  try { button.click(); }
  catch { return {ok:false,clicked:null,clickAttemptedAt:clickedAt,executionCheck,error:'Native Close click outcome is uncertain. Check Positions / Status; no automatic retry.'}; }
  Object.assign(executionCheck,{clickedAt,triggerToClickMs:Number.isFinite(order.triggeredExitAt)?clickedAt-order.triggeredExitAt:null,sourceToClickMs:Number.isFinite(order.triggerQuoteSourceAt)?clickedAt-order.triggerQuoteSourceAt:null});
  return {ok:true,clicked:true,executionCheck,message:`${order.exitReason} Close clicked for position #${order.positionId}. Verify settlement in Positions / Status.`};
}

export function assertFullPositions(document, {allowPending=false}={}) {
  const panel=document.querySelector('#postable.active');
  if(!panel)throw Error('Open native Positions before using TP / SL.');
  if(panel.querySelector('.trade-account-status'))throw Error('Native account data is delayed; exits cannot bind safely.');
  const rows=[...panel.querySelectorAll('.pt-card[role="listitem"]')];
  if(!rows.length && !/No Open Positions/i.test(panel.textContent))throw Error('Native Positions is not fully loaded.');
  if(!allowPending && rows.some(row=>/pending trade$/.test(row.getAttribute('aria-label')??'')))throw Error('Wait for pending native entries to finish before arming another bracket.');
  if(rows.some(row=>Number(row.getAttribute('aria-setsize'))!==rows.length))throw Error('Some native positions are not rendered. TP / SL cannot safely bind this view.');
}
