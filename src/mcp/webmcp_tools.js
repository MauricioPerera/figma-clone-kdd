/**
 * Registro de herramientas WebMCP formales para Figma Clone KDD.
 * Conforme a knowledge/architecture/webmcp-integration.md y contracts/task_webmcp_bridge.md
 */

import { fastwebmcp } from './fastwebmcp_runtime.js';
import { UI_TEMPLATES } from '../engine/templates.js';
import { exportToSVG, layerToTailwind } from '../engine/export.js';

export function registerFigmaWebMcpTools(store, canvasEngine) {
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
        fill: { type: 'string', description: 'Hex background color (e.g. #1e1e1e)' }
      },
      required: ['width', 'height']
    },
    execute: async ({ name = 'Frame', width = 390, height = 844, x = 100, y = 100, fill = '#1e1e1e' }) => {
      const layer = store.addLayer({
        type: 'frame',
        name,
        width,
        height,
        x,
        y,
        fill,
        stroke: '#2c2c2c',
        cornerRadius: 16
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
        cornerRadius: { type: 'number', description: 'Corner radius in px' }
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
        cornerRadius: params.cornerRadius || 0
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
        fill: { type: 'string', description: 'Text color hex' }
      },
      required: ['text']
    },
    execute: async ({ text, x = 100, y = 100, fontSize = 20, fontWeight = '600', fill = '#ffffff' }) => {
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
        height: fontSize * 1.5
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
      store.recordHistory();
      const layers = tpl.create(x, y);
      const createdIds = [];
      for (const l of layers) {
        store.state.layers.push(l);
        createdIds.push(l.id);
      }
      store.setSelection(createdIds);
      store.notify('layer:add');
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

  // 6. Eliminar Capas
  fastwebmcp.registerTool({
    name: 'figma_delete_layers',
    title: 'Delete Layers',
    description: 'Removes one or more layers from the canvas.',
    inputSchema: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string' }, description: 'Array of layer IDs to delete' }
      },
      required: ['ids']
    },
    execute: async ({ ids }) => {
      store.deleteLayers(ids);
      return { success: true, deletedCount: ids.length };
    }
  });

  // 7. Obtener Árbol de Documento
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
      return { format: 'json', data: store.state.layers };
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
        const layers = UI_TEMPLATES.mobile_login.create(originX, originY);
        store.recordHistory();
        store.state.layers.push(...layers);
        store.setSelection(layers.map(l => l.id));
        store.notify('layer:add');
        return { message: 'Se ha generado la pantalla de inicio de sesión móvil en el lienzo.', elements: layers.length };
      }

      if (lower.includes('hero') || lower.includes('landing') || lower.includes('header') || lower.includes('saas')) {
        const layers = UI_TEMPLATES.saas_hero.create(originX, originY);
        store.recordHistory();
        store.state.layers.push(...layers);
        store.setSelection(layers.map(l => l.id));
        store.notify('layer:add');
        return { message: 'Se ha generado la sección Hero SaaS con barra de navegación en el lienzo.', elements: layers.length };
      }

      if (lower.includes('metric') || lower.includes('card') || lower.includes('dashboard') || lower.includes('analytics') || lower.includes('tarjeta')) {
        const layers = UI_TEMPLATES.dashboard_card.create(originX, originY);
        store.recordHistory();
        store.state.layers.push(...layers);
        store.setSelection(layers.map(l => l.id));
        store.notify('layer:add');
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
