#!/usr/bin/env node

/**
 * Deterministic fidelity gate for imports generated from a Figma .fig archive.
 *
 * This intentionally parses the source archive again instead of trusting the
 * converter's output. It proves that every directly importable Page 1 node
 * keeps its world-space box, parent, text box and core text metrics. Instance
 * artwork is reported separately because Figma stores it in component masters.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { nodeId, parseFig } from 'openfig-core';
import { selectPage } from './fig_pages.js';
import { expandFigJamNodes } from './figjam_nodes.js';

const [figPath, projectPath] = process.argv.slice(2);
if (!figPath || !projectPath) {
  console.error('Usage: node scripts/verify_fig_import.js <source.fig> <project.figma.json>');
  process.exit(1);
}

const fig = parseFig(new Uint8Array(readFileSync(resolve(figPath))));
const project = JSON.parse(readFileSync(resolve(projectPath), 'utf8'));
const nodes = expandFigJamNodes(fig.nodes || []);
const byId = new Map(nodes.map(node => [nodeId(node), node]));
const imported = new Map((project.layers || []).map(layer => [layer.id, layer]));
const importable = new Set(['CANVAS', 'FRAME', 'SECTION', 'SYMBOL', 'INSTANCE', 'ROUNDED_RECTANGLE', 'RECTANGLE', 'ELLIPSE', 'TEXT', 'LINE', 'VECTOR']);
const page = selectPage(nodes, project.sourcePage?.id);
const pageId = nodeId(page || {});
const epsilon = 0.001;

function parentId(node) {
  const guid = node.parentIndex?.guid;
  return guid ? `${guid.sessionID}:${guid.localID}` : null;
}

function localMatrix(node) {
  const t = node.transform || {};
  return { a: Number.isFinite(t.m00) ? t.m00 : 1, b: Number.isFinite(t.m10) ? t.m10 : 0,
    c: Number.isFinite(t.m01) ? t.m01 : 0, d: Number.isFinite(t.m11) ? t.m11 : 1,
    e: Number.isFinite(t.m02) ? t.m02 : 0, f: Number.isFinite(t.m12) ? t.m12 : 0 };
}

function multiply(a, b) {
  return { a: a.a * b.a + a.c * b.b, b: a.b * b.a + a.d * b.b,
    c: a.a * b.c + a.c * b.d, d: a.b * b.c + a.d * b.d,
    e: a.a * b.e + a.c * b.f + a.e, f: a.b * b.e + a.d * b.f + a.f };
}

const matrices = new Map();
function worldMatrix(id, ancestry = new Set()) {
  if (matrices.has(id)) return matrices.get(id);
  const node = byId.get(id);
  if (!node || ancestry.has(id)) return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  ancestry.add(id);
  const parent = parentId(node);
  const matrix = parent && byId.has(parent) ? multiply(worldMatrix(parent, ancestry), localMatrix(node)) : localMatrix(node);
  ancestry.delete(id);
  matrices.set(id, matrix);
  return matrix;
}

function inPage(node) {
  const seen = new Set();
  let current = node;
  while (current && !seen.has(nodeId(current))) {
    const id = nodeId(current);
    seen.add(id);
    if (current.type === 'CANVAS') return id === pageId;
    current = byId.get(parentId(current));
  }
  return false;
}

function expectedGeometry(node) {
  const matrix = worldMatrix(nodeId(node));
  const width = Number(node.size?.x) || 0;
  const height = Number(node.size?.y) || 0;
  if (node.type === 'LINE') return { x: matrix.e, y: matrix.f, width: matrix.a * width, height: matrix.b * width, rotation: 0 };
  return {
    x: matrix.e, y: matrix.f,
    width: Math.abs(matrix.a) * width + Math.abs(matrix.c) * height,
    height: Math.abs(matrix.b) * width + Math.abs(matrix.d) * height,
    rotation: Math.atan2(matrix.b, matrix.a) * 180 / Math.PI
  };
}

function lineHeight(node) {
  const value = Number(node.lineHeight?.value ?? node.lineHeightPx);
  if (!Number.isFinite(value) || value <= 0) return 1.2;
  const units = String(node.lineHeight?.units || 'PIXELS').toUpperCase();
  return units === 'RAW' ? value : units === 'PERCENT' ? value / 100 : value / Math.max(1, Number(node.fontSize) || 16);
}

function letterSpacing(node) {
  const value = Number(node.letterSpacing?.value);
  if (!Number.isFinite(value)) return 0;
  return String(node.letterSpacing?.units || 'PIXELS').toUpperCase() === 'PERCENT' ? (Number(node.fontSize) || 16) * value / 100 : value;
}

function close(a, b) { return Math.abs(Number(a) - Number(b)) <= epsilon; }
function layerId(id) { return `fig_${id.replace(/[^a-zA-Z0-9]/g, '_')}`; }

const failures = [];
let verifiedGlyphs = 0;
const fontRisks = new Map();
// A CANVAS is Figma's non-visual page root. It intentionally has no size or
// parent and the clone synthesizes its own document root, so it is not a
// geometry contract layer.
const sourceLayers = nodes.filter(node => node.phase !== 'REMOVED' && node.type !== 'CANVAS' && inPage(node) && importable.has(node.type));
for (const node of sourceLayers) {
  const id = layerId(nodeId(node));
  const layer = imported.get(id);
  if (!layer) { failures.push(`${nodeId(node)}: missing layer`); continue; }
  const geometry = expectedGeometry(node);
  for (const key of ['x', 'y', 'width', 'height', 'rotation']) {
    if (!close(layer[key], geometry[key])) failures.push(`${nodeId(node)}: ${key} expected ${geometry[key]}, got ${layer[key]}`);
  }
  const sourceParent = parentId(node);
  const expectedParent = sourceParent ? layerId(sourceParent) : null;
  if ((layer.parentId || null) !== expectedParent) failures.push(`${nodeId(node)}: parent expected ${expectedParent}, got ${layer.parentId}`);
  if (node.type === 'TEXT') {
    const glyphs = node.derivedTextData?.glyphs || [];
    if (glyphs.length !== layer.sourceGlyphs?.length) failures.push(`${nodeId(node)}: glyph count differs`);
    glyphs.forEach((glyph, index) => {
      const actual = layer.sourceGlyphs?.[index];
      if (!actual || !close(actual.x, glyph.position.x) || !close(actual.y, glyph.position.y)
        || !close(actual.fontSize, glyph.fontSize) || actual.firstCharacter !== glyph.firstCharacter) {
        failures.push(`${nodeId(node)}: glyph ${index} positioning differs`);
      } else verifiedGlyphs++;
    });
    if (JSON.stringify(layer.sourceBaselines) !== JSON.stringify(node.derivedTextData?.baselines || [])) failures.push(`${nodeId(node)}: source baselines differ`);
    const expectedText = node.textData?.characters || node.name || 'Text';
    if (layer.text !== expectedText) failures.push(`${nodeId(node)}: text content differs`);
    if (!close(layer.fontSize, Number(node.fontSize) || 16)) failures.push(`${nodeId(node)}: fontSize differs`);
    if ((layer.textAlign || 'left') !== String(node.textAlignHorizontal || 'LEFT').toLowerCase()) failures.push(`${nodeId(node)}: text alignment differs`);
    if (!close(layer.lineHeight, lineHeight(node))) failures.push(`${nodeId(node)}: lineHeight differs`);
    if (!close(layer.letterSpacing, letterSpacing(node))) failures.push(`${nodeId(node)}: letterSpacing differs`);
    const sourceFont = node.fontName?.family || 'Inter';
    if (!/^(arial|inter)$/i.test(sourceFont)) fontRisks.set(sourceFont, (fontRisks.get(sourceFont) || 0) + 1);
  }
}

const report = {
  source: resolve(figPath), project: resolve(projectPath), page: page?.name || null,
  sourceImportableLayers: sourceLayers.length,
  projectLayers: (project.layers || []).length,
  expandedInstanceLayers: (project.layers || []).filter(layer => String(layer.id).startsWith('fig_instance_')).length,
  geometryAndTextFailures: failures,
  verifiedGlyphs,
  sourceFontReferences: Object.fromEntries(fontRisks),
  scope: 'Direct and materialized FigJam layer geometry and saved glyph positions/baselines. FigJam materialization is shared with the importer. Expanded instances are counted, not verified. This is not a pixel comparison.',
  pixelComparisonPerformed: false,
  fidelityCertified: false,
  passed: failures.length === 0
};
console.log(JSON.stringify(report, null, 2));
process.exit(failures.length ? 1 : 0);
