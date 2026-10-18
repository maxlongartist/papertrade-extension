export function fresh(tick, now = Date.now()) {
  return Boolean(tick && Number.isFinite(tick.bid) && Number.isFinite(tick.ask) && tick.bid > 0 && tick.ask >= tick.bid && Number.isFinite(tick.sourceAt) && Number.isFinite(tick.receivedAt) && now - tick.sourceAt <= 5000 && now - tick.receivedAt <= 5000 && tick.sourceAt <= now + 1000 && tick.receivedAt <= now + 1000);
}
export function papertradePrice(tick) {
  return Number.isFinite(tick?.price)?tick.price:(tick.bid+tick.ask)/2;
}
export function positionMarkPrice(tick) {
  const mid=(tick.bid+tick.ask)/2;
  return Number.isFinite(tick.mid)&&tick.mid>=tick.bid&&tick.mid<=tick.ask?tick.mid:mid;
}
export function exitTriggerPrice(order,tick) {
  return order.exitPriceMode==='mark'?positionMarkPrice(tick):(order.priceMode==='papertrade'?papertradePrice(tick):(order.side==='long'?tick.bid:tick.ask));
}
export function triggerPrice(order,tick) {
  return order.priceMode==='papertrade'?papertradePrice(tick):(order.side==='long'?tick.ask:tick.bid);
}
export function decodeBbo(data,receivedAt=Date.now()) {
  const bid=Number(data.bbo?.[0]?.px),ask=Number(data.bbo?.[1]?.px),bidSize=Number(data.bbo?.[0]?.sz),askSize=Number(data.bbo?.[1]?.sz);
  if(![bid,ask,bidSize,askSize,data.time].every(Number.isFinite)||bid<=0||ask<bid||bidSize<0||askSize<0)throw Error('Malformed BBO');
  const scale=({BTC:10,ETH:100})[data.coin];
  const raw=px=>{const text=String(px);if(text.length>64||!/^\d+(?:\.\d+)?$/.test(text))throw Error('Invalid quote decimal');const [whole,fraction='']=text.split('.'),factor=10n**BigInt(fraction.length),numerator=BigInt(whole+fraction)*BigInt(scale);if(numerator%factor!==0n)throw Error('Quote incompatible with Papertrade price scale');return numerator/factor;};
  const mid=scale?Number((raw(data.bbo[0].px)+raw(data.bbo[1].px))/2n)/scale:(bid+ask)/2;
  const sum=bidSize+askSize,price=sum>0?(bid*askSize+ask*bidSize)/sum:mid;
  return {market:data.coin,bid,ask,mid,price,bidSize,askSize,sourceAt:data.time,receivedAt,feedSource:'bbo'};
}
export function decodeBook(data,receivedAt=Date.now()) {
  if(!Array.isArray(data.levels)||data.levels.length!==2)throw Error('Malformed book snapshot');
  const tick=decodeBbo({coin:data.coin,time:data.time,bbo:[data.levels[0]?.[0],data.levels[1]?.[0]]},receivedAt);
  return {...tick,feedSource:'l2Book'};
}
export function hit(order, tick, now = Date.now()) {
  return fresh(tick, now) && tick.market === order.market && (order.side === 'long' ? triggerPrice(order,tick)<=order.price : triggerPrice(order,tick)>=order.price);
}
// Tolerance caps adverse entry prices; legacy watches keep their symmetric window.
export function entryPriceAllowed(order,price) {
  if(!Number.isFinite(price)||price<=0)return false;
  if(order.entryTolerance==null)return true;
  return order.entryMode==='limit'?(order.side==='long'?price<=order.price+order.entryTolerance:price>=order.price-order.entryTolerance):Math.abs(price-order.price)<=order.entryTolerance;
}
export function entryExitConflict(order,price) {
  if(order.entryMode!=='limit')return null;
  const levels=exitLevels(order);
  if(levels.stopLoss!=null&&(order.side==='long'?price<=levels.stopLoss:price>=levels.stopLoss))return `Entry paused: price has crossed the effective stop loss $${levels.stopLoss}. Edit the entry/exits or cancel. Nothing submitted.`;
  if(levels.takeProfit!=null&&(order.side==='long'?price>=levels.takeProfit:price<=levels.takeProfit))return `Entry paused: price has crossed the effective take profit $${levels.takeProfit}. Edit the entry/exits or cancel. Nothing submitted.`;
  return null;
}
export function entryBlockReason(order,tick,now=Date.now()) {
  if(!hit(order,tick,now))return 'Waiting for the limit price. Nothing submitted.';
  if(tick.sourceAt>now+100||tick.receivedAt>now+100||now-tick.sourceAt>500||now-tick.receivedAt>500)return 'Waiting for a fresh quote (500 ms maximum). Nothing submitted.';
  const mark=positionMarkPrice(tick),conflict=entryExitConflict(order,mark);if(conflict)return conflict;
  if(!entryPriceAllowed(order,triggerPrice(order,tick))||!entryPriceAllowed(order,mark))return order.entryMode==='limit'?'Waiting: chart or mark exceeds the adverse entry allowance. Nothing submitted.':'Waiting for a fresh quote within the entry window. Nothing submitted.';
  return null;
}
export function entryWindow(order,tick,now=Date.now()) {
  // Old unbounded watches retain their existing behavior until edited.
  if(order.entryTolerance==null)return hit(order,tick,now);
  return entryBlockReason(order,tick,now)===null;
}
export function validateOrder(input, venue, now = Date.now()) {
  if (!['BTC', 'ETH'].includes(input.market) || !['long', 'short'].includes(input.side)) throw Error('Invalid market or direction.');
  if (![input.price, input.margin, input.leverage].every(Number.isFinite) || input.price <= 0 || input.margin <= 0 || !Number.isInteger(input.leverage) || input.leverage < 1) throw Error('Enter a positive price and valid native margin/leverage.');
  if (!venue || now - venue.receivedAt > 60000 || venue.schemaVersion !== 1 || venue.tradingPaused !== false) throw Error('Venue limits are unavailable. Try again when connected.');
  const row = venue.instruments?.find(row => row[1] === input.market);
  if (!row || row.length !== 23 || row[4] !== true || row[5] !== false || row[6] === true || row[7] === true || row[8] === true) throw Error('Market is unavailable for entries.');
  if (!Number.isInteger(row[14]) || row[14] < 1 || ![venue.minimumTradeSizeRaw, venue.minimumOpenNotionalRaw, row[15]].every(v => typeof v === 'string' && /^\d+$/.test(v) && Number.isFinite(Number(v)) && Number(v) > 0)) throw Error('Venue limit format changed.');
  const minMargin = Number(venue.minimumTradeSizeRaw) / 1e18, minNotional = Number(venue.minimumOpenNotionalRaw) / 1e18;
  if (input.margin < minMargin || input.margin * input.leverage < minNotional) throw Error(`Native ticket needs at least $${minMargin} margin and $${minNotional.toLocaleString()} notional.`);
  if (input.leverage > row[14]) throw Error(`Venue maximum is ${row[14]}×.`);
  if (input.margin * input.leverage > Number(row[15]) / 1e18) throw Error('Venue notional maximum exceeded.');
  const entryTolerance=input.entryTolerance??2;
  if(!Number.isFinite(entryTolerance)||entryTolerance<=0)throw Error('Enter a positive entry tolerance in USD.');
  const {stopLoss,takeProfit,exitLead}=validateExits(input,2);
  for (const value of [stopLoss, takeProfit]) if (value != null && (!Number.isFinite(value) || value <= 0)) throw Error('TP and SL must be positive prices.');
  if (stopLoss != null && (input.side === 'long' ? stopLoss >= input.price : stopLoss <= input.price)) throw Error('Stop loss must be below a long entry or above a short entry.');
  if (takeProfit != null && (input.side === 'long' ? takeProfit <= input.price : takeProfit >= input.price)) throw Error('Take profit must be above a long entry or below a short entry.');
  const entryMode=input.entryMode??'limit';if(!['limit','near'].includes(entryMode))throw Error('Invalid entry mode.');
  return { entryMode,exitPriceMode:input.exitPriceMode??'mark',targetTabId:input.targetTabId,targetTabKey:input.targetTabKey,priceMode:input.priceMode??'papertrade', exitLead, entryTolerance, stopLoss, takeProfit, id: crypto.randomUUID(), market: input.market, side: input.side, price: input.price, margin: input.margin, leverage: input.leverage, status: 'watching', createdAt: now, expiresAt: now + 86400000, message: 'Watching price. Executes automatically when reached.' };
}
export function validateExits(input, defaultLead=0) {
  const stopLoss=input.stopLoss??null,takeProfit=input.takeProfit??null,exitLead=input.exitLead??defaultLead;
  if(!Number.isFinite(exitLead)||exitLead<0)throw Error('Early exit amount must be zero or a positive USD amount.');
  for(const value of [stopLoss,takeProfit])if(value!=null&&(!Number.isFinite(value)||value<=0))throw Error('TP and SL must be positive prices.');
  const levels=exitLevels({side:input.side,stopLoss,takeProfit,exitLead});
  if([levels.stopLoss,levels.takeProfit].some(p=>p!=null&&p<=0))throw Error('Early exit amount exceeds the exit price.');
  if(levels.stopLoss!=null&&levels.takeProfit!=null&&(input.side==='long'?levels.stopLoss>=levels.takeProfit:levels.stopLoss<=levels.takeProfit))throw Error('Early SL and TP trigger levels overlap. Widen the exits or reduce the early amount.');
  return {stopLoss,takeProfit,exitLead};
}
export function exitLevels(order) {
  const lead=order.exitLead??0,direction=order.side==='long'?1:-1;
  return {stopLoss:order.stopLoss==null?null:order.stopLoss+direction*lead,takeProfit:order.takeProfit==null?null:order.takeProfit-direction*lead};
}
export function exitReason(order, tick, now = Date.now()) {
  if (!fresh(tick, now) || tick.market !== order.market) return null;
  const price = exitTriggerPrice(order,tick);
  const levels=exitLevels(order);
  if (order.stopLoss != null && (order.side === 'long' ? price <= levels.stopLoss : price >= levels.stopLoss)) return 'stop loss';
  if (order.takeProfit != null && (order.side === 'long' ? price >= levels.takeProfit : price <= levels.takeProfit)) return 'take profit';
  return null;
}
