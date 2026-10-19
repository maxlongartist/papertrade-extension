import {validAddress} from './wallet-data.js';
const kind='papertrade-wallet-watchlist',maxBytes=32768;
const exactKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&Object.keys(value).every(k=>keys.includes(k));
export function parseWatchlistBackup(text){
  const fail=()=>{throw Error('Choose a valid Papertrade wallet-watchlist backup (version 1, maximum 10 wallets).');};
  if(typeof text!=='string'||text.length>maxBytes||new TextEncoder().encode(text).length>maxBytes)fail();
  let data;try{data=JSON.parse(text);}catch{fail();}
  if(!exactKeys(data,['kind','version','wallets'])||data.kind!==kind||data.version!==1||!Array.isArray(data.wallets)||data.wallets.length>10)fail();
  const seen=new Set();return data.wallets.map(w=>{
    if(!exactKeys(w,['address','name','alias','selected','alerts'])||!validAddress(w.address)||typeof w.name!=='string'||w.name.length>40||typeof w.alias!=='string'||w.alias.length>40||typeof w.selected!=='boolean'||typeof w.alerts!=='boolean')fail();
    const address=w.address.toLowerCase();if(seen.has(address))fail();seen.add(address);
    return {address,name:w.name,alias:w.alias,selected:w.selected,alerts:w.alerts,nameChecked:Boolean(w.name)};
  });
}
export function watchlistBackup(wallets){
  const data={kind,version:1,wallets:wallets.map(w=>({address:w.address,name:w.name??'',alias:w.alias??'',selected:w.selected!==false,alerts:w.alerts!==false}))};
  parseWatchlistBackup(JSON.stringify(data));return data;
}
export function mergeWatchlistBackup(current,incoming){
  const saved=new Map(current.map(w=>[w.address.toLowerCase(),{...w,address:w.address.toLowerCase()}])),additions=incoming.filter(w=>!saved.has(w.address));
  if(saved.size+additions.length>10)throw Error(`Not enough free slots. Remove ${saved.size+additions.length-10} saved wallet(s) before importing this file.`);
  return {wallets:[...saved.values(),...additions.map(w=>({...w}))],added:additions.length,existing:incoming.length-additions.length};
}
export function mountWatchlistBackup(root,{getWallets,apply,isAvailable=()=>true}){
  root.innerHTML='<details><summary>Back up / import wallet list</summary><p>Backups contain public wallet addresses, names and your custom labels. Review before sharing. No keys, orders or journal records are included. This extension reads and writes the file locally; it does not upload it.</p><button id="watchExport">Download wallet list</button><button id="watchChoose" type="button">Choose backup file</button><input id="watchFile" type="file" hidden accept="application/json,.json" aria-label="Wallet-watchlist backup file"><p id="watchBackupStatus" role="status" style="min-height:3em"></p><div id="watchPreview" style="max-height:170px;overflow:auto;font-size:11px;white-space:pre-line;overflow-wrap:anywhere"></div><p>Existing wallet settings stay. New wallets retain the backup’s names, watch selections and alert choices. If watching is on, selected additions start public feeds. The file is never uploaded.</p><button id="watchApply" disabled>Add wallets from this backup</button><button id="watchDiscard" disabled>Discard preview</button></details>';
  const $=id=>root.querySelector('#'+id);let disposed=false,version=0,rows=null,reading=false,busy=false,message='';
  const text=(element,value)=>{if(element.textContent!==value)element.textContent=value;};
  function refresh(){
    if(disposed)return;const available=isAvailable();
    if(!available){version++;rows=null;reading=false;text($('watchPreview'),'');message='Extension connection was reset. Refresh Papertrade.';}
    let plan,error='';try{if(rows)plan=mergeWatchlistBackup(getWallets(),rows);}catch(e){error=e.message;}
    $('watchExport').disabled=!available||busy||!getWallets().length;$('watchFile').disabled=!available||busy;$('watchChoose').disabled=!available||busy;$('watchApply').disabled=!available||busy||reading||!plan?.added;$('watchDiscard').disabled=!available||busy||!rows&&!reading;
    const status=busy?'Saving wallet list…':reading?'Reading local file…':error||message||(!rows?'Choose a backup to preview before adding wallets.':`${plan.added} new · ${plan.existing} already saved. Existing settings are kept.`);
    text($('watchBackupStatus'),status);
    // The preview is text only, including any names from untrusted local files.
    text($('watchPreview'),rows?rows.map(w=>`${w.alias||w.name||w.address} · ${w.selected?'watch':'not watched'} · alerts ${w.alerts?'on':'off'}\n${w.address}`).join('\n\n'):'');
  }
  $('watchExport').onclick=()=>{
    if(disposed||busy||!isAvailable())return;
    try{const data=watchlistBackup(getWallets()),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='papertrade-wallet-watchlist.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message='Wallet list downloaded. Review custom labels before sharing.';}catch{message='Wallet list could not be exported. Saved settings were not changed.';}refresh();
  };
  $('watchChoose').onclick=()=>{if(!disposed&&!busy&&isAvailable())$('watchFile').click();};
  $('watchFile').onchange=async()=>{
    const file=$('watchFile').files?.[0],generation=++version;$('watchFile').value='';rows=null;message='';reading=Boolean(file);refresh();if(!file)return;
    try{if(file.size>maxBytes)throw Error('Backup is too large. Maximum file size is 32 KB.');const parsed=parseWatchlistBackup(await file.text());if(disposed||generation!==version||!isAvailable())return;rows=parsed;}
    catch(e){if(!disposed&&generation===version)message=e.message;}
    finally{if(!disposed&&generation===version){reading=false;refresh();}}
  };
  $('watchDiscard').onclick=()=>{version++;rows=null;reading=false;message='Preview discarded. Saved wallets were not changed.';refresh();};
  $('watchApply').onclick=async()=>{
    if(disposed||busy||reading||!rows||!isAvailable())return;
    const incoming=rows;busy=true;message='';refresh();
    try{const plan=mergeWatchlistBackup(getWallets(),incoming);if(!plan.added)return;const result=await apply(incoming);if(disposed)return;rows=null;message=`${result.added} wallet(s) saved. Existing wallet settings were kept.`;}
    catch(e){if(!disposed)message=e.message||'Wallet list could not be saved.';}
    finally{busy=false;refresh();}
  };
  refresh();return {refresh,dispose(){disposed=true;version++;rows=null;}};
}
