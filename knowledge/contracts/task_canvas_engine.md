---
type: 'Task Contract'
title: 'Implementar Motor de Lienzo y Transformaciones'
description: 'Contrato de desarrollo para el motor de dibujo, zoom/pan y gizmo de selección.'
tags: ['ccdd', 'canvas', 'engine']

task: implement_canvas_engine
intent: "Desarrollar el controlador del viewport, renderizado vectorial y manipuladores de transformación conforme a [canvas-engine.md](../architecture/canvas-engine.md)."
target: src/engine/canvas.js
signature: "class CanvasEngine { constructor(canvas, store); render(); screenToWorld(x, y); worldToScreen(x, y); }"
test_command: "node tests/canvas_engine.test.js"
budget:
  max_cyclomatic_complexity: 15
tests: tests/canvas_engine.test.js
deps_allowed: []
---

# Contrato: Motor de Lienzo y Transformaciones

## Intent
Implementar la clase `CanvasEngine` responsable del renderizado en HTML5 Canvas, conversión de coordenadas, gestión de eventos de mouse/teclado y manipulación de figuras con gizmo interactivo.

## Constraints & Links
- Arquitectura detallada: [canvas-engine.md](../architecture/canvas-engine.md)
- Modelo de capas: [layer_schema.md](../data_models/layer_schema.md)
- Sin dependencias externas de renderizado pesado.
