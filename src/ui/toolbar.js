/**
 * Barra de herramientas superior para Figma Clone KDD.
 */

export class Toolbar {
  constructor(container, store, canvasEngine, onOpenTemplates, onOpenWebMcp, onOpenShortcuts) {
    this.container = container;
    this.store = store;
    this.engine = canvasEngine;
    this.onOpenTemplates = onOpenTemplates;
    this.onOpenWebMcp = onOpenWebMcp;
    this.onOpenShortcuts = onOpenShortcuts;

    this.render();
    this.store.subscribe(() => this.updateState());
  }

  render() {
    this.container.innerHTML = `
      <div class="h-12 bg-[#2c2c2c] border-b border-[#383838] flex items-center justify-between px-3 select-none text-white text-xs font-sans">
        <!-- Izquierda: Menú Figma & Herramientas -->
        <div class="flex items-center space-x-1">
          <!-- Menú Dropdown -->
          <div class="relative group">
            <button id="figma-menu-btn" class="w-8 h-8 rounded hover:bg-[#3e3e3e] flex items-center justify-center transition-colors text-white" title="Main Menu">
              <svg class="w-4 h-4" viewBox="0 0 38 57" fill="none">
                <path d="M19 28.5C19 23.2533 23.2533 19 28.5 19C33.7467 19 38 23.2533 38 28.5C38 33.7467 33.7467 38 28.5 38C23.2533 38 19 33.7467 19 28.5Z" fill="#1ABCFE"/>
                <path d="M0 47.5C0 42.2533 4.25329 38 9.5 38H19V47.5C19 52.7467 14.7467 57 9.5 57C4.25329 57 0 52.7467 0 47.5Z" fill="#0ACF83"/>
                <path d="M19 0V19H28.5C33.7467 19 38 14.7467 38 9.5C38 4.25329 33.7467 0 28.5 0H19Z" fill="#FF7262"/>
                <path d="M0 9.5C0 14.7467 4.25329 19 9.5 19H19V0H9.5C4.25329 0 0 4.25329 0 9.5Z" fill="#F24E1E"/>
                <path d="M0 28.5C0 33.7467 4.25329 38 9.5 38H19V19H9.5C4.25329 19 0 23.2533 0 28.5Z" fill="#A259FF"/>
              </svg>
            </button>
            <!-- Dropdown Menu -->
            <div class="hidden group-hover:block absolute left-0 top-full mt-1 w-52 bg-[#222222] border border-[#3e3e3e] rounded-lg shadow-2xl py-1 z-50">
              <button id="menu-new" class="w-full text-left px-3 py-1.5 hover:bg-[#0d99ff] hover:text-white flex items-center justify-between text-gray-200">
                <span>Nuevo Lienzo</span>
                <span class="text-[10px] text-gray-400">Ctrl+N</span>
              </button>
              <button id="menu-export-svg" class="w-full text-left px-3 py-1.5 hover:bg-[#0d99ff] hover:text-white flex items-center justify-between text-gray-200">
                <span>Exportar SVG</span>
                <span class="text-[10px] text-gray-400">SVG</span>
              </button>
              <button id="menu-export-png" class="w-full text-left px-3 py-1.5 hover:bg-[#0d99ff] hover:text-white flex items-center justify-between text-gray-200">
                <span>Exportar PNG (2x)</span>
                <span class="text-[10px] text-gray-400">PNG</span>
              </button>
              <button id="menu-export-json" class="w-full text-left px-3 py-1.5 hover:bg-[#0d99ff] hover:text-white flex items-center justify-between text-gray-200">
                <span>Guardar Proyecto</span>
                <span class="text-[10px] text-gray-400">JSON</span>
              </button>
              <div class="border-t border-[#333333] my-1"></div>
              <label class="w-full text-left px-3 py-1.5 hover:bg-[#0d99ff] hover:text-white flex items-center justify-between text-gray-200 cursor-pointer">
                <span>Abrir Proyecto...</span>
                <input type="file" id="menu-import-json" accept=".json" class="hidden">
              </label>
            </div>
          </div>

          <div class="h-4 w-px bg-[#444444] mx-1"></div>

          <!-- Botones de Herramientas -->
          <div class="flex items-center space-x-0.5" id="tool-buttons">
            <button data-tool="select" class="tool-btn w-8 h-8 rounded flex items-center justify-center transition-colors text-white" title="Move (V)">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 4l7.07 17 2.51-7.39L21 11.07 4 4z"/>
              </svg>
            </button>
            <button data-tool="frame" class="tool-btn w-8 h-8 rounded flex items-center justify-center transition-colors text-gray-400 hover:text-white" title="Frame (F)">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="4" y1="9" x2="20" y2="9"/>
                <line x1="4" y1="15" x2="20" y2="15"/>
                <line x1="9" y1="4" x2="9" y2="20"/>
                <line x1="15" y1="4" x2="15" y2="20"/>
              </svg>
            </button>

            <!-- Dropdown Figuras -->
            <div class="relative group">
              <button data-tool="rect" id="shape-main-btn" class="tool-btn w-8 h-8 rounded flex items-center justify-center transition-colors text-gray-400 hover:text-white" title="Rectangle (R)">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                </svg>
              </button>
              <div class="hidden group-hover:block absolute left-0 top-full mt-1 w-40 bg-[#222222] border border-[#3e3e3e] rounded shadow-2xl py-1 z-50">
                <button data-tool="rect" class="sub-tool-btn w-full text-left px-3 py-1.5 hover:bg-[#0d99ff] hover:text-white flex items-center space-x-2 text-gray-200">
                  <span class="w-3.5 h-3.5 border border-current rounded-sm"></span>
                  <span>Rectangle (R)</span>
                </button>
                <button data-tool="circle" class="sub-tool-btn w-full text-left px-3 py-1.5 hover:bg-[#0d99ff] hover:text-white flex items-center space-x-2 text-gray-200">
                  <span class="w-3.5 h-3.5 border border-current rounded-full"></span>
                  <span>Ellipse (O)</span>
                </button>
                <button data-tool="polygon" class="sub-tool-btn w-full text-left px-3 py-1.5 hover:bg-[#0d99ff] hover:text-white flex items-center space-x-2 text-gray-200">
                  <span>▲</span>
                  <span>Polygon</span>
                </button>
                <button data-tool="star" class="sub-tool-btn w-full text-left px-3 py-1.5 hover:bg-[#0d99ff] hover:text-white flex items-center space-x-2 text-gray-200">
                  <span>★</span>
                  <span>Star</span>
                </button>
                <button data-tool="line" class="sub-tool-btn w-full text-left px-3 py-1.5 hover:bg-[#0d99ff] hover:text-white flex items-center space-x-2 text-gray-200">
                  <span>―</span>
                  <span>Line (L)</span>
                </button>
                <button data-tool="arrow" class="sub-tool-btn w-full text-left px-3 py-1.5 hover:bg-[#0d99ff] hover:text-white flex items-center space-x-2 text-gray-200">
                  <span>➔</span>
                  <span>Arrow (Shift+L)</span>
                </button>
              </div>
            </div>

            <button data-tool="text" class="tool-btn w-8 h-8 rounded flex items-center justify-center transition-colors text-gray-400 hover:text-white" title="Text (T)">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="4 7 4 4 20 4 20 7"/>
                <line x1="9" y1="20" x2="15" y2="20"/>
                <line x1="12" y1="4" x2="12" y2="20"/>
              </svg>
            </button>

            <button data-tool="hand" class="tool-btn w-8 h-8 rounded flex items-center justify-center transition-colors text-gray-400 hover:text-white" title="Hand Pan (H / Space)">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/>
                <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/>
                <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/>
                <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
              </svg>
            </button>
          </div>

          <div class="h-4 w-px bg-[#444444] mx-1"></div>

          <!-- Botones Deshacer / Rehacer -->
          <button id="btn-undo" class="w-8 h-8 rounded flex items-center justify-center transition-colors text-gray-400 hover:text-white disabled:opacity-30" title="Undo (Ctrl+Z)">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 7v6h6"/>
              <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
            </svg>
          </button>
          <button id="btn-redo" class="w-8 h-8 rounded flex items-center justify-center transition-colors text-gray-400 hover:text-white disabled:opacity-30" title="Redo (Ctrl+Y)">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 7v6h-6"/>
              <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/>
            </svg>
          </button>
        </div>

        <!-- Centro: Nombre del Archivo / Documento -->
        <div class="flex items-center space-x-2">
          <input id="doc-title-input" type="text" value="${this.store.state.title}" 
            class="bg-transparent hover:bg-[#3a3a3a] focus:bg-[#1a1a1a] px-2.5 py-1 rounded text-center text-xs text-gray-200 border border-transparent focus:border-[#0d99ff] outline-none font-medium transition-colors" />
          <span class="text-[10px] text-gray-500 font-mono">100% Client-Side</span>
        </div>

        <!-- Derecha: Plantillas, WebMCP AI Agent, Zoom & Exportar -->
        <div class="flex items-center space-x-2">
          <!-- Botón Plantillas -->
          <button id="btn-open-templates" class="h-8 px-2.5 rounded bg-[#383838] hover:bg-[#444444] text-gray-200 flex items-center space-x-1.5 transition-colors" title="Insert UI Templates">
            <span>❖</span>
            <span class="font-medium">Templates</span>
          </button>

          <!-- Botón WebMCP AI Agent -->
          <button id="btn-open-webmcp" class="h-8 px-3 rounded bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium flex items-center space-x-1.5 shadow-sm transition-all" title="WebMCP AI Copilot & Tools">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>WebMCP Agent</span>
          </button>

          <div class="h-4 w-px bg-[#444444] mx-1"></div>

          <!-- Selector de Zoom -->
          <div class="relative group">
            <button id="zoom-indicator" class="h-8 px-2 rounded hover:bg-[#3e3e3e] flex items-center space-x-1 text-gray-300 font-mono">
              <span id="zoom-text">${Math.round(this.store.state.viewport.zoom * 100)}%</span>
              <span class="text-[9px]">▼</span>
            </button>
            <div class="hidden group-hover:block absolute right-0 top-full mt-1 w-32 bg-[#222222] border border-[#3e3e3e] rounded shadow-2xl py-1 z-50 font-sans">
              <button class="zoom-opt w-full text-left px-3 py-1 hover:bg-[#0d99ff] text-gray-200" data-zoom="0.5">50%</button>
              <button class="zoom-opt w-full text-left px-3 py-1 hover:bg-[#0d99ff] text-gray-200" data-zoom="1.0">100%</button>
              <button class="zoom-opt w-full text-left px-3 py-1 hover:bg-[#0d99ff] text-gray-200" data-zoom="2.0">200%</button>
              <button id="btn-zoom-fit" class="w-full text-left px-3 py-1 hover:bg-[#0d99ff] text-gray-200 border-t border-[#333]">Zoom to fit</button>
            </div>
          </div>

          <!-- Botón Atajos -->
          <button id="btn-shortcuts" class="w-8 h-8 rounded hover:bg-[#3e3e3e] flex items-center justify-center text-gray-400 hover:text-white" title="Keyboard Shortcuts (?)">
            <span class="font-bold text-sm">?</span>
          </button>
        </div>
      </div>
    `;

    this.bindEvents();
    this.updateState();
  }

  bindEvents() {
    const { container } = this;

    // Cambiar de herramienta
    container.querySelectorAll('.tool-btn, .sub-tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.getAttribute('data-tool');
        if (tool) {
          this.engine.setTool(tool);
          this.updateActiveToolBtn(tool);
        }
      });
    });

    // Deshacer / Rehacer
    container.querySelector('#btn-undo').addEventListener('click', () => this.store.undo());
    container.querySelector('#btn-redo').addEventListener('click', () => this.store.redo());

    // Modales y drawers
    container.querySelector('#btn-open-templates').addEventListener('click', () => this.onOpenTemplates());
    container.querySelector('#btn-open-webmcp').addEventListener('click', () => this.onOpenWebMcp());
    container.querySelector('#btn-shortcuts').addEventListener('click', () => this.onOpenShortcuts());

    // Zoom options
    container.querySelectorAll('.zoom-opt').forEach(b => {
      b.addEventListener('click', () => {
        const z = parseFloat(b.getAttribute('data-zoom'));
        this.store.setViewport(this.store.state.viewport.panX, this.store.state.viewport.panY, z);
      });
    });

    container.querySelector('#btn-zoom-fit').addEventListener('click', () => {
      this.store.setViewport(100, 80, 1.0);
    });

    // Título del documento
    const titleInput = container.querySelector('#doc-title-input');
    titleInput.addEventListener('change', () => {
      this.store.state.title = titleInput.value || 'Untitled Project';
      this.store.saveToStorage();
    });

    // Menú Exportaciones
    container.querySelector('#menu-export-svg').addEventListener('click', () => {
      import('../engine/export.js').then(exp => {
        const svg = exp.exportToSVG(this.store.state.layers);
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        exp.downloadFile('design.svg', URL.createObjectURL(blob));
      });
    });

    container.querySelector('#menu-export-png').addEventListener('click', () => {
      import('../engine/export.js').then(exp => {
        exp.exportToPNG(this.engine.canvas, this.store.state.layers, 2);
      });
    });

    container.querySelector('#menu-export-json').addEventListener('click', () => {
      import('../engine/export.js').then(exp => {
        exp.exportToJSON(this.store);
      });
    });

    container.querySelector('#menu-import-json').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          import('../engine/export.js').then(exp => {
            exp.importFromJSON(ev.target.result, this.store);
          });
        };
        reader.readAsText(file);
      }
    });

    container.querySelector('#menu-new').addEventListener('click', () => {
      if (confirm('¿Deseas crear un nuevo lienzo? Se borrarán las capas no guardadas.')) {
        this.store.clearCanvas();
      }
    });
  }

  updateActiveToolBtn(tool) {
    this.container.querySelectorAll('.tool-btn').forEach(btn => {
      const bTool = btn.getAttribute('data-tool');
      if (bTool === tool) {
        btn.classList.add('bg-[#0d99ff]', 'text-white');
        btn.classList.remove('text-gray-400');
      } else {
        btn.classList.remove('bg-[#0d99ff]');
        btn.classList.add('text-gray-400');
      }
    });
  }

  updateState() {
    const undoBtn = this.container.querySelector('#btn-undo');
    const redoBtn = this.container.querySelector('#btn-redo');
    const zoomText = this.container.querySelector('#zoom-text');

    if (undoBtn) undoBtn.disabled = !this.store.canUndo();
    if (redoBtn) redoBtn.disabled = !this.store.canRedo();
    if (zoomText) zoomText.textContent = `${Math.round(this.store.state.viewport.zoom * 100)}%`;
    this.updateActiveToolBtn(this.engine.activeTool);
  }
}
