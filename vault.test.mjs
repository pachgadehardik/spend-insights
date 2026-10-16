import assert from 'node:assert/strict';
import {newKey,encryptBundle,decryptBundle,inspectEnvelope,VaultSession} from './dist/vault.mjs';
const pass='test only - a long passphrase',data={secret:'CANARY-PRIVATE-TRANSACTION',workspaces:['My private account']};
const credentials=await newKey(pass);assert.equal(credentials.key.extractable,false);
const first=await encryptBundle(data,credentials),second=await encryptBundle(data,credentials);
assert.notEqual(first.cipher.iv,second.cipher.iv);assert.notEqual(first.data,second.data);assert(!JSON.stringify(first).includes(data.secret));
assert.deepEqual((await decryptBundle(first,pass)).bundle,data);
await assert.rejects(decryptBundle(first,'incorrect password'),/Could not unlock/);
const damaged=structuredClone(first);damaged.data=(damaged.data[0]==='A'?'B':'A')+damaged.data.slice(1);
await assert.rejects(decryptBundle(damaged,pass),/Could not unlock/);
assert.throws(()=>inspectEnvelope({...first,kdf:{...first.kdf,iterations:1e12}}),/Unsupported/);
await assert.rejects(newKey('short'),/12 characters/);
class Store{
  record=null;fail=false;
  async read(){return structuredClone(this.record);}
  async write(envelope,revision){await new Promise(r=>setTimeout(r,5));if(this.fail)throw Error('Quota exceeded');if((this.record?.revision||0)!==revision)throw Error('Conflict');this.record={envelope,revision:revision+1};return revision+1;}
  async remove(){this.record=null;}
}
const store=new Store(),session=new VaultSession(store);await session.save(data);assert.equal(store.record,null);
await session.create(data,pass);assert.equal(session.mode,'vault');
const snapshot={n:1};const save=session.save(snapshot);snapshot.n=99;await save;assert.equal((await decryptBundle(store.record.envelope,pass)).bundle.n,1);
await Promise.all([session.save({n:2}),session.save({n:3})]);assert.equal((await decryptBundle(store.record.envelope,pass)).bundle.n,3);
const stale=new VaultSession(store);await stale.unlock(pass);await session.save({n:4});await assert.rejects(stale.save({n:5}),/Conflict/);assert.equal((await decryptBundle(store.record.envelope,pass)).bundle.n,4);
store.fail=true;await assert.rejects(session.save({n:6}),/Quota/);await assert.rejects(session.lock(),/Quota/);assert(session.credentials);
store.fail=false;await session.save({n:7});await session.lock();assert.equal(session.credentials,null);
await session.unlock(pass);const pending=session.save({n:8});await session.erase();await pending;assert.equal(store.record,null);await assert.rejects(stale.save({n:9}),/Conflict/);assert.equal(store.record,null);
console.log('Vault tests passed: authenticated encryption, fresh IVs, wrong passwords, bounds, snapshot isolation, ordered saves, conflicts, save failure, lock and deletion races.');
