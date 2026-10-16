// The only persistent financial record is an authenticated encrypted envelope.
const FORMAT='spend-insights-vault', ITERATIONS=600000, LIMIT=50*1024*1024;
const encoder=new TextEncoder(), decoder=new TextDecoder('utf-8',{fatal:true});
const random=n=>crypto.getRandomValues(new Uint8Array(n));
function encode(bytes){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);}
function decode(s,max){if(typeof s!=='string'||s.length>max||!s.length||s.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(s))throw Error('Invalid encrypted backup.');return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
const aad=kdf=>encoder.encode(JSON.stringify({format:FORMAT,version:1,kdf,cipher:'AES-GCM-256'}));
export function inspectEnvelope(x){
  if(!x||x.format!==FORMAT||x.version!==1||x.kdf?.name!=='PBKDF2'||x.kdf.hash!=='SHA-256'||x.kdf.iterations!==ITERATIONS||x.cipher?.name!=='AES-GCM')throw Error('Unsupported encrypted backup format.');
  const salt=decode(x.kdf.salt,24),iv=decode(x.cipher.iv,16),data=decode(x.data,Math.ceil(LIMIT*4/3)+4);
  if(salt.length!==16||iv.length!==12||data.length<16||data.length>LIMIT)throw Error('Invalid encrypted backup.');
  return {kdf:{name:'PBKDF2',hash:'SHA-256',iterations:ITERATIONS,salt:x.kdf.salt},salt,iv,data};
}
async function derive(passphrase,salt){
  if(typeof passphrase!=='string'||passphrase.length>1024)throw Error('Invalid passphrase.');
  const material=await crypto.subtle.importKey('raw',encoder.encode(passphrase),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:ITERATIONS},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function newKey(passphrase){
  if(passphrase.length<12)throw Error('Use a passphrase of at least 12 characters.');
  const salt=random(16),kdf={name:'PBKDF2',hash:'SHA-256',iterations:ITERATIONS,salt:encode(salt)};
  return {key:await derive(passphrase,salt),kdf};
}
export async function encryptBundle(bundle,credentials){
  const bytes=encoder.encode(JSON.stringify(bundle));if(bytes.length>LIMIT-16)throw Error('This vault is too large. Export a smaller analysis.');
  const iv=random(12),{key,kdf}=credentials;
  const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(kdf),tagLength:128},key,bytes);
  return {format:FORMAT,version:1,kdf,cipher:{name:'AES-GCM',iv:encode(iv)},data:encode(new Uint8Array(data))};
}
export async function decryptBundle(envelope,passphrase){
  const {kdf,salt,iv,data}=inspectEnvelope(envelope),key=await derive(passphrase,salt);
  try{const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad(kdf),tagLength:128},key,data);return {bundle:JSON.parse(decoder.decode(plaintext)),credentials:{key,kdf}};}
  catch{throw Error('Could not unlock: the passphrase is incorrect or the backup is damaged.');}
}
export class VaultStore{
  async database(){return new Promise((resolve,reject)=>{const request=indexedDB.open('spend-insights-private-v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('vaults',{keyPath:'id'});request.onerror=()=>reject(request.error);request.onsuccess=()=>resolve(request.result);});}
  async read(){const db=await this.database();return new Promise((resolve,reject)=>{const tx=db.transaction('vaults','readonly');let result;const request=tx.objectStore('vaults').get('primary');request.onsuccess=()=>{result=request.result;};tx.oncomplete=()=>{db.close();resolve(result);};tx.onabort=tx.onerror=()=>{db.close();reject(tx.error||Error('Local storage is unavailable.'));};});}
  async write(envelope,expected){const db=await this.database();return new Promise((resolve,reject)=>{
    const tx=db.transaction('vaults','readwrite'),store=tx.objectStore('vaults');let conflict=false;
    const request=store.get('primary');request.onsuccess=()=>{const current=request.result;if((current?.revision??0)!==expected){conflict=true;tx.abort();return;}store.put({id:'primary',revision:expected+1,envelope});};
    tx.oncomplete=()=>{db.close();resolve(expected+1);};tx.onabort=()=>{db.close();reject(conflict?Error('Another tab changed or deleted this vault. Download an encrypted backup of your changes before reopening.'):tx.error||Error('The encrypted save failed. Your changes remain in memory.'));};tx.onerror=()=>{};
  });}
  async remove(){const db=await this.database();return new Promise((resolve,reject)=>{const tx=db.transaction('vaults','readwrite');tx.objectStore('vaults').delete('primary');tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>{db.close();reject(tx.error||Error('Could not delete this vault.'));};});}
}
export class VaultSession{
  constructor(store=new VaultStore(),onStatus=()=>{}){this.store=store;this.onStatus=onStatus;this.mode='session';this.credentials=null;this.revision=0;this.queue=Promise.resolve();this.error=null;this.pending=0;this.generation=0;}
  async create(bundle,passphrase){const credentials=await newKey(passphrase),envelope=await encryptBundle(bundle,credentials);const revision=await this.store.write(envelope,0);this.credentials=credentials;this.revision=revision;this.mode='vault';this.error=null;this.onStatus('Saved encrypted on this device');}
  async unlock(passphrase){const record=await this.store.read();if(!record)throw Error('No saved vault was found.');const opened=await decryptBundle(record.envelope,passphrase);this.credentials=opened.credentials;this.revision=record.revision;this.mode='vault';this.error=null;this.onStatus('Saved encrypted on this device');return opened.bundle;}
  save(bundle){
    if(this.mode!=='vault'){this.onStatus('Temporary session · not saved');return Promise.resolve();}
    const snapshot=structuredClone(bundle),generation=this.generation;this.pending++;this.onStatus('Encrypting changes…');
    const operation=this.queue.catch(()=>{}).then(async()=>{if(generation!==this.generation)return;const envelope=await encryptBundle(snapshot,this.credentials);if(generation!==this.generation)return;this.revision=await this.store.write(envelope,this.revision);this.error=null;});
    this.queue=operation.catch(error=>{this.error=error;throw error;}).finally(()=>{this.pending--;if(generation===this.generation)this.onStatus(this.error?'Unsaved changes · download a backup':this.pending?'Encrypting changes…':'Saved encrypted on this device');});
    this.queue.catch(()=>{});return this.queue;
  }
  async flush(){await this.queue;if(this.error)throw this.error;}
  async backup(bundle,passphrase){return encryptBundle(bundle,this.credentials||await newKey(passphrase));}
  async lock(){await this.flush();this.clear();}
  clear(){this.generation++;this.credentials=null;this.revision=0;this.mode='session';this.error=null;this.queue=Promise.resolve();}
  async erase(){this.generation++;await this.queue.catch(()=>{});await this.store.remove();this.clear();}
}
