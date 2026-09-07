/**
 * Cajón interactivo WebMCP Agent Console para Figma Clone KDD.
 * Conforme a https://mauricioperera.github.io/fastwebmcp/ y https://webmcp.com
 */

import { fastwebmcp } from '../mcp/fastwebmcp_runtime.js';

export class WebMcpDrawer {
  constructor(store, canvasEngine) {
    this.store = store;
    this.engine = canvasEngine;
    this.drawerEl = null;
    this.createDrawer();
  }

  createDrawer() {
    const el = document.createElement('div');
    el.id = 'webmcp-drawer';
    el.className = 'fixed top-12 right-0 bottom-0 w-96 bg-[#1a1a1a] border-l border-[#333333] shadow-2xl z-40 flex flex-col transform translate-x-full transition-transform duration-300 ease-in-out font-sans text-xs text-gray-200 select-none';
    el.innerHTML = `
      <!-- Header -->
      <div class="p-3 border-b border-[#333333] bg-[#222222] flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span class="font-bold text-sm text-white">WebMCP Agent Console</span>
        </div>
        <button id="btn-close-webmcp-drawer" class="w-6 h-6 rounded hover:bg-[#333] flex items-center justify-center text-gray-400 hover:text-white">✕</button>
      </div>

      <!-- Estado del Runtime -->
      <div class="px-3 py-2 bg-[#141414] border-b border-[#282828] flex items-center justify-between text-[11px]">
        <span class="text-gray-400">Runtime Standard:</span>
        <span class="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono">FastWebMCP v0.4.2</span>
      </div>

      <!-- Cuerpo del Cajón -->
      <div class="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
        <!-- 1. AI Natural Language Prompt -->
        <div class="space-y-2">
          <div class="text-[11px] font-semibold text-gray-300 uppercase tracking-wider flex items-center justify-between">
            <span>AI Design Copilot</span>
            <span class="text-[10px] text-indigo-400 font-mono">Natural Language</span>
          </div>
          <div class="space-y-2">
            <textarea id="ai-prompt-input" rows="3" placeholder="Ej: Diseña una pantalla de inicio de sesión móvil en dark mode..." 
              class="w-full bg-[#111111] text-white p-2.5 rounded-lg border border-[#333] focus:border-[#0d99ff] outline-none text-xs leading-relaxed custom-scrollbar"></textarea>
            <button id="btn-run-ai-prompt" class="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium rounded-lg shadow transition-all flex items-center justify-center space-x-1.5">
              <span>✨ Generar Diseño con IA</span>
            </button>
          </div>
          <!-- Sugerencias Rápidas -->
          <div class="flex flex-wrap gap-1.5 pt-1">
            <button class="ai-chip px-2 py-1 bg-[#252525] hover:bg-[#303030] rounded text-[10px] text-gray-300 transition-colors" data-prompt="Crea una pantalla de login móvil para iOS">📱 Mobile Login</button>
            <button class="ai-chip px-2 py-1 bg-[#252525] hover:bg-[#303030] rounded text-[10px] text-gray-300 transition-colors" data-prompt="Diseña una sección hero SaaS para desktop">💻 SaaS Hero</button>
            <button class="ai-chip px-2 py-1 bg-[#252525] hover:bg-[#303030] rounded text-[10px] text-gray-300 transition-colors" data-prompt="Genera una tarjeta de analítica con métricas de ventas">📊 Metric Card</button>
            <button class="ai-chip px-2 py-1 bg-[#252525] hover:bg-[#303030] rounded text-[10px] text-gray-300 transition-colors" data-prompt="Crea un botón principal moderno">🔘 Button</button>
          </div>
        </div>

        <!-- 2. Catálogo de Herramientas WebMCP Registradas -->
        <div class="space-y-2">
          <div class="text-[11px] font-semibold text-gray-300 uppercase tracking-wider">
            Herramientas Expuestas (${fastwebmcp.getRegisteredTools().length})
          </div>
          <div class="space-y-1.5" id="tools-list-accordion">
            ${fastwebmcp.getRegisteredTools().map(t => `
              <div class="border border-[#2e2e2e] rounded-lg bg-[#202020] overflow-hidden">
                <button class="tool-header-btn w-full px-3 py-2 text-left flex items-center justify-between hover:bg-[#282828] transition-colors" data-tool="${t.name}">
                  <span class="font-mono text-blue-400 font-medium text-[11px]">${t.name}</span>
                  <span class="text-gray-500 text-[10px]">▼</span>
                </button>
                <div class="tool-body hidden p-2.5 bg-[#161616] border-t border-[#2a2a2a] text-[11px] space-y-2">
                  <div class="text-gray-400">${t.description}</div>
                  <pre class="bg-[#0f0f0f] p-2 rounded text-[10px] font-mono text-gray-400 overflow-x-auto">${JSON.stringify(t.inputSchema, null, 2)}</pre>
                  <button class="tool-quick-run px-2.5 py-1 bg-[#2a2a2a] hover:bg-[#383838] text-gray-200 rounded text-[10px] font-medium" data-tool="${t.name}">
                    Probar Ejecución
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- 3. Registro de Ejecución en Vivo (Call Log) -->
        <div class="space-y-2">
          <div class="text-[11px] font-semibold text-gray-300 uppercase tracking-wider flex items-center justify-between">
            <span>Registro de Ejecución (Audit Log)</span>
            <button id="btn-clear-log" class="text-[10px] text-gray-500 hover:text-gray-300">Limpiar</button>
          </div>
          <div id="mcp-log-container" class="space-y-1.5 max-h-48 overflow-y-auto p-1 bg-[#111111] rounded-lg border border-[#282828] custom-scrollbar">
            <div class="p-3 text-center text-gray-500 text-[11px]">No hay llamadas registradas aún.</div>
          </div>
        </div>
      </div>

      <!-- Footer Info -->
      <div class="p-3 border-t border-[#333333] bg-[#1a1a1a] flex items-center justify-between text-[10px] text-gray-400">
        <a href="https://webmcp.com" target="_blank" class="hover:text-blue-400 underline">webmcp.com</a>
        <span>•</span>
        <a href="https://mauricioperera.github.io/fastwebmcp/" target="_blank" class="hover:text-blue-400 underline">FastWebMCP Docs</a>
        <span>•</span>
        <a href="https://github.com/MauricioPerera/KDD" target="_blank" class="hover:text-blue-400 underline">KDD Spec</a>
      </div>
    `;

    document.body.appendChild(el);
    this.drawerEl = el;

    this.bindEvents();
  }

  bindEvents() {
    const { drawerEl } = this;

    // Cerrar cajón
    drawerEl.querySelector('#btn-close-webmcp-drawer').addEventListener('click', () => this.hide());

    // Prompt de IA
    const promptInput = drawerEl.querySelector('#ai-prompt-input');
    const runBtn = drawerEl.querySelector('#btn-run-ai-prompt');

    runBtn.addEventListener('click', async () => {
      const prompt = promptInput.value.trim();
      if (!prompt) return;
      runBtn.disabled = true;
      runBtn.textContent = '⏳ Generando...';

      const res = await fastwebmcp.invokeTool('figma_generate_design_prompt', { prompt });
      this.updateLog();
      runBtn.disabled = false;
      runBtn.textContent = '✨ Generar Diseño con IA';
    });

    // Chips de sugerencia
    drawerEl.querySelectorAll('.ai-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        promptInput.value = chip.getAttribute('data-prompt');
        runBtn.click();
      });
    });

    // Acordeón de herramientas
    drawerEl.querySelectorAll('.tool-header-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const body = btn.parentElement.querySelector('.tool-body');
        body.classList.toggle('hidden');
      });
    });

    // Probar tool individual
    drawerEl.querySelectorAll('.tool-quick-run').forEach(btn => {
      btn.addEventListener('click', async () => {
        const tool = btn.getAttribute('data-tool');
        if (tool === 'figma_create_shape') {
          await fastwebmcp.invokeTool(tool, { type: 'rect', width: 140, height: 90, x: 200, y: 150, fill: '#3b82f6', cornerRadius: 12 });
        } else if (tool === 'figma_create_frame') {
          await fastwebmcp.invokeTool(tool, { name: 'Demo Frame', width: 360, height: 600, x: 150, y: 100 });
        } else if (tool === 'figma_create_text') {
          await fastwebmcp.invokeTool(tool, { text: 'Hello WebMCP', x: 220, y: 180, fontSize: 24 });
        } else if (tool === 'figma_create_ui_component') {
          await fastwebmcp.invokeTool(tool, { template: 'dashboard_card', x: 180, y: 140 });
        } else if (tool === 'figma_get_document') {
          await fastwebmcp.invokeTool(tool, {});
        } else {
          await fastwebmcp.invokeTool(tool, {});
        }
        this.updateLog();
      });
    });

    // Limpiar log
    drawerEl.querySelector('#btn-clear-log').addEventListener('click', () => {
      fastwebmcp.callLog = [];
      this.updateLog();
    });
  }

  updateLog() {
    const logContainer = this.drawerEl.querySelector('#mcp-log-container');
    if (!logContainer) return;

    if (fastwebmcp.callLog.length === 0) {
      logContainer.innerHTML = `<div class="p-3 text-center text-gray-500 text-[11px]">No hay llamadas registradas aún.</div>`;
      return;
    }

    logContainer.innerHTML = fastwebmcp.callLog.map(entry => `
      <div class="p-2 bg-[#181818] rounded border ${entry.status === 'success' ? 'border-emerald-900/50' : 'border-red-900/50'} text-[10px]">
        <div class="flex items-center justify-between font-mono">
          <span class="text-blue-400 font-semibold">${entry.tool}</span>
          <span class="text-gray-500">${entry.durationMs}ms</span>
        </div>
        <div class="text-gray-400 truncate mt-0.5">Params: ${JSON.stringify(entry.params)}</div>
        <div class="${entry.status === 'success' ? 'text-emerald-400' : 'text-red-400'} truncate mt-0.5">
          ${entry.status === 'success' ? '✓ ' + JSON.stringify(entry.result) : '✗ ' + entry.error}
        </div>
      </div>
    `).join('');
  }

  show() {
    this.drawerEl.classList.remove('translate-x-full');
    this.updateLog();
  }

  hide() {
    this.drawerEl.classList.add('translate-x-full');
  }

  toggle() {
    if (this.drawerEl.classList.contains('translate-x-full')) {
      this.show();
    } else {
      this.hide();
    }
  }
}
