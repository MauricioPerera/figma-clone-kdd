---
type: 'Spec'
title: 'Normativa OKF para Figma Clone KDD'
description: 'Especificación de nodos de conocimiento y enlaces conforme al estándar Open Knowledge Format.'
tags: ['okf', 'spec', 'kdd', 'figma']
---

# Especificación OKF (Open Knowledge Format)

Este documento define la estructura y semántica de los nodos de conocimiento para el proyecto **Figma Clone KDD**.

## 1. Reglas de Nodos OKF
1. Todo documento de conocimiento en `knowledge/` DEBE comenzar con Frontmatter YAML válido.
2. Campos obligatorios en Frontmatter:
   - `type`: Categoría del nodo (`Spec`, `Architecture`, `Data Model`, `Task Contract`).
   - `title`: Título claro y conciso del nodo.
   - `description`: Resumen de una o dos oraciones.
   - `tags`: Lista de etiquetas clave.
3. El contenido debe ser autosuficiente y enlazable mediante rutas de Markdown relativas.

## 2. Topología del Grafo de Conocimiento
- `knowledge/index.md`: Nodo raíz que enlaza toda la arquitectura y modelos.
- `knowledge/architecture/`: Decisiones de diseño y patrones del motor vectorial y UI.
- `knowledge/data_models/`: Esquemas de datos para capas, documentos y herramientas WebMCP.
- `knowledge/contracts/`: Contratos de tarea híbridos OKF+CCDD para agentes y desarrollo.
