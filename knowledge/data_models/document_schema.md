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
