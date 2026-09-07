import assert from 'node:assert/strict';
import { clamp, distance, rotatePoint, getLayerBounds, isPointInLayer, snapValue } from '../src/engine/math.js';
import { exportToSVG, layerToTailwind } from '../src/engine/export.js';

console.log('--- Corriendo tests de Motor Geométrico y Exportación ---');

// 1. Math: clamp
assert.equal(clamp(5, 0, 10), 5);
assert.equal(clamp(-5, 0, 10), 0);
assert.equal(clamp(15, 0, 10), 10);
console.log('✓ clamp OK');

// 2. Math: distance
assert.equal(distance(0, 0, 3, 4), 5);
console.log('✓ distance OK');

// 3. Math: rotatePoint
const rotated = rotatePoint(10, 0, 0, 0, 90);
assert.ok(Math.abs(rotated.x - 0) < 0.0001);
assert.ok(Math.abs(rotated.y - 10) < 0.0001);
console.log('✓ rotatePoint OK');

// 4. Math: getLayerBounds
const layer = { x: 100, y: 100, width: 200, height: 100, rotation: 0 };
const bounds = getLayerBounds(layer);
assert.equal(bounds.x, 100);
assert.equal(bounds.y, 100);
assert.equal(bounds.width, 200);
assert.equal(bounds.height, 100);
assert.equal(bounds.cx, 200);
assert.equal(bounds.cy, 150);
console.log('✓ getLayerBounds OK');

// 5. Math: isPointInLayer
assert.ok(isPointInLayer(150, 150, { ...layer, visible: true, type: 'rect' }));
assert.ok(!isPointInLayer(50, 50, { ...layer, visible: true, type: 'rect' }));
assert.ok(!isPointInLayer(150, 150, { ...layer, visible: false, type: 'rect' })); // Invisible no debe hacer hit
console.log('✓ isPointInLayer OK');

// 6. Math: snapValue
assert.equal(snapValue(15, 8), 16);
assert.equal(snapValue(12, 8), 16);
assert.equal(snapValue(11, 8), 8);
console.log('✓ snapValue OK');

// 7. Export: exportToSVG
const testLayers = [
  { type: 'rect', x: 0, y: 0, width: 100, height: 50, fill: '#ff0000', visible: true },
  { type: 'circle', x: 20, y: 20, width: 40, height: 40, fill: '#00ff00', visible: true }
];
const svgOutput = exportToSVG(testLayers);
assert.ok(svgOutput.includes('<svg'));
assert.ok(svgOutput.includes('<rect'));
assert.ok(svgOutput.includes('<ellipse'));
assert.ok(svgOutput.includes('fill="#ff0000"'));
console.log('✓ exportToSVG OK');

// 8. Export: layerToTailwind
const twLayer = {
  type: 'rect',
  width: 320,
  height: 200,
  fill: '#3b82f6',
  cornerRadius: 16,
  stroke: '#ffffff',
  strokeWidth: 2,
  shadow: { x: 0, y: 4, blur: 10, color: 'rgba(0,0,0,0.2)' }
};
const twHtml = layerToTailwind(twLayer);
assert.ok(twHtml.includes('w-[320px]'));
assert.ok(twHtml.includes('h-[200px]'));
assert.ok(twHtml.includes('bg-[#3b82f6]'));
assert.ok(twHtml.includes('rounded-2xl'));
assert.ok(twHtml.includes('border-[2px]'));
assert.ok(twHtml.includes('shadow-xl'));
console.log('✓ layerToTailwind OK');

console.log('Todos los tests de Motor Geométrico y Exportación PASARON.');
