import assert from 'node:assert/strict';
import {StateStore} from '../src/engine/state.js';
import {registerFigmaWebMcpTools} from '../src/mcp/webmcp_tools.js';
import {fastwebmcp} from '../src/mcp/fastwebmcp_runtime.js';
globalThis.localStorage={getItem:()=>null,setItem(){}};
globalThis.window={devicePixelRatio:1};
const legacy=[{type:'rect'},{id:'recovered-0',type:'rect'},{id:undefined,type:'text',text:'Legacy'}];
const store=new StateStore({layers:legacy});
assert.equal(new Set(store.state.layers.map(l=>l.id)).size,3);
assert.ok(store.state.layers.every(l=>typeof l.id==='string'&&l.id));
assert.equal(legacy[0].id,undefined,'Recovery does not mutate incoming source');
const again=new StateStore({layers:legacy});
assert.deepEqual(store.state.layers,again.state.layers,'Legacy missing-ID recovery is deterministic');
const tree=[{id:'parent',type:'frame'},{id:'child',type:'text',parentId:'parent',text:'Nested'}];
const first=store.addLayers(tree);
const second=store.addLayers(tree);
assert.notEqual(first[0].id,second[0].id);
assert.equal(second[1].parentId,second[0].id,'Colliding template parent references remap within the new subtree');
const beforeUndo=structuredClone(store.state.layers);
store.undo();
assert.equal(store.getLayerById(second[0].id),null);
assert.ok(store.getLayerById(first[0].id));
store.redo();
assert.deepEqual(store.state.layers,beforeUndo);
store.deleteLayers([second[0].id]);
assert.equal(store.getLayerById(second[1].id),null);
assert.ok(store.getLayerById(first[1].id),'Deleting duplicated subtree preserves original subtree');
registerFigmaWebMcpTools(store,{canvas:{clientWidth:1200,clientHeight:800}});
for(const template of ['mobile_login','saas_hero','dashboard_card']){
  for(let i=0;i<2;i++){
    const result=await fastwebmcp.invokeTool('figma_create_ui_component',{template});
    assert.equal(result.success,true,result.error);
    assert.equal(new Set(store.state.layers.map(l=>l.id)).size,store.state.layers.length);
    assert.ok(store.state.layers.every(l=>typeof l.id==='string'&&l.id));
  }
}
clearTimeout(store._saveTimeout);clearTimeout(again._saveTimeout);
console.log('Template identity: deterministic legacy recovery, repeated template unique IDs, subtree remapping, undo/redo and cascade deletion passed');
