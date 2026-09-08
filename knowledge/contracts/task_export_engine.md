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
- SVG debe emitir imágenes importadas (`src`, modo FILL y matriz inversa de paint con clipping) y paths vectoriales (escalas, rellenos y siluetas de stroke expandido) conforme al renderer. Nunca omitir silenciosamente un tipo desconocido o imagen sin fuente; devolver error explícito. Regresión: `tests/svg_imported_export.test.js`.
- Flechas incluyen punta; estrellas respetan radios independientes X/Y. Esta cobertura no equivale a fidelidad universal de efectos o tipografía.
- Esquema de documento: [document_schema.md](../data_models/document_schema.md)
- Motor de capas: [canvas-engine.md](../architecture/canvas-engine.md)
