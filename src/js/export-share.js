/**
 * ============================================================================
 * export-share.js — Drawer didáctico, exportación Excel (.xlsx) y difusión QR
 * ----------------------------------------------------------------------------
 * Responsabilidades:
 *  - Mostrar el desarrollo algebraico paso a paso en KaTeX de cualquier
 *    iteración seleccionada (Drawer lateral deslizante).
 *  - Exportar la tabla de auditoría y el resumen a Excel (.xlsx vía SheetJS)
 *    con respaldo automático en formato CSV.
 *  - Codificar/decodificar parámetros en la URL y generar códigos QR en SVG.
 *  - Administrar el modal rápido de Compartir QR y el copiado al portapapeles.
 * ============================================================================
 */

// ==========================================
// DRAWER LATERAL: PASO A PASO DIDÁCTICO
// ==========================================

/**
 * Abre el panel lateral deslizante con el desarrollo algebraico de la iteración activa.
 */
function abrirDrawerDidactico() {
    const drawer = document.getElementById("stepDrawer");
    const backdrop = document.getElementById("drawerBackdrop");
    if (!drawer || !backdrop) return;

    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    backdrop.classList.remove("hidden");

    const state = window.BisectionLabState;
    if (state.iteraciones.length > 0 && state.iteracionActivaIdx >= 0) {
        renderizarPasoAPasoDrawer(
            state.iteraciones[state.iteracionActivaIdx],
            state.iteraciones.length
        );
    }
}

/**
 * Cierra el panel lateral de desarrollo paso a paso.
 */
function cerrarDrawerDidactico() {
    const drawer = document.getElementById("stepDrawer");
    const backdrop = document.getElementById("drawerBackdrop");
    if (!drawer || !backdrop) return;

    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    backdrop.classList.add("hidden");
}

/**
 * Renderiza en KaTeX los 5 pasos didácticos de una iteración específica.
 * @param {object} item - Datos de la iteración seleccionada.
 * @param {number} total - Total de iteraciones calculadas.
 */
function renderizarPasoAPasoDrawer(item, total) {
    const titleEl = document.getElementById("drawerTitle");
    const badgeEl = document.getElementById("drawerIterBadge");
    const bodyEl = document.getElementById("drawerBody");
    if (!bodyEl) return;

    if (titleEl) titleEl.textContent = `Desarrollo — Iteración ${item.i}`;
    if (badgeEl) badgeEl.textContent = `i = ${item.i} de ${total}`;

    const state = window.BisectionLabState;
    const aStr = item.a.toFixed(6);
    const bStr = item.b.toFixed(6);
    const xrStr = item.xr.toFixed(6);
    const faStr = formatearNumero(item.fa, 6);
    const fbStr = formatearNumero(item.fb, 6);
    const fxrStr = formatearNumero(item.fxr, 6);
    const prodStr = formatearNumero(item.producto, 6);

    let decisionTexto = "";
    let decisionTex = "";
    if (item.decision === "exacta") {
        decisionTex = `f(x_r) = 0 \\implies \\text{Raíz exacta encontrada}`;
        decisionTexto = `La función se anula exactamente en xᵣ = ${xrStr}. El algoritmo termina inmediatamente.`;
    } else if (item.decision === "izquierda") {
        decisionTex = `f(a) \\cdot f(x_r) = ${prodStr} < 0 \\implies b_{${item.i + 1}} = x_r = ${xrStr}`;
        decisionTexto = `Como el producto es negativo, el cambio de signo está en la mitad izquierda [${aStr}, ${xrStr}]. Por ello se actualiza el límite superior b.`;
    } else {
        decisionTex = `f(a) \\cdot f(x_r) = ${prodStr} > 0 \\implies a_{${item.i + 1}} = x_r = ${xrStr}`;
        decisionTexto = `Como el producto es positivo, el cambio de signo está en la mitad derecha [${xrStr}, ${bStr}]. Por ello se actualiza el límite inferior a.`;
    }

    let errorTex = "";
    let errorNota = "";
    if (item.errorRelativo === null || item.xrAnterior === null) {
        errorTex = `\\varepsilon_a = \\text{No aplica en la iteración } 1`;
        errorNota = "En la primera iteración aún no existe una aproximación previa xᵣ⁽⁰⁾ para calcular el error relativo.";
    } else {
        const prevStr = item.xrAnterior.toFixed(6);
        const errStr = item.errorRelativo.toFixed(6);
        const cumple = item.errorRelativo <= state.tol;
        errorTex = `\\varepsilon_a = \\left|\\frac{${xrStr} - ${prevStr}}{${xrStr}}\\right| \\times 100\\% = ${errStr}\\%`;
        errorNota = cumple
            ? `Cumple el criterio de parada: εₐ (${errStr}%) ≤ εₛ (${state.tol}%).`
            : `Continúa iterando: εₐ (${errStr}%) > εₛ (${state.tol}%).`;
    }

    bodyEl.innerHTML = `
        <div class="step-card">
            <h4>1. Intervalo activo y función</h4>
            <div class="step-katex-block" id="stepK1"></div>
            <p class="step-note">Ancho del intervalo actual: |b − a| = ${(item.b - item.a).toFixed(6)}</p>
        </div>
        <div class="step-card">
            <h4>2. Cálculo del punto medio (xᵣ)</h4>
            <div class="step-katex-block" id="stepK2"></div>
        </div>
        <div class="step-card">
            <h4>3. Evaluación en f(xᵣ)</h4>
            <div class="step-katex-block" id="stepK3"></div>
            <p class="step-note">Extremos: f(a) = ${faStr}, f(b) = ${fbStr}.</p>
        </div>
        <div class="step-card">
            <h4>4. Criterio de Bolzano y actualización</h4>
            <div class="step-katex-block" id="stepK4"></div>
            <p class="step-note">${decisionTexto}</p>
        </div>
        <div class="step-card">
            <h4>5. Error relativo aproximado (εₐ)</h4>
            <div class="step-katex-block" id="stepK5"></div>
            <p class="step-note">${errorNota}</p>
        </div>
    `;

    renderKatexEnElemento(
        document.getElementById("stepK1"),
        `f(x) = ${state.texRender} \\\\ [a_{${item.i}}, b_{${item.i}}] = [${aStr},\\; ${bStr}]`
    );
    renderKatexEnElemento(
        document.getElementById("stepK2"),
        `x_r = \\frac{a + b}{2} = \\frac{${aStr} + ${bStr}}{2} = ${xrStr}`
    );
    renderKatexEnElemento(
        document.getElementById("stepK3"),
        `f(${xrStr}) = ${fxrStr}`
    );
    renderKatexEnElemento(document.getElementById("stepK4"), decisionTex);
    renderKatexEnElemento(document.getElementById("stepK5"), errorTex);
}

// ==========================================
// EXPORTACIÓN A EXCEL (.xlsx) CON RESPALDO CSV
// ==========================================

/**
 * Descarga la tabla de iteraciones y una hoja de resumen en formato Excel (.xlsx).
 * Si la librería SheetJS no está disponible, genera automáticamente un archivo .csv.
 */
function exportarExcel() {
    const state = window.BisectionLabState;
    if (!state.iteraciones || state.iteraciones.length === 0) {
        mostrarAdvertencia("Primero ejecuta un cálculo válido para exportar la tabla.");
        return;
    }

    const filasTabla = state.iteraciones.map(it => ({
        "Iteración (i)": it.i,
        "a": Number(it.a.toFixed(8)),
        "b": Number(it.b.toFixed(8)),
        "Raíz aprox. (xr)": Number(it.xr.toFixed(8)),
        "f(a)": it.fa,
        "f(b)": it.fb,
        "f(xr)": it.fxr,
        "f(a) * f(xr)": it.producto,
        "Decisión": it.decision === "izquierda" ? "b = xr" : it.decision === "derecha" ? "a = xr" : "Raíz exacta",
        "Error relativo (%)": it.errorRelativo === null ? "" : Number(it.errorRelativo.toFixed(6))
    }));

    const nombreBase = `BisectionLab_Iteraciones_${new Date().toISOString().slice(0, 10)}`;

    if (window.XLSX) {
        const wb = window.XLSX.utils.book_new();

        const resumen = [
            { Campo: "Plataforma", Valor: "BisectionLab — Método de Bisección" },
            { Campo: "Función f(x)", Valor: state.exprNormalizada },
            { Campo: "Parámetros", Valor: state.parametrosTexto || "Ninguno" },
            { Campo: "Intervalo inicial", Valor: `[${state.aInicial}, ${state.bInicial}]` },
            { Campo: "Tolerancia (%)", Valor: state.tol },
            { Campo: "Iteraciones realizadas", Valor: state.iteraciones.length },
            { Campo: "Raíz aproximada (xr)", Valor: state.ultimaIter ? state.ultimaIter.xr : "" },
            { Campo: "Error final (%)", Valor: state.ultimaIter && state.ultimaIter.errorRelativo !== null ? state.ultimaIter.errorRelativo : "N/A" },
            { Campo: "Estado", Valor: state.estadoTexto }
        ];

        const wsIter = window.XLSX.utils.json_to_sheet(filasTabla);
        const wsResumen = window.XLSX.utils.json_to_sheet(resumen);

        window.XLSX.utils.book_append_sheet(wb, wsIter, "Iteraciones");
        window.XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");
        window.XLSX.writeFile(wb, `${nombreBase}.xlsx`);
        return;
    }

    // Respaldo automático CSV sin conexión
    const headers = Object.keys(filasTabla[0]);
    const csvLines = [
        headers.join(","),
        ...filasTabla.map(row =>
            headers.map(h => `"${String(row[h]).replace(/"/g, '""')}"`).join(",")
        )
    ];
    const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nombreBase}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ==========================================
// ENLACE COMPARTIBLE, QR Y PARÁMETROS URL
// ==========================================

/**
 * Construye una URL con la ecuación, parámetros, límites, tolerancia y máx. iteraciones actuales.
 * @returns {string}
 */
function generarUrlEscenario() {
    const state = window.BisectionLabState;
    const base = `${window.location.origin}${window.location.pathname}`;
    const params = new URLSearchParams();

    params.set("fn", state.exprNormalizada || "");
    if (state.parametrosTexto && state.parametrosTexto.trim()) {
        params.set("params", state.parametrosTexto.trim());
    }
    params.set("a", document.getElementById("a").value);
    params.set("b", document.getElementById("b").value);
    params.set("tol", document.getElementById("tolerancia").value);
    params.set("maxIter", document.getElementById("maxIter").value);

    const urlBase = window.location.protocol === "file:"
        ? "https://bisectionlab.local/index.html"
        : base;

    return `${urlBase}?${params.toString()}`;
}

/**
 * Genera y dibuja un código QR vectorial en SVG dentro del contenedor indicado.
 * @param {HTMLElement | null} containerEl
 * @param {string} texto
 */
function renderizarQR(containerEl, texto) {
    if (!containerEl) return;
    containerEl.innerHTML = "";

    if (typeof window.qrcode === "function") {
        try {
            const qr = window.qrcode(0, "M");
            qr.addData(texto);
            qr.make();
            const count = qr.getModuleCount();
            const margin = 2;
            const total = count + margin * 2;
            let rects = "";
            for (let r = 0; r < count; r++) {
                for (let c = 0; c < count; c++) {
                    if (qr.isDark(r, c)) {
                        rects += `<rect x="${c + margin}" y="${r + margin}" width="1" height="1" fill="#0f172a"/>`;
                    }
                }
            }
            containerEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="#ffffff"/>${rects}</svg>`;
            return;
        } catch (_) {
            containerEl.innerHTML = '<span style="font-size:11px;color:#64748b;text-align:center;">URL demasiado extensa para QR</span>';
            return;
        }
    }

    containerEl.innerHTML = '<span style="font-size:11px;color:#64748b;text-align:center;">QR requiere librería CDN</span>';
}

/**
 * Abre el modal rápido de Compartir QR con el escenario activo codificado.
 */
function abrirModalQR() {
    const backdrop = document.getElementById("qrModalBackdrop");
    const box = document.getElementById("modalQrBox");
    if (!backdrop) return;

    renderizarQR(box, generarUrlEscenario());
    backdrop.classList.remove("hidden");
}

/**
 * Cierra el modal rápido de Compartir QR.
 */
function cerrarModalQR() {
    const backdrop = document.getElementById("qrModalBackdrop");
    if (backdrop) backdrop.classList.add("hidden");
}

/**
 * Copia texto al portapapeles y muestra confirmación temporal en el botón pulsado.
 * @param {string} texto
 * @param {HTMLElement | null} botonEl
 */
async function copiarTextoPortapapeles(texto, botonEl) {
    try {
        await navigator.clipboard.writeText(texto);
    } catch (_) {
        const temp = document.createElement("textarea");
        temp.value = texto;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        document.body.removeChild(temp);
    }

    if (botonEl) {
        const originalHtml = botonEl.innerHTML;
        botonEl.innerHTML = '<span class="material-icons-round mi-sm" aria-hidden="true">check</span><span>¡Enlace copiado!</span>';
        setTimeout(() => {
            botonEl.innerHTML = originalHtml;
        }, 1800);
    }
}

/**
 * Lee parámetros de escenario codificados en la URL (`?fn=...&params=...&a=...&b=...`)
 * y precarga el formulario si existen.
 * @returns {boolean} `true` si se cargó un escenario desde la URL.
 */
function cargarDesdeURL() {
    const qs = new URLSearchParams(window.location.search);
    const fn = qs.get("fn");
    if (!fn) return false;

    const params = qs.get("params") || "";
    const a = qs.get("a");
    const b = qs.get("b");
    const tol = qs.get("tol");
    const maxIter = qs.get("maxIter");

    const mathField = document.getElementById("mathField");
    const inputTexto = document.getElementById("funcion");
    const paramsInput = document.getElementById("parametros");

    window.BisectionLabState.sincronizando = true;
    if (inputTexto) inputTexto.value = fn;

    try {
        const nodo = math.parse(normalizarExpresion(fn));
        const tex = nodo.toTex({ parenthesis: "auto", implicit: "hide" });
        if (mathField) mathField.value = tex;
    } catch (_) {
        if (mathField) mathField.value = fn;
    }

    if (paramsInput) paramsInput.value = params;
    if (a !== null && !Number.isNaN(Number(a))) document.getElementById("a").value = a;
    if (b !== null && !Number.isNaN(Number(b))) document.getElementById("b").value = b;
    if (tol !== null && !Number.isNaN(Number(tol))) document.getElementById("tolerancia").value = tol;
    if (maxIter !== null && !Number.isNaN(Number(maxIter))) document.getElementById("maxIter").value = maxIter;

    window.BisectionLabState.sincronizando = false;
    return true;
}

/**
 * Enlaza los eventos del Drawer didáctico, exportación Excel y modal rápido de QR.
 */
function inicializarExportacionYCompartir() {
    // Drawer Paso a Paso
    document.getElementById("btnDrawerEdgeTab")?.addEventListener("click", abrirDrawerDidactico);
    document.getElementById("btnOpenDrawerInline")?.addEventListener("click", abrirDrawerDidactico);
    document.getElementById("btnCloseDrawer")?.addEventListener("click", cerrarDrawerDidactico);
    document.getElementById("drawerBackdrop")?.addEventListener("click", cerrarDrawerDidactico);
    document.getElementById("btnDrawerPrev")?.addEventListener("click", () => {
        detenerAnimacion();
        seleccionarIteracion(window.BisectionLabState.iteracionActivaIdx - 1, true);
    });
    document.getElementById("btnDrawerNext")?.addEventListener("click", () => {
        detenerAnimacion();
        seleccionarIteracion(window.BisectionLabState.iteracionActivaIdx + 1, true);
    });

    // Exportación Excel y apertura del modal de reporte
    document.getElementById("btnExportExcel")?.addEventListener("click", exportarExcel);
    document.getElementById("btnGoReport")?.addEventListener("click", () => {
        if (typeof window.abrirModalReporte === "function") window.abrirModalReporte();
    });

    // Modal rápido de QR
    document.getElementById("btnOpenQrModal")?.addEventListener("click", abrirModalQR);
    document.getElementById("btnCloseQrModal")?.addEventListener("click", cerrarModalQR);
    document.getElementById("qrModalBackdrop")?.addEventListener("click", e => {
        if (e.target.id === "qrModalBackdrop") cerrarModalQR();
    });
    document.getElementById("btnCopyLinkModal")?.addEventListener("click", e => {
        copiarTextoPortapapeles(generarUrlEscenario(), e.currentTarget);
    });
    document.getElementById("btnModalGoReport")?.addEventListener("click", () => {
        cerrarModalQR();
        if (typeof window.abrirModalReporte === "function") window.abrirModalReporte();
    });
}
