---
type: 'Task Contract'
title: 'Implementar Store de Estado y Pila Undo/Redo'
description: 'Contrato de desarrollo para el store centralizado reactivo y la gestión de historial inmutable.'
tags: ['ccdd', 'state', 'store', 'undo-redo']

task: implement_state_store
intent: "Desarrollar el store reactivo de capas, selección e historial conforme a [state-management.md](../architecture/state-management.md)."
target: src/engine/state.js
signature: "class StateStore { constructor(initialData); addLayer(layer); updateLayer(id, props); deleteLayers(ids); undo(); redo(); subscribe(listener); }"
test_command: "node tests/state_store.test.js"
budget:
  max_cyclomatic_complexity: 12
tests: tests/state_store.test.js
deps_allowed: []
---

# Contrato: Store de Estado e Historial

## Intent
Implementar la clase `StateStore` que centraliza la lista de capas, la selección activa, la pila de snapshots para `undo` / `redo`, y la persistencia automática en `localStorage`.

## Constraints & Links
- Arquitectura detallada: [state-management.md](../architecture/state-management.md)
- Modelo de documento: [document_schema.md](../data_models/document_schema.md)
