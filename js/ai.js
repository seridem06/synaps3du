/* OpenRouter: streaming, respuestas JSON, prompts, fotos y OCR. */
const MistyAI = (() => {
  "use strict";
  const URL_API = "https://openrouter.ai/api/v1/chat/completions";

  function cabeceras(key) {
    const origen = (location.origin && location.origin !== "null") ? location.origin : "http://localhost";
    return {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + key,
      "HTTP-Referer": origen,
      "X-Title": "Misty"
    };
  }

  async function errorDe(res, prov) {
    let detalle = "";
    try { const j = await res.json(); detalle = (j.error && (j.error.message || j.error.code)) || ""; } catch (e) { /* sin cuerpo */ }
    const gem = prov === "gemini";
    const msgs = gem ? {
      400: /api key|key not valid|api_key/i.test(detalle) ? "La clave de Gemini no es válida. Revísala en Configuración." : null,
      401: "Gemini no aceptó la clave. Revisa que esté completa y sin espacios.",
      403: "Gemini rechazó la clave (permisos, región o proyecto sin acceso).",
      404: "Ese modelo de Gemini no existe o no está disponible. Prueba con gemini-2.5-flash en Configuración.",
      429: "Se acabó el cupo gratuito de Gemini por ahora (límite por minuto o por día). Espera un poco o cambia de modelo.",
      500: "Gemini tuvo un problema. Intenta otra vez.",
      503: "Gemini está saturado ahora. Intenta otra vez en unos segundos."
    } : {
      401: "La clave de OpenRouter no es válida. Revísala en Configuración.",
      402: "Tu cuenta de OpenRouter no tiene crédito para ese modelo. Prueba con un modelo gratuito (termina en :free).",
      404: "Ese modelo no está disponible ahora. Cambia el modelo en Configuración (lista en openrouter.ai/models).",
      408: "El modelo tardó demasiado. Intenta otra vez.",
      429: "Hay muchas solicitudes seguidas (los modelos gratuitos tienen límite). Espera unos segundos e intenta de nuevo.",
      502: "El modelo no respondió bien. Intenta otra vez o cambia de modelo.",
      503: "El modelo está saturado ahora. Intenta otra vez o cambia de modelo."
    };
    const conocido = msgs[res.status];
    const e = new Error(conocido || ("No pude hablar con la IA (error " + res.status + ")." + (detalle ? " " + String(detalle).slice(0, 160) : "")));
    e.status = res.status;
    e.detalle = detalle;
    return e;
  }

  // Algunos modelos (p. ej. Gemma) no aceptan rol "system": se fusiona con el primer mensaje del usuario.
  function ajustar(model, messages) {
    if (!/gemma/i.test(model)) return messages;
    const sys = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const resto = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content }));
    if (!sys) return resto;
    const i = resto.findIndex((m) => m.role === "user");
    if (i < 0) return [{ role: "user", content: sys }];
    const c = resto[i].content;
    if (Array.isArray(c)) {
      const k = c.findIndex((p) => p.type === "text");
      if (k >= 0) c[k] = { type: "text", text: sys + "\n\n" + c[k].text };
      else c.unshift({ type: "text", text: sys });
    } else {
      resto[i] = { role: "user", content: sys + "\n\n" + c };
    }
    return resto;
  }

  async function stream(o) {
    if (o.proveedor === "gemini") return streamGemini(o);
    const body = { model: o.model, messages: ajustar(o.model, o.messages), stream: true,
      temperature: o.temperature == null ? 0.6 : o.temperature, max_tokens: o.maxTokens || 700 };
    let res;
    try {
      res = await fetch(URL_API, { method: "POST", headers: cabeceras(o.key), body: JSON.stringify(body), signal: o.signal });
    } catch (e) {
      if (e.name === "AbortError") throw e;
      throw new Error("No hay conexión con OpenRouter. Revisa tu internet.");
    }
    if (!res.ok) throw await errorDe(res);

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", full = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const linea = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!linea || linea.startsWith(":") || !linea.startsWith("data:")) continue;
        const data = linea.slice(5).trim();
        if (data === "[DONE]") return full;
        let j;
        try { j = JSON.parse(data); } catch (e) { continue; }
        if (j.error) throw new Error(j.error.message || "Error del modelo");
        const d = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
        if (d) { full += d; if (o.onToken) o.onToken(d); }
      }
    }
    return full;
  }

  // Respuesta completa (sin streaming), para JSON.
  async function complete(o) {
    if (o.proveedor === "gemini") return completeGemini(o);
    const body = { model: o.model, messages: ajustar(o.model, o.messages),
      temperature: o.temperature == null ? 0.4 : o.temperature, max_tokens: o.maxTokens || 1800 };
    let res;
    try {
      res = await fetch(URL_API, { method: "POST", headers: cabeceras(o.key), body: JSON.stringify(body), signal: o.signal });
    } catch (e) {
      if (e.name === "AbortError") throw e;
      throw new Error("No hay conexión con OpenRouter. Revisa tu internet.");
    }
    if (!res.ok) throw await errorDe(res);
    const j = await res.json();
    if (j.error) throw new Error(j.error.message || "Error del modelo");
    const txt = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    if (!txt) throw new Error("La IA respondió vacío.");
    return txt;
  }

  /* ---------------- Gemini (API nativa) ----------------
   * Las claves nuevas "AQ." funcionan con este endpoint y la cabecera x-goog-api-key;
   * el endpoint compatible con OpenAI puede rechazarlas. */
  const URL_GEM = "https://generativelanguage.googleapis.com/v1beta/models/";

  function dataUrlAInline(url) {
    const m = /^data:([^;,]+);base64,(.+)$/.exec(url || "");
    if (!m) throw new Error("La imagen no tiene un formato válido.");
    return { inlineData: { mimeType: m[1], data: m[2] } };
  }
  function partesGemini(c) {
    if (typeof c === "string") return [{ text: c }];
    return c.map((p) => (p.type === "image_url" ? dataUrlAInline(p.image_url.url) : { text: p.text || "" }));
  }
  function cuerpoGemini(messages, temperature, maxTokens) {
    const sys = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const contents = [];
    for (const m of messages) {
      if (m.role === "system") continue;
      const rol = m.role === "assistant" ? "model" : "user";
      if (!contents.length && rol === "model") continue;           // Gemini exige empezar con el usuario
      const partes = partesGemini(m.content);
      const ult = contents[contents.length - 1];
      if (ult && ult.role === rol) ult.parts.push(...partes); else contents.push({ role: rol, parts: partes });
    }
    const body = { contents, generationConfig: { temperature, maxOutputTokens: maxTokens } };
    if (sys) body.systemInstruction = { parts: [{ text: sys }] };
    return body;
  }
  const nombreGemini = (m) => encodeURIComponent(String(m || "").trim().replace(/^models\//, ""));
  const cabecerasGemini = (key) => ({ "Content-Type": "application/json", "x-goog-api-key": key });
  function textoGemini(j) {
    const c = j.candidates && j.candidates[0];
    const ps = (c && c.content && c.content.parts) || [];
    return ps.filter((p) => !p.thought).map((p) => p.text || "").join("");
  }
  function bloqueoGemini(j) {
    const r = j.promptFeedback && j.promptFeedback.blockReason;
    return r ? new Error("Gemini no quiso responder a eso (" + r + "). Prueba con otra pregunta.") : null;
  }
  async function fetchGemini(url, o, body) {
    try {
      return await fetch(url, { method: "POST", headers: cabecerasGemini(o.key), body: JSON.stringify(body), signal: o.signal });
    } catch (e) {
      if (e.name === "AbortError") throw e;
      throw new Error("No pude conectar con Gemini. Revisa tu internet (o que el navegador no esté bloqueando la conexión).");
    }
  }
  async function streamGemini(o) {
    const url = URL_GEM + nombreGemini(o.model) + ":streamGenerateContent?alt=sse";
    // margen amplio: los modelos con "razonamiento" gastan parte del límite pensando
    const body = cuerpoGemini(o.messages, o.temperature == null ? 0.6 : o.temperature, Math.max(o.maxTokens || 700, 2048));
    const res = await fetchGemini(url, o, body);
    if (!res.ok) throw await errorDe(res, "gemini");
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", full = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const linea = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!linea.startsWith("data:")) continue;
        let j;
        try { j = JSON.parse(linea.slice(5).trim()); } catch (e) { continue; }
        if (j.error) throw new Error(j.error.message || "Error de Gemini");
        const bl = bloqueoGemini(j);
        if (bl) throw bl;
        const t = textoGemini(j);
        if (t) { full += t; if (o.onToken) o.onToken(t); }
      }
    }
    return full;
  }
  async function completeGemini(o) {
    const url = URL_GEM + nombreGemini(o.model) + ":generateContent";
    const body = cuerpoGemini(o.messages, o.temperature == null ? 0.4 : o.temperature, Math.max(o.maxTokens || 1800, 4096));
    const res = await fetchGemini(url, o, body);
    if (!res.ok) throw await errorDe(res, "gemini");
    const j = await res.json();
    if (j.error) throw new Error(j.error.message || "Error de Gemini");
    const bl = bloqueoGemini(j);
    if (bl) throw bl;
    const txt = textoGemini(j);
    if (!txt) throw new Error("Gemini respondió vacío.");
    return txt;
  }

  function extractJSON(texto) {
    let t = String(texto).replace(/```(?:json)?/gi, "").trim();
    const a = t.indexOf("{"), b = t.lastIndexOf("}");
    if (a < 0 || b <= a) throw new Error("La IA no devolvió JSON.");
    t = t.slice(a, b + 1);
    try { return JSON.parse(t); }
    catch (e) {
      // limpieza común: comas finales
      return JSON.parse(t.replace(/,\s*([}\]])/g, "$1"));
    }
  }

  /* ---------------- prompts ---------------- */
  function ctxPerfil(p) {
    return `El estudiante se llama ${p.nombre}, estudia en ${p.institucion} y cursa ${p.grado} de primaria en Perú.`;
  }
  function sistemaBase(p) {
    return `Eres Misty, una gata simpática y paciente que acompaña a estudiantes de primaria en Perú que pasarán a secundaria. ${ctxPerfil(p)} ` +
      `Hablas en español peruano, con frases cortas y claras, adecuadas para ${p.grado}. Llámalo por su nombre de vez en cuando, sin exagerar. ` +
      `Tu respuesta se lee en voz alta: no uses markdown, asteriscos, listas con símbolos, tablas ni emojis. ` +
      `Trabajas sobre el Currículo Nacional de la Educación Básica del Perú.`;
  }

  function mensajesTutor(p, historial, contenidoUsuario) {
    const sys = sistemaBase(p) + ` Estás en modo tutor. Reglas: ` +
      `1) No entregues la solución completa de entrada: da primero una pista o haz una pregunta que ayude a pensar. ` +
      `2) Si el estudiante ya lo intentó y sigue atascado, o pide la respuesta, explícala paso a paso. ` +
      `3) Si recibes una foto o un texto leído de un cuaderno, di en una frase qué ejercicio ves antes de ayudar. ` +
      `4) Máximo cuatro oraciones por respuesta, salvo que pida más detalle. ` +
      `5) Si lo que pregunta no es escolar, responde amable y breve y vuelve al estudio.`;
    return [{ role: "system", content: sys }, ...historial, { role: "user", content: contenidoUsuario }];
  }

  const ESQUEMA_NODO = `{"titulo":"2-5 palabras","leccion":"2 a 4 oraciones simples que enseñan una idea","pregunta":"una pregunta sobre esa lección","opciones":["...","...","..."],"correcta":0,"explicacion":"por qué la respuesta correcta es correcta, en 1-2 oraciones"}`;

  function mensajesRuta(p, o) {
    const area = o.area ? `Área: ${o.area}. ` : "";
    const comp = o.competencia ? `Competencia: ${o.competencia}. ` : "";
    const fallo = o.desdeFallo
      ? `El diagnóstico mostró que el estudiante empieza a fallar en este punto: "${o.tema}". Arma la ruta desde ahí, sin repasar toda la materia. `
      : "";
    const sys = sistemaBase(p) + ` Eres generador de rutas de aprendizaje. Responde SOLO con JSON válido, sin texto extra ni bloques de código.`;
    const user =
      `Crea una ruta corta de aprendizaje, estilo Duolingo, sobre: "${o.tema}". ${area}${comp}${fallo}\n` +
      `Reglas:\n- Entre 5 y 7 nodos, de lo más básico a lo más avanzado, para ${p.grado} de primaria.\n` +
      `- Cada nodo es una mini lección con UNA pregunta de opción múltiple (3 o 4 opciones, solo una correcta).\n` +
      `- "correcta" es el índice (empezando en 0) de la opción correcta.\n` +
      `- Sin markdown ni emojis.\n- Elige el área y una competencia EXACTAMENTE de esta lista:\n${MistyCurr.textoCompetencias()}\n\n` +
      `Formato exacto:\n{"tema":"...","area":"...","competencia":"...","nodos":[${ESQUEMA_NODO}]}`;
    return [{ role: "system", content: sys }, { role: "user", content: user }];
  }

  function mensajesDiagnostico(p, area) {
    const sys = sistemaBase(p) + ` Eres generador de diagnósticos. Responde SOLO con JSON válido, sin texto extra ni bloques de código.`;
    const comps = MistyCurr.AREAS[area].competencias;
    const user =
      `Crea un diagnóstico de ${area} para ${p.grado} de primaria con entre 6 y 10 preguntas de opción múltiple, ordenadas de lo más básico a lo más avanzado, ` +
      `cubriendo distintas competencias del área. Cada pregunta tiene 3 o 4 opciones y solo una correcta ("correcta" = índice desde 0).\n` +
      `Competencias del área (usa estos nombres exactos en "competencia"):\n${comps.map((c) => "- " + c).join("\n")}\n` +
      (comps.some((c) => (MistyCurr.DESEMPENOS[c] || []).length) ? `Desempeños oficiales:\n${comps.map((c) => "- " + c + ": " + (MistyCurr.DESEMPENOS[c] || []).join(" | ")).join("\n")}\n` : "") +
      `Formato exacto:\n{"preguntas":[{"competencia":"...","subtema":"2-5 palabras","pregunta":"...","opciones":["...","...","..."],"correcta":0,"explicacion":"..."}]}`;
    return [{ role: "system", content: sys }, { role: "user", content: user }];
  }

  function mensajesClasificar(textoEstudiante, respuestaMisty) {
    return [
      { role: "system", content: "Clasificas qué trabajó un estudiante de primaria de Perú. Responde SOLO con JSON válido, sin texto extra." },
      { role: "user", content:
        `Mensaje del estudiante:\n"""${String(textoEstudiante).slice(0, 500)}"""\n\nRespuesta que recibió:\n"""${String(respuestaMisty).slice(0, 500)}"""\n\n` +
        `Elige el área y UNA competencia EXACTAMENTE de esta lista:\n${MistyCurr.textoCompetencias()}\n\n` +
        `Formato exacto: {"area":"Matemática","competencia":"Resuelve problemas de cantidad"}` }
    ];
  }

  /* ---------------- fotos ---------------- */
  async function fileToDataURL(file, maxSide) {
    maxSide = maxSide || 1024;
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => rej(new Error("No pude abrir esa imagen."));
        i.src = url;
      });
      const k = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * k));
      c.height = Math.max(1, Math.round(img.height * k));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", 0.85);
    } finally { URL.revokeObjectURL(url); }
  }

  let tessPromise = null;
  function cargarTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (!tessPromise) {
      tessPromise = new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
        s.onload = () => res(window.Tesseract);
        s.onerror = () => { tessPromise = null; rej(new Error("No pude cargar el lector de texto (OCR). Revisa tu internet.")); };
        document.head.appendChild(s);
      });
    }
    return tessPromise;
  }
  async function ocr(dataUrl) {
    const T = await cargarTesseract();
    const r = await T.recognize(dataUrl, "spa");
    return (r && r.data && r.data.text || "").trim();
  }

  return { stream, complete, extractJSON, mensajesTutor, mensajesRuta, mensajesDiagnostico, mensajesClasificar, fileToDataURL, ocr };
})();
