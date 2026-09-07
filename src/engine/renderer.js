/**
 * Renderizador de lienzo vectorial para Figma Clone KDD.
 * Conforme a knowledge/architecture/canvas-engine.md
 */

import { getLayerBounds, getCombinedBounds, rotatePoint } from './math.js';

export class CanvasRenderer {
  constructor(canvas, store) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.store = store;
    this.dpr = window.devicePixelRatio || 1;
    this.imageCache = new Map();
  }

  resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const width = parent.clientWidth;
    const height = parent.clientHeight;
    this.dpr = window.devicePixelRatio || 1;

    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
  }

  render(extra = {}) {
    const { marquee, smartGuides, hoverHandle } = extra;
    const { ctx, canvas, dpr } = this;
    const { viewport, layers, selectedIds, settings } = this.store.state;

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Limpiar fondo del lienzo
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    ctx.fillStyle = '#1e1e1e'; // Figma dark canvas background
    ctx.fillRect(0, 0, width, height);

    // 2. Dibujar cuadrícula si está activa
    if (settings.gridEnabled) {
      this.drawDotGrid(width, height, viewport);
    }

    // 3. Aplicar transformación de cámara (Pan & Zoom)
    ctx.save();
    ctx.translate(viewport.panX, viewport.panY);
    ctx.scale(viewport.zoom, viewport.zoom);

    // 4. Dibujar capas ordenadas (Frames primero como contenedores)
    for (const layer of layers) {
      if (!layer.visible) continue;
      this.drawLayer(ctx, layer, selectedIds.includes(layer.id));
    }

    // 5. Dibujar guías inteligentes (Smart Guides)
    if (smartGuides && smartGuides.length > 0) {
      this.drawSmartGuides(ctx, smartGuides, viewport);
    }

    // 6. Dibujar gizmo de selección activa
    const selectedLayers = this.store.getSelectedLayers();
    if (selectedLayers.length > 0) {
      this.drawSelectionGizmo(ctx, selectedLayers, viewport, hoverHandle);
    }

    ctx.restore(); // Restaurar espacio de cámara

    // 7. Dibujar recuadro de selección (Marquee) en espacio de pantalla
    if (marquee) {
      this.drawMarquee(ctx, marquee);
    }

    ctx.restore(); // Restaurar escala DPR
  }

  drawDotGrid(width, height, viewport) {
    const { ctx } = this;
    const baseGap = 24;
    const effectiveGap = baseGap * viewport.zoom;

    // Subsample grid if too dense
    let step = baseGap;
    if (effectiveGap < 12) step = baseGap * 4;
    else if (effectiveGap < 6) step = baseGap * 8;

    const startX = (viewport.panX % (step * viewport.zoom)) - (step * viewport.zoom);
    const startY = (viewport.panY % (step * viewport.zoom)) - (step * viewport.zoom);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
    for (let x = startX; x < width + step * viewport.zoom; x += step * viewport.zoom) {
      for (let y = startY; y < height + step * viewport.zoom; y += step * viewport.zoom) {
        ctx.fillRect(Math.round(x), Math.round(y), 1.5, 1.5);
      }
    }
  }

  drawLayer(ctx, layer, isSelected) {
    ctx.save();
    ctx.globalAlpha = layer.opacity !== undefined ? layer.opacity : 1;

    // Transformación del elemento
    if (layer.rotation && layer.rotation !== 0) {
      const cx = layer.x + layer.width / 2;
      const cy = layer.y + layer.height / 2;
      ctx.translate(cx, cy);
      ctx.rotate((layer.rotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }

    // Sombras
    if (layer.shadow) {
      ctx.shadowColor = layer.shadow.color || 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = layer.shadow.blur || 12;
      ctx.shadowOffsetX = layer.shadow.x || 0;
      ctx.shadowOffsetY = layer.shadow.y || 4;
    }

    // Dibujo según el tipo
    switch (layer.type) {
      case 'frame':
        this.drawFrame(ctx, layer);
        break;
      case 'rect':
        this.drawRect(ctx, layer);
        break;
      case 'circle':
        this.drawCircle(ctx, layer);
        break;
      case 'polygon':
        this.drawPolygon(ctx, layer);
        break;
      case 'star':
        this.drawStar(ctx, layer);
        break;
      case 'line':
      case 'arrow':
        this.drawLineOrArrow(ctx, layer);
        break;
      case 'text':
        this.drawText(ctx, layer);
        break;
      case 'image':
        this.drawImageLayer(ctx, layer);
        break;
    }

    ctx.restore();
  }

  drawFrame(ctx, layer) {
    // 1. Título del Frame por encima
    ctx.save();
    ctx.font = '11px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillText(layer.name || 'Frame', layer.x, layer.y - 8);
    ctx.restore();

    // 2. Cuerpo del Frame
    ctx.beginPath();
    const r = layer.cornerRadius || 0;
    if (r > 0 && ctx.roundRect) {
      ctx.roundRect(layer.x, layer.y, layer.width, layer.height, r);
    } else {
      ctx.rect(layer.x, layer.y, layer.width, layer.height);
    }

    if (layer.fill && layer.fill !== 'none') {
      ctx.fillStyle = layer.fill;
      ctx.fill();
    }

    // Borde sutil del Frame
    ctx.strokeStyle = layer.stroke !== 'none' ? layer.stroke : 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = layer.strokeWidth || 1;
    ctx.stroke();
  }

  drawRect(ctx, layer) {
    ctx.beginPath();
    const r = layer.cornerRadius || 0;
    if (r > 0 && ctx.roundRect) {
      ctx.roundRect(layer.x, layer.y, layer.width, layer.height, r);
    } else {
      ctx.rect(layer.x, layer.y, layer.width, layer.height);
    }

    if (layer.fill && layer.fill !== 'none') {
      ctx.fillStyle = layer.fill;
      ctx.fill();
    }

    if (layer.stroke && layer.stroke !== 'none') {
      this.applyStroke(ctx, layer);
      ctx.stroke();
    }
  }

  drawCircle(ctx, layer) {
    ctx.beginPath();
    const rx = layer.width / 2;
    const ry = layer.height / 2;
    const cx = layer.x + rx;
    const cy = layer.y + ry;
    ctx.ellipse(cx, cy, Math.max(0, rx), Math.max(0, ry), 0, 0, Math.PI * 2);

    if (layer.fill && layer.fill !== 'none') {
      ctx.fillStyle = layer.fill;
      ctx.fill();
    }

    if (layer.stroke && layer.stroke !== 'none') {
      this.applyStroke(ctx, layer);
      ctx.stroke();
    }
  }

  drawPolygon(ctx, layer) {
    const sides = 3; // Triángulo por defecto
    const rx = layer.width / 2;
    const ry = layer.height / 2;
    const cx = layer.x + rx;
    const cy = layer.y + ry;

    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
      const px = cx + rx * Math.cos(angle);
      const py = cy + ry * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    if (layer.fill && layer.fill !== 'none') {
      ctx.fillStyle = layer.fill;
      ctx.fill();
    }

    if (layer.stroke && layer.stroke !== 'none') {
      this.applyStroke(ctx, layer);
      ctx.stroke();
    }
  }

  drawStar(ctx, layer) {
    const points = 5;
    const rx = layer.width / 2;
    const ry = layer.height / 2;
    const cx = layer.x + rx;
    const cy = layer.y + ry;
    const innerRx = rx * 0.45;
    const innerRy = ry * 0.45;

    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const radiusX = i % 2 === 0 ? rx : innerRx;
      const radiusY = i % 2 === 0 ? ry : innerRy;
      const px = cx + radiusX * Math.cos(angle);
      const py = cy + radiusY * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    if (layer.fill && layer.fill !== 'none') {
      ctx.fillStyle = layer.fill;
      ctx.fill();
    }

    if (layer.stroke && layer.stroke !== 'none') {
      this.applyStroke(ctx, layer);
      ctx.stroke();
    }
  }

  drawLineOrArrow(ctx, layer) {
    ctx.beginPath();
    const x1 = layer.x;
    const y1 = layer.y;
    const x2 = layer.x + layer.width;
    const y2 = layer.y + layer.height;

    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = layer.stroke !== 'none' ? layer.stroke : (layer.fill !== 'none' ? layer.fill : '#ffffff');
    ctx.lineWidth = layer.strokeWidth || 2;
    ctx.lineCap = 'round';
    if (layer.strokeDash === 'dashed') {
      ctx.setLineDash([6, 6]);
    } else {
      ctx.setLineDash([]);
    }
    ctx.stroke();

    if (layer.type === 'arrow') {
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const arrowLen = Math.max(10, (layer.strokeWidth || 2) * 4);
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(
        x2 - arrowLen * Math.cos(angle - Math.PI / 6),
        y2 - arrowLen * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        x2 - arrowLen * Math.cos(angle + Math.PI / 6),
        y2 - arrowLen * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
    }
    ctx.setLineDash([]);
  }

  drawText(ctx, layer) {
    ctx.font = `${layer.fontWeight || '400'} ${layer.fontSize || 16}px ${layer.fontFamily || 'Inter, sans-serif'}`;
    ctx.fillStyle = layer.fill && layer.fill !== 'none' ? layer.fill : '#ffffff';
    ctx.textAlign = layer.textAlign || 'left';
    ctx.textBaseline = 'top';

    const lines = (layer.text || 'Text').split('\n');
    const lineHeight = (layer.fontSize || 16) * (layer.lineHeight || 1.3);

    let startX = layer.x;
    if (layer.textAlign === 'center') startX = layer.x + layer.width / 2;
    else if (layer.textAlign === 'right') startX = layer.x + layer.width;

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], startX, layer.y + i * lineHeight);
    }
  }

  drawImageLayer(ctx, layer) {
    if (!layer.src) return;
    let img = this.imageCache.get(layer.src);
    if (!img) {
      img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = layer.src;
      img.onload = () => this.render();
      this.imageCache.set(layer.src, img);
    }

    if (img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, layer.x, layer.y, layer.width, layer.height);
    } else {
      ctx.fillStyle = '#2c2c2c';
      ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
      ctx.font = '12px Inter, sans-serif';
      ctx.fillStyle = '#888888';
      ctx.fillText('Loading Image...', layer.x + 10, layer.y + 20);
    }
  }

  applyStroke(ctx, layer) {
    ctx.strokeStyle = layer.stroke;
    ctx.lineWidth = layer.strokeWidth || 1;
    if (layer.strokeDash === 'dashed') {
      ctx.setLineDash([5, 5]);
    } else {
      ctx.setLineDash([]);
    }
  }

  drawSelectionGizmo(ctx, selectedLayers, viewport, hoverHandle) {
    const bounds = getCombinedBounds(selectedLayers);
    if (!bounds) return;

    ctx.save();
    const handleSize = 8 / viewport.zoom;
    const halfH = handleSize / 2;
    const accentColor = '#0d99ff'; // Figma Selection Blue

    // 1. Línea delimitadora de selección
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.5 / viewport.zoom;
    ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);

    // Dimensiones en píxeles debajo de la selección
    ctx.fillStyle = accentColor;
    ctx.font = `${Math.max(9, 11 / viewport.zoom)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    const dimText = `${Math.round(bounds.width)} × ${Math.round(bounds.height)}`;
    ctx.fillText(dimText, bounds.cx, bounds.y + bounds.height + (16 / viewport.zoom));

    // 2. Manijas de escala en las 8 direcciones
    const handles = [
      { id: 'nw', x: bounds.x, y: bounds.y },
      { id: 'n', x: bounds.cx, y: bounds.y },
      { id: 'ne', x: bounds.x + bounds.width, y: bounds.y },
      { id: 'e', x: bounds.x + bounds.width, y: bounds.cy },
      { id: 'se', x: bounds.x + bounds.width, y: bounds.y + bounds.height },
      { id: 's', x: bounds.cx, y: bounds.y + bounds.height },
      { id: 'sw', x: bounds.x, y: bounds.y + bounds.height },
      { id: 'w', x: bounds.x, y: bounds.cy }
    ];

    for (const h of handles) {
      ctx.fillStyle = hoverHandle === h.id ? '#ffffff' : '#ffffff';
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1.5 / viewport.zoom;
      ctx.fillRect(h.x - halfH, h.y - halfH, handleSize, handleSize);
      ctx.strokeRect(h.x - halfH, h.y - halfH, handleSize, handleSize);
    }

    // 3. Manijas de Corner Radius si solo hay 1 rectángulo seleccionado
    if (selectedLayers.length === 1 && selectedLayers[0].type === 'rect' && bounds.width > 30 && bounds.height > 30) {
      const rOffset = Math.min(16, bounds.width / 4, bounds.height / 4) / viewport.zoom;
      const radiusDots = [
        { x: bounds.x + rOffset * 2, y: bounds.y + rOffset * 2 },
        { x: bounds.x + bounds.width - rOffset * 2, y: bounds.y + rOffset * 2 },
        { x: bounds.x + bounds.width - rOffset * 2, y: bounds.y + bounds.height - rOffset * 2 },
        { x: bounds.x + rOffset * 2, y: bounds.y + bounds.height - rOffset * 2 }
      ];
      ctx.fillStyle = accentColor;
      for (const dot of radiusDots) {
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, 3.5 / viewport.zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1 / viewport.zoom;
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  drawSmartGuides(ctx, guides, viewport) {
    ctx.save();
    ctx.strokeStyle = '#ff3366'; // Figma Smart Guide Pink
    ctx.lineWidth = 1 / viewport.zoom;
    ctx.setLineDash([4 / viewport.zoom, 3 / viewport.zoom]);

    for (const g of guides) {
      ctx.beginPath();
      if (g.axis === 'x') {
        ctx.moveTo(g.pos, -50000);
        ctx.lineTo(g.pos, 50000);
      } else {
        ctx.moveTo(-50000, g.pos);
        ctx.lineTo(50000, g.pos);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  drawMarquee(ctx, m) {
    ctx.save();
    ctx.fillStyle = 'rgba(13, 153, 255, 0.12)';
    ctx.strokeStyle = '#0d99ff';
    ctx.lineWidth = 1;

    const x = Math.min(m.x1, m.x2);
    const y = Math.min(m.y1, m.y2);
    const w = Math.abs(m.x2 - m.x1);
    const h = Math.abs(m.y2 - m.y1);

    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }
}
