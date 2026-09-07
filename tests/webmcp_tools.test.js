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

registerFigmaWebMcpTools(store, null);

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

console.log('Todos los tests de WebMCP y FastWebMCP PASARON.');
