import {webcrypto} from 'node:crypto';
// Test-only IndexedDB boundary. Trading records are decoded for existing fixture assertions.
// Production encryption bytes and migration failures have separate storage regression tests.
export function privateStorageFixture(){
 const keys=new Map();const indexedDB={open(){const request={};queueMicrotask(()=>{request.result={createObjectStore(){},close(){},transaction(){const tx={};tx.objectStore=()=>({get(name){const r={};queueMicrotask(()=>{r.result=keys.get(name);r.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.());});return r;},put(value,name){keys.set(name,value);}});return tx;}};request.onupgradeneeded?.();request.onsuccess?.();});return request;}};
 async function decode(values){const result={};for(const [key,value]of Object.entries(values)){if(value?.__papertradeEncrypted===1){const plain=await webcrypto.subtle.decrypt({name:'AES-GCM',iv:Buffer.from(value.iv,'base64'),additionalData:new TextEncoder().encode(key)},keys.get('records-v1'),Buffer.from(value.ciphertext,'base64'));result[key]=JSON.parse(new TextDecoder().decode(plain));}else result[key]=value;}return result;}
 return {indexedDB,decode};
}
