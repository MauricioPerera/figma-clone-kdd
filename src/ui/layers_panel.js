/**
 * Panel izquierdo de Capas y Recursos (Layers & Assets) para Figma Clone KDD.
 */

import { UI_TEMPLATES } from '../engine/templates.js';

export class LayersPanel {
  constructor(container, store) {
    this.container = container;
    this.store = store;
    this.activeTab = 'layers'; // 'layers' | 'assets'
    this.searchQuery = '';

    this.render();
    this.store.subscribe(() => this.updateList());
  }

  render() {
    this.container.innerHTML = `
      <div class="h-full flex flex-col bg-[#242424] border-r border-[#383838] text-gray-200 select-none text-xs font-sans">
        <!-- Pestañas Superiores -->
        <div class="flex border-b border-[#383838] bg-[#1e1e1e]">
          <button id="tab-layers" class="flex-1 py-2.5 text-center font-medium border-b-2 border-[#0d99ff] text-white transition-colors">
            Capas
          </button>
          <button id="tab-assets" class="flex-1 py-2.5 text-center font-medium border-b-2 border-transparent text-gray-400 hover:text-gray-200 transition-colors">
            Componentes
          </button>
        </div>

        <!-- Barra de Búsqueda y Acciones Rápidas -->
        <div class="p-2 border-b border-[#383838] bg-[#242424] flex items-center space-x-1.5">
          <div class="relative flex-1">
            <input type="text" id="layer-search" placeholder="Buscar capas..." 
              class="w-full bg-[#181818] text-gray-200 px-2.5 py-1.5 rounded text-[11px] border border-[#383838] focus:border-[#0d99ff] outline-none" />
          </div>
          <button id="btn-delete-selected" class="w-7 h-7 rounded hover:bg-[#3e3e3e] flex items-center justify-center text-gray-400 hover:text-red-400" title="Eliminar seleccionadas (Delete)">
            🗑
          </button>
        </div>

        <!-- Contenedor de la Lista de Capas -->
        <div id="layers-list-container" class="flex-1 overflow-y-auto overflow-x-hidden p-1 space-y-0.5 custom-scrollbar">
          <!-- Se inyecta dinámicamente -->
        </div>

        <!-- Contenedor de Assets (Oculto por defecto) -->
        <div id="assets-container" class="hidden flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
          <div class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Frames Predefinidos</div>
          <div class="grid grid-cols-2 gap-2">
            <button class="asset-frame-btn p-2.5 bg-[#1e1e1e] hover:bg-[#2e2e2e] border border-[#383838] rounded-lg text-left transition-colors" data-w="390" data-h="844" data-name="iPhone 16">
              <div class="font-medium text-white">iPhone 16</div>
              <div class="text-[10px] text-gray-400">390 × 844</div>
            </button>
            <button class="asset-frame-btn p-2.5 bg-[#1e1e1e] hover:bg-[#2e2e2e] border border-[#383838] rounded-lg text-left transition-colors" data-w="1440" data-h="900" data-name="Desktop 1440">
              <div class="font-medium text-white">Desktop</div>
              <div class="text-[10px] text-gray-400">1440 × 900</div>
            </button>
          </div>

          <div class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider pt-2">Plantillas UI Rápidas</div>
          <div class="space-y-2">
            <button class="asset-template-btn w-full p-2.5 bg-[#1e1e1e] hover:bg-[#2e2e2e] border border-[#383838] rounded-lg text-left flex items-center justify-between transition-colors" data-template="mobile_login">
              <div>
                <div class="font-medium text-white">Mobile Login</div>
                <div class="text-[10px] text-gray-400">Auth screen con inputs</div>
              </div>
              <span class="text-xs text-[#0d99ff] font-bold">+ Insert</span>
            </button>
            <button class="asset-template-btn w-full p-2.5 bg-[#1e1e1e] hover:bg-[#2e2e2e] border border-[#383838] rounded-lg text-left flex items-center justify-between transition-colors" data-template="saas_hero">
              <div>
                <div class="font-medium text-white">SaaS Hero Section</div>
                <div class="text-[10px] text-gray-400">Header con navbar y botones</div>
              </div>
              <span class="text-xs text-[#0d99ff] font-bold">+ Insert</span>
            </button>
            <button class="asset-template-btn w-full p-2.5 bg-[#1e1e1e] hover:bg-[#2e2e2e] border border-[#383838] rounded-lg text-left flex items-center justify-between transition-colors" data-template="dashboard_card">
              <div>
                <div class="font-medium text-white">Analytics Card</div>
                <div class="text-[10px] text-gray-400">Métrica con gráfica de barras</div>
              </div>
              <span class="text-xs text-[#0d99ff] font-bold">+ Insert</span>
            </button>
          </div>
        </div>

        <!-- Pie de Panel: Contador de Capas -->
        <div class="p-2 border-t border-[#383838] bg-[#1e1e1e] flex items-center justify-between text-[11px] text-gray-400">
          <span id="layer-count">0 capas</span>
          <div class="flex space-x-1">
            <button id="btn-reorder-up" class="px-1.5 py-0.5 rounded hover:bg-[#333333]" title="Traer hacia adelante (Ctrl + ])">▲</button>
            <button id="btn-reorder-down" class="px-1.5 py-0.5 rounded hover:bg-[#333333]" title="Enviar hacia atrás (Ctrl + [)">▼</button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    this.updateList();
  }

  bindEvents() {
    const { container } = this;

    // Tabs
    const tabLayers = container.querySelector('#tab-layers');
    const tabAssets = container.querySelector('#tab-assets');
    const layersList = container.querySelector('#layers-list-container');
    const assetsList = container.querySelector('#assets-container');

    tabLayers.addEventListener('click', () => {
      this.activeTab = 'layers';
      tabLayers.classList.add('border-[#0d99ff]', 'text-white');
      tabLayers.classList.remove('border-transparent', 'text-gray-400');
      tabAssets.classList.remove('border-[#0d99ff]', 'text-white');
      tabAssets.classList.add('border-transparent', 'text-gray-400');
      layersList.classList.remove('hidden');
      assetsList.classList.add('hidden');
    });

    tabAssets.addEventListener('click', () => {
      this.activeTab = 'assets';
      tabAssets.classList.add('border-[#0d99ff]', 'text-white');
      tabAssets.classList.remove('border-transparent', 'text-gray-400');
      tabLayers.classList.remove('border-[#0d99ff]', 'text-white');
      tabLayers.classList.add('border-transparent', 'text-gray-400');
      assetsList.classList.remove('hidden');
      layersList.classList.add('hidden');
    });

    // Búsqueda
    const searchInput = container.querySelector('#layer-search');
    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase();
      this.updateList();
    });

    // Borrar seleccionadas
    container.querySelector('#btn-delete-selected').addEventListener('click', () => {
      this.store.deleteLayers();
    });

    // Reordenar
    container.querySelector('#btn-reorder-up').addEventListener('click', () => {
      const selected = this.store.state.selectedIds[0];
      if (selected) this.store.bringForward(selected);
    });

    container.querySelector('#btn-reorder-down').addEventListener('click', () => {
      const selected = this.store.state.selectedIds[0];
      if (selected) this.store.sendBackward(selected);
    });

    // Insertar Frames predefinidos
    container.querySelectorAll('.asset-frame-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const w = parseInt(btn.getAttribute('data-w'), 10);
        const h = parseInt(btn.getAttribute('data-h'), 10);
        const name = btn.getAttribute('data-name');
        this.store.addLayer({
          type: 'frame',
          name,
          width: w,
          height: h,
          x: 100,
          y: 80,
          fill: '#1e1e1e',
          cornerRadius: 16
        });
      });
    });

    // Insertar Plantillas
    container.querySelectorAll('.asset-template-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tplKey = btn.getAttribute('data-template');
        const tpl = UI_TEMPLATES[tplKey];
        if (tpl) {
          const layers = tpl.create(120, 100);
          this.store.recordHistory();
          this.store.state.layers.push(...layers);
          this.store.setSelection(layers.map(l => l.id));
          this.store.notify('layer:add');
        }
      });
    });
  }

  updateList() {
    const listContainer = this.container.querySelector('#layers-list-container');
    const countBadge = this.container.querySelector('#layer-count');
    if (!listContainer) return;

    const { layers, selectedIds } = this.store.state;
    if (countBadge) countBadge.textContent = `${layers.length} capas`;

    // Filtro de búsqueda
    const filtered = layers.slice().reverse().filter(l => {
      if (!this.searchQuery) return true;
      return l.name.toLowerCase().includes(this.searchQuery) || l.type.toLowerCase().includes(this.searchQuery);
    });

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div class="p-6 text-center text-gray-500 text-xs">
          ${this.searchQuery ? 'No se encontraron capas.' : 'El lienzo está vacío.<br>Usa las herramientas superiores o Componentes para empezar.'}
        </div>
      `;
      return;
    }

    listContainer.innerHTML = '';

    for (const layer of filtered) {
      const isSelected = selectedIds.includes(layer.id);
      const row = document.createElement('div');
      row.className = `group flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-colors ${
        isSelected ? 'bg-[#0d99ff]/20 text-white font-medium border-l-2 border-[#0d99ff]' : 'hover:bg-[#2c2c2c] text-gray-300'
      }`;

      const icon = this.getLayerIcon(layer.type);
      row.innerHTML = `
        <div class="flex items-center space-x-2 truncate flex-1 min-w-0">
          <span class="text-gray-400 font-mono text-[11px]">${icon}</span>
          <span class="truncate text-[11px] layer-name">${escapeHtml(layer.name)}</span>
        </div>
        <div class="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <!-- Visibilidad -->
          <button class="btn-vis w-5 h-5 flex items-center justify-center rounded hover:bg-[#383838] text-gray-400 hover:text-white" title="${layer.visible ? 'Ocultar' : 'Mostrar'}">
            ${layer.visible ? '👁' : '🚫'}
          </button>
          <!-- Bloqueo -->
          <button class="btn-lock w-5 h-5 flex items-center justify-center rounded hover:bg-[#383838] text-gray-400 hover:text-white" title="${layer.locked ? 'Desbloquear' : 'Bloquear'}">
            ${layer.locked ? '🔒' : '🔓'}
          </button>
        </div>
      `;

      // Eventos de la fila
      row.addEventListener('click', (e) => {
        if (e.target.closest('.btn-vis') || e.target.closest('.btn-lock')) return;
        this.store.setSelection(layer.id, e.shiftKey);
      });

      // Doble click para editar nombre
      row.addEventListener('dblclick', (e) => {
        if (e.target.closest('.btn-vis') || e.target.closest('.btn-lock')) return;
        const nameSpan = row.querySelector('.layer-name');
        const input = document.createElement('input');
        input.type = 'text';
        input.value = layer.name;
        input.className = 'bg-[#121212] text-white px-1 py-0.5 rounded border border-[#0d99ff] text-[11px] outline-none w-full';
        nameSpan.replaceWith(input);
        input.focus();
        input.select();

        const commit = () => {
          layer.name = input.value.trim() || layer.name;
          this.store.notify('layer:update');
        };
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (ke) => {
          if (ke.key === 'Enter') commit();
          if (ke.key === 'Escape') this.updateList();
        });
      });

      // Toggle visibilidad
      row.querySelector('.btn-vis').addEventListener('click', (e) => {
        e.stopPropagation();
        this.store.updateLayer(layer.id, { visible: !layer.visible });
      });

      // Toggle bloqueo
      row.querySelector('.btn-lock').addEventListener('click', (e) => {
        e.stopPropagation();
        this.store.updateLayer(layer.id, { locked: !layer.locked });
      });

      listContainer.appendChild(row);
    }
  }

  getLayerIcon(type) {
    const map = {
      frame: '#',
      rect: '◻',
      circle: '○',
      polygon: '▲',
      star: '★',
      line: '―',
      arrow: '➔',
      text: 'T',
      image: '🖼'
    };
    return map[type] || '▪';
  }
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
