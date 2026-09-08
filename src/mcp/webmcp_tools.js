/**
 * Registro de herramientas WebMCP formales para Figma Clone KDD.
 * Conforme a knowledge/architecture/webmcp-integration.md y contracts/task_webmcp_bridge.md
 */

import { fastwebmcp } from './fastwebmcp_runtime.js';
import { registerDesignRulesTools } from './design_rules_tools.js';
import { UI_TEMPLATES } from '../engine/templates.js';
import { exportToSVG, importFromJSON, layerToTailwind, filterDesignLayers, serializeProject } from '../engine/export.js';
import { isLayerEffectivelyVisible } from '../engine/annotations.js';
import { getCombinedBounds } from '../engine/math.js';

const PENDING_DELETIONS_TTL_MS = 60_000;
const SECTION_TYPES = ['header', 'hero', 'logos', 'features', 'showcase', 'testimonials', 'pricing', 'faq', 'cta', 'footer'];

function isSection(layer) {
  return layer?.type === 'frame' && SECTION_TYPES.includes(layer.sectionType);
}

function getSectionLayers(store, sectionId) {
  const section = store.getLayerById(sectionId);
  if (!isSection(section)) throw new Error('La capa indicada no es una sección válida.');
  const ids = new Set([sectionId]);
  let addedChild = true;
  while (addedChild) {
    addedChild = false;
    for (const layer of store.state.layers) {
      if (layer.parentId && ids.has(layer.parentId) && !ids.has(layer.id)) {
        ids.add(layer.id);
        addedChild = true;
      }
    }
  }
  return store.state.layers.filter(layer => ids.has(layer.id));
}

function getNextSectionY(store) {
  const sections = store.state.layers.filter(isSection);
  if (sections.length === 0) return 100;
  return Math.max(...sections.map(section => section.y + section.height)) + 48;
}

function expandLayerIds(store, ids) {
  const requested = Array.isArray(ids) ? ids : [];
  const existing = requested.filter(id => store.getLayerById(id));
  const missing = requested.filter(id => !store.getLayerById(id));
  const expanded = new Set(existing);
  let addedChild = true;

  while (addedChild) {
    addedChild = false;
    for (const layer of store.state.layers) {
      if (layer.parentId && expanded.has(layer.parentId) && !expanded.has(layer.id)) {
        expanded.add(layer.id);
        addedChild = true;
      }
    }
  }

  return { ids: [...expanded], missing };
}

function getCanvasSize(canvasEngine) {
  const canvas = canvasEngine?.canvas;
  const width = canvas?.clientWidth || canvas?.width;
  const height = canvas?.clientHeight || canvas?.height;

  if (!width || !height) {
    throw new Error('No se puede enfocar el lienzo: CanvasEngine no tiene dimensiones disponibles.');
  }

  return { width, height };
}

function focusLayers(store, canvasEngine, layers, padding = 80) {
  layers = layers.filter(layer => isLayerEffectivelyVisible(layer, store.state.layers));
  const bounds = getCombinedBounds(layers);
  if (!bounds) throw new Error('No hay capas válidas para enfocar.');

  const { width: canvasWidth, height: canvasHeight } = getCanvasSize(canvasEngine);
  const safePadding = Math.max(0, padding);
  const zoom = Math.max(
    0.05,
    Math.min(30, (canvasWidth - safePadding * 2) / bounds.width, (canvasHeight - safePadding * 2) / bounds.height)
  );
  const panX = canvasWidth / 2 - bounds.cx * zoom;
  const panY = canvasHeight / 2 - bounds.cy * zoom;

  store.setViewport(panX, panY, zoom);
  return { bounds, viewport: { panX, panY, zoom } };
}

function projectFilename(title) {
  return `${(title || 'untitled_project').toLowerCase().replace(/\s+/g, '_')}.figma.json`;
}

export function registerFigmaWebMcpTools(store, canvasEngine) {
  registerDesignRulesTools(store, fastwebmcp);
  const pendingDeletions = new Map();
  const pendingImports = new Map();
  const pendingExports = new Map();

  const postitProperties = { text: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' }, width: { type: 'number', exclusiveMinimum: 0 }, height: { type: 'number', exclusiveMinimum: 0 }, fill: { type: 'string' } };
  fastwebmcp.registerTool({
    name: 'figma_create_postit', title: 'Create Post-it', description: 'Creates an editable annotation separate from the design. No deletion confirmation is required.',
    inputSchema: { type: 'object', properties: { ...postitProperties, parentId: { type: 'string' } }, required: ['text'] },
    annotations: { destructiveHint: false },
    execute: async props => { if (typeof props.text !== 'string') throw new Error('text is required.'); const layer = store.createPostit(props); return { layerId: layer.id, layer }; }
  });
  fastwebmcp.registerTool({
    name: 'figma_list_postits', title: 'List Post-its', description: 'Lists sticky annotations, including soft-deleted notes by default so they can be restored.',
    inputSchema: { type: 'object', properties: { includeHidden: { type: 'boolean', default: true } } }, annotations: { readOnlyHint: true },
    execute: async ({ includeHidden = true }) => {
      if (typeof includeHidden !== 'boolean') throw new Error('Invalid includeHidden.');
      return { postits: store.state.layers.filter(layer => layer.annotationKind === 'sticky').filter(layer => includeHidden || isLayerEffectivelyVisible(layer, store.state.layers)).map(layer => ({ ...layer, text: layer.text || store.state.layers.filter(child => child.annotationRootId === layer.id && child.type === 'text').map(child => child.text).join('\n'), effectiveVisible: isLayerEffectivelyVisible(layer, store.state.layers) })) };
    }
  });
  fastwebmcp.registerTool({
    name: 'figma_update_postit', title: 'Update Post-it', description: 'Edits annotation content and geometry without converting it into design content.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, ...postitProperties }, required: ['id'] }, annotations: { destructiveHint: false },
    execute: async ({ id, ...props }) => ({ layer: store.updatePostit(id, props) })
  });
  for (const [name, deleted] of [['figma_hide_postits', true], ['figma_restore_postits', false]]) {
    fastwebmcp.registerTool({ name, title: deleted ? 'Hide Post-its' : 'Restore Post-its', description: deleted ? 'Soft-deletes sticky annotations reversibly without confirmation or permanently deleting any data. Continue work after this call.' : 'Restores soft-deleted sticky annotations, preserving original child visibility.', inputSchema: { type: 'object', properties: { ids: { type: 'array', minItems: 1, items: { type: 'string' } } }, required: ['ids'] }, annotations: { destructiveHint: false, idempotentHint: true }, execute: async ({ ids }) => {
      if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string')) throw new Error('Invalid ids.');
      if (ids.some(id => store.getLayerById(id) && store.getLayerById(id).annotationKind !== 'sticky')) throw new Error('All existing IDs must be post-its.');
      const changedIds = store.setLayersSoftDeleted(ids, deleted);
      return { success: true, [deleted ? 'hiddenIds' : 'restoredIds']: changedIds, missingIds: ids.filter(id => !store.getLayerById(id)) };
    } });
  }

  const createDeletionToken = (ids, operation) => {
    ids = [...new Set(ids)];
    const token = `${operation}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    pendingDeletions.set(token, { ids, operation, snapshot: JSON.stringify(ids.map(id => store.getLayerById(id))), expiresAt: Date.now() + PENDING_DELETIONS_TTL_MS });
    return token;
  };

  const consumeDeletionToken = (token, operation) => {
    const pending = pendingDeletions.get(token);
    pendingDeletions.delete(token);
    if (!pending || pending.operation !== operation || pending.expiresAt < Date.now()) {
      throw new Error('La confirmación no existe o caducó. Ejecuta primero la herramienta de preparación.');
    }
    const currentIds = expandLayerIds(store, pending.ids).ids;
    if (currentIds.length !== pending.ids.length || JSON.stringify(pending.ids.map(id => store.getLayerById(id))) !== pending.snapshot) throw new Error('Las capas preparadas cambiaron; prepara la eliminación nuevamente.');
    return pending.ids;
  };

  const createImportToken = (project) => {
    const token = `import_project_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    pendingImports.set(token, { project, expiresAt: Date.now() + PENDING_DELETIONS_TTL_MS });
    return token;
  };

  const consumeImportToken = (token) => {
    const pending = pendingImports.get(token);
    pendingImports.delete(token);
    if (!pending || pending.expiresAt < Date.now()) {
      throw new Error('La importación no existe o caducó. Ejecuta primero la preparación de importación.');
    }
    return pending.project;
  };

  // 1. Crear Frame
  fastwebmcp.registerTool({
    name: 'figma_create_frame',
    title: 'Create Frame',
    description: 'Creates a new container Frame or Artboard on the design canvas.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the artboard (e.g. iPhone 16)' },
        width: { type: 'number', description: 'Width in px' },
        height: { type: 'number', description: 'Height in px' },
        x: { type: 'number', description: 'World X coordinate' },
        y: { type: 'number', description: 'World Y coordinate' },
        fill: { type: 'string', description: 'Hex background color (e.g. #1e1e1e)' },
        parentId: { type: 'string', description: 'Optional parent frame or section ID' }
      },
      required: ['width', 'height']
    },
    execute: async ({ name = 'Frame', width = 390, height = 844, x = 100, y = 100, fill = '#1e1e1e', parentId = null }) => {
      const layer = store.addLayer({
        type: 'frame',
        name,
        width,
        height,
        x,
        y,
        fill,
        stroke: '#2c2c2c',
        cornerRadius: 16,
        parentId
      });
      return { success: true, frameId: layer.id, message: `Created frame "${layer.name}"` };
    }
  });

  // 2. Crear Figura Vectorial
  fastwebmcp.registerTool({
    name: 'figma_create_shape',
    title: 'Create Shape',
    description: 'Creates a vector primitive (rect, circle, polygon, star, line, arrow) on canvas.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['rect', 'circle', 'polygon', 'star', 'line', 'arrow'], description: 'Shape geometry' },
        x: { type: 'number', description: 'X position' },
        y: { type: 'number', description: 'Y position' },
        width: { type: 'number', description: 'Width in px' },
        height: { type: 'number', description: 'Height in px' },
        fill: { type: 'string', description: 'Fill hex color' },
        stroke: { type: 'string', description: 'Stroke hex color' },
        strokeWidth: { type: 'number', description: 'Border stroke width' },
        cornerRadius: { type: 'number', description: 'Corner radius in px' },
        parentId: { type: 'string', description: 'Optional parent frame or section ID' }
      },
      required: ['type', 'width', 'height']
    },
    execute: async (params) => {
      const layer = store.addLayer({
        type: params.type,
        x: params.x !== undefined ? params.x : 100,
        y: params.y !== undefined ? params.y : 100,
        width: params.width || 120,
        height: params.height || 80,
        fill: params.fill !== undefined ? params.fill : '#3b82f6',
        stroke: params.stroke || 'none',
        strokeWidth: params.strokeWidth || 1,
        cornerRadius: params.cornerRadius || 0,
        parentId: params.parentId || null
      });
      return { success: true, layerId: layer.id, layer };
    }
  });

  // 3. Crear Texto
  fastwebmcp.registerTool({
    name: 'figma_create_text',
    title: 'Create Text',
    description: 'Creates a styled typography text layer on canvas.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Textual content' },
        x: { type: 'number', description: 'X position' },
        y: { type: 'number', description: 'Y position' },
        fontSize: { type: 'number', description: 'Font size in px' },
        fontWeight: { type: 'string', description: '400, 600, 700' },
        fill: { type: 'string', description: 'Text color hex' },
        parentId: { type: 'string', description: 'Optional parent frame or section ID' }
      },
      required: ['text']
    },
    execute: async ({ text, x = 100, y = 100, fontSize = 20, fontWeight = '600', fill = '#ffffff', parentId = null }) => {
      const layer = store.addLayer({
        type: 'text',
        name: text.slice(0, 16),
        text,
        x,
        y,
        fontSize,
        fontWeight,
        fill,
        width: Math.max(120, text.length * (fontSize * 0.55)),
        height: fontSize * 1.5,
        parentId
      });
      return { success: true, layerId: layer.id };
    }
  });

  // 4. Crear Componente UI Completo (Templates)
  fastwebmcp.registerTool({
    name: 'figma_create_ui_component',
    title: 'Insert UI Component',
    description: 'Instantiates a rich UI component template (mobile_login, saas_hero, dashboard_card).',
    inputSchema: {
      type: 'object',
      properties: {
        template: { type: 'string', enum: ['mobile_login', 'saas_hero', 'dashboard_card'], description: 'Template key' },
        x: { type: 'number', description: 'X position' },
        y: { type: 'number', description: 'Y position' }
      },
      required: ['template']
    },
    execute: async ({ template = 'mobile_login', x = 100, y = 100 }) => {
      const tpl = UI_TEMPLATES[template];
      if (!tpl) {
        throw new Error(`Template "${template}" no existe.`);
      }
      const layers = store.addLayers(tpl.create(x, y));
      return { success: true, count: layers.length, template: tpl.title };
    }
  });

  // 5. Actualizar Capa
  fastwebmcp.registerTool({
    name: 'figma_update_layer',
    title: 'Update Layer Properties',
    description: 'Modifies geometry, fill, stroke, effects, or typography of any layer by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Layer ID' },
        properties: { type: 'object', description: 'Key-value map of properties to update' }
      },
      required: ['id', 'properties']
    },
    execute: async ({ id, properties }) => {
      const updated = store.updateLayer(id, properties, true);
      if (!updated) throw new Error(`Capa con ID "${id}" no encontrada.`);
      return { success: true, layer: updated };
    }
  });

  // 5b. Transformar Capa (Mover / Escalar / Rotar)
  fastwebmcp.registerTool({
    name: 'figma_transform_layer',
    title: 'Transform Layer',
    description: 'Translates, scales, or rotates a layer on the canvas.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Layer ID' },
        x: { type: 'number', description: 'New X position' },
        y: { type: 'number', description: 'New Y position' },
        width: { type: 'number', description: 'New width' },
        height: { type: 'number', description: 'New height' },
        rotation: { type: 'number', description: 'Rotation in degrees' }
      },
      required: ['id']
    },
    execute: async ({ id, x, y, width, height, rotation }) => {
      const props = {};
      if (x !== undefined) props.x = x;
      if (y !== undefined) props.y = y;
      if (width !== undefined) props.width = Math.max(1, width);
      if (height !== undefined) props.height = Math.max(1, height);
      if (rotation !== undefined) props.rotation = rotation;

      const updated = store.updateLayer(id, props, true);
      if (!updated) throw new Error(`Capa con ID "${id}" no encontrada.`);
      return { success: true, layer: updated };
    }
  });

  // 6. Eliminar Capas
  fastwebmcp.registerTool({
    name: 'figma_delete_layers',
    title: 'Delete Layers',
    description: 'Deprecated destructive shortcut. Use figma_prepare_delete_layers and figma_confirm_delete_layers so deletion is reviewed before it happens.',
    inputSchema: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string' }, description: 'Array of layer IDs to delete' }
      },
    required: ['ids']
    },
    execute: async ({ ids }) => {
      const { ids: existingIds, missing } = expandLayerIds(store, ids);
      if (existingIds.length === 0) throw new Error('No se encontraron capas para eliminar.');
      return {
        success: false,
        message: 'El borrado directo está desactivado. Prepara y confirma la eliminación para continuar.',
        deletableIds: existingIds,
        missingIds: missing
      };
    }
  });
  // 6b. Preparar borrado explícito (reversible hasta confirmación)
  fastwebmcp.registerTool({
    name: 'figma_prepare_delete_layers',
    title: 'Prepare Layer Deletion',
    description: 'Previews the exact layers, including frame children, that would be deleted. Use before confirming a cleanup.',
    inputSchema: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string' }, description: 'IDs of the layers or frames to remove' }
      },
      required: ['ids']
    },
    execute: async ({ ids }) => {
      const { ids: deletableIds, missing } = expandLayerIds(store, ids);
      if (deletableIds.length === 0) throw new Error('No se encontraron capas para preparar la eliminación.');
      const token = createDeletionToken(deletableIds, 'delete_layers');
      return {
        confirmationToken: token,
        expiresInMs: PENDING_DELETIONS_TTL_MS,
        deleteCount: deletableIds.length,
        layers: deletableIds.map(id => store.getLayerById(id)).filter(Boolean).map(layer => ({ id: layer.id, name: layer.name, type: layer.type })),
        missingIds: missing
      };
    }
  });
  // 6c. Confirmar borrado explícito
  fastwebmcp.registerTool({
    name: 'figma_confirm_delete_layers',
    title: 'Confirm Layer Deletion',
    description: 'Deletes only the layers previewed by figma_prepare_delete_layers using its short-lived confirmation token.',
    inputSchema: {
      type: 'object',
      properties: {
        confirmationToken: { type: 'string', description: 'Token returned by figma_prepare_delete_layers' }
      },
      required: ['confirmationToken']
    },
    execute: async ({ confirmationToken }) => {
      const ids = consumeDeletionToken(confirmationToken, 'delete_layers');
      const { ids: deletableIds, missing } = expandLayerIds(store, ids);
      if (deletableIds.length === 0) throw new Error('Las capas preparadas ya no existen.');
      store.deleteLayers(deletableIds);
      return { success: true, deletedCount: deletableIds.length, missingIds: missing };
    }
  });
  // 6d. Preparar limpieza completa del documento
  fastwebmcp.registerTool({
    name: 'figma_prepare_clear_canvas',
    title: 'Prepare Canvas Cleanup',
    description: 'Previews a complete canvas cleanup. Use only when the current design should be removed before starting over.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      if (store.state.layers.length === 0) return { deleteCount: 0, message: 'El lienzo ya está vacío.' };
      const ids = store.state.layers.map(layer => layer.id);
      const token = createDeletionToken(ids, 'clear_canvas');
      return { confirmationToken: token, expiresInMs: PENDING_DELETIONS_TTL_MS, deleteCount: ids.length };
    }
  });
  // 6e. Confirmar limpieza completa del documento
  fastwebmcp.registerTool({
    name: 'figma_confirm_clear_canvas',
    title: 'Confirm Canvas Cleanup',
    description: 'Removes every layer only after figma_prepare_clear_canvas has returned a valid confirmation token.',
    inputSchema: {
      type: 'object',
      properties: { confirmationToken: { type: 'string', description: 'Token returned by figma_prepare_clear_canvas' } },
      required: ['confirmationToken']
    },
    execute: async ({ confirmationToken }) => {
      const ids = consumeDeletionToken(confirmationToken, 'clear_canvas');
      const beforeCount = store.state.layers.length;
      store.deleteLayers(ids);
      return { success: true, deletedCount: beforeCount };
    }
  });
  // 6f. Seleccionar capas para una operación posterior visible
  fastwebmcp.registerTool({
    name: 'figma_select_layers',
    title: 'Select Layers',
    description: 'Selects existing layers by ID so a following focus, transform, or export operation has a visible target.',
    inputSchema: {
      type: 'object',
      properties: { ids: { type: 'array', items: { type: 'string' }, description: 'Layer IDs to select' } },
      required: ['ids']
    },
    execute: async ({ ids }) => {
      const layers = ids.map(id => store.getLayerById(id)).filter(Boolean);
      if (layers.length === 0) throw new Error('No se encontraron capas para seleccionar.');
      store.setSelection(layers.map(layer => layer.id));
      return { success: true, selectedIds: layers.map(layer => layer.id), missingIds: ids.filter(id => !store.getLayerById(id)) };
    }
  });
  // 6g. Ocultar capas sin eliminarlas (soft delete reversible)
  fastwebmcp.registerTool({
    name: 'figma_hide_layers',
    title: 'Hide Layers',
    description: 'Hides existing layers without deleting them. Use to remove work from view while keeping it available for later restoration or batch cleanup.',
    inputSchema: {
      type: 'object',
      properties: { ids: { type: 'array', items: { type: 'string' }, description: 'Layer IDs to hide' } },
      required: ['ids']
    },
    execute: async ({ ids }) => {
      const hiddenIds = store.setLayersSoftDeleted(ids, true);
      return { success: true, hiddenIds, missingIds: ids.filter(id => !store.getLayerById(id)) };
    }
  });
  // 6h. Restaurar capas ocultas
  fastwebmcp.registerTool({
    name: 'figma_restore_layers',
    title: 'Restore Hidden Layers',
    description: 'Makes previously hidden layers visible again without changing their geometry or styling.',
    inputSchema: {
      type: 'object',
      properties: { ids: { type: 'array', items: { type: 'string' }, description: 'Layer IDs to restore' } },
      required: ['ids']
    },
    execute: async ({ ids }) => {
      const restoredIds = store.setLayersSoftDeleted(ids, false);
      return { success: true, restoredIds, missingIds: ids.filter(id => !store.getLayerById(id)) };
    }
  });
  // 6i. Preparar limpieza grupal de capas previamente ocultas
  fastwebmcp.registerTool({
    name: 'figma_prepare_delete_hidden_layers',
    title: 'Prepare Hidden Layer Cleanup',
    description: 'Previews every hidden layer that would be permanently deleted in one batch. Use after reviewing soft-deleted work.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      const hiddenIds = expandLayerIds(store, store.state.layers.filter(layer => layer.softDeleted === true).map(layer => layer.id)).ids;
      if (hiddenIds.length === 0) return { deleteCount: 0, layers: [], message: 'No hay capas ocultas para eliminar.' };
      const token = createDeletionToken(hiddenIds, 'delete_hidden_layers');
      return {
        confirmationToken: token,
        expiresInMs: PENDING_DELETIONS_TTL_MS,
        deleteCount: hiddenIds.length,
        layers: hiddenIds.map(id => store.getLayerById(id)).filter(Boolean).map(layer => ({ id: layer.id, name: layer.name, type: layer.type }))
      };
    }
  });
  // 6j. Confirmar limpieza grupal de capas ocultas
  fastwebmcp.registerTool({
    name: 'figma_confirm_delete_hidden_layers',
    title: 'Confirm Hidden Layer Cleanup',
    description: 'Permanently deletes only the hidden layers previewed by figma_prepare_delete_hidden_layers.',
    inputSchema: {
      type: 'object',
      properties: { confirmationToken: { type: 'string', description: 'Token returned by figma_prepare_delete_hidden_layers' } },
      required: ['confirmationToken']
    },
    execute: async ({ confirmationToken }) => {
      const ids = consumeDeletionToken(confirmationToken, 'delete_hidden_layers');
      const hiddenIds = ids;
      if (hiddenIds.length === 0) throw new Error('Las capas ocultas preparadas ya no existen o fueron restauradas.');
      store.deleteLayers(hiddenIds);
      return { success: true, deletedCount: hiddenIds.length };
    }
  });
  // 6k. Enfocar capas o frames concretos
  fastwebmcp.registerTool({
    name: 'figma_focus_layers',
    title: 'Focus Layers',
    description: 'Centers and zooms the visible canvas around the requested layers or frame. Use after creating or selecting a design so the user can see it.',
    inputSchema: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string' }, description: 'Layer or frame IDs to frame in the viewport' },
        padding: { type: 'number', description: 'Empty space in screen pixels around the focused bounds' }
      },
      required: ['ids']
    },
    execute: async ({ ids, padding = 80 }) => {
      const layers = ids.map(id => store.getLayerById(id)).filter(Boolean);
      if (layers.length === 0) throw new Error('No se encontraron capas para enfocar.');
      store.setSelection(layers.map(layer => layer.id));
      return { success: true, focusedIds: layers.map(layer => layer.id), ...focusLayers(store, canvasEngine, layers, padding) };
    }
  });
  // 6h. Encuadrar todo el documento
  fastwebmcp.registerTool({
    name: 'figma_zoom_to_fit',
    title: 'Zoom to Fit Document',
    description: 'Centers and zooms the visible canvas to fit every layer in the current document. Use to review the complete design.',
    inputSchema: {
      type: 'object',
      properties: { padding: { type: 'number', description: 'Empty space in screen pixels around the document bounds' } }
    },
    execute: async ({ padding = 80 } = {}) => {
      if (store.state.layers.length === 0) throw new Error('No hay capas en el documento para encuadrar.');
      const layers = store.state.layers.filter(layer => isLayerEffectivelyVisible(layer, store.state.layers));
      return { success: true, layerCount: layers.length, ...focusLayers(store, canvasEngine, layers, padding) };
    }
  });

  // 7. Crear una sección semántica de landing o página
  fastwebmcp.registerTool({
    name: 'figma_create_section',
    title: 'Create Design Section',
    description: 'Creates a named semantic section such as hero, features, pricing, FAQ, or footer. Use before adding the section content.',
    inputSchema: {
      type: 'object',
      properties: {
        sectionType: { type: 'string', enum: SECTION_TYPES, description: 'Semantic section type' },
        name: { type: 'string', description: 'Optional display name for the section' },
        x: { type: 'number', description: 'Optional world X position' },
        y: { type: 'number', description: 'Optional world Y position; defaults below the last section' },
        width: { type: 'number', description: 'Section width in pixels' },
        height: { type: 'number', description: 'Section height in pixels' },
        fill: { type: 'string', description: 'Section background color' }
      },
      required: ['sectionType']
    },
    execute: async ({ sectionType, name, x = 140, y, width = 1200, height = 640, fill = '#0B1020' }) => {
      const section = store.addLayer({
        type: 'frame',
        name: name || `${sectionType[0].toUpperCase()}${sectionType.slice(1)} Section`,
        sectionType,
        x,
        y: y === undefined ? getNextSectionY(store) : y,
        width,
        height,
        fill,
        stroke: '#253A60',
        cornerRadius: 0
      });
      return { success: true, sectionId: section.id, sectionType: section.sectionType, x: section.x, y: section.y };
    }
  });
  // 7b. Listar secciones por orden visual
  fastwebmcp.registerTool({
    name: 'figma_list_sections',
    title: 'List Design Sections',
    description: 'Lists semantic design sections in their top-to-bottom visual order with their child layer counts.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () => ({
      sections: store.state.layers.filter(isSection).sort((a, b) => a.y - b.y).map(section => ({
        id: section.id,
        name: section.name,
        sectionType: section.sectionType,
        x: section.x,
        y: section.y,
        width: section.width,
        height: section.height,
        childCount: getSectionLayers(store, section.id).length - 1
      }))
    })
  });
  // 7c. Editar metadatos o geometría de una sección
  fastwebmcp.registerTool({
    name: 'figma_update_section',
    title: 'Update Design Section',
    description: 'Updates a semantic section name, type, geometry, or background while preserving its child layers.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Section frame ID' },
        properties: { type: 'object', description: 'Allowed keys: name, sectionType, x, y, width, height, fill' }
      },
      required: ['id', 'properties']
    },
    execute: async ({ id, properties }) => {
      const section = store.getLayerById(id);
      if (!isSection(section)) throw new Error('La capa indicada no es una sección válida.');
      const allowed = ['name', 'sectionType', 'x', 'y', 'width', 'height', 'fill'];
      const next = Object.fromEntries(Object.entries(properties).filter(([key]) => allowed.includes(key)));
      if (next.sectionType && !SECTION_TYPES.includes(next.sectionType)) throw new Error('El tipo de sección no es válido.');
      const updated = store.updateLayer(id, next, true);
      return { success: true, section: updated };
    }
  });
  // 7d. Asignar capas existentes a una sección
  fastwebmcp.registerTool({
    name: 'figma_move_layers_to_section',
    title: 'Move Layers to Section',
    description: 'Assigns existing layers to a semantic section by parentId without changing their current position.',
    inputSchema: {
      type: 'object',
      properties: {
        sectionId: { type: 'string', description: 'Destination section frame ID' },
        ids: { type: 'array', items: { type: 'string' }, description: 'Layer IDs to place in the section' }
      },
      required: ['sectionId', 'ids']
    },
    execute: async ({ sectionId, ids }) => {
      if (!isSection(store.getLayerById(sectionId))) throw new Error('La sección de destino no es válida.');
      const layers = ids.map(id => store.getLayerById(id)).filter(layer => layer && layer.id !== sectionId);
      if (layers.length === 0) throw new Error('No se encontraron capas para mover a la sección.');
      store.recordHistory();
      for (const layer of layers) layer.parentId = sectionId;
      store.notify('layer:parent');
      return { success: true, sectionId, movedIds: layers.map(layer => layer.id), missingIds: ids.filter(id => !store.getLayerById(id)) };
    }
  });
  // 7e. Reordenar secciones y mover con ellas sus capas hijas
  fastwebmcp.registerTool({
    name: 'figma_reorder_sections',
    title: 'Reorder Design Sections',
    description: 'Reorders every listed semantic section vertically and translates each section’s child layers with it.',
    inputSchema: {
      type: 'object',
      properties: { sectionIds: { type: 'array', items: { type: 'string' }, description: 'All section IDs in the desired top-to-bottom order' }, gap: { type: 'number', description: 'Vertical gap between sections in pixels' } },
      required: ['sectionIds']
    },
    execute: async ({ sectionIds, gap = 48 }) => {
      const sections = sectionIds.map(id => store.getLayerById(id));
      if (sections.length === 0 || sections.some(section => !isSection(section))) throw new Error('La lista debe contener únicamente secciones válidas.');
      const knownIds = store.state.layers.filter(isSection).map(section => section.id);
      if (new Set(sectionIds).size !== sectionIds.length || sectionIds.length !== knownIds.length || knownIds.some(id => !sectionIds.includes(id))) {
        throw new Error('sectionIds debe incluir cada sección exactamente una vez.');
      }
      store.recordHistory();
      let nextY = Math.min(...sections.map(section => section.y));
      for (const section of sections) {
        const deltaY = nextY - section.y;
        for (const layer of getSectionLayers(store, section.id)) layer.y += deltaY;
        nextY += section.height + Math.max(0, gap);
      }
      store.notify('section:reorder');
      return { success: true, sectionIds, gap: Math.max(0, gap) };
    }
  });
  // 7f. Enfocar una sección y todo su contenido
  fastwebmcp.registerTool({
    name: 'figma_focus_section',
    title: 'Focus Design Section',
    description: 'Centers and zooms the canvas around one semantic section and its child layers so the user can review it.',
    inputSchema: {
      type: 'object',
      properties: { sectionId: { type: 'string', description: 'Section frame ID to focus' }, padding: { type: 'number', description: 'Empty space around the section' } },
      required: ['sectionId']
    },
    execute: async ({ sectionId, padding = 80 }) => {
      const layers = getSectionLayers(store, sectionId);
      store.setSelection([sectionId]);
      return { success: true, sectionId, ...focusLayers(store, canvasEngine, layers, padding) };
    }
  });
  // 7g. Generar el bloque base de una sección semántica
  fastwebmcp.registerTool({
    name: 'figma_generate_section',
    title: 'Generate Design Section',
    description: 'Creates a semantic section with a frame, heading, supporting copy, and reusable content cards for rapid page composition.',
    inputSchema: {
      type: 'object',
      properties: {
        sectionType: { type: 'string', enum: SECTION_TYPES, description: 'Section type to generate' },
        title: { type: 'string', description: 'Section headline' },
        subtitle: { type: 'string', description: 'Supporting text' },
        x: { type: 'number', description: 'Optional world X position' },
        y: { type: 'number', description: 'Optional world Y position' },
        width: { type: 'number', description: 'Section width in pixels' }
      },
      required: ['sectionType', 'title']
    },
    execute: async ({ sectionType, title, subtitle = '', x = 140, y, width = 1200 }) => {
      const height = ['header', 'logos', 'footer'].includes(sectionType) ? 220 : 560;
      const sectionY = y === undefined ? getNextSectionY(store) : y;
      const section = store.addLayer({ type: 'frame', name: `${sectionType}: ${title}`, sectionType, x, y: sectionY, width, height, fill: '#0B1020', stroke: '#253A60', cornerRadius: 0 });
      const createdIds = [section.id];
      const heading = store.addLayer({ type: 'text', name: `${sectionType} heading`, text: title, x: x + 56, y: sectionY + 64, width: width - 112, height: 58, fontSize: 38, fontWeight: '700', fill: '#FFFFFF', parentId: section.id });
      createdIds.push(heading.id);
      if (subtitle) {
        const body = store.addLayer({ type: 'text', name: `${sectionType} subtitle`, text: subtitle, x: x + 56, y: sectionY + 138, width: width - 112, height: 36, fontSize: 18, fontWeight: '400', fill: '#AEBFE0', parentId: section.id });
        createdIds.push(body.id);
      }
      if (['features', 'testimonials', 'pricing'].includes(sectionType)) {
        const cardWidth = (width - 160) / 3;
        for (let index = 0; index < 3; index += 1) {
          const card = store.addLayer({ type: 'rect', name: `${sectionType} card ${index + 1}`, x: x + 56 + index * (cardWidth + 24), y: sectionY + 240, width: cardWidth, height: 190, fill: '#142440', stroke: '#2F4C7A', strokeWidth: 1, cornerRadius: 16, parentId: section.id });
          createdIds.push(card.id);
        }
      }
      store.setSelection(createdIds);
      return { success: true, sectionId: section.id, sectionType, createdIds };
    }
  });

  // 8. Obtener Árbol de Documento
  fastwebmcp.registerTool({
    name: 'figma_get_document',
    title: 'Get Document Tree',
    description: 'Retrieves the complete document tree with all layers, frames, and viewport state for agent reasoning.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () => {
      return {
        title: store.state.title,
        layerCount: store.state.layers.length,
        persistence: { ...store.persistenceStatus },
        selectedIds: store.state.selectedIds,
        viewport: store.state.viewport,
        layers: store.state.layers.map(l => ({
          id: l.id,
          name: l.name,
          type: l.type,
          x: l.x,
          y: l.y,
          width: l.width,
          height: l.height,
          fill: l.fill,
          stroke: l.stroke,
          text: l.text,
          visible: l.visible,
          softDeleted: !!l.softDeleted,
          effectiveVisible: isLayerEffectivelyVisible(l, store.state.layers),
          annotationKind: l.annotationKind,
          annotationRootId: l.annotationRootId,
          parentId: l.parentId
        }))
      };
    }
  });

  // 8. Exportar Diseño
  fastwebmcp.registerTool({
    name: 'figma_export',
    title: 'Export Design',
    description: 'Exports canvas or specific layer as SVG, PNG, or Tailwind CSS code.',
    inputSchema: {
      type: 'object',
      properties: {
        format: { type: 'string', enum: ['svg', 'tailwind', 'json'], description: 'Export format' },
        layerId: { type: 'string', description: 'Optional ID of specific layer to export' }
      },
      required: ['format']
    },
    execute: async ({ format = 'svg', layerId = null }) => {
      const targetLayers = layerId ? [store.getLayerById(layerId)].filter(Boolean) : store.state.layers;
      if (format === 'svg') {
        const svg = exportToSVG(targetLayers);
        return { format: 'svg', content: svg };
      }
      if (format === 'tailwind') {
        const code = targetLayers.map(l => layerToTailwind(l)).join('\n\n');
        return { format: 'tailwind', code };
      }
      return { format: 'json', data: layerId ? targetLayers : serializeProject(store) };
    }
  });

  // 8b. Exportar el proyecto entero, listo para guardar o compartir
  fastwebmcp.registerTool({
    name: 'figma_export_project',
    title: 'Export Project',
    description: 'Returns the complete editable project as a .figma.json-compatible document, including layers, viewport, settings, and title.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () => {
      const project = serializeProject(store);
      for (const [key, value] of pendingExports) {
        if (value.expiresAt <= Date.now()) pendingExports.delete(key);
      }
      if (pendingExports.size >= 5) pendingExports.delete(pendingExports.keys().next().value);
      const exportToken = `export_project_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      pendingExports.set(exportToken, { serialized: JSON.stringify(project), expiresAt: Date.now() + PENDING_DELETIONS_TTL_MS });
      return { format: 'figma-json', filename: projectFilename(project.title), project, exportToken, expiresInMs: PENDING_DELETIONS_TTL_MS };
    }
  });

  // 8c. Exportar código o SVG de todo el lienzo o una capa concreta
  fastwebmcp.registerTool({
    name: 'figma_export_code',
    title: 'Export Design Code',
    description: 'Returns SVG or Tailwind code for the complete document or one layer. Use when design output is needed as code instead of an editable project.',
    inputSchema: {
      type: 'object',
      properties: {
        format: { type: 'string', enum: ['svg', 'tailwind'], description: 'Code format to export' },
        layerId: { type: 'string', description: 'Optional layer ID to export independently' },
        includeAnnotations: { type: 'boolean', default: false }
      },
      required: ['format']
    },
    annotations: { readOnlyHint: true },
    execute: async ({ format, layerId = null, includeAnnotations = false }) => {
      if (typeof includeAnnotations !== 'boolean') throw new Error('Invalid includeAnnotations.');
      const options = { includeAnnotations, allLayers: store.state.layers };
      const layers = filterDesignLayers(layerId ? [store.getLayerById(layerId)].filter(Boolean) : store.state.layers, options);
      if (layers.length === 0) throw new Error('No se encontraron capas para exportar.');
      if (format === 'svg') {
        return { format, filename: layerId ? 'selection.svg' : 'design.svg', content: exportToSVG(layers, null, options) };
      }
      return {
        format,
        filename: layerId ? 'selection.tailwind.html' : 'design.tailwind.html',
        content: layers.map(layer => layerToTailwind(layer, options)).join('\n\n')
      };
    }
  });

  // 8d. Validar una importación sin tocar el lienzo actual
  fastwebmcp.registerTool({
    name: 'figma_prepare_import_project',
    title: 'Prepare Project Import',
    description: 'Validates a .figma.json project supplied as JSON or a same-origin URL and previews its title and layer count without changing the current canvas.',
    inputSchema: {
      type: 'object',
      properties: {
        projectJson: { type: 'string', description: 'Serialized .figma.json project content to validate' },
        projectUrl: { type: 'string', description: 'Optional same-origin URL of a .figma.json project to validate' },
        exportToken: { type: 'string', description: 'Single-use snapshot token returned by figma_export_project, valid for 60 seconds' }
      }
    },
    execute: async ({ projectJson, projectUrl, exportToken }) => {
      const sources = [projectJson, projectUrl, exportToken].filter(value => value !== undefined);
      if (sources.length !== 1 || typeof sources[0] !== 'string' || !sources[0]) throw new Error('Indica solo uno: projectJson, projectUrl o exportToken como texto no vacío.');

      let serializedProject = projectJson;
      if (exportToken) {
        const snapshot = pendingExports.get(exportToken);
        pendingExports.delete(exportToken);
        if (!snapshot || snapshot.expiresAt <= Date.now()) throw new Error('La exportación no existe o caducó. Exporta nuevamente el proyecto.');
        serializedProject = snapshot.serialized;
      }
      if (projectUrl) {
        const source = new URL(projectUrl, window.location.href);
        if (source.origin !== window.location.origin) {
          throw new Error('projectUrl debe pertenecer al mismo origen que el clon.');
        }
        const response = await fetch(source.href, { credentials: 'same-origin' });
        if (!response.ok) throw new Error(`No se pudo leer el proyecto (${response.status}).`);
        serializedProject = await response.text();
      }

      let project;
      try {
        project = JSON.parse(serializedProject);
      } catch {
        throw new Error('El proyecto no contiene JSON válido.');
      }
      if (!Array.isArray(project.layers)) throw new Error('El proyecto no contiene un array de capas válido.');
      const token = createImportToken(project);
      return {
        confirmationToken: token,
        expiresInMs: PENDING_DELETIONS_TTL_MS,
        title: project.title || 'Untitled Figma Project',
        layerCount: project.layers.length,
        replacesCurrentLayerCount: store.state.layers.length
      };
    }
  });

  // 8e. Reemplazar el proyecto actual únicamente tras confirmación
  fastwebmcp.registerTool({
    name: 'figma_confirm_import_project',
    title: 'Confirm Project Import',
    description: 'Replaces the current canvas with the validated project prepared by figma_prepare_import_project.',
    inputSchema: {
      type: 'object',
      properties: { confirmationToken: { type: 'string', description: 'Token returned by figma_prepare_import_project' } },
      required: ['confirmationToken']
    },
    execute: async ({ confirmationToken }) => {
      const project = consumeImportToken(confirmationToken);
      const result = importFromJSON(JSON.stringify(project), store);
      if (!result.success) throw new Error(result.error || 'No se pudo importar el proyecto.');
      let persistence;
      try { persistence = await store.flushPersistence?.(); }
      catch (error) { persistence = { status: 'error', message: error.message }; }
      return { success: true, title: project.title || store.state.title, layerCount: result.count, persisted: persistence?.status === 'saved', persistence };
    }
  });

  // 9. Asistente Generativo de Diseño por Prompt Natural
  fastwebmcp.registerTool({
    name: 'figma_generate_design_prompt',
    title: 'AI Design Copilot Prompt',
    description: 'Translates natural language UI design prompt into vector layers on the canvas.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Natural language description of the design to generate' }
      },
      required: ['prompt']
    },
    execute: async ({ prompt }) => {
      const lower = prompt.toLowerCase();
      const originX = 140;
      const originY = 100;

      // Smart heuristics for instant natural language creation
      if (lower.includes('login') || lower.includes('auth') || lower.includes('iniciar sesión')) {
        const layers = store.addLayers(UI_TEMPLATES.mobile_login.create(originX, originY));
        return { message: 'Se ha generado la pantalla de inicio de sesión móvil en el lienzo.', elements: layers.length };
      }

      if (lower.includes('hero') || lower.includes('landing') || lower.includes('header') || lower.includes('saas')) {
        const layers = store.addLayers(UI_TEMPLATES.saas_hero.create(originX, originY));
        return { message: 'Se ha generado la sección Hero SaaS con barra de navegación en el lienzo.', elements: layers.length };
      }

      if (lower.includes('metric') || lower.includes('card') || lower.includes('dashboard') || lower.includes('analytics') || lower.includes('tarjeta')) {
        const layers = store.addLayers(UI_TEMPLATES.dashboard_card.create(originX, originY));
        return { message: 'Se ha generado la tarjeta de analítica con métricas en el lienzo.', elements: layers.length };
      }

      // Si es un botón genérico
      if (lower.includes('button') || lower.includes('botón')) {
        const btnId = `btn_${Date.now()}`;
        const rect = store.addLayer({
          type: 'rect',
          name: 'Button Primary',
          x: originX,
          y: originY,
          width: 160,
          height: 48,
          fill: '#0d99ff',
          cornerRadius: 10,
          shadow: { x: 0, y: 4, blur: 12, color: 'rgba(13, 153, 255, 0.35)' }
        });
        const txt = store.addLayer({
          type: 'text',
          name: 'Button Label',
          text: 'Get Started',
          x: originX + 35,
          y: originY + 15,
          fontSize: 15,
          fontWeight: '600',
          fill: '#ffffff'
        });
        store.setSelection([rect.id, txt.id]);
        return { message: 'Botón generado en el lienzo.', elements: 2 };
      }

      // Creación paramétrica libre
      const newFrame = store.addLayer({
        type: 'frame',
        name: `AI Concept: ${prompt.slice(0, 20)}`,
        x: originX,
        y: originY,
        width: 420,
        height: 320,
        fill: '#18181b',
        stroke: '#3f3f46',
        cornerRadius: 16
      });
      const title = store.addLayer({
        type: 'text',
        name: 'Concept Title',
        text: prompt,
        x: originX + 24,
        y: originY + 24,
        fontSize: 20,
        fontWeight: '700',
        fill: '#ffffff',
        width: 372
      });
      return { message: `Concepto generado en el lienzo para: "${prompt}"`, elements: 2 };
    }
  });

  return fastwebmcp;
}
