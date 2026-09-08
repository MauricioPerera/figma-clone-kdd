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
- `addLayers(layers)` materializa identificadores únicos y referencias padre antes de insertar una plantilla en un único paso de historial. Todos los consumidores de plantillas (WebMCP, modal y bienvenida) usan esta inserción.
- La restauración e importación migran únicamente identificadores ausentes o vacíos a `recovered-<índice>` con sufijos para evitar colisiones. No eliminan nodos ni cambian geometría/estilo; los IDs válidos y las reglas activas se conservan.
- Persistencia primaria de documentos grandes en IndexedDB mediante `src/engine/persistence.js`; localStorage queda como compatibilidad cuando IndexedDB no está disponible. `StateStore.ready` debe terminar antes de montar app.html, sembrar plantillas o registrar herramientas.
- La restauración durable conserva contratos activos aprobados localmente solo si validan. Nunca trata importación externa como aprobación.
- Las escrituras se serializan, el fallo se informa en consola y `persistenceStatus`, y una lectura durable fallida no debe sobrescribir silenciosamente el documento con una plantilla.
- Arquitectura detallada: [state-management.md](../architecture/state-management.md)
- Modelo de documento: [document_schema.md](../data_models/document_schema.md)
