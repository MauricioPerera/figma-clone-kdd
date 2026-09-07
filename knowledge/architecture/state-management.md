---
type: 'Architecture'
title: 'Gestión del Estado e Historial Undo/Redo'
description: 'Arquitectura del store reactivo centralizado con inmutabilidad para historial y persistencia local.'
tags: ['state', 'store', 'undo-redo', 'persistence']
---

# Gestión del Estado e Historial Undo/Redo

El clon de Figma se apoya en un patrón de Store Unificado que garantiza operaciones atómicas y un historial de acciones determinista.

## 1. Principios de Diseño
1. **Árbol de Estado Único**: Todo el documento (páginas, capas, selección y configuraciones) reside en un store centralizado.
2. **Historial de Comandos (Command Pattern)**: Cada mutación significativa crea una entrada en la pila `undoStack`.
3. **Persistencia Automática**: Los cambios se sincronizan en `localStorage` con debounce para evitar pérdidas ante recargas imprevistas.

## 2. Pila de Historial
- `undoStack`: Array de snapshots previos.
- `redoStack`: Array de snapshots revertidos.
- Límite máximo de historial: 50 estados para optimizar uso de memoria.
- Atajos globales: `Ctrl+Z` (deshacer), `Ctrl+Y` o `Ctrl+Shift+Z` (rehacer).
