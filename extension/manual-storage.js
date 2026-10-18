import {validOwner} from './account.js';
export const unreadablePairTracking='Saved manual pair tracking is unreadable. New entries are blocked. Manage existing positions in native Positions. Saved tracking was not changed.';
const text=value=>typeof value==='string'&&value.trim().length>0;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const entryStates=new Set(['not_sent','sending','submitted','uncertain','filled']);
const closeStates=new Set(['available','sending','submitted','uncertain']);
const pairStates=new Set(['opening','open','closing','attention','closed']);
export function readStoredPairs(stored) {
  if(stored===undefined)return [];
  const fail=()=>{throw Error(unreadablePairTracking);};
  if(!Array.isArray(stored))fail();
  const ids=new Set();
  for(const pair of stored){
    if(!object(pair)||!text(pair.id)||ids.has(pair.id)||!validOwner(pair.owner)||(typeof pair.market!=='string'||!/^[A-Z][A-Z0-9]{0,15}$/.test(pair.market))||!pairStates.has(pair.status)||!Array.isArray(pair.legs))fail();
    ids.add(pair.id);
    if(!Number.isFinite(pair.createdAt)||pair.createdAt<0||!Number.isFinite(pair.margin)||pair.margin<=0||!Number.isInteger(pair.leverage)||pair.leverage<1||!Number.isInteger(pair.targetTabId)||pair.targetTabId<0||!text(pair.targetTabKey))fail();
    if(pair.status!=='closed'&&(!Array.isArray(pair.beforePositionIds)||!pair.beforePositionIds.every(text)))fail();
    if(pair.closeRequested!==undefined&&typeof pair.closeRequested!=='boolean')fail();
    // Empty closed history is harmless; active records must retain both leg identities.
    if(pair.legs.length!==(pair.status==='closed'&&pair.legs.length===0?0:2))fail();
    const sides=new Set(),positions=new Set();
    for(const leg of pair.legs){
      if(!object(leg)||!['long','short'].includes(leg.side)||sides.has(leg.side)||!entryStates.has(leg.entry)||!closeStates.has(leg.close))fail();
      sides.add(leg.side);
      if(leg.closed!==undefined&&typeof leg.closed!=='boolean')fail();
      if(leg.positionId!=null){if(!text(leg.positionId)||positions.has(leg.positionId))fail();positions.add(leg.positionId);}
      if(leg.entry==='filled'&&!text(leg.positionId))fail();
      if(leg.entry==='not_sent'&&leg.positionId!=null)fail();
      if((leg.closed||leg.close!=='available')&&!text(leg.positionId))fail();
      if(pair.status==='closed'&&leg.entry!=='not_sent'&&!leg.closed)fail();
    }
  }
  return structuredClone(stored);
}
