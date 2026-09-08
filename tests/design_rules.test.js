import assert from 'node:assert/strict';
import { extractDesignRules, validateDesign, exportDesignRules } from '../src/engine/design_rules.js';

const layers = [
  { id: 'frame', type: 'frame', fill: '#ffffff', width: 800, height: 600 },
  { id: 'text', type: 'text', parentId: 'frame', fill: '#112233', fontFamily: 'Inter', fontSize: 16, fontWeight: '400', lineHeight: 1.4 },
  { id: 'image', type: 'image', parentId: 'frame', width: 200, height: 100 },
  { id: 'note', type: 'frame', annotationKind: 'sticky', fill: '#ffff00' },
  { id: 'note_text', type: 'text', parentId: 'note', fontSize: 123 },
  { id: 'hidden', type: 'frame', softDeleted: true, fill: '#abcdef' },
  { id: 'hidden_child', type: 'text', parentId: 'hidden', fontSize: 500 }
];
const snapshot = JSON.stringify(layers);
const proposal = extractDesignRules(layers);
assert.equal(JSON.stringify(layers), snapshot);
assert.deepEqual(proposal, extractDesignRules([...layers].reverse()));
assert.equal(proposal.status, 'proposed');
assert.deepEqual(proposal.scope.layerIds, ['frame', 'image', 'text']);
assert.ok(proposal.rules.every(rule => rule.provenance === 'observed' && rule.confidence === 1));
assert.deepEqual(proposal.tokens.colors, ['#112233', '#ffffff']);
assert.deepEqual(extractDesignRules(layers, { ids: ['frame'] }), proposal);
assert.deepEqual(extractDesignRules(layers, { ids: ['note'] }).rules, []);
assert.deepEqual(validateDesign(layers, proposal), { valid: true, violations: [] });
const changed = JSON.parse(snapshot);
changed.find(layer => layer.id === 'text').fontSize = 20;
changed.find(layer => layer.id === 'image').width = 400;
const invalid = validateDesign(changed, proposal);
assert.equal(invalid.valid, false);
assert.deepEqual(invalid.violations.map(item => item.reason), ['aspect-ratio-mismatch', 'value-mismatch']);
changed.find(layer => layer.id === 'image').height = 200;
assert.equal(validateDesign(changed, proposal).violations.length, 1);
const missing = validateDesign(layers.filter(layer => layer.id !== 'image'), proposal);
assert.equal(missing.violations[0].reason, 'missing-layer');
const unrelated = JSON.parse(snapshot); unrelated.push({ id: 'new', fill: '#000000' });
assert.equal(validateDesign(unrelated, proposal).valid, true);
const duplicate = [...changed, ...layers.filter(layer => layer.id === 'text')];
assert.ok(validateDesign(duplicate, proposal).violations.some(item => item.reason === 'duplicate-layer-id'));
assert.throws(() => extractDesignRules(layers, { ids: ['missing'] }), /Unknown/);
assert.throws(() => validateDesign(layers, { version: 1, rules: [{ kind: 'execute' }] }), /Invalid/);
const exported = exportDesignRules(proposal);
assert.deepEqual(JSON.parse(exported.contractJson), proposal);
assert.ok(exported.designMd.startsWith('---\n{'));
const frontmatter = JSON.parse(exported.designMd.split('---\n')[1]);
assert.equal(frontmatter.version, 'alpha');
assert.deepEqual(frontmatter.colors, { 'color-1': '#112233', 'color-2': '#ffffff' });
assert.equal(frontmatter.typography['text-1'].fontSize, '16px');
assert.equal(frontmatter.typography['text-1'].lineHeight, '1.4em');
assert.equal(Object.hasOwn(frontmatter, 'status'), false);
assert.equal(Object.hasOwn(frontmatter.typography['text-1'], 'textAlign'), false);
assert.deepEqual(exportDesignRules(proposal), exported);
const hostile = structuredClone(proposal);
hostile.rules[0].expected = '\n```\n# Untrusted content';
assert.ok(exportDesignRules(hostile).designMd.includes('````json'));
console.log('✓ deterministic observed design rules, annotation exclusion, validation and safe export');
