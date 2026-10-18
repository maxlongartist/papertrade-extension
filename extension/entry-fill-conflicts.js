// Native fill binding accepts this margin deviation for rounded position rows.
export const entryFillMarginTolerance=0.006;
const pending=new Set(['watching','submitting','submitted','awaiting_fill']);
const protectedEntry=order=>order.stopLoss!=null||order.takeProfit!=null;
export function findEntryFillConflict(candidate,orders){
 if(!pending.has(candidate.status))return null;
 return orders.find(other=>other.id!==candidate.id&&pending.has(other.status)&&
  (protectedEntry(candidate)||protectedEntry(other))&&other.owner===candidate.owner&&
  other.market===candidate.market&&other.side===candidate.side&&other.leverage===candidate.leverage&&
  Number.isFinite(other.margin)&&Number.isFinite(candidate.margin)&&
  Math.abs(other.margin-candidate.margin)<=2*entryFillMarginTolerance+1e-9)??null;
}
