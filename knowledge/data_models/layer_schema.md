---
type: 'Data Model'
title: 'Esquema de Capa Vectorial (Layer)'
description: 'Estructura de datos para todos los nodos del lienzo: Frames, Rectángulos, Círculos, Textos y Polígonos.'
tags: ['data-model', 'layer', 'schema', 'vector']
---

# Esquema de Capa Vectorial

Define los atributos comunes y específicos que componen cualquier elemento visual en el documento.

## 1. Atributos Comunes
- `id` (string): Identificador único universal (ej: `layer_1725700000_1`).
- `name` (string): Nombre legible para humanos en el árbol de capas.
- `type` (string): Tipo de nodo (`'frame'`, `'rect'`, `'circle'`, `'polygon'`, `'star'`, `'line'`, `'arrow'`, `'text'`, `'image'`).
- `x` (number): Posición X en coordenadas mundiales (o relativas si está contenido en un Frame).
- `y` (number): Posición Y en coordenadas mundiales (o relativas al Frame).
- `width` (number): Ancho en píxeles.
- `height` (number): Alto en píxeles.
- `rotation` (number): Ángulo en grados sexagesimales (0 - 360).
- `opacity` (number): Nivel de opacidad (0.0 a 1.0).
- `visible` (boolean): Si es visible en el renderizado.
- `locked` (boolean): Si está bloqueada para edición interactiva.
- `parentId` (string | null): ID del Frame o Grupo contenedor.

## 2. Atributos de Estilo y Apariencia
- `fill` (string): Color de relleno en formato `#RRGGBB` o `rgba(...)` o `'none'`.
- `stroke` (string): Color de trazo en formato `#RRGGBB` o `'none'`.
- `strokeWidth` (number): Grosor del trazo en píxeles.
- `strokeAlign` (string): `'center'`, `'inside'`, o `'outside'`.
- `strokeDash` (string): `'solid'` o `'dashed'`.
- `cornerRadius` (number): Radio de curvatura de esquinas.
- `shadow` (object | null): `{ x: number, y: number, blur: number, color: string }`.

## 3. Atributos Específicos para Texto
- `text` (string): Contenido textual.
- `fontSize` (number): Tamaño en px.
- `fontFamily` (string): Fuente (ej. `'Inter, sans-serif'`).
- `fontWeight` (string | number): Peso tipográfico (`'400'`, `'600'`, `'700'`).
- `textAlign` (string): `'left'`, `'center'`, `'right'`.
- `lineHeight` (number): Altura de línea proporcional o en px.
