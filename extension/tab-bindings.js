const validTab=id=>Number.isSafeInteger(id)&&id>=0;
const validKey=key=>typeof key==='string'&&key.length>0&&key.length<=200;
export function createTabBindings({load,save,key=()=>crypto.randomUUID()}){
 let committed=Object.create(null),tail=Promise.resolve();const pending=new Map();
 const ready=Promise.resolve().then(load).then(stored=>{
  if(!stored||typeof stored!=='object'||Array.isArray(stored))return;
  for(const [id,value] of Object.entries(stored))if(validTab(Number(id))&&String(Number(id))===id&&validKey(value))committed[id]=value;
 });
 const binding=id=>({targetTabId:id,targetTabKey:committed[id]});
 return {
  ready,
  snapshot:()=>({...committed}),
  matches:record=>validTab(record.targetTabId)&&validKey(record.targetTabKey)&&committed[record.targetTabId]===record.targetTabKey,
  async bind(id){
   if(!validTab(id))throw Error('Invalid native tab ID.');await ready;
   // Known tabs never wait behind another tab's pending registration.
   if(committed[id])return binding(id);
   if(pending.has(id))return pending.get(id);
   const job=tail.then(async()=>{
    const value=key();if(!validKey(value))throw Error('Invalid native tab session key.');
    const next={...committed,[id]:value};
    // Keep this candidate private until storage acknowledges the complete map.
    await save({...next});committed=Object.assign(Object.create(null),next);return binding(id);
   });
   const result=job.finally(()=>pending.delete(id));pending.set(id,result);tail=result.catch(()=>{});return result;
  },
 };
}
