import test from 'node:test';
import assert from 'node:assert/strict';
import {pairAfterAcknowledgement, pairMetrics, pairHistoryReport, elapsedLabel} from '../extension/manual-view.js';
const pair = () => ({market:'BTC',owner:'secret-owner',targetTabId:11,targetTabKey:'secret-session',margin:25,leverage:400,createdAt:100000,observedAt:160000,status:'open',legs:[
 {side:'long',entry:'filled',positionId:'1',visible:true,fillPrice:80000,markPrice:81000},
 {side:'short',entry:'filled',positionId:'2',visible:true,fillPrice:80010,markPrice:81000},
]});
test('gross estimate and residual exposure use each native entry price and current mark',()=>{
 const p=pair(),m=pairMetrics(p,162000);
 assert.equal(m.elapsed,62);assert.equal(m.visibleLegs,2);assert.equal(m.fresh,true);
 assert.ok(Math.abs(m.grossPnl-(125-10000*990/80010))<1e-9);
 assert.ok(Math.abs(m.netExposure-(10125-10000*81000/80010))<1e-9);
});
test('stale, invalid, disconnected and closed observations never display current financial estimates',()=>{
 for(const mutate of [p=>p.observedAt=150000,p=>p.observationError=true,p=>p.legs[0].markPrice=null,p=>p.status='closed',p=>p.legs[0].fillPrice=0]){
  const p=pair();mutate(p);const m=pairMetrics(p,162000);assert.equal(m.grossPnl,null);assert.equal(m.netExposure,null);
 }
});
test('partial pair exposes the remaining leg exposure; closed history duration freezes',()=>{
 const p=pair();p.legs[1].closed=true;const m=pairMetrics(p,162000);assert.equal(m.visibleLegs,1);assert.ok(Math.abs(m.grossPnl-125)<1e-9);assert.equal(m.netExposure,10125);
 p.closedAt=162000;p.status='closed';assert.equal(pairMetrics(p,300000).elapsed,62);assert.equal(elapsedLabel(62),'1m 2s');
});
test('history exports native IDs and action evidence while omitting wallet and browser identifiers and raw errors',()=>{
 const p=pair();p.message='may contain account context';p.legs[0].error='secret-error';p.legs[0].closeClickedAt=161000;
 const report=pairHistoryReport([p],162000),json=JSON.stringify(report);
 assert.equal(report.pairs[0].legs[0].closeClickedAt,161000);assert.equal(report.pairs[0].legs[0].positionId,'1');
 assert.match(report.note,/no settlement/);assert.doesNotMatch(json,/secret-|targetTab|owner|may contain/);
});
test('future position observation timestamps cannot claim fresh exposure or PnL estimates',()=>{
 const p=pair();p.observedAt=163001;const m=pairMetrics(p,162000);assert.equal(m.fresh,false);assert.equal(m.grossPnl,null);assert.equal(m.netExposure,null);
});
test('queue history exports only public request-time fields even long after their capture',()=>{
 const p=pair();p.entryQueue={available:true,recordedAt:100000,source:'public-stream',sourceAt:99800,receivedAt:99900,level:'MEDIUM',pending:28,clearSeconds:4,owner:'secret-wallet',raw:{key:'secret-key'}};
 const report=pairHistoryReport([p],900000);assert.equal(report.pairs[0].entryQueue.available,true);assert.equal(report.pairs[0].entryQueue.pending,28);assert.equal(report.pairs[0].closeQueue,null);assert.doesNotMatch(JSON.stringify(report),/secret-wallet|secret-key/);
});

test('pair metrics distinguish visible exposure from unconfirmed pending or missing legs',()=>{
 for(const entry of ['sending','submitted','uncertain','filled']){
  const p=pair();Object.assign(p.legs[1],{entry,visible:false});const m=pairMetrics(p,162000);assert.equal(m.unresolvedLegs,1);assert.equal(m.visibleLegs,1);assert.equal(m.netExposure,10125);
 }
});
test('a definitively unsent or confirmed closed leg does not leave exposure unconfirmed',()=>{
 for(const state of [{entry:'not_sent'},{entry:'filled',closed:true}]){
  const p=pair();Object.assign(p.legs[1],{visible:false,...state});assert.equal(pairMetrics(p,162000).unresolvedLegs,0);
 }
});
test('both visible legs have no unconfirmed exposure while missing position observations remain unresolved',()=>{
 const p=pair();assert.equal(pairMetrics(p,162000).unresolvedLegs,0);p.legs[1].visible=null;assert.equal(pairMetrics(p,162000).unresolvedLegs,1);
});

test('a terminal pair observation cannot be undone by an active acknowledgement',()=>{
 const current={id:'p',status:'closed',observedAt:200};for(const status of ['opening','open','closing','attention'])assert.equal(pairAfterAcknowledgement(current,{id:'p',status,observedAt:300}),current);
});
test('newer same-intent position observations win over older or unobserved acknowledgements',()=>{
 const current={id:'p',status:'open',observedAt:200};for(const observedAt of [100,null,undefined])assert.equal(pairAfterAcknowledgement(current,{id:'p',status:'opening',observedAt}),current);
 const closing={...current,status:'closing',closeRequested:true};assert.equal(pairAfterAcknowledgement(closing,{id:'p',status:'closing',closeRequested:true,observedAt:100}),closing);
});
test('a new Close intent still applies even if its acknowledgement has an older observation',()=>{
 const current={id:'p',status:'open',observedAt:200},next={id:'p',status:'closing',closeRequested:true,observedAt:100};assert.equal(pairAfterAcknowledgement(current,next),next);assert.equal(pairAfterAcknowledgement(next,current),next);
});
test('new pairs and confirmed closure acknowledgements are accepted',()=>{
 const current={id:'p',status:'open',observedAt:200},next={id:'other',status:'opening',observedAt:null};assert.equal(pairAfterAcknowledgement(current,next),next);assert.equal(pairAfterAcknowledgement(null,next),next);
 const closed={id:'p',status:'closed',observedAt:100};assert.equal(pairAfterAcknowledgement(current,closed),closed);
});
test('a newer active acknowledgement can advance the displayed position state',()=>{
 const current={id:'p',status:'opening',observedAt:100},next={id:'p',status:'open',observedAt:200};assert.equal(pairAfterAcknowledgement(current,next),next);
});
