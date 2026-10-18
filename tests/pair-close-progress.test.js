import test from 'node:test';import assert from 'node:assert/strict';import {pairCloseProgress} from '../extension/manual-view.js';
const now=100000,pair=()=>({status:'closing',closeRequested:true,observedAt:now,legs:[{side:'long',positionId:'1',close:'submitted',closeRequestedAt:99000,visible:true},{side:'short',positionId:'2',close:'submitted',closeRequestedAt:99000,visible:true}]});
test('close progress is absent before Close intent and after observed closure',()=>{assert.equal(pairCloseProgress(null,now),null);assert.equal(pairCloseProgress({...pair(),closeRequested:false},now),null);assert.equal(pairCloseProgress({...pair(),status:'closed'},now),null);});
test('submitted closes are pending observations rather than reported closed',()=>{const state=pairCloseProgress(pair(),now);assert.equal(state.label,'Close pending');assert.equal(state.warning,false);assert.match(state.message,/2 Close requests submitted/);assert.match(state.message,/position observations/);});
test('a single unconfirmed leg overrides pending progress and names the side',()=>{const p=pair();p.legs[1].close='uncertain';const state=pairCloseProgress(p,now);assert.equal(state.label,'Close needs attention');assert.equal(state.warning,true);assert.match(state.message,/Short Close unconfirmed/);assert.match(state.message,/no duplicate Close/i);});
test('confirmed closed legs cannot keep an obsolete uncertainty warning active',()=>{const p=pair();p.legs[1].close='uncertain';p.legs[1].closed=true;const state=pairCloseProgress(p,now);assert.equal(state.warning,false);assert.equal(state.label,'Close pending');assert.match(state.message,/1 Close request submitted/);});
test('a visible leg with a long-pending submitted close is highlighted without authorizing a retry',()=>{const p=pair();p.legs[0].closeRequestedAt=now-30001;const state=pairCloseProgress(p,now);assert.equal(state.warning,true);assert.match(state.message,/Long/);assert.match(state.message,/native Positions and Status/);assert.match(state.message,/not repeated/);});
test('sending, unavailable-close and unresolved-fill stages remain distinct from submitted closes',()=>{
 for(const close of ['sending','available']){const p=pair();p.legs.forEach(l=>l.close=close);const state=pairCloseProgress(p,now);assert.match(state.label,/Closing pair|Waiting to close/);assert.doesNotMatch(state.message,/requests submitted/);}
 const p=pair();p.legs=[{side:'long',entry:'uncertain',close:'available'}];assert.match(pairCloseProgress(p,now).message,/late fills/);
});
test('future or missing request timestamps do not invent delayed-close evidence',()=>{for(const at of [null,undefined,now+1000]){const p=pair();p.legs.forEach(l=>l.closeRequestedAt=at);assert.equal(pairCloseProgress(p,now).warning,false);}});

test('stale or failed position observations cannot claim a submitted close is still visibly open',()=>{
 for(const observation of [{observedAt:now-5001},{observationError:true},{observedAt:now+1001}]){const p={...pair(),...observation};p.legs[0].closeRequestedAt=now-60000;const state=pairCloseProgress(p,now);assert.equal(state.warning,false);assert.doesNotMatch(state.message,/position still visible/);}
});
