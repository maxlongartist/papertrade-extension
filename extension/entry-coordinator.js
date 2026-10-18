// Entry-only exclusion. Read-only state and Close/exit work never use this gate.
export function createEntryCoordinator(){
 let pairing=false,limits=0;
 const pairBusy=()=>Error('Manual pair Open is in progress. Wait before arming or submitting another entry.');
 function assertPairReady(){
  if(pairing)throw pairBusy();
  if(limits)throw Error('An extension entry operation is in progress. Wait before opening a manual pair.');
 }
 return {
  assertPairReady,
  async run(kind,operation){
   if(kind==='pair'){assertPairReady();pairing=true;}
   else if(kind==='limit'){if(pairing)throw pairBusy();limits++;}
   else throw Error('Unknown entry operation.');
   try{return await operation();}
   finally{if(kind==='pair')pairing=false;else limits--;}
  }
 };
}
