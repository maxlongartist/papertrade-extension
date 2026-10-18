globalThis.location={pathname:'/trade/btc',href:'https://exchange.papertrade.xyz/trade/btc'};
import {test} from 'node:test';import assert from 'node:assert/strict';import {decodeBbo,entryWindow,exitReason,positionMarkPrice} from '../extension/core.js';import {closeNative} from '../extension/native.js';
test('position-mark exits do not follow a divergent size-weighted chart price',()=>{
 const now=Date.now(),tick=decodeBbo({coin:'BTC',time:now,bbo:[{px:'82990',sz:'9'},{px:'83010',sz:'1'}]},now);
 assert.equal(tick.price,83008);assert.equal(positionMarkPrice(tick),83000);
 const long={market:'BTC',side:'long',stopLoss:82998,exitLead:2,priceMode:'papertrade',exitPriceMode:'mark'};assert.equal(exitReason(long,tick,now),'stop loss');assert.equal(exitReason({...long,exitPriceMode:undefined},tick,now),null);
 const short={market:'BTC',side:'short',takeProfit:82998,exitLead:2,priceMode:'papertrade',exitPriceMode:'mark'};assert.equal(exitReason(short,tick,now),'take profit');assert.equal(exitReason({...short,exitPriceMode:undefined},tick,now),null);
});
test('entry is skipped when chart fits tolerance but position midpoint is $10 away',()=>{
 const now=Date.now(),tick=decodeBbo({coin:'BTC',time:now,bbo:[{px:'83000',sz:'0.001'},{px:'83020',sz:'1'}]},now);
 assert.ok(Math.abs(tick.price-83000)<2);assert.equal(positionMarkPrice(tick),83010);assert.equal(entryWindow({market:'BTC',side:'short',price:83000,entryTolerance:2,priceMode:'papertrade'},tick,now),false);
});
test('native TP allowance uses the selected position mark, not the header quote',async()=>{
 for(const [side,mark,header,allowed] of [['long',99,97,true],['long',97,99,false],['short',101,103,true],['short',103,101,false]]){
  let clicks=0;const button={disabled:false,textContent:'Close',getAttribute:()=> 'Close BTC position 42',click(){clicks++;}};
  const row={getAttribute:()=>`BTC ${side} position 42`,querySelector:()=>button,querySelectorAll:()=>[{}, {}, {}, {textContent:String(mark)}]};
  const document={querySelectorAll:()=>[row],querySelector:s=>s==='#connectBtn'?{getAttribute:()=> '0x'+'1'.repeat(40)}:({textContent:String(header)})};const result=await closeNative(document,{owner:'0x'+'1'.repeat(40),market:'BTC',side,positionId:'42',exitReason:'take profit',takeProfit:100,exitLead:2,exitPriceMode:'mark',deadline:Date.now()+750});
  assert.equal(result.clicked,allowed);assert.equal(clicks,allowed?1:0);assert.equal(result.executionCheck.checkedPrice,mark);assert.equal(result.executionCheck.nativePrice,header);assert.equal(result.executionCheck.nativeMark,mark);
 }
});

test('position midpoint uses Papertrade raw-scale flooring for BTC and ETH',()=>{
 const now=Date.now();for(const [coin,bid,ask,expected] of [['BTC','83000','83000.1',83000],['ETH','2000','2000.01',2000]]){
  const quote=decodeBbo({coin,time:now,bbo:[{px:bid,sz:'1'},{px:ask,sz:'1'}]},now);assert.equal(positionMarkPrice(quote),expected);
 }
});
