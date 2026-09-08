/**
 * Store reactivo y gestor de estado para Figma Clone KDD.
 * Conforme a knowledge/architecture/state-management.md
 */

import { getCombinedBounds } from './math.js';
import { validateDesign } from './design_rules.js';
import { supportsDurableStorage, readProject, writeProject } from './persistence.js';

function recoverMissingIds(layers) {
  const used = new Set(layers.map(layer => layer.id).filter(id => typeof id === 'string' && id));
  return layers.map((layer, index) => {
    if (typeof layer.id === 'string' && layer.id) return layer;
    let id = `recovered-${index}`;
    while (used.has(id)) id += '-next';
    used.add(id);
    return { ...layer, id };
  });
}

export class StateStore {
  constructor(initialData = null) {
    this.listeners = new Set();
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 50;
    this._writeQueue = Promise.resolve();
    this.persistenceStatus = { status: 'idle' };

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
    this.ready = !initialData && supportsDurableStorage() ? this.restoreDurableProject() : Promise.resolve();
  }

  // --- Suscripción reactiva ---
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(event = 'change') {
    if (this._activeDesignContract) {
      this.state.designContract = structuredClone(this._activeDesignContract);
      const result = validateDesign(this.state.layers, this._activeDesignContract);
      if (!result.valid) {
        this.state = structuredClone(this._acceptedDesignState);
        this.undoStack = this._acceptedUndo.slice();
        this.redoStack = this._acceptedRedo.slice();
        const error = new Error('Cambio rechazado por el contrato de diseño.');
        error.violations = result.violations;
        throw error;
      }
      this._acceptedDesignState = structuredClone(this.state);
      this._acceptedUndo = this.undoStack.slice();
      this._acceptedRedo = this.redoStack.slice();
    }
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
  // Only the human-facing approval UI calls this; no WebMCP activation tool.
  activateDesignContract(proposal) {
    const contract = {...structuredClone(proposal), status:'active'};
    const validation = validateDesign(this.state.layers, contract);
    if (!validation.valid) throw new Error('El contrato no coincide con el diseño actual.');
    if (!contract.rules.length) throw new Error('No hay reglas para activar.');
    this._activeDesignContract = contract;
    this.state.designContractProposal = null;
    this.state.designContract = structuredClone(contract);
    this.notify('contract:activate');
  }

  releaseDesignContract() {
    this._activeDesignContract = null;
    this.state.designContract = null;
    this.notify('contract:release');
  }

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
  addLayers(layers) {
    const used = new Set(this.state.layers.map(layer => layer.id));
    const remapped = new Map();
    const copies = structuredClone(layers).map((layer, index) => {
      let id = layer.id || `layer_${Date.now()}_${index}`;
      while (used.has(id)) id += '-next';
      used.add(id);
      if (layer.id) remapped.set(layer.id, id);
      return { ...layer, id };
    });
    for (const layer of copies) {
      if (remapped.has(layer.parentId)) layer.parentId = remapped.get(layer.parentId);
    }
    this.recordHistory();
    this.state.layers.push(...copies);
    this.state.selectedIds = copies.map(layer => layer.id);
    this.notify('layer:add');
    return copies;
  }

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

  createPostit(props = {}) {
    this.validatePostitProps(props);
    if (props.parentId && !this.getLayerById(props.parentId)) throw new Error('Parent layer does not exist.');
    const id = `postit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const { x = 100, y = 100, width = 240, height = 200, text = '', fill = '#fff2a8', parentId = null } = props;
    const root = { id, type: 'frame', name: 'Post-it', annotationKind: 'sticky', annotationRootId: id, sourceNodeType: 'STICKY', x, y, width, height, fill, parentId, visible: true, softDeleted: false, opacity: 1, rotation: 0, stroke: 'none', clipContent: true, showLabel: false, text };
    const child = { id: `${id}_text`, type: 'text', name: 'Post-it text', annotationRootId: id, parentId: id, x: x + 16, y: y + 16, width: Math.max(1, width - 32), height: Math.max(1, height - 32), text, fill: '#252525', visible: true, opacity: 1, rotation: 0, fontSize: 16, fontFamily: 'Inter, sans-serif', fontWeight: '400', lineHeight: 1.4, textAlign: 'left' };
    this.recordHistory();
    this.state.layers.push(root, child);
    this.state.selectedIds = [id];
    this.notify('layer:add');
    return root;
  }

  validatePostitProps(props) {
    for (const key of ['x', 'y', 'width', 'height']) {
      if (props[key] !== undefined && (!Number.isFinite(props[key]) || (['width', 'height'].includes(key) && props[key] <= 0))) throw new Error(`Invalid ${key}.`);
    }
    for (const key of ['text', 'fill', 'parentId']) {
      if (props[key] !== undefined && typeof props[key] !== 'string') throw new Error(`Invalid ${key}.`);
    }
  }

  updatePostit(id, props = {}) {
    const root = this.getLayerById(id);
    if (!root || root.annotationKind !== 'sticky') throw new Error('Layer is not a post-it.');
    this.validatePostitProps(props);
    const allowed = ['text', 'x', 'y', 'width', 'height', 'fill'];
    const patch = Object.fromEntries(Object.entries(props).filter(([key]) => allowed.includes(key)));
    const nativeText = this.getLayerById(`${id}_text`);
    const resizing = patch.width !== undefined || patch.height !== undefined;
    if (!nativeText && resizing && (!(root.width > 0) || !(root.height > 0))) throw new Error('Cannot resize a zero-size imported note.');
    const sx = !nativeText && resizing ? (patch.width ?? root.width) / root.width : 1;
    const sy = !nativeText && resizing ? (patch.height ?? root.height) / root.height : 1;
    const children = this.state.layers.filter(layer => layer.id !== id && layer.annotationRootId === id);
    const body = children.find(layer => layer.type === 'vector' && layer.vectorPaths?.length);
    const contentText = this.state.layers.find(layer => layer.id !== id && layer.annotationRootId === id && layer.type === 'text');
    const dx = (patch.x ?? root.x) - root.x, dy = (patch.y ?? root.y) - root.y;
    this.recordHistory();
    for (const child of children) {
      child.x = root.x + dx + (child.x - root.x) * sx;
      child.y = root.y + dy + (child.y - root.y) * sy;
      if (!nativeText && resizing) {
        if (child.type === 'text') {
          const previous = child.textTransform || {width:child.width, height:child.height, scaleX:1, scaleY:1};
          child.textTransform = {...previous, scaleX:previous.scaleX * sx, scaleY:previous.scaleY * sy};
        }
        if (child.type === 'vector') {
          child.vectorScaleX = (child.vectorScaleX ?? 1) * sx;
          child.vectorScaleY = (child.vectorScaleY ?? 1) * sy;
        }
        child.width *= sx;
        child.height *= sy;
      }
      if (patch.text !== undefined && child === contentText) child.text = patch.text;
      if (patch.fill !== undefined && child === body) {
        child.vectorPaths = child.vectorPaths.map(path => ({...path, fill:patch.fill}));
        delete child.fillGradient;
      }
    }
    Object.assign(root, patch);
    // Imported roots are transparent containers: the vector body owns the paint.
    if (!nativeText && body && patch.fill !== undefined) root.fill = 'none';
    if (nativeText) { nativeText.width = Math.max(1, root.width - 32); nativeText.height = Math.max(1, root.height - 32); }
    this.notify('layer:update');
    return root;
  }

  setLayersSoftDeleted(ids, deleted) {
    if (!Array.isArray(ids) || !ids.length || ids.some(id => typeof id !== 'string')) throw new Error('Provide a nonempty array of layer IDs.');
    const layers = [...new Set(ids)].map(id => this.getLayerById(id)).filter(Boolean);
    if (!layers.length) throw new Error('No matching layers.');
    if (layers.some(layer => !!layer.softDeleted !== deleted)) {
      this.recordHistory();
      for (const layer of layers) layer.softDeleted = deleted;
      if (deleted) {
        const hidden = new Set(layers.map(layer => layer.id));
        let changed = true;
        while (changed) { changed = false; for (const layer of this.state.layers) if (hidden.has(layer.parentId) && !hidden.has(layer.id)) { hidden.add(layer.id); changed = true; } }
        this.state.selectedIds = this.state.selectedIds.filter(id => !hidden.has(id));
      }
      this.notify(deleted ? 'layer:hide' : 'layer:restore');
    }
    return layers.map(layer => layer.id);
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
    if (this.getSelectedLayers().some(layer => layer.annotationKind === 'sticky' || layer.annotationRootId)) {
      const roots = new Set(this.getSelectedLayers().map(layer => layer.annotationRootId || layer.id));
      const ids = new Set(roots);
      let changed = true;
      while (changed) { changed = false; for (const layer of this.state.layers) if (ids.has(layer.parentId) && !ids.has(layer.id)) { ids.add(layer.id); changed = true; } }
      const originals = this.state.layers.filter(layer => ids.has(layer.id));
      const prefix = `copy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const mapping = new Map(originals.map((layer, index) => [layer.id, `${prefix}_${index}`]));
      // Native note text IDs retain their edit/resize association.
      for (const layer of originals) if (layer.annotationRootId && layer.id === `${layer.annotationRootId}_text`) mapping.set(layer.id, `${mapping.get(layer.annotationRootId)}_text`);
      this.recordHistory();
      this.state.layers.push(...originals.map(layer => ({ ...JSON.parse(JSON.stringify(layer)), id: mapping.get(layer.id), name: `${layer.name} (Copy)`, x: layer.x + 20, y: layer.y + 20, parentId: mapping.get(layer.parentId) || layer.parentId, ...(layer.annotationRootId ? { annotationRootId: mapping.get(layer.annotationRootId) || layer.annotationRootId } : {}) })));
      this.state.selectedIds = [...roots].map(id => mapping.get(id)).filter(Boolean);
      this.notify('layer:add');
      return this.state.selectedIds;
    }
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
    this.persistenceStatus = { status: 'pending' };
    this._saveTimeout = setTimeout(() => this.persistCurrentProject(), 400);
  }

  async flushPersistence() {
    clearTimeout(this._saveTimeout);
    this.persistCurrentProject();
    await this._writeQueue;
    if (this.persistenceStatus.status === 'error') throw new Error(this.persistenceStatus.message);
    return { ...this.persistenceStatus };
  }

  persistCurrentProject() {
      try {
        const payload = {
          title: this.state.title,
          layers: this.state.layers,
          viewport: this.state.viewport,
          settings: this.state.settings,
          designContract: this._activeDesignContract || null,
          designContractProposal: this.state.designContractProposal || null,
          updatedAt: Date.now()
        };
        if (supportsDurableStorage()) {
          const snapshot = structuredClone(payload);
          this._writeQueue = this._writeQueue.then(() => writeProject(snapshot)).then(() => {
            this.persistenceStatus = { status: 'saved', backend: 'indexedDB', updatedAt: snapshot.updatedAt };
          }).catch(error => {
            this.persistenceStatus = { status: 'error', message: error.message };
            console.error('Project persistence failed:', error);
          });
        } else {
          localStorage.setItem('figma_clone_kdd_project', JSON.stringify(payload));
          this.persistenceStatus = { status: 'saved', backend: 'localStorage', updatedAt: payload.updatedAt };
        }
      } catch (e) {
        this.persistenceStatus = { status: 'error', message: e.message };
        console.warn('LocalStorage save error:', e);
      }
  }

  loadFromStorage() {
    try {
      const saved = localStorage.getItem('figma_clone_kdd_project');
      if (saved) {
        const parsed = JSON.parse(saved);
        return this.restoreStoredProject(parsed);
      }
    } catch (e) {
      console.warn('LocalStorage load error:', e);
    }
    return false;
  }

  async restoreDurableProject() {
    try {
      const saved = await readProject();
      if (saved && !this.restoreStoredProject(saved)) throw new Error('Stored project is malformed.');
    } catch (error) {
      this.persistenceStatus = { status: 'error', message: error.message };
      throw error;
    }
  }

  restoreStoredProject(parsed) {
        if (parsed.layers && Array.isArray(parsed.layers)) {
          parsed = { ...parsed, layers: recoverMissingIds(parsed.layers) };
          if (parsed.designContract?.status === 'active' && !validateDesign(parsed.layers, parsed.designContract).valid) {
            throw new Error('El documento guardado no cumple su contrato activo.');
          }
          this._activeDesignContract = null;
          delete this.state.designContract;
          this.state.title = parsed.title || this.state.title;
          this.state.layers = parsed.layers;
          if (parsed.viewport) this.state.viewport = parsed.viewport;
          if (parsed.settings) this.state.settings = parsed.settings;
          this.state.designContractProposal = parsed.designContractProposal
            ? { ...structuredClone(parsed.designContractProposal), status: 'proposed' } : null;
          if (parsed.designContract?.status === 'active' && validateDesign(this.state.layers, parsed.designContract).valid) {
            this._activeDesignContract = structuredClone(parsed.designContract);
            this.state.designContract = structuredClone(parsed.designContract);
            this._acceptedDesignState = structuredClone(this.state);
            this._acceptedUndo = []; this._acceptedRedo = [];
          }
          return true;
        }
    return false;
  }

  loadState(data) {
    if (!data) return;
    data = structuredClone(data);
    this.state.title = data.title || 'Untitled Project';
    this.state.layers = recoverMissingIds(data.layers || []);
    this.state.selectedIds = [];
    if (data.viewport) this.state.viewport = data.viewport;
    if (data.settings) this.state.settings = data.settings;
    if (!this._activeDesignContract) {
      delete this.state.designContract;
      this.state.designContractProposal = data.designContract
        ? { ...data.designContract, status: 'proposed' } : null;
    }
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
