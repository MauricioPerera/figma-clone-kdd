---
type: 'Task Contract'
title: 'Roundtrip de proyecto y protección de diseño'
description: 'Conservar contratos, notas y ajustes sin elevar la confianza de archivos importados.'
tags: ['kdd', 'export', 'security', 'webmcp']
task: project_roundtrip
intent: 'Preservar el documento editable y la autorización humana de sus reglas.'
target: src/mcp/design_rules_tools.js
signature: 'figma_export_project(); figma_prepare_import_project({projectJson?, projectUrl?, exportToken?}); figma_confirm_import_project({confirmationToken}); figma_get_design_rules(); figma_export_design_rules();'
test_command: 'node tests/project_roundtrip.test.js'
budget:
  max_cyclomatic_complexity: 12
tests: tests/project_roundtrip.test.js
deps_allowed: []
---

# Invariantes de aceptación

- Activación autorizada por el usuario mediante figma_prepare_design_protection y figma_activate_design_rules: token de 60 segundos, propuesta y estado exactos, un solo uso; no reemplaza contrato activo. La autorización se solicita en la conversación, no se infiere del archivo.
- src/ui/webmcp_drawer.js expone formularios declarativos para preparar y activar el mismo token, utilizando el runtime compartido.

- Exportar copias profundas de capas, notas ocultas, ajustes, viewport y contrato.
- Un contrato recibido de archivo es una propuesta, no autorización humana.
- La protección activa previa no se sustituye ni debilita mediante importación.
- Rechazar una importación incompatible sin cambiar estado ni historial.
- La confirmación espera el guardado durable y reporta persisted por separado del importado en memoria. get_document expone persistence sin modificar estado.
- Las consultas y exportaciones de reglas conservan la propuesta importada.
- El botón humano Proteger estilo de src/ui/layers_panel.js ofrece la propuesta importada cuando no hay contrato activo; mantiene la confirmación explícita y valida antes de activar.
- Un token de exportación representa una instantánea inmutable; preparar su importación no modifica el lienzo y sigue requiriendo confirmación. No admite fuentes ambiguas.
- Mantener compatibilidad con archivos antiguos sin contrato y formularios declarativos derivados de los esquemas de herramientas.
- Añadir regresiones sin relajar pruebas existentes; comprobar además el recorrido real por WebMCP en la pestaña visible.

## Referencias

- [Documento](../data_models/document_schema.md)
- [Estado](task_state_store.md)
- [Exportación](task_export_engine.md)
- [WebMCP](task_webmcp_bridge.md)
