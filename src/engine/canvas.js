/**
 * Controlador interactivo del Lienzo Figma Clone KDD.
 * Conforme a knowledge/architecture/canvas-engine.md
 */

import { CanvasRenderer } from './renderer.js';
import { isPointInLayer, getLayerBounds, getCombinedBounds, findSnapGuides, clamp } from './math.js';

export class CanvasEngine {
  constructor(canvas, store) {
    this.canvas = canvas;
    this.store = store;
    this.renderer = new CanvasRenderer(canvas, store);

    this.activeTool = 'select'; // select, frame, rect, circle, polygon, star, line, arrow, text, hand
    this.interactionState = 'idle'; // idle, panning, dragging, resizing, rotating, creating, marquee, editing_text
    this.activeHandle = null; // nw, n, ne, e, se, s, sw, w, radius

    this.dragStart = { x: 0, y: 0 };
    this.layerStartProps = new Map();
    this.marqueeStart = { x: 0, y: 0 };
    this.currentMarquee = null;
    this.smartGuides = [];
    this.isSpaceDown = false;
    this.clipboard = null;

    this.setupEventListeners();
    this.renderer.resize();
    this.render();

    // Re-renderizar ante cualquier cambio del store
    this.store.subscribe((state, event) => {
      this.render();
    });

    window.addEventListener('resize', () => {
      this.renderer.resize();
      this.render();
    });
  }

  setTool(tool) {
    this.activeTool = tool;
    this.updateCursor();
    this.render();
  }

  screenToWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const { viewport } = this.store.state;
    return {
      x: (clientX - rect.left - viewport.panX) / viewport.zoom,
      y: (clientY - rect.top - viewport.panY) / viewport.zoom
    };
  }

  worldToScreen(worldX, worldY) {
    const rect = this.canvas.getBoundingClientRect();
    const { viewport } = this.store.state;
    return {
      x: worldX * viewport.zoom + viewport.panX + rect.left,
      y: worldY * viewport.zoom + viewport.panY + rect.top
    };
  }

  render() {
    this.renderer.render({
      marquee: this.currentMarquee,
      smartGuides: this.smartGuides,
      hoverHandle: this.activeHandle
    });
  }

  // --- Manejo de Eventos ---
  setupEventListeners() {
    const { canvas } = this;

    canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('mouseup', (e) => this.onMouseUp(e));
    canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
  }

  onMouseDown(e) {
    if (e.button === 1 || this.isSpaceDown || this.activeTool === 'hand') {
      // Iniciar Pan
      this.interactionState = 'panning';
      this.dragStart = { x: e.clientX, y: e.clientY };
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    if (e.button !== 0) return; // Solo botón izquierdo

    const world = this.screenToWorld(e.clientX, e.clientY);
    const selectedLayers = this.store.getSelectedLayers();

    // 1. Verificar si hizo click en una manija del Gizmo
    if (selectedLayers.length > 0 && this.activeTool === 'select') {
      const handle = this.getGizmoHandleAt(world.x, world.y, selectedLayers);
      if (handle) {
        this.interactionState = 'resizing';
        this.activeHandle = handle;
        this.dragStart = { x: world.x, y: world.y };
        this.store.recordHistory();
        this.saveInitialLayerProps(selectedLayers);
        return;
      }
    }

    // 2. Herramientas de Creación (Frame, Rect, Circle, etc.)
    if (['frame', 'rect', 'circle', 'polygon', 'star', 'line', 'arrow'].includes(this.activeTool)) {
      this.interactionState = 'creating';
      this.dragStart = { x: world.x, y: world.y };

      const defaultFills = {
        frame: '#242424',
        rect: '#3b82f6',
        circle: '#10b981',
        polygon: '#f59e0b',
        star: '#ec4899',
        line: '#ffffff',
        arrow: '#ffffff'
      };

      const newLayer = this.store.addLayer({
        type: this.activeTool,
        name: this.getAutoName(this.activeTool),
        x: world.x,
        y: world.y,
        width: 1,
        height: 1,
        fill: defaultFills[this.activeTool] || '#3b82f6',
        stroke: this.activeTool === 'frame' ? '#383838' : (['line', 'arrow'].includes(this.activeTool) ? '#ffffff' : 'none'),
        strokeWidth: ['line', 'arrow'].includes(this.activeTool) ? 2 : 1
      }, true);

      this.createdLayerId = newLayer.id;
      return;
    }

    // 3. Herramienta de Texto
    if (this.activeTool === 'text') {
      const textLayer = this.store.addLayer({
        type: 'text',
        name: 'Text',
        text: 'Type something...',
        x: world.x,
        y: world.y,
        width: 160,
        height: 32,
        fontSize: 18,
        fontWeight: '500',
        fill: '#ffffff'
      }, true);
      this.setTool('select');
      this.startInlineTextEdit(textLayer);
      return;
    }

    // 4. Herramienta de Selección (Hit Testing)
    if (this.activeTool === 'select') {
      const hitLayer = this.findTopLayerAt(world.x, world.y);
      if (hitLayer) {
        if (e.shiftKey) {
          this.store.setSelection(hitLayer.id, true);
        } else if (!this.store.state.selectedIds.includes(hitLayer.id)) {
          this.store.setSelection(hitLayer.id, false);
        }

        this.interactionState = 'dragging';
        this.dragStart = { x: world.x, y: world.y };
        this.store.recordHistory();
        this.saveInitialLayerProps(this.store.getSelectedLayers());
      } else {
        // Click en vacío -> Iniciar Marquee o deseleccionar
        if (!e.shiftKey) {
          this.store.clearSelection();
        }
        const rect = this.canvas.getBoundingClientRect();
        this.interactionState = 'marquee';
        this.marqueeStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        this.currentMarquee = {
          x1: this.marqueeStart.x,
          y1: this.marqueeStart.y,
          x2: this.marqueeStart.x,
          y2: this.marqueeStart.y
        };
      }
    }
  }

  onMouseMove(e) {
    const world = this.screenToWorld(e.clientX, e.clientY);
    const rect = this.canvas.getBoundingClientRect();

    // 1. Panning
    if (this.interactionState === 'panning') {
      const dx = e.clientX - this.dragStart.x;
      const dy = e.clientY - this.dragStart.y;
      this.dragStart = { x: e.clientX, y: e.clientY };
      const vp = this.store.state.viewport;
      this.store.setViewport(vp.panX + dx, vp.panY + dy, vp.zoom);
      return;
    }

    // 2. Creando nueva figura por arrastre
    if (this.interactionState === 'creating' && this.createdLayerId) {
      const layer = this.store.getLayerById(this.createdLayerId);
      if (layer) {
        let w = world.x - this.dragStart.x;
        let h = world.y - this.dragStart.y;

        if (e.shiftKey && ['rect', 'circle', 'polygon', 'star'].includes(layer.type)) {
          const size = Math.max(Math.abs(w), Math.abs(h));
          w = w < 0 ? -size : size;
          h = h < 0 ? -size : size;
        }

        const newX = w < 0 ? this.dragStart.x + w : this.dragStart.x;
        const newY = h < 0 ? this.dragStart.y + h : this.dragStart.y;

        this.store.updateLayer(this.createdLayerId, {
          x: newX,
          y: newY,
          width: Math.max(2, Math.abs(w)),
          height: Math.max(2, Math.abs(h))
        }, false);
      }
      return;
    }

    // 3. Arrastrando capas seleccionadas (Move con Snapping)
    if (this.interactionState === 'dragging') {
      let dx = world.x - this.dragStart.x;
      let dy = world.y - this.dragStart.y;

      const selected = this.store.getSelectedLayers();
      if (selected.length > 0 && this.store.state.settings.snapGuides) {
        const primary = selected[0];
        const tempLayer = { ...primary, x: this.layerStartProps.get(primary.id).x + dx, y: this.layerStartProps.get(primary.id).y + dy };
        const snap = findSnapGuides(tempLayer, this.store.state.layers);
        if (snap.guides.length > 0) {
          dx += snap.deltaX;
          dy += snap.deltaY;
          this.smartGuides = snap.guides;
        } else {
          this.smartGuides = [];
        }
      }

      for (const layer of selected) {
        const init = this.layerStartProps.get(layer.id);
        if (init) {
          layer.x = Math.round(init.x + dx);
          layer.y = Math.round(init.y + dy);
        }
      }
      this.store.notify('layer:update');
      return;
    }

    // 4. Redimensionando con Manijas de Gizmo
    if (this.interactionState === 'resizing' && this.activeHandle) {
      this.handleResize(world, e.shiftKey);
      this.store.notify('layer:update');
      return;
    }

    // 5. Marquee Selection
    if (this.interactionState === 'marquee') {
      const curX = e.clientX - rect.left;
      const curY = e.clientY - rect.top;
      this.currentMarquee = {
        x1: this.marqueeStart.x,
        y1: this.marqueeStart.y,
        x2: curX,
        y2: curY
      };

      // Hit test de capas dentro del marquee
      const w1 = this.screenToWorld(rect.left + Math.min(this.marqueeStart.x, curX), rect.top + Math.min(this.marqueeStart.y, curY));
      const w2 = this.screenToWorld(rect.left + Math.max(this.marqueeStart.x, curX), rect.top + Math.max(this.marqueeStart.y, curY));

      const matchedIds = [];
      for (const l of this.store.state.layers) {
        if (!l.visible) continue;
        const b = getLayerBounds(l);
        if (b.x + b.width >= w1.x && b.x <= w2.x && b.y + b.height >= w1.y && b.y <= w2.y) {
          matchedIds.push(l.id);
        }
      }
      this.store.setSelection(matchedIds, e.shiftKey);
      this.render();
      return;
    }

    // 6. Hover Cursor Management
    if (this.activeTool === 'select' && this.interactionState === 'idle') {
      const selected = this.store.getSelectedLayers();
      if (selected.length > 0) {
        const handle = this.getGizmoHandleAt(world.x, world.y, selected);
        if (handle) {
          this.setCursorForHandle(handle);
          return;
        }
      }

      const hit = this.findTopLayerAt(world.x, world.y);
      if (hit) {
        this.canvas.style.cursor = 'move';
      } else {
        this.updateCursor();
      }
    }
  }

  onMouseUp(e) {
    if (this.interactionState === 'creating') {
      if (this.createdLayerId) {
        const l = this.store.getLayerById(this.createdLayerId);
        if (l && l.width <= 3 && l.height <= 3) {
          // Si solo hizo un click sin arrastrar, asigna un tamaño inicial sensato
          l.width = l.type === 'frame' ? 390 : 100;
          l.height = l.type === 'frame' ? 844 : 100;
          this.store.notify('layer:update');
        }
      }
      this.createdLayerId = null;
      this.setTool('select');
    }

    this.interactionState = 'idle';
    this.activeHandle = null;
    this.currentMarquee = null;
    this.smartGuides = [];
    this.updateCursor();
    this.render();
  }

  onWheel(e) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const { viewport } = this.store.state;

    if (e.ctrlKey || e.metaKey) {
      // Zoom centrado en el cursor
      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
      const newZoom = clamp(viewport.zoom * zoomFactor, 0.05, 30.0);

      const worldX = (mouseX - viewport.panX) / viewport.zoom;
      const worldY = (mouseY - viewport.panY) / viewport.zoom;

      const newPanX = mouseX - worldX * newZoom;
      const newPanY = mouseY - worldY * newZoom;

      this.store.setViewport(newPanX, newPanY, newZoom);
    } else {
      // Pan con trackpad o rueda de mouse
      this.store.setViewport(viewport.panX - e.deltaX, viewport.panY - e.deltaY, viewport.zoom);
    }
  }

  onDoubleClick(e) {
    const world = this.screenToWorld(e.clientX, e.clientY);
    const hit = this.findTopLayerAt(world.x, world.y);
    if (hit && hit.type === 'text') {
      this.startInlineTextEdit(hit);
    }
  }

  onKeyDown(e) {
    // Si está editando texto, ignorar atajos del lienzo
    if (this.interactionState === 'editing_text') return;
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

    if (e.code === 'Space' && !this.isSpaceDown) {
      this.isSpaceDown = true;
      this.canvas.style.cursor = 'grab';
    }

    // Herramientas
    if (!e.ctrlKey && !e.metaKey) {
      if (e.key.toLowerCase() === 'v') this.setTool('select');
      if (e.key.toLowerCase() === 'f') this.setTool('frame');
      if (e.key.toLowerCase() === 'r') this.setTool('rect');
      if (e.key.toLowerCase() === 'o') this.setTool('circle');
      if (e.key.toLowerCase() === 't') this.setTool('text');
      if (e.key.toLowerCase() === 'l' && !e.shiftKey) this.setTool('line');
      if (e.key.toLowerCase() === 'l' && e.shiftKey) this.setTool('arrow');
      if (e.key.toLowerCase() === 'h') this.setTool('hand');
    }

    // Deshacer / Rehacer
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) this.store.redo();
      else this.store.undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      this.store.redo();
      return;
    }

    // Duplicar Ctrl+D
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      this.store.duplicateSelected();
      return;
    }

    // Copiar Ctrl+C / Pegar Ctrl+V
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      const selected = this.store.getSelectedLayers();
      if (selected.length > 0) {
        this.clipboard = JSON.stringify(selected);
      }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
      if (this.clipboard) {
        e.preventDefault();
        const layersToPaste = JSON.parse(this.clipboard);
        this.store.recordHistory();
        const newIds = [];
        for (const l of layersToPaste) {
          l.id = `layer_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
          l.name = `${l.name} (Copy)`;
          l.x += 24;
          l.y += 24;
          this.store.state.layers.push(l);
          newIds.push(l.id);
        }
        this.store.setSelection(newIds);
        this.store.notify('layer:add');
      }
      return;
    }

    // Seleccionar todo Ctrl+A
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      this.store.setSelection(this.store.state.layers.map(l => l.id));
      return;
    }

    // Eliminar Delete / Backspace
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      this.store.deleteLayers();
      return;
    }

    // Flechas para mover 1px (o 10px con Shift)
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      let dx = 0;
      let dy = 0;
      if (e.key === 'ArrowUp') dy = -step;
      if (e.key === 'ArrowDown') dy = step;
      if (e.key === 'ArrowLeft') dx = -step;
      if (e.key === 'ArrowRight') dx = step;

      this.store.updateSelectedLayers({
        x: undefined, // handled in loop
      }, true);

      for (const l of this.store.getSelectedLayers()) {
        l.x += dx;
        l.y += dy;
      }
      this.store.notify('layer:update');
    }
  }

  onKeyUp(e) {
    if (e.code === 'Space') {
      this.isSpaceDown = false;
      this.updateCursor();
    }
  }

  // --- Helpers de Manipulación y Gizmo ---
  saveInitialLayerProps(layers) {
    this.layerStartProps.clear();
    for (const l of layers) {
      this.layerStartProps.set(l.id, {
        x: l.x,
        y: l.y,
        width: l.width,
        height: l.height,
        cornerRadius: l.cornerRadius || 0
      });
    }
  }

  getGizmoHandleAt(wx, wy, selectedLayers) {
    const bounds = getCombinedBounds(selectedLayers);
    if (!bounds) return null;
    const threshold = 10 / this.store.state.viewport.zoom;

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
      if (Math.abs(wx - h.x) <= threshold && Math.abs(wy - h.y) <= threshold) {
        return h.id;
      }
    }
    return null;
  }

  handleResize(world, lockAspect) {
    const selected = this.store.getSelectedLayers();
    if (selected.length === 0) return;

    // Redimensionar para una o múltiples capas seleccionadas
    for (const layer of selected) {
      const init = this.layerStartProps.get(layer.id);
      if (!init) continue;

      let newX = init.x;
      let newY = init.y;
      let newW = init.width;
      let newH = init.height;

      const dx = world.x - this.dragStart.x;
      const dy = world.y - this.dragStart.y;

      switch (this.activeHandle) {
        case 'se':
          newW = Math.max(5, init.width + dx);
          newH = Math.max(5, init.height + dy);
          break;
        case 'e':
          newW = Math.max(5, init.width + dx);
          break;
        case 's':
          newH = Math.max(5, init.height + dy);
          break;
        case 'nw':
          newW = Math.max(5, init.width - dx);
          newH = Math.max(5, init.height - dy);
          newX = init.x + (init.width - newW);
          newY = init.y + (init.height - newH);
          break;
        case 'ne':
          newW = Math.max(5, init.width + dx);
          newH = Math.max(5, init.height - dy);
          newY = init.y + (init.height - newH);
          break;
        case 'sw':
          newW = Math.max(5, init.width - dx);
          newH = Math.max(5, init.height + dy);
          newX = init.x + (init.width - newW);
          break;
        case 'n':
          newH = Math.max(5, init.height - dy);
          newY = init.y + (init.height - newH);
          break;
        case 'w':
          newW = Math.max(5, init.width - dx);
          newX = init.x + (init.width - newW);
          break;
      }

      if (lockAspect && init.height > 0) {
        const ratio = init.width / init.height;
        if (['se', 'nw', 'ne', 'sw'].includes(this.activeHandle)) {
          newH = newW / ratio;
        }
      }

      layer.x = Math.round(newX);
      layer.y = Math.round(newY);
      layer.width = Math.round(newW);
      layer.height = Math.round(newH);
    }
  }

  setCursorForHandle(handle) {
    const cursors = {
      nw: 'nwse-resize',
      se: 'nwse-resize',
      ne: 'nesw-resize',
      sw: 'nesw-resize',
      n: 'ns-resize',
      s: 'ns-resize',
      e: 'ew-resize',
      w: 'ew-resize'
    };
    this.canvas.style.cursor = cursors[handle] || 'default';
  }

  updateCursor() {
    if (this.isSpaceDown || this.activeTool === 'hand') {
      this.canvas.style.cursor = 'grab';
    } else if (['frame', 'rect', 'circle', 'polygon', 'star', 'line', 'arrow'].includes(this.activeTool)) {
      this.canvas.style.cursor = 'crosshair';
    } else if (this.activeTool === 'text') {
      this.canvas.style.cursor = 'text';
    } else {
      this.canvas.style.cursor = 'default';
    }
  }

  findTopLayerAt(wx, wy) {
    const { layers } = this.store.state;
    // Iterar en reversa (capa más superficial primero)
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i];
      if (isPointInLayer(wx, wy, l)) {
        return l;
      }
    }
    return null;
  }

  getAutoName(type) {
    const count = this.store.state.layers.filter(l => l.type === type).length + 1;
    const names = {
      frame: `Frame ${count}`,
      rect: `Rectangle ${count}`,
      circle: `Ellipse ${count}`,
      polygon: `Polygon ${count}`,
      star: `Star ${count}`,
      line: `Line ${count}`,
      arrow: `Arrow ${count}`,
      text: `Text ${count}`
    };
    return names[type] || `Layer ${count}`;
  }

  // --- Inline Text Editing ---
  startInlineTextEdit(layer) {
    this.interactionState = 'editing_text';
    const screen = this.worldToScreen(layer.x, layer.y);
    const { viewport } = this.store.state;

    const textarea = document.createElement('textarea');
    textarea.value = layer.text || '';
    textarea.style.position = 'fixed';
    textarea.style.left = `${screen.x}px`;
    textarea.style.top = `${screen.y}px`;
    textarea.style.minWidth = `${layer.width * viewport.zoom}px`;
    textarea.style.minHeight = `${layer.height * viewport.zoom}px`;
    textarea.style.fontFamily = layer.fontFamily || 'Inter, sans-serif';
    textarea.style.fontSize = `${(layer.fontSize || 16) * viewport.zoom}px`;
    textarea.style.fontWeight = layer.fontWeight || '400';
    textarea.style.color = layer.fill || '#ffffff';
    textarea.style.background = 'rgba(15, 23, 42, 0.85)';
    textarea.style.border = '1.5px solid #0d99ff';
    textarea.style.borderRadius = '4px';
    textarea.style.padding = '4px';
    textarea.style.outline = 'none';
    textarea.style.zIndex = '1000';
    textarea.style.resize = 'both';

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    const commitEdit = () => {
      layer.text = textarea.value;
      if (document.body.contains(textarea)) {
        document.body.removeChild(textarea);
      }
      this.interactionState = 'idle';
      this.store.notify('layer:update');
      this.render();
    };

    textarea.addEventListener('blur', commitEdit);
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        commitEdit();
      }
      e.stopPropagation();
    });

    textarea.addEventListener('input', () => {
      layer.text = textarea.value;
      this.render();
    });
  }
}
