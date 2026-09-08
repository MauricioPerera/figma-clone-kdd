import assert from 'node:assert/strict';
import { expandFigJamNodes } from '../scripts/figjam_nodes.js';
import { isLayerEffectivelyVisible, isAnnotationLayer, getAnnotationRoot } from '../src/engine/annotations.js';
const path = localID => ({guids:[{sessionID:40000000,localID}]});
for (const type of ['SHAPE_WITH_TEXT','STICKY','CONNECTOR']) {
  const node = {guid:{sessionID:1,localID:2},type,name:'Test',
    derivedImmutableFrameData:{overrides:[
      {guidPath:path(0),size:{x:100,y:50},fillGeometry:[{commandsBlob:1}]},
      {guidPath:path(1),size:{x:80,y:20},derivedTextData:{glyphs:[]},transform:{m02:10,m12:15}}]},
    nodeGenerationData:{overrides:[
      {guidPath:path(1),textData:{characters:'Saved text'},fontSize:12},
      {guidPath:path(0),fillPaints:[{type:'SOLID',color:{r:1,g:0,b:0,a:1}}]}]}};
  const expanded = expandFigJamNodes([node]);
  assert.equal(expanded.length,3);
  assert.equal(expanded[1].fillPaints[0].color.r,1);
  assert.equal(expanded[2].textData.characters,'Saved text');
  assert.equal(expanded[2].transform.m12,15);
  assert.deepEqual(expanded[2].parentIndex.guid,node.guid);
  assert.deepEqual(expandFigJamNodes([node]),expanded);
  assert.equal(node.type,type,'Do not mutate the parsed source');
  assert.equal(expanded[0].sourceNodeType,type);
  assert.equal(expanded[0].annotationKind,type === 'STICKY' ? 'sticky' : undefined);
  for (const child of expanded.slice(1)) {
    assert.equal(child.annotationSourceRootId,type === 'STICKY' ? '1:2' : undefined);
  }
}
const sticky = {id:'sticky',annotationKind:'sticky',annotationRootId:'sticky',visible:true};
const body = {id:'body',parentId:'sticky',annotationRootId:'sticky',visible:true};
const hiddenText = {id:'text',parentId:'sticky',visible:false};
const design = {id:'design',visible:true};
const layers = [sticky,body,hiddenText,design];
assert.equal(getAnnotationRoot(body,layers),sticky);
assert.equal(isAnnotationLayer(hiddenText,layers),true);
assert.equal(isAnnotationLayer(body,[body]),true,'Detached exports retain note membership');
assert.equal(isAnnotationLayer(design,layers),false);
sticky.softDeleted = true;
assert.equal(isLayerEffectivelyVisible(body,layers),false);
assert.equal(isLayerEffectivelyVisible(design,layers),true);
sticky.softDeleted = false;
assert.equal(isLayerEffectivelyVisible(body,new Map(layers.map(layer => [layer.id,layer]))),true);
assert.equal(isLayerEffectivelyVisible(hiddenText,layers),false,'Restoring parent preserves hidden children');
sticky.visible = false;
assert.equal(isLayerEffectivelyVisible(body,layers),false);
const cycle = [{id:'a',parentId:'b'},{id:'b',parentId:'a'}];
assert.equal(isLayerEffectivelyVisible({visible:true},[{visible:true}]),true,'ID-less render fixtures do not become self cycles');
assert.equal(isLayerEffectivelyVisible(cycle[0],cycle),false);
assert.equal(getAnnotationRoot(cycle[0],cycle),null);
console.log('FigJam shapes, stickies and connectors join geometry/style by guidPath');
