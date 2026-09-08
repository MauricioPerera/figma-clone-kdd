/**
 * Motor de exportación e importación para Figma Clone KDD.
 * Conforme a knowledge/architecture/state-management.md y contracts/task_export_engine.md
 */

import { getCombinedBounds, getLayerBounds } from './math.js';
import { isLayerEffectivelyVisible, isAnnotationLayer } from './annotations.js';

export function filterDesignLayers(layers, { includeAnnotations = false, allLayers = layers } = {}) {
  return (layers || []).filter(layer => layer && isLayerEffectivelyVisible(layer, allLayers || [])
    && (includeAnnotations || !isAnnotationLayer(layer, allLayers || [])));
}

function svgVector(layer) {
  const paths = (layer.vectorPaths || []).filter(entry => entry.path).map(entry =>
    `<path d="${escapeXml(entry.path)}" fill="${escapeXml(entry.fill || 'none')}" fill-rule="${entry.fillRule === 'evenodd' ? 'evenodd' : 'nonzero'}" />`
  );
  for (const entry of layer.vectorStrokePaths || []) {
    if (!entry.path || !entry.stroke || entry.stroke === 'none') continue;
    const paint = escapeXml(entry.stroke);
    const attributes = entry.outlined
      ? `fill="${paint}" fill-rule="${entry.fillRule === 'evenodd' ? 'evenodd' : 'nonzero'}"`
      : `fill="none" stroke="${paint}" stroke-width="${layer.strokeWidth || 1}"`;
    paths.push(`<path d="${escapeXml(entry.path)}" ${attributes} />`);
  }
  if (!paths.length) throw new Error(`Vector ${layer.id || layer.name} has no exportable path geometry.`);
  return `<g transform="translate(${layer.x} ${layer.y}) scale(${layer.vectorScaleX || 1} ${layer.vectorScaleY || 1})">${paths.join('')}</g>`;
}

function svgImage(layer, index) {
  if (!layer.src) throw new Error(`Image ${layer.id || layer.name} has no source.`);
  if (!/^(data:image\/|https?:\/\/|blob:|\.?\.?\/)/i.test(layer.src)) throw new Error('Unsupported image source URL.');
  const source = escapeXml(layer.src);
  const clipId = `image-clip-${index}-${encodeURIComponent(layer.id || 'layer')}`;
  const clip = `<defs><clipPath id="${clipId}"><rect width="${layer.width}" height="${layer.height}" rx="${layer.cornerRadius || 0}" /></clipPath></defs>`;
  const t = layer.imageTransform;
  const transformed = t && (t.m00 !== 1 || t.m01 !== 0 || t.m02 !== 0 || t.m10 !== 0 || t.m11 !== 1 || t.m12 !== 0);
  if (!transformed) {
    const aspect = layer.imageScaleMode === 'FILL' ? 'xMidYMid slice' : 'none';
    return `<g transform="translate(${layer.x} ${layer.y})">${clip}<image width="${layer.width}" height="${layer.height}" href="${source}" preserveAspectRatio="${aspect}" clip-path="url(#${clipId})" /></g>`;
  }
  const determinant = t.m00 * t.m11 - t.m01 * t.m10;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-8) throw new Error('Image paint transform is singular or invalid.');
  const matrix = [t.m11 / determinant, -t.m10 / determinant, -t.m01 / determinant, t.m00 / determinant,
    (t.m01 * t.m12 - t.m11 * t.m02) / determinant * layer.width,
    (t.m10 * t.m02 - t.m00 * t.m12) / determinant * layer.height];
  if (!matrix.every(Number.isFinite)) throw new Error('Image paint transform is invalid.');
  return `<g transform="translate(${layer.x} ${layer.y})">${clip}<g clip-path="url(#${clipId})"><image width="${layer.width}" height="${layer.height}" href="${source}" preserveAspectRatio="none" transform="matrix(${matrix.join(' ')})" /></g></g>`;
}

export function exportToSVG(layers, customBounds = null, options = {}) {
  layers = filterDesignLayers(layers, options);
  const bounds = customBounds || getCombinedBounds(layers) || { x: 0, y: 0, width: 800, height: 600 };
  const w = Math.max(10, Math.round(bounds.width));
  const h = Math.max(10, Math.round(bounds.height));

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bounds.x} ${bounds.y} ${w} ${h}" width="${w}" height="${h}">\n`;
  svg += `  <defs>\n`;
  svg += `    <filter id="drop-shadow" x="-20%" y="-20%" width="140%" height="140%">\n`;
  svg += `      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.3" />\n`;
  svg += `    </filter>\n`;
  svg += `  </defs>\n`;

  for (const [index, layer] of (layers || []).entries()) {
    const transform = layer.rotation ? ` transform="rotate(${layer.rotation}, ${layer.x + layer.width / 2}, ${layer.y + layer.height / 2})"` : '';
    const opacity = layer.opacity !== undefined && layer.opacity < 1 ? ` opacity="${layer.opacity}"` : '';
    const shadowAttr = layer.shadow ? ` filter="url(#drop-shadow)"` : '';
    const strokeAttr = layer.stroke && layer.stroke !== 'none' ? ` stroke="${layer.stroke}" stroke-width="${layer.strokeWidth || 1}"` : '';

    switch (layer.type) {
      case 'image':
        svg += `<g${transform}${opacity}${shadowAttr}>${svgImage(layer, index)}</g>\n`;
        break;
      case 'vector':
        svg += `<g${transform}${opacity}${shadowAttr}>${svgVector(layer)}</g>\n`;
        break;
      case 'frame':
      case 'rect': {
        const rx = layer.cornerRadius ? ` rx="${layer.cornerRadius}" ry="${layer.cornerRadius}"` : '';
        const fill = layer.fill && layer.fill !== 'none' ? ` fill="${layer.fill}"` : ' fill="none"';
        svg += `  <rect x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}"${rx}${fill}${strokeAttr}${opacity}${shadowAttr}${transform} />\n`;
        break;
      }
      case 'circle': {
        const cx = layer.x + layer.width / 2;
        const cy = layer.y + layer.height / 2;
        const rx = layer.width / 2;
        const ry = layer.height / 2;
        const fill = layer.fill && layer.fill !== 'none' ? ` fill="${layer.fill}"` : ' fill="none"';
        svg += `  <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"${fill}${strokeAttr}${opacity}${shadowAttr}${transform} />\n`;
        break;
      }
      case 'polygon': {
        const cx = layer.x + layer.width / 2;
        const cy = layer.y + layer.height / 2;
        const rx = layer.width / 2;
        const ry = layer.height / 2;
        const points = [];
        for (let i = 0; i < 3; i++) {
          const angle = (i * 2 * Math.PI) / 3 - Math.PI / 2;
          points.push(`${cx + rx * Math.cos(angle)},${cy + ry * Math.sin(angle)}`);
        }
        const fill = layer.fill && layer.fill !== 'none' ? ` fill="${layer.fill}"` : ' fill="none"';
        svg += `  <polygon points="${points.join(' ')}"${fill}${strokeAttr}${opacity}${shadowAttr}${transform} />\n`;
        break;
      }
      case 'star': {
        const cx = layer.x + layer.width / 2;
        const cy = layer.y + layer.height / 2;
        const rx = layer.width / 2;
        const ry = layer.height / 2;
        const points = [];
        for (let i = 0; i < 10; i++) {
          const angle = (i * Math.PI) / 5 - Math.PI / 2;
          const radius = i % 2 === 0 ? 1 : 0.45;
          points.push(`${cx + rx * radius * Math.cos(angle)},${cy + ry * radius * Math.sin(angle)}`);
        }
        const fill = layer.fill && layer.fill !== 'none' ? ` fill="${layer.fill}"` : ' fill="none"';
        svg += `  <polygon points="${points.join(' ')}"${fill}${strokeAttr}${opacity}${shadowAttr}${transform} />\n`;
        break;
      }
      case 'line':
      case 'arrow': {
        const x1 = layer.x;
        const y1 = layer.y;
        const x2 = layer.x + layer.width;
        const y2 = layer.y + layer.height;
        const strokeColor = layer.stroke && layer.stroke !== 'none' ? layer.stroke : (layer.fill && layer.fill !== 'none' ? layer.fill : '#ffffff');
        const marker = layer.type === 'arrow' ? ` marker-end="url(#arrow-${index})"` : '';
        if (marker) svg += `<defs><marker id="arrow-${index}" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="strokeWidth"><path d="M0 0 L10 5 L0 10 Z" fill="${escapeXml(strokeColor)}" /></marker></defs>`;
        svg += `  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${strokeColor}" stroke-width="${layer.strokeWidth || 2}" stroke-linecap="round"${marker}${opacity}${transform} />\n`;
        break;
      }
      default:
        throw new Error(`Unsupported SVG layer type: ${layer.type}`);
      case 'text': {
        const fill = layer.fill && layer.fill !== 'none' ? ` fill="${layer.fill}"` : ' fill="#ffffff"';
        const fontSize = ` font-size="${layer.fontSize || 16}"`;
        const fontFamily = ` font-family="${layer.fontFamily || 'Inter, sans-serif'}"`;
        const fontWeight = ` font-weight="${layer.fontWeight || 'normal'}"`;
        const textAnchor = layer.textAlign === 'center' ? ' text-anchor="middle"' : (layer.textAlign === 'right' ? ' text-anchor="end"' : '');
        let startX = layer.x;
        if (layer.textAlign === 'center') startX = layer.x + layer.width / 2;
        else if (layer.textAlign === 'right') startX = layer.x + layer.width;

        const lines = (layer.text || 'Text').split('\n');
        svg += `  <text x="${startX}" y="${layer.y + (layer.fontSize || 16)}"${fill}${fontSize}${fontFamily}${fontWeight}${textAnchor}${opacity}${transform}>\n`;
        for (let i = 0; i < lines.length; i++) {
          const dy = i === 0 ? '0' : '1.3em';
          svg += `    <tspan x="${startX}" dy="${dy}">${escapeXml(lines[i])}</tspan>\n`;
        }
        svg += `  </text>\n`;
        break;
      }
    }
  }

  svg += `</svg>`;
  return svg;
}

export function exportToPNG(canvas, layers, scale = 2, options = {}) {
  layers = filterDesignLayers(layers, options);
  const bounds = getCombinedBounds(layers) || { x: 0, y: 0, width: canvas.width, height: canvas.height };
  const offscreen = document.createElement('canvas');
  offscreen.width = Math.max(1, Math.round(bounds.width * scale));
  offscreen.height = Math.max(1, Math.round(bounds.height * scale));
  const ctx = offscreen.getContext('2d');

  ctx.scale(scale, scale);
  ctx.translate(-bounds.x, -bounds.y);

  // Fondo transparente o sutil
  for (const layer of layers) {
    if (!layer.visible) continue;
    // Usar renderizado básico
    ctx.save();
    ctx.fillStyle = layer.fill && layer.fill !== 'none' ? layer.fill : '#3b82f6';
    if (layer.type === 'rect' || layer.type === 'frame') {
      const r = layer.cornerRadius || 0;
      if (r > 0 && ctx.roundRect) {
        ctx.roundRect(layer.x, layer.y, layer.width, layer.height, r);
      } else {
        ctx.rect(layer.x, layer.y, layer.width, layer.height);
      }
      ctx.fill();
    } else if (layer.type === 'circle') {
      ctx.beginPath();
      ctx.ellipse(layer.x + layer.width / 2, layer.y + layer.height / 2, layer.width / 2, layer.height / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (layer.type === 'text') {
      ctx.font = `${layer.fontWeight || '400'} ${layer.fontSize || 16}px ${layer.fontFamily || 'sans-serif'}`;
      ctx.fillStyle = layer.fill || '#ffffff';
      ctx.fillText(layer.text || '', layer.x, layer.y + (layer.fontSize || 16));
    }
    ctx.restore();
  }

  const dataUrl = offscreen.toDataURL('image/png');
  downloadFile('design.png', dataUrl, true);
}

export function serializeProject(store) {
  return structuredClone({
    version: '1.0.0',
    title: store.state.title,
    exportedAt: new Date().toISOString(),
    viewport: store.state.viewport,
    settings: store.state.settings,
    layers: store.state.layers,
    designContract: store.state.designContract || store.state.designContractProposal || null
  });
}

export function exportToJSON(store) {
  const doc = serializeProject(store);
  const jsonStr = JSON.stringify(doc, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  downloadFile(`${store.state.title.toLowerCase().replace(/\s+/g, '_')}.figma.json`, url);
}

export function importFromJSON(jsonString, store) {
  try {
    const data = JSON.parse(jsonString);
    if (!data.layers || !Array.isArray(data.layers)) {
      throw new Error('El archivo no contiene un array de capas válido.');
    }
    store.loadState(data);
    return { success: true, count: data.layers.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export function layerToTailwind(layer, options = {}) {
  if (!layer) return '<!-- Selecciona un elemento para ver su código Tailwind -->';
  if (filterDesignLayers([layer], options).length === 0) return '';
  if (layer.type === 'image' || layer.type === 'vector') return exportToSVG([layer], null, options);

  const classes = [];

  // Dimensiones
  classes.push(`w-[${Math.round(layer.width)}px]`);
  classes.push(`h-[${Math.round(layer.height)}px]`);

  // Posición relativa o absoluta
  classes.push('relative');

  // Relleno / Background
  if (layer.fill && layer.fill !== 'none') {
    classes.push(`bg-[${layer.fill}]`);
  }

  // Border & Radius
  if (layer.cornerRadius && layer.cornerRadius > 0) {
    if (layer.cornerRadius >= 999) classes.push('rounded-full');
    else if (layer.cornerRadius >= 24) classes.push('rounded-3xl');
    else if (layer.cornerRadius >= 16) classes.push('rounded-2xl');
    else if (layer.cornerRadius >= 12) classes.push('rounded-xl');
    else if (layer.cornerRadius >= 8) classes.push('rounded-lg');
    else classes.push(`rounded-[${layer.cornerRadius}px]`);
  }

  // Stroke / Borde
  if (layer.stroke && layer.stroke !== 'none') {
    const sw = layer.strokeWidth || 1;
    classes.push(sw === 1 ? 'border' : `border-[${sw}px]`);
    classes.push(`border-[${layer.stroke}]`);
    if (layer.strokeDash === 'dashed') classes.push('border-dashed');
  }

  // Sombra / Shadow
  if (layer.shadow) {
    classes.push('shadow-xl');
  }

  // Opacity
  if (layer.opacity !== undefined && layer.opacity < 1) {
    classes.push(`opacity-${Math.round(layer.opacity * 100)}`);
  }

  if (layer.type === 'text') {
    classes.push(`text-[${layer.fill || '#ffffff'}]`);
    classes.push(`text-[${layer.fontSize || 16}px]`);
    if (layer.fontWeight === '700' || layer.fontWeight === 'bold') classes.push('font-bold');
    else if (layer.fontWeight === '600') classes.push('font-semibold');
    else if (layer.fontWeight === '500') classes.push('font-medium');
    if (layer.textAlign === 'center') classes.push('text-center');
    else if (layer.textAlign === 'right') classes.push('text-right');
    return `<div class="${classes.join(' ')} flex items-center">\n  ${escapeXml(layer.text || '')}\n</div>`;
  }

  if (layer.type === 'frame') {
    classes.push('overflow-hidden', 'flex', 'flex-col');
    return `<div class="${classes.join(' ')}">\n  <!-- Contenido del Frame: ${layer.name} -->\n</div>`;
  }

  return `<div class="${classes.join(' ')}"></div>`;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function downloadFile(filename, urlOrDataUrl, isDataUrl = false) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = urlOrDataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  if (!isDataUrl && urlOrDataUrl.startsWith('blob:')) {
    URL.revokeObjectURL(urlOrDataUrl);
  }
}
