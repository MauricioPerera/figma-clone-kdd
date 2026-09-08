import assert from 'node:assert/strict';
import { StateStore } from '../src/engine/state.js';
import { registerFigmaWebMcpTools } from '../src/mcp/webmcp_tools.js';
import { fastwebmcp } from '../src/mcp/fastwebmcp_runtime.js';

console.log('--- Corriendo tests de Herramientas WebMCP y FastWebMCP ---');

// Mock localStorage para Node.js
if (typeof globalThis.localStorage === 'undefined') {
  const storeMap = new Map();
  globalThis.localStorage = {
    getItem: (k) => storeMap.get(k) || null,
    setItem: (k, v) => storeMap.set(k, String(v)),
    removeItem: (k) => storeMap.delete(k),
    clear: () => storeMap.clear()
  };
}

const store = new StateStore({
  title: 'WebMCP Test Studio',
  layers: []
});

const canvasEngine = { canvas: { clientWidth: 1000, clientHeight: 700 } };
registerFigmaWebMcpTools(store, canvasEngine);

// 1. Verificar catálogo de tools
const tools = fastwebmcp.getRegisteredTools();
assert.ok(tools.length >= 8);
const toolNames = tools.map(t => t.name);
assert.ok(toolNames.includes('figma_create_frame'));
assert.ok(toolNames.includes('figma_create_shape'));
assert.ok(toolNames.includes('figma_create_text'));
assert.ok(toolNames.includes('figma_create_ui_component'));
assert.ok(toolNames.includes('figma_update_layer'));
assert.ok(toolNames.includes('figma_delete_layers'));
assert.ok(toolNames.includes('figma_get_document'));
assert.ok(toolNames.includes('figma_export'));
assert.ok(toolNames.includes('figma_select_layers'));
assert.ok(toolNames.includes('figma_focus_layers'));
assert.ok(toolNames.includes('figma_zoom_to_fit'));
assert.ok(toolNames.includes('figma_prepare_delete_layers'));
assert.ok(toolNames.includes('figma_confirm_delete_layers'));
assert.ok(toolNames.includes('figma_prepare_clear_canvas'));
assert.ok(toolNames.includes('figma_confirm_clear_canvas'));
assert.ok(toolNames.includes('figma_hide_layers'));
assert.ok(toolNames.includes('figma_restore_layers'));
assert.ok(toolNames.includes('figma_prepare_delete_hidden_layers'));
assert.ok(toolNames.includes('figma_confirm_delete_hidden_layers'));
assert.ok(toolNames.includes('figma_export_project'));
assert.ok(toolNames.includes('figma_export_code'));
assert.ok(toolNames.includes('figma_prepare_import_project'));
assert.ok(toolNames.includes('figma_confirm_import_project'));
assert.ok(toolNames.includes('figma_create_section'));
assert.ok(toolNames.includes('figma_list_sections'));
assert.ok(toolNames.includes('figma_update_section'));
assert.ok(toolNames.includes('figma_move_layers_to_section'));
assert.ok(toolNames.includes('figma_reorder_sections'));
assert.ok(toolNames.includes('figma_focus_section'));
assert.ok(toolNames.includes('figma_generate_section'));
console.log('✓ Catálogo de herramientas registrado OK');

// 2. Ejecutar figma_create_frame
const frameRes = await fastwebmcp.invokeTool('figma_create_frame', {
  name: 'iPhone Test',
  width: 390,
  height: 844,
  fill: '#121212'
});
assert.equal(frameRes.success, true);
assert.equal(store.state.layers.length, 1);
assert.equal(store.state.layers[0].name, 'iPhone Test');
console.log('✓ figma_create_frame OK');

// 3. Ejecutar figma_create_shape
const shapeRes = await fastwebmcp.invokeTool('figma_create_shape', {
  type: 'rect',
  width: 200,
  height: 100,
  fill: '#0d99ff',
  cornerRadius: 12
});
assert.equal(shapeRes.success, true);
assert.equal(store.state.layers.length, 2);
console.log('✓ figma_create_shape OK');

// 4. Ejecutar figma_update_layer
const updateRes = await fastwebmcp.invokeTool('figma_update_layer', {
  id: shapeRes.data.layerId,
  properties: { fill: '#10b981', width: 250 }
});
assert.equal(updateRes.success, true);
const updatedShape = store.getLayerById(shapeRes.data.layerId);
assert.equal(updatedShape.fill, '#10b981');
assert.equal(updatedShape.width, 250);
console.log('✓ figma_update_layer OK');

// 5. Ejecutar figma_get_document
const docRes = await fastwebmcp.invokeTool('figma_get_document', {});
assert.equal(docRes.success, true);
assert.equal(docRes.data.layerCount, 2);
console.log('✓ figma_get_document OK');

// 6. Ejecutar figma_export a Tailwind
const exportRes = await fastwebmcp.invokeTool('figma_export', { format: 'tailwind' });
assert.equal(exportRes.success, true);
assert.ok(exportRes.data.code.includes('w-[250px]'));
assert.ok(exportRes.data.code.includes('bg-[#10b981]'));
console.log('✓ figma_export OK');

// 7. Ejecutar figma_generate_design_prompt
const aiRes = await fastwebmcp.invokeTool('figma_generate_design_prompt', {
  prompt: 'Diseña una tarjeta de analítica con métricas'
});
assert.equal(aiRes.success, true);
assert.ok(store.state.layers.length > 3);
console.log('✓ figma_generate_design_prompt OK');

// 8. Seleccionar y enfocar una capa para que sea visible
const selectRes = await fastwebmcp.invokeTool('figma_select_layers', { ids: [shapeRes.data.layerId] });
assert.equal(selectRes.success, true);
assert.deepEqual(store.state.selectedIds, [shapeRes.data.layerId]);
const focusRes = await fastwebmcp.invokeTool('figma_focus_layers', { ids: [shapeRes.data.layerId], padding: 40 });
assert.equal(focusRes.success, true);
assert.ok(focusRes.data.viewport.zoom > 0);
const fitRes = await fastwebmcp.invokeTool('figma_zoom_to_fit', { padding: 40 });
assert.equal(fitRes.success, true);
console.log('✓ selección y enfoque WebMCP OK');

// 9. Soft delete reversible y limpieza grupal segura
const hideRes = await fastwebmcp.invokeTool('figma_hide_layers', { ids: [shapeRes.data.layerId] });
assert.equal(hideRes.success, true);
assert.equal(store.getLayerById(shapeRes.data.layerId).softDeleted, true);
const docWithHiddenLayer = await fastwebmcp.invokeTool('figma_get_document', {});
assert.equal(docWithHiddenLayer.data.layers.find(layer => layer.id === shapeRes.data.layerId).effectiveVisible, false);
const restoreRes = await fastwebmcp.invokeTool('figma_restore_layers', { ids: [shapeRes.data.layerId] });
assert.equal(restoreRes.success, true);
assert.equal(store.getLayerById(shapeRes.data.layerId).visible, true);
await fastwebmcp.invokeTool('figma_hide_layers', { ids: [shapeRes.data.layerId] });
const hiddenPreview = await fastwebmcp.invokeTool('figma_prepare_delete_hidden_layers', {});
assert.equal(hiddenPreview.success, true);
assert.equal(hiddenPreview.data.deleteCount, 1);
const hiddenDelete = await fastwebmcp.invokeTool('figma_confirm_delete_hidden_layers', {
  confirmationToken: hiddenPreview.data.confirmationToken
});
assert.equal(hiddenDelete.success, true);
assert.equal(store.getLayerById(shapeRes.data.layerId), null);
console.log('✓ soft delete y limpieza grupal WebMCP OK');

// 10. Borrado seguro en dos pasos y limpieza completa
const replacementShape = await fastwebmcp.invokeTool('figma_create_shape', { type: 'rect', width: 120, height: 80 });
const deletePreview = await fastwebmcp.invokeTool('figma_prepare_delete_layers', { ids: [replacementShape.data.layerId] });
assert.equal(deletePreview.success, true);
assert.equal(deletePreview.data.deleteCount, 1);
const deleteConfirm = await fastwebmcp.invokeTool('figma_confirm_delete_layers', {
  confirmationToken: deletePreview.data.confirmationToken
});
assert.equal(deleteConfirm.success, true);
assert.equal(store.getLayerById(replacementShape.data.layerId), null);
const clearPreview = await fastwebmcp.invokeTool('figma_prepare_clear_canvas', {});
assert.equal(clearPreview.success, true);
const clearConfirm = await fastwebmcp.invokeTool('figma_confirm_clear_canvas', {
  confirmationToken: clearPreview.data.confirmationToken
});
assert.equal(clearConfirm.success, true, clearConfirm.error);
assert.equal(store.state.layers.length, 0);
console.log('✓ limpieza segura WebMCP OK');

// 11. Exportar proyecto/código e importar un proyecto validado
const importProject = {
  version: '1.0.0',
  title: 'Imported Project',
  viewport: { panX: 0, panY: 0, zoom: 1 },
  settings: store.state.settings,
  layers: [{
    id: 'imported_layer', name: 'Imported layer', type: 'rect', x: 20, y: 30,
    width: 200, height: 100, fill: '#0d99ff', stroke: 'none', visible: true
  }]
};
const importPreview = await fastwebmcp.invokeTool('figma_prepare_import_project', {
  projectJson: JSON.stringify(importProject)
});
assert.equal(importPreview.success, true);
assert.equal(importPreview.data.layerCount, 1);
const importConfirm = await fastwebmcp.invokeTool('figma_confirm_import_project', {
  confirmationToken: importPreview.data.confirmationToken
});
assert.equal(importConfirm.success, true);
assert.equal(store.state.title, 'Imported Project');
const projectExport = await fastwebmcp.invokeTool('figma_export_project', {});
assert.equal(projectExport.success, true);
assert.equal(projectExport.data.project.layers.length, 1);
assert.equal(projectExport.data.filename, 'imported_project.figma.json');
const codeExport = await fastwebmcp.invokeTool('figma_export_code', { format: 'tailwind' });
assert.equal(codeExport.success, true);
assert.ok(codeExport.data.content.includes('w-[200px]'));
console.log('✓ importación y exportación WebMCP OK');

// 12. Secciones semánticas, parentId, reordenamiento y enfoque
const heroSection = await fastwebmcp.invokeTool('figma_create_section', {
  sectionType: 'hero', name: 'Hero Test', x: 100, y: 100, width: 800, height: 400
});
const footerSection = await fastwebmcp.invokeTool('figma_create_section', {
  sectionType: 'footer', name: 'Footer Test', x: 100, y: 600, width: 800, height: 180
});
assert.equal(heroSection.success, true);
assert.equal(footerSection.success, true);
const sectionText = await fastwebmcp.invokeTool('figma_create_text', {
  text: 'Hero content', x: 150, y: 180, parentId: heroSection.data.sectionId
});
assert.equal(sectionText.success, true);
const moveRes = await fastwebmcp.invokeTool('figma_move_layers_to_section', {
  sectionId: heroSection.data.sectionId, ids: ['imported_layer']
});
assert.equal(moveRes.success, true);
assert.equal(store.getLayerById('imported_layer').parentId, heroSection.data.sectionId);
const sectionsRes = await fastwebmcp.invokeTool('figma_list_sections', {});
assert.equal(sectionsRes.success, true);
assert.equal(sectionsRes.data.sections.length, 2);
const updateSection = await fastwebmcp.invokeTool('figma_update_section', {
  id: heroSection.data.sectionId, properties: { fill: '#111827', height: 420 }
});
assert.equal(updateSection.success, true);
const reorderRes = await fastwebmcp.invokeTool('figma_reorder_sections', {
  sectionIds: [footerSection.data.sectionId, heroSection.data.sectionId], gap: 40
});
assert.equal(reorderRes.success, true);
const focusSection = await fastwebmcp.invokeTool('figma_focus_section', { sectionId: heroSection.data.sectionId });
assert.equal(focusSection.success, true);
const generatedSection = await fastwebmcp.invokeTool('figma_generate_section', {
  sectionType: 'features', title: 'Feature test', subtitle: 'Generated section content', x: 100, y: 1000, width: 800
});
assert.equal(generatedSection.success, true);
assert.ok(generatedSection.data.createdIds.length >= 5);
console.log('✓ secciones semánticas WebMCP OK');

const noteResult = await fastwebmcp.invokeTool('figma_create_postit', { text: 'ANNOTATION_ONLY', x: 50, y: 70 });
assert.equal(noteResult.success, true);
const noteId = noteResult.data.layerId;
const childId = `${noteId}_text`;
assert.equal(store.getLayerById(noteId).annotationKind, 'sticky');
assert.equal((await fastwebmcp.invokeTool('figma_create_postit', { text: 'x', width: NaN })).success, false);
await fastwebmcp.invokeTool('figma_update_postit', { id: noteId, text: 'ANNOTATION_EDITED', x: 80 });
assert.equal(store.getLayerById(childId).text, 'ANNOTATION_EDITED');
assert.equal(store.getLayerById(childId).x, 96);
store.getLayerById(childId).visible = false;
const beforeHide = JSON.stringify(store.state.layers);
await fastwebmcp.invokeTool('figma_hide_postits', { ids: [noteId] });
const historyCount = store.undoStack.length;
await fastwebmcp.invokeTool('figma_hide_postits', { ids: [noteId] });
assert.equal(store.undoStack.length, historyCount);
assert.equal((await fastwebmcp.invokeTool('figma_list_postits', { includeHidden: false })).data.postits.length, 0);
assert.equal((await fastwebmcp.invokeTool('figma_list_postits', {})).data.postits.length, 1);
store.undo(); assert.equal(JSON.stringify(store.state.layers), beforeHide);
store.redo(); assert.equal(store.getLayerById(noteId).softDeleted, true);
await fastwebmcp.invokeTool('figma_restore_postits', { ids: [noteId] });
assert.equal(store.getLayerById(childId).visible, false);
store.getLayerById(childId).visible = true;
const noAnnotations = await fastwebmcp.invokeTool('figma_export_code', { format: 'tailwind' });
assert.ok(!noAnnotations.data.content.includes('ANNOTATION_EDITED'));
const withAnnotations = await fastwebmcp.invokeTool('figma_export_code', { format: 'tailwind', includeAnnotations: true });
assert.ok(withAnnotations.data.content.includes('ANNOTATION_EDITED'));
await fastwebmcp.invokeTool('figma_hide_postits', { ids: [noteId] });
const previewNote = await fastwebmcp.invokeTool('figma_prepare_delete_hidden_layers', {});
assert.equal(previewNote.data.deleteCount, 2);
store.addLayer({ id: 'late_note_child', type: 'rect', parentId: noteId });
const staleDeletion = await fastwebmcp.invokeTool('figma_confirm_delete_hidden_layers', { confirmationToken: previewNote.data.confirmationToken });
assert.equal(staleDeletion.success, false);
assert.ok(store.getLayerById(noteId));
const retryPreview = await fastwebmcp.invokeTool('figma_prepare_delete_hidden_layers', {});
assert.equal(retryPreview.data.deleteCount, 3);
assert.equal((await fastwebmcp.invokeTool('figma_confirm_delete_hidden_layers', { confirmationToken: retryPreview.data.confirmationToken })).success, true);
assert.equal(store.getLayerById(noteId), null);
store.addLayer({ id: 'original_hidden', visible: false });
assert.equal((await fastwebmcp.invokeTool('figma_prepare_delete_hidden_layers', {})).data.deleteCount, 0);
console.log('✓ post-it lifecycle, reversible hiding, export exclusion and exact cleanup OK');
store.addLayer({ id: 'imported_note', type: 'frame', annotationKind: 'sticky', annotationRootId: 'imported_note', x: 0, y: 0, width: 240, height: 200 });
store.addLayer({ id: 'imported_body', type: 'vector', annotationRootId: 'imported_note', parentId: 'imported_note', x: 0, y: 0, width: 240, height: 200, vectorScaleX: 1, vectorScaleY: 1, vectorPaths: [{ path: 'M0 0 L240 0 L240 200 Z', fill: '#ffff00' }] });
store.addLayer({ id: 'imported_decoration', type: 'vector', annotationRootId: 'imported_note', parentId: 'imported_note', x: 200, y: 10, width: 20, height: 20, vectorScaleX: 2, vectorScaleY: 3, vectorPaths: [{ path: 'M0 0 L10 0 Z', fill: '#111111' }] });
store.addLayer({ id: 'imported_content', type: 'text', annotationRootId: 'imported_note', parentId: 'imported_note', text: 'Content', x: 10, y: 10 });
store.addLayer({ id: 'imported_author', type: 'text', annotationRootId: 'imported_note', parentId: 'imported_note', text: 'Author', x: 10, y: 90, visible: false, sourceText: 'Author', sourceGlyphs: [{ path: 'M0 0 L1 1 Z', x: 2, y: 15, fontSize: 16, firstCharacter: 0 }], sourceTextStyle: JSON.stringify([16, 'Inter, sans-serif', '400', 'left', 1.4, null, 100, 100]) });
store.updatePostit('imported_note', { text: 'Updated', x: 20 });
assert.equal(store.getLayerById('imported_content').text, 'Updated');
assert.equal(store.getLayerById('imported_author').text, 'Author');
const beforeResize = JSON.stringify(store.state.layers);
const resizedNote = await fastwebmcp.invokeTool('figma_update_postit', { id: 'imported_note', width: 480, height: 300, fill: '#ff00cc' });
assert.equal(resizedNote.success, true, resizedNote.error);
assert.equal(store.getLayerById('imported_note').width, 480);
assert.equal(store.getLayerById('imported_body').width, 480);
assert.equal(store.getLayerById('imported_body').height, 300);
assert.equal(store.getLayerById('imported_body').x, 20);
assert.equal(store.getLayerById('imported_body').vectorScaleX, 2);
assert.equal(store.getLayerById('imported_body').vectorScaleY, 1.5);
assert.equal(store.getLayerById('imported_decoration').x, 420);
assert.equal(store.getLayerById('imported_decoration').y, 15);
assert.equal(store.getLayerById('imported_decoration').vectorScaleX, 4);
assert.equal(store.getLayerById('imported_decoration').vectorScaleY, 4.5);
assert.equal(store.getLayerById('imported_body').vectorPaths[0].fill, '#ff00cc');
assert.equal(store.getLayerById('imported_decoration').vectorPaths[0].fill, '#111111');
assert.equal(store.getLayerById('imported_author').text, 'Author');
assert.equal(store.getLayerById('imported_author').fontSize, 16);
assert.deepEqual(store.getLayerById('imported_author').textTransform, { width: 100, height: 100, scaleX: 2, scaleY: 1.5 });
assert.deepEqual(store.getLayerById('imported_author').sourceGlyphs, [{ path: 'M0 0 L1 1 Z', x: 2, y: 15, fontSize: 16, firstCharacter: 0 }]);
assert.equal(store.getLayerById('imported_author').sourceTextStyle, JSON.stringify([16, 'Inter, sans-serif', '400', 'left', 1.4, null, 100, 100]));
assert.equal(store.getLayerById('imported_author').y, 135);
assert.notEqual(store.getLayerById('imported_author').fill, '#ff00cc');
store.undo(); assert.equal(JSON.stringify(store.state.layers), beforeResize);
store.redo(); assert.equal(store.getLayerById('imported_body').width, 480);
store.setLayersSoftDeleted(['imported_note'], true);
assert.equal((await fastwebmcp.invokeTool('figma_focus_layers', { ids: ['imported_content'] })).success, false);
const roundTrip = new StateStore(JSON.parse(JSON.stringify(store.state)));
assert.equal(roundTrip.getLayerById('imported_note').softDeleted, true);
roundTrip.setLayersSoftDeleted(['imported_note'], false);
assert.equal(roundTrip.getLayerById('imported_author').visible, false);
roundTrip.setSelection(['imported_content']);
const duplicateIds = roundTrip.duplicateSelected();
assert.equal(duplicateIds.length, 1);
const copiedNote = roundTrip.getLayerById(duplicateIds[0]);
assert.equal(copiedNote.annotationRootId, copiedNote.id);
const copiedChildren = roundTrip.state.layers.filter(layer => layer.parentId === copiedNote.id);
assert.equal(copiedChildren.length, 4);
assert.ok(copiedChildren.every(layer => layer.annotationRootId === copiedNote.id));
assert.equal(copiedChildren.find(layer => layer.text === 'Author').visible, false);
console.log('Todos los tests de WebMCP y FastWebMCP PASARON.');
