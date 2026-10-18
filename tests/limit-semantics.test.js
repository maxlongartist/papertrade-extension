import {test} from 'node:test';import assert from 'node:assert/strict';
import {entryWindow,entryBlockReason,entryPriceAllowed} from '../extension/core.js';import {createEngine} from '../extension/engine.js';
const stamp=Date.now(),quote=price=>({market:'BTC',price,mid:price,bid:price-.5,ask:price+.5,sourceAt:stamp,receivedAt:stamp});
const row=[0,'BTC',0,'10',true,false,false,false,false,null,null,null,'1','1',1000,'1000000000000000000000000','1','1','1','0','0','0','0'];
const venue={schemaVersion:1,tradingPaused:false,receivedAt:stamp,instruments:[row],minimumTradeSizeRaw:'10000000000000000000',minimumOpenNotionalRaw:'1000000000000000000000'};
const long={market:'BTC',side:'long',price:82201,entryTolerance:2,entryMode:'limit',priceMode:'papertrade',margin:10,leverage:255,exitLead:2};
test('limit entries accept better prices in both directions; near and legacy retain symmetric tolerance',()=>{
 assert.equal(entryWindow(long,quote(81975.5),stamp),true);
 assert.equal(entryWindow({...long,side:'short'},quote(82400),stamp),true);
 for(const entryMode of ['near',undefined])assert.equal(entryWindow({...long,entryMode},quote(81975.5),stamp),false);
 assert.equal(entryPriceAllowed(long,82203),true);assert.equal(entryPriceAllowed(long,82203.01),false);
 assert.equal(entryPriceAllowed({...long,side:'short'},82199),true);assert.equal(entryPriceAllowed({...long,side:'short'},82198.99),false);
 assert.equal(entryWindow(long,{...quote(81975),sourceAt:stamp-501},stamp),false);
});
test('screenshot long stays unsubmitted because its effective stop is already crossed',()=>{
 const order={owner:'0x'+'1'.repeat(40),...long,stopLoss:82150,takeProfit:83300};assert.equal(entryWindow(order,quote(81975.5),stamp),false);assert.match(entryBlockReason(order,quote(81975.5),stamp),/effective stop loss \$82152/);
 assert.equal(entryWindow(order,quote(82152),stamp),false);assert.equal(entryWindow(order,quote(82153),stamp),true);
 const short={...long,side:'short',stopLoss:82250,takeProfit:81000};assert.equal(entryWindow(short,quote(82248),stamp),false);assert.equal(entryWindow(short,quote(82247),stamp),true);
 // Early TP may sit inside the adverse allowance; do not open an immediately exiting trade.
 assert.equal(entryWindow({...long,takeProfit:82202},quote(82200),stamp),false);
});
test('old watch does not change until explicitly edited; saving mode and tolerance changes execution',async()=>{
 let stored=[],clicks=0;const engine=createEngine({load:async()=>[],save:async v=>{stored=structuredClone(v);},probe:async()=>({ok:true,precisionSupported:true,owner:'0x'+'1'.repeat(40)}),execute:async()=>{clicks++;return {ok:true,clicked:true};},now:()=>stamp});engine.setVenue(venue);
 await engine.quote(quote(81975.5));const created=await engine.request({type:'create',order:{...long,entryMode:'near'}});assert.equal(clicks,0);
 await engine.request({type:'editWatch',id:created.order.id,price:82201,entryMode:'limit',entryTolerance:1});await engine.settled();assert.equal(clicks,1);assert.equal(stored[0].entryTolerance,1);assert.equal(stored[0].entryMode,'limit');await engine.quote(quote(81975.5));await engine.settled();assert.equal(clicks,1);
});
test('new screenshot watch explains crossed stop and never opens an immediately stopped long',async()=>{
 let stored=[],clicks=0;const engine=createEngine({load:async()=>[],save:async v=>{stored=structuredClone(v);},probe:async()=>({ok:true,precisionSupported:true,owner:'0x'+'1'.repeat(40)}),execute:async()=>{clicks++;return {ok:true,clicked:true};},now:()=>stamp});engine.setVenue(venue);await engine.quote(quote(81975.5));await engine.request({type:'create',order:{...long,stopLoss:82150,takeProfit:83300}});await engine.settled();assert.equal(clicks,0);assert.match(stored[0].message,/effective stop loss/);assert.equal(stored[0].status,'watching');
});
