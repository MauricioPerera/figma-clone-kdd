---
type: 'Index'
title: 'Base de Conocimiento OKF - Figma Clone KDD'
description: 'Índice de arquitectura, modelos de datos y contratos de ejecución para el clon de Figma 100% client-side.'
tags: ['okf', 'index', 'kdd', 'figma']
---

# Base de Conocimiento - Figma Clone KDD

Bienvenido al repositorio de conocimiento de **Figma Clone KDD**, estructurado según el estándar OKF y gobernado por contratos CCDD.

## 🏗️ Arquitectura
- [canvas-engine.md](architecture/canvas-engine.md): Motor de renderizado vectorial, viewport infinito, transformaciones matriciales y guías inteligentes.
- [state-management.md](architecture/state-management.md): Store reactivo de documentos, historial Undo/Redo inmutable y persistencia en LocalStorage.
- [webmcp-integration.md](architecture/webmcp-integration.md): Integración dual Imperativa y Declarativa con el estándar WebMCP ([webmcp.com](https://webmcp.com)) y FastWebMCP.

## 📦 Modelos de Datos
- [layer_schema.md](data_models/layer_schema.md): Estructura tipada para Frames, Grupos, Rectángulos, Elipses, Polígonos, Textos y Vectores.
- [document_schema.md](data_models/document_schema.md): Esquema general de documento, páginas, viewport y metadatos exportables.

## 📜 Contratos de Tarea (CCDD + OKF)
- [task_project_roundtrip.md](contracts/task_project_roundtrip.md): Roundtrip y conservación segura de contratos de diseño.
- [task_canvas_engine.md](contracts/task_canvas_engine.md): Motor gráfico, pan/zoom, interacción y renderizado.
- [task_state_store.md](contracts/task_state_store.md): Manejo del estado, mutaciones atómicas y pila de historial.
- [task_inspector_sync.md](contracts/task_inspector_sync.md): Sincronización bidireccional entre la selección y los paneles de propiedades.
- [task_webmcp_bridge.md](contracts/task_webmcp_bridge.md): Exposición de herramientas de diseño para agentes autónomos.
- [task_export_engine.md](contracts/task_export_engine.md): Exportación en alta resolución a PNG, SVG y generación de código Tailwind CSS.
