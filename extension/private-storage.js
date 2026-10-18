const recordKeys=new Set(['manualPairsV1','limitOrdersV3','orders']);
const encoder=new TextEncoder(),decoder=new TextDecoder();
const bytesToText=bytes=>{const chunks=[];for(let i=0;i<bytes.length;i+=8192)chunks.push(String.fromCharCode(...bytes.subarray(i,i+8192)));return btoa(chunks.join(''));};
const textToBytes=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
export function profileEncryptionKey({indexedDB,crypto}){
 let pending;
 return ()=>pending??=(async()=>{
  const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('papertrade-private-storage',1);request.onupgradeneeded=()=>request.result.createObjectStore('keys');request.onerror=()=>reject(Error('Trading storage key is unavailable. Existing records were not changed.'));request.onsuccess=()=>resolve(request.result);});
  const candidate=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  try{return await new Promise((resolve,reject)=>{const tx=db.transaction('keys','readwrite'),store=tx.objectStore('keys'),request=store.get('records-v1');let key;request.onsuccess=()=>{key=request.result??candidate;if(!request.result)store.put(key,'records-v1');};tx.oncomplete=()=>resolve(key);tx.onerror=tx.onabort=()=>reject(Error('Trading storage key could not be saved. Existing records were not changed.'));});}finally{db.close();}
 })().catch(error=>{pending=null;throw error;});
}
export function createPrivateStorage({storage,crypto,getKey}){
 async function encrypt(key,value){const iv=crypto.getRandomValues(new Uint8Array(12)),secret=await getKey();const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(key)},secret,encoder.encode(JSON.stringify(value)));return {__papertradeEncrypted:1,iv:bytesToText(iv),ciphertext:bytesToText(new Uint8Array(cipher))};}
 async function decrypt(key,value){try{const iv=textToBytes(value.iv);if(iv.length!==12)throw Error();const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:encoder.encode(key)},await getKey(),textToBytes(value.ciphertext));return JSON.parse(decoder.decode(plain));}catch{throw Error('Saved trading records could not be unlocked. Keep this Chrome profile and manage existing positions in native Positions. Stored records were not changed.');}}
 return {
  async get(keys){const raw=await storage.get(keys),result={...raw},migration={};for(const key of Object.keys(raw)){if(!recordKeys.has(key)||raw[key]===undefined)continue;const value=raw[key];if(value&&typeof value==='object'&&Object.hasOwn(value,'__papertradeEncrypted')){if(value.__papertradeEncrypted!==1)throw Error('Saved trading storage version is unsupported. Existing records were not changed.');result[key]=await decrypt(key,value);}else migration[key]=await encrypt(key,value);}
   if(Object.keys(migration).length)await storage.set(migration);return result;},
  async set(values){const next={};for(const [key,value] of Object.entries(values))next[key]=recordKeys.has(key)?await encrypt(key,value):value;await storage.set(next);},
 };
}
