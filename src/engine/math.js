/**
 * Utilidades matemáticas y geométricas para el motor Figma Clone KDD.
 */

export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function rotatePoint(x, y, cx, cy, angleDegrees) {
  const rad = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const nx = cos * (x - cx) - sin * (y - cy) + cx;
  const ny = sin * (x - cx) + cos * (y - cy) + cy;
  return { x: nx, y: ny };
}

export function getLayerBounds(layer) {
  // Retorna bounding box AABB
  let minX = layer.x;
  let minY = layer.y;
  let maxX = layer.x + layer.width;
  let maxY = layer.y + layer.height;

  if (layer.rotation && layer.rotation !== 0) {
    const cx = layer.x + layer.width / 2;
    const cy = layer.y + layer.height / 2;
    const corners = [
      rotatePoint(layer.x, layer.y, cx, cy, layer.rotation),
      rotatePoint(layer.x + layer.width, layer.y, cx, cy, layer.rotation),
      rotatePoint(layer.x + layer.width, layer.y + layer.height, cx, cy, layer.rotation),
      rotatePoint(layer.x, layer.y + layer.height, cx, cy, layer.rotation)
    ];
    minX = Math.min(...corners.map(c => c.x));
    minY = Math.min(...corners.map(c => c.y));
    maxX = Math.max(...corners.map(c => c.x));
    maxY = Math.max(...corners.map(c => c.y));
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    cx: layer.x + layer.width / 2,
    cy: layer.y + layer.height / 2
  };
}

export function isPointInLayer(px, py, layer) {
  if (!layer.visible) return false;

  let localX = px;
  let localY = py;

  if (layer.rotation && layer.rotation !== 0) {
    const cx = layer.x + layer.width / 2;
    const cy = layer.y + layer.height / 2;
    const rotated = rotatePoint(px, py, cx, cy, -layer.rotation);
    localX = rotated.x;
    localY = rotated.y;
  }

  if (layer.type === 'circle') {
    const rx = layer.width / 2;
    const ry = layer.height / 2;
    const cx = layer.x + rx;
    const cy = layer.y + ry;
    const normX = (localX - cx) / (rx || 1);
    const normY = (localY - cy) / (ry || 1);
    return (normX * normX + normY * normY) <= 1;
  }

  if (layer.type === 'line' || layer.type === 'arrow') {
    const dist = distanceToSegment(px, py, layer.x, layer.y, layer.x + layer.width, layer.y + layer.height);
    return dist <= Math.max(6, (layer.strokeWidth || 2) + 4);
  }

  return (
    localX >= layer.x &&
    localX <= layer.x + layer.width &&
    localY >= layer.y &&
    localY <= layer.y + layer.height
  );
}

export function distanceToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (l2 === 0) return distance(px, py, x1, y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return distance(px, py, x1 + t * (x2 - x1), y1 + t * (y2 - y1));
}

export function getCombinedBounds(layers) {
  if (!layers || layers.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const layer of layers) {
    const b = getLayerBounds(layer);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    cx: minX + (maxX - minX) / 2,
    cy: minY + (maxY - minY) / 2
  };
}

export function snapValue(val, snapGrid = 8) {
  return Math.round(val / snapGrid) * snapGrid;
}

export function findSnapGuides(draggingLayer, otherLayers, threshold = 6) {
  const guides = [];
  const db = getLayerBounds(draggingLayer);
  const snapTargetsX = [
    { type: 'left', val: db.x },
    { type: 'center', val: db.cx },
    { type: 'right', val: db.x + db.width }
  ];
  const snapTargetsY = [
    { type: 'top', val: db.y },
    { type: 'center', val: db.cy },
    { type: 'bottom', val: db.y + db.height }
  ];

  let deltaX = 0;
  let deltaY = 0;
  let snappedX = false;
  let snappedY = false;

  for (const other of otherLayers) {
    if (other.id === draggingLayer.id || !other.visible) continue;
    const ob = getLayerBounds(other);

    const otherX = [ob.x, ob.cx, ob.x + ob.width];
    const otherY = [ob.y, ob.cy, ob.y + ob.height];

    if (!snappedX) {
      for (const st of snapTargetsX) {
        for (const ox of otherX) {
          const diff = ox - st.val;
          if (Math.abs(diff) <= threshold) {
            deltaX = diff;
            guides.push({ axis: 'x', pos: ox });
            snappedX = true;
            break;
          }
        }
        if (snappedX) break;
      }
    }

    if (!snappedY) {
      for (const st of snapTargetsY) {
        for (const oy of otherY) {
          const diff = oy - st.val;
          if (Math.abs(diff) <= threshold) {
            deltaY = diff;
            guides.push({ axis: 'y', pos: oy });
            snappedY = true;
            break;
          }
        }
        if (snappedY) break;
      }
    }
  }

  return { deltaX, deltaY, guides };
}
