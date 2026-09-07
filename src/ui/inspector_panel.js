/**
 * Panel derecho de Inspección y Propiedades (Inspector) para Figma Clone KDD.
 * Conforme a knowledge/architecture/state-management.md y contracts/task_inspector_sync.md
 */

import { layerToTailwind, exportToSVG, exportToPNG } from '../engine/export.js';
import { fastwebmcp } from '../mcp/fastwebmcp_runtime.js';

export class InspectorPanel {
  constructor(container, store, canvasEngine) {
    this.container = container;
    this.store = store;
    this.engine = canvasEngine;
    this.activeTab = 'design'; // 'design' | 'inspect' | 'webmcp'

    this.render();
    this.store.subscribe((state, event) => {
      this.updateSelection();
    });
  }

  render() {
    this.container.innerHTML = `
      <div class="h-full flex flex-col bg-[#242424] border-l border-[#383838] text-gray-200 select-none text-xs font-sans">
        <!-- Pestañas Superiores -->
        <div class="flex border-b border-[#383838] bg-[#1e1e1e]">
          <button id="tab-design" class="flex-1 py-2.5 text-center font-medium border-b-2 border-[#0d99ff] text-white transition-colors">
            Diseño
          </button>
          <button id="tab-inspect" class="flex-1 py-2.5 text-center font-medium border-b-2 border-transparent text-gray-400 hover:text-gray-200 transition-colors">
            Tailwind CSS
          </button>
          <button id="tab-webmcp-panel" class="flex-1 py-2.5 text-center font-medium border-b-2 border-transparent text-gray-400 hover:text-gray-200 transition-colors">
            WebMCP Form
          </button>
        </div>

        <!-- Contenido Dinámico según la Pestaña -->
        <div id="inspector-content" class="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
          <!-- Inyectado dinámicamente -->
        </div>
      </div>
    `;

    this.bindTabEvents();
    this.updateSelection();
  }

  bindTabEvents() {
    const { container } = this;
    const tabDesign = container.querySelector('#tab-design');
    const tabInspect = container.querySelector('#tab-inspect');
    const tabWebMcp = container.querySelector('#tab-webmcp-panel');

    const selectTab = (tab) => {
      this.activeTab = tab;
      [tabDesign, tabInspect, tabWebMcp].forEach(t => {
        t.classList.remove('border-[#0d99ff]', 'text-white');
        t.classList.add('border-transparent', 'text-gray-400');
      });
      if (tab === 'design') tabDesign.classList.add('border-[#0d99ff]', 'text-white');
      if (tab === 'inspect') tabInspect.classList.add('border-[#0d99ff]', 'text-white');
      if (tab === 'webmcp') tabWebMcp.classList.add('border-[#0d99ff]', 'text-white');
      this.updateSelection();
    };

    tabDesign.addEventListener('click', () => selectTab('design'));
    tabInspect.addEventListener('click', () => selectTab('inspect'));
    tabWebMcp.addEventListener('click', () => selectTab('webmcp'));
  }

  updateSelection() {
    const content = this.container.querySelector('#inspector-content');
    if (!content) return;

    const selected = this.store.getSelectedLayers();

    if (this.activeTab === 'inspect') {
      this.renderInspectTab(content, selected);
      return;
    }

    if (this.activeTab === 'webmcp') {
      this.renderWebMcpFormTab(content, selected);
      return;
    }

    // Pestaña Diseño
    if (selected.length === 0) {
      content.innerHTML = `
        <div class="space-y-4">
          <div class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Lienzo General</div>
          <div class="p-3 bg-[#1e1e1e] rounded-lg border border-[#383838] space-y-2.5">
            <div class="flex items-center justify-between">
              <span class="text-gray-300">Mostrar Cuadrícula</span>
              <input type="checkbox" id="chk-grid" ${this.store.state.settings.gridEnabled ? 'checked' : ''} class="accent-[#0d99ff]">
            </div>
            <div class="flex items-center justify-between">
              <span class="text-gray-300">Guías Inteligentes</span>
              <input type="checkbox" id="chk-guides" ${this.store.state.settings.snapGuides ? 'checked' : ''} class="accent-[#0d99ff]">
            </div>
          </div>

          <div class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider pt-2">Exportar Proyecto</div>
          <button id="btn-quick-export-svg" class="w-full py-2 bg-[#2c2c2c] hover:bg-[#383838] text-white rounded font-medium transition-colors">
            Descargar SVG Completo
          </button>
          <button id="btn-quick-export-png" class="w-full py-2 bg-[#2c2c2c] hover:bg-[#383838] text-white rounded font-medium transition-colors">
            Descargar PNG (2x)
          </button>

          <div class="pt-6 text-center text-gray-500 text-xs leading-relaxed">
            Selecciona una o más capas en el lienzo para ajustar posición, dimensiones, colores y efectos.
          </div>
        </div>
      `;

      content.querySelector('#chk-grid').addEventListener('change', (e) => {
        this.store.state.settings.gridEnabled = e.target.checked;
        this.store.notify('settings');
      });
      content.querySelector('#chk-guides').addEventListener('change', (e) => {
        this.store.state.settings.snapGuides = e.target.checked;
        this.store.notify('settings');
      });
      content.querySelector('#btn-quick-export-svg').addEventListener('click', () => {
        const svg = exportToSVG(this.store.state.layers);
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        import('../engine/export.js').then(m => m.downloadFile('design.svg', URL.createObjectURL(blob)));
      });
      content.querySelector('#btn-quick-export-png').addEventListener('click', () => {
        exportToPNG(this.engine.canvas, this.store.state.layers, 2);
      });
      return;
    }

    // Si hay una o más capas seleccionadas
    const primary = selected[0];
    content.innerHTML = `
      <!-- 1. Barra de Alineación -->
      <div class="flex items-center justify-between bg-[#1e1e1e] p-1.5 rounded-lg border border-[#383838]">
        <button class="align-btn p-1.5 rounded hover:bg-[#333]" data-align="left" title="Alinear Izquierda">
          <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M2 2h1v12H2V2zm3 2h7v2H5V4zm0 4h9v2H5V8zm0 4h5v2H5v-2z"/></svg>
        </button>
        <button class="align-btn p-1.5 rounded hover:bg-[#333]" data-align="hcenter" title="Centrar Horizontalmente">
          <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M7.5 1h1v14h-1V1zM4 4h8v2H4V4zm-1 4h10v2H3V8zm2 4h6v2H5v-2z"/></svg>
        </button>
        <button class="align-btn p-1.5 rounded hover:bg-[#333]" data-align="right" title="Alinear Derecha">
          <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M13 2h1v12h-1V2zM4 4h7v2H4V4zm-2 4h9v2H2V8zm4 4h5v2H6v-2z"/></svg>
        </button>
        <div class="w-px h-3.5 bg-[#444]"></div>
        <button class="align-btn p-1.5 rounded hover:bg-[#333]" data-align="top" title="Alinear Arriba">
          <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M2 2h12v1H2V2zm2 3v7h2V5H4zm4 0v9h2V5H8zm4 0v5h2V5h-2z"/></svg>
        </button>
        <button class="align-btn p-1.5 rounded hover:bg-[#333]" data-align="vcenter" title="Centrar Verticalmente">
          <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M1 7.5h14v1H1v-1zM4 4v8h2V4H4zm4-1v10h2V3H8zm4 2v6h2V5h-2z"/></svg>
        </button>
        <button class="align-btn p-1.5 rounded hover:bg-[#333]" data-align="bottom" title="Alinear Abajo">
          <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M2 13h12v1H2v-1zM4 4v7h2V4H4zm4-2v9h2V2H8zm4 4v5h2V6h-2z"/></svg>
        </button>
      </div>

      <!-- 2. Geometría (X, Y, W, H, Rotation, CornerRadius) -->
      <div class="space-y-2">
        <div class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Transformación</div>
        <div class="grid grid-cols-2 gap-2">
          <div class="flex items-center bg-[#181818] border border-[#383838] rounded px-2 py-1">
            <span class="text-gray-500 font-mono w-4">X</span>
            <input type="number" id="prop-x" value="${Math.round(primary.x)}" class="w-full bg-transparent text-right outline-none text-white text-xs" />
          </div>
          <div class="flex items-center bg-[#181818] border border-[#383838] rounded px-2 py-1">
            <span class="text-gray-500 font-mono w-4">Y</span>
            <input type="number" id="prop-y" value="${Math.round(primary.y)}" class="w-full bg-transparent text-right outline-none text-white text-xs" />
          </div>
          <div class="flex items-center bg-[#181818] border border-[#383838] rounded px-2 py-1">
            <span class="text-gray-500 font-mono w-4">W</span>
            <input type="number" id="prop-w" value="${Math.round(primary.width)}" min="1" class="w-full bg-transparent text-right outline-none text-white text-xs" />
          </div>
          <div class="flex items-center bg-[#181818] border border-[#383838] rounded px-2 py-1">
            <span class="text-gray-500 font-mono w-4">H</span>
            <input type="number" id="prop-h" value="${Math.round(primary.height)}" min="1" class="w-full bg-transparent text-right outline-none text-white text-xs" />
          </div>
          <div class="flex items-center bg-[#181818] border border-[#383838] rounded px-2 py-1">
            <span class="text-gray-500 font-mono w-4">∠</span>
            <input type="number" id="prop-rotation" value="${Math.round(primary.rotation || 0)}" class="w-full bg-transparent text-right outline-none text-white text-xs" />
          </div>
          <div class="flex items-center bg-[#181818] border border-[#383838] rounded px-2 py-1">
            <span class="text-gray-500 font-mono w-4">⌂</span>
            <input type="number" id="prop-radius" value="${Math.round(primary.cornerRadius || 0)}" min="0" class="w-full bg-transparent text-right outline-none text-white text-xs" />
          </div>
        </div>
      </div>

      <!-- 3. Relleno (Fill) -->
      <div class="space-y-2">
        <div class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Relleno</div>
        <div class="flex items-center space-x-2 bg-[#181818] border border-[#383838] rounded p-1.5">
          <input type="color" id="prop-fill-color" value="${primary.fill && primary.fill !== 'none' ? primary.fill : '#3b82f6'}" class="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0" />
          <input type="text" id="prop-fill-hex" value="${primary.fill || '#3b82f6'}" class="flex-1 bg-transparent uppercase font-mono text-white text-xs outline-none" />
          <button id="prop-fill-none" class="px-2 py-0.5 rounded text-[10px] ${primary.fill === 'none' ? 'bg-[#0d99ff] text-white' : 'bg-[#333] text-gray-400'}">None</button>
        </div>

        <!-- Paleta de colores rápidos -->
        <div class="flex items-center space-x-1.5 pt-1">
          ${['#ffffff', '#000000', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'].map(col => `
            <button class="quick-color-btn w-5 h-5 rounded-full border border-[#444] transition-transform hover:scale-110" style="background: ${col}" data-color="${col}"></button>
          `).join('')}
        </div>
      </div>

      <!-- 4. Trazo (Stroke) -->
      <div class="space-y-2">
        <div class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Trazo</div>
        <div class="flex items-center space-x-2 bg-[#181818] border border-[#383838] rounded p-1.5">
          <input type="color" id="prop-stroke-color" value="${primary.stroke && primary.stroke !== 'none' ? primary.stroke : '#ffffff'}" class="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0" />
          <input type="text" id="prop-stroke-hex" value="${primary.stroke || 'none'}" class="flex-1 bg-transparent uppercase font-mono text-white text-xs outline-none" />
          <input type="number" id="prop-stroke-width" value="${primary.strokeWidth || 1}" min="0" max="40" class="w-12 bg-[#252525] rounded px-1 text-right text-white text-xs outline-none" title="Ancho en px" />
        </div>
      </div>

      <!-- 5. Sombras / Efectos -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Sombra Paralela</span>
          <input type="checkbox" id="prop-shadow-toggle" ${primary.shadow ? 'checked' : ''} class="accent-[#0d99ff]" />
        </div>
      </div>

      <!-- 6. Tipografía (Si es capa de Texto) -->
      ${primary.type === 'text' ? `
        <div class="space-y-2 pt-2 border-t border-[#383838]">
          <div class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Tipografía</div>
          <div class="space-y-1.5">
            <select id="prop-font-family" class="w-full bg-[#181818] border border-[#383838] rounded px-2 py-1 text-white text-xs outline-none">
              <option value="Inter, sans-serif" ${primary.fontFamily?.includes('Inter') ? 'selected' : ''}>Inter</option>
              <option value="Roboto, sans-serif" ${primary.fontFamily?.includes('Roboto') ? 'selected' : ''}>Roboto</option>
              <option value="Poppins, sans-serif" ${primary.fontFamily?.includes('Poppins') ? 'selected' : ''}>Poppins</option>
              <option value="'Fira Code', monospace" ${primary.fontFamily?.includes('Fira') ? 'selected' : ''}>Fira Code</option>
              <option value="Georgia, serif" ${primary.fontFamily?.includes('Georgia') ? 'selected' : ''}>Georgia</option>
            </select>
            <div class="grid grid-cols-2 gap-2">
              <input type="number" id="prop-font-size" value="${primary.fontSize || 16}" min="6" max="200" class="bg-[#181818] border border-[#383838] rounded px-2 py-1 text-white text-xs outline-none" title="Tamaño en px" />
              <select id="prop-font-weight" class="bg-[#181818] border border-[#383838] rounded px-2 py-1 text-white text-xs outline-none">
                <option value="400" ${primary.fontWeight === '400' ? 'selected' : ''}>Regular</option>
                <option value="500" ${primary.fontWeight === '500' ? 'selected' : ''}>Medium</option>
                <option value="600" ${primary.fontWeight === '600' ? 'selected' : ''}>SemiBold</option>
                <option value="700" ${primary.fontWeight === '700' ? 'selected' : ''}>Bold</option>
              </select>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- 7. Exportación Rápida de la Selección -->
      <div class="pt-3 border-t border-[#383838] space-y-2">
        <button id="btn-export-selected-svg" class="w-full py-2 bg-[#0d99ff] hover:bg-[#0088eb] text-white rounded font-medium transition-colors">
          Exportar Selección (SVG)
        </button>
      </div>
    `;

    this.bindDesignInputs(primary, selected);
  }

  bindDesignInputs(primary, selected) {
    const { container } = this;

    // Alineación
    container.querySelectorAll('.align-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const align = btn.getAttribute('data-align');
        if (align) this.store.alignSelection(align);
      });
    });

    // Geometría
    const bindNum = (id, prop) => {
      const el = container.querySelector(id);
      if (el) {
        el.addEventListener('change', () => {
          const val = parseFloat(el.value) || 0;
          this.store.updateSelectedLayers({ [prop]: val }, true);
        });
      }
    };
    bindNum('#prop-x', 'x');
    bindNum('#prop-y', 'y');
    bindNum('#prop-w', 'width');
    bindNum('#prop-h', 'height');
    bindNum('#prop-rotation', 'rotation');
    bindNum('#prop-radius', 'cornerRadius');

    // Fill
    const fillColor = container.querySelector('#prop-fill-color');
    const fillHex = container.querySelector('#prop-fill-hex');
    const fillNone = container.querySelector('#prop-fill-none');

    if (fillColor && fillHex) {
      fillColor.addEventListener('input', () => {
        fillHex.value = fillColor.value;
        this.store.updateSelectedLayers({ fill: fillColor.value }, true);
      });
      fillHex.addEventListener('change', () => {
        fillColor.value = fillHex.value;
        this.store.updateSelectedLayers({ fill: fillHex.value }, true);
      });
    }

    if (fillNone) {
      fillNone.addEventListener('click', () => {
        this.store.updateSelectedLayers({ fill: 'none' }, true);
      });
    }

    // Quick colors
    container.querySelectorAll('.quick-color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const col = btn.getAttribute('data-color');
        this.store.updateSelectedLayers({ fill: col }, true);
      });
    });

    // Stroke
    const strokeColor = container.querySelector('#prop-stroke-color');
    const strokeHex = container.querySelector('#prop-stroke-hex');
    const strokeWidth = container.querySelector('#prop-stroke-width');

    if (strokeColor && strokeHex) {
      strokeColor.addEventListener('input', () => {
        strokeHex.value = strokeColor.value;
        this.store.updateSelectedLayers({ stroke: strokeColor.value }, true);
      });
      strokeHex.addEventListener('change', () => {
        this.store.updateSelectedLayers({ stroke: strokeHex.value }, true);
      });
    }
    if (strokeWidth) {
      strokeWidth.addEventListener('change', () => {
        this.store.updateSelectedLayers({ strokeWidth: parseFloat(strokeWidth.value) || 1 }, true);
      });
    }

    // Shadow
    const shadowToggle = container.querySelector('#prop-shadow-toggle');
    if (shadowToggle) {
      shadowToggle.addEventListener('change', () => {
        const shadow = shadowToggle.checked ? { x: 0, y: 8, blur: 16, color: 'rgba(0,0,0,0.4)' } : null;
        this.store.updateSelectedLayers({ shadow }, true);
      });
    }

    // Typography
    const fontFamily = container.querySelector('#prop-font-family');
    const fontSize = container.querySelector('#prop-font-size');
    const fontWeight = container.querySelector('#prop-font-weight');

    if (fontFamily) {
      fontFamily.addEventListener('change', () => {
        this.store.updateSelectedLayers({ fontFamily: fontFamily.value }, true);
      });
    }
    if (fontSize) {
      fontSize.addEventListener('change', () => {
        this.store.updateSelectedLayers({ fontSize: parseInt(fontSize.value, 10) || 16 }, true);
      });
    }
    if (fontWeight) {
      fontWeight.addEventListener('change', () => {
        this.store.updateSelectedLayers({ fontWeight: fontWeight.value }, true);
      });
    }

    // Exportación de la selección
    const btnExportSel = container.querySelector('#btn-export-selected-svg');
    if (btnExportSel) {
      btnExportSel.addEventListener('click', () => {
        const svg = exportToSVG(selected);
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        import('../engine/export.js').then(m => m.downloadFile('selection.svg', URL.createObjectURL(blob)));
      });
    }
  }

  renderInspectTab(content, selected) {
    if (selected.length === 0) {
      content.innerHTML = `
        <div class="p-4 text-center text-gray-500 text-xs">
          Selecciona un elemento para generar su código Tailwind CSS y HTML correspondiente.
        </div>
      `;
      return;
    }

    const primary = selected[0];
    const tailwindSnippet = layerToTailwind(primary);

    content.innerHTML = `
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Código Tailwind CSS</span>
          <button id="btn-copy-tailwind" class="px-2.5 py-1 bg-[#0d99ff] hover:bg-[#0088eb] text-white rounded font-medium text-[11px] transition-colors">
            Copiar Código
          </button>
        </div>
        <pre class="bg-[#141414] p-3 rounded-lg border border-[#383838] text-[#818cf8] font-mono text-[11px] overflow-x-auto whitespace-pre-wrap leading-relaxed select-text">${escapeHtml(tailwindSnippet)}</pre>
        <div class="text-[11px] text-gray-400 leading-normal">
          Este código traduce automáticamente dimensiones, colores hexadecimales, radio de esquinas, bordes y tipografía a clases utilitarias de Tailwind.
        </div>
      </div>
    `;

    content.querySelector('#btn-copy-tailwind').addEventListener('click', () => {
      navigator.clipboard.writeText(tailwindSnippet).then(() => {
        const btn = content.querySelector('#btn-copy-tailwind');
        btn.textContent = '¡Copiado!';
        setTimeout(() => { btn.textContent = 'Copiar Código'; }, 1500);
      });
    });
  }

  renderWebMcpFormTab(content, selected) {
    content.innerHTML = `
      <div class="space-y-4">
        <div class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Formulario Declarativo WebMCP</div>
        <p class="text-[11px] text-gray-400">
          Formulario HTML con atributos estándar de WebMCP (<code class="text-blue-400">toolname</code>, <code class="text-blue-400">tooldescription</code>) compatible con agentes autónomos.
        </p>

        <!-- Formulario Declarativo para Crear Figura -->
        <form id="webmcp-create-form" toolname="figma_create_shape" tooldescription="Crear nueva figura en el lienzo" class="space-y-3 bg-[#1e1e1e] p-3 rounded-lg border border-[#383838]">
          <div>
            <label class="block text-gray-400 text-[10px] uppercase font-semibold mb-1">Tipo de Figura</label>
            <select name="type" toolparamdescription="Geometría vectorial" class="w-full bg-[#141414] border border-[#383838] rounded px-2 py-1 text-white text-xs outline-none">
              <option value="rect">Rectángulo</option>
              <option value="circle">Círculo / Elipse</option>
              <option value="polygon">Triángulo</option>
              <option value="star">Estrella</option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-gray-400 text-[10px] uppercase font-semibold mb-1">Ancho (px)</label>
              <input type="number" name="width" value="140" toolparamdescription="Ancho en píxeles" class="w-full bg-[#141414] border border-[#383838] rounded px-2 py-1 text-white text-xs outline-none" />
            </div>
            <div>
              <label class="block text-gray-400 text-[10px] uppercase font-semibold mb-1">Alto (px)</label>
              <input type="number" name="height" value="90" toolparamdescription="Alto en píxeles" class="w-full bg-[#141414] border border-[#383838] rounded px-2 py-1 text-white text-xs outline-none" />
            </div>
          </div>
          <div>
            <label class="block text-gray-400 text-[10px] uppercase font-semibold mb-1">Color de Relleno</label>
            <input type="text" name="fill" value="#3b82f6" toolparamdescription="Color hex de relleno" class="w-full bg-[#141414] border border-[#383838] rounded px-2 py-1 text-white text-xs outline-none" />
          </div>
          <button type="submit" class="w-full py-2 bg-[#0d99ff] hover:bg-[#0088eb] text-white rounded font-medium transition-colors">
            Ejecutar Tool (Agent Submit)
          </button>
        </form>

        <div id="webmcp-form-feedback" class="text-xs p-2 rounded bg-[#181818] border border-transparent text-emerald-400 hidden"></div>
      </div>
    `;

    const form = content.querySelector('#webmcp-create-form');
    const feedback = content.querySelector('#webmcp-form-feedback');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const params = {
        type: formData.get('type') || 'rect',
        width: parseInt(formData.get('width'), 10) || 140,
        height: parseInt(formData.get('height'), 10) || 90,
        fill: formData.get('fill') || '#3b82f6',
        x: 150,
        y: 120
      };

      fastwebmcp.invokeTool('figma_create_shape', params).then(res => {
        feedback.textContent = `Tool ejecutado exitosamente con ID: ${res.data.layerId}`;
        feedback.classList.remove('hidden');
        setTimeout(() => feedback.classList.add('hidden'), 3000);
      });
    });
  }
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
