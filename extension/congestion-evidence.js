const stamp=n=>Number.isSafeInteger(n)&&n>=0;
const levels=['LOW','MEDIUM','HIGH'];
function evidence(reading,recordedAt){
 const unavailable={available:false,recordedAt};
 if(!reading?.live||!['public-stream','status-page'].includes(reading.source)||!levels.includes(reading.level)||!stamp(reading.sourceAt)||!stamp(reading.receivedAt)||reading.sourceAt>recordedAt+1000||reading.receivedAt>recordedAt+1000||recordedAt-reading.sourceAt>=5000||recordedAt-reading.receivedAt>=5000||!stamp(reading.pending)||!Number.isFinite(reading.clearSeconds)||reading.clearSeconds<0||reading.clearSeconds>1000000)return unavailable;
 return {available:true,recordedAt,source:reading.source,sourceAt:reading.sourceAt,receivedAt:reading.receivedAt,sourceAgeMs:Math.max(0,recordedAt-reading.sourceAt),level:reading.level,pending:reading.pending,clearSeconds:reading.clearSeconds};
}
// Advisory evidence must never gate or delay entry/Close. Only synchronous cached
// readings are accepted, and only public, explicitly listed fields are retained.
export function captureQueue(read,recordedAt=Date.now()){
 try{const reading=read();if(reading&&typeof reading.then==='function'){void Promise.resolve(reading).catch(()=>{});return {available:false,recordedAt};}return evidence(reading,recordedAt);}catch{return {available:false,recordedAt};}
}
export function exportQueue(record){
 if(!record||!stamp(record.recordedAt))return null;
 return evidence({...record,live:record.available===true},record.recordedAt);
}
export function queueLabel(record){
 const saved=exportQueue(record);
 return !saved?'Not recorded':!saved.available?'Unavailable at request':`${saved.level} · ${saved.pending} pending · ~${saved.clearSeconds}s nominal · sample ${(saved.sourceAgeMs/1000).toFixed(1)}s old at request`;
}
