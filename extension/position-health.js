// Read-only page visibility health. Never changes an exit trigger or claims settlement.
export function positionHealth(order,now=Date.now()){
 if(order.status!=='exits_armed')return null;
 const id=String(order.positionId??'?');
 if(!Number.isFinite(order.positionCheckedAt)||order.positionCheckedAt>now+1000||now-order.positionCheckedAt>5000)
  return {warning:true,text:`Position #${id} check unavailable or stale. Watch retained; check native Positions / Status.`};
 if(order.positionObservation==='visible')return {warning:false,text:`Position #${id} visible in a recent native check.`};
 if(order.positionObservation==='absent')return {warning:true,text:`Position #${id} not visible. Watch retained for this ID; check native Positions / Status.`};
 return {warning:true,text:`Position #${id} check unavailable. Keep the original wallet and native Positions visible. Watch retained.`};
}
