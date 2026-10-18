import test from 'node:test';import assert from 'node:assert/strict';
import {createPageInstance,duplicateEntryMessage} from '../extension/page-instance.js';
function page(){const attributes=new Map(),counts=new Map();return {documentElement:{getAttribute:key=>attributes.has(key)?attributes.get(key):null,setAttribute:(key,value)=>attributes.set(key,value)},querySelectorAll:selector=>Array.from({length:counts.get(selector)??0}),attributes,counts};}
test('the first instance claims a clean document and a second copy cannot take it over',()=>{
 const document=page(),first=createPageInstance(document,'first','token-a'),second=createPageInstance(document,'second','token-b');assert.equal(first.canEnter(),true);assert.equal(second.claimed,false);assert.equal(second.ignoreNativeMessages(),false);assert.equal(first.ignoreNativeMessages(),false);assert.equal(second.canEnter(),false);assert.throws(second.assertEntry,{message:duplicateEntryMessage});first.assertEntry();
});
test('reinjection of the same extension does not create two entry owners',()=>{
 const document=page(),first=createPageInstance(document,'same','token-a'),second=createPageInstance(document,'same','token-b');assert.equal(first.canEnter(),true);assert.equal(second.canEnter(),false);assert.equal(second.ignoreNativeMessages(),true);const standby=createPageInstance(document,'different','token-c'),repeatedStandby=createPageInstance(document,'different','token-d');assert.equal(standby.ignoreNativeMessages(),false);assert.equal(repeatedStandby.ignoreNativeMessages(),true);
});
test('legacy controls and malformed ownership markers are preserved and require refresh',()=>{
 for(const setup of [d=>d.counts.set('[id="paperpilot-extension"]',1),d=>d.counts.set('[id="paperpilot-manual-pair"]',1),d=>d.attributes.set('data-paperpilot-entry-owner','broken'),d=>d.attributes.set('data-paperpilot-entry-owner','')]){const document=page();setup(document);const before=new Map(document.attributes),instance=createPageInstance(document,'new','token');assert.equal(instance.claimed,false);assert.equal(instance.ignoreNativeMessages(),true);assert.throws(instance.assertEntry,{message:duplicateEntryMessage});assert.deepEqual(document.attributes,before);}
});
test('an older copy adding duplicate panels revokes entry eligibility immediately',()=>{
 const document=page(),instance=createPageInstance(document,'new','token');document.counts.set('[id="paperpilot-extension"]',1);instance.assertEntry();document.counts.set('[id="paperpilot-extension"]',2);assert.equal(instance.canEnter(),false);assert.throws(instance.assertEntry,{message:duplicateEntryMessage});
});
test('a fresh document may claim ownership without modifying the previous document',()=>{
 const old=page(),first=createPageInstance(old,'old','old-token'),fresh=page(),next=createPageInstance(fresh,'new','new-token');assert.equal(first.canEnter(),true);assert.equal(next.canEnter(),true);assert.notDeepEqual(old.attributes,fresh.attributes);
});
