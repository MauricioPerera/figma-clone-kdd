import assert from 'node:assert/strict';
import { StateStore } from '../src/engine/state.js';

console.log('--- Corriendo tests de StateStore e Historial ---');

// Mock localStorage para entorno Node.js
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  };
}

const store = new StateStore({
  title: 'Test Project',
  layers: [],
  viewport: { panX: 0, panY: 0, zoom: 1 }
});

// 1. Agregar capa
const l1 = store.addLayer({
  type: 'rect',
  x: 10,
  y: 20,
  width: 100,
  height: 50,
  fill: '#ff0000'
});

assert.equal(store.state.layers.length, 1);
assert.equal(store.state.layers[0].id, l1.id);
assert.equal(store.state.selectedIds[0], l1.id);
console.log('✓ addLayer OK');

// 2. Modificar capa
store.updateLayer(l1.id, { x: 50, width: 120 });
const updated = store.getLayerById(l1.id);
assert.equal(updated.x, 50);
assert.equal(updated.width, 120);
console.log('✓ updateLayer OK');

// 3. Undo / Redo
assert.ok(store.canUndo());
store.undo(); // Vuelve a x: 10, width: 100
const afterUndo = store.getLayerById(l1.id);
assert.equal(afterUndo.x, 10);
assert.equal(afterUndo.width, 100);

assert.ok(store.canRedo());
store.redo(); // Vuelve a x: 50, width: 120
const afterRedo = store.getLayerById(l1.id);
assert.equal(afterRedo.x, 50);
assert.equal(afterRedo.width, 120);
console.log('✓ Undo/Redo OK');

// 4. Duplicar seleccionado
const duplicatedIds = store.duplicateSelected();
assert.equal(duplicatedIds.length, 1);
assert.equal(store.state.layers.length, 2);
console.log('✓ duplicateSelected OK');

// 5. Alineación
const l2 = store.getLayerById(duplicatedIds[0]);
l2.x = 200;
l2.y = 80;
store.setSelection([l1.id, l2.id]);
store.alignSelection('left'); // Ambas deben alinearse al mínimo X (50)
assert.equal(store.getLayerById(l1.id).x, 50);
assert.equal(store.getLayerById(l2.id).x, 50);
console.log('✓ alignSelection OK');

// 6. Borrar capas
store.deleteLayers([l1.id, l2.id]);
assert.equal(store.state.layers.length, 0);
assert.equal(store.state.selectedIds.length, 0);
console.log('✓ deleteLayers OK');

console.log('Todos los tests de StateStore PASARON.');
