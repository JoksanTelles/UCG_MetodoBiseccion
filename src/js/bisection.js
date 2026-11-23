/**
 * ============================================================================
 * bisection.js — Núcleo matemático del Método de Bisección
 * ----------------------------------------------------------------------------
 * Responsabilidades:
 *  - Evaluar extremos iniciales y validar el Teorema de Bolzano (f(a)·f(b) < 0).
 *  - Detectar raíces exactas en los extremos del intervalo.
 *  - Ejecutar el algoritmo iterativo de bisección con cálculo de error relativo
 *    porcentual aproximado (εa) y protección contra discontinuidades.
 *  - Detectar posibles asíntotas verticales / falsa convergencia.
 * ============================================================================
 */

/**
 * Ejecuta el Método de Bisección sobre una función compilada `f(x)`.
 *
 * @param {object} config
 * @param {(x: number) => number} config.f - Función real compilada.
 * @param {number} config.a - Límite inferior inicial del intervalo.
 * @param {number} config.b - Límite superior inicial del intervalo.
 * @param {number} config.tol - Tolerancia de error relativo porcentual (%).
 * @param {number} config.maxIter - Número máximo de iteraciones permitidas.
 * @returns {{
 *   tipo: "error_extremos" | "raiz_extremo" | "sin_cambio_signo" | "discontinuidad" | "completado",
 *   aInicial: number,
 *   bInicial: number,
 *   faInicial: number | null,
 *   fbInicial: number | null,
 *   iteraciones: Array<object>,
 *   ultimaIter: object | null,
 *   convergio: boolean,
 *   posibleAsintota: boolean,
 *   raizExactaExtremo: number | null,
 *   estadoTexto: string,
 *   mensajeError: string | null
 * }}
 */
function ejecutarMetodoBiseccion({ f, a, b, tol, maxIter }) {
    const aInicial = a;
    const bInicial = b;

    // 1. Evaluar extremos iniciales
    let fa, fb;
    try {
        fa = f(a);
        fb = f(b);
    } catch (error) {
        return {
            tipo: "error_extremos",
            aInicial,
            bInicial,
            faInicial: null,
            fbInicial: null,
            iteraciones: [],
            ultimaIter: null,
            convergio: false,
            posibleAsintota: false,
            raizExactaExtremo: null,
            estadoTexto: "Extremo indefinido",
            mensajeError: `La función no está definida en alguno de los extremos. (${error.message})`
        };
    }

    const faInicial = fa;
    const fbInicial = fb;

    // 2. Comprobar si algún extremo ya es raíz exacta
    if (fa === 0 || fb === 0) {
        const raiz = fa === 0 ? a : b;
        return {
            tipo: "raiz_extremo",
            aInicial,
            bInicial,
            faInicial,
            fbInicial,
            iteraciones: [],
            ultimaIter: null,
            convergio: true,
            posibleAsintota: false,
            raizExactaExtremo: raiz,
            estadoTexto: "Raíz exacta en extremo",
            mensajeError: null
        };
    }

    // 3. Validar condición del Teorema de Bolzano (cambio de signo)
    if (Math.sign(fa) === Math.sign(fb)) {
        return {
            tipo: "sin_cambio_signo",
            aInicial,
            bInicial,
            faInicial,
            fbInicial,
            iteraciones: [],
            ultimaIter: null,
            convergio: false,
            posibleAsintota: false,
            raizExactaExtremo: null,
            estadoTexto: "Sin cambio de signo (Bolzano)",
            mensajeError:
                `No existe cambio de signo en el intervalo [${aInicial}, ${bInicial}]. ` +
                `f(a) = ${fa.toFixed(6)} y f(b) = ${fb.toFixed(6)}. Selecciona otro intervalo.`
        };
    }

    // 4. Ciclo iterativo de bisección
    let xr = 0;
    let xrAnterior = null;
    let errorRelativo = null;
    const iteraciones = [];
    let convergio = false;
    let errorDiscontinuidad = null;

    for (let i = 1; i <= maxIter; i++) {
        const aActual = a;
        const bActual = b;
        xr = (a + b) / 2;

        let fxr;
        try {
            fa = f(a);
            fb = f(b);
            fxr = f(xr);
        } catch (_) {
            errorDiscontinuidad =
                `Se encontró una discontinuidad o valor indefinido en la iteración ${i} ` +
                `(x = ${xr.toFixed(6)}). El método de bisección requiere que f(x) sea continua en [${aInicial}, ${bInicial}].`;
            break;
        }

        const producto = fa * fxr;

        // Error relativo porcentual aproximado: εa = |(xr - xrAnterior) / xr| * 100
        if (xrAnterior !== null) {
            errorRelativo = xr !== 0
                ? Math.abs((xr - xrAnterior) / xr) * 100
                : Math.abs(xr - xrAnterior) * 100;
        }

        // Selección del nuevo subintervalo según el signo de f(a)·f(xr)
        let nuevoA = aActual;
        let nuevoB = bActual;
        let decision = "";

        if (fxr === 0) {
            decision = "exacta";
        } else if (producto < 0) {
            nuevoB = xr;
            decision = "izquierda";
        } else {
            nuevoA = xr;
            decision = "derecha";
        }

        iteraciones.push({
            i,
            a: aActual,
            b: bActual,
            xr,
            xrAnterior,
            fa,
            fb,
            fxr,
            producto,
            errorRelativo,
            nuevoA,
            nuevoB,
            decision
        });

        if (fxr === 0 || (errorRelativo !== null && errorRelativo <= tol)) {
            convergio = true;
            break;
        }

        a = nuevoA;
        b = nuevoB;
        xrAnterior = xr;
    }

    if (errorDiscontinuidad) {
        return {
            tipo: "discontinuidad",
            aInicial,
            bInicial,
            faInicial,
            fbInicial,
            iteraciones,
            ultimaIter: iteraciones.length > 0 ? iteraciones[iteraciones.length - 1] : null,
            convergio: false,
            posibleAsintota: false,
            raizExactaExtremo: null,
            estadoTexto: "Interrumpido por discontinuidad",
            mensajeError: errorDiscontinuidad
        };
    }

    // 5. Verificar posible asíntota vertical / falsa convergencia
    const ultimaIter = iteraciones[iteraciones.length - 1];
    const escalaInicial = Math.max(Math.abs(faInicial), Math.abs(fbInicial), 1);
    const posibleAsintota =
        Math.abs(ultimaIter.fxr) > 1e-1 &&
        Math.abs(ultimaIter.fxr) > escalaInicial * 2;

    let estadoTexto;
    if (posibleAsintota) {
        estadoTexto = "Posible asíntota o discontinuidad";
    } else if (convergio) {
        estadoTexto = "Convergencia alcanzada";
    } else {
        estadoTexto = "Máximo de iteraciones alcanzado";
    }

    return {
        tipo: "completado",
        aInicial,
        bInicial,
        faInicial,
        fbInicial,
        iteraciones,
        ultimaIter,
        convergio,
        posibleAsintota,
        raizExactaExtremo: null,
        estadoTexto,
        mensajeError: null
    };
}
