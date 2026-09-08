---
type: 'Data Model'
title: 'Esquema de Documento y Proyecto Figma'
description: 'Estructura general del documento que encapsula metadatos, páginas, capas y configuraciones del viewport.'
tags: ['data-model', 'document', 'project', 'schema']
---

# Esquema de Documento y Proyecto Figma

Define la estructura de serialización del proyecto completo, compatible con exportación e importación JSON.

## Estructura JSON
```json
{
  "version": "1.0.0",
  "title": "Mi Proyecto Figma",
  "createdAt": 1725700000000,
  "updatedAt": 1725700000000,
  "viewport": {
    "panX": 100,
    "panY": 80,
    "zoom": 1.0
  },
  "settings": {
    "gridEnabled": true,
    "snapToGrid": true,
    "snapGuides": true,
    "theme": "dark"
  },
  "layers": []
}
```

Cada elemento del array `layers` cumple estrictamente con las especificaciones de [layer_schema.md](layer_schema.md).

## Contrato de diseño y round trip

- El JSON editable incluye `designContract` (contrato activo o propuesta, o `null`), junto con copias profundas de `layers`, `viewport` y `settings`.
- Importar un archivo nunca constituye aprobación humana de sus reglas. Sin protección previa, su contrato se conserva con `status: 'proposed'` en `designContractProposal`; `designContract` del estado queda reservado al contrato activo.
- Si existe protección activa, importar conserva exactamente ese contrato, aunque el archivo omita reglas o intente reemplazarlas. Toda importación incompatible se rechaza de forma atómica, conservando documento e historial anteriores.
- Una propuesta importada se vuelve a exportar en `designContract` y persiste entre recargas, sin convertirse en activa. Solo la aprobación explícita de la interfaz puede activarla.
- La restauración del almacenamiento local puede restablecer la protección previamente aprobada, siempre que las capas cumplan las reglas. No se confunde esa restauración con la importación de archivos externos.
- `figma_export_project` devuelve además un `exportToken` efímero de una copia inmutable del JSON. `figma_prepare_import_project` acepta exactamente una fuente (`projectJson`, `projectUrl` o `exportToken`); el token caduca en 60 segundos, es de un solo uso y nunca sustituye la confirmación final de importación. Los formularios declarativos consumen el mismo esquema registrado.
