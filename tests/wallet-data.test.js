import test from 'node:test';import assert from 'node:assert/strict';
import {walletProjection,instrumentsFromTrading,leaderboardWallets,createSSEParser,retryDelay,fitAxis,groupLevels} from '../extension/wallet-data.js';
import {legProgress,pairHealthLabel} from '../extension/execution-progress.js';
const address='0x'+'1'.repeat(40),instruments=instrumentsFromTrading({instruments:[[0,'BTC',0,'10'],[1,'ETH',0,'100']]});
const snapshot={address,walletRevision:123,sessionKeys:['secret'],funds:{balance:'private'},openPositions:[['5',0,true,false,'830001','20000000000000000000',300,'827500',1000,'ignored']]};
test('public projection scales venue units and discards unrelated account data',()=>{const data=walletProjection(snapshot,address,instruments);assert.deepEqual(Object.keys(data).sort(),['address','positions','revision']);assert.equal(data.positions[0].entry,83000.1);assert.equal(data.positions[0].margin,20);assert.equal(data.positions[0].notional,6000);assert.equal(data.positions[0].side,'long');assert.ok(!JSON.stringify(data).includes('secret'));});
test('public snapshot fails closed on wallet mismatch, schema changes, duplicate IDs and invalid units',()=>{for(const data of [{...snapshot,address:'0x'+'2'.repeat(40)},{...snapshot,walletRevision:-1},{...snapshot,openPositions:[snapshot.openPositions[0],snapshot.openPositions[0]]},{...snapshot,openPositions:[['5',0,'true',false,'1','1',300,'1',1]]},{...snapshot,openPositions:[['5',0,true,false,'-1','1',300,'1',1]]}])assert.throws(()=>walletProjection(data,address,instruments));});
test('unknown instruments are excluded rather than using an assumed price scale',()=>{assert.equal(walletProjection({...snapshot,openPositions:[['6',19,true,false,'1','1',300,'1',1]]},address,instruments).positions.length,0);});
test('leaderboard retains only unique valid addresses and safe plain names, max ten',()=>{const rows=Array.from({length:13},(_,i)=>({address:'0x'+String(i).padStart(40,'0'),leaderboardName:'<script>'+i}));const result=leaderboardWallets({ok:true,accounts:[{address:'invalid'},...rows,rows[0]]});assert.equal(result.length,10);assert.equal(result[0].name,'<script>0');assert.deepEqual(Object.keys(result[0]),['address','name']);});
test('SSE parser handles split UTF8-decoded chunks, CRLF, comments and multiline data',()=>{const events=[],parse=createSSEParser(x=>events.push(x));for(const chunk of [': he','artbeat\r\nevent: wal','let\r\ndata: {"a":\r\ndata: 1}\r\n\r','\nevent: liveness\ndata: {}\n\n'])parse(chunk);assert.deepEqual(events,[{event:'wallet',data:'{"a":\n1}'},{event:'liveness',data:'{}'}]);});
test('SSE parser bounds both unfinished lines and multiline events',()=>{assert.throws(()=>createSSEParser(()=>{})('x'.repeat(1000001)));const parse=createSSEParser(()=>{});assert.throws(()=>{for(let i=0;i<101;i++)parse('data: '+'x'.repeat(10000)+'\n');});});
test('retries honor Retry-After seconds and dates, with bounded exponential backoff',()=>{assert.equal(retryDelay(0,'120'),120000);assert.equal(retryDelay(5,null),32000);assert.equal(retryDelay(99,'0'),60000);assert.equal(retryDelay(0,new Date(90000).toUTCString(),0),90000);assert.equal(retryDelay(0,'99999999'),3600000);});
test('axis consensus excludes a displaced price badge and rejects ambiguous/insufficient scales',()=>{const points=[{price:80000,x:700,y:400},{price:81000,x:700,y:300},{price:82000,x:700,y:200},{price:83000,x:700,y:100},{price:82400,x:700,y:140},{price:12345,x:10,y:100}];const fit=fitAxis(points,800,500);assert.equal(fit.slope,-.1);assert.equal(fit.intercept,8400);assert.equal(fit.count,4);assert.equal(fitAxis(points.slice(0,2),800,500),null);assert.equal(fitAxis(points.map(p=>({...p,y:500-p.y})),800,500),null);});
test('nearby opposing entries share a band while retaining side counts and separate liquidation levels',()=>{const levels=[{price:10,side:'long',kind:'entry'},{price:11,side:'long',kind:'entry'},{price:12,side:'short',kind:'entry'},{price:13,side:'short',kind:'liquidation'}];const groups=groupLevels(levels,{slope:-1,intercept:100});assert.deepEqual(groups.map(g=>g.items.length),[1,3]);assert.equal(groups[1].side,'mixed');assert.equal(groups[1].kind,'entry');});
test('execution progress describes evidence without claiming settlement',()=>{assert.equal(legProgress({entry:'submitted',close:'not_sent'}),'Request');assert.equal(legProgress({entry:'not_sent',close:'available'}),'Request');assert.equal(legProgress({clickedAt:1,positionId:'5',close:'submitted',closeClickedAt:2,closed:true}),'Request → Native entry click → Position identified → Close requested → Native close click → Absent in Positions');assert.match(pairHealthLabel({fresh:true,visibleLegs:1,unresolvedLegs:0}),/directional/);assert.match(pairHealthLabel({fresh:false,visibleLegs:2}),/stale/);});

test('account-revision patches add and remove positions without keeping unrelated account fields',async()=>{
 const {createWalletReducer}=await import('../extension/wallet-data.js'),reduce=createWalletReducer(address,instruments);
 const first=reduce({...snapshot,accountRevision:7});
 const next=reduce({address,baseAccountRevision:7,accountRevision:8,state:{walletRevision:124,funds:{secret:'discard'}},addedPositions:[['6',0,false,false,'831000','10000000000000000000',200,'835000',2000]],removedPositionIds:['5'],addedOperations:[],removedOperationIds:[]});
 assert.equal(next.positions.length,1);assert.equal(next.positions[0].id,'6');assert.equal(next.positions[0].side,'short');assert.equal(next.accountRevision,8);assert.equal(next.revision,124);assert.ok(!JSON.stringify(next).includes('discard'));assert.equal(first.positions[0].id,'5','prior projection is immutable');
 const sameBlock=reduce({address,baseAccountRevision:8,accountRevision:9,state:{},addedPositions:[],removedPositionIds:[]});assert.equal(sameBlock.revision,124);assert.equal(sameBlock.accountRevision,9);
});
test('delta gaps, wallet mismatches and duplicate additions force resynchronization without partial state changes',async()=>{
 const {createWalletReducer}=await import('../extension/wallet-data.js');
 for(const override of [{baseAccountRevision:6},{accountRevision:7},{address:'0x'+'2'.repeat(40)},{state:{walletRevision:122}},{removedPositionIds:['999']},{removedPositionIds:['5','5']},{addedPositions:snapshot.openPositions}]){
  const reduce=createWalletReducer(address,instruments);reduce({...snapshot,accountRevision:7});
  assert.throws(()=>reduce({address,baseAccountRevision:7,accountRevision:8,state:{},addedPositions:[],removedPositionIds:[],...override}));
  assert.equal(reduce({address,baseAccountRevision:7,accountRevision:8,state:{},addedPositions:[],removedPositionIds:[]}).positions[0].id,'5');
 }
 const reduce=createWalletReducer(address,instruments);assert.throws(()=>reduce({address,baseAccountRevision:0,accountRevision:1,state:{},addedPositions:[],removedPositionIds:[]}));
});
test('unknown instrument IDs can be removed by a later patch without inventing prices',async()=>{
 const {createWalletReducer}=await import('../extension/wallet-data.js'),reduce=createWalletReducer(address,instruments);reduce({...snapshot,accountRevision:1,openPositions:[['9',99,true,false,'1','1',1,'1',1],...snapshot.openPositions]});
 const next=reduce({address,baseAccountRevision:1,accountRevision:2,state:{},addedPositions:[],removedPositionIds:['9']});assert.equal(next.positions.length,1);assert.equal(next.positions[0].id,'5');
});
test('position activity excludes bootstrap and heartbeat, names replacements, and distinguishes removals from liquidations',async()=>{
 const {positionChanges,walletName}=await import('../extension/wallet-data.js'),base={address,positions:[{id:'1',market:'BTC',side:'long',entry:83000,margin:10,leverage:100,liquidation:82000}]};
 assert.deepEqual(positionChanges(null,base),[]);assert.deepEqual(positionChanges(base,base),[]);
 const changed={address,positions:[{...base.positions[0],margin:20},{...base.positions[0],id:'2',side:'short'}]};assert.deepEqual(positionChanges(base,changed,100).map(e=>e.action),['changed','opened']);
 const removed=positionChanges(base,{address,positions:[]},200);assert.equal(removed[0].action,'removed');assert.equal(removed[0].at,200);assert.equal(removed[0].address,address);
 assert.equal(walletName({address,name:'Venue name',alias:'My whale'}),'My whale');assert.equal(walletName({address,name:'Venue name'}),'Venue name');assert.match(walletName({address}),/0x1111/);
});
test('coincident wallet entries retain separate named groups and nonoverlapping labels with exact price anchors',async()=>{
 const {namedWalletGroups,labelRows}=await import('../extension/wallet-data.js'),groups=namedWalletGroups([{address:'a',name:'Alice',price:10,side:'long',kind:'entry'},{address:'b',name:'Bob',price:10,side:'long',kind:'entry'}],{slope:-1,intercept:100});
 assert.equal(groups.length,2);const rows=labelRows(groups,65,150);assert.equal(rows[0].y,90);assert.equal(rows[1].y,90);assert.ok(rows[1].labelY-rows[0].labelY>=22);assert.equal(rows[0].items[0].name,'Alice');assert.equal(rows[1].items[0].name,'Bob');
});

test('full snapshots and cross-wallet snapshots never manufacture live position moves',async()=>{
 const {positionChanges}=await import('../extension/wallet-data.js'),previous={address,positions:[{id:'1',market:'BTC',side:'long'}]},next={address,publication:'snapshot',positions:[{id:'2',market:'BTC',side:'short'}]};
 assert.deepEqual(positionChanges(previous,next),[]);
 assert.deepEqual(positionChanges(previous,{...next,publication:'update',address:'0x'+'2'.repeat(40)}),[]);
 assert.deepEqual(positionChanges(next,{address,publication:'update',positions:[...next.positions,{id:'3',market:'BTC',side:'long'}]},100).map(e=>[e.id,e.action]),[['3','opened']]);
});
