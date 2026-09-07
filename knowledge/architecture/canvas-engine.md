---
type: 'Architecture'
title: 'Motor de Lienzo Vectorial y Viewport'
description: 'Diseño del renderizado en HTML5 Canvas con soporte para transformaciones afines, frames jerárquicos y gizmo interactivo.'
tags: ['canvas', 'engine', 'vector', 'geometry']
---

# Motor de Lienzo Vectorial y Viewport

Este documento describe la arquitectura del motor de renderizado vectorial para el clon de Figma.

## 1. Sistema de Coordenadas y Viewport
El motor utiliza una transformación afín bidimensional definida por:
- `panX`, `panY`: Desplazamiento del origen visual respecto al contenedor del navegador.
- `zoom`: Escala multiplicativa (rango admitido: `0.05` a `50.0`, por defecto `1.0`).

### Conversión de Coordenadas
- **Screen to World**:
  $$\text{worldX} = \frac{\text{clientX} - \text{rect.left} - \text{panX}}{\text{zoom}}$$
  $$\text{worldY} = \frac{\text{clientY} - \text{rect.top} - \text{panY}}{\text{zoom}}$$
- **World to Screen**:
  $$\text{screenX} = \text{worldX} \times \text{zoom} + \text{panX} + \text{rect.left}$$
  $$\text{screenY} = \text{worldY} \times \text{zoom} + \text{panY} + \text{rect.top}$$

## 2. Jerarquía de Renderizado
1. **Fondo y Rejilla (Grid)**: Puntos sutiles en base al factor de zoom con espaciado adaptable.
2. **Frames / Artboards**: Contenedores rectangulares con clip opcional, sombra de frame y etiqueta superior con el título.
3. **Capas Vectoriales**: Dibujo ordenado de atrás hacia adelante (Painter's Algorithm).
4. **Guías Inteligentes (Smart Guides)**: Líneas magnéticas de alineación roja/azul que muestran distancias y centros.
5. **Caja de Transformación (Gizmo)**: Bounding box de selección activa con 8 manijas de escala, manija de rotación y 4 controles de radio de esquina.
6. **Recuadro de Selección (Marquee)**: Rectángulo semi-transparente cuando el usuario arrastra sobre espacio vacío con la herramienta `V`.
