export const validOwner = owner => typeof owner === 'string' && /^0x[0-9a-f]{40}$/.test(owner);
export function readAccount(document, market) {
  if (location.pathname.split('/')[2]?.toUpperCase() !== market) throw Error('Wrong market tab.');
  const owner=document.querySelector('#connectBtn')?.getAttribute('title')?.toLowerCase();
  if (!validOwner(owner)) throw Error('Connect your Papertrade wallet first.');
  const view=new URL(location.href).searchParams.get('view');
  if(view && view.toLowerCase()!==owner)throw Error('Return to your own wallet view.');
  return owner;
}
export function verifyAccount(document, order) {
  if(!validOwner(order.owner))throw Error('Watch has no verified wallet binding. Re-arm it from your intended wallet. Nothing clicked.');
  const owner=readAccount(document,order.market);
  if(owner!==order.owner)throw Error('Wallet changed. Return to the wallet that created this watch. Nothing clicked.');
  return owner;
}
export function verifySnapshot(snapshot, owner) {
  if(!snapshot?.ok)throw Error(snapshot?.error??'Native Positions unavailable.');
  if(!validOwner(snapshot.owner) || (owner && snapshot.owner!==owner))throw Error('Wallet changed or account identity unavailable. Return to the original wallet.');
  return snapshot.owner;
}
