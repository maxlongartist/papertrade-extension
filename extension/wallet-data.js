// Public read-only projections. Never retain wallet balances, session keys or operations.
export const validAddress=value=>typeof value==='string'&&/^0x[0-9a-fA-F]{40}$/.test(value);
export function instrumentsFromTrading(data){
  if(!Array.isArray(data?.instruments))throw Error('Instrument metadata unavailable.');
  return new Map(data.instruments.filter(r=>Array.isArray(r)&&Number.isSafeInteger(r[0])&&typeof r[1]==='string'&&/^[A-Z0-9]{1,16}$/.test(r[1])&&Number(r[3])>0&&Number.isFinite(Number(r[3]))).map(r=>[r[0],{symbol:r[1],scale:Number(r[3])}]));
}
const rawNumber=(value,scale)=>typeof value==='string'&&/^\d{1,50}$/.test(value)?Number(value)/scale:NaN;
export function walletProjection(data,address,instruments){
  if(!validAddress(address)||data?.address?.toLowerCase()!==address.toLowerCase()||!Array.isArray(data.openPositions)||data.openPositions.length>5000||!Number.isSafeInteger(data.walletRevision)||data.walletRevision<0)throw Error('Invalid public position snapshot.');
  const positions=[],ids=new Set();
  for(const row of data.openPositions){
    const instrument=instruments.get(row?.[1]);
    if(!Array.isArray(row)||!/^\d{1,30}$/.test(row[0])||typeof row[2]!=='boolean'||typeof row[3]!=='boolean')throw Error('Position schema changed.');
    if(ids.has(row[0]))throw Error('Duplicate position ID.');ids.add(row[0]);
    if(!instrument)continue;
    const entry=rawNumber(row[4],instrument.scale),margin=rawNumber(row[5],1e18),leverage=row[6],liquidation=rawNumber(row[7],instrument.scale),openedAt=row[8];
    if(![entry,margin,leverage,liquidation,openedAt].every(Number.isFinite)||entry<=0||margin<=0||!Number.isSafeInteger(leverage)||leverage<1||leverage>100000||openedAt<0)throw Error('Invalid public position values.');
    positions.push({id:row[0],market:instrument.symbol,side:row[2]?'long':'short',entry,margin,leverage,liquidation,notional:margin*leverage,openedAt});
  }
  return {address:address.toLowerCase(),revision:data.walletRevision,positions};
}
export function leaderboardWallets(data){
  if(data?.ok!==true||!Array.isArray(data.accounts))throw Error('Leaderboard unavailable.');
  const seen=new Set();return data.accounts.filter(r=>validAddress(r.address)&&!seen.has(r.address.toLowerCase())&&seen.add(r.address.toLowerCase())).slice(0,10).map(r=>({address:r.address.toLowerCase(),name:typeof r.leaderboardName==='string'?r.leaderboardName.slice(0,40):''}));
}
export function createSSEParser(onEvent){
  let buffer='',event='message',data=[];
  return chunk=>{
    buffer+=chunk;if(buffer.length>1000000)throw Error('Public feed frame too large.');
    let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end).replace(/\r$/,'');buffer=buffer.slice(end+1);
      if(!line){if(data.length)onEvent({event,data:data.join('\n')});event='message';data=[];continue;}
      if(line.startsWith('event:'))event=line.slice(6).trim();else if(line.startsWith('data:'))data.push(line.slice(5).replace(/^ /,''));
      if(data.reduce((n,v)=>n+v.length,0)>1000000)throw Error('Public feed event too large.');
    }
  };
}
export function retryDelay(attempt,retryAfter,now=Date.now()){
  const seconds=Number(retryAfter),date=Date.parse(retryAfter);
  const requested=retryAfter!=null?(Number.isFinite(seconds)?seconds*1000:Number.isFinite(date)?date-now:0):0;
  return Math.max(Math.min(60000,1000*2**Math.min(attempt,6)),Math.min(3600000,Math.max(0,requested)));
}
export function fitAxis(samples,width,height){
  const points=samples.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.price)&&p.price>0&&p.x>width*.5&&p.x<width&&p.y>=0&&p.y<height-15);
  let best=null;
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
    const a=points[i],b=points[j];if(Math.abs(a.x-b.x)>2||Math.abs(a.y-b.y)<30||a.price===b.price)continue;
    const slope=(b.y-a.y)/(b.price-a.price);if(slope>=0)continue;const intercept=a.y-slope*a.price;
    const inliers=points.filter(p=>Math.abs(p.x-a.x)<2&&Math.abs(p.y-(slope*p.price+intercept))<.8);
    const span=inliers.length?Math.max(...inliers.map(p=>p.y))-Math.min(...inliers.map(p=>p.y)):0;
    if(inliers.length>=3&&span>height*.25&&(!best||inliers.length>best.count||inliers.length===best.count&&span>best.span))best={slope,intercept,right:a.x-5,count:inliers.length,span};
  }
  return best;
}
export function groupLevels(levels,axis,gap=10){
  const groups=[];
  for(const kind of ['entry','liquidation']){
    let last=null;
    for(const level of levels.filter(l=>l.kind===kind).map(l=>({...l,y:axis.slope*l.price+axis.intercept})).filter(l=>Number.isFinite(l.y)).sort((a,b)=>a.y-b.y)){
      if(last&&level.y-last.minY<gap){last.items.push(level);last.maxY=level.y;last.y=(last.minY+last.maxY)/2;if(last.side!==level.side)last.side='mixed';}
      else{last={y:level.y,minY:level.y,maxY:level.y,side:level.side,kind,items:[level]};groups.push(last);}
    }
  }
  return groups.sort((a,b)=>a.y-b.y);
}

// The public SSE protocol uses full snapshots followed by account-revision patches.
// Retain only public position fields and IDs, never the rest of the account frame.
export function createWalletReducer(address,instruments){
  let current=null,ids=new Set();
  return data=>{
    if(!validAddress(data?.address)||data.address.toLowerCase()!==address.toLowerCase())throw Error('Public wallet identity mismatch.');
    if(!Number.isSafeInteger(data.accountRevision)||data.accountRevision<=0)throw Error('Invalid account revision.');
    if(!Object.hasOwn(data,'baseAccountRevision')){
      const next=walletProjection(data,address,instruments);
      if(current&&(next.revision<current.revision||data.accountRevision<current.accountRevision))throw Error('Out-of-order wallet snapshot.');
      ids=new Set(data.openPositions.map(row=>row[0]));current={...next,accountRevision:data.accountRevision};return current;
    }
    if(!current||data.baseAccountRevision!==current.accountRevision||data.accountRevision<=current.accountRevision)throw Error('Public feed revision gap; reconnecting for a full snapshot.');
    if(!data.state||typeof data.state!=='object'||Array.isArray(data.state)||!Array.isArray(data.addedPositions)||!Array.isArray(data.removedPositionIds)||data.addedPositions.length>5000||data.removedPositionIds.length>5000)throw Error('Invalid public position patch.');
    const revision=Object.hasOwn(data.state,'walletRevision')?data.state.walletRevision:current.revision;
    if(!Number.isSafeInteger(revision)||revision<current.revision)throw Error('Out-of-order wallet revision.');
    const removed=new Set();for(const id of data.removedPositionIds){if(typeof id!=='string'||!/^\d{1,30}$/.test(id)||removed.has(id)||!ids.has(id))throw Error('Unknown or duplicate removed position.');removed.add(id);}
    const additions=walletProjection({address:data.address,walletRevision:revision,openPositions:data.addedPositions},address,instruments).positions;
    const nextIds=new Set([...ids].filter(id=>!removed.has(id)));
    for(const row of data.addedPositions){if(ids.has(row[0]))throw Error('Duplicate added position.');nextIds.add(row[0]);}
    if(nextIds.size>5000)throw Error('Too many public positions.');
    const positions=[...current.positions.filter(p=>!removed.has(p.id)),...additions].sort((a,b)=>BigInt(a.id)>BigInt(b.id)?-1:1);
    current={address:address.toLowerCase(),revision,accountRevision:data.accountRevision,positions};ids=nextIds;return current;
  };
}
export const walletName=w=>w.alias?.trim()||w.name?.trim()||`${w.address.slice(0,6)}…${w.address.slice(-4)}`;
export function positionChanges(previous,next,at=Date.now()){
  // Full snapshots establish a baseline after gaps, not observed trade events.
  if(!previous||next.publication==='snapshot'||previous.address!==next.address)return [];
  const before=new Map(previous.positions.map(p=>[p.id,p])),after=new Map(next.positions.map(p=>[p.id,p])),events=[];
  for(const p of next.positions){const old=before.get(p.id);if(!old)events.push({...p,action:'opened',at,address:next.address});else if(['entry','margin','leverage','liquidation','side','market'].some(key=>old[key]!==p[key]))events.push({...p,action:'changed',at,address:next.address});}
  for(const p of previous.positions)if(!after.has(p.id))events.push({...p,action:'removed',at,address:next.address});
  return events;
}
export function namedWalletGroups(levels,axis){
  const wallets=new Map();for(const level of levels){const key=level.address??'';if(!wallets.has(key))wallets.set(key,[]);wallets.get(key).push(level);}
  return [...wallets.values()].flatMap(rows=>groupLevels(rows,axis)).sort((a,b)=>a.y-b.y);
}
// Spread labels without changing the price line. A connector joins displaced labels.
export function labelRows(groups,top,bottom,gap=22){
  if(!groups.length)return [];const cap=Math.max(1,Math.floor((bottom-top)/gap)+1);
  const rows=groups.slice(0,cap).map(g=>({...g,labelY:Math.max(top,Math.min(bottom,g.y))}));
  for(let i=1;i<rows.length;i++)rows[i].labelY=Math.max(rows[i].labelY,rows[i-1].labelY+gap);
  if(rows.at(-1).labelY>bottom){rows.at(-1).labelY=bottom;for(let i=rows.length-2;i>=0;i--)rows[i].labelY=Math.min(rows[i].labelY,rows[i+1].labelY-gap);}
  return rows;
}
