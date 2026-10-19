import {closedTradePage,tradeHistoryUrl} from './trade-context-data.js';
import {validAddress} from './wallet-data.js';
const key='tradeJournalV1';
export function createJournal({storage,fetcher=fetch,evidence=async()=>[],now=Date.now}){
  let queue=Promise.resolve();
  async function read(){const value=(await storage.get(key))[key];if(value===undefined)return {version:1,records:[]};
    if(value?.version!==1||!Array.isArray(value.records)||value.records.length>1000)throw Error('Saved journal is unreadable. Existing records were not changed.');
    const ids=new Set();for(const r of value.records){
      if(!r||!validAddress(r.owner)||typeof r.id!=='string'||!/^\d{1,80}$/.test(r.id)||ids.has(r.owner+':'+r.id)||!['PositionClosed','Liquidated'].includes(r.outcome)||!['long','short'].includes(r.side)||!/^[A-Z0-9]{1,16}$/.test(r.market??'')||![r.entry,r.exit,r.margin,r.leverage,r.openedAt,r.closedAt].every(Number.isFinite)||r.entry<=0||r.margin<=0||!Number.isSafeInteger(r.leverage)||r.leverage<1||!Number.isSafeInteger(r.openedAt)||!Number.isSafeInteger(r.closedAt)||r.openedAt<0||r.closedAt<r.openedAt||!/^0x[0-9a-f]{64}$/.test(r.txHash??'')||typeof r.note!=='string'||r.note.length>500||typeof r.sourceLabel!=='string'||r.sourceLabel.length>80||r.sourceWallet!=null&&!validAddress(r.sourceWallet))throw Error('Saved journal is unreadable. Existing records were not changed.');
      for(const field of ['netRaw','adjustedPnlRaw'])if(typeof r[field]!=='string'||! /^-?\d{1,80}$/.test(r[field]))throw Error('Saved journal is unreadable. Existing records were not changed.');
      for(const field of ['feeRaw','paperRaw'])if(typeof r[field]!=='string'||! /^\d{1,80}$/.test(r[field]))throw Error('Saved journal is unreadable. Existing records were not changed.');
      if(BigInt(r.netRaw)!==BigInt(r.adjustedPnlRaw)-BigInt(r.feeRaw))throw Error('Saved journal is unreadable. Existing records were not changed.');if(r.entryEvidence!=null&&(![r.entryEvidence.target,r.entryEvidence.venueDeviation,r.entryEvidence.entryClickedAt].every(Number.isFinite)||r.entryEvidence.target<=0||r.entryEvidence.entryClickedAt<=0))throw Error('Saved journal is unreadable. Existing records were not changed.');ids.add(r.owner+':'+r.id);
    }
    return value;
  }
  return {request(message,identify){const operation=async()=>{
    const owner=await identify();if(!validAddress(owner)||message.expectedOwner!==owner)throw Error('Wallet changed. Reload this journal from the intended account.');
    const data=await read();let records=data.records.filter(r=>r.owner===owner),nextCursor=null;
    if(message.type==='journalRefresh'){
      const url=tradeHistoryUrl(owner,message.cursor??null),response=await fetcher('https://exchange.papertrade.xyz'+url,{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(8000)});
      if(!response.ok)throw Error(response.status===429?'History rate limited. Wait before refreshing.':'Trade history unavailable.');
      const page=closedTradePage(await response.json());if(page.nextCursor&&page.nextCursor===message.cursor)throw Error('History returned a repeated cursor.');nextCursor=page.nextCursor;
      if(await identify()!==owner)throw Error('Wallet changed during history lookup. Nothing saved.');
      const executions=await evidence().catch(()=>[]);const map=new Map(data.records.map(r=>[r.owner+':'+r.id,r]));for(const item of page.items){const old=map.get(owner+':'+item.id),matches=Array.isArray(executions)?executions.filter(o=>o.owner===owner&&String(o.positionId)===item.id&&o.market===item.market&&o.side===item.side&&o.kind!=='position_exits'&&Number.isFinite(o.price)&&o.price>0&&Number.isFinite(o.entryClickedAt)&&o.entryClickedAt>0):[],entryEvidence=matches.length===1?{target:matches[0].price,venueDeviation:(item.entry-matches[0].price)*(item.side==='long'?1:-1),entryClickedAt:matches[0].entryClickedAt}:matches.length>1?null:old?.txHash===item.txHash?old.entryEvidence??null:null;map.set(owner+':'+item.id,{...item,owner,entryEvidence,note:old?.note??'',sourceWallet:old?.sourceWallet??null,sourceLabel:old?.sourceLabel??'',taggedBy:old?.taggedBy,taggedAt:old?.taggedAt,checkedAt:now()});}
      if(map.size>1000)throw Error('Journal limit reached (1000 records). Export and clear a wallet journal before importing more. Existing records were not changed.');const updated={version:1,records:[...map.values()].sort((a,b)=>b.closedAt-a.closedAt)};
      if(await identify()!==owner)throw Error('Wallet changed. Nothing saved.');await storage.set({[key]:updated});records=updated.records.filter(r=>r.owner===owner);
    }else if(message.type==='journalNote'){
      if(typeof message.id!=='string'||typeof message.note!=='string'||message.note.length>500||message.sourceWallet!=null&&!validAddress(message.sourceWallet)||typeof message.sourceLabel!=='string'||message.sourceLabel.length>80)throw Error('Invalid journal note.');
      const index=data.records.findIndex(r=>r.owner===owner&&r.id===message.id);if(index<0)throw Error('Closed trade not found in this wallet journal.');
      if(await identify()!==owner)throw Error('Wallet changed. Nothing saved.');
      const updated={...data,records:data.records.map((r,i)=>i===index?{...r,note:message.note,sourceWallet:message.sourceWallet??null,sourceLabel:message.sourceLabel,taggedBy:'user',taggedAt:now()}:r)};
      if(await identify()!==owner)throw Error('Wallet changed. Nothing saved.');await storage.set({[key]:updated});records=updated.records.filter(r=>r.owner===owner);
    }else if(message.type==='journalClear'){if(await identify()!==owner)throw Error('Wallet changed. Nothing removed.');await storage.set({[key]:{version:1,records:data.records.filter(r=>r.owner!==owner)}});records=[];}else if(message.type!=='journalRead')throw Error('Unknown journal request.');
    if(await identify()!==owner)throw Error('Wallet changed. Reload the intended account journal.');
    return {owner,records,nextCursor,checkedAt:now()};
  };const result=queue.then(operation);queue=result.catch(()=>{});return result;}};
}
