import test from 'node:test';import assert from 'node:assert/strict';
import {readStoredPairs,unreadablePairTracking} from '../extension/manual-storage.js';
import {createManualPairs} from '../extension/manual-pair.js';
const owner='0x'+'1'.repeat(40),binding={targetTabId:11,targetTabKey:'session',market:'BTC'};
const record=()=>({...binding,id:'saved-pair',owner,status:'open',margin:25,leverage:400,createdAt:100000,beforePositionIds:[],legs:['long','short'].map((side,i)=>({side,entry:'filled',close:'available',positionId:String(i+1),visible:true}))});
test('saved pair validation returns an independent copy and keeps unknown metadata intact',()=>{
 const p=record();p.entryQueue={available:false};const saved=[p],copy=readStoredPairs(saved);assert.deepEqual(copy,saved);copy[0].legs[0].visible=false;assert.equal(saved[0].legs[0].visible,true);assert.deepEqual(readStoredPairs(undefined),[]);
});
test('non-array saved values cannot be mistaken for an empty pair history',()=>{
 for(const value of [null,{},'[]',false,0])assert.throws(()=>readStoredPairs(value),{message:unreadablePairTracking});
});
test('malformed identity, binding, sizing and lifecycle records are rejected without dropping them',()=>{
 for(const mutate of [p=>p.owner=null,p=>p.market=['BTC'],p=>p.id='',p=>p.status='unknown',p=>p.margin=0,p=>p.leverage='400',p=>delete p.targetTabKey,p=>p.targetTabId=-1,p=>p.createdAt=NaN,p=>delete p.beforePositionIds,p=>p.closeRequested='true',p=>p.legs=null,p=>p.legs=[null],p=>p.legs.pop(),p=>p.legs[1].side='long',p=>p.legs[0].entry='unknown',p=>p.legs[0].close='unknown',p=>p.legs[0].positionId=null,p=>p.legs[1].positionId=p.legs[0].positionId,p=>p.legs[0].closed='true',p=>p.legs[0].entry='not_sent',p=>{p.legs[0].entry='submitted';p.legs[0].positionId=null;p.legs[0].close='submitted';},p=>{p.legs[0].entry='uncertain';p.legs[0].positionId=null;p.legs[0].closed=true;},p=>p.status='closed']){
  const p=record();mutate(p);const value=[p],before=structuredClone(value);assert.throws(()=>readStoredPairs(value),{message:unreadablePairTracking});assert.deepEqual(value,before);
 }
 for(const value of [[null],[1],[record(),record()]])assert.throws(()=>readStoredPairs(value),{message:unreadablePairTracking});
});
test('valid unresolved entries and legacy empty closed history are retained for conservative recovery',()=>{
 for(const entry of ['not_sent','sending','submitted','uncertain']){const p=record();Object.assign(p.legs[0],{entry,positionId:null});assert.equal(readStoredPairs([p])[0].legs[0].entry,entry);}
 const p={...record(),status:'closed',legs:[]};assert.deepEqual(readStoredPairs([p]),[p]);
});
test('an unreadable list blocks manual requests and pulses without reading, writing or trading',async()=>{
 let calls=0;const forbidden=async()=>{calls++;assert.fail('unreadable tracking must not authorize work');};
 const saved=[record(),null],before=structuredClone(saved),c=createManualPairs({load:async()=>saved,save:forbidden,snapshot:forbidden,execute:forbidden,close:forbidden});
 await assert.rejects(c.ready,{message:unreadablePairTracking});assert.equal(c.blocksEntries(),true);
 for(const type of ['pairOpen','pairClose','pairInspect','pairRestore','pairState','pairHistory'])await assert.rejects(c.request({...binding,type}),{message:unreadablePairTracking});
 await assert.rejects(c.pulse(),{message:unreadablePairTracking});assert.equal(calls,0);assert.deepEqual(saved,before);
});
