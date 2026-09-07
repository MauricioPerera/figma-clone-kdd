/**
 * Runtime FastWebMCP para Figma Clone KDD.
 * Conforme a https://mauricioperera.github.io/fastwebmcp/ y https://webmcp.com
 */

const TOOL_NAME_REGEX = /^[A-Za-z0-9_.-]{1,128}$/;

export class FastWebMcpRuntime {
  constructor() {
    this.registry = new Map();
    this.callLog = [];
    this.hasNativeModelContext = typeof document !== 'undefined' && 'modelContext' in document && typeof document.modelContext?.registerTool === 'function';

    if (!this.hasNativeModelContext) {
      console.info('[FastWebMCP] document.modelContext no detectado de forma nativa. Operando en modo cliente autónomo compatible.');
    }
  }

  defineTool(spec) {
    if (!spec.name || !TOOL_NAME_REGEX.test(spec.name)) {
      throw new Error(`[FastWebMCP] Nombre de herramienta inválido: "${spec.name}". Debe cumplir con ^[A-Za-z0-9_.-]{1,128}$`);
    }

    return {
      name: spec.name,
      title: spec.title || spec.name,
      description: spec.description || '',
      inputSchema: spec.inputSchema || { type: 'object', properties: {} },
      annotations: spec.annotations || {},
      execute: spec.execute
    };
  }

  registerTool(spec) {
    const defined = this.defineTool(spec);
    this.registry.set(defined.name, defined);

    // Si el navegador soporta document.modelContext nativo (Chrome 149+ u Origin Trial):
    if (this.hasNativeModelContext) {
      try {
        document.modelContext.registerTool({
          name: defined.name,
          title: defined.title,
          description: defined.description,
          inputSchema: defined.inputSchema,
          annotations: defined.annotations,
          execute: defined.execute
        });
      } catch (err) {
        console.warn(`[FastWebMCP] Error registrando en document.modelContext:`, err);
      }
    }

    return defined;
  }

  async invokeTool(name, params = {}) {
    const startTime = performance.now();
    try {
      const tool = this.registry.get(name);
      if (!tool) {
        throw new Error(`[FastWebMCP] Herramienta desconocida: "${name}"`);
      }
      const result = await tool.execute(params);
      const duration = (performance.now() - startTime).toFixed(1);
      const logEntry = {
        tool: name,
        params,
        result,
        status: 'success',
        durationMs: duration,
        timestamp: new Date().toLocaleTimeString()
      };
      this.callLog.unshift(logEntry);
      if (this.callLog.length > 100) this.callLog.pop();
      return { success: true, data: result, log: logEntry };
    } catch (err) {
      const duration = (performance.now() - startTime).toFixed(1);
      const logEntry = {
        tool: name,
        params,
        error: err.message,
        status: 'error',
        durationMs: duration,
        timestamp: new Date().toLocaleTimeString()
      };
      this.callLog.unshift(logEntry);
      return { success: false, error: err.message, log: logEntry };
    }
  }

  getRegisteredTools() {
    return Array.from(this.registry.values()).map(t => ({
      name: t.name,
      title: t.title,
      description: t.description,
      inputSchema: t.inputSchema,
      annotations: t.annotations
    }));
  }

  defineDeclarativeTool(formElement, spec) {
    if (!formElement) return;
    formElement.setAttribute('toolname', spec.name);
    formElement.setAttribute('tooldescription', spec.description || '');
    if (spec.autosubmit) {
      formElement.setAttribute('toolautosubmit', 'true');
    }
    if (spec.fields) {
      for (const field of spec.fields) {
        const input = formElement.querySelector(`[name="${field.name}"]`);
        if (input && field.description) {
          input.setAttribute('toolparamdescription', field.description);
        }
      }
    }
  }

  respondToAgentSubmit(event, handler) {
    if (event.isTrusted === false || event.agentSubmit) {
      return handler();
    }
    return null;
  }
}

// Instancia global
export const fastwebmcp = new FastWebMcpRuntime();
if (typeof window !== 'undefined') {
  window.fastwebmcp = fastwebmcp;
}
