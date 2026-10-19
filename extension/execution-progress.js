// Visible evidence only: native clicks are not fills; disappearance is not settlement.
export function legProgress(leg){
  if(!leg)return 'Not requested';
  const stages=['Request'];
  if(leg.clickedAt)stages.push('Native entry click');
  if(leg.positionId)stages.push('Position identified');
  if(leg.closeRequestedAt||['sending','submitted','uncertain','closed'].includes(leg.close))stages.push('Close requested');
  if(leg.closeClickedAt)stages.push('Native close click');
  if(leg.closed)stages.push('Absent in Positions');
  return stages.join(' → ');
}
export function pairHealthLabel(metrics,closing=false){
  if(!metrics?.fresh)return 'Position observations unavailable or stale';
  if(metrics.unresolvedLegs)return 'Pair incomplete · an entry or close is unconfirmed';
  if(metrics.visibleLegs===1)return closing?'One leg remains · directional exposure':'One leg visible · directional exposure';
  if(metrics.visibleLegs===2)return 'Two legs visible · exposure estimate below';
  return 'No legs currently visible';
}

export function orderProgress(order){
  const stages=[order.kind==='position_exits'?'Existing position selected':'Watching target'];
  if(order.triggeredAt)stages.push('Trigger recorded');
  if(order.entryClickedAt)stages.push('Native entry click');
  if(order.positionId&&order.kind!=='position_exits')stages.push('Position identified');
  if(order.status==='exits_armed')stages.push('SL/TP armed');
  if(order.closeClickedAt)stages.push('Native close click');
  else if(['closing','close_submitted'].includes(order.status))stages.push('Close requested');
  if(order.status==='closed')stages.push('Closure observed');
  return stages.join(' → ');
}
