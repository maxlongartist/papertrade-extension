import test from 'node:test';import assert from 'node:assert/strict';
import {createPageMessenger,pageRefreshRequired} from '../extension/page-connection.js';
const expected={message:pageRefreshRequired,code:'PAPERTRADE_REFRESH_REQUIRED'};
test('page messages preserve runtime receiver, payload and response without retries',async()=>{
 const payload={type:'pairOpen'},response={pair:{id:'p'}};let calls=0;const runtime={id:'extension',sendMessage(message){assert.equal(this,runtime);assert.equal(message,payload);calls++;return response;}};
 assert.equal(await createPageMessenger(()=>runtime)(payload),response);assert.equal(calls,1);
});
test('synchronous context invalidation becomes a descriptive rejection and stops future dispatch',async()=>{
 let calls=0;const send=createPageMessenger(()=>({id:'extension',sendMessage(){calls++;throw Error('Extension context invalidated.');}}));
 await assert.rejects(send({type:'pairOpen'}),expected);await assert.rejects(send({type:'pairState'}),expected);assert.equal(calls,1);
});
test('a rejected invalidated-context response is never retried or interpreted as an unsubmitted action',async()=>{
 let calls=0;const send=createPageMessenger(()=>({id:'extension',sendMessage:async()=>{calls++;throw Error('Extension context has been invalidated');}}));
 await assert.rejects(send({type:'pairClose'}),expected);await assert.rejects(send({type:'pairClose'}),expected);assert.equal(calls,1);
});
test('missing runtime identity or messaging API blocks dispatch with refresh guidance',async()=>{
 for(const runtime of [undefined,null,{}, {id:'extension'}, {sendMessage:()=>assert.fail('missing identity')}])await assert.rejects(createPageMessenger(()=>runtime)({type:'pairOpen'}),expected);
});
test('transient errors stay retryable by the caller and ordinary worker errors stay unchanged',async()=>{
 let calls=0;const temporary=Error('Worker unavailable'),response={error:'Native ticket unavailable'};const send=createPageMessenger(()=>({id:'extension',sendMessage:async()=>{if(++calls===1)throw temporary;return response;}}));
 await assert.rejects(send({type:'pairState'}),error=>error===temporary);assert.equal(calls,1);assert.equal(await send({type:'pairState'}),response);assert.equal(calls,2);
});
test('an invalidated runtime getter also becomes a contained promise rejection',async()=>{
 const send=createPageMessenger(()=>{throw Error('Extension context invalidated.');});await assert.rejects(send({type:'positionsChanged'}),expected);
});
