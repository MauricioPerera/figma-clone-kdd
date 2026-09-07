# Figma Clone KDD — 100% Client-Side Vector Studio

> **Clon de Figma 100% funcional y 100% client-side listo para desplegar en GitHub Pages con cero dependencias de servidor.**
> Construido con **Tailwind CSS**, **HTMX**, gobernado bajo **KDD (Knowledge-Driven Development)** de Mauricio Perera ([MauricioPerera/KDD](https://github.com/MauricioPerera/KDD)) y habilitado para agentes autónomos mediante el estándar **WebMCP** ([webmcp.com](https://webmcp.com)) y **FastWebMCP** ([mauricioperera.github.io/fastwebmcp/](https://mauricioperera.github.io/fastwebmcp/)).

---

## 🌟 Características Principales

### 1. Lienzo Infinito y Motor Gráfico Vectorial
- **Navegación Fluida del Viewport**:
  - Desplazamiento infinito (Pan) mediante `Espacio + Arrastre`, rueda central o herramienta Mano (`H`).
  - Zoom interactivo centrado en el cursor del mouse (`Ctrl + Rueda`), pinch-to-zoom y presets (`50%`, `100%`, `200%`, `Zoom to fit`).
  - Cuadrícula de puntos adaptable en tiempo real según el nivel de ampliación.
- **Frames y Artboards**:
  - Contenedores de diseño (iPhone 16, Desktop 1440, formatos personalizados) con fondo, sombras, etiqueta superior y recorte de contenido (`clip-content`).
- **Primitivas Vectoriales Completas**:
  - Selección y manipulación (`V`).
  - Rectángulo (`R`) y Rectángulo redondeado.
  - Elipse / Círculo (`O`).
  - Polígono / Triángulo equilátero.
  - Estrella de 5 puntas con radio interno armónico.
  - Línea recta (`L`) y Flecha direccional (`Shift + L`).
  - Texto tipográfico (`T`) con edición en línea in-situ de doble click.
- **Manipuladores de Transformación (Gizmo Interactivo)**:
  - 8 manijas de redimensión (NW, N, NE, E, SE, S, SW, W) con restricción de proporciones manteniendo `Shift`.
  - Manijas interiores de radio de curvatura (*Figma-style corner radius dots*).
  - Indicador de dimensiones en tiempo real debajo de la selección.
- **Guías Magnéticas Inteligentes (Smart Guides)**:
  - Detección automática de alineaciones en bordes y centros con líneas magenta discontinuas y snapping magnético.

---

### 2. Inspector Lateral de Propiedades y Conversor a Tailwind CSS
- **Pestaña Diseño**:
  - **Barra de Alineación**: Izquierda, Centro Horizontal, Derecha, Arriba, Centro Vertical, Abajo, Distribuir.
  - **Transformación**: Modificación numérica precisa de X, Y, Ancho, Alto, Ángulo de Rotación y Radio de Esquina.
  - **Rellenos (Fill)**: Selector visual de color nativo, input hexadecimal, paleta de colores rápidos y transparencia.
  - **Trazos (Stroke)**: Color, grosor en píxeles y estilo sólido o punteado.
  - **Efectos**: Sombra paralela suave configurable (*Drop Shadow*).
  - **Tipografía**: Selección de fuente (Inter, Roboto, Poppins, Fira Code, Georgia), tamaño, peso (Regular, Medium, SemiBold, Bold) y alineación.
- **Pestaña Tailwind CSS**:
  - Generación en tiempo real del código **HTML + Tailwind CSS** equivalente a los elementos seleccionados.
  - Botón de 1-click para copiar el código directamente al portapapeles.

---

### 3. Árbol de Capas y Gestor de Recursos
- Lista jerárquica que refleja todas las capas y frames del lienzo.
- Iconografía según el tipo de elemento.
- Ocultar/Mostrar capas con el botón de ojo (`👁`).
- Bloquear/Desbloquear capas para prevenir selecciones accidentales (`🔒`).
- Renombrar capas con doble click in-place.
- Reordenar capas hacia adelante (`▲`) o hacia atrás (`▼`).

---

### 4. Estándar WebMCP ([webmcp.com](https://webmcp.com)) & FastWebMCP
El clon está preparado para la era de los agentes autónomos de navegación:
- Cumple con la especificación de **WebMCP** para que modelos de IA como Claude, Gemini o agentes basados en navegador interactúen con la herramienta mediante llamadas estructuradas:
  - `figma_create_frame`: Crea artboards en el lienzo.
  - `figma_create_shape`: Inserta rectángulos, elipses, polígonos, estrellas, líneas o flechas.
  - `figma_create_text`: Inserta capas de texto tipográfico.
  - `figma_create_ui_component`: Instancia componentes prefabricados (Mobile Login, SaaS Hero, Analytics Card).
  - `figma_update_layer`: Modifica propiedades atómicas de cualquier capa por ID.
  - `figma_delete_layers`: Elimina capas del diseño.
  - `figma_get_document`: Retorna el árbol de datos estructurado para razonamiento del agente.
  - `figma_export`: Exporta a SVG o código Tailwind CSS.
  - `figma_generate_design_prompt`: Asistente de IA en lenguaje natural que convierte instrucciones ("crea una tarjeta de métricas") en jerarquías visuales vectoriales.
- **Consola WebMCP Flotante (Agent Drawer)**:
  - Cajón interactivo desplegable desde la barra superior para probar herramientas, ver esquemas JSON, ejecutar prompts en lenguaje natural y auditar el registro de ejecuciones en milisegundos.
- **Formularios Declarativos WebMCP**:
  - Formularios HTML equipados con los atributos estándar `toolname`, `tooldescription`, `toolautosubmit` y `toolparamdescription`.

---

### 5. Exportación, Importación y Persistencia
- **Persistencia en LocalStorage**: Todo el trabajo se almacena en el navegador de manera automática con debounce, protegiéndolo de pérdidas ante recargas.
- **Pila Undo / Redo**: Historial completo con `Ctrl + Z` y `Ctrl + Y` / `Ctrl + Shift + Z`.
- **Exportación Vectorial SVG**: Descarga del lienzo o selección en formato SVG estándar limpio.
- **Exportación PNG Retina (2x)**: Renderizado en alta resolución a través de Canvas offscreen.
- **Guardar / Cargar Proyecto**: Serialización a archivo `.figma.json` para compartir entre diseñadores.

---

## 🚀 Despliegue en GitHub Pages (100% Client-Side)

Al ser una aplicación **100% estática** (HTML5, JavaScript Modules nativos, Tailwind CDN, SVG, Canvas 2D), el despliegue no requiere ningún servidor ni proceso de compilación:

1. Crea un repositorio en GitHub (ej. `figma-clone-kdd`).
2. Sube los archivos a la rama `main`:
   ```bash
   git init
   git add .
   git commit -m "feat: Figma Clone KDD 100% functional client-side"
   git remote add origin https://github.com/<tu-usuario>/<tu-repo>.git
   git push -u origin main
   ```
3. En tu repositorio de GitHub, dirígete a **Settings** → **Pages**.
4. En **Build and deployment** → **Source**, elige **Deploy from a branch**.
5. Selecciona la rama `main` y la carpeta `/ (root)`.
6. Haz clic en **Save**. En segundos tu estudio estará online en:
   ```
   https://<tu-usuario>.github.io/<tu-repo>/
   ```

---

## 💻 Ejecución Local

Para probarlo localmente, sirve la carpeta con cualquier servidor HTTP ligero:

```bash
# Con Python
python -m http.server 8080

# O con Node.js
npx serve .
```

Abre `http://localhost:8080` en tu navegador favorito.

---

## 🧪 Pruebas Deterministas y Gobernanza KDD

El proyecto incluye scripts deterministas y suites de pruebas sin dependencias externas:

```bash
# Validar nodos de conocimiento OKF
python scripts/validate_okf.py

# Validar contratos CCDD
python scripts/validate_contracts.py

# Ejecutar pruebas unitarias de geometría, store y WebMCP
node tests/run_tests.js
```

---

## ⌨️ Atajos de Teclado Principales

| Atajo | Acción |
| :--- | :--- |
| `V` | Herramienta de Selección / Mover |
| `F` | Herramienta de Frame / Artboard |
| `R` | Herramienta de Rectángulo |
| `O` | Herramienta de Elipse / Círculo |
| `T` | Herramienta de Texto (doble click para editar) |
| `L` | Herramienta de Línea |
| `Shift + L` | Herramienta de Flecha |
| `H` o `Espacio + Arrastre` | Desplazamiento (Pan) sobre el lienzo |
| `Ctrl + Rueda` | Zoom interactivo centrado en el cursor |
| `Ctrl + Z` / `Ctrl + Y` | Deshacer / Rehacer |
| `Ctrl + D` | Duplicar elementos seleccionados |
| `Ctrl + C` / `Ctrl + V` | Copiar y Pegar |
| `Ctrl + A` | Seleccionar todos los elementos |
| `Delete` / `Backspace` | Eliminar elementos seleccionados |
| `Flechas` / `Shift + Flechas` | Desplazar capas 1px / 10px |
| `?` | Abrir modal de atajos de teclado |

---

## 📄 Licencia

MIT © 2026 Mauricio Perera & Antigravity Pair.
Inspirado en la metodología [KDD](https://github.com/MauricioPerera/KDD), [FastWebMCP](https://mauricioperera.github.io/fastwebmcp/) y [WebMCP](https://webmcp.com).
