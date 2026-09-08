#!/usr/bin/env node

/**
 * Converts a local Figma .fig ZIP into the JSON project format used by this
 * static clone. It deliberately retains unsupported vector nodes as labeled
 * outlines, so the document's structure remains editable instead of silently
 * dropping content.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, resolve } from 'node:path';
import { unzipSync } from 'fflate';
import { nodeId, parseFig, resolveVectorNodePaths } from 'openfig-core';
import { extractGlyphs } from './fig_glyphs.js';
import { selectPage } from './fig_pages.js';
import { expandFigJamNodes } from './figjam_nodes.js';
import { extractRenderableGradientFill, resolveGradientGeometry } from 'openfig-core';
import { createHash } from 'node:crypto';

const [inputPath, outputPath, assetPublicBase, requestedPage] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  console.error('Usage: node scripts/convert_fig_to_project.js <input.fig> <output.figma.json> [asset-public-base]');
  process.exit(1);
}

const inputBytes = new Uint8Array(readFileSync(resolve(inputPath)));
const figArchive = unzipSync(inputBytes);
const fig = parseFig(inputBytes);
const sourceNodes = expandFigJamNodes(fig.nodes || []);
const sourceToLayerId = new Map();
const layers = [];
const warnings = [];
const outputFile = resolve(outputPath);
const projectSlug = basename(outputFile, extname(outputFile)).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
const assetFolder = resolve(dirname(outputFile), 'assets', projectSlug);
const publicAssetBase = (assetPublicBase || `./assets/${projectSlug}`).replace(/\/$/, '');

function imageHash(image) {
  const bytes = Object.values(image?.hash || {});
  return bytes.length ? bytes.map(value => Number(value).toString(16).padStart(2, '0')).join('') : null;
}

function extractImageAssets() {
  const extracted = new Map();
  const imageEntries = Object.entries(figArchive).filter(([path]) => path.startsWith('images/'));
  if (imageEntries.length) mkdirSync(assetFolder, { recursive: true });
  for (const [path, bytes] of imageEntries) {
    const hash = path.slice('images/'.length);
    if (!hash || !bytes?.length) continue;
    const filename = `${hash}.png`;
    writeFileSync(resolve(assetFolder, filename), bytes);
    extracted.set(hash, `${publicAssetBase}/${filename}`);
  }
  return extracted;
}

const extractedImages = extractImageAssets();

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function toHex(color) {
  const channel = value => Math.round(clamp(value) * 255).toString(16).padStart(2, '0');
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
}

function firstPaint(paints) {
  return (paints || []).find(paint => paint && paint.visible !== false && paint.type === 'SOLID') || null;
}

function paintColor(paints, fallback = 'none') {
  const paint = firstPaint(paints);
  if (!paint?.color) return fallback;
  const alpha = clamp((paint.color.a ?? 1) * (paint.opacity ?? 1));
  if (alpha < 1) {
    const { r, g, b } = paint.color;
    return `rgba(${Math.round(clamp(r) * 255)}, ${Math.round(clamp(g) * 255)}, ${Math.round(clamp(b) * 255)}, ${alpha.toFixed(3)})`;
  }
  return toHex(paint.color);
}

function imagePaint(paints) {
  return (paints || []).find(paint => paint?.visible !== false && paint.type === 'IMAGE' && imageHash(paint.image)) || null;
}

function parentSourceId(node) {
  const guid = node.parentIndex?.guid;
  return guid ? `${guid.sessionID}:${guid.localID}` : null;
}

function localTransform(node) {
  const matrix = node.transform || {};
  return {
    a: Number.isFinite(matrix.m00) ? matrix.m00 : 1,
    b: Number.isFinite(matrix.m10) ? matrix.m10 : 0,
    c: Number.isFinite(matrix.m01) ? matrix.m01 : 0,
    d: Number.isFinite(matrix.m11) ? matrix.m11 : 1,
    e: Number.isFinite(matrix.m02) ? matrix.m02 : 0,
    f: Number.isFinite(matrix.m12) ? matrix.m12 : 0
  };
}

function multiply(parent, child) {
  return {
    a: parent.a * child.a + parent.c * child.b,
    b: parent.b * child.a + parent.d * child.b,
    c: parent.a * child.c + parent.c * child.d,
    d: parent.b * child.c + parent.d * child.d,
    e: parent.a * child.e + parent.c * child.f + parent.e,
    f: parent.b * child.e + parent.d * child.f + parent.f
  };
}

const nodeById = new Map(sourceNodes.map(node => [nodeId(node), node]));
// A .fig file keeps reusable component masters on a separate, hidden canvas.
// Importing those masters verbatim creates off-page "garbage" layers in the
// clone. Keep the real page editable and materialize only the visible instance
// artwork from the internal canvas below.
const selectedPage = selectPage(sourceNodes, requestedPage);
const visibleCanvasId = nodeId(selectedPage);
function belongsToVisibleCanvas(node) {
  let current = node;
  const seen = new Set();
  while (current && !seen.has(nodeId(current))) {
    const currentId = nodeId(current);
    seen.add(currentId);
    if (current.type === 'CANVAS') return currentId === visibleCanvasId;
    const parentId = parentSourceId(current);
    current = parentId ? nodeById.get(parentId) : null;
  }
  return false;
}
const worldMatrices = new Map();
function worldTransform(id, visiting = new Set()) {
  if (worldMatrices.has(id)) return worldMatrices.get(id);
  const node = nodeById.get(id);
  if (!node || visiting.has(id)) return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  visiting.add(id);
  const parentId = parentSourceId(node);
  const result = parentId && nodeById.has(parentId)
    ? multiply(worldTransform(parentId, visiting), localTransform(node))
    : localTransform(node);
  visiting.delete(id);
  worldMatrices.set(id, result);
  return result;
}

function nodeGeometry(node) {
  const matrix = worldTransform(nodeId(node));
  return geometryFromMatrix(node, matrix);
}

function geometryFromMatrix(node, matrix) {
  const size = node.size || {};
  const rawWidth = Math.max(0, Number(size.x) || 0);
  const rawHeight = Math.max(0, Number(size.y) || 0);
  const width = Math.abs(matrix.a) * rawWidth + Math.abs(matrix.c) * rawHeight;
  const height = Math.abs(matrix.b) * rawWidth + Math.abs(matrix.d) * rawHeight;
  const rotation = Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
  return { x: matrix.e, y: matrix.f, width, height, rotation };
}

function lineGeometry(node) {
  const matrix = worldTransform(nodeId(node));
  const length = Number(node.size?.x) || 0;
  // A Figma LINE is the local segment [0, 0] -> [width, 0]. Preserve its
  // transformed endpoints rather than converting a rotated bounding box back
  // into a rotated line (which rotates it twice in the canvas renderer).
  return {
    x: matrix.e,
    y: matrix.f,
    width: matrix.a * length,
    height: matrix.b * length,
    rotation: 0
  };
}

function nodeType(node) {
  if (node.type === 'ELLIPSE') return 'circle';
  if (node.type === 'TEXT') return 'text';
  if (node.type === 'LINE') return 'line';
  if (['FRAME', 'SECTION', 'CANVAS', 'SYMBOL', 'INSTANCE'].includes(node.type)) return 'frame';
  if (node.type === 'VECTOR') return 'vector';
  return 'rect';
}

function fontWeight(node) {
  const style = `${node.fontName?.style || ''} ${node.fontWeight || ''}`.toLowerCase();
  if (style.includes('thin')) return '100';
  if (style.includes('extra light') || style.includes('extralight')) return '200';
  if (style.includes('light')) return '300';
  if (style.includes('medium')) return '500';
  if (style.includes('semi') || style.includes('demi')) return '600';
  if (style.includes('extra') || style.includes('black') || style.includes('heavy')) return '800';
  if (style.includes('bold')) return '700';
  return '400';
}

// Font names are references, not embedded files, in a .fig export. The
// document requests proprietary BBVA and Tiempos faces, neither of which is
// present on this machine. Without an explicit generic fallback, Canvas falls
// back to a serif browser default and changes every text measurement/column
// wrap. Keep the source family when it is installed, with a metric-appropriate
// local fallback for a deterministic import.
function resolvedFontFamily(node) {
  const family = node.fontName?.family || 'Inter';
  if (/benton/i.test(family)) return 'Arial, Helvetica, sans-serif';
  // Tiempos Headline is appreciably narrower than Georgia at the same size;
  // Times preserves the line count recorded in this file's fixed text boxes.
  if (/tiempos/i.test(family)) return '"Times New Roman", Times, serif';
  if (/merriweather/i.test(family)) return 'Georgia, "Times New Roman", serif';
  if (/arial/i.test(family)) return 'Arial, Helvetica, sans-serif';
  return `${family}, sans-serif`;
}

function textLineHeight(node) {
  const value = Number(node.lineHeight?.value ?? node.lineHeightPx);
  if (!Number.isFinite(value) || value <= 0) return 1.2;
  const units = String(node.lineHeight?.units || 'PIXELS').toUpperCase();
  if (units === 'RAW') return value;
  if (units === 'PERCENT') return value / 100;
  return value / Math.max(1, Number(node.fontSize) || 16);
}

function textLetterSpacing(node) {
  const value = Number(node.letterSpacing?.value);
  if (!Number.isFinite(value)) return 0;
  return String(node.letterSpacing?.units || 'PIXELS').toUpperCase() === 'PERCENT'
    ? (Number(node.fontSize) || 16) * value / 100
    : value;
}

const importable = new Set(['CANVAS', 'FRAME', 'SECTION', 'SYMBOL', 'INSTANCE', 'ROUNDED_RECTANGLE', 'RECTANGLE', 'ELLIPSE', 'TEXT', 'LINE', 'VECTOR']);
for (const node of sourceNodes) {
  if (!belongsToVisibleCanvas(node)) continue;
  if (node.phase === 'REMOVED') continue;
  if (!importable.has(node.type)) {
    warnings.push(`Unsupported node ${nodeId(node)} (${node.type}): ${node.name || ''}`);
    continue;
  }
  if ((node.fillPaints || []).some(paint => paint.visible !== false && !['SOLID', 'IMAGE', 'GRADIENT_LINEAR'].includes(paint.type))) warnings.push(`Unsupported fill on ${nodeId(node)}`);
  if (node.effects?.length) warnings.push(`Effects not reproduced on ${nodeId(node)}`);
  if (node.isMask) warnings.push(`Mask not reproduced on ${nodeId(node)}`);
  const sourceId = nodeId(node);
  const parentId = parentSourceId(node);
  const layerId = `fig_${sourceId.replace(/[^a-zA-Z0-9]/g, '_')}`;
  sourceToLayerId.set(sourceId, layerId);

  const geometry = node.type === 'LINE' ? lineGeometry(node) : nodeGeometry(node);
  const resolvedImagePaint = imagePaint(node.fillPaints);
  const imageHashValue = resolvedImagePaint ? imageHash(resolvedImagePaint.image) : null;
  const imageSource = imageHashValue ? extractedImages.get(imageHashValue) : null;
  const isVector = node.type === 'VECTOR';
  const layer = {
    id: layerId,
    ...(node.sourceNodeType ? {sourceNodeType:node.sourceNodeType, sourceNodeId:node.sourceFigJamId || sourceId} : {}),
    ...(node.annotationKind ? {annotationKind:node.annotationKind} : {}),
    ...(node.annotationSourceRootId ? {annotationRootId:`fig_${node.annotationSourceRootId.replace(/[^a-zA-Z0-9]/g, '_')}`} : {}),
    name: node.name || node.type,
    type: imageSource ? 'image' : nodeType(node),
    ...geometry,
    opacity: clamp(node.opacity ?? 1),
    visible: node.visible !== false,
    locked: node.locked === true,
    parentId: parentId ? (sourceToLayerId.get(parentId) || null) : null,
    fill: isVector ? 'none' : paintColor(node.fillPaints, node.type === 'TEXT' ? '#111827' : 'none'),
    stroke: paintColor(node.strokePaints, isVector || node.type === 'LINE' ? '#64748b' : 'none'),
    strokeWidth: Number.isFinite(node.strokeWeight) ? Math.max(0, node.strokeWeight) : 1,
    cornerRadius: Math.max(0, Number(node.cornerRadius ?? node.cornerRadiusValues?.[0]) || 0),
    clipContent: ['FRAME', 'SYMBOL', 'INSTANCE'].includes(node.type)
      && node.resizeToFit !== true
      && node.frameMaskDisabled !== true,
    showLabel: !['FRAME', 'SECTION', 'CANVAS', 'SYMBOL', 'INSTANCE'].includes(node.type)
  };

  if (imageSource) {
    layer.src = imageSource;
    layer.imageScaleMode = resolvedImagePaint.imageScaleMode || 'STRETCH';
    layer.imageTransform = resolvedImagePaint.transform || null;
  } else if (resolvedImagePaint) {
    warnings.push(`Image "${node.name || sourceId}" was referenced but its embedded asset ${imageHashValue} was not found.`);
  }

  const gradient = extractRenderableGradientFill(node.fillPaints);
  if (gradient?.type === 'linear') {
    const geometry = resolveGradientGeometry(gradient, layer.width, layer.height);
    if (geometry) {
      layer.fillGradient = {...geometry, stops:gradient.stops.map(stop => ({position:stop.position,color:paintColor([{type:'SOLID',color:stop.color,opacity:gradient.opacity}])}))};
      layer.fill = layer.fillGradient.stops[0]?.color || layer.fill;
    } else warnings.push(`Invalid gradient on ${sourceId}`);
  }

  if (node.type === 'TEXT') {
    layer.text = node.textData?.characters || node.name || 'Text';
    layer.fontSize = Math.max(1, Number(node.fontSize) || 16);
    layer.fontFamily = resolvedFontFamily(node);
    layer.fontWeight = fontWeight(node);
    layer.textAlign = String(node.textAlignHorizontal || 'LEFT').toLowerCase();
    layer.lineHeight = textLineHeight(node);
    layer.letterSpacing = textLetterSpacing(node);
    layer.sourceGlyphs = extractGlyphs(fig, node);
    if (!layer.sourceGlyphs.length && layer.text.trim()) warnings.push(`Text ${sourceId} has no saved glyphs; font-dependent fallback required`);
    layer.sourceText = layer.text;
    layer.sourceTextStyle = JSON.stringify([layer.fontSize, layer.fontFamily, layer.fontWeight, layer.textAlign, layer.lineHeight, layer.letterSpacing, layer.width, layer.height]);
    layer.sourceBaselines = node.derivedTextData?.baselines || [];
  }
  if (node.type === 'SECTION') layer.sectionType = 'section';
  if (isVector) {
    const paths = resolveVectorNodePaths(fig, node);
    layer.vectorPaths = paths.fill.map(path => ({ path: path.svgPath, fill: paintColor(path.paints, paintColor(node.fillPaints, '#111827')) }));
    layer.vectorStrokePaths = paths.stroke.map(path => ({ path: path.svgPath, outlined: true, fillRule: path.windingRule === 'ODD' ? 'evenodd' : 'nonzero', stroke: paintColor(path.paints, paintColor(node.strokePaints, 'none')) }));
    if (layer.vectorPaths.length === 0 && layer.vectorStrokePaths.length === 0) {
      layer.type = 'rect';
      layer.name = `${layer.name} (vector without path)`;
      warnings.push(`Vector "${node.name || sourceId}" has no resolvable path geometry.`);
    }
  }
  layers.push(layer);
}

// Parents can appear after children in a Figma file. Resolve them once all IDs exist.
for (const layer of layers) {
  const source = sourceNodes.find(node => `fig_${nodeId(node).replace(/[^a-zA-Z0-9]/g, '_')}` === layer.id);
  const parentId = source ? parentSourceId(source) : null;
  layer.parentId = parentId ? (sourceToLayerId.get(parentId) || null) : null;
}

// Figma instances point at a component master instead of repeating every child
// in the document tree. The former importer retained only their empty wrapper,
// which dropped component artwork (the hero image, logos and small icons).
// Expand visible instance descendants with their local scale and transform.
const instanceExpansionIds = new Set();
function symbolId(instance) {
  const guid = instance.symbolData?.symbolID;
  return guid ? `${guid.sessionID}:${guid.localID}` : null;
}

function scaleMatrix(width, height, master) {
  const masterWidth = Math.max(1, Number(master.size?.x) || 1);
  const masterHeight = Math.max(1, Number(master.size?.y) || 1);
  return { a: width / masterWidth, b: 0, c: 0, d: height / masterHeight, e: 0, f: 0 };
}

function appendInstanceArtwork(instance, instanceMatrix, trail = [], depth = 0) {
  if (depth > 12) return;
  const masterId = symbolId(instance);
  const master = masterId ? nodeById.get(masterId) : null;
  if (!master || trail.includes(masterId)) return;
  const baseMatrix = multiply(instanceMatrix, scaleMatrix(instance.size?.x || 1, instance.size?.y || 1, master));
  const nextTrail = [...trail, masterId];

  function walk(masterNode, matrix, path) {
    const children = fig.childrenMap.get(nodeId(masterNode)) || [];
    for (const child of children) {
      if (child.visible === false) continue;
      const childMatrix = multiply(matrix, localTransform(child));
      const childPath = [...path, nodeId(child)];
      if (child.type === 'INSTANCE') {
        appendInstanceArtwork(child, childMatrix, nextTrail, depth + 1);
        continue;
      }
      const paint = imagePaint(child.fillPaints);
      const hash = paint ? imageHash(paint.image) : null;
      const imageSource = hash ? extractedImages.get(hash) : null;
      const geometry = geometryFromMatrix(child, childMatrix);
      const id = `fig_instance_${nodeId(instance).replace(/[^a-zA-Z0-9]/g, '_')}_${childPath.join('_').replace(/[^a-zA-Z0-9]/g, '_')}`;
      if (instanceExpansionIds.has(id)) continue;

      if (imageSource) {
        instanceExpansionIds.add(id);
        layers.push({
          id,
          name: child.name || instance.name || 'Instance artwork',
          type: 'image',
          ...geometry,
          opacity: clamp((instance.opacity ?? 1) * (child.opacity ?? 1)),
          visible: true,
          locked: instance.locked === true,
          parentId: null,
          fill: 'none',
          stroke: 'none',
          cornerRadius: Math.max(0, Number(child.cornerRadius) || 0),
          src: imageSource,
          imageScaleMode: paint.imageScaleMode || 'STRETCH',
          imageTransform: paint.transform || null,
          showLabel: false
        });
      } else if (child.type === 'VECTOR') {
        const paths = resolveVectorNodePaths(fig, child);
        if (paths.fill.length || paths.stroke.length) {
          instanceExpansionIds.add(id);
          layers.push({
            id,
            name: child.name || instance.name || 'Instance vector',
            type: 'vector',
            ...geometry,
            opacity: clamp((instance.opacity ?? 1) * (child.opacity ?? 1)),
            visible: true,
            locked: instance.locked === true,
            parentId: null,
            fill: 'none',
            stroke: paintColor(child.strokePaints, 'none'),
            strokeWidth: Math.max(1, Number(child.strokeWeight) || 1),
            vectorScaleX: Math.hypot(childMatrix.a, childMatrix.b),
            vectorScaleY: Math.hypot(childMatrix.c, childMatrix.d),
            vectorPaths: paths.fill.map(path => ({ path: path.svgPath, fill: paintColor(path.paints, paintColor(child.fillPaints, '#111827')) })),
            vectorStrokePaths: paths.stroke.map(path => ({ path: path.svgPath, outlined: true, fillRule: path.windingRule === 'ODD' ? 'evenodd' : 'nonzero', stroke: paintColor(path.paints, paintColor(child.strokePaints, 'none')) }))
          });
        }
      }
      walk(child, childMatrix, childPath);
    }
  }

  walk(master, baseMatrix, [masterId]);
}

for (const instance of sourceNodes.filter(node => node.phase !== 'REMOVED' && node.type === 'INSTANCE' && node.visible !== false && belongsToVisibleCanvas(node))) {
  appendInstanceArtwork(instance, worldTransform(nodeId(instance)));
}

const metadata = fig.meta || {};
const title = basename(inputPath, extname(inputPath));
const sourceFontUsage = Object.fromEntries(
  sourceNodes
    .filter(node => belongsToVisibleCanvas(node) && node.type === 'TEXT')
    .reduce((usage, node) => {
      const family = node.fontName?.family || 'Inter';
      usage.set(family, (usage.get(family) || 0) + 1);
      return usage;
    }, new Map())
);
const project = {
  version: '1.0.0',
  title,
  sourceSha256: createHash('sha256').update(inputBytes).digest('hex'),
  sourcePage: { id: visibleCanvasId, name: selectedPage.name },
  importSource: 'Figma .fig',
  viewport: { panX: 120, panY: 80, zoom: 0.3 },
  settings: { gridEnabled: true, snapToGrid: false, snapGuides: true, rulersVisible: true },
  layers,
  importReport: {
    sourceNodeCount: sourceNodes.length,
    importedLayerCount: layers.length,
    unsupportedNodeCount: sourceNodes.filter(node => belongsToVisibleCanvas(node) && !importable.has(node.type) && node.phase !== 'REMOVED').length,
    fidelity: warnings.length ? 'partial' : 'unverified-visual',
    sourceFontUsage,
    // .fig stores font references, not proprietary font files. Persist this
    // explicitly so consumers can distinguish a font-metric difference from
    // a layout-coordinate regression.
    textMetricsRequireSourceFonts: Object.keys(sourceFontUsage).filter(family => !/^(arial|inter)$/i.test(family)),
    warnings,
    metadata
  }
};

mkdirSync(dirname(outputFile), { recursive: true });
writeFileSync(outputFile, `${JSON.stringify(project, null, 2)}\n`);
console.log(JSON.stringify({ title, layers: layers.length, images: extractedImages.size, warnings: warnings.length, output: outputFile }, null, 2));
