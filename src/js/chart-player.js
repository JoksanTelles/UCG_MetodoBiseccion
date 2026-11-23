/**
 * ============================================================================
 * chart-player.js — Visualizador gráfico interactivo y reproductor de iteraciones
 * ----------------------------------------------------------------------------
 * Responsabilidades:
 *  - Dibujar el sombreado dinámico del intervalo [a, b] y los marcadores
 *    verticales a, b y xr mediante un plugin personalizado de Chart.js.
 *  - Calcular escalas inteligentes del eje Y y cortar saltos de asíntotas.
 *  - Administrar zoom/arrastre y sincronización de colores con el tema activo.
 *  - Controlar la animación paso a paso (reproductor multimedia) sincronizada
 *    con la tabla de auditoría y el drawer didáctico.
 * ============================================================================
 */

let chartInstance = null;

/**
 * Plugin personalizado de Chart.js que sombrea el intervalo activo [a, b]
 * y dibuja líneas verticales etiquetadas para a, b y xr.
 */
const bisectionOverlayPlugin = {
    id: "bisectionOverlay",
    beforeDatasetsDraw(chart) {
        const opts = chart.options.plugins && chart.options.plugins.bisectionOverlay;
        if (!opts || opts.a === null || opts.b === null || !Number.isFinite(opts.a) || !Number.isFinite(opts.b)) {
            return;
        }

        const { ctx, chartArea, scales } = chart;
        if (!chartArea || !scales.x || !scales.y) return;

        const xA = scales.x.getPixelForValue(opts.a);
        const xB = scales.x.getPixelForValue(opts.b);
        const left = Math.max(chartArea.left, Math.min(xA, xB));
        const right = Math.min(chartArea.right, Math.max(xA, xB));

        ctx.save();
        ctx.beginPath();
        ctx.rect(chartArea.left, chartArea.top, chartArea.width, chartArea.height);
        ctx.clip();

        // Sombreado del subintervalo activo [a, b]
        if (right > left) {
            ctx.fillStyle = opts.bandColor || "rgba(59, 130, 246, 0.12)";
            ctx.fillRect(left, chartArea.top, right - left, chartArea.height);
        }

        const dibujarLineaVertical = (valor, color, etiqueta, punteada, abajo) => {
            if (valor === null || valor === undefined || !Number.isFinite(valor)) return;
            const px = scales.x.getPixelForValue(valor);
            if (px < chartArea.left - 4 || px > chartArea.right + 4) return;

            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = punteada ? 1.8 : 2.1;
            if (punteada) ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(px, chartArea.top);
            ctx.lineTo(px, chartArea.bottom);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.font = "700 11px Inter, system-ui, sans-serif";
            const boxW = ctx.measureText(etiqueta).width + 12;
            const boxH = 19;
            const boxX = Math.min(Math.max(px - boxW / 2, chartArea.left + 2), chartArea.right - boxW - 2);
            const boxY = abajo ? chartArea.bottom - boxH - 6 : chartArea.top + 6;

            ctx.fillStyle = color;
            ctx.beginPath();
            if (typeof ctx.roundRect === "function") {
                ctx.roundRect(boxX, boxY, boxW, boxH, 5);
            } else {
                ctx.rect(boxX, boxY, boxW, boxH);
            }
            ctx.fill();

            ctx.fillStyle = "#ffffff";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(etiqueta, boxX + boxW / 2, boxY + boxH / 2 + 0.5);
            ctx.restore();
        };

        dibujarLineaVertical(opts.a, "#f59e0b", "a", true, false);
        dibujarLineaVertical(opts.b, "#10b981", "b", true, false);
        if (opts.xr !== null && opts.xr !== undefined) {
            dibujarLineaVertical(opts.xr, "#06b6d4", "xr", false, true);
        }

        ctx.restore();
    }
};

/**
 * Lee las variables CSS activas para adaptar los colores de Chart.js al tema claro/oscuro.
 * @returns {{ grid: string, axisZero: string, text: string, curve: string, curveFill: string, band: string }}
 */
function obtenerColoresTemaGrafica() {
    const styles = getComputedStyle(document.documentElement);
    return {
        grid: styles.getPropertyValue("--chart-grid").trim() || "#e2e8f0",
        axisZero: styles.getPropertyValue("--chart-axis-zero").trim() || "#334155",
        text: styles.getPropertyValue("--chart-text").trim() || "#334155",
        curve: styles.getPropertyValue("--chart-curve").trim() || "#2563eb",
        curveFill: styles.getPropertyValue("--chart-curve-fill").trim() || "rgba(37,99,235,0.12)",
        band: styles.getPropertyValue("--chart-band").trim() || "rgba(59,130,246,0.11)"
    };
}

/**
 * Sincroniza la paleta de colores de la gráfica existente cuando cambia el modo claro/oscuro.
 */
function actualizarTemaGrafica() {
    if (!chartInstance) return;

    const colors = obtenerColoresTemaGrafica();

    if (chartInstance.data.datasets[0]) {
        chartInstance.data.datasets[0].borderColor = colors.curve;
        chartInstance.data.datasets[0].backgroundColor = colors.curveFill;
    }

    if (chartInstance.options.plugins && chartInstance.options.plugins.bisectionOverlay) {
        chartInstance.options.plugins.bisectionOverlay.bandColor = colors.band;
    }

    const { scales, plugins } = chartInstance.options;
    if (plugins && plugins.legend && plugins.legend.labels) {
        plugins.legend.labels.color = colors.text;
    }

    ["x", "y"].forEach(axis => {
        if (!scales[axis]) return;
        if (scales[axis].title) scales[axis].title.color = colors.text;
        if (scales[axis].ticks) scales[axis].ticks.color = colors.text;
        if (scales[axis].grid) {
            scales[axis].grid.color = context =>
                context.tick.value === 0 ? colors.axisZero : colors.grid;
        }
    });

    chartInstance.update("none");
}

/**
 * Calcula un rango Y robusto usando percentiles 5%–95% para evitar que asíntotas
 * verticales aplasten el resto de la curva.
 * @param {Array<{ x: number, y: number | null }>} puntos
 * @param {Array<object>} iteraciones
 * @returns {{ min: number, max: number, recortado: boolean } | null}
 */
function calcularRangoYInteligente(puntos, iteraciones) {
    const valoresY = puntos
        .map(p => p.y)
        .filter(y => y !== null && Number.isFinite(y))
        .sort((a, b) => a - b);

    if (valoresY.length === 0) return null;

    const p05 = valoresY[Math.floor(valoresY.length * 0.05)];
    const p95 = valoresY[Math.floor(valoresY.length * 0.95)];
    const minAbs = valoresY[0];
    const maxAbs = valoresY[valoresY.length - 1];

    const rangoCentral = Math.max(p95 - p05, 1e-6);
    const hayValoresExtremos =
        (maxAbs - minAbs) > rangoCentral * 6 ||
        Math.abs(maxAbs) > 1e5 ||
        Math.abs(minAbs) > 1e5;

    let yMin = hayValoresExtremos ? p05 - rangoCentral * 0.35 : minAbs;
    let yMax = hayValoresExtremos ? p95 + rangoCentral * 0.35 : maxAbs;

    yMin = Math.min(yMin, 0);
    yMax = Math.max(yMax, 0);

    const limiteIter = Math.max(Math.abs(yMax - yMin) * 3, 50);
    for (const item of iteraciones) {
        if (Number.isFinite(item.fxr) && Math.abs(item.fxr) <= limiteIter) {
            yMin = Math.min(yMin, item.fxr);
            yMax = Math.max(yMax, item.fxr);
        }
    }

    const margen = Math.max((yMax - yMin) * 0.12, 0.5);

    return {
        min: yMin - margen,
        max: yMax + margen,
        recortado: hayValoresExtremos
    };
}

/**
 * Construye o reconstruye la gráfica principal de `f(x)` con protección contra asíntotas,
 * historial de puntos `xr`, zoom/arrastre e iteración inicial seleccionada (i = 1).
 * @param {(x: number) => number} f
 * @param {number} aInit
 * @param {number} bInit
 * @param {Array<object>} iteraciones
 */
function generarGrafica(f, aInit, bInit, iteraciones) {
    const canvas = document.getElementById("graficaBiseccion");
    const ctx = canvas.getContext("2d");
    const chartNote = document.getElementById("chartNote");
    const colors = obtenerColoresTemaGrafica();

    if (chartInstance) {
        chartInstance.destroy();
    }

    chartNote.classList.add("hidden");
    chartNote.textContent = "";

    const rango = Math.max(bInit - aInit, 1e-4);
    const minX = aInit - rango * 0.3;
    const maxX = bInit + rango * 0.3;
    const pasos = 320;
    const puntosCrudos = [];

    for (let i = 0; i <= pasos; i++) {
        const x = minX + ((maxX - minX) * i) / pasos;
        let y = null;
        try {
            y = f(x);
        } catch (_) {
            y = null;
        }
        puntosCrudos.push({ x, y });
    }

    const rangoY = calcularRangoYInteligente(puntosCrudos, iteraciones);
    const puntosFuncion = [];
    let discontinuidadDetectada = false;

    const spanY = rangoY ? Math.max(rangoY.max - rangoY.min, 1) : 100;
    const limiteCorte = rangoY ? Math.max(Math.abs(rangoY.min), Math.abs(rangoY.max)) * 2.5 : Infinity;

    for (let i = 0; i < puntosCrudos.length; i++) {
        const actual = puntosCrudos[i];

        if (actual.y === null || Math.abs(actual.y) > limiteCorte) {
            puntosFuncion.push({ x: actual.x, y: null });
            discontinuidadDetectada = true;
            continue;
        }

        const prev = puntosFuncion.length > 0 ? puntosFuncion[puntosFuncion.length - 1] : null;
        if (prev && prev.y !== null) {
            const salto = Math.abs(actual.y - prev.y);
            if (salto > spanY * 1.8 && Math.sign(actual.y) !== Math.sign(prev.y)) {
                puntosFuncion.push({ x: (prev.x + actual.x) / 2, y: null });
                discontinuidadDetectada = true;
            }
        }

        puntosFuncion.push(actual);
    }

    if (rangoY && (rangoY.recortado || discontinuidadDetectada)) {
        chartNote.textContent = "Escala Y ajustada automáticamente por valores extremos / asíntota";
        chartNote.classList.remove("hidden");
    }

    const puntosIteraciones = iteraciones
        .filter(item => !rangoY || (item.fxr >= rangoY.min * 1.5 && item.fxr <= rangoY.max * 1.5))
        .map(item => ({ x: item.xr, y: item.fxr, iter: item.i }));

    const datasets = [
        {
            label: "f(x)",
            data: puntosFuncion,
            borderColor: colors.curve,
            backgroundColor: colors.curveFill,
            borderWidth: 2.3,
            pointRadius: 0,
            showLine: true,
            spanGaps: false,
            tension: 0.15
        }
    ];

    if (puntosIteraciones.length > 0) {
        datasets.push({
            label: "Historial xr",
            data: puntosIteraciones,
            backgroundColor: "rgba(245, 158, 11, 0.72)",
            borderColor: "#d97706",
            pointRadius: 4.5,
            showLine: false
        });

        const primero = puntosIteraciones[0];
        datasets.push({
            _isActivePoint: true,
            label: `Iteración activa (i = ${primero.iter})`,
            data: [primero],
            backgroundColor: "#10b981",
            borderColor: "#ffffff",
            borderWidth: 2,
            pointRadius: 7.5,
            pointStyle: "circle",
            showLine: false
        });
    }

    const yScaleOptions = {
        title: { display: true, text: "f(x)", color: colors.text },
        ticks: { color: colors.text },
        grid: {
            color: context => (context.tick.value === 0 ? colors.axisZero : colors.grid),
            lineWidth: context => (context.tick.value === 0 ? 1.8 : 1)
        }
    };

    if (rangoY && rangoY.recortado) {
        yScaleOptions.min = rangoY.min;
        yScaleOptions.max = rangoY.max;
    }

    const firstIter = iteraciones.length > 0 ? iteraciones[0] : null;

    chartInstance = new Chart(ctx, {
        type: "scatter",
        data: { datasets },
        plugins: [bisectionOverlayPlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: "nearest" },
            plugins: {
                bisectionOverlay: {
                    a: firstIter ? firstIter.a : aInit,
                    b: firstIter ? firstIter.b : bInit,
                    xr: firstIter ? firstIter.xr : null,
                    bandColor: colors.band
                },
                zoom: {
                    pan: { enabled: true, mode: "xy" },
                    zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: "xy" }
                },
                legend: {
                    position: "bottom",
                    labels: { color: colors.text, usePointStyle: true }
                },
                tooltip: {
                    callbacks: {
                        label(context) {
                            const pt = context.raw;
                            if (pt.iter) {
                                return `Iteración ${pt.iter}: xr = ${pt.x.toFixed(6)}, f(xr) = ${formatearNumero(pt.y, 6)}`;
                            }
                            return `x: ${pt.x.toFixed(4)}, f(x): ${
                                pt.y === null ? "No definido" : formatearNumero(pt.y, 4)
                            }`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: "linear",
                    position: "bottom",
                    title: { display: true, text: "Eje X", color: colors.text },
                    ticks: { color: colors.text },
                    grid: {
                        color: context => (context.tick.value === 0 ? colors.axisZero : colors.grid),
                        lineWidth: context => (context.tick.value === 0 ? 1.8 : 1)
                    }
                },
                y: yScaleOptions
            }
        }
    });
}

/**
 * Configura el rango y estado inicial del deslizador y contador del reproductor.
 */
function actualizarControlesReproductor() {
    const iteraciones = window.BisectionLabState.iteraciones;
    const slider = document.getElementById("iterSlider");
    const counter = document.getElementById("iterCounter");

    if (!slider || !counter) return;

    if (iteraciones.length === 0) {
        slider.min = 0;
        slider.max = 0;
        slider.value = 0;
        slider.disabled = true;
        counter.textContent = "0 / 0";
        return;
    }

    slider.disabled = false;
    slider.min = 1;
    slider.max = iteraciones.length;
    slider.value = 1;
    counter.textContent = `1 / ${iteraciones.length}`;
}

/**
 * Selecciona una iteración por índice (0-based) y sincroniza el reproductor,
 * la fila resaltada en la tabla, los marcadores en la gráfica y el drawer didáctico.
 * @param {number} idx
 * @param {boolean} abrirDrawer
 */
function seleccionarIteracion(idx, abrirDrawer = false) {
    const state = window.BisectionLabState;
    const iteraciones = state.iteraciones;
    if (!iteraciones || iteraciones.length === 0) return;

    const clamped = Math.max(0, Math.min(idx, iteraciones.length - 1));
    state.iteracionActivaIdx = clamped;
    const item = iteraciones[clamped];

    // 1. Reproductor
    const slider = document.getElementById("iterSlider");
    const counter = document.getElementById("iterCounter");
    if (slider) slider.value = clamped + 1;
    if (counter) counter.textContent = `${item.i} / ${iteraciones.length}`;

    // 2. Fila activa en la tabla de auditoría
    const rows = document.querySelectorAll("#tablaResultados tbody tr");
    rows.forEach((tr, i) => {
        const esActiva = i === clamped;
        tr.classList.toggle("active-iter-row", esActiva);
        if (esActiva && state.playTimer) {
            tr.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
    });

    // 3. Intervalo [a, b] y punto activo xr en la gráfica
    if (chartInstance) {
        const colors = obtenerColoresTemaGrafica();
        chartInstance.options.plugins.bisectionOverlay = {
            a: item.a,
            b: item.b,
            xr: item.xr,
            bandColor: colors.band
        };

        const dsActive = chartInstance.data.datasets.find(ds => ds._isActivePoint);
        if (dsActive) {
            dsActive.data = [{ x: item.xr, y: item.fxr, iter: item.i }];
            dsActive.label = `Iteración activa (i = ${item.i})`;
        }

        chartInstance.update("none");
    }

    // 4. Panel lateral Paso a Paso Didáctico
    if (typeof renderizarPasoAPasoDrawer === "function") {
        renderizarPasoAPasoDrawer(item, iteraciones.length);
    }
    if (abrirDrawer && typeof abrirDrawerDidactico === "function") {
        abrirDrawerDidactico();
    }
}

/**
 * Inicia o pausa la reproducción automática iteración por iteración.
 */
function alternarReproduccion() {
    const state = window.BisectionLabState;
    if (!state.iteraciones || state.iteraciones.length === 0) return;

    if (state.playTimer) {
        detenerAnimacion();
        return;
    }

    if (state.iteracionActivaIdx >= state.iteraciones.length - 1) {
        seleccionarIteracion(0, false);
    }

    const btnPlayIcon = document.getElementById("btnIterPlayIcon");
    if (btnPlayIcon) btnPlayIcon.textContent = "pause";

    const velocidad = Number(document.getElementById("playSpeed")?.value || 850);

    state.playTimer = setInterval(() => {
        if (state.iteracionActivaIdx < state.iteraciones.length - 1) {
            seleccionarIteracion(state.iteracionActivaIdx + 1, false);
        } else {
            detenerAnimacion();
        }
    }, velocidad);
}

/**
 * Detiene la animación activa del reproductor multimedia.
 */
function detenerAnimacion() {
    const state = window.BisectionLabState;
    if (state.playTimer) {
        clearInterval(state.playTimer);
        state.playTimer = null;
    }
    const btnPlayIcon = document.getElementById("btnIterPlayIcon");
    if (btnPlayIcon) btnPlayIcon.textContent = "play_arrow";
}

/**
 * Enlaza los botones de zoom y los controles del reproductor multimedia.
 */
function inicializarControlesGraficaYReproductor() {
    document.getElementById("btnZoomIn")?.addEventListener("click", () => {
        if (chartInstance && typeof chartInstance.zoom === "function") chartInstance.zoom(1.25);
    });
    document.getElementById("btnZoomOut")?.addEventListener("click", () => {
        if (chartInstance && typeof chartInstance.zoom === "function") chartInstance.zoom(0.8);
    });
    document.getElementById("btnZoomReset")?.addEventListener("click", () => {
        if (chartInstance && typeof chartInstance.resetZoom === "function") chartInstance.resetZoom();
    });

    document.getElementById("btnIterFirst")?.addEventListener("click", () => {
        detenerAnimacion();
        seleccionarIteracion(0, false);
    });
    document.getElementById("btnIterPrev")?.addEventListener("click", () => {
        detenerAnimacion();
        seleccionarIteracion(window.BisectionLabState.iteracionActivaIdx - 1, false);
    });
    document.getElementById("btnIterPlay")?.addEventListener("click", alternarReproduccion);
    document.getElementById("btnIterNext")?.addEventListener("click", () => {
        detenerAnimacion();
        seleccionarIteracion(window.BisectionLabState.iteracionActivaIdx + 1, false);
    });
    document.getElementById("btnIterLast")?.addEventListener("click", () => {
        detenerAnimacion();
        seleccionarIteracion(window.BisectionLabState.iteraciones.length - 1, false);
    });
    document.getElementById("iterSlider")?.addEventListener("input", e => {
        detenerAnimacion();
        seleccionarIteracion(Number(e.target.value) - 1, false);
    });
    document.getElementById("playSpeed")?.addEventListener("change", () => {
        if (window.BisectionLabState.playTimer) {
            detenerAnimacion();
            alternarReproduccion();
        }
    });
}
