/**
 * ============================================================================
 * app.js — Controlador principal de BisectionLab
 * ----------------------------------------------------------------------------
 * Responsabilidades:
 *  - Mantener el estado global compartido (`window.BisectionLabState`).
 *  - Definir los casos de estudio precargados (`PRESETS`), con "Paracaidista
 *    de carga (con constantes)" como caso por defecto.
 *  - Sincronizar el editor visual MathLive (y su respaldo texto) con la vista
 *    previa en vivo KaTeX.
 *  - Orquestar el cálculo del Método de Bisección, mensajes de resultado y
 *    renderizado de la tabla de auditoría.
 *  - Inicializar tema claro/oscuro, popover de ayuda y módulos auxiliares.
 * ============================================================================
 */

window.BisectionLabState = {
    modoEntrada: "visual", // "visual" (MathLive) | "texto" (respaldo automático)
    sincronizando: false,
    exprNormalizada: "((g * m) / x) * (1 - e^(-(x / m) * t)) - v",
    texRender: "\\frac{g \\cdot m}{x}\\left(1 - e^{-\\frac{x}{m}\\cdot t}\\right) - v",
    parametrosTexto: "g = 9.81, m = 68.1, t = 10, v = 40",
    parametros: { g: 9.81, m: 68.1, t: 10, v: 40 },
    aInicial: 12,
    bInicial: 16,
    tol: 0.01,
    maxIter: 50,
    funcionCompilada: null,
    iteraciones: [],
    iteracionActivaIdx: -1,
    playTimer: null,
    convergio: false,
    posibleAsintota: false,
    raizExactaExtremo: null,
    estadoTexto: "Listo",
    ultimaIter: null
};

/**
 * Casos de estudio precargados disponibles en el selector "Selección rápida".
 */
const PRESETS = {
    paracaidistaParams: {
        latex: "\\frac{g \\cdot m}{x}\\left(1 - e^{-\\frac{x}{m}\\cdot t}\\right) - v",
        texto: "((g * m) / x) * (1 - e^(-(x / m) * t)) - v",
        params: "g = 9.81, m = 68.1, t = 10, v = 40",
        a: 12,
        b: 16,
        tol: 0.01,
        maxIter: 50
    },
    polinomio: {
        latex: "x^3 - x - 2",
        texto: "x^3 - x - 2",
        params: "",
        a: 1,
        b: 2,
        tol: 0.01,
        maxIter: 50
    },
    trascendental: {
        latex: "\\cos\\left(x\\right) - x",
        texto: "cos(x) - x",
        params: "",
        a: 0,
        b: 1,
        tol: 0.01,
        maxIter: 50
    },
    logaritmica: {
        latex: "\\ln\\left(x\\right) + x - 2",
        texto: "ln(x) + x - 2",
        params: "",
        a: 0.5,
        b: 2,
        tol: 0.01,
        maxIter: 50
    },
    asintota: {
        latex: "\\frac{1}{x} - 2",
        texto: "1/x - 2",
        params: "",
        a: -1,
        b: 1,
        tol: 0.01,
        maxIter: 50
    }
};

// ==========================================
// ENTRADA DE FUNCIÓN Y VISTA PREVIA EN VIVO
// ==========================================

/**
 * Obtiene la expresión actual desde MathLive (visual) o desde el input de respaldo.
 * @returns {{ raw: string, normalizada: string, desdeVisual: boolean }}
 */
function obtenerExpresionActual() {
    const inputTexto = document.getElementById("funcion");
    const mathField = document.getElementById("mathField");

    if (window.BisectionLabState.modoEntrada === "visual" && mathField && typeof mathField.getValue === "function") {
        const latex = mathField.getValue("latex");
        return {
            raw: latex,
            normalizada: latexAMathJS(latex),
            desdeVisual: true
        };
    }

    const raw = inputTexto ? inputTexto.value.trim() : "";
    return {
        raw,
        normalizada: normalizarExpresion(raw),
        desdeVisual: false
    };
}

/**
 * Valida la expresión en tiempo real y renderiza su interpretación en KaTeX.
 */
function actualizarVistaPrevia() {
    const katexEl = document.getElementById("katexPreview");
    const statusEl = document.getElementById("previewStatus");
    const tipEl = document.getElementById("syntaxTip");
    const inputTexto = document.getElementById("funcion");

    tipEl.classList.add("hidden");
    tipEl.textContent = "";

    try {
        const { raw, normalizada, desdeVisual } = obtenerExpresionActual();

        if (!normalizada) {
            katexEl.innerHTML = '<span class="preview-empty">Escribe una función para ver la vista previa...</span>';
            statusEl.textContent = "Vacía";
            statusEl.classList.add("invalid");
            return;
        }

        if (desdeVisual && inputTexto) {
            inputTexto.value = normalizada;
        } else {
            const aviso = detectarAdvertenciaPrecedencia(raw);
            if (aviso) {
                tipEl.textContent = aviso;
                tipEl.classList.remove("hidden");
            }
        }

        const paramsStr = document.getElementById("parametros").value;
        const parametros = parsearParametros(paramsStr);
        const nodo = math.parse(normalizada);
        validarVariablesDefinidas(nodo, parametros);

        const tex = nodo.toTex({ parenthesis: "auto", implicit: "hide" });

        window.BisectionLabState.exprNormalizada = normalizada;
        window.BisectionLabState.texRender = tex;
        window.BisectionLabState.parametrosTexto = paramsStr;
        window.BisectionLabState.parametros = parametros;

        renderKatexEnElemento(katexEl, `f(x) = ${tex}`, false);
        statusEl.textContent = "Válida";
        statusEl.classList.remove("invalid");
    } catch (err) {
        katexEl.innerHTML = `<div class="katex-error">${escaparHtml(err.message)}</div>`;
        statusEl.textContent = "Revisar";
        statusEl.classList.add("invalid");
    }
}

/**
 * Activa el campo de texto plano automáticamente si MathLive no logró cargar.
 */
function activarModoRespaldoTexto() {
    document.getElementById("panelVisual")?.classList.add("hidden");
    document.getElementById("panelTexto")?.classList.remove("hidden");
    window.BisectionLabState.modoEntrada = "texto";
}

/**
 * Carga un caso de estudio de `PRESETS`, sincroniza los inputs y ejecuta el cálculo.
 * @param {string} clave - Clave del preset (p. ej. "paracaidistaParams").
 */
function cargarPreset(clave) {
    const preset = PRESETS[clave];
    if (!preset) return;

    const mathField = document.getElementById("mathField");
    const inputTexto = document.getElementById("funcion");
    const paramsInput = document.getElementById("parametros");
    const presetSelect = document.getElementById("presetSelect");

    window.BisectionLabState.sincronizando = true;

    if (presetSelect) presetSelect.value = clave;
    if (inputTexto) inputTexto.value = preset.texto;
    if (mathField) mathField.value = preset.latex;
    if (paramsInput) paramsInput.value = preset.params;

    document.getElementById("a").value = preset.a;
    document.getElementById("b").value = preset.b;
    document.getElementById("tolerancia").value = preset.tol;
    document.getElementById("maxIter").value = preset.maxIter;

    window.BisectionLabState.sincronizando = false;
    actualizarVistaPrevia();
    calcularBiseccion();
}

// ==========================================
// TEMA CLARO / OSCURO Y MENSAJES DE ESTADO
// ==========================================

/**
 * Inicializa el selector de modo claro/oscuro respetando `localStorage` y preferencia del sistema.
 */
function inicializarTema() {
    const themeToggle = document.getElementById("themeToggle");
    if (!themeToggle) return;

    let temaGuardado = null;
    try {
        temaGuardado = localStorage.getItem("biseccion-theme");
    } catch (_) {
        temaGuardado = null;
    }

    const prefiereOscuro =
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;

    const esOscuroInicial = temaGuardado ? temaGuardado === "dark" : prefiereOscuro;

    themeToggle.checked = esOscuroInicial;
    document.documentElement.setAttribute("data-theme", esOscuroInicial ? "dark" : "light");

    themeToggle.addEventListener("change", () => {
        const esOscuro = themeToggle.checked;
        document.documentElement.setAttribute("data-theme", esOscuro ? "dark" : "light");

        try {
            localStorage.setItem("biseccion-theme", esOscuro ? "dark" : "light");
        } catch (_) {
            // Ignorar si localStorage no está disponible
        }

        actualizarTemaGrafica();
    });
}

function mostrarError(mensaje) {
    const errorBox = document.getElementById("errorBox");
    errorBox.textContent = mensaje;
    errorBox.style.display = "block";
}

function mostrarAdvertencia(mensaje) {
    const warningBox = document.getElementById("warningBox");
    warningBox.textContent = mensaje;
    warningBox.style.display = "block";
}

// ==========================================
// ORQUESTACIÓN DEL CÁLCULO Y TABLA DE AUDITORÍA
// ==========================================

/**
 * Lee los valores del formulario, valida entradas, ejecuta `ejecutarMetodoBiseccion`
 * y actualiza el cuadro de resultado, la gráfica, el reproductor y la tabla de auditoría.
 */
function calcularBiseccion() {
    detenerAnimacion();

    const a = Number(document.getElementById("a").value);
    const b = Number(document.getElementById("b").value);
    const tol = Number(document.getElementById("tolerancia").value);
    const maxIter = Number(document.getElementById("maxIter").value);

    const errorBox = document.getElementById("errorBox");
    const warningBox = document.getElementById("warningBox");
    const resultBox = document.getElementById("resultBox");
    const tbody = document.querySelector("#tablaResultados tbody");

    errorBox.style.display = "none";
    warningBox.style.display = "none";
    resultBox.style.display = "none";
    tbody.innerHTML = "";

    let exprStr = "";
    try {
        exprStr = obtenerExpresionActual().normalizada;
    } catch (err) {
        mostrarError(err.message);
        return;
    }

    if (!exprStr) {
        mostrarError("Debes ingresar una función matemática.");
        return;
    }

    if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(tol) || !Number.isInteger(maxIter)) {
        mostrarError("Verifica que todos los valores numéricos sean válidos.");
        return;
    }

    if (a >= b) {
        mostrarError("El límite inferior a debe ser menor que el límite superior b.");
        return;
    }

    if (tol <= 0 || maxIter <= 0) {
        mostrarError("La tolerancia y el máximo de iteraciones deben ser mayores que cero.");
        return;
    }

    let parametros = {};
    try {
        parametros = parsearParametros(document.getElementById("parametros").value);
    } catch (err) {
        mostrarError(err.message);
        return;
    }

    let f;
    try {
        f = crearFuncion(exprStr, parametros);
    } catch (error) {
        mostrarError(`Error en la expresión: ${error.message}`);
        return;
    }

    // Ejecutar el núcleo numérico
    const res = ejecutarMetodoBiseccion({ f, a, b, tol, maxIter });

    // Actualizar estado global
    const state = window.BisectionLabState;
    state.exprNormalizada = exprStr;
    state.parametros = parametros;
    state.parametrosTexto = document.getElementById("parametros").value;
    state.aInicial = res.aInicial;
    state.bInicial = res.bInicial;
    state.tol = tol;
    state.maxIter = maxIter;
    state.funcionCompilada = f;
    state.iteraciones = res.iteraciones;
    state.iteracionActivaIdx = -1;
    state.convergio = res.convergio;
    state.posibleAsintota = res.posibleAsintota;
    state.raizExactaExtremo = res.raizExactaExtremo;
    state.estadoTexto = res.estadoTexto;
    state.ultimaIter = res.ultimaIter;

    if (res.tipo === "error_extremos") {
        mostrarError(res.mensajeError);
        generarGrafica(f, a, b, []);
        actualizarControlesReproductor();
        return;
    }

    if (res.tipo === "raiz_extremo") {
        resultBox.style.display = "block";
        resultBox.innerHTML = `
            <strong>Raíz exacta encontrada:</strong> x = ${res.raizExactaExtremo}
            <br><strong>Iteraciones realizadas:</strong> 0
            <br><strong>f(x):</strong> 0
        `;
        generarGrafica(f, res.aInicial, res.bInicial, []);
        actualizarControlesReproductor();
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-table-msg">
                    Se encontró una raíz exacta en uno de los extremos (x = ${res.raizExactaExtremo}).
                </td>
            </tr>
        `;
        return;
    }

    if (res.tipo === "sin_cambio_signo") {
        mostrarError(res.mensajeError);
        generarGrafica(f, res.aInicial, res.bInicial, []);
        actualizarControlesReproductor();
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-table-msg">
                    No hay cambio de signo en [${res.aInicial}, ${res.bInicial}]. Ajusta el intervalo para calcular iteraciones.
                </td>
            </tr>
        `;
        return;
    }

    renderizarTablaIteraciones(res.iteraciones, res.convergio);

    if (res.tipo === "discontinuidad") {
        mostrarError(res.mensajeError);
        generarGrafica(f, res.aInicial, res.bInicial, res.iteraciones);
        actualizarControlesReproductor();
        if (res.iteraciones.length > 0) seleccionarIteracion(0, false);
        return;
    }

    const ultimaIter = res.ultimaIter;
    let estadoHtml;
    if (res.posibleAsintota) {
        estadoHtml = '<span class="danger">Posible asíntota o discontinuidad (|f(xr)| no tiende a 0)</span>';
        mostrarAdvertencia(
            `Atención: el intervalo se redujo alrededor de x ≈ ${ultimaIter.xr.toFixed(6)}, ` +
            `pero |f(xr)| = ${Math.abs(ultimaIter.fxr).toExponential(3)} es muy grande. ` +
            "Esto indica una asíntota vertical o discontinuidad de salto, no una raíz real."
        );
    } else if (res.convergio) {
        estadoHtml = '<span class="status">Convergencia alcanzada</span>';
    } else {
        estadoHtml = '<span class="warning">Se alcanzó el máximo de iteraciones</span>';
    }

    resultBox.style.display = "block";
    resultBox.innerHTML = `
        <strong>${res.posibleAsintota ? "Punto detectado (no es raíz):" : "Raíz aproximada encontrada:"}</strong>
        x ≈ ${ultimaIter.xr.toFixed(10)}
        <br><strong>f(xr):</strong> ${ultimaIter.fxr.toExponential(6)}
        <br><strong>Iteraciones realizadas:</strong> ${ultimaIter.i}
        <br><strong>Error aproximado final:</strong>
        ${ultimaIter.errorRelativo === null ? "No calculado" : ultimaIter.errorRelativo.toFixed(6) + "%"}
        <br><strong>Estado:</strong> ${estadoHtml}
    `;

    generarGrafica(f, res.aInicial, res.bInicial, res.iteraciones);
    actualizarControlesReproductor();
    if (res.iteraciones.length > 0) {
        seleccionarIteracion(0, false);
    }
}

/**
 * Construye las filas de la tabla de auditoría e enlaza cada fila con el drawer didáctico.
 * @param {Array<object>} iteracionesData
 * @param {boolean} convergio
 */
function renderizarTablaIteraciones(iteracionesData, convergio) {
    const tbody = document.querySelector("#tablaResultados tbody");
    tbody.innerHTML = "";

    iteracionesData.forEach((iter, idx) => {
        const row = document.createElement("tr");
        row.dataset.index = idx;
        if (convergio && idx === iteracionesData.length - 1) {
            row.classList.add("converged-row");
        }

        const valores = [
            iter.i,
            iter.a.toFixed(6),
            iter.b.toFixed(6),
            iter.xr.toFixed(6),
            formatearNumero(iter.fa, 5),
            formatearNumero(iter.fb, 5),
            formatearNumero(iter.fxr, 5),
            formatearNumero(iter.producto, 6) + (iter.producto < 0 ? " (Cambia)" : " (Mantiene)"),
            iter.errorRelativo === null ? "---" : iter.errorRelativo.toFixed(6) + "%"
        ];

        valores.forEach((valor, colIdx) => {
            const cell = document.createElement("td");
            cell.textContent = valor;
            if (colIdx === 3) cell.classList.add("xr-cell");
            row.appendChild(cell);
        });

        row.addEventListener("click", () => {
            detenerAnimacion();
            seleccionarIteracion(idx, true);
        });

        tbody.appendChild(row);
    });
}

// ==========================================
// INICIALIZACIÓN E INTERACTIVIDAD GLOBAL
// ==========================================

function inicializarEventos() {
    const mathField = document.getElementById("mathField");
    const inputTexto = document.getElementById("funcion");
    const paramsInput = document.getElementById("parametros");
    const presetSelect = document.getElementById("presetSelect");

    // Selector de casos de estudio
    if (presetSelect) {
        presetSelect.addEventListener("change", () => cargarPreset(presetSelect.value));
    }

    // Popover de información junto al teclado matemático
    const btnMathInfo = document.getElementById("btnMathInfo");
    const mathInfoPopover = document.getElementById("mathInfoPopover");
    const cerrarMathInfo = () => {
        if (!mathInfoPopover || !btnMathInfo) return;
        mathInfoPopover.classList.add("hidden");
        btnMathInfo.setAttribute("aria-expanded", "false");
    };
    if (btnMathInfo && mathInfoPopover) {
        btnMathInfo.addEventListener("click", e => {
            e.stopPropagation();
            const abierto = !mathInfoPopover.classList.contains("hidden");
            mathInfoPopover.classList.toggle("hidden", abierto);
            btnMathInfo.setAttribute("aria-expanded", String(!abierto));
        });
        document.addEventListener("click", e => {
            if (!mathInfoPopover.classList.contains("hidden") && !e.target.closest(".math-info-anchor")) {
                cerrarMathInfo();
            }
        });
    }

    // Eventos del editor visual MathLive y campos del formulario
    if (mathField) {
        mathField.addEventListener("input", () => {
            if (!window.BisectionLabState.sincronizando) actualizarVistaPrevia();
        });
        mathField.addEventListener("keydown", e => {
            if (e.key === "Enter") {
                e.preventDefault();
                calcularBiseccion();
            }
        });
    }

    inputTexto?.addEventListener("input", () => {
        if (!window.BisectionLabState.sincronizando) actualizarVistaPrevia();
    });

    paramsInput?.addEventListener("input", () => {
        if (!window.BisectionLabState.sincronizando) actualizarVistaPrevia();
    });

    ["funcion", "a", "b", "tolerancia", "maxIter"].forEach(id => {
        document.getElementById(id)?.addEventListener("keydown", e => {
            if (e.key === "Enter") {
                e.preventDefault();
                calcularBiseccion();
            }
        });
    });

    // Inicializar submódulos de controles
    inicializarControlesGraficaYReproductor();
    inicializarExportacionYCompartir();

    // Tecla Escape cierra popover, drawer y modales
    document.addEventListener("keydown", e => {
        if (e.key === "Escape") {
            cerrarMathInfo();
            cerrarDrawerDidactico();
            cerrarModalQR();
            if (typeof window.cerrarModalReporte === "function") window.cerrarModalReporte();
        }
    });
}

window.addEventListener("load", async function () {
    inicializarTema();

    if (window.customElements && !customElements.get("math-field")) {
        try {
            await Promise.race([
                customElements.whenDefined("math-field"),
                new Promise(resolve => setTimeout(resolve, 2500))
            ]);
        } catch (_) {
            activarModoRespaldoTexto();
        }
    }

    const mathField = document.getElementById("mathField");
    if (!mathField || typeof mathField.getValue !== "function") {
        activarModoRespaldoTexto();
    } else {
        // Ocultar menú contextual de MathLive y conservar solo el teclado matemático virtual
        mathField.menuItems = [];
    }

    inicializarEventos();

    if (!cargarDesdeURL()) {
        cargarPreset("paracaidistaParams");
    } else {
        actualizarVistaPrevia();
        calcularBiseccion();
    }

    if (typeof window.inicializarReporte === "function") {
        window.inicializarReporte();
    }
});
