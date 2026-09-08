import assert from 'node:assert/strict';
import { StateStore } from '../src/engine/state.js';
import { extractDesignRules } from '../src/engine/design_rules.js';
import { registerFigmaWebMcpTools } from '../src/mcp/webmcp_tools.js';
import { fastwebmcp } from '../src/mcp/fastwebmcp_runtime.js';

// Asynchronous request/transaction mock: commit, not request creation, makes data durable.
const durable = new Map();
const commits = [];
let holdWrites = false;
let failWrite = false;
let failRead = false;
globalThis.indexedDB = {open(){
  const request = {};
  queueMicrotask(()=>{
    request.result = {close(){},createObjectStore(){},transaction(_name,mode){
      const tx = {objectStore(){return {
        get(key){const r={};queueMicrotask(()=>{
          if(failRead){tx.error=new Error('read unavailable');tx.onerror();}
          else {r.result=structuredClone(durable.get(key));tx.oncomplete();}
        });return r;},
        put(value,key){const r={};const copy=structuredClone(value);const commit=()=>{
          if(failWrite){tx.error=new Error('quota exhausted');tx.onabort();}
          else {durable.set(key,copy);r.result=key;tx.oncomplete();}
        };
        if(holdWrites) commits.push(commit);else queueMicrotask(commit);
        return r;}
      };}};
      return tx;
    }};
    request.onsuccess();
  });
  return request;
}};
let localWrites = 0;
globalThis.localStorage = {getItem:()=>null,setItem(){localWrites++;throw new Error('localStorage quota');}};
globalThis.window = {devicePixelRatio:1};
const fixture = {title:'Large project',layers:[{id:'design',type:'rect',x:0,y:0,width:100,height:100,fill:'#ffffff',visible:true,
  imageData:'x'.repeat(12*1024*1024)}],viewport:{panX:10,panY:20,zoom:0.25}};
const store = new StateStore(fixture);
await store.ready;
store.activateDesignContract(extractDesignRules(store.state.layers));
await store.flushPersistence();
assert.equal(store.persistenceStatus.status,'saved');
assert.equal(store.persistenceStatus.backend,'indexedDB');
assert.equal(localWrites,0,'Large durable projects must not hit localStorage quota');
const restored = new StateStore();
await restored.ready;
assert.deepEqual(restored.state.layers,store.state.layers,'12MB document survives reload');
assert.deepEqual(restored.state.designContract,store.state.designContract,'Local approval survives durable reload');
assert.throws(()=>restored.updateLayer('design',{fill:'#000000'}),/contrato/);

holdWrites = true;
store.state.title = 'first';
const first = store.flushPersistence();
// Drain microtasks only; no wall-clock scheduling assumptions.
for(let i=0;i<10;i++) await Promise.resolve();
assert.equal(commits.length,1);
store.state.title = 'second';
const second = store.flushPersistence();
for(let i=0;i<10;i++) await Promise.resolve();
assert.equal(commits.length,1,'Second write must wait for first transaction commit');
commits.shift()();
await first;
for(let i=0;i<10;i++) await Promise.resolve();
assert.equal(commits.length,1);
assert.equal(durable.get('current').title,'first','Queued write captured an immutable first snapshot');
commits.shift()();
await second;
assert.equal(durable.get('current').title,'second','Latest state wins after ordered commits');
holdWrites = false;
failWrite = true;
await assert.rejects(store.flushPersistence(),/quota/);
assert.equal(store.persistenceStatus.status,'error','Persistence error is reportable, never false saved');
assert.equal(durable.get('current').title,'second','Failed transaction preserves last committed document');
failWrite = false;
await store.flushPersistence();
assert.equal(store.persistenceStatus.status,'saved','Write queue recovers after failure');
registerFigmaWebMcpTools(store,{canvas:{clientWidth:1000,clientHeight:700}});
const call = (name,args={})=>fastwebmcp.invokeTool(name,args);
const prepare = await call('figma_prepare_import_project',{projectJson:JSON.stringify({...fixture,title:'WebMCP durable'})});
const confirmed = await call('figma_confirm_import_project',{confirmationToken:prepare.data.confirmationToken});
assert.equal(confirmed.success,true);
assert.equal(confirmed.data.persisted,true,'Confirmed import awaits durable transaction');
assert.equal(durable.get('current').title,'WebMCP durable');
failWrite = true;
const prepareFail = await call('figma_prepare_import_project',{projectJson:JSON.stringify({...fixture,title:'Unsaved in memory'})});
const confirmFail = await call('figma_confirm_import_project',{confirmationToken:prepareFail.data.confirmationToken});
assert.equal(confirmFail.success,true,'In-memory import remains successful when only durability fails');
assert.equal(confirmFail.data.persisted,false,'WebMCP must distinguish in-memory success from failed persistence');
assert.equal(confirmFail.data.persistence.status,'error');
assert.equal(store.state.title,'Unsaved in memory');
assert.equal(durable.get('current').title,'WebMCP durable');
const documentStatus = await call('figma_get_document');
assert.equal(documentStatus.data.persistence.status,'error');
documentStatus.data.persistence.status = 'tampered';
assert.equal(store.persistenceStatus.status,'error','Document result must not alias live persistence status');
failWrite = false;
failRead = true;
const unreadable = new StateStore();
await assert.rejects(unreadable.ready,/read unavailable/);
assert.equal(unreadable.persistenceStatus.status,'error','Ready rejects a read failure rather than silently mounting empty data');
for(const instance of [store,restored,unreadable]) clearTimeout(instance._saveTimeout);
console.log('Durable project persistence: 12MB reload, approved protection, serialized commit order and surfaced failure/recovery passed');
