---
type: 'Architecture'
title: 'Integración WebMCP y FastWebMCP'
description: 'Especificación de la interfaz entre el motor Figma y los agentes de IA a través de WebMCP.'
tags: ['webmcp', 'fastwebmcp', 'ai', 'tools']
---

# Integración WebMCP y FastWebMCP

Este documento establece la integración con el estándar **WebMCP** ([webmcp.com](https://webmcp.com)) mediante la biblioteca **FastWebMCP** ([mauricioperera.github.io/fastwebmcp/](https://mauricioperera.github.io/fastwebmcp/)).

## 1. Modos de Operación
1. **Nativo de Navegador (`document.modelContext`)**: Si el navegador cuenta con soporte de WebMCP (Chrome 149+ u Origin Trial), las herramientas se registran de forma transparente.
2. **Fallback Autónomo / Runtime FastWebMCP**: Cuando el navegador no cuenta con `document.modelContext`, FastWebMCP provee un runtime completo de emulación y ejecución local sin arrojar errores.
3. **Consola Interactiva**: UI desplegable integrada en la aplicación que permite a usuarios humanos e inspectores invocar y auditar cada tool en tiempo real.

## 2. Herramientas Obligatorias Expuestas
- `figma_create_frame(name, width, height, x, y, fill)`
- `figma_create_shape(type, x, y, width, height, fill, stroke, strokeWidth, cornerRadius)`
- `figma_create_text(text, x, y, fontSize, fontFamily, fontWeight, fill)`
- `figma_create_ui_component(templateType, x, y, options)`
- `figma_update_layer(id, properties)`
- `figma_delete_layers(ids)`
- `figma_get_document()`
- `figma_export(format, layerId)`
- `figma_generate_design_prompt(prompt, targetFrame)`
