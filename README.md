# BisectionLab — Laboratorio Interactivo del Método de Bisección

Plataforma web educativa y de ingeniería desarrollada en **HTML, CSS y JavaScript puro (Vanilla JS)** para el análisis numérico, visualización interactiva paso a paso, auditoría tabular y generación de reportes técnicos en PDF mediante el **Método de Bisección**.

---

## Datos Académicos

- **Institución:** Universidad Computación del Golfo
- **Licenciatura:** Ingeniería en Sistemas y Ciencia de Datos
- **Periodo:** Septiembre-Diciembre 2026 | 4º cuatrimestre
- **Docente:** Mtro. Ángel Eduardo Murillo Reyes
- **Alumnos:** Joksan Suriel Télles Rincón, Ginger Yaretzy Martínez Ruíz, Luis Ángel González Rodríguez

---

## Características Principales

- **Editor matemático visual (MathLive):** Escritura natural de fracciones, potencias y raíces con teclado virtual desplegable, botón de ayuda contextual (`info`) y respaldo automático en texto plano si la librería externa no carga.
- **Vista previa en vivo (KaTeX):** Renderizado matemático inmediato de $f(x)$ y validación en tiempo real de sintaxis y constantes.
- **Parámetros / constantes opcionales:** Permite definir variables simbólicas (p. ej. `g = 9.81, m = 68.1, t = 10, v = 40`) para fórmulas físicas limpias como el modelo del paracaidista de carga (cargado por defecto).
- **Motor numérico robusto:** Implementación del Método de Bisección con validación del Teorema de Bolzano, detección de raíces exactas en extremos, protección contra discontinuidades y alerta de posible asíntota vertical.
- **Visualizador gráfico interactivo (Chart.js + Zoom):** Curva de $f(x)$ con escalado inteligente del eje $Y$, sombreado dinámico del subintervalo $[a_i, b_i]$, marcadores verticales para $a$, $b$ y $x_r$, zoom/arrastre y reproductor multimedia (*Inicio, Anterior, Play/Pausa, Siguiente, Final*, deslizador y velocidad `0.5x / 1x / 2x`).
- **Tabla de auditoría y Drawer "Paso a Paso Didáctico":** Al seleccionar cualquier fila se despliega el desarrollo algebraico completo de esa iteración en KaTeX.
- **Exportación y difusión:**
  - Descarga de tabla y resumen en **Excel (`.xlsx`)** (con respaldo automático `.csv`).
  - **Modal de Reporte Técnico PDF** listo para impresión (`@media print`) con encabezado institucional, gráfica estática sobre fondo blanco, resumen estadístico, tabla resumida, conclusión redactada dinámicamente y fecha/hora exacta.
  - **Código QR y enlace compartible** que codifica el escenario completo en la URL (`?fn=...&params=...&a=...&b=...&tol=...&maxIter=...`).
- **Modo Claro / Oscuro persistente:** Sincronizado con logotipos institucionales adaptativos, editor MathLive y paleta de la gráfica.

---

## Estructura del Proyecto

```text
MetodosNumericos/
├── index.html                        # Documento principal (Laboratorio, Modal de Reporte, Drawer y Modal QR)
├── README.md                         # Documentación técnica del proyecto
└── src/
    ├── styles.css                    # Estilos globales, temas claro/oscuro, Bento layout, modales y @media print
    ├── logo.png                      # Escudo institucional para el encabezado del reporte PDF
    ├── HorizontalLogo_OnLight.png    # Logotipo horizontal del navbar para modo claro
    ├── HorizontalLogo_OnDark.png     # Logotipo horizontal del navbar para modo oscuro
    └── js/
        ├── math-parser.js            # Conversor LaTeX → Math.js, normalización, parámetros y compilación f(x)
        ├── bisection.js              # Núcleo algorítmico del Método de Bisección (desacoplado del DOM)
        ├── chart-player.js           # Gráfica interactiva (Chart.js + plugin [a,b]) y reproductor multimedia
        ├── export-share.js           # Drawer paso a paso (KaTeX), exportación Excel (.xlsx) y QR / URL
        ├── report.js                 # Modal de Reporte Técnico PDF (gráfica de impresión, resumen y conclusión)
        └── app.js                    # Estado global, presets, vista previa, tema, eventos e inicialización
```

> **Nota técnica:** No requiere Node.js ni compiladores. Los módulos `.js` se cargan con etiquetas `<script>` clásicas en orden de dependencia, lo que garantiza compatibilidad total tanto al abrir `index.html` directamente (`file://`) como en cualquier servidor HTTP/HTTPS.

---

## Librerías Externas (vía CDN en `index.html`)

| Librería | Uso en la aplicación |
| :--- | :--- |
| **Math.js** (`14.8.1`) | Análisis sintáctico (AST), validación de símbolos y evaluación numérica segura de $f(x)$ y constantes. |
| **Chart.js** (`4.4.7`) | Renderizado de la gráfica de dispersión/curva de $f(x)$ e historial de aproximaciones $x_r$. |
| **Hammer.js** (`2.0.8`) + **chartjs-plugin-zoom** (`2.0.1`) | Interacción táctil, zoom con rueda/botones y arrastre (*pan*) sobre el lienzo gráfico. |
| **KaTeX** (`0.16`) | Renderizado tipográfico matemático en vivo, en el Drawer paso a paso y en el Reporte PDF. |
| **MathLive** | Editor matemático visual con teclado desplegable integrado. |
| **SheetJS / XLSX** (`0.18.5`) | Generación de libros Excel (`.xlsx`) con hojas de *Iteraciones* y *Resumen*. |
| **qrcode-generator** (`1.4.4`) | Generación de la matriz QR renderizada en SVG nítido para compartir escenarios. |
| **Google Material Icons Round** | Iconografía uniforme en toda la interfaz vía `fonts.googleapis.com`. |

---

## Fundamento Matemático Implementado

1. **Teorema de Bolzano:** Si $f(x)$ es continua en $[a, b]$ y $f(a) \cdot f(b) < 0$, existe al menos una raíz real $r \in (a, b)$.
2. **Aproximación del punto medio:**
   $$x_r = \frac{a + b}{2}$$
3. **Actualización del subintervalo:**
   - Si $f(x_r) = 0$: raíz exacta encontrada.
   - Si $f(a) \cdot f(x_r) < 0$: la raíz se encuentra en $[a, x_r] \implies b_{i+1} = x_r$.
   - Si $f(a) \cdot f(x_r) > 0$: la raíz se encuentra en $[x_r, b] \implies a_{i+1} = x_r$.
4. **Error relativo aproximado porcentual ($\varepsilon_a$):**
   $$\varepsilon_a = \left|\frac{x_r^{(i)} - x_r^{(i-1)}}{x_r^{(i)}}\right| \times 100\%$$
   El algoritmo converge cuando $\varepsilon_a \le \varepsilon_s$ o $f(x_r) = 0$.
5. **Protección contra asíntotas y discontinuidades:** Si la evaluación falla dentro del ciclo, o si $|f(x_r)|$ diverge drásticamente respecto a los valores iniciales $|f(a)|, |f(b)|$, el sistema advierte que el punto detectado corresponde a una posible asíntota vertical o discontinuidad de salto y no a una raíz real.

---

## Documentación Detallada de Módulos y Funciones

### 1. `src/js/math-parser.js`
Motor de interpretación y compilación matemática compartido por toda la plataforma.

| Función / Constante | Descripción |
| :--- | :--- |
| `FUNCIONES_CONOCIDAS` / `CONSTANTES_INTEGRADAS` | Conjuntos de funciones matemáticas admitidas (`sin`, `cos`, `log`, `sqrt`, etc.) y símbolos integrados (`x`, `e`, `pi`). |
| `extraerBloque(str, startIndex, openChar, closeChar)` | Extrae el contenido balanceado entre delimitadores anidados (`{...}` o `[...]`). |
| `reemplazarFracciones(str)` | Convierte expresiones LaTeX `\frac{num}{den}` (incluso anidadas) a `((num)/(den))`. |
| `reemplazarRaices(str)` | Transforma `\sqrt{x}` y `\sqrt[n]{x}` en `sqrt(x)` y `nthRoot(x, n)`. |
| `reemplazarExponentesConLlaves(str)` | Convierte exponentes LaTeX `^{...}` en `^(...)`. |
| `latexAMathJS(latex)` | Pipeline completo que limpia comandos de formato de MathLive, traduce estructuras LaTeX y devuelve la expresión normalizada para Math.js. |
| `detectarAdvertenciaPrecedencia(rawExpr)` | Detecta exponentes potencialmente ambiguos en texto plano (como `e^-(a)*b`) y emite un aviso preventivo. |
| `normalizarExpresion(expresion)` | Estandariza operadores Unicode (`−`, `×`, `÷`, `π`, `²`, `³`, `√`), alias en español (`ln`, `sen`, `tg`) y multiplicaciones implícitas (`2x`, `(x+1)(x-1)`). |
| `parsearParametros(texto)` | Interpreta definiciones separadas por comas o saltos de línea (`g = 9.81, m = 68.1`) y valida que cada constante sea real y finita. |
| `validarVariablesDefinidas(nodo, parametros)` | Recorre el AST de Math.js para detectar variables no declaradas antes de compilar. |
| `crearFuncion(expresionNormalizada, parametros)` | Compila la expresión y retorna una función `f(x)` protegida contra `NaN`, `Infinity` o números complejos. |
| `formatearNumero(val, decimales)` | Formatea valores numéricos en notación decimal fija o exponencial automática para magnitudes extremas. |
| `escaparHtml(str)` | Escapa caracteres especiales HTML en mensajes dinámicos. |
| `renderKatexEnElemento(el, tex, displayMode)` | Renderiza expresiones TeX con KaTeX usando texto plano como respaldo seguro. |

---

### 2. `src/js/bisection.js`
Núcleo numérico puro del Método de Bisección, completamente desacoplado de la interfaz.

| Función | Descripción |
| :--- | :--- |
| `ejecutarMetodoBiseccion({ f, a, b, tol, maxIter })` | Evalúa los extremos iniciales, verifica raíces exactas en $a$ o $b$, valida el Teorema de Bolzano, ejecuta el ciclo iterativo registrando cada paso (`i`, `a`, `b`, `xr`, `fa`, `fb`, `fxr`, `producto`, `errorRelativo`, `decision`) y analiza si existe una posible asíntota vertical. Retorna un objeto estructurado con el estado completo del cálculo. |

---

### 3. `src/js/chart-player.js`
Visualización interactiva en Chart.js y reproductor multimedia de iteraciones.

| Función / Objeto | Descripción |
| :--- | :--- |
| `bisectionOverlayPlugin` | Plugin de Chart.js que sombrea dinámicamente el intervalo $[a_i, b_i]$ y dibuja líneas verticales etiquetadas para `a` (ámbar), `b` (verde) y `xr` (cian). |
| `obtenerColoresTemaGrafica()` | Obtiene las variables CSS del tema activo para sincronizar ejes, cuadrícula, curva y sombreado. |
| `actualizarTemaGrafica()` | Actualiza los colores de la instancia activa de Chart.js al alternar entre modo claro y oscuro. |
| `calcularRangoYInteligente(puntos, iteraciones)` | Calcula límites del eje $Y$ mediante percentiles 5%–95% para evitar distorsión por asíntotas o valores extremos. |
| `generarGrafica(f, aInit, bInit, iteraciones)` | Muestrea $f(x)$ en 320 puntos, inserta quiebres `null` en discontinuidades/asíntotas, configura zoom/pan y muestra seleccionada la primera iteración (`i = 1`). |
| `actualizarControlesReproductor()` | Sincroniza el deslizador `#iterSlider` y el contador `#iterCounter` (`1 / N`). |
| `seleccionarIteracion(idx, abrirDrawer)` | Mueve el estado visual a la iteración `idx`, resaltando la fila de la tabla, actualizando `[a, b, xr]` en la gráfica y refrescando el Drawer didáctico. |
| `alternarReproduccion()` / `detenerAnimacion()` | Inicia, pausa o detiene la animación automática iteración por iteración a la velocidad seleccionada (`0.5x`, `1x`, `2x`). |
| `inicializarControlesGraficaYReproductor()` | Enlaza los botones de zoom (`+`, `−`, `⟲`) y los controles del reproductor multimedia. |

---

### 4. `src/js/export-share.js`
Desarrollo algebraico paso a paso, exportación a hoja de cálculo y difusión mediante enlace/QR.

| Función | Descripción |
| :--- | :--- |
| `abrirDrawerDidactico()` / `cerrarDrawerDidactico()` | Controlan la apertura y cierre del panel lateral deslizante de explicación paso a paso. |
| `renderizarPasoAPasoDrawer(item, total)` | Construye las 5 tarjetas en KaTeX (intervalo, punto medio $x_r$, evaluación $f(x_r)$, criterio de Bolzano y error $\varepsilon_a$) para la iteración activa. |
| `exportarExcel()` | Genera y descarga un archivo `.xlsx` con hojas *Iteraciones* y *Resumen* mediante SheetJS (o un `.csv` como respaldo automático sin conexión). |
| `generarUrlEscenario()` | Codifica la ecuación, parámetros, intervalo, tolerancia y máx. iteraciones en parámetros de consulta URL. |
| `renderizarQR(containerEl, texto)` | Construye un código QR vectorial en `<svg>` nítido a partir de la matriz generada por `qrcode-generator`. |
| `abrirModalQR()` / `cerrarModalQR()` | Controlan el modal rápido de **Compartir QR** accesible desde la barra superior. |
| `copiarTextoPortapapeles(texto, botonEl)` | Copia el enlace codificado al portapapeles con confirmación visual temporal en el botón. |
| `cargarDesdeURL()` | Lee parámetros `fn`, `params`, `a`, `b`, `tol` y `maxIter` al cargar la página para replicar escenarios compartidos. |
| `inicializarExportacionYCompartir()` | Conecta todos los botones del Drawer, exportación Excel y modal de QR. |

---

### 5. `src/js/report.js`
Generación del dictamen técnico imprimible en PDF dentro de un modal dedicado.

| Función | Descripción |
| :--- | :--- |
| `generarImagenGraficaImpresion(state)` | Dibuja la curva $f(x)$ y el punto de corte $x_r$ sobre un canvas fuera de pantalla con fondo blanco y colores de alto contraste, ideal para impresión PDF sin depender del modo oscuro. |
| `poblarTablaResumida(iteraciones)` | Rellena la tabla de iteraciones del reporte (si supera 12 filas, resume las 5 primeras y las 5 últimas). |
| `redactarConclusion(state)` | Redacta dinámicamente la conclusión técnica según convergencia, raíz exacta en extremo, límite de iteraciones o posible asíntota. |
| `actualizarVistaReporte()` | Actualiza fórmula en KaTeX, resumen estadístico, gráfica estática, tabla, conclusión, fecha/hora exacta del pie de página y código QR. |
| `abrirModalReporte()` / `cerrarModalReporte()` | Muestran y ocultan el modal del reporte técnico (botón **Volver atrás**). |
| `inicializarReporte()` | Enlaza los botones **Exportar PDF** (`window.print()`), **Copiar Enlace** y **Volver atrás**. |

---

### 6. `src/js/app.js`
Orquestador principal de estado, interfaz y ciclo de vida de la aplicación.

| Función / Objeto | Descripción |
| :--- | :--- |
| `window.BisectionLabState` | Objeto de estado compartido entre los módulos (expresión actual, parámetros, función compilada, historial de iteraciones y estado de convergencia). |
| `PRESETS` | Catálogo de casos de estudio precargados (con *Paracaidista de carga con constantes* como valor inicial). |
| `obtenerExpresionActual()` | Lee la fórmula desde MathLive o desde el campo de respaldo en texto plano. |
| `actualizarVistaPrevia()` | Valida sintaxis y variables en vivo y actualiza el bloque *Interpretación actual* en KaTeX. |
| `activarModoRespaldoTexto()` | Habilita el `<input>` de texto plano si el componente `<math-field>` no está disponible. |
| `cargarPreset(clave)` | Precarga un caso de estudio de `PRESETS`, sincroniza el formulario y recalcula automáticamente. |
| `inicializarTema()` | Gestiona el interruptor Claro/Oscuro, la persistencia en `localStorage` y la sincronización gráfica. |
| `calcularBiseccion()` | Valida el formulario, invoca `ejecutarMetodoBiseccion()` y coordina la actualización de resultados, tabla, gráfica y reproductor (iniciando en la iteración 1). |
| `renderizarTablaIteraciones(iteracionesData, convergio)` | Construye la tabla de auditoría y enlaza cada fila para abrir el desarrollo paso a paso. |
| `inicializarEventos()` | Registra los listeners del formulario, selector de presets, popover `info`, atajos de teclado (`Enter`, `Escape`) e inicializa los módulos auxiliares. |

---

## Ejecución Local

1. Abre directamente [index.html](index.html) en cualquier navegador moderno (Chrome, Edge, Firefox o Safari).
2. *(Opcional)* Para probar enlaces QR en red local o servidor web:
   ```bash
   python3 -m http.server 8080
   ```
   y abre `http://localhost:8080` en tu navegador.

### Parámetros soportados en URL (para compartir escenarios)

```text
index.html?fn=((g*m)/x)*(1-e^(-(x/m)*t))-v&params=g%3D9.81%2Cm%3D68.1%2Ct%3D10%2Cv%3D40&a=12&b=16&tol=0.01&maxIter=50
```
