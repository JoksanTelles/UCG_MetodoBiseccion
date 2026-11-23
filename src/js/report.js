/**
 * ============================================================================
 * report.js — Modal de Reporte Técnico (PDF) y Difusión QR
 * ----------------------------------------------------------------------------
 * Responsabilidades:
 *  - Renderizar una gráfica estática en fondo blanco optimizada para impresión.
 *  - Poblar el resumen estadístico, la tabla resumida de iteraciones, la
 *    conclusión técnica dinámica y la marca de fecha/hora exacta.
 *  - Generar el código QR a tamaño completo dentro del modal de reporte.
 *  - Controlar la apertura, cierre ("Volver atrás") e impresión/exportación PDF.
 * ============================================================================
 */

(function () {
    /**
     * Dibuja en un canvas fuera de pantalla una gráfica de f(x) sobre fondo blanco
     * (independiente del modo oscuro) lista para incrustarse en la hoja de impresión.
     * @param {object} state - Estado global de BisectionLab.
     * @returns {string} Data URL en formato PNG.
     */
    function generarImagenGraficaImpresion(state) {
        const offCanvas = document.createElement("canvas");
        offCanvas.width = 680;
        offCanvas.height = 310;
        const ctx = offCanvas.getContext("2d");

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, offCanvas.width, offCanvas.height);

        if (!state.funcionCompilada) return offCanvas.toDataURL("image/png");

        const padL = 56, padR = 24, padT = 22, padB = 40;
        const plotW = offCanvas.width - padL - padR;
        const plotH = offCanvas.height - padT - padB;

        const aInit = state.aInicial;
        const bInit = state.bInicial;
        const rango = Math.max(bInit - aInit, 1e-4);
        const minX = aInit - rango * 0.25;
        const maxX = bInit + rango * 0.25;

        const pasos = 260;
        const pts = [];
        for (let i = 0; i <= pasos; i++) {
            const x = minX + ((maxX - minX) * i) / pasos;
            let y = null;
            try {
                y = state.funcionCompilada(x);
            } catch (_) {
                y = null;
            }
            pts.push({ x, y });
        }

        const rangoY = calcularRangoYInteligente(pts, state.iteraciones || []) || { min: -10, max: 10 };
        const minY = rangoY.min;
        const maxY = rangoY.max;

        const toPxX = x => padL + ((x - minX) / (maxX - minX)) * plotW;
        const toPxY = y => padT + (1 - (y - minY) / (maxY - minY)) * plotH;

        // Cuadrícula y etiquetas de ejes
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
            const gx = padL + (plotW * i) / 5;
            const gy = padT + (plotH * i) / 5;

            ctx.beginPath();
            ctx.moveTo(gx, padT);
            ctx.lineTo(gx, padT + plotH);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(padL, gy);
            ctx.lineTo(padL + plotW, gy);
            ctx.stroke();

            const valX = minX + ((maxX - minX) * i) / 5;
            const valY = maxY - ((maxY - minY) * i) / 5;
            ctx.fillStyle = "#475569";
            ctx.font = "11px Inter, system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(valX.toFixed(2), gx, padT + plotH + 16);

            ctx.textAlign = "right";
            ctx.fillText(formatearNumero(valY, 2), padL - 8, gy + 4);
        }

        ctx.strokeStyle = "#94a3b8";
        ctx.strokeRect(padL, padT, plotW, plotH);

        // Área recortada para ejes, curva y marcador de raíz
        ctx.save();
        ctx.beginPath();
        ctx.rect(padL, padT, plotW, plotH);
        ctx.clip();

        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 1.4;
        if (minY <= 0 && maxY >= 0) {
            const y0 = toPxY(0);
            ctx.beginPath();
            ctx.moveTo(padL, y0);
            ctx.lineTo(padL + plotW, y0);
            ctx.stroke();
        }
        if (minX <= 0 && maxX >= 0) {
            const x0 = toPxX(0);
            ctx.beginPath();
            ctx.moveTo(x0, padT);
            ctx.lineTo(x0, padT + plotH);
            ctx.stroke();
        }

        const spanY = Math.max(maxY - minY, 1);
        const limiteCorte = Math.max(Math.abs(minY), Math.abs(maxY)) * 2.5;
        ctx.strokeStyle = "#1d4ed8";
        ctx.lineWidth = 2.3;
        ctx.beginPath();
        let trazando = false;
        let prevY = null;

        for (const p of pts) {
            if (p.y === null || !Number.isFinite(p.y) || Math.abs(p.y) > limiteCorte) {
                trazando = false;
                prevY = null;
                continue;
            }
            if (prevY !== null && Math.abs(p.y - prevY) > spanY * 1.8 && Math.sign(p.y) !== Math.sign(prevY)) {
                trazando = false;
            }
            const px = toPxX(p.x);
            const py = toPxY(p.y);
            if (!trazando) {
                ctx.moveTo(px, py);
                trazando = true;
            } else {
                ctx.lineTo(px, py);
            }
            prevY = p.y;
        }
        ctx.stroke();

        // Marcador del punto de raíz encontrada
        const raizX = state.raizExactaExtremo !== null
            ? state.raizExactaExtremo
            : (state.ultimaIter ? state.ultimaIter.xr : null);
        const raizY = state.raizExactaExtremo !== null
            ? 0
            : (state.ultimaIter ? state.ultimaIter.fxr : null);

        if (raizX !== null && raizY !== null && Number.isFinite(raizY)) {
            const rx = toPxX(raizX);
            const ry = toPxY(raizY);

            ctx.strokeStyle = "#0f766e";
            ctx.setLineDash([4, 3]);
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(rx, padT + plotH);
            ctx.lineTo(rx, ry);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = "#10b981";
            ctx.strokeStyle = "#064e3b";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(rx, ry, 5.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "#0f172a";
            ctx.font = "700 11px Inter, system-ui, sans-serif";
            ctx.textAlign = "left";
            ctx.fillText(`xr ≈ ${raizX.toFixed(5)}`, Math.min(rx + 8, padL + plotW - 95), Math.max(ry - 10, padT + 14));
        }

        ctx.restore();

        ctx.fillStyle = "#334155";
        ctx.font = "700 11px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("x", padL + plotW / 2, offCanvas.height - 6);

        return offCanvas.toDataURL("image/png");
    }

    /**
     * Llena la tabla resumida de iteraciones del documento PDF (si excede 12 filas,
     * conserva las 5 primeras y las 5 últimas para mantener el dictamen compacto).
     * @param {Array<object>} iteraciones
     */
    function poblarTablaResumida(iteraciones) {
        const tbody = document.querySelector("#sheetIterTable tbody");
        if (!tbody) return;
        tbody.innerHTML = "";

        if (!iteraciones || iteraciones.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#64748b;">Sin iteraciones registradas.</td></tr>';
            return;
        }

        const seleccion = iteraciones.length > 12
            ? [...iteraciones.slice(0, 5), null, ...iteraciones.slice(-5)]
            : iteraciones;

        seleccion.forEach(it => {
            const tr = document.createElement("tr");
            if (it === null) {
                tr.innerHTML = `<td colspan="6" style="text-align:center;color:#64748b;font-style:italic;">... (${iteraciones.length - 10} iteraciones intermedias omitidas en el resumen) ...</td>`;
            } else {
                tr.innerHTML = `
                    <td>${it.i}</td>
                    <td>${it.a.toFixed(6)}</td>
                    <td>${it.b.toFixed(6)}</td>
                    <td><strong>${it.xr.toFixed(6)}</strong></td>
                    <td>${formatearNumero(it.fxr, 5)}</td>
                    <td>${it.errorRelativo === null ? "---" : it.errorRelativo.toFixed(5) + "%"}</td>
                `;
            }
            tbody.appendChild(tr);
        });
    }

    /**
     * Redacta una conclusión técnica personalizada según el resultado del cálculo activo.
     * @param {object} state
     * @returns {string}
     */
    function redactarConclusion(state) {
        if (state.raizExactaExtremo !== null) {
            return `Se determinó una raíz exacta en uno de los extremos del intervalo [${state.aInicial}, ${state.bInicial}], obteniendo x = ${state.raizExactaExtremo} con f(x) = 0 sin requerir iteraciones adicionales.`;
        }
        if (!state.ultimaIter) {
            return `No se completó una aproximación numérica válida para el intervalo [${state.aInicial}, ${state.bInicial}]. Verifique el cumplimiento del Teorema de Bolzano (f(a)·f(b) < 0) y la continuidad de la función.`;
        }
        if (state.posibleAsintota) {
            return `El algoritmo redujo el intervalo alrededor de x ≈ ${state.ultimaIter.xr.toFixed(6)} tras ${state.ultimaIter.i} iteraciones; sin embargo, |f(xr)| = ${Math.abs(state.ultimaIter.fxr).toExponential(3)} permanece elevado, lo que evidencia una posible asíntota vertical o discontinuidad y no una raíz real.`;
        }
        const errStr = state.ultimaIter.errorRelativo !== null
            ? `${state.ultimaIter.errorRelativo.toFixed(6)}%`
            : "N/A";
        if (state.convergio) {
            return `Con una tolerancia establecida de ${state.tol}%, el Método de Bisección convergió satisfactoriamente en ${state.ultimaIter.i} iteraciones dentro del intervalo [${state.aInicial}, ${state.bInicial}]. La raíz aproximada encontrada es x ≈ ${state.ultimaIter.xr.toFixed(6)}, con un residuo f(xr) = ${state.ultimaIter.fxr.toExponential(4)} y un error relativo final de ${errStr}.`;
        }
        return `Al alcanzar el límite configurado de ${state.maxIter} iteraciones, la mejor aproximación obtenida es x ≈ ${state.ultimaIter.xr.toFixed(6)} con error relativo de ${errStr}. Se recomienda incrementar el número máximo de iteraciones o ajustar la tolerancia.`;
    }

    function setText(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    /**
     * Actualiza todos los elementos dinámicos del reporte técnico y su código QR.
     */
    function actualizarVistaReporte() {
        const state = window.BisectionLabState;
        if (!state) return;

        const fechaHoraExacta = new Date().toLocaleString("es-MX", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false
        });
        setText("sheetGeneratedAt", `Reporte del método de bisección, generado el ${fechaHoraExacta}`);

        renderKatexEnElemento(
            document.getElementById("sheetFormulaKatex"),
            `f(x) = ${state.texRender}`,
            true
        );

        const paramsLine = document.getElementById("sheetParamsLine");
        if (paramsLine) {
            paramsLine.textContent = state.parametrosTexto && state.parametrosTexto.trim()
                ? `Constantes aplicadas: ${state.parametrosTexto.trim()}`
                : "Sin parámetros adicionales definidos.";
        }

        setText("sheetSumInterval", `[${state.aInicial}, ${state.bInicial}]`);
        setText("sheetSumTol", `${state.tol}%`);
        setText("sheetSumIter", String(state.iteraciones ? state.iteraciones.length : 0));

        if (state.raizExactaExtremo !== null) {
            setText("sheetSumRoot", String(state.raizExactaExtremo));
            setText("sheetSumFxr", "0");
            setText("sheetSumErr", "0%");
        } else if (state.ultimaIter) {
            setText("sheetSumRoot", state.ultimaIter.xr.toFixed(8));
            setText("sheetSumFxr", state.ultimaIter.fxr.toExponential(5));
            setText("sheetSumErr", state.ultimaIter.errorRelativo === null ? "N/A" : `${state.ultimaIter.errorRelativo.toFixed(6)}%`);
        } else {
            setText("sheetSumRoot", "—");
            setText("sheetSumFxr", "—");
            setText("sheetSumErr", "—");
        }

        setText("sheetSumStatus", state.estadoTexto || "—");

        const imgEl = document.getElementById("sheetChartImg");
        if (imgEl) {
            imgEl.src = generarImagenGraficaImpresion(state);
        }

        poblarTablaResumida(state.iteraciones);
        setText("sheetConclusion", redactarConclusion(state));

        renderizarQR(document.getElementById("reportQrBox"), generarUrlEscenario());

        const protoNote = document.getElementById("qrProtocolNote");
        if (protoNote) {
            protoNote.classList.toggle("hidden", window.location.protocol !== "file:");
        }
    }

    /**
     * Abre el modal del reporte técnico pausando cualquier animación en curso.
     */
    function abrirModalReporte() {
        const backdrop = document.getElementById("reportModalBackdrop");
        if (!backdrop) return;

        if (typeof detenerAnimacion === "function") detenerAnimacion();
        actualizarVistaReporte();
        backdrop.classList.remove("hidden");
        document.body.classList.add("modal-open");
    }

    /**
     * Cierra el modal del reporte técnico y devuelve el foco al Laboratorio.
     */
    function cerrarModalReporte() {
        const backdrop = document.getElementById("reportModalBackdrop");
        if (!backdrop) return;

        backdrop.classList.add("hidden");
        document.body.classList.remove("modal-open");
    }

    /**
     * Enlaza los botones del modal de reporte (exportar PDF, copiar enlace y volver atrás).
     */
    function inicializarReporte() {
        document.getElementById("btnPrintPdfSide")?.addEventListener("click", () => {
            actualizarVistaReporte();
            setTimeout(() => window.print(), 120);
        });

        document.getElementById("btnReportBack")?.addEventListener("click", cerrarModalReporte);
        document.getElementById("reportModalBackdrop")?.addEventListener("click", e => {
            if (e.target.id === "reportModalBackdrop") cerrarModalReporte();
        });

        document.getElementById("btnCopyLinkReport")?.addEventListener("click", e => {
            copiarTextoPortapapeles(generarUrlEscenario(), e.currentTarget);
        });
    }

    window.inicializarReporte = inicializarReporte;
    window.abrirModalReporte = abrirModalReporte;
    window.cerrarModalReporte = cerrarModalReporte;
})();
