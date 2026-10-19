// Display only. Mirrors Papertrade's native bust calculation (18-decimal buffer,
// integer division), using /state/trading instrument fields 3, 14 and 16.
const UNIT=10n**18n;
function priceRaw(price,scale){
  // Preserve decimal digits without floating-point multiplication at tick boundaries.
  const [digits,exponent='0']=String(price).toLowerCase().split('e');
  const [whole,fraction='']=digits.split('.');
  const raw=BigInt(whole+fraction)*scale,power=Number(exponent)-fraction.length;
  return power>=0?raw*10n**BigInt(power):raw/10n**BigInt(-power);
}
export function liquidationLevel(draft,venue,market,now=Date.now()){
  const unavailable={price:null,estimated:false};
  if(draft?.mode==='position')return Number.isFinite(draft.liquidationPrice)&&draft.liquidationPrice>0?{price:draft.liquidationPrice,estimated:false}:unavailable;
  if(!['long','short'].includes(draft?.side)||!Number.isFinite(draft.price)||draft.price<=0||!Number.isSafeInteger(draft.leverage)||draft.leverage<1)return unavailable;
  if(venue?.schemaVersion!==1||!Number.isFinite(venue.receivedAt)||venue.receivedAt<=0||now-venue.receivedAt>=60000||venue.receivedAt>now+1000||!Array.isArray(venue.instruments))return unavailable;
  const matches=venue.instruments.filter(r=>Array.isArray(r)&&r[1]===market);
  if(matches.length!==1)return unavailable;
  const row=matches[0];
  if(row.length!==23||!/^\d{1,19}$/.test(row[3])||!/^\d{1,18}$/.test(row[16])||!Number.isSafeInteger(row[14])||draft.leverage>row[14])return unavailable;
  try{
    const scale=BigInt(row[3]),buffer=BigInt(row[16]);if(scale<=0n||scale>UNIT||buffer>=UNIT)return unavailable;
    const entry=priceRaw(draft.price,scale),distance=entry/BigInt(draft.leverage),base=draft.side==='long'?entry-distance:entry+distance;
    const raw=draft.side==='long'?base+base*buffer/UNIT:base-base*buffer/UNIT;
    const price=Number(raw)/Number(scale);
    if(!Number.isSafeInteger(Number(entry))||!Number.isSafeInteger(Number(raw))||!Number.isFinite(price)||price<=0||(draft.side==='long'?raw>=entry:raw<=entry))return unavailable;
    return {price,estimated:true};
  }catch{return unavailable;}
}
