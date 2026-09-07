/**
 * Modal de atajos de teclado para Figma Clone KDD.
 */

export class ShortcutsModal {
  constructor() {
    this.modalEl = null;
    this.createModal();
  }

  createModal() {
    const el = document.createElement('div');
    el.id = 'shortcuts-modal';
    el.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center hidden';
    el.innerHTML = `
      <div class="bg-[#222222] border border-[#383838] rounded-xl shadow-2xl w-full max-w-xl text-gray-200 overflow-hidden font-sans text-xs">
        <!-- Header -->
        <div class="px-5 py-4 border-b border-[#383838] flex items-center justify-between bg-[#1e1e1e]">
          <div class="flex items-center space-x-2">
            <span class="font-bold text-sm text-white">Atajos de Teclado (Figma Shortcuts)</span>
            <span class="px-2 py-0.5 rounded-full bg-[#0d99ff]/20 text-[#0d99ff] text-[10px] font-mono">Cheatsheet</span>
          </div>
          <button id="btn-close-shortcuts" class="w-6 h-6 rounded hover:bg-[#333333] flex items-center justify-center text-gray-400 hover:text-white">✕</button>
        </div>

        <!-- Contenido en Columnas -->
        <div class="p-5 grid grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <!-- Columna 1: Herramientas y Creación -->
          <div class="space-y-4">
            <div>
              <div class="font-semibold text-gray-400 uppercase tracking-wider text-[10px] mb-2">Herramientas</div>
              <div class="space-y-1.5">
                <div class="flex items-center justify-between py-1 border-b border-[#2e2e2e]">
                  <span>Mover / Selección</span>
                  <kbd class="px-1.5 py-0.5 bg-[#333] rounded font-mono text-[11px] text-white">V</kbd>
                </div>
                <div class="flex items-center justify-between py-1 border-b border-[#2e2e2e]">
                  <span>Frame / Artboard</span>
                  <kbd class="px-1.5 py-0.5 bg-[#333] rounded font-mono text-[11px] text-white">F</kbd>
                </div>
                <div class="flex items-center justify-between py-1 border-b border-[#2e2e2e]">
                  <span>Rectángulo</span>
                  <kbd class="px-1.5 py-0.5 bg-[#333] rounded font-mono text-[11px] text-white">R</kbd>
                </div>
                <div class="flex items-center justify-between py-1 border-b border-[#2e2e2e]">
                  <span>Elipse / Círculo</span>
                  <kbd class="px-1.5 py-0.5 bg-[#333] rounded font-mono text-[11px] text-white">O</kbd>
                </div>
                <div class="flex items-center justify-between py-1 border-b border-[#2e2e2e]">
                  <span>Línea</span>
                  <kbd class="px-1.5 py-0.5 bg-[#333] rounded font-mono text-[11px] text-white">L</kbd>
                </div>
                <div class="flex items-center justify-between py-1 border-b border-[#2e2e2e]">
                  <span>Flecha</span>
                  <kbd class="px-1.5 py-0.5 bg-[#333] rounded font-mono text-[11px] text-white">Shift + L</kbd>
                </div>
                <div class="flex items-center justify-between py-1 border-b border-[#2e2e2e]">
                  <span>Texto</span>
                  <kbd class="px-1.5 py-0.5 bg-[#333] rounded font-mono text-[11px] text-white">T</kbd>
                </div>
                <div class="flex items-center justify-between py-1 border-b border-[#2e2e2e]">
                  <span>Mano (Pan)</span>
                  <kbd class="px-1.5 py-0.5 bg-[#333] rounded font-mono text-[11px] text-white">H / Espacio</kbd>
                </div>
              </div>
            </div>
          </div>

          <!-- Columna 2: Edición y Navegación -->
          <div class="space-y-4">
            <div>
              <div class="font-semibold text-gray-400 uppercase tracking-wider text-[10px] mb-2">Edición e Historial</div>
              <div class="space-y-1.5">
                <div class="flex items-center justify-between py-1 border-b border-[#2e2e2e]">
                  <span>Deshacer</span>
                  <kbd class="px-1.5 py-0.5 bg-[#333] rounded font-mono text-[11px] text-white">Ctrl + Z</kbd>
                </div>
                <div class="flex items-center justify-between py-1 border-b border-[#2e2e2e]">
                  <span>Rehacer</span>
                  <kbd class="px-1.5 py-0.5 bg-[#333] rounded font-mono text-[11px] text-white">Ctrl + Y</kbd>
                </div>
                <div class="flex items-center justify-between py-1 border-b border-[#2e2e2e]">
                  <span>Duplicar Capa</span>
                  <kbd class="px-1.5 py-0.5 bg-[#333] rounded font-mono text-[11px] text-white">Ctrl + D</kbd>
                </div>
                <div class="flex items-center justify-between py-1 border-b border-[#2e2e2e]">
                  <span>Copiar / Pegar</span>
                  <kbd class="px-1.5 py-0.5 bg-[#333] rounded font-mono text-[11px] text-white">Ctrl+C / Ctrl+V</kbd>
                </div>
                <div class="flex items-center justify-between py-1 border-b border-[#2e2e2e]">
                  <span>Seleccionar Todo</span>
                  <kbd class="px-1.5 py-0.5 bg-[#333] rounded font-mono text-[11px] text-white">Ctrl + A</kbd>
                </div>
                <div class="flex items-center justify-between py-1 border-b border-[#2e2e2e]">
                  <span>Eliminar Capas</span>
                  <kbd class="px-1.5 py-0.5 bg-[#333] rounded font-mono text-[11px] text-white">Del / Backspace</kbd>
                </div>
                <div class="flex items-center justify-between py-1 border-b border-[#2e2e2e]">
                  <span>Zoom Centrado</span>
                  <kbd class="px-1.5 py-0.5 bg-[#333] rounded font-mono text-[11px] text-white">Ctrl + Rueda</kbd>
                </div>
                <div class="flex items-center justify-between py-1 border-b border-[#2e2e2e]">
                  <span>Mover 1px / 10px</span>
                  <kbd class="px-1.5 py-0.5 bg-[#333] rounded font-mono text-[11px] text-white">Flechas / Shift+Flechas</kbd>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-5 py-3 border-t border-[#383838] bg-[#1e1e1e] flex justify-end">
          <button id="btn-ok-shortcuts" class="px-4 py-1.5 bg-[#0d99ff] hover:bg-[#0088eb] text-white rounded font-medium transition-colors">
            Entendido
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(el);
    this.modalEl = el;

    el.querySelector('#btn-close-shortcuts').addEventListener('click', () => this.hide());
    el.querySelector('#btn-ok-shortcuts').addEventListener('click', () => this.hide());
    el.addEventListener('click', (e) => {
      if (e.target === el) this.hide();
    });
  }

  show() {
    this.modalEl.classList.remove('hidden');
  }

  hide() {
    this.modalEl.classList.add('hidden');
  }
}
