/** Shared, non-mutating annotation and inherited visibility queries. */
function indexLayers(layers) {
  return layers instanceof Map ? layers : new Map((layers || []).filter(layer => layer?.id != null).map(layer => [layer.id, layer]));
}

export function isLayerEffectivelyVisible(layer, layers) {
  if (!layer) return false;
  const index = indexLayers(layers);
  const seen = new Set();
  for (let current = layer; current; current = current.parentId == null ? null : index.get(current.parentId)) {
    if (seen.has(current)) return false;
    seen.add(current);
    if (current.visible === false || current.softDeleted === true) return false;
  }
  return true;
}

export function getAnnotationRoot(layer, layers) {
  if (!layer) return null;
  const index = indexLayers(layers);
  const seen = new Set();
  for (let current = layer; current && !seen.has(current); current = current.parentId == null ? null : index.get(current.parentId)) {
    seen.add(current);
    if (current.annotationKind === 'sticky') return current;
    const explicitRoot = index.get(current.annotationRootId);
    if (explicitRoot?.annotationKind === 'sticky') return explicitRoot;
  }
  return null;
}

export function isAnnotationLayer(layer, layers) {
  // Explicit membership survives exporting an isolated child without its root.
  return !!layer && (!!layer.annotationRootId || !!getAnnotationRoot(layer, layers));
}
