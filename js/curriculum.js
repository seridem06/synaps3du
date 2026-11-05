/* Áreas y competencias (Currículo Nacional de la Educación Básica, nivel primaria).
 *
 * IMPORTANTE: los "desempeños" NO están cargados a propósito. Antes de la demo,
 * cópialos del programa curricular oficial del MINEDU (no de memoria) dentro de
 * DESEMPENOS, con este formato:
 *   "Resuelve problemas de cantidad": ["Desempeño 1 ...", "Desempeño 2 ..."]
 * Si hay desempeños cargados, Misty los usa para armar rutas y diagnósticos.
 */
const MistyCurr = (() => {
  const AREAS = {
    "Matemática": {
      color: "#e8743b", icono: "🔢",
      competencias: [
        "Resuelve problemas de cantidad",
        "Resuelve problemas de regularidad, equivalencia y cambio",
        "Resuelve problemas de forma, movimiento y localización",
        "Resuelve problemas de gestión de datos e incertidumbre"
      ]
    },
    "Comunicación": {
      color: "#3b8fe8", icono: "📖",
      competencias: [
        "Se comunica oralmente en su lengua materna",
        "Lee diversos tipos de textos escritos en su lengua materna",
        "Escribe diversos tipos de textos en su lengua materna"
      ]
    },
    "Ciencia y Tecnología": {
      color: "#2fa36b", icono: "🔬",
      competencias: [
        "Indaga mediante métodos científicos para construir sus conocimientos",
        "Explica el mundo físico basándose en conocimientos sobre los seres vivos, materia y energía, biodiversidad, Tierra y universo",
        "Diseña y construye soluciones tecnológicas para resolver problemas de su entorno"
      ]
    },
    "Personal Social": {
      color: "#b25fd1", icono: "🌎",
      competencias: [
        "Construye su identidad",
        "Convive y participa democráticamente en la búsqueda del bien común",
        "Construye interpretaciones históricas",
        "Gestiona responsablemente el espacio y el ambiente",
        "Gestiona responsablemente los recursos económicos"
      ]
    }
  };

  // Pegar aquí los desempeños oficiales (ver nota de arriba).
  const DESEMPENOS = {};

  const nombresAreas = Object.keys(AREAS);

  const norm = (s) => (s || "").toString().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

  const STOP = new Set(["resuelve", "problemas", "de", "y", "se", "en", "su", "sus", "lengua", "materna",
    "diversos", "tipos", "textos", "para", "el", "la", "los", "las", "un", "una", "sobre", "con", "del", "al", "e"]);

  function areaDe(texto) {
    const x = norm(texto);
    if (!x) return null;
    if (/matem/.test(x)) return "Matemática";
    if (/comunic|lectur|lengua|castell/.test(x)) return "Comunicación";
    if (/cienc|tecnol/.test(x)) return "Ciencia y Tecnología";
    if (/social|persona|histor|geograf|civic/.test(x)) return "Personal Social";
    return null;
  }

  // Devuelve {area, competencia|null} válidos, o null si no se puede ubicar.
  function normalizar(area, competencia) {
    let a = areaDe(area);
    const tokens = norm(competencia).split(" ").filter((t) => t && !STOP.has(t));
    let mejor = null, mejorPts = 0;
    const candidatas = a ? [a] : nombresAreas;
    for (const ar of candidatas) {
      for (const c of AREAS[ar].competencias) {
        const nc = norm(c);
        let pts = 0;
        for (const t of tokens) if (nc.includes(t)) pts++;
        if (norm(c) === norm(competencia)) pts += 10;
        if (pts > mejorPts) { mejorPts = pts; mejor = { area: ar, competencia: c }; }
      }
    }
    if (mejor && mejorPts > 0) return mejor;
    if (a) return { area: a, competencia: null };
    return null;
  }

  // Plan B si el modelo no pudo clasificar: palabras clave.
  function adivinar(texto) {
    const x = norm(texto);
    const mapa = [
      ["Matemática", /(suma|resta|multiplic|divid|fraccion|decimal|numero|problema|ecuacion|area|perimetro|angulo|triangulo|cuadrad|grafico|promedio|porcentaje|medida|calcul|cuanto|mitad|doble)/],
      ["Comunicación", /(lectura|leer|texto|cuento|oracion|parrafo|ortograf|tilde|acento|sustantivo|verbo|adjetivo|redact|escrib|resumen|idea principal|sinonimo|comprension)/],
      ["Ciencia y Tecnología", /(planeta|animal|planta|celula|energia|materia|agua|ecosistema|experimento|cuerpo humano|fotosintesis|electric|tecnolog|volcan|clima|sistema solar)/],
      ["Personal Social", /(historia|inca|peru|region|mapa|derecho|norma|convivencia|ciudadan|virreinato|republica|cultura|economia|ahorro|ambiente|identidad)/]
    ];
    for (const [ar, re] of mapa) if (re.test(x)) return normalizar(ar, texto) || { area: ar, competencia: null };
    return null;
  }

  function textoCompetencias() {
    return nombresAreas.map((ar) => {
      const lineas = AREAS[ar].competencias.map((c) => {
        const d = DESEMPENOS[c];
        return "  - " + c + (d && d.length ? "\n      Desempeños oficiales: " + d.join(" | ") : "");
      });
      return "• " + ar + ":\n" + lineas.join("\n");
    }).join("\n");
  }

  return { AREAS, DESEMPENOS, nombresAreas, norm, areaDe, normalizar, adivinar, textoCompetencias };
})();
