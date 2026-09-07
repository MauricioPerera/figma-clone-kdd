/**
 * Store reactivo y gestor de estado para Figma Clone KDD.
 * Conforme a knowledge/architecture/state-management.md
 */

import { getCombinedBounds } from './math.js';

export class StateStore {
  constructor(initialData = null) {
    this.listeners = new Set();
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 50;

    this.state = {
      title: 'Untitled Figma Project',
      version: '1.0.0',
      activePage: 'Page 1',
      pages: ['Page 1'],
      viewport: {
        panX: 120,
        panY: 80,
        zoom: 1.0
      },
      settings: {
        gridEnabled: true,
        snapToGrid: false,
        snapGuides: true,
        rulersVisible: true
      },
      layers: [],
      selectedIds: []
    };

    if (initialData) {
      this.loadState(initialData);
    } else {
      this.loadFromStorage();
    }
  }

  // --- Suscripción reactiva ---
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(event = 'change') {
    for (const listener of this.listeners) {
      try {
        listener(this.state, event);
      } catch (err) {
        console.error('Error in store listener:', err);
      }
    }
    this.saveToStorage();
  }

  // --- Historial Undo / Redo ---
  recordHistory() {
    const snapshot = JSON.stringify({
      layers: this.state.layers,
      selectedIds: this.state.selectedIds
    });

    // Evita duplicar el mismo snapshot continuo
    if (this.undoStack.length > 0 && this.undoStack[this.undoStack.length - 1] === snapshot) {
      return;
    }

    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  undo() {
    if (this.undoStack.length === 0) return false;
    const current = JSON.stringify({
      layers: this.state.layers,
      selectedIds: this.state.selectedIds
    });
    this.redoStack.push(current);

    const prev = JSON.parse(this.undoStack.pop());
    this.state.layers = prev.layers;
    this.state.selectedIds = prev.selectedIds;
    this.notify('history');
    return true;
  }

  redo() {
    if (this.redoStack.length === 0) return false;
    const current = JSON.stringify({
      layers: this.state.layers,
      selectedIds: this.state.selectedIds
    });
    this.undoStack.push(current);

    const next = JSON.parse(this.redoStack.pop());
    this.state.layers = next.layers;
    this.state.selectedIds = next.selectedIds;
    this.notify('history');
    return true;
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  // --- Operaciones de Capas ---
  addLayer(layer, selectIt = true) {
    this.recordHistory();
    const newLayer = {
      id: layer.id || `layer_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: layer.name || `${layer.type || 'Layer'}`,
      type: layer.type || 'rect',
      x: layer.x || 0,
      y: layer.y || 0,
      width: Math.max(1, layer.width || 100),
      height: Math.max(1, layer.height || 100),
      rotation: layer.rotation || 0,
      opacity: layer.opacity !== undefined ? layer.opacity : 1,
      visible: layer.visible !== undefined ? layer.visible : true,
      locked: layer.locked || false,
      parentId: layer.parentId || null,
      fill: layer.fill !== undefined ? layer.fill : '#3b82f6',
      stroke: layer.stroke !== undefined ? layer.stroke : 'none',
      strokeWidth: layer.strokeWidth !== undefined ? layer.strokeWidth : 1,
      strokeAlign: layer.strokeAlign || 'inside',
      strokeDash: layer.strokeDash || 'solid',
      cornerRadius: layer.cornerRadius || 0,
      shadow: layer.shadow || null,
      // Text props
      text: layer.text || '',
      fontSize: layer.fontSize || 16,
      fontFamily: layer.fontFamily || 'Inter, sans-serif',
      fontWeight: layer.fontWeight || '400',
      textAlign: layer.textAlign || 'left',
      lineHeight: layer.lineHeight || 1.4,
      // Frame props
      clipContent: layer.clipContent !== undefined ? layer.clipContent : true,
      ...layer
    };

    this.state.layers.push(newLayer);
    if (selectIt) {
      this.state.selectedIds = [newLayer.id];
    }
    this.notify('layer:add');
    return newLayer;
  }

  getLayerById(id) {
    return this.state.layers.find(l => l.id === id) || null;
  }

  getSelectedLayers() {
    return this.state.layers.filter(l => this.state.selectedIds.includes(l.id));
  }

  updateLayer(id, props, record = true) {
    const layer = this.getLayerById(id);
    if (!layer) return null;
    if (record) this.recordHistory();

    Object.assign(layer, props);
    this.notify('layer:update');
    return layer;
  }

  updateSelectedLayers(props, record = true) {
    if (this.state.selectedIds.length === 0) return;
    if (record) this.recordHistory();

    for (const id of this.state.selectedIds) {
      const layer = this.getLayerById(id);
      if (layer) {
        Object.assign(layer, props);
      }
    }
    this.notify('layer:update');
  }

  deleteLayers(ids = null) {
    const targetIds = ids || this.state.selectedIds;
    if (!targetIds || targetIds.length === 0) return;

    this.recordHistory();
    // También borrar capas hijas si se borra un frame/grupo
    const toDelete = new Set(targetIds);
    let addedChild = true;
    while (addedChild) {
      addedChild = false;
      for (const l of this.state.layers) {
        if (l.parentId && toDelete.has(l.parentId) && !toDelete.has(l.id)) {
          toDelete.add(l.id);
          addedChild = true;
        }
      }
    }

    this.state.layers = this.state.layers.filter(l => !toDelete.has(l.id));
    this.state.selectedIds = this.state.selectedIds.filter(id => !toDelete.has(id));
    this.notify('layer:delete');
  }

  duplicateSelected() {
    if (this.state.selectedIds.length === 0) return [];
    this.recordHistory();
    const newSelected = [];

    for (const id of this.state.selectedIds) {
      const original = this.getLayerById(id);
      if (original) {
        const cloned = JSON.parse(JSON.stringify(original));
        cloned.id = `layer_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        cloned.name = `${original.name} (Copy)`;
        cloned.x += 20;
        cloned.y += 20;
        this.state.layers.push(cloned);
        newSelected.push(cloned.id);
      }
    }

    this.state.selectedIds = newSelected;
    this.notify('layer:add');
    return newSelected;
  }

  setSelection(ids, multi = false) {
    const validIds = Array.isArray(ids) ? ids : [ids];
    if (multi) {
      const current = new Set(this.state.selectedIds);
      for (const id of validIds) {
        if (current.has(id)) current.delete(id);
        else current.add(id);
      }
      this.state.selectedIds = Array.from(current);
    } else {
      this.state.selectedIds = validIds;
    }
    this.notify('selection');
  }

  clearSelection() {
    if (this.state.selectedIds.length > 0) {
      this.state.selectedIds = [];
      this.notify('selection');
    }
  }

  // --- Orden y Jerarquía de Capas ---
  bringForward(id) {
    const idx = this.state.layers.findIndex(l => l.id === id);
    if (idx !== -1 && idx < this.state.layers.length - 1) {
      this.recordHistory();
      const temp = this.state.layers[idx];
      this.state.layers[idx] = this.state.layers[idx + 1];
      this.state.layers[idx + 1] = temp;
      this.notify('layer:reorder');
    }
  }

  sendBackward(id) {
    const idx = this.state.layers.findIndex(l => l.id === id);
    if (idx > 0) {
      this.recordHistory();
      const temp = this.state.layers[idx];
      this.state.layers[idx] = this.state.layers[idx - 1];
      this.state.layers[idx - 1] = temp;
      this.notify('layer:reorder');
    }
  }

  bringToFront(id) {
    const idx = this.state.layers.findIndex(l => l.id === id);
    if (idx !== -1 && idx < this.state.layers.length - 1) {
      this.recordHistory();
      const [layer] = this.state.layers.splice(idx, 1);
      this.state.layers.push(layer);
      this.notify('layer:reorder');
    }
  }

  sendToBack(id) {
    const idx = this.state.layers.findIndex(l => l.id === id);
    if (idx > 0) {
      this.recordHistory();
      const [layer] = this.state.layers.splice(idx, 1);
      this.state.layers.unshift(layer);
      this.notify('layer:reorder');
    }
  }

  // --- Alineación y Distribución ---
  alignSelection(alignment) {
    const selected = this.getSelectedLayers();
    if (selected.length <= 1) return;
    this.recordHistory();
    const bounds = getCombinedBounds(selected);

    for (const layer of selected) {
      switch (alignment) {
        case 'left':
          layer.x = bounds.x;
          break;
        case 'hcenter':
          layer.x = bounds.cx - layer.width / 2;
          break;
        case 'right':
          layer.x = bounds.x + bounds.width - layer.width;
          break;
        case 'top':
          layer.y = bounds.y;
          break;
        case 'vcenter':
          layer.y = bounds.cy - layer.height / 2;
          break;
        case 'bottom':
          layer.y = bounds.y + bounds.height - layer.height;
          break;
      }
    }
    this.notify('layer:update');
  }

  distributeSelection(axis = 'horizontal') {
    const selected = this.getSelectedLayers();
    if (selected.length < 3) return;
    this.recordHistory();

    if (axis === 'horizontal') {
      selected.sort((a, b) => a.x - b.x);
      const totalWidth = selected.reduce((sum, l) => sum + l.width, 0);
      const minX = selected[0].x;
      const maxX = selected[selected.length - 1].x + selected[selected.length - 1].width;
      const gap = (maxX - minX - totalWidth) / (selected.length - 1);

      let curX = minX;
      for (const layer of selected) {
        layer.x = curX;
        curX += layer.width + gap;
      }
    } else {
      selected.sort((a, b) => a.y - b.y);
      const totalHeight = selected.reduce((sum, l) => sum + l.height, 0);
      const minY = selected[0].y;
      const maxY = selected[selected.length - 1].y + selected[selected.length - 1].height;
      const gap = (maxY - minY - totalHeight) / (selected.length - 1);

      let curY = minY;
      for (const layer of selected) {
        layer.y = curY;
        curY += layer.height + gap;
      }
    }
    this.notify('layer:update');
  }

  // --- Viewport & Settings ---
  setViewport(panX, panY, zoom) {
    this.state.viewport.panX = panX;
    this.state.viewport.panY = panY;
    if (zoom !== undefined) {
      this.state.viewport.zoom = Math.max(0.05, Math.min(30.0, zoom));
    }
    this.notify('viewport');
  }

  // --- Persistencia en LocalStorage ---
  saveToStorage() {
    if (this._saveTimeout) clearTimeout(this._saveTimeout);
    this._saveTimeout = setTimeout(() => {
      try {
        const payload = {
          title: this.state.title,
          layers: this.state.layers,
          viewport: this.state.viewport,
          settings: this.state.settings,
          updatedAt: Date.now()
        };
        localStorage.setItem('figma_clone_kdd_project', JSON.stringify(payload));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
    }, 400);
  }

  loadFromStorage() {
    try {
      const saved = localStorage.getItem('figma_clone_kdd_project');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.layers && Array.isArray(parsed.layers)) {
          this.state.title = parsed.title || this.state.title;
          this.state.layers = parsed.layers;
          if (parsed.viewport) this.state.viewport = parsed.viewport;
          if (parsed.settings) this.state.settings = parsed.settings;
          return true;
        }
      }
    } catch (e) {
      console.warn('LocalStorage load error:', e);
    }
    return false;
  }

  loadState(data) {
    if (!data) return;
    this.state.title = data.title || 'Untitled Project';
    this.state.layers = data.layers || [];
    this.state.selectedIds = [];
    if (data.viewport) this.state.viewport = data.viewport;
    this.undoStack = [];
    this.redoStack = [];
    this.notify('load');
  }

  clearCanvas() {
    this.recordHistory();
    this.state.layers = [];
    this.state.selectedIds = [];
    this.notify('clear');
  }
}
