export const duplicateEntryMessage='Extra Papertrade extension controls detected. Entries from this copy are paused. Keep your original installed copy, disable duplicates, then refresh Papertrade.';
const ownerAttribute='data-paperpilot-entry-owner';
const panelIds=['paperpilot-extension','paperpilot-manual-pair','paperpilot-network-queue'];
// Coordination between isolated extension worlds on the same document, not wallet authorization.
// Ownership lasts until page refresh; an unknown/older copy is never displaced automatically.
export function createPageInstance(document,extensionId,token=crypto.randomUUID()) {
  const root=document.documentElement,value=JSON.stringify({extensionId,token});
  const existing=root.getAttribute(ownerAttribute),legacy=panelIds.some(id=>document.querySelectorAll(`[id="${id}"]`).length>0);
  const claimed=existing===null&&!legacy;
  if(claimed)root.setAttribute(ownerAttribute,value);
  const canEnter=()=>claimed&&root.getAttribute(ownerAttribute)===value&&!panelIds.some(id=>document.querySelectorAll(`[id="${id}"]`).length>1);
  let owner;try{owner=JSON.parse(root.getAttribute(ownerAttribute));}catch{}
  const knownOther=typeof owner?.extensionId==='string'&&owner.extensionId!==extensionId;
  const responderAttribute='data-paperpilot-native-'+extensionId;
  const responding=(claimed||knownOther)&&root.getAttribute(responderAttribute)===null;
  if(responding)root.setAttribute(responderAttribute,token);
  // Do not register a second listener: even returning false can close a pending response.
  const ignoreNativeMessages=()=>!responding;
  const assertEntry=()=>{if(!canEnter())throw Error(duplicateEntryMessage);};
  return {claimed,canEnter,assertEntry,ignoreNativeMessages};
}
