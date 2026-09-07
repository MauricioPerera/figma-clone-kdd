/**
 * Modal de Plantillas UI para Figma Clone KDD.
 */

import { UI_TEMPLATES } from '../engine/templates.js';

export class TemplatesModal {
  constructor(store) {
    this.store = store;
    this.modalEl = null;
    this.createModal();
  }

  createModal() {
    const el = document.createElement('div');
    el.id = 'templates-modal';
    el.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center hidden';
    el.innerHTML = `
      <div class="bg-[#222222] border border-[#383838] rounded-xl shadow-2xl w-full max-w-2xl text-gray-200 overflow-hidden font-sans text-xs">
        <!-- Header -->
        <div class="px-5 py-4 border-b border-[#383838] flex items-center justify-between bg-[#1e1e1e]">
          <div class="flex items-center space-x-2">
            <span class="font-bold text-sm text-white">Galería de Componentes y Plantillas</span>
            <span class="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-mono">UI Kit</span>
          </div>
          <button id="btn-close-templates-modal" class="w-6 h-6 rounded hover:bg-[#333] flex items-center justify-center text-gray-400 hover:text-white">✕</button>
        </div>

        <!-- Lista de Plantillas -->
        <div class="p-6 grid grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
          ${Object.values(UI_TEMPLATES).map(tpl => `
            <div class="p-4 bg-[#1a1a1a] hover:bg-[#202020] border border-[#333333] hover:border-[#0d99ff] rounded-xl transition-all flex flex-col justify-between group">
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <span class="font-semibold text-white text-sm">${tpl.title}</span>
                  <span class="text-xs text-[#0d99ff]">❖</span>
                </div>
                <p class="text-gray-400 text-xs leading-relaxed">${tpl.description}</p>
              </div>
              <div class="pt-4 flex items-center justify-between">
                <span class="text-[10px] text-gray-500 font-mono">Vectorial Puro</span>
                <button class="btn-insert-tpl px-3 py-1.5 bg-[#0d99ff] hover:bg-[#0088eb] text-white rounded-lg font-medium text-xs shadow transition-colors" data-id="${tpl.id}">
                  Insertar en Lienzo
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.body.appendChild(el);
    this.modalEl = el;

    el.querySelector('#btn-close-templates-modal').addEventListener('click', () => this.hide());
    el.addEventListener('click', (e) => {
      if (e.target === el) this.hide();
    });

    el.querySelectorAll('.btn-insert-tpl').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const tpl = UI_TEMPLATES[id];
        if (tpl) {
          const vp = this.store.state.viewport;
          // Centrar cerca de donde esté el viewport actual
          const startX = -vp.panX + 200;
          const startY = -vp.panY + 160;
          const layers = tpl.create(startX, startY);
          this.store.recordHistory();
          this.store.state.layers.push(...layers);
          this.store.setSelection(layers.map(l => l.id));
          this.store.notify('layer:add');
          this.hide();
        }
      });
    });
  }

  show() {
    this.modalEl.classList.remove('hidden');
  }

  hide() {
    this.modalEl.classList.add('hidden');
  }
}
