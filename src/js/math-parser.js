/**
 * ============================================================================
 * math-parser.js — Motor de análisis sintáctico y compilación matemática
 * ----------------------------------------------------------------------------
 * Responsabilidades:
 *  - Convertir expresiones LaTeX provenientes de MathLive a sintaxis Math.js.
 *  - Normalizar símbolos Unicode, alias en español y multiplicación implícita.
 *  - Parsear y validar constantes/parámetros opcionales (g, m, t, v, etc.).
 *  - Compilar f(x) con protección contra resultados no reales o infinitos.
 *  - Proveer utilidades compartidas de formato numérico, escape HTML y KaTeX.
 * ============================================================================
 */

const FUNCIONES_CONOCIDAS = new Set([
    "sin", "cos", "tan", "csc", "sec", "cot",
    "asin", "acos", "atan", "sinh", "cosh", "tanh",
    "exp", "log", "log10", "log2", "sqrt", "cbrt", "nthRoot",
    "abs", "sign", "floor", "ceil", "round", "max", "min", "pow", "mod"
]);

const CONSTANTES_INTEGRADAS = new Set([
    "x", "e", "pi", "PI", "E", "tau", "phi", "Infinity", "NaN", "i"
]);

/**
 * Extrae el contenido balanceado entre delimitadores (p. ej. `{...}` o `[...]`).
 * @param {string} str - Cadena completa de entrada.
 * @param {number} startIndex - Posición del delimitador de apertura.
 * @param {string} openChar - Carácter de apertura.
 * @param {string} closeChar - Carácter de cierre.
 * @returns {{ content: string, endIndex: number } | null}
 */
function extraerBloque(str, startIndex, openChar, closeChar) {
    if (str[startIndex] !== openChar) return null;

    let depth = 0;
    for (let i = startIndex; i < str.length; i++) {
        if (str[i] === openChar) depth++;
        else if (str[i] === closeChar) {
            depth--;
            if (depth === 0) {
                return {
                    content: str.slice(startIndex + 1, i),
                    endIndex: i + 1
                };
            }
        }
    }
    return null;
}

/**
 * Transforma fracciones LaTeX `\frac{num}{den}` (incluso anidadas) a `((num)/(den))`.
 * @param {string} str
 * @returns {string}
 */
function reemplazarFracciones(str) {
    let result = str;
    let safety = 0;

    while (safety < 100) {
        const idx = result.indexOf("\\frac");
        if (idx === -1) break;
        safety++;

        let cursor = idx + 5;
        while (cursor < result.length && result[cursor] === " ") cursor++;

        const num = extraerBloque(result, cursor, "{", "}");
        if (!num) break;

        cursor = num.endIndex;
        while (cursor < result.length && result[cursor] === " ") cursor++;

        const den = extraerBloque(result, cursor, "{", "}");
        if (!den) break;

        const replacement = `((${num.content})/(${den.content}))`;
        result = result.slice(0, idx) + replacement + result.slice(den.endIndex);
    }

    return result;
}

/**
 * Transforma raíces LaTeX `\sqrt{x}` y `\sqrt[n]{x}` a `sqrt(x)` o `nthRoot(x, n)`.
 * @param {string} str
 * @returns {string}
 */
function reemplazarRaices(str) {
    let result = str;
    let safety = 0;

    while (safety < 100) {
        const idx = result.indexOf("\\sqrt");
        if (idx === -1) break;
        safety++;

        let cursor = idx + 5;
        while (cursor < result.length && result[cursor] === " ") cursor++;

        let grado = null;
        if (result[cursor] === "[") {
            const opt = extraerBloque(result, cursor, "[", "]");
            if (opt) {
                grado = opt.content;
                cursor = opt.endIndex;
                while (cursor < result.length && result[cursor] === " ") cursor++;
            }
        }

        const radicando = extraerBloque(result, cursor, "{", "}");
        if (!radicando) break;

        const replacement = grado
            ? `nthRoot((${radicando.content}), (${grado}))`
            : `sqrt(${radicando.content})`;

        result = result.slice(0, idx) + replacement + result.slice(radicando.endIndex);
    }

    return result;
}

/**
 * Convierte exponentes agrupados con llaves `^{...}` en `^(...)`.
 * @param {string} str
 * @returns {string}
 */
function reemplazarExponentesConLlaves(str) {
    let result = str;
    let safety = 0;

    while (safety < 150) {
        const idx = result.indexOf("^{");
        if (idx === -1) break;
        safety++;

        const exp = extraerBloque(result, idx + 1, "{", "}");
        if (!exp) break;

        const replacement = `^(${exp.content})`;
        result = result.slice(0, idx) + replacement + result.slice(exp.endIndex);
    }

    return result;
}

/**
 * Convierte una cadena LaTeX generada por MathLive en una expresión válida para Math.js.
 * @param {string} latex
 * @returns {string} Expresión normalizada lista para `math.parse`.
 */
function latexAMathJS(latex) {
    if (!latex || !latex.trim()) return "";

    let s = latex.trim();

    if (/\\placeholder\{[^}]*\}/.test(s)) {
        throw new Error("Hay recuadros vacíos sin completar en la fórmula visual.");
    }

    s = s
        .replace(/\\displaystyle/g, "")
        .replace(/\\left\|/g, "abs(")
        .replace(/\\right\|/g, ")")
        .replace(/\\left\s*/g, "")
        .replace(/\\right\s*/g, "")
        .replace(/\\,|\\;|\\:|\\!|\\quad|\\qquad|\\ /g, " ")
        .replace(/\\operatorname\{([^}]+)\}/g, "$1")
        .replace(/\\mathrm\{([^}]+)\}/g, "$1")
        .replace(/\\text\{([^}]+)\}/g, "$1")
        .replace(/\\exponentialE/g, "e")
        .replace(/\\imaginaryI/g, "i")
        .replace(/\\pi\b/g, "pi")
        .replace(/\\cdot|\\times/g, "*")
        .replace(/\\div/g, "/");

    s = reemplazarFracciones(s);
    s = reemplazarRaices(s);
    s = reemplazarExponentesConLlaves(s);

    s = s.replace(/\\log_\{?10\}?/g, "log10");
    s = s.replace(/\\log_\{?2\}?/g, "log2");

    // Potencias en funciones trigonométricas: \sin^(2)(x) -> (sin(x))^(2)
    s = s.replace(
        /\\(sin|cos|tan|csc|sec|cot|sinh|cosh|tanh)\^(\([^()]+\)|[0-9]+)\s*(\([^()]+\))/g,
        "($1$3)^$2"
    );

    const mapaFunciones = {
        "\\arcsin": "asin",
        "\\arccos": "acos",
        "\\arctan": "atan",
        "\\sinh": "sinh",
        "\\cosh": "cosh",
        "\\tanh": "tanh",
        "\\sin": "sin",
        "\\cos": "cos",
        "\\tan": "tan",
        "\\csc": "csc",
        "\\sec": "sec",
        "\\cot": "cot",
        "\\exp": "exp",
        "\\ln": "log",
        "\\log": "log10",
        "\\abs": "abs"
    };

    for (const [cmd, fn] of Object.entries(mapaFunciones)) {
        const regex = new RegExp(cmd.replace("\\", "\\\\") + "(?![a-zA-Z])", "g");
        s = s.replace(regex, fn);
    }

    s = s.replace(/\{/g, "(").replace(/\}/g, ")");

    // Envolver argumentos simples sin paréntesis: sin x -> sin(x)
    s = s.replace(
        /\b(sin|cos|tan|csc|sec|cot|asin|acos|atan|sinh|cosh|tanh|exp|log|log10|log2|sqrt)\s+(?!\()([a-zA-Z_][a-zA-Z0-9_]*|\d+(?:\.\d+)?)/g,
        "$1($2)"
    );

    return normalizarExpresion(s);
}

/**
 * Detecta patrones ambiguos de precedencia en exponentes escritos en modo texto plano.
 * @param {string} rawExpr
 * @returns {string | null}
 */
function detectarAdvertenciaPrecedencia(rawExpr) {
    const patronExponenteAmbiguo = /\^\s*[+-]?\s*\([^()]+\)\s*\*?\s*[0-9a-zA-Z(]/;

    if (patronExponenteAmbiguo.test(rawExpr)) {
        return "Aviso de precedencia: en expresiones como e^-(a)*b, solo -(a) queda dentro del exponente. Si deseas que todo esté en el exponente, agrúpalo con paréntesis: e^(-(a)*b).";
    }

    return null;
}

/**
 * Normaliza símbolos Unicode, alias en español y multiplicaciones implícitas.
 * @param {string} expresion
 * @returns {string}
 */
function normalizarExpresion(expresion) {
    if (!expresion) return "";

    let s = expresion.trim();

    s = s
        .replace(/[−–—]/g, "-")
        .replace(/[×·•]/g, "*")
        .replace(/÷/g, "/")
        .replace(/π/g, "pi")
        .replace(/²/g, "^2")
        .replace(/³/g, "^3")
        .replace(/√\s*\(/g, "sqrt(");

    s = s
        .replace(/\bln\s*\(/gi, "log(")
        .replace(/\bsen\s*\(/gi, "sin(")
        .replace(/\barcsen\s*\(/gi, "asin(")
        .replace(/\barcsin\s*\(/gi, "asin(")
        .replace(/\barccos\s*\(/gi, "acos(")
        .replace(/\barctan\s*\(/gi, "atan(")
        .replace(/\btg\s*\(/gi, "tan(")
        .replace(/\bctg\s*\(/gi, "cot(");

    // Multiplicación implícita segura
    s = s.replace(/\)\s*\(/g, ")*(");
    s = s.replace(/\)\s*([0-9]|[a-zA-Z_])/g, ")*$1");
    s = s.replace(/(^|[^a-zA-Z0-9_.])(\d+(?:\.\d+)?)\s*\(/g, "$1$2*(");
    s = s.replace(
        /(^|[^a-zA-Z0-9_.])(\d+(?:\.\d+)?)\s*(?!(?:[eE][+-]?\d))([a-zA-Z_])/g,
        "$1$2*$3"
    );

    s = s.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g, (_, nombre) => {
        return FUNCIONES_CONOCIDAS.has(nombre) ? `${nombre}(` : `${nombre}*(`;
    });

    return s.replace(/\s+/g, " ").trim();
}

/**
 * Parsea la cadena de constantes opcionales (`g = 9.81, m = 68.1, ...`) en un objeto scope.
 * @param {string} texto
 * @returns {Record<string, number>}
 */
function parsearParametros(texto) {
    const scope = {};
    if (!texto || !texto.trim()) return scope;

    const entradas = texto
        .split(/[\n,;]+/)
        .map(item => item.trim())
        .filter(Boolean);

    for (const entrada of entradas) {
        const partes = entrada.split("=");
        if (partes.length !== 2) {
            throw new Error(
                `Formato inválido en constantes: "${entrada}". Usa el formato nombre = valor (ej. g = 9.81).`
            );
        }

        const nombre = partes[0].trim();
        const valorExpr = normalizarExpresion(partes[1].trim());

        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(nombre)) {
            throw new Error(`Nombre de constante inválido: "${nombre}".`);
        }
        if (nombre === "x") {
            throw new Error('No puedes usar "x" como constante porque es la variable independiente.');
        }
        if (FUNCIONES_CONOCIDAS.has(nombre)) {
            throw new Error(`"${nombre}" es el nombre de una función reservada.`);
        }

        let valor;
        try {
            valor = math.evaluate(valorExpr, scope);
        } catch (err) {
            throw new Error(`Error al evaluar la constante "${nombre}": ${err.message}`);
        }

        if (typeof valor !== "number" || !Number.isFinite(valor)) {
            throw new Error(`La constante "${nombre}" debe evaluarse a un número real finito.`);
        }

        scope[nombre] = valor;
    }

    return scope;
}

/**
 * Verifica que todos los símbolos del AST estén definidos como `x`, constantes integradas o parámetros.
 * @param {object} nodo - Nodo AST de Math.js.
 * @param {Record<string, number>} parametros
 */
function validarVariablesDefinidas(nodo, parametros) {
    const desconocidas = new Set();

    nodo.traverse((node, path, parent) => {
        if (node.isSymbolNode) {
            if (parent && parent.isFunctionNode && path === "fn") return;
            const nombre = node.name;
            if (
                !CONSTANTES_INTEGRADAS.has(nombre) &&
                !FUNCIONES_CONOCIDAS.has(nombre) &&
                !(nombre in parametros)
            ) {
                desconocidas.add(nombre);
            }
        }
    });

    if (desconocidas.size > 0) {
        const lista = Array.from(desconocidas).join(", ");
        throw new Error(
            `Variable(s) no definida(s): ${lista}. Agrégala(s) en "Parámetros opcionales" o usa "x" como variable.`
        );
    }
}

/**
 * Compila una expresión normalizada en una función evaluable `f(x)` con verificación de dominio real.
 * @param {string} expresionNormalizada
 * @param {Record<string, number>} parametros
 * @returns {(x: number) => number}
 */
function crearFuncion(expresionNormalizada, parametros = {}) {
    const nodo = math.parse(expresionNormalizada);
    validarVariablesDefinidas(nodo, parametros);

    const compilada = nodo.compile();

    return function (x) {
        const resultado = compilada.evaluate({ ...parametros, x });

        if (typeof resultado !== "number" || !Number.isFinite(resultado)) {
            throw new Error(`La función no produce un número real finito en x = ${x.toFixed(6)}.`);
        }

        return resultado;
    };
}

/**
 * Formatea un número usando notación fija o científica si su magnitud es extrema.
 * @param {number | null | undefined} val
 * @param {number} decimales
 * @returns {string}
 */
function formatearNumero(val, decimales) {
    if (val === null || val === undefined || !Number.isFinite(val)) return "---";
    if (Math.abs(val) >= 1e6 || (val !== 0 && Math.abs(val) < 1e-5)) {
        return val.toExponential(4);
    }
    return val.toFixed(decimales);
}

/**
 * Escapa caracteres especiales HTML para evitar inyección en mensajes de error.
 * @param {string} str
 * @returns {string}
 */
function escaparHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/**
 * Renderiza una expresión TeX en un elemento del DOM utilizando KaTeX (con respaldo texto plano).
 * @param {HTMLElement | null} el
 * @param {string} tex
 * @param {boolean} displayMode
 */
function renderKatexEnElemento(el, tex, displayMode = true) {
    if (!el) return;
    if (window.katex) {
        window.katex.render(tex, el, { displayMode, throwOnError: false });
    } else {
        el.textContent = tex;
    }
}
