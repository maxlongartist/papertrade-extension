// Display only. The execution engine owns expiration; edits keep its saved deadline.
export function entryExpiry(order,now=Date.now()) {
 if(order?.status!=='watching'||order.kind==='position_exits')return null;
 const deadline=order.expiresAt;
 if(!Number.isFinite(now)||!Number.isFinite(deadline)||Math.abs(deadline)>8640000000000000)return {text:'Entry expiry unavailable',warning:true,deadline:null};
 const remaining=deadline-now;
 if(remaining<=0)return {text:'Entry expiry reached · awaiting worker confirmation',warning:true,deadline};
 const seconds=Math.ceil(remaining/1000),minutes=Math.ceil(remaining/60000);
 const duration=remaining<=60000?`${seconds}s`:minutes<60?`${minutes}m`:`${Math.floor(minutes/60)}h${minutes%60?' '+minutes%60+'m':''}`;
 return {text:`Entry expires in ${duration}`,warning:remaining<=300000,deadline};
}
