import assert from 'node:assert/strict';
import {StateStore} from '../src/engine/state.js';
import {registerFigmaWebMcpTools} from '../src/mcp/webmcp_tools.js';
import {fastwebmcp} from '../src/mcp/fastwebmcp_runtime.js';
globalThis.localStorage={getItem:()=>null,setItem(){}};
globalThis.window={devicePixelRatio:1};
const store=new StateStore({title:'Isolated full tool matrix',layers:[]});
registerFigmaWebMcpTools(store,{canvas:{clientWidth:1200,clientHeight:800}});
const coverage=new Map();
const call=async(name,args={},success=true)=>{
  const result=await fastwebmcp.invokeTool(name,args);
  assert.equal(result.success,success,`${name}: ${result.error}`);
  if(!coverage.has(name))coverage.set(name,new Set());
  coverage.get(name).add(success?'valid':'error');
  return result.data;
};
const frame=await call('figma_create_frame',{name:'Frame',width:500,height:400});
const shape=await call('figma_create_shape',{type:'rect',width:100,height:80});
assert.equal(typeof frame.frameId,'string');
const matrixText=await call('figma_create_text',{text:'Matrix text',parentId:frame.frameId});
assert.equal(store.getLayerById(matrixText.layerId).parentId,frame.frameId);
await call('figma_create_ui_component',{template:'dashboard_card'});
await call('figma_update_layer',{id:shape.layerId,properties:{fill:'#123456'}});
await call('figma_transform_layer',{id:shape.layerId,x:100,rotation:12});
assert.equal(store.getLayerById(shape.layerId).rotation,12);
await call('figma_select_layers',{ids:[shape.layerId]});
await call('figma_focus_layers',{ids:[shape.layerId]});
await call('figma_zoom_to_fit');
const beforeDirect=store.state.layers.length;
assert.equal((await call('figma_delete_layers',{ids:[shape.layerId]})).success,false);
assert.equal(store.state.layers.length,beforeDirect,'Deprecated delete must not delete');
await call('figma_hide_layers',{ids:[shape.layerId]});
await call('figma_restore_layers',{ids:[shape.layerId]});
const note=await call('figma_create_postit',{text:'Note'});
await call('figma_list_postits');
await call('figma_update_postit',{id:note.layerId,text:'Edited'});
await call('figma_hide_postits',{ids:[note.layerId]});
await call('figma_restore_postits',{ids:[note.layerId]});
await call('figma_hide_postits',{ids:[note.layerId]});
const hidden=await call('figma_prepare_delete_hidden_layers');
await call('figma_confirm_delete_hidden_layers',{confirmationToken:hidden.confirmationToken});
assert.equal(store.getLayerById(note.layerId),null);
const deletion=await call('figma_prepare_delete_layers',{ids:[shape.layerId]});
await call('figma_confirm_delete_layers',{confirmationToken:deletion.confirmationToken});
assert.equal(store.getLayerById(shape.layerId),null);
const section=await call('figma_create_section',{sectionType:'hero',name:'Hero',width:800,height:400});
await call('figma_list_sections');
await call('figma_update_section',{id:section.sectionId,properties:{height:450}});
await call('figma_move_layers_to_section',{sectionId:section.sectionId,ids:[frame.frameId]});
assert.equal(store.getLayerById(frame.frameId).parentId,section.sectionId);
await call('figma_reorder_sections',{sectionIds:[section.sectionId],gap:40});
await call('figma_focus_section',{sectionId:section.sectionId});
await call('figma_generate_section',{sectionType:'features',title:'Features'});
await call('figma_generate_design_prompt',{prompt:'A dashboard'});
await call('figma_get_document');
await call('figma_export',{format:'svg'});
await call('figma_export_code',{format:'tailwind'});
const exported=await call('figma_export_project');
const preparation=await call('figma_prepare_import_project',{exportToken:exported.exportToken});
await call('figma_confirm_import_project',{confirmationToken:preparation.confirmationToken});
assert.deepEqual(store.state.layers,exported.project.layers);
const clear=await call('figma_prepare_clear_canvas');
await call('figma_confirm_clear_canvas',{confirmationToken:clear.confirmationToken});
assert.equal(store.state.layers.length,0,'Clear happy path empties isolated fixture');
const protectedShape=await call('figma_create_shape',{type:'rect',width:100,height:80,fill:'#123456'});
await call('figma_extract_design_rules');
await call('figma_get_design_rules');
await call('figma_export_design_rules');
const protection=await call('figma_prepare_design_protection');
await call('figma_activate_design_rules',{confirmationToken:protection.confirmationToken});
assert.equal(store.state.designContract.status,'active');
assert.equal((await call('figma_validate_design')).valid,true);
const preview=await call('figma_preview_changes',{updates:[{id:protectedShape.layerId,properties:{x:123}}]});
await call('figma_apply_validated_changes',{confirmationToken:preview.confirmationToken});
assert.equal(store.getLayerById(protectedShape.layerId).x,123);
const errors={
  figma_create_postit:{width:NaN},figma_list_postits:{includeHidden:'bad'},
  figma_update_postit:{id:'missing'},figma_hide_postits:{ids:['missing']},figma_restore_postits:{ids:['missing']},
  figma_create_ui_component:{template:'missing'},figma_update_layer:{id:'missing',properties:{}},
  figma_transform_layer:{id:'missing'},figma_delete_layers:{ids:['missing']},
  figma_prepare_delete_layers:{ids:['missing']},figma_confirm_delete_layers:{confirmationToken:'bad'},
  figma_confirm_clear_canvas:{confirmationToken:'bad'},figma_confirm_delete_hidden_layers:{confirmationToken:'bad'},
  figma_focus_layers:{ids:['missing']},figma_update_section:{id:'missing',properties:{}},
  figma_move_layers_to_section:{sectionId:'missing',ids:[protectedShape.layerId]},figma_focus_section:{sectionId:'missing'},
  figma_prepare_import_project:{projectJson:'invalid'},figma_confirm_import_project:{confirmationToken:'bad'},
  figma_export_code:{format:'svg',layerId:'missing'},figma_extract_design_rules:{ids:['missing']},
  figma_get_design_rules:{unexpected:true},figma_export_design_rules:{unexpected:true},
  figma_validate_design:{unexpected:true},figma_prepare_design_protection:{},
  figma_activate_design_rules:{confirmationToken:'bad'},figma_preview_changes:{updates:[]},
  figma_apply_validated_changes:{confirmationToken:'bad'}
};
for(const [name,args] of Object.entries(errors)) await call(name,args,false);
const catalog=fastwebmcp.getRegisteredTools().map(t=>t.name).sort();
assert.deepEqual([...coverage.keys()].sort(),catalog,'Every registered tool must have an explicit exercised case');
clearTimeout(store._saveTimeout);
// Remaining invalid types/enums are isolated so rejection must preserve all state.
const remainingProbes={
  figma_create_frame:{width:'invalid',height:100},figma_create_section:{sectionType:'invalid'},
  figma_create_shape:{type:'invalid',width:100,height:80},figma_create_text:{text:'test',fontSize:'invalid'},
  figma_export:{format:'invalid'},figma_export_project:[],
  figma_generate_design_prompt:{prompt:42},figma_generate_section:{sectionType:'invalid',title:'test'},
  figma_get_document:[],figma_hide_layers:{ids:'invalid'},
  figma_list_sections:[],figma_prepare_clear_canvas:[],
  figma_prepare_delete_hidden_layers:[],figma_reorder_sections:{sectionIds:'invalid'},
  figma_restore_layers:{ids:'invalid'},figma_select_layers:{ids:'invalid'},figma_zoom_to_fit:{padding:'invalid'}
};
for(const [name,args]of Object.entries(remainingProbes)){
  const isolated=new StateStore({layers:[{id:'test',type:'rect',x:0,y:0,width:100,height:100,visible:true}]});
  registerFigmaWebMcpTools(isolated,{canvas:{clientWidth:1200,clientHeight:800}});
  const before=JSON.stringify({state:isolated.state,undo:isolated.undoStack,redo:isolated.redoStack});
  const result=await fastwebmcp.invokeTool(name,args);
  assert.equal(result.success,false,`${name} must reject schema-invalid input before mutation`);
  assert.equal(JSON.stringify({state:isolated.state,undo:isolated.undoStack,redo:isolated.redoStack}),before,`${name} rejection must preserve state/history`);
  coverage.get(name).add('error');
  clearTimeout(isolated._saveTimeout);
}
for(const name of catalog){
  assert.ok(coverage.get(name).has('valid')&&coverage.get(name).has('error'));
  console.log(`${name}: valid PASS; invalid PASS`);
}
console.log(`Tool coverage: ${catalog.length}/${catalog.length} valid paths and ${catalog.length}/${catalog.length} negative paths. This is tool-name coverage, not exhaustive branch coverage.`);
