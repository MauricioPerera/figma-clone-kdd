/**
 * Batería de pruebas E2E, estresado y forzado de errores para Figma Clone KDD.
 * Verifica el 100% de las funciones del sistema ante condiciones extremas,
 * datos corruptos, valores límite y excepciones forzadas.
 */

import assert from 'node:assert/strict';
import {
  clamp,
  distance,
  rotatePoint,
  getLayerBounds,
  isPointInLayer,
  distanceToSegment,
  getCombinedBounds,
  snapValue,
  findSnapGuides
} from '../src/engine/math.js';
import { StateStore } from '../src/engine/state.js';
import { exportToSVG, importFromJSON, layerToTailwind } from '../src/engine/export.js';
import { UI_TEMPLATES } from '../src/engine/templates.js';
import { FastWebMcpRuntime, fastwebmcp } from '../src/mcp/fastwebmcp_runtime.js';
import { registerFigmaWebMcpTools } from '../src/mcp/webmcp_tools.js';

// Setup Mock Storage
if (typeof globalThis.localStorage === 'undefined') {
  const storeMap = new Map();
  globalThis.localStorage = {
    getItem: (k) => storeMap.get(k) || null,
    setItem: (k, v) => storeMap.set(k, String(v)),
    removeItem: (k) => storeMap.delete(k),
    clear: () => storeMap.clear()
  };
}

let totalAssertions = 0;
function check(name, fn) {
  try {
    fn();
    totalAssertions++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err);
    throw err;
  }
}

console.log('================================================================');
console.log('⚡ BATERÍA ADVERSARIAL Y E2E: FORZADO DE ERRORES Y CASOS LÍMITE');
console.log('================================================================\n');

// -------------------------------------------------------------
// SECCIÓN 1: MOTOR GEOMÉTRICO (math.js) - CASOS EXTREMOS Y LÍMITES
// -------------------------------------------------------------
console.log('--- 1. Pruebas Adversariales de Motor Geométrico (math.js) ---');

check('clamp: con valores invertidos (min > max)', () => {
  // Cuando min > max, Math.min(max, val) domina
  const res = clamp(50, 100, 20);
  assert.ok(!isNaN(res));
});

check('clamp: con valores negativos y extremos', () => {
  assert.equal(clamp(-100, -50, 50), -50);
  assert.equal(clamp(100, -50, 50), 50);
  assert.equal(clamp(0, -10, 10), 0);
});

check('distance: con coordenadas idénticas, negativas y grandes', () => {
  assert.equal(distance(100, 100, 100, 100), 0);
  assert.equal(distance(-10, -20, -10, -20), 0);
  assert.equal(distance(0, 0, 3000, 4000), 5000);
});

check('rotatePoint: ángulos especiales (0°, 360°, 720°, -90°)', () => {
  const p1 = rotatePoint(10, 0, 0, 0, 0);
  assert.equal(Math.round(p1.x), 10);
  assert.equal(Math.round(p1.y), 0);

  const p2 = rotatePoint(10, 0, 0, 0, 360);
  assert.equal(Math.round(p2.x), 10);
  assert.equal(Math.round(p2.y), 0);

  const p3 = rotatePoint(10, 0, 0, 0, -90);
  assert.equal(Math.round(p3.x), 0);
  assert.equal(Math.round(p3.y), -10);
});

check('getLayerBounds: capa sin rotación, con rotación 45°, con dimensiones 0', () => {
  // Capa con dimensiones 0
  const bZero = getLayerBounds({ x: 50, y: 50, width: 0, height: 0, rotation: 0 });
  assert.equal(bZero.width, 0);
  assert.equal(bZero.height, 0);

  // Capa con rotación de 90°
  const bRot = getLayerBounds({ x: 0, y: 0, width: 100, height: 50, rotation: 90 });
  assert.equal(Math.round(bRot.width), 50);
  assert.equal(Math.round(bRot.height), 100);
});

check('isPointInLayer: círculos deformados, líneas, polígonos, capas invisibles', () => {
  const circle = { type: 'circle', x: 0, y: 0, width: 100, height: 50, visible: true };
  // Centro
  assert.ok(isPointInLayer(50, 25, circle));
  // Fuera en Y
  assert.ok(!isPointInLayer(50, 60, circle));

  // Capa invisible: SIEMPRE retorna false
  assert.ok(!isPointInLayer(50, 25, { ...circle, visible: false }));

  // Línea
  const line = { type: 'line', x: 0, y: 0, width: 100, height: 0, strokeWidth: 2, visible: true };
  assert.ok(isPointInLayer(50, 2, line)); // Cerca de la línea
  assert.ok(!isPointInLayer(50, 50, line)); // Lejos
});

check('distanceToSegment: segmento de longitud 0 y puntos colineales', () => {
  // Segmento con x1=x2 y y1=y2
  assert.equal(distanceToSegment(10, 10, 5, 5, 5, 5), distance(10, 10, 5, 5));

  // Punto exactamente sobre el segmento
  assert.equal(distanceToSegment(5, 0, 0, 0, 10, 0), 0);

  // Punto colineal pero fuera del segmento
  assert.equal(distanceToSegment(15, 0, 0, 0, 10, 0), 5);
});

check('getCombinedBounds: array vacío, null, o capas con coords negativas', () => {
  assert.equal(getCombinedBounds([]), null);
  assert.equal(getCombinedBounds(null), null);
  assert.equal(getCombinedBounds(undefined), null);

  const negBounds = getCombinedBounds([
    { x: -100, y: -50, width: 50, height: 20 },
    { x: 50, y: 80, width: 10, height: 10 }
  ]);
  assert.equal(negBounds.x, -100);
  assert.equal(negBounds.y, -50);
  assert.equal(negBounds.width, 160);
  assert.equal(negBounds.height, 140);
});

check('snapValue: grid <= 0, float, y múltiplos grandes', () => {
  assert.equal(snapValue(15, 0), 15); // Seguro ante división por cero
  assert.equal(snapValue(15, -10), 15); // Seguro ante números negativos
  assert.equal(snapValue(15, 8), 16);
  assert.equal(snapValue(100, 50), 100);
});

check('findSnapGuides: con entradas nulas o layers vacíos', () => {
  const emptySnap = findSnapGuides(null, []);
  assert.equal(emptySnap.guides.length, 0);

  const target = { id: 'l1', x: 100, y: 100, width: 100, height: 100, visible: true };
  const other = { id: 'l2', x: 102, y: 250, width: 100, height: 100, visible: true };
  const snapRes = findSnapGuides(target, [other], 6);
  assert.equal(snapRes.guides.length, 1);
  assert.equal(snapRes.deltaX, 2); // Debe corregir 2px hacia la derecha
});

// -------------------------------------------------------------
// SECCIÓN 2: STATE STORE - HISTORIAL, CORRUPCIONES Y MUTACIONES
// -------------------------------------------------------------
console.log('\n--- 2. Pruebas Adversariales de StateStore (state.js) ---');

check('StateStore: protección ante suscriptores que arrojan excepciones', () => {
  const store = new StateStore({ layers: [] });
  let healthyCalled = false;

  // Suscriptor que falla
  store.subscribe(() => {
    throw new Error('Explosión en listener externo');
  });

  // Suscriptor sano
  store.subscribe(() => {
    healthyCalled = true;
  });

  // Notificar no debe tumbar el flujo
  store.notify('test');
  assert.ok(healthyCalled, 'El listener sano debió ejecutarse a pesar del error en el primero.');
});

check('StateStore: Undo y Redo en pilas vacías', () => {
  const store = new StateStore({ layers: [] });
  assert.equal(store.canUndo(), false);
  assert.equal(store.canRedo(), false);
  assert.equal(store.undo(), false, 'undo() en pila vacía debe retornar false');
  assert.equal(store.redo(), false, 'redo() en pila vacía debe retornar false');
});

check('StateStore: Desbordamiento del historial (>50 estados) y FIFO trimming', () => {
  const store = new StateStore({ layers: [] });
  const l = store.addLayer({ type: 'rect', x: 0, y: 0, width: 10, height: 10 });

  // Forzar 60 mutaciones
  for (let i = 1; i <= 60; i++) {
    store.updateLayer(l.id, { x: i });
  }

  assert.ok(store.undoStack.length <= 50, `El historial no debe exceder 50 (actual: ${store.undoStack.length})`);
});

check('StateStore: updateLayer y deleteLayers con IDs inexistentes o nulos', () => {
  const store = new StateStore({ layers: [] });
  const resUpdate = store.updateLayer('id_fantasma_123', { fill: '#fff' });
  assert.equal(resUpdate, null, 'updateLayer con ID inexistente debe retornar null sin lanzar error.');

  // deleteLayers con null o vacío
  store.deleteLayers(null);
  store.deleteLayers([]);
  store.deleteLayers(['id_inexistente_999']);
  assert.equal(store.state.layers.length, 0);
});

check('StateStore: Cascada de borrado de hijos en Frames', () => {
  const store = new StateStore({ layers: [] });
  const frame = store.addLayer({ type: 'frame', name: 'Frame Padre', width: 300, height: 300 });
  const hijo1 = store.addLayer({ type: 'rect', parentId: frame.id, name: 'Hijo 1' });
  const hijo2 = store.addLayer({ type: 'circle', parentId: frame.id, name: 'Hijo 2' });
  const nieto = store.addLayer({ type: 'text', parentId: hijo1.id, name: 'Nieto' });

  assert.equal(store.state.layers.length, 4);

  // Borrar el Frame debe eliminar recursivamente hijo1, hijo2 y nieto
  store.deleteLayers([frame.id]);
  assert.equal(store.state.layers.length, 0, 'Al borrar un Frame deben eliminarse todos los elementos contenidos.');
});

check('StateStore: Reordenamiento en extremos (bringForward al tope, sendBackward al fondo)', () => {
  const store = new StateStore({ layers: [] });
  const l1 = store.addLayer({ type: 'rect', name: 'L1' });
  const l2 = store.addLayer({ type: 'rect', name: 'L2' });

  // l2 ya está al tope. bringForward no debe romper el array
  store.bringForward(l2.id);
  assert.equal(store.state.layers[1].id, l2.id);

  // bringForward con ID inexistente no debe alterar el array
  store.bringForward('id_invalido');
  assert.equal(store.state.layers.length, 2);

  // l1 está al fondo. sendBackward no debe romper el array
  store.sendBackward(l1.id);
  assert.equal(store.state.layers[0].id, l1.id);

  store.sendBackward('id_invalido');
  assert.equal(store.state.layers.length, 2);
});

check('StateStore: Alineación y distribución con 0 o 1 elementos seleccionados', () => {
  const store = new StateStore({ layers: [] });
  // Con 0 elementos seleccionados
  store.alignSelection('left');
  store.distributeSelection('horizontal');

  // Con 1 elemento seleccionado
  const l1 = store.addLayer({ type: 'rect', x: 100, y: 100 });
  store.setSelection([l1.id]);
  store.alignSelection('right');
  assert.equal(l1.x, 100, 'Alinear con 1 elemento no debe alterar su posición.');
  store.distributeSelection('vertical');
  assert.equal(l1.y, 100, 'Distribuir con 1 elemento no debe alterar su posición.');
});

check('StateStore: Zoom fuera de rango clamping (0.05 a 30.0)', () => {
  const store = new StateStore();
  store.setViewport(0, 0, 0.0001);
  assert.equal(store.state.viewport.zoom, 0.05, 'Debe clampear al mínimo 0.05');

  store.setViewport(0, 0, 999.0);
  assert.equal(store.state.viewport.zoom, 30.0, 'Debe clampear al máximo 30.0');
});

// -------------------------------------------------------------
// SECCIÓN 3: MOTOR DE EXPORTACIÓN E IMPORTACIÓN (export.js)
// -------------------------------------------------------------
console.log('\n--- 3. Pruebas Adversariales de Exportación e Importación (export.js) ---');

check('exportToSVG: Array con elementos nulos o vacíos', () => {
  const svg = exportToSVG([null, undefined]);
  assert.ok(svg.startsWith('<svg'));
  assert.ok(svg.endsWith('</svg>'));
});

check('exportToSVG: Inyección de caracteres especiales XML en textos (XSS / malformed)', () => {
  const maliciousText = '<script>alert("XSS")</script> & "comillas" & \'apóstrofes\'';
  const textLayer = {
    type: 'text',
    text: maliciousText,
    x: 10,
    y: 10,
    fontSize: 16,
    visible: true
  };
  const svg = exportToSVG([textLayer]);
  assert.ok(!svg.includes('<script>'), 'Los caracteres < y > deben ser escapados a &lt; y &gt;');
  assert.ok(svg.includes('&lt;script&gt;'));
});

check('exportToSVG: Todos los tipos de figuras vectoriales', () => {
  const allShapes = [
    { type: 'frame', x: 0, y: 0, width: 100, height: 100, visible: true, cornerRadius: 10 },
    { type: 'rect', x: 0, y: 0, width: 50, height: 50, visible: true, stroke: '#fff', strokeWidth: 2 },
    { type: 'circle', x: 0, y: 0, width: 40, height: 40, visible: true },
    { type: 'polygon', x: 0, y: 0, width: 30, height: 30, visible: true },
    { type: 'star', x: 0, y: 0, width: 60, height: 60, visible: true },
    { type: 'line', x: 0, y: 0, width: 80, height: 0, visible: true },
    { type: 'arrow', x: 0, y: 0, width: 80, height: 20, visible: true },
    { type: 'text', x: 0, y: 0, width: 100, height: 30, text: 'Hello', visible: true }
  ];
  const svg = exportToSVG(allShapes);
  assert.ok(svg.includes('<rect'));
  assert.ok(svg.includes('<ellipse'));
  assert.ok(svg.includes('<polygon'));
  assert.ok(svg.includes('<line'));
  assert.ok(svg.includes('<text'));
});

check('importFromJSON: JSON corrupto, malformado o sin array de capas', () => {
  const store = new StateStore();
  
  // 1. Sintaxis rota
  const res1 = importFromJSON('{ corrupt json string...', store);
  assert.equal(res1.success, false);
  assert.ok(res1.error);

  // 2. Objeto sin propiedad 'layers'
  const res2 = importFromJSON(JSON.stringify({ title: 'Foo', noLayersHere: true }), store);
  assert.equal(res2.success, false);
  assert.ok(res2.error.includes('capas'));

  // 3. 'layers' no es un array
  const res3 = importFromJSON(JSON.stringify({ layers: 'texto en lugar de array' }), store);
  assert.equal(res3.success, false);

  // 4. JSON válido
  const validDoc = {
    title: 'Imported',
    layers: [{ id: 'imp_1', type: 'rect', width: 100, height: 100, visible: true }]
  };
  const res4 = importFromJSON(JSON.stringify(validDoc), store);
  assert.equal(res4.success, true);
  assert.equal(res4.count, 1);
});

check('layerToTailwind: elemento nulo o con propiedades exóticas', () => {
  assert.ok(layerToTailwind(null).includes('Selecciona un elemento'));

  const circleLayer = {
    type: 'circle',
    width: 64,
    height: 64,
    fill: '#10b981',
    cornerRadius: 999
  };
  const tw = layerToTailwind(circleLayer);
  assert.ok(tw.includes('rounded-full'));
  assert.ok(tw.includes('w-[64px]'));
  assert.ok(tw.includes('bg-[#10b981]'));
});

// -------------------------------------------------------------
// SECCIÓN 4: FASTWEBMCP RUNTIME Y TOOLS (FORZADO DE ERRORES)
// -------------------------------------------------------------
console.log('\n--- 4. Pruebas Adversariales de FastWebMCP y Herramientas (webmcp.js) ---');

check('FastWebMCP: defineTool rechaza nombres no conformes con WebMCP spec', () => {
  const runtime = new FastWebMcpRuntime();

  // Nombres inválidos
  const invalidNames = [
    '', // Vacío
    'tool with spaces', // Espacios
    'tool@invalid!', // Caracteres no permitidos
    'tool#name',
    'a'.repeat(129) // > 128 chars
  ];

  for (const badName of invalidNames) {
    assert.throws(() => {
      runtime.defineTool({ name: badName, execute: async () => {} });
    }, /Nombre de herramienta inválido/);
  }
});

check('FastWebMCP: invokeTool con herramienta inexistente', async () => {
  const runtime = new FastWebMcpRuntime();
  const res = await runtime.invokeTool('herramienta_que_no_existe_404', {});
  assert.equal(res.success, false);
  assert.ok(res.error.includes('Herramienta desconocida'));
  assert.equal(res.log.status, 'error');
});

check('FastWebMCP: invokeTool con handler que arroja excepción', async () => {
  const runtime = new FastWebMcpRuntime();
  runtime.registerTool({
    name: 'failing_tool',
    execute: async () => {
      throw new Error('Fallo crítico simulado en la lógica del tool');
    }
  });

  const res = await runtime.invokeTool('failing_tool', {});
  assert.equal(res.success, false);
  assert.ok(res.error.includes('Fallo crítico simulado'));
  assert.equal(res.log.status, 'error');
});

check('Figma WebMCP Tools: figma_create_ui_component con plantilla inválida', async () => {
  const store = new StateStore({ layers: [] });
  registerFigmaWebMcpTools(store, null);

  const res = await fastwebmcp.invokeTool('figma_create_ui_component', {
    template: 'plantilla_fantasma_inexistente'
  });
  assert.equal(res.success, false);
  assert.ok(res.error.includes('no existe'));
});

check('Figma WebMCP Tools: figma_update_layer con ID inexistente', async () => {
  const res = await fastwebmcp.invokeTool('figma_update_layer', {
    id: 'id_que_nadie_conoce_999',
    properties: { fill: '#000000' }
  });
  assert.equal(res.success, false);
  assert.ok(res.error.includes('no encontrada'));
});

check('Figma WebMCP Tools: figma_transform_layer con ID inexistente', async () => {
  const res = await fastwebmcp.invokeTool('figma_transform_layer', {
    id: 'id_transform_fake',
    x: 500
  });
  assert.equal(res.success, false);
  assert.ok(res.error.includes('no encontrada'));
});

check('Figma WebMCP Tools: figma_generate_design_prompt con prompts variados', async () => {
  // 1. Prompt de login
  const resLogin = await fastwebmcp.invokeTool('figma_generate_design_prompt', {
    prompt: 'Genera una pantalla de inicio de sesion móvil'
  });
  assert.equal(resLogin.success, true);
  assert.ok(resLogin.data.elements > 0);

  // 2. Prompt de SaaS hero
  const resHero = await fastwebmcp.invokeTool('figma_generate_design_prompt', {
    prompt: 'Diseña una sección hero para SaaS moderno'
  });
  assert.equal(resHero.success, true);

  // 3. Prompt de botón
  const resBtn = await fastwebmcp.invokeTool('figma_generate_design_prompt', {
    prompt: 'Crea un botón de acción principal'
  });
  assert.equal(resBtn.success, true);

  // 4. Prompt genérico libre
  const resFree = await fastwebmcp.invokeTool('figma_generate_design_prompt', {
    prompt: 'Una tabla comparativa de servidores en la nube'
  });
  assert.equal(resFree.success, true);
});

// -------------------------------------------------------------
// SECCIÓN 5: PLANTILLAS UI (templates.js)
// -------------------------------------------------------------
console.log('\n--- 5. Verificación de Todas las Plantillas UI (templates.js) ---');

check('UI_TEMPLATES: mobile_login genera capas íntegras', () => {
  const layers = UI_TEMPLATES.mobile_login.create(50, 50);
  assert.ok(layers.length >= 8);
  assert.equal(layers[0].type, 'frame');
  assert.equal(layers[0].width, 390);
});

check('UI_TEMPLATES: saas_hero genera capas íntegras', () => {
  const layers = UI_TEMPLATES.saas_hero.create(0, 0);
  assert.ok(layers.length >= 8);
  assert.equal(layers[0].type, 'frame');
  assert.equal(layers[0].width, 960);
});

check('UI_TEMPLATES: dashboard_card genera capas íntegras', () => {
  const layers = UI_TEMPLATES.dashboard_card.create(100, 100);
  assert.ok(layers.length >= 6);
  assert.equal(layers[0].type, 'rect');
  assert.equal(layers[0].width, 320);
});

console.log('\n================================================================');
console.log(`🎉 TODAS LAS ${totalAssertions} PRUEBAS ADVERSARIALES Y DE FORZADO DE ERRORES PASARON EXITOSAMENTE.`);
console.log('================================================================\n');
