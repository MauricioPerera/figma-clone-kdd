import assert from 'node:assert/strict';
import { StateStore } from '../src/engine/state.js';
import { extractDesignRules } from '../src/engine/design_rules.js';
import { exportToJSON, importFromJSON } from '../src/engine/export.js';
import { registerFigmaWebMcpTools } from '../src/mcp/webmcp_tools.js';
import { fastwebmcp } from '../src/mcp/fastwebmcp_runtime.js';

const storage = new Map();
globalThis.localStorage = { getItem:k=>storage.get(k)||null, setItem:(k,v)=>storage.set(k,v), removeItem:k=>storage.delete(k) };
globalThis.window = { devicePixelRatio:1 };
const stores = [];
const makeStore = () => {
  const store = new StateStore({title:'Roundtrip fixture',layers:[{
    id:'design',type:'rect',x:12,y:24,width:100,height:80,visible:true,fill:'#123456',
    vectorPaths:[{fill:'#123456',commands:[['M',0,0],['L',100,80]]}]
  }, {id:'note',type:'frame',annotationKind:'sticky',annotationRootId:'note',softDeleted:true,
    x:200,y:0,width:200,height:150,visible:true,fill:'#ffff00'}],viewport:{panX:31,panY:47,zoom:0.75}});
  store.state.settings = {...store.state.settings,gridEnabled:false,metadata:{fixture:true}};
  stores.push(store);
  return store;
};
const snapshot = store => structuredClone({state:store.state,undo:store.undoStack,redo:store.redoStack});
const source = makeStore();
source.activateDesignContract(extractDesignRules(source.state.layers));
const original = structuredClone(source.state);
const canvas = {canvas:{clientWidth:1000,clientHeight:700}};
registerFigmaWebMcpTools(source,canvas);
const call = (name,args={}) => fastwebmcp.invokeTool(name,args);
const exported = await call('figma_export_project');
assert.equal(exported.success,true);
const project = exported.data.project;
assert.deepEqual(project.designContract,original.designContract,'WebMCP project must retain complete contract');
assert.deepEqual(project.layers,original.layers,'Hidden annotations must survive editable project export');
assert.deepEqual(project.settings,original.settings);
assert.deepEqual(project.viewport,original.viewport);
project.layers[0].vectorPaths[0].commands[0][1] = 999;
project.settings.metadata.fixture = false;
project.designContract.rules[0].expected = 'tampered';
assert.deepEqual(source.state,original,'Exported nested values must not alias live state');

let capturedBlob;
const oldCreate = URL.createObjectURL;
const oldRevoke = URL.revokeObjectURL;
URL.createObjectURL = blob => {capturedBlob=blob;return 'blob:roundtrip';};
URL.revokeObjectURL = ()=>{};
globalThis.document = {createElement:()=>({click(){}}),body:{appendChild(){},removeChild(){}}};
exportToJSON(source);
const diskProject = JSON.parse(await capturedBlob.text());
URL.createObjectURL = oldCreate;
URL.revokeObjectURL = oldRevoke;
delete globalThis.document;
assert.deepEqual(diskProject.designContract,original.designContract,'Downloaded JSON must retain contract');
for (const key of ['layers','settings','viewport','title']) assert.deepEqual(diskProject[key],original[key]);

const clean = makeStore();
assert.equal(importFromJSON(JSON.stringify(diskProject),clean).success,true);
assert.equal(clean.state.designContractProposal.status,'proposed','Imported active label is not human approval');
assert.deepEqual(clean.state.designContractProposal.rules,original.designContract.rules);
assert.ok(!clean._activeDesignContract,'Import into clean store must not activate protection');
assert.deepEqual(clean.state.settings,original.settings);
clean.updateLayer('design',{fill:'#abcdef'});
assert.equal(clean.state.layers[0].fill,'#abcdef','Unapproved proposal does not become enforcement');

const imported = makeStore();
registerFigmaWebMcpTools(imported,canvas);
const beforePrepare = snapshot(imported);
const prepared = await call('figma_prepare_import_project',{projectJson:JSON.stringify(diskProject)});
assert.equal(prepared.success,true);
assert.deepEqual(snapshot(imported),beforePrepare,'Preparing import is read-only');
assert.equal((await call('figma_confirm_import_project',{confirmationToken:prepared.data.confirmationToken})).success,true);
assert.equal(imported.state.designContractProposal.status,'proposed');
assert.deepEqual(imported.state.layers,original.layers);
assert.deepEqual(imported.state.settings,original.settings);
assert.equal((await call('figma_confirm_import_project',{confirmationToken:prepared.data.confirmationToken})).success,false,'Import token cannot be reused');
imported.state.designContractProposal.rules[0].id = 'source-custom-rule';
const getRules = await call('figma_get_design_rules');
assert.equal(getRules.data.contract.rules[0].id,'source-custom-rule','Get rules retains imported proposal, not re-extraction');
const exportRules = await call('figma_export_design_rules');
assert.equal(JSON.parse(exportRules.data.content.contractJson).rules[0].id,'source-custom-rule');
const exportedSnapshot = await call('figma_export_project');
assert.ok(exportedSnapshot.data.exportToken);
exportedSnapshot.data.project.layers[0].fill = '#badbad';
const beforeToken = snapshot(imported);
assert.equal((await call('figma_prepare_import_project',{exportToken:exportedSnapshot.data.exportToken,projectJson:'{}'})).success,false,'Ambiguous import sources are rejected');
const tokenPrepared = await call('figma_prepare_import_project',{exportToken:exportedSnapshot.data.exportToken});
assert.equal(tokenPrepared.success,true);
assert.deepEqual(snapshot(imported),beforeToken,'Snapshot preparation still requires confirmation');
assert.equal((await call('figma_confirm_import_project',{confirmationToken:tokenPrepared.data.confirmationToken})).success,true);
assert.equal(imported.state.layers[0].fill,original.layers[0].fill,'Token snapshot does not alias returned project');
assert.equal((await call('figma_prepare_import_project',{exportToken:exportedSnapshot.data.exportToken})).success,false,'Export token is single-use');
assert.equal((await call('figma_prepare_import_project',{exportToken:'invalid'})).success,false);
const expirySnapshot = await call('figma_export_project');
const realNow = Date.now;
const future = realNow() + expirySnapshot.data.expiresInMs + 1;
Date.now = () => future;
try {
  assert.equal((await call('figma_prepare_import_project',{exportToken:expirySnapshot.data.exportToken})).success,false,'Expired snapshot token is rejected');
} finally { Date.now = realNow; }
clearTimeout(imported._saveTimeout);
const realTimeout = globalThis.setTimeout;
let persist;
globalThis.setTimeout = callback => {persist=callback;return 0;};
try { imported.saveToStorage(); persist(); } finally { globalThis.setTimeout = realTimeout; }
const restored = new StateStore();
stores.push(restored);
assert.deepEqual(restored.state.designContractProposal,imported.state.designContractProposal,'Local persistence retains imported proposal');
assert.ok(!restored._activeDesignContract,'Reload does not upgrade unapproved proposal');

const guarded = makeStore();
guarded.updateLayer('design',{x:13});
guarded.activateDesignContract(extractDesignRules(guarded.state.layers));
const active = structuredClone(guarded.state.designContract);
const weakened = structuredClone(diskProject);
weakened.designContract = {...active,status:'proposed',rules:[]};
assert.equal(importFromJSON(JSON.stringify(weakened),guarded).success,true);
assert.deepEqual(guarded.state.designContract,active,'Import cannot weaken existing human-approved protection');
guarded.updateLayer('design',{x:15});
const accepted = snapshot(guarded);
weakened.layers[0].fill = '#000000';
assert.equal(importFromJSON(JSON.stringify(weakened),guarded).success,false);
assert.deepEqual(snapshot(guarded),accepted,'Rejected import preserves all state and undo/redo exactly');
registerFigmaWebMcpTools(guarded,canvas);
const deniedPrepared = await call('figma_prepare_import_project',{projectJson:JSON.stringify(weakened)});
assert.equal(deniedPrepared.success,true);
assert.equal((await call('figma_confirm_import_project',{confirmationToken:deniedPrepared.data.confirmationToken})).success,false);
assert.deepEqual(snapshot(guarded),accepted,'WebMCP failed confirmation is also atomic');
for (const store of stores) clearTimeout(store._saveTimeout);
console.log('Project roundtrip: download/WebMCP parity, deep isolation, proposal trust boundary and atomic guarded imports passed');
