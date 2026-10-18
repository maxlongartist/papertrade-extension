export const invalidEntryExpiryMessage='Saved entry has no valid expiry. Re-arm it from your intended wallet. Nothing submitted.';
// Cancellation retires only an unsent watch. It never cancels a native request.
export function canCancelEntry(order) {
 if(order?.status==='watching')return true;
 return order?.status==='attention'&&order.kind!=='position_exits'&&order.entryDisabledReason==='invalid_expiry'&&
  ['positionId','triggeredAt','submittedAt','entryClickedAt','entryTriggerPrice','executionCheck','beforePositionIds'].every(key=>order[key]==null)&&order.bindingSnapshotComplete!==true;
}
