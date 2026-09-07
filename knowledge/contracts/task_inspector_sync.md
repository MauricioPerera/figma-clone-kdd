---
type: 'Task Contract'
title: 'Implementar Sincronización del Inspector y Código Tailwind'
description: 'Contrato de desarrollo para el panel lateral de propiedades y generación reactiva de código Tailwind CSS.'
tags: ['ccdd', 'inspector', 'tailwind', 'ui']

task: implement_inspector_sync
intent: "Desarrollar el panel de propiedades bidireccional y conversor de capas a clases de Tailwind CSS conforme a [layer_schema.md](../data_models/layer_schema.md)."
target: src/ui/inspector_panel.js
signature: "class InspectorPanel { constructor(container, store); updateSelection(selectedLayers); layerToTailwind(layer); }"
test_command: "node tests/state_store.test.js"
budget:
  max_cyclomatic_complexity: 15
tests: tests/state_store.test.js
deps_allowed: []
---

# Contrato: Sincronización del Inspector

## Intent
Implementar el controlador `InspectorPanel` que vincula la capa seleccionada con los inputs de geometría, color, trazo, efectos y tipografía, y compila en vivo la representación en clases utilitarias de Tailwind CSS.

## Constraints & Links
- Modelo de capas: [layer_schema.md](../data_models/layer_schema.md)
- Arquitectura del Store: [state-management.md](../architecture/state-management.md)
