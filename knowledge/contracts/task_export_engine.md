---
type: 'Task Contract'
title: 'Implementar Motor de Exportación e Importación'
description: 'Contrato de desarrollo para serializadores a SVG vectorial, renderizado PNG de alta resolución y JSON de proyecto.'
tags: ['ccdd', 'export', 'svg', 'png', 'json']

task: implement_export_engine
intent: "Desarrollar los exportadores a SVG, PNG y JSON de proyecto conforme a [document_schema.md](../data_models/document_schema.md)."
target: src/engine/export.js
signature: "exportToSVG(layers, bounds); exportToPNG(canvas, layers, scale); exportToJSON(document); importFromJSON(jsonString);"
test_command: "node tests/canvas_engine.test.js"
budget:
  max_cyclomatic_complexity: 15
tests: tests/canvas_engine.test.js
deps_allowed: []
---

# Contrato: Motor de Exportación e Importación

## Intent
Implementar funciones puras de exportación de elementos seleccionados o lienzos completos a SVG estándar, PNG a escala Retina (1x, 2x, 3x) y serialización estructurada de proyectos.

## Constraints & Links
- Esquema de documento: [document_schema.md](../data_models/document_schema.md)
- Motor de capas: [canvas-engine.md](../architecture/canvas-engine.md)
