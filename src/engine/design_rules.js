/** Deterministic observations, not inferred author intent or original Figma constraints. */
import { isAnnotationLayer, isLayerEffectivelyVisible } from './annotations.js';

const STYLE_PROPERTIES = ['fill', 'stroke', 'strokeWidth', 'cornerRadius', 'opacity', 'fontFamily', 'fontSize', 'fontWeight', 'textAlign', 'lineHeight', 'letterSpacing'];
const TEXT_PROPERTIES = new Set(['fontFamily', 'fontSize', 'fontWeight', 'textAlign', 'lineHeight', 'letterSpacing']);
const scalar = value => typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));
const sortedUnique = values => [...new Set(values)].sort();

export function extractDesignRules(layers, { ids } = {}) {
  if (!Array.isArray(layers)) throw new Error('layers must be an array.');
  if (ids !== undefined && (!Array.isArray(ids) || !ids.length || ids.some(id => typeof id !== 'string'))) throw new Error('ids must be a nonempty string array.');
  const indexed = new Map(layers.filter(layer => layer?.id != null).map(layer => [layer.id, layer]));
  const scope = ids === undefined ? null : new Set(ids);
  if (scope) {
    for (const id of scope) if (!indexed.has(id)) throw new Error(`Unknown layer ID: ${id}`);
    let changed = true;
    while (changed) {
      changed = false;
      for (const layer of layers) if (layer && scope.has(layer.parentId) && !scope.has(layer.id)) { scope.add(layer.id); changed = true; }
    }
  }
  const selected = layers.filter(layer => layer && typeof layer.id === 'string' && (!scope || scope.has(layer.id)) && !isAnnotationLayer(layer, indexed) && isLayerEffectivelyVisible(layer, indexed)).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  if (new Set(selected.map(layer => layer.id)).size !== selected.length) throw new Error('Design layers must have unique IDs.');
  const rules = [], colors = [], typography = [];
  for (const layer of selected) {
    for (const property of STYLE_PROPERTIES) {
      if (TEXT_PROPERTIES.has(property) && layer.type !== 'text') continue;
      const expected = layer[property];
      if (!scalar(expected)) continue;
      rules.push({ id: `${encodeURIComponent(layer.id)}:${property}`, layerId: layer.id, property, expected, kind: 'equals', provenance: 'observed', confidence: 1 });
      if (['fill', 'stroke'].includes(property) && typeof expected === 'string' && expected !== 'none') colors.push(expected);
    }
    if (layer.type === 'text') typography.push(Object.fromEntries([...TEXT_PROPERTIES].filter(property => scalar(layer[property])).map(property => [property, layer[property]])));
    if (layer.type === 'image' && Number.isFinite(layer.width) && Number.isFinite(layer.height) && layer.width > 0 && layer.height > 0) rules.push({ id: `${encodeURIComponent(layer.id)}:aspectRatio`, layerId: layer.id, property: 'aspectRatio', expected: layer.width / layer.height, kind: 'aspectRatio', provenance: 'observed', confidence: 1 });
  }
  return { version: 1, status: 'proposed', provenance: 'observed', scope: { layerIds: selected.map(layer => layer.id) }, rules, tokens: { colors: sortedUnique(colors), typography: sortedUnique(typography.map(value => JSON.stringify(value))).map(value => JSON.parse(value)) } };
}

function assertContract(contract) {
  if (!contract || contract.version !== 1 || !Array.isArray(contract.rules)) throw new Error('Expected a version 1 design rules contract.');
  const seen = new Set();
  for (const rule of contract.rules) {
    if (!rule || typeof rule.id !== 'string' || seen.has(rule.id) || typeof rule.layerId !== 'string' || typeof rule.property !== 'string' || !['equals', 'aspectRatio'].includes(rule.kind) || !scalar(rule.expected)) throw new Error('Invalid or duplicate design rule.');
    if (rule.kind === 'aspectRatio' && (rule.property !== 'aspectRatio' || typeof rule.expected !== 'number' || rule.expected <= 0)) throw new Error('Invalid aspect ratio rule.');
    seen.add(rule.id);
  }
}

export function validateDesign(layers, contract) {
  if (!Array.isArray(layers)) throw new Error('layers must be an array.');
  assertContract(contract);
  const indexed = new Map(layers.filter(layer => layer?.id != null).map(layer => [layer.id, layer]));
  const violations = [];
  const seenIds = new Set();
  for (const layer of layers) {
    if (layer?.id == null) continue;
    if (seenIds.has(layer.id)) violations.push({ ruleId: null, layerId: layer.id, property: 'id', expected: 'unique', actual: layer.id, reason: 'duplicate-layer-id' });
    seenIds.add(layer.id);
  }
  for (const rule of contract.rules) {
    const layer = indexed.get(rule.layerId);
    let actual = null, reason = null;
    if (!layer) reason = 'missing-layer';
    else if (rule.kind === 'aspectRatio') {
      actual = Number.isFinite(layer.width) && Number.isFinite(layer.height) && layer.width > 0 && layer.height > 0 ? layer.width / layer.height : null;
      if (actual === null || Math.abs(actual - rule.expected) > 1e-6 * Math.max(1, Math.abs(rule.expected))) reason = 'aspect-ratio-mismatch';
    } else {
      actual = Object.hasOwn(layer, rule.property) ? layer[rule.property] : null;
      if (!Object.hasOwn(layer, rule.property) || actual !== rule.expected) reason = 'value-mismatch';
    }
    if (reason) violations.push({ ruleId: rule.id, layerId: rule.layerId, property: rule.property, expected: rule.expected, actual, reason });
  }
  return { valid: violations.length === 0, violations };
}

export function exportDesignRules(contract) {
  assertContract(contract);
  const contractJson = JSON.stringify(contract, null, 2);
  const longestFence = Math.max(2, ...[...contractJson.matchAll(/`+/g)].map(match => match[0].length));
  const fence = '`'.repeat(longestFence + 1);
  const colors = Object.fromEntries((contract.tokens?.colors || []).map((color, index) => [`color-${index + 1}`, color]));
  const typography = Object.fromEntries((contract.tokens?.typography || []).map((style, index) => {
    const normalized = {};
    for (const property of ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing']) {
      if (style[property] === undefined) continue;
      normalized[property] = typeof style[property] === 'number' && ['fontSize', 'letterSpacing'].includes(property) ? `${style[property]}px` : typeof style[property] === 'number' && property === 'lineHeight' ? `${style[property]}em` : style[property];
    }
    return [`text-${index + 1}`, normalized];
  }));
  const frontmatter = JSON.stringify({ name: 'Observed design rules', version: 'alpha', colors, typography }, null, 2);
  const designMd = `---\n${frontmatter}\n---\n\n# Overview\n\nThese rules record observed layer properties. They do not prove author intent, original Figma constraints, or universal design-system rules. Status: ${JSON.stringify(contract.status || 'proposed')}. Review the proposal before adopting it.\n\n# Colors\n\nColor tokens enumerate observed paint values; no semantic roles are inferred.\n\n# Typography\n\nText tokens preserve observed styles. Numeric font sizes and letter spacing use pixels; line-height ratios use em.\n\n# Layout\n\nImage aspect ratios are checked where recorded. No responsive or layout relationships are inferred.\n\n# Do's and Don'ts\n\n- Review observed rules before treating them as requirements.\n- Do not interpret this snapshot as source-authored Figma constraints.\n\n## Machine-readable contract\n\n${fence}json\n${contractJson}\n${fence}\n`;
  return { designMd, contractJson };
}
