/* Misty · lógica principal (todo corre en el navegador). */
(() => {
  "use strict";

  /* ======================= utilidades ======================= */
  const LS_KEY = "misty.v1";
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const AREAS = MistyCurr.AREAS;
  const AREAS_N = MistyCurr.nombresAreas;
  const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
  const fechaLocal = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const hoy = () => fechaLocal(new Date());
  const ayer = () => { const d = new Date(); d.setDate(d.getDate() - 1); return fechaLocal(d); };
  // Puntos propuestos: ajústalos aquí después de las pruebas con estudiantes.
  const PUNTOS = { paso: 10, consulta: 3, racha: 5, porNivel: 100 };
  const mezclar = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  /* ======================= estado ======================= */
  const porDefecto = () => ({
    perfil: null,
    puntos: { total: 0, areas: {} },
    racha: { count: 0, last: null, max: 0 },
    actividad: {},
    hoy: { f: "", pasos: 0, consultas: 0, retoOk: false },
    logros: {},
    stats: { tutor: 0, pasos: 0, rutas: 0, fotos: 0, voz: 0, diag: 0, respTotal: 0, respOk: 0, modoGuia: false, modoTutor: false },
    rutas: [], rutaActiva: null,
    historial: [],
    accesorios: { equipped: { hat: false, glasses: false, scope: false } },
    config: {
      key: "",
      modelo: "meta-llama/llama-3.3-70b-instruct:free",
      modeloVision: "google/gemma-3-27b-it:free",
      voz: "", pitch: 1.4, rate: 1.0, mute: false, tam: 17, oscuro: false, ocr: false, gato3d: true,
      proveedor: "openrouter", keyGemini: "", modeloGemini: "gemini-3.8-flash", ahorrar: false
    },
    modo: "tutor"
  });
  let S = porDefecto();

  function cargar() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const d = JSON.parse(raw), b = porDefecto();
      S = Object.assign({}, b, d);
      S.config = Object.assign({}, b.config, d.config);
      S.config.key=""; S.config.keyGemini="";
      localStorage.setItem(LS_KEY, JSON.stringify(S));
      S.stats = Object.assign({}, b.stats, d.stats);
      S.puntos = Object.assign({}, b.puntos, d.puntos);
      S.racha = Object.assign({}, b.racha, d.racha);
      S.actividad = d.actividad || {};
      S.hoy = Object.assign({}, b.hoy, d.hoy);
      S.accesorios = Object.assign({}, b.accesorios, d.accesorios);
      S.accesorios.equipped = Object.assign({}, b.accesorios.equipped, (d.accesorios || {}).equipped);
    } catch (e) { console.warn("[Misty] no pude leer los datos guardados:", e); }
  }
  let avisoCuota = false;
  function guardar() {
    S.config.key = ""; S.config.keyGemini = "";
    if (S.historial.length > 80) S.historial = S.historial.slice(-80);
    try { localStorage.setItem(LS_KEY, JSON.stringify(S)); }
    catch (e) { if (!avisoCuota) { avisoCuota = true; toast("No pude guardar tu progreso (almacenamiento lleno).", "error"); } }
  }

  /* ======================= avisos ======================= */
  function toast(txt, tipo) {
    const t = el("div", "toast" + (tipo ? " " + tipo : ""), txt);
    $("toasts").append(t);
    setTimeout(() => t.remove(), tipo === "logro" ? 4200 : 3200);
  }

  /* ======================= gato y boca ======================= */
  let vista = "inicio";
  let gato = null, transmitiendo = false, bocaAbierta = false, animoTimer = null;

  function iniciarGato() {
    if (gato) gato.dispose();
    gato = MistyCat.crear($("stageCat"), { prefer3d: S.config.gato3d });
    gato.setAccessories(S.accesorios.equipped);
    gato.onTap = () => { gato.jump(); animo("happy", 1200); MistyVoice.hablar("¡Miau!"); };
  }
  function animo(m, ms) {
    if (!gato) return;
    gato.setMood(m);
    clearTimeout(animoTimer);
    if (ms) animoTimer = setTimeout(() => gato && gato.setMood("idle"), ms);
  }
  function vozDisponible() { return !S.config.mute && !!window.speechSynthesis; }
  function bucleBoca() {
    if (gato) {
      const activo = MistyVoice.hablando() || (transmitiendo && !vozDisponible());
      gato.setTalking(activo);
      if (activo) { bocaAbierta = !bocaAbierta; gato.setMouth(bocaAbierta ? 0.45 + Math.random() * 0.55 : 0.05); }
      else { bocaAbierta = false; gato.setMouth(0); }
    }
    setTimeout(bucleBoca, 120 + Math.random() * 60);   // 120–180 ms
  }
  const decir = (t) => MistyVoice.hablar(t);

  /* ======================= puntos, nivel, racha, logros ======================= */
  const nivel = () => Math.floor(S.puntos.total / PUNTOS.porNivel) + 1;
  const rachaEfectiva = () => (S.racha.last === hoy() || S.racha.last === ayer()) ? S.racha.count : 0;

  const ACC = [
    { id: "hat", n: "Chullo andino", nivel: 2, i: "🧶" },
    { id: "glasses", n: "Lentes", nivel: 3, i: "🕶️" },
    { id: "scope", n: "Telescopio", nivel: 4, i: "🔭" }
  ];

  const LOGROS = [
    { id: "hola", n: "¡Hola, Misty!", d: "Hiciste tu primera consulta o lección.", i: "👋", ok: () => S.stats.tutor + S.stats.pasos >= 1 },
    { id: "explorador", n: "Explorador", d: "Probaste los dos modos.", i: "🧭", ok: () => S.stats.modoGuia && S.stats.modoTutor },
    { id: "primerpaso", n: "Primer paso", d: "Completaste un paso de una ruta.", i: "👣", ok: () => S.stats.pasos >= 1 },
    { id: "ruta", n: "Ruta completa", d: "Terminaste una ruta entera.", i: "🏁", ok: () => S.stats.rutas >= 1 },
    { id: "pasos10", n: "Imparable", d: "10 pasos completados.", i: "🚀", ok: () => S.stats.pasos >= 10 },
    { id: "curioso", n: "Curioso", d: "10 consultas en modo Tutor.", i: "🔍", ok: () => S.stats.tutor >= 10 },
    { id: "diag", n: "Detective", d: "Terminaste un diagnóstico.", i: "🕵️", ok: () => S.stats.diag >= 1 },
    { id: "racha3", n: "Racha de 3", d: "Tres días seguidos con Misty.", i: "🔥", ok: () => S.racha.count >= 3 },
    { id: "racha7", n: "Racha de 7", d: "Una semana seguida.", i: "🌟", ok: () => S.racha.count >= 7 },
    { id: "nivel2", n: "Nivel 2", d: "Llegaste a 100 puntos.", i: "⭐", ok: () => nivel() >= 2 },
    { id: "nivel5", n: "Nivel 5", d: "Llegaste a 400 puntos.", i: "🏅", ok: () => nivel() >= 5 },
    { id: "foto", n: "Fotógrafo", d: "Enviaste una foto de tu cuaderno.", i: "📷", ok: () => S.stats.fotos >= 1 },
    { id: "voz", n: "Voz de oro", d: "Hablaste con Misty por el micrófono.", i: "🎤", ok: () => S.stats.voz >= 1 },
    { id: "todoterreno", n: "Todoterreno", d: "Sumaste puntos en las 4 áreas.", i: "🌈", ok: () => AREAS_N.every((a) => ((S.puntos.areas[a] || {}).total || 0) > 0) }
  ];

  function actualizarHUD() {
    $("hudNivel").textContent = "Nivel " + nivel();
    $("hudBarra").style.width = ((S.puntos.total % PUNTOS.porNivel) / PUNTOS.porNivel * 100) + "%";
    $("hudPts").textContent = S.puntos.total + " pts";
    $("hudRacha").textContent = "🔥 " + rachaEfectiva();
    if (S.perfil) { $("sbNombre").textContent = S.perfil.nombre; $("sbGrado").textContent = S.perfil.grado + " · " + (S.perfil.institucion || ""); }
    if (vista === "inicio") renderInicio();
  }
  function flotante(n, etq) {
    const d = el("div", "float-pts", "+" + n + " pts");
    if (etq) d.append(el("small", "", etq));
    $("floatLayer").append(d);
    setTimeout(() => d.remove(), 1900);
  }
  function sumarPuntos(n, area, comp) {
    const antes = nivel();
    S.puntos.total += n;
    if (area) {
      const a = S.puntos.areas[area] || (S.puntos.areas[area] = { total: 0, comps: {} });
      a.total += n;
      if (comp) a.comps[comp] = (a.comps[comp] || 0) + n;
    }
    guardar();
    actualizarHUD();
    flotante(n, comp ? comp.replace(/^Resuelve problemas de /, "") : area);
    if (nivel() > antes) subirNivel();
    revisarLogros();
  }
  function subirNivel() {
    const n = nivel();
    toast("¡Subiste al nivel " + n + "! 🎉", "logro");
    if (gato) gato.jump();
    animo("happy", 2000);
    ACC.filter((a) => a.nivel === n).forEach((a) => {
      toast("Desbloqueaste: " + a.n + " " + a.i + " (míralo en Accesorios)", "logro");
      addMsg("sys", "Nuevo accesorio desbloqueado: " + a.n + ". Pruébalo en Accesorios.", { noGuardar: true });
    });
  }
  function revisarLogros() {
    let nuevo = false;
    LOGROS.forEach((l) => {
      if (!S.logros[l.id] && l.ok()) {
        S.logros[l.id] = Date.now();
        nuevo = true;
        toast("Logro: " + l.i + " " + l.n, "logro");
      }
    });
    if (nuevo) { guardar(); animo("happy", 1800); }
  }
  function hoyStats() {
    if (S.hoy.f !== hoy()) S.hoy = { f: hoy(), pasos: 0, consultas: 0, retoOk: false };
    return S.hoy;
  }
  const retoDelDia = () => (new Date().getDate() % 2 === 0)
    ? { k: "pasos", meta: 2, t: "Completa 2 pasos de una ruta", vista: "guia" }
    : { k: "consultas", meta: 2, t: "Haz 2 consultas al Tutor", vista: "tutor" };
  function revisarReto() {
    const h = hoyStats(), r = retoDelDia();
    if (!h.retoOk && h[r.k] >= r.meta) {
      h.retoOk = true;
      guardar();
      toast("¡Reto del día cumplido! +20 pts 🎯", "logro");
      sumarPuntos(20, null, null);
    }
  }
  function registrarActividad() {
    const h = hoy();
    if (!S.actividad[h]) { S.actividad[h] = 1; guardar(); }
    if (S.racha.last === h) return;
    S.racha.count = S.racha.last === ayer() ? S.racha.count + 1 : 1;
    S.racha.max = Math.max(S.racha.max || 0, S.racha.count);
    S.racha.last = h;
    guardar();
    toast("🔥 Racha de " + S.racha.count + (S.racha.count === 1 ? " día" : " días"));
    sumarPuntos(PUNTOS.racha, null, null);   // puntos por cada día de racha
  }

  /* ======================= chat (UI) ======================= */
  const avatarEl = () => { const i = el("img", "avatar"); i.src = "assets/misty-avatar.png"; i.alt = ""; return i; };
  const scrollFin = () => { const l = $("chatLog"); l.scrollTop = l.scrollHeight; };

  function addMsg(rol, texto, o) {
    o = o || {};
    const row = el("div", "msg " + (o.error ? "misty error" : rol));
    if (rol === "misty") row.append(avatarEl());
    const b = el("div", "bubble");
    if (o.foto) { const im = el("img", "foto"); im.src = o.foto; im.alt = "Foto enviada"; b.append(im); }
    const tn = document.createTextNode(texto || "");
    b.append(tn);
    row.append(b);
    $("chatLog").append(row);
    scrollFin();
    if (!o.noGuardar && texto && (rol === "misty" || rol === "yo")) {
      S.historial.push({ rol, texto: o.foto ? "[foto] " + texto : texto, modo: o.modo || S.modo });
      guardar();
    }
    if (rol === "misty" && o.hablar !== false && !o.error && texto) decir(texto);
    return { row, bubble: b, add: (t) => { tn.nodeValue += t; }, set: (t) => { tn.nodeValue = t; } };
  }
  function addChips(items) {
    const row = el("div", "msg misty");
    row.append(avatarEl());
    const box = el("div", "chips");
    items.forEach((it) => {
      const b = el("button", "chip", it.label);
      b.type = "button";
      b.onclick = () => { row.remove(); it.fn(); };
      box.append(b);
    });
    row.append(box);
    $("chatLog").append(row);
    scrollFin();
  }
  function addCard(card) {
    const row = el("div", "msg misty");
    row.append(avatarEl(), card);
    $("chatLog").append(row);
    scrollFin();
    return row;
  }
  function typing(txt) {
    const row = el("div", "msg misty");
    row.append(avatarEl());
    const b = el("div", "bubble typing");
    b.innerHTML = "<span></span><span></span><span></span>";
    if (txt) b.append(el("small", "", txt));
    row.append(b);
    $("chatLog").append(row);
    scrollFin();
    return row;
  }
  const pEl = (t, cls) => el("p", cls, t);

  // Proveedor de IA activo (OpenRouter o Gemini) con su clave y modelos.
  const prov = () => S.config.proveedor === "gemini"
    ? { proveedor: "gemini", nombre: "Gemini", key: S.config.keyGemini, modelo: S.config.modeloGemini, vision: S.config.modeloGemini }
    : { proveedor: "openrouter", nombre: "OpenRouter", key: S.config.key, modelo: S.config.modelo, vision: S.config.modeloVision };

  function requiereClave() { return true; }

  let ocupado = false, abortCtl = null;
  function setEnviando(b) {
    ocupado = b;
    const bt = $("btnEnviar");
    bt.textContent = b ? "⏹" : "➤";
    bt.title = b ? "Detener" : "Enviar";
  }

  /* ======================= clasificación + puntos ======================= */
  async function clasificarYSumar(textoEst, respuesta, pts) {
    let c = null;
    const P = prov();
    if (!S.config.ahorrar) try {
      const txt = await MistyAI.complete({ proveedor: P.proveedor, key: P.key, model: P.modelo, maxTokens: 150, temperature: 0,
        messages: MistyAI.mensajesClasificar(textoEst || "(foto de un ejercicio)", respuesta) });
      const j = MistyAI.extractJSON(txt);
      c = MistyCurr.normalizar(j.area, j.competencia);
    } catch (e) { console.warn("[Misty] la clasificación falló:", e.message); }
    if (!c) c = MistyCurr.adivinar((textoEst || "") + " " + respuesta);
    sumarPuntos(pts, c && c.area, c && c.competencia);
  }

  /* ======================= MODO TUTOR ======================= */
  function contextoTutor() {
    return S.historial.filter((m) => m.modo === "tutor").slice(-12)
      .map((m) => ({ role: m.rol === "misty" ? "assistant" : "user", content: m.texto }));
  }

  async function enviarTutor(texto, imagen) {
    if (!requiereClave()) return;
    setEnviando(true);
    registrarActividad();
    const previo = contextoTutor();
    const P = prov();
    addMsg("yo", texto || "Mira mi cuaderno, por favor.", { foto: imagen, modo: "tutor" });
    if (imagen) { S.stats.fotos++; guardar(); revisarLogros(); }
    const espera = typing();
    animo("think");
    let burbuja = null, respuesta = "";

    const correr = async (contenido, modelo) => {
      respuesta = "";
      abortCtl = new AbortController();
      await MistyAI.stream({
        proveedor: P.proveedor, key: P.key, model: modelo, signal: abortCtl.signal,
        messages: MistyAI.mensajesTutor(S.perfil, previo, contenido),
        onToken: (tok) => {
          if (!burbuja) { espera.remove(); burbuja = addMsg("misty", "", { hablar: false, noGuardar: true }); animo("idle"); }
          transmitiendo = true;
          burbuja.add(tok);
          respuesta += tok;
          MistyVoice.alimentar(tok);
          scrollFin();
        }
      });
    };

    try {
      const pedido = texto || "Mira esta foto de mi cuaderno y ayúdame con el ejercicio.";
      const conOCR = async () => {
        const t = await MistyAI.ocr(imagen);
        if (!t) throw new Error("No pude leer texto en la foto. Intenta con una foto más clara y de cerca.");
        return pedido + "\n\nTexto leído de mi cuaderno:\n" + t;
      };
      if (!imagen) {
        await correr(pedido, P.modelo);
      } else if (S.config.ocr) {
        await correr(await conOCR(), P.modelo);
      } else {
        try {
          await correr([{ type: "text", text: pedido }, { type: "image_url", image_url: { url: imagen } }], P.vision);
        } catch (e) {
          if (e.name === "AbortError" || burbuja) throw e;
          toast("No pude leer la foto con visión. Pruebo con el lector de texto (OCR)…");
          await correr(await conOCR(), P.modelo);
        }
      }
      MistyVoice.terminar();
      if (!respuesta.trim()) throw new Error("La IA respondió vacío. Prueba con otro modelo en Configuración.");
      S.historial.push({ rol: "misty", texto: respuesta.trim(), modo: "tutor" });
      S.stats.tutor++;
      hoyStats().consultas++;
      guardar();
      revisarReto();
      animo("happy", 1500);
      clasificarYSumar(texto, respuesta, PUNTOS.consulta);   // segunda llamada corta: ¿qué se trabajó?
    } catch (e) {
      espera.remove();
      if (e.name === "AbortError") {
        MistyVoice.parar();
        if (respuesta.trim()) { S.historial.push({ rol: "misty", texto: respuesta.trim(), modo: "tutor" }); guardar(); }
      } else {
        MistyVoice.parar();
        addMsg("misty", e.message || "Algo salió mal. Intenta otra vez.", { error: true, noGuardar: true });
        animo("sad", 2500);
      }
    } finally {
      espera.remove();
      transmitiendo = false;
      abortCtl = null;
      setEnviando(false);
    }
  }

  /* ======================= MODO GUÍA ======================= */
  const rutaActual = () => S.rutas.find((r) => r.id === S.rutaActiva) || null;

  function resolverCorrecta(c, ops) {
    if (typeof c === "number" && Number.isInteger(c) && c >= 0 && c < ops.length) return c;
    if (typeof c === "string") {
      const s = c.trim();
      if (/^\d+$/.test(s)) { const n = parseInt(s, 10); return n < ops.length ? n : -1; }
      if (/^[a-d]$/i.test(s)) { const n = s.toLowerCase().charCodeAt(0) - 97; return n < ops.length ? n : -1; }
      return ops.findIndex((o) => o.trim().toLowerCase() === s.toLowerCase());
    }
    return -1;
  }
  // Valida preguntas del modelo y mezcla las opciones (el modelo suele poner la correcta primero).
  function validarPreguntas(arr, max) {
    const out = [];
    for (const q of Array.isArray(arr) ? arr : []) {
      if (!q || typeof q.pregunta !== "string" || !Array.isArray(q.opciones)) continue;
      let ops = q.opciones.map((x) => String(x).trim()).filter(Boolean);
      const ok = resolverCorrecta(q.correcta, ops);
      if (ops.length < 2 || ok < 0 || ok > 3) continue;
      ops = ops.slice(0, 4);
      const m = mezclar(ops.map((t, i) => ({ t, ok: i === ok })));
      out.push({
        titulo: String(q.titulo || q.subtema || "Pregunta").slice(0, 60),
        subtema: String(q.subtema || q.titulo || "").slice(0, 60),
        competencia: q.competencia ? String(q.competencia) : "",
        leccion: String(q.leccion || ""),
        pregunta: q.pregunta,
        opciones: m.map((o) => o.t),
        correcta: m.findIndex((o) => o.ok),
        explicacion: String(q.explicacion || "")
      });
      if (out.length >= max) break;
    }
    return out;
  }

  function sinTema(t) {
    const x = MistyCurr.norm(t);
    if (!x) return true;
    if (x.split(" ").length > 9) return false;
    return /(no se|no entiendo|estoy mal|en que (estoy|fallo|me falta|voy mal)|donde (fallo|estoy mal)|lo que sea|cualquier|diagnostico|por donde empezar|^ayuda$)/.test(x) ||
      (x.split(" ").length <= 2 && !!MistyCurr.areaDe(x));
  }

  function chipsAreas() {
    addChips(AREAS_N.map((a) => ({
      label: AREAS[a].icono + " " + a,
      fn: () => { addMsg("yo", "Diagnóstico de " + a, { modo: "guia" }); iniciarDiagnostico(a); }
    })));
  }

  async function enviarGuia(texto) {
    if (!requiereClave()) return;
    addMsg("yo", texto, { modo: "guia" });
    if (sinTema(texto)) {
      const area = MistyCurr.areaDe(texto);
      if (area) return iniciarDiagnostico(area);
      addMsg("misty", "No pasa nada, " + S.perfil.nombre + ". Vamos a buscar juntos dónde se complica. ¿De qué área quieres que te haga unas preguntas?", { modo: "guia" });
      chipsAreas();
      return;
    }
    return crearRuta({ tema: texto });
  }

  function validarRuta(d, o) {
    const nodos = validarPreguntas(d && d.nodos, 7);
    if (nodos.length < 3) return null;
    const cl = MistyCurr.normalizar(d.area || o.area, d.competencia || o.competencia) ||
      MistyCurr.normalizar(o.area, o.competencia) || MistyCurr.adivinar(o.tema) || { area: null, competencia: null };
    nodos.forEach((n, i) => { n.estado = i === 0 ? "activo" : "bloqueado"; });
    return {
      id: Date.now().toString(36), tema: String(d.tema || o.tema).slice(0, 70),
      area: cl.area, competencia: cl.competencia, nodos, completada: false
    };
  }

  async function crearRuta(o) {
    if (o.area === "Comunicación" || /comunicaci[oó]n/i.test(o.tema || "")) return rutaComunicacion();
    if (ocupado) return;
    setEnviando(true);
    registrarActividad();
    const esp = typing("Armando tu ruta…");
    animo("think");
    try {
      let ruta = null, err = null;
      for (let i = 0; i < 2 && !ruta; i++) {
        try {
          const txt = await MistyAI.complete({ proveedor: prov().proveedor, key: prov().key, model: prov().modelo, maxTokens: 3000,
            messages: MistyAI.mensajesRuta(S.perfil, o) });
          ruta = validarRuta(MistyAI.extractJSON(txt), o);
          if (!ruta) err = new Error("La ruta salió incompleta.");
        } catch (e) { err = e; if (e.status) throw e; }
      }
      if (!ruta) throw new Error((err && err.message ? err.message + " " : "") + "Intenta de nuevo o prueba con otro modelo en Configuración.");
      S.rutas.push(ruta);
      if (S.rutas.length > 20) S.rutas.shift();
      S.rutaActiva = ruta.id;
      guardar();
      renderRuta();
      esp.remove();
      animo("happy", 1800);
      addMsg("misty", "¡Listo, " + S.perfil.nombre + "! Armé una ruta de " + ruta.nodos.length + " pasos sobre " + ruta.tema + ". Vamos con el primero.", { modo: "guia" });
      abrirNodo(0);
    } catch (e) {
      esp.remove();
      addMsg("misty", e.message || "No pude armar la ruta.", { error: true, noGuardar: true });
      animo("sad", 2500);
    } finally {
      esp.remove();
      setEnviando(false);
    }
  }

  /* ---- ruta en forma de camino (estilo Duolingo) ---- */
  const DX = [0, -38, -66, -38, 0, 38, 66, 38];
  const colorArea = (r) => (r && r.area && AREAS[r.area]) ? AREAS[r.area].color : "var(--primary)";

  function escenaVacia() {
    const d = el("div", "ruta-vacia");
    const im = el("img"); im.src = "assets/misty-avatar.png"; im.alt = "";
    d.append(im, el("div", "", "Dime qué quieres aprender y armo tu camino de pasos. Si no sabes por dónde empezar, haz un diagnóstico."));
    return d;
  }

  function pasoEl(r, n, i, k) {
    const fila = el("div", "fila-camino");
    const w = el("div", "nodo-w");
    const dx = DX[k % DX.length];
    w.style.setProperty("--dx", dx + "px");
    const b = el("button", "nodo " + n.estado, n.estado === "hecho" ? "✓" : n.estado === "bloqueado" ? "🔒" : "★");
    b.type = "button";
    b.title = n.titulo;
    b.disabled = n.estado === "bloqueado";
    b.onclick = () => abrirNodo(i);
    if (n.estado === "activo") {
      b.style.setProperty("--c", colorArea(r));
      const hechos = r.nodos.filter((x) => x.estado === "hecho").length;
      const ring = el("div", "anillo");
      ring.style.setProperty("--p", (hechos / r.nodos.length * 100) + "%");
      ring.append(b);
      w.append(el("span", "empezar", "EMPEZAR"), ring, el("div", "nodo-t", n.titulo));
      w.firstChild.style.setProperty("--c", colorArea(r));
    } else w.append(b);
    fila.append(w);
    return fila;
  }

  function decoEl(k, gris) {
    const dx = DX[k % DX.length];
    const d = el("div", "deco" + (gris ? " gris" : ""));
    const im = el("img"); im.src = "assets/misty-avatar.png"; im.alt = "";
    d.append(im);
    d.style.left = dx <= 0 ? "calc(50% + 70px)" : "auto";
    d.style.right = dx <= 0 ? "auto" : "calc(50% + 70px)";
    return d;
  }

  function cofreEl(r, tras, k) {
    const fila = el("div", "fila-camino");
    const w = el("div", "nodo-w");
    w.style.setProperty("--dx", DX[k % DX.length] + "px");
    const listo = r.nodos[tras].estado === "hecho";
    const b = el("button", "nodo cofre " + (r.cofre ? "abierto" : listo ? "listo" : "cerrado"), r.cofre ? "🎉" : listo ? "🎁" : "🔒");
    b.type = "button";
    b.title = r.cofre ? "Cofre abierto" : listo ? "¡Abre tu cofre!" : "Se abre al completar el paso " + (tras + 1);
    b.disabled = !listo || !!r.cofre;
    b.onclick = () => {
      r.cofre = true;
      guardar();
      renderRuta();
      if (gato) { gato.jump(); gato.wave(2200); }
      animo("happy", 1800);
      toast("¡Cofre abierto! +15 pts 🎁", "logro");
      sumarPuntos(15, r.area, r.competencia);
    };
    w.append(b);
    fila.append(w);
    return fila;
  }

  function trofeoEl(r, k) {
    const fila = el("div", "fila-camino");
    const w = el("div", "nodo-w");
    w.style.setProperty("--dx", DX[k % DX.length] + "px");
    const b = el("button", "nodo trofeo " + (r.completada ? "listo" : "cerrado"), r.completada ? "🏆" : "🔒");
    b.type = "button";
    b.disabled = !r.completada;
    b.title = r.completada ? "¡Ruta completada!" : "Completa todos los pasos";
    b.onclick = () => { if (gato) { gato.jump(); gato.wave(2500); } animo("happy", 2000); toast("¡Ruta completada! 🏆", "logro"); };
    w.append(b);
    fila.append(w);
    return fila;
  }

  function renderRuta() {
    const panel = $("rutaPanel");
    const mostrar = S.modo === "guia";
    panel.classList.toggle("hidden", !mostrar);
    if (!mostrar) return;
    const sel = $("rutaSel");
    sel.replaceChildren();
    if (!S.rutas.length) { sel.append(el("option", "", "Sin rutas todavía")); sel.disabled = true; }
    else {
      sel.disabled = false;
      S.rutas.forEach((r) => {
        const op = el("option", "", r.tema + (r.completada ? " ✓" : ""));
        op.value = r.id;
        if (r.id === S.rutaActiva) op.selected = true;
        sel.append(op);
      });
    }
    const r = rutaActual();
    const nodos = $("rutaNodos");
    nodos.replaceChildren();
    const badge = $("rutaArea");
    if (!r) {
      badge.classList.add("hidden");
      nodos.append(escenaVacia());
      return;
    }
    badge.classList.toggle("hidden", !r.area);
    badge.textContent = r.area || "";
    badge.style.background = r.area ? AREAS[r.area].color : "";

    const num = S.rutas.findIndex((x) => x.id === r.id) + 1;
    const ban = el("div", "unidad");
    ban.style.background = colorArea(r);
    const tx = el("div", "unidad-tx");
    tx.append(el("b", "", "Ruta " + num + (r.area ? " · " + r.area : "")), el("h3", "", r.tema));
    if (r.competencia) tx.append(el("small", "", r.competencia));
    const lib = el("button", "unidad-lib", "📒");
    lib.type = "button";
    lib.title = "Mis áreas y competencias";
    lib.onclick = abrirAreas;
    ban.append(tx, lib);
    nodos.append(ban);

    const cam = el("div", "camino");
    const N = r.nodos.length;
    const idxCofre = N >= 4 ? Math.floor((N - 1) / 2) : -1;
    const idxActivo = r.nodos.findIndex((n) => n.estado === "activo");
    let k = 0;
    r.nodos.forEach((n, i) => {
      const fila = pasoEl(r, n, i, k);
      if (i === 1 || (N >= 5 && i === N - 2)) fila.append(decoEl(k, idxActivo >= 0 && i > idxActivo));
      cam.append(fila);
      k++;
      if (i === idxCofre) { cam.append(cofreEl(r, i, k)); k++; }
    });
    cam.append(trofeoEl(r, k));
    nodos.append(cam);

    const sig = el("div", "unidad sig");
    sig.style.background = "#1fb77c";
    const stx = el("div", "unidad-tx");
    stx.append(el("b", "", "Siguiente"), el("h3", "", "¿Otro tema?"), el("small", "", "Escríbelo abajo o haz un diagnóstico."));
    const go = el("button", "unidad-lib", "💬");
    go.type = "button";
    go.title = "Escribir un tema nuevo";
    go.onclick = () => $("chatInput").focus();
    sig.append(stx, go);
    nodos.append(sig);
  }

  function opcionesUI(q) {
    const cont = el("div", "opciones");
    const btns = q.opciones.map((t, k) => {
      const b = el("button", "opcion");
      b.type = "button";
      b.append(el("b", "", String.fromCharCode(65 + k) + ")"), document.createTextNode(" " + t));
      cont.append(b);
      return b;
    });
    return { cont, btns };
  }

  /* ---- hoja de lección (ventana con pregunta) ---- */
  let hojaCancel = null;
  function finHoja() { hojaCancel = null; $("hoja").classList.add("hidden"); $("hojaBox").replaceChildren(); }
  function cerrarHoja() { const f = hojaCancel; finHoja(); if (f) f(); }
  function hojaBase(pct, etq, onClose) {
    hojaCancel = onClose || null;
    const box = $("hojaBox");
    box.replaceChildren();
    const head = el("div", "hoja-head");
    const x = el("button", "icon-btn flat", "✕");
    x.type = "button";
    x.setAttribute("aria-label", "Cerrar");
    x.onclick = cerrarHoja;
    const bar = el("div", "bar");
    const fill = el("div");
    fill.style.width = Math.round(pct) + "%";
    bar.append(fill);
    head.append(x, bar, el("span", "hoja-etq", etq));
    const cuerpo = el("div", "hoja-cuerpo");
    box.append(head, cuerpo);
    $("hoja").classList.remove("hidden");
    return cuerpo;
  }


  let comunicacionActual = null;
  window.mistiContext = () => ({grado: parseInt(S.perfil?.grado || '4'), id:comunicacionActual || ''});
  async function apiCom(path, body) {
    const res=await fetch('/api/misti/'+path, body ? {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)} : {});
    const data=await res.json(); if(!res.ok) throw Error(data.error || 'No se pudo conectar'); return data;
  }
  async function rutaComunicacion() {
    if(ocupado)return;setEnviando(true);
    try {
      const grado=parseInt(S.perfil.grado); const nodos=[];
      for(let j=0;j<3;j++) {
        const d=await apiCom('actividad?grado='+grado+'&capacidad=L2&exclude='+encodeURIComponent(nodos.at(-1)?.comunicacionId || ''));
        const a=d.actividad;
        if(nodos.some(n=>n.comunicacionId===a.id))continue;
        nodos.push({titulo:a.titulo,leccion:a.texto_base,pregunta:a.pregunta,opciones:a.opciones,comunicacionId:a.id,estado:nodos.length?'bloqueado':'activo'});
      }
      const r={id:'com-'+Date.now(),tema:'Leemos con Misti',area:'Comunicación',competencia:AREAS['Comunicación'].competencias[1] || AREAS['Comunicación'].competencias[0],nodos,completada:false,grado};
      S.rutas.push(r);S.rutaActiva=r.id;guardar();setModo('guia',true);renderRuta();abrirNodo(0);
    }catch(e){addMsg('misty',e.message,{error:true});}finally{setEnviando(false);}
  }
  function abrirComunicacion(r,i) {
    const n=r.nodos[i];comunicacionActual=n.comunicacionId;
    const c=hojaBase(i/r.nodos.length*100,'Comunicación · '+r.grado+'.º');
    c.append(el('h3','',n.titulo),pEl(n.leccion,'leccion'),pEl(n.pregunta,'pregunta'));
    const {cont,btns}=opcionesUI(n), fb=el('div','feedback'), acc=el('div','acciones');c.append(cont,fb,acc);
    let busy=false,nivel=0;
    const hint=el('button','btn','Pista');hint.onclick=async()=>{if(busy)return;busy=true;try{const d=await apiCom('pista?id='+encodeURIComponent(n.comunicacionId)+'&nivel='+Math.min(2,++nivel));fb.textContent=d.pista;addMsg('misty',d.pista);decir(d.pista);}catch(e){fb.textContent=e.message;}finally{busy=false;}};acc.append(hint);
    const ayuda=el('button','btn','Preguntar a Misti');ayuda.onclick=()=>{finHoja();setModo('tutor');addMsg('misty','Cuéntame qué parte del texto te cuesta. Puedes volver al paso desde Mi ruta.');};acc.append(ayuda);
    btns.forEach((b,k)=>b.onclick=async()=>{
      if(busy || n.estado==='hecho')return;busy=true;
      try{
        const d=await apiCom('responder',{id:n.comunicacionId,opcion:k});
        S.comIntentos=S.comIntentos||[];S.comIntentos.push({id:n.comunicacionId,opcion:k,correcta:d.correcta,fecha:Date.now()});S.comIntentos=S.comIntentos.slice(-500);guardar();
        fb.textContent=d.mensaje;addMsg('misty',d.mensaje);decir(d.mensaje);animo(d.correcta?'happy':'sad',1500);
        if(d.correcta){
          S.comPremios=S.comPremios||{};
          if(!S.comPremios[n.comunicacionId]){S.comPremios[n.comunicacionId]=true;completarNodo(r,i);}else{n.estado='hecho';if(r.nodos[i+1])r.nodos[i+1].estado='activo';r.completada=r.nodos.every(x=>x.estado==='hecho');guardar();renderRuta();}
          btns.forEach(x=>x.disabled=true);if(gato)gato.jump();
          const next=el('button','btn primary','Continuar');next.onclick=()=>{if(r.nodos[i+1])abrirNodo(i+1);else finHoja();};acc.append(next);
        }
      }catch(e){fb.textContent=e.message;}finally{busy=false;}
    });
  }

  function abrirNodo(i) {
    const r = rutaActual();
    if (!r) return;
    const n = r.nodos[i];
    if (!n || n.estado === "bloqueado") return;
    if (n.comunicacionId) return abrirComunicacion(r, i);
    comunicacionActual=null;
    const repaso = n.estado === "hecho";
    const c = hojaBase(i / r.nodos.length * 100, "Paso " + (i + 1) + " de " + r.nodos.length);
    c.append(el("h3", "", n.titulo));
    if (n.leccion) c.append(pEl(n.leccion, "leccion"));
    c.append(pEl(n.pregunta, "pregunta"));
    const { cont, btns } = opcionesUI(n);
    const fb = el("div", "feedback");
    const acc = el("div", "acciones");
    c.append(cont, fb, acc);
    let fallos = 0, listo = false, contado = false;
    const letra = String.fromCharCode(65 + n.correcta);
    const contar = (ok) => { if (repaso || contado) return; contado = true; S.stats.respTotal++; if (ok) S.stats.respOk++; };

    btns.forEach((b, k) => {
      b.onclick = () => {
        if (listo || b.disabled) return;
        if (k === n.correcta) {
          listo = true;
          contar(fallos === 0);
          btns.forEach((x) => { x.disabled = true; });
          b.classList.add("ok");
          fb.className = "feedback ok";
          fb.textContent = "¡Correcto! " + n.explicacion;
          animo("happy", 1800);
          if (gato) gato.jump();
          decir("¡Correcto! " + n.explicacion);
          if (n.estado === "activo") completarNodo(r, i);
          const bt = el("button", "btn primary", r.nodos[i + 1] && !repaso ? "Siguiente paso →" : "Listo");
          bt.type = "button";
          bt.onclick = () => { if (r.nodos[i + 1] && !repaso) abrirNodo(i + 1); else finHoja(); };
          acc.append(bt);
        } else {
          fallos++;
          b.classList.add("mal");
          b.disabled = true;
          fb.className = "feedback mal";
          if (fallos === 1) {
            fb.textContent = "Todavía no. Lee otra vez la lección e inténtalo de nuevo.";
            decir("Todavía no. Lee otra vez la lección e inténtalo de nuevo.");
          } else {
            contar(false);
            btns[n.correcta].classList.add("ok");
            fb.textContent = "Esa tampoco. La correcta es la " + letra + ". " + n.explicacion;
            decir("Esa tampoco. La correcta es la " + letra + ". " + n.explicacion);
          }
          animo("sad", 1500);
        }
        guardar();
      };
    });
    decir((n.leccion ? n.leccion + " " : "") + n.pregunta);
  }

  function completarNodo(r, i) {
    r.nodos[i].estado = "hecho";
    if (r.nodos[i + 1]) r.nodos[i + 1].estado = "activo";
    r.completada = r.nodos.every((n) => n.estado === "hecho");
    S.stats.pasos++;
    hoyStats().pasos++;
    if (r.completada) S.stats.rutas++;
    guardar();
    renderRuta();
    // Los puntos van a la competencia y al área que la propia ruta ya clasificó.
    sumarPuntos(PUNTOS.paso, r.area, r.competencia);
    revisarReto();
    if (r.completada) {
      setTimeout(() => {
        addMsg("misty", "¡Terminaste la ruta de " + r.tema + ", " + S.perfil.nombre + "! Lo hiciste muy bien. Dime otro tema cuando quieras seguir.", { modo: "guia" });
        if (gato) { gato.jump(); gato.wave(2500); }
        animo("happy", 2500);
      }, 900);
    }
  }

  /* ---------- diagnóstico ---------- */
  async function iniciarDiagnostico(area) {
    if (area === "Comunicación") return rutaComunicacion();
    if (ocupado || !requiereClave()) return;
    setEnviando(true);
    registrarActividad();
    const esp = typing("Preparando tus preguntas…");
    animo("think");
    try {
      let preg = null, err = null;
      for (let i = 0; i < 2 && !preg; i++) {
        try {
          const txt = await MistyAI.complete({ proveedor: prov().proveedor, key: prov().key, model: prov().modelo, maxTokens: 3200,
            messages: MistyAI.mensajesDiagnostico(S.perfil, area) });
          const v = validarPreguntas(MistyAI.extractJSON(txt).preguntas, 10);
          if (v.length >= 4) preg = v; else err = new Error("Salieron pocas preguntas válidas.");
        } catch (e) { err = e; if (e.status) throw e; }
      }
      if (!preg) throw new Error((err && err.message ? err.message + " " : "") + "Intenta de nuevo o prueba con otro modelo en Configuración.");
      esp.remove();
      addMsg("misty", "Vamos a ver cómo vas en " + area + ". Son " + preg.length + " preguntas, sin apuros. Responde lo mejor que puedas.", { modo: "guia" });
      preguntaDiag({ area, preg, i: 0, res: [] });
    } catch (e) {
      esp.remove();
      addMsg("misty", e.message || "No pude preparar el diagnóstico.", { error: true, noGuardar: true });
      animo("sad", 2500);
    } finally {
      esp.remove();
      setEnviando(false);
    }
  }

  function preguntaDiag(d) {
    const q = d.preg[d.i];
    const c = hojaBase(d.i / d.preg.length * 100, "Pregunta " + (d.i + 1) + " de " + d.preg.length, () => {
      d.cancelado = true;
      addMsg("misty", "Dejamos el diagnóstico por ahora. Cuando quieras lo retomamos.", { modo: "guia", noGuardar: true });
    });
    c.append(el("h3", "", "Diagnóstico de " + d.area), pEl(q.pregunta, "pregunta"));
    const { cont, btns } = opcionesUI(q);
    c.append(cont);
    let respondida = false;
    btns.forEach((b, k) => {
      b.onclick = () => {
        if (respondida) return;
        respondida = true;
        btns.forEach((x) => { x.disabled = true; });
        b.classList.add("elegida");
        d.res.push({ ok: k === q.correcta });
        S.stats.respTotal++;
        if (k === q.correcta) S.stats.respOk++;
        setTimeout(() => {
          if (d.cancelado) return;
          if (d.i + 1 < d.preg.length) { d.i++; preguntaDiag(d); } else finalizarDiag(d);
        }, 700);
      };
    });
    decir(q.pregunta);
  }

  function finalizarDiag(d) {
    finHoja();
    const aciertos = d.res.filter((r) => r.ok).length;
    const f = d.res.findIndex((r) => !r.ok);
    S.stats.diag++;
    guardar();
    revisarLogros();
    addMsg("misty", "Terminé de revisar: acertaste " + aciertos + " de " + d.preg.length + ".", { modo: "guia" });
    if (f < 0) {
      addMsg("misty", "¡Vas muy bien en esta área! Dime un tema más difícil y armo una ruta para que sigas avanzando.", { modo: "guia" });
      if (gato) gato.jump();
      animo("happy", 2000);
      return;
    }
    const q = d.preg[f];
    addMsg("misty", "Encontré el primer punto donde se complica: " + q.subtema + ". Armo tu ruta desde ahí.", { modo: "guia" });
    crearRuta({ tema: q.subtema || q.titulo, area: d.area, competencia: q.competencia, desdeFallo: true });
  }

  /* ======================= modos ======================= */
  function marcarTabs() {
    document.body.dataset.vista = vista;
    document.querySelectorAll("#modoSwitch button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.vista === vista)));
    document.querySelectorAll("#sidebar [data-vista]").forEach((b) => b.classList.toggle("activo", b.dataset.vista === vista));
  }
  function irVista(v) {
    if (v === "inicio") { vista = "inicio"; marcarTabs(); renderInicio(); }
    else setModo(v);
    $("sidebar").classList.remove("abierto");
  }
  function setModo(m, silencioso) {
    S.modo = m;
    vista = m;
    const primera = m === "guia" ? !S.stats.modoGuia : !S.stats.modoTutor;
    if (m === "guia") S.stats.modoGuia = true; else S.stats.modoTutor = true;
    document.body.dataset.modo = m;
    marcarTabs();
    $("chatInput").placeholder = m === "guia" ? "¿Qué quieres aprender hoy?" : "Cuéntame en qué te atascaste…";
    guardar();
    renderRuta();
    if (!silencioso && primera) {
      if (m === "guia") {
        addMsg("misty", "Modo Guía: dime qué quieres aprender y armo una ruta de pasos para ti. Si no sabes en qué estás mal, elige un área y te hago un diagnóstico.", { modo: "guia" });
        chipsAreas();
      } else {
        addMsg("misty", "Modo Tutor: cuéntame en qué te atascaste. Te daré pistas primero y, si hace falta, la solución paso a paso. También puedes mandarme una foto de tu cuaderno.", { modo: "tutor" });
      }
    }
    revisarLogros();
  }

  /* ======================= Inicio (dashboard) ======================= */
  const TITULOS = ["Gatito curioso", "Explorador", "Aprendiz", "Estudiante estrella", "Sabio", "Maestro", "Leyenda"];
  const tituloNivel = () => TITULOS[Math.min(nivel() - 1, TITULOS.length - 1)];

  function dbar(etq, valor, pct) {
    const d = el("div", "dbar");
    const t = el("div"); t.append(el("span", "", etq), el("span", "", valor));
    const p = el("div", "pista"); const f = el("div"); f.style.width = Math.max(0, Math.min(100, pct)) + "%"; p.append(f);
    d.append(t, p);
    return d;
  }
  function btnIr(txt, v) {
    const b = el("button", "btn primary", txt);
    b.type = "button";
    b.onclick = () => irVista(v);
    return b;
  }

  function renderInicio() {
    const root = $("vistaInicio");
    if (!root || !S.perfil) return;
    root.replaceChildren();
    const rc = rachaEfectiva();
    const g = el("div", "dgrid");

    const sal = el("div", "saludo ancho2");
    const im = el("img"); im.src = "assets/misty-avatar.png"; im.alt = "";
    const bur = el("div", "saludo-burbuja");
    bur.append(im, el("span", "", rc >= 2 ? "¡Vas con " + rc + " días seguidos! 🔥 Sigue así." : "¿Listo para aprender algo nuevo hoy?"));
    sal.append(el("h2", "", "¡Hola, " + S.perfil.nombre + "!"), bur);
    g.append(sal);

    const st = el("div", "stats4 ancho2");
    [["yellow", S.puntos.total + " XP", "Puntos totales", "⭐"], ["blue", tituloNivel(), "Nivel " + nivel(), "💎"],
      ["orange", rc + (rc === 1 ? " día" : " días"), "Racha actual", "🔥"], ["pink", Object.keys(S.logros).length + "/" + LOGROS.length, "Logros", "🏆"]]
      .forEach(([c, b, sm, ic]) => { const d = el("div", "stat-card " + c); d.append(el("b", "", b), el("small", "", sm), el("i", "", ic)); st.append(d); });
    g.append(st);

    // progreso de ruta
    const r = rutaActual();
    const pr = el("div", "dcard ancho2 tint-y");
    pr.append(el("h3", "", "Mi ruta de aprendizaje"));
    if (r) {
      const h = r.nodos.filter((n) => n.estado === "hecho").length;
      pr.append(el("p", "sub", r.tema + (r.area ? " · " + r.area : "")),
        dbar("Esta ruta", h + " de " + r.nodos.length + " pasos", h / r.nodos.length * 100),
        dbar("Hacia el nivel " + (nivel() + 1), (S.puntos.total % PUNTOS.porNivel) + "/" + PUNTOS.porNivel + " pts", (S.puntos.total % PUNTOS.porNivel) / PUNTOS.porNivel * 100),
        btnIr(r.completada ? "Ver mi ruta" : "Continuar", "guia"));
    } else {
      pr.append(el("p", "sub", "Aún no tienes una ruta. Dime qué quieres aprender y la armo."), dbar("Hacia el nivel " + (nivel() + 1), (S.puntos.total % PUNTOS.porNivel) + "/" + PUNTOS.porNivel + " pts", (S.puntos.total % PUNTOS.porNivel)), btnIr("Crear mi ruta", "guia"));
    }
    g.append(pr);

    // reto del día
    const rt = retoDelDia(), hs = hoyStats();
    const rc2 = el("div", "dcard tint-b");
    rc2.append(el("h3", "", "Reto de hoy 🎯"), el("p", "sub", rt.t + " y gana +20 pts"),
      dbar(hs.retoOk ? "¡Cumplido!" : "Progreso", Math.min(hs[rt.k], rt.meta) + "/" + rt.meta, Math.min(hs[rt.k], rt.meta) / rt.meta * 100),
      btnIr(hs.retoOk ? "Seguir practicando" : "Ir al reto", rt.vista));
    g.append(rc2);

    // eficiencia
    const tot = S.stats.respTotal || 0, ok = S.stats.respOk || 0;
    const pc = tot ? Math.round(ok / tot * 100) : 0;
    const ef = el("div", "dcard");
    const dn = el("div", "donut");
    dn.style.background = "conic-gradient(var(--primary) " + pc + "%, var(--bg2) 0)";
    dn.append(el("div", "", pc + "%"));
    const ley = el("div", "leyenda");
    [["Aciertos a la primera", ok + "/" + tot, "var(--primary)"], ["Pasos completados", S.stats.pasos, "var(--good)"], ["Consultas al Tutor", S.stats.tutor, "#3b8fe8"]]
      .forEach(([t, v, c]) => { const sp = el("span", "", t + ": " + v); sp.style.setProperty("--c", c); ley.append(sp); });
    ef.append(el("h3", "", "Eficiencia de aprendizaje"), dn, ley);
    g.append(ef);

    // calendario
    const hoyD = new Date(), y = hoyD.getFullYear(), m = hoyD.getMonth();
    const cal = el("div", "dcard tint-y");
    const nombreMes = hoyD.toLocaleDateString("es-PE", { month: "long", year: "numeric" });
    cal.append(el("h3", "", "Actividad de " + nombreMes));
    const grid = el("div", "cal");
    ["L", "M", "M", "J", "V", "S", "D"].forEach((d) => grid.append(el("div", "dh", d)));
    const off = (new Date(y, m, 1).getDay() + 6) % 7, dias = new Date(y, m + 1, 0).getDate();
    for (let i = 0; i < off; i++) grid.append(el("div"));
    for (let d = 1; d <= dias; d++) {
      const f = fechaLocal(new Date(y, m, d));
      grid.append(el("div", "dia" + (S.actividad[f] ? " on" : "") + (d === hoyD.getDate() ? " hoy" : ""), String(d)));
    }
    cal.append(grid, el("p", "sub", "Mejor racha: " + Math.max(S.racha.max || 0, S.racha.count) + " días"));
    g.append(cal);

    // podio de áreas
    const orden = AREAS_N.map((a) => ({ a, t: (S.puntos.areas[a] || {}).total || 0 })).sort((x, y2) => y2.t - x.t);
    const po = el("div", "dcard");
    po.append(el("h3", "", "Mis áreas fuertes"));
    const pod = el("div", "podio");
    [[orden[1], "p2", 2], [orden[0], "p1", 1], [orden[2], "p3", 3]].forEach(([o, cls, n]) => {
      const c = el("div", cls);
      c.append(el("span", "ic", AREAS[o.a].icono), el("span", "", o.a.split(" ")[0]), el("small", "", o.t + " pts"), el("div", "col", String(n)));
      pod.append(c);
    });
    po.append(pod);
    g.append(po);

    if (!prov().key) {
      const k = el("div", "dcard ancho2 tint-m");
      const b = el("button", "btn primary", "Abrir Configuración");
      b.type = "button";
      b.onclick = abrirConfig;
      k.append(el("h3", "", "Conecta tu IA"), el("p", "sub", "Para hablar con Misty hace falta una clave de OpenRouter o Gemini."), b);
      g.append(k);
    }
    root.append(g);
  }

  /* ======================= fotos y voz (entrada) ======================= */
  let fotoPend = null;
  function mostrarFotoPrev() {
    const box = $("fotoPrev");
    box.replaceChildren();
    box.classList.toggle("hidden", !fotoPend);
    if (!fotoPend) return;
    const im = el("img");
    im.src = fotoPend;
    im.alt = "Foto lista para enviar";
    const x = el("button", "", "✕");
    x.type = "button";
    x.title = "Quitar foto";
    x.onclick = () => { fotoPend = null; mostrarFotoPrev(); };
    box.append(im, el("span", "", "Foto lista"), x);
  }

  function enviar() {
    if (ocupado) { if (abortCtl) abortCtl.abort(); return; }
    const t = $("chatInput").value.trim();
    if (!t && !fotoPend) return;
    $("chatInput").value = "";
    MistyVoice.parar();
    if (fotoPend && S.modo !== "tutor") setModo("tutor", true);   // las fotos se resuelven en modo Tutor
    if (S.modo === "guia") { enviarGuia(t); return; }
    const img = fotoPend;
    fotoPend = null;
    mostrarFotoPrev();
    enviarTutor(t, img);
  }

  /* ======================= modal ======================= */
  function abrirModal(titulo, nodo, ancho) {
    $("modalTitle").textContent = titulo;
    $("modalBody").replaceChildren(nodo);
    document.querySelector(".modal-box").classList.toggle("ancho", !!ancho);
    $("modal").classList.remove("hidden");
  }
  function cerrarModal() { $("modal").classList.add("hidden"); $("modalBody").replaceChildren(); repoblarVoces = null; }

  /* ---------- logros ---------- */
  function abrirLogros() {
    const g = el("div", "logros");
    LOGROS.forEach((l) => {
      const c = el("div", "logro" + (S.logros[l.id] ? "" : " bloq"));
      c.append(el("span", "ico", l.i), el("b", "", l.n), el("small", "", l.d));
      g.append(c);
    });
    const n = Object.keys(S.logros).length;
    const w = el("div");
    w.append(el("p", "", n + " de " + LOGROS.length + " logros desbloqueados."), g);
    abrirModal("Logros", w);
  }

  /* ---------- áreas ---------- */
  function abrirAreas() {
    const w = el("div");
    AREAS_N.forEach((a) => {
      const datos = S.puntos.areas[a] || { total: 0, comps: {} };
      const card = el("div", "area-card");
      card.style.borderColor = AREAS[a].color;
      const head = el("header");
      head.append(el("h3", "", AREAS[a].icono + " " + a), el("b", "", datos.total + " pts"));
      card.append(head);
      const max = Math.max(50, ...Object.values(datos.comps));
      AREAS[a].competencias.forEach((c) => {
        const p = datos.comps[c] || 0;
        const fila = el("div", "comp");
        fila.append(el("span", "", c), el("b", "", String(p)));
        const mini = el("div", "mini"), rell = el("div");
        rell.style.width = Math.min(100, (p / max) * 100) + "%";
        rell.style.background = AREAS[a].color;
        mini.append(rell);
        fila.append(mini);
        card.append(fila);
      });
      if(a === "Comunicación") { const bt=el("button","btn primary","Practicar Comunicación"); bt.onclick=()=>{cerrarModal();rutaComunicacion();};card.append(bt); }
      w.append(card);
    });
    abrirModal("Áreas y competencias", w);
  }

  /* ---------- perfil ---------- */
  function abrirPerfil() {
    const f = el("div", "form");
    const campo = (lab, inp) => { const l = el("label"); l.append(el("span", "lab", lab), inp); f.append(l); return inp; };
    const nombre = campo("Nombre", el("input")); nombre.value = S.perfil.nombre; nombre.maxLength = 40;
    const cole = campo("Colegio", el("input")); cole.value = S.perfil.institucion; cole.maxLength = 80;
    const grado = campo("Grado", el("select"));
    ["4.° grado", "5.° grado", "6.° grado"].forEach((g) => { const o = el("option", "", g); o.value = g; if (g === S.perfil.grado) o.selected = true; grado.append(o); });
    const gu = el("button", "btn primary", "Guardar cambios");
    gu.type = "button";
    gu.onclick = () => {
      if (!nombre.value.trim() || !cole.value.trim()) { toast("Completa tu nombre y tu colegio.", "error"); return; }
      S.perfil = { nombre: nombre.value.trim(), institucion: cole.value.trim(), grado: grado.value };
      guardar();
      toast("Perfil guardado.");
    };
    f.append(gu, el("hr", "sep"));
    const bh = el("button", "btn", "Borrar historial de conversaciones");
    bh.type = "button";
    bh.onclick = () => { if (confirm("¿Borrar el historial de conversaciones?")) { S.historial = []; guardar(); $("chatLog").replaceChildren(); toast("Historial borrado."); } };
    const bt = el("button", "btn danger", "Borrar todo mi progreso y salir");
    bt.type = "button";
    bt.onclick = () => { if (confirm("Se borrarán tus datos, puntos, logros y rutas de este navegador. ¿Seguro?")) { localStorage.removeItem(LS_KEY); location.reload(); } };
    f.append(bh, bt);
    abrirModal("Perfil", f);
  }

  /* ---------- configuración ---------- */
  let repoblarVoces = null;
  function abrirConfig() {
    const c = S.config;
    const f = el("div", "form");
    const campo = (lab, inp, nota) => { const l = el("label"); l.append(el("span", "lab", lab), inp); if (nota) l.append(el("small", "nota", nota)); f.append(l); return inp; };
    const check = (lab, val, fn) => {
      const l = el("label", "check"); const i = el("input"); i.type = "checkbox"; i.checked = val;
      i.onchange = () => { fn(i.checked); guardar(); };
      l.append(i, document.createTextNode(lab)); f.append(l); return i;
    };

    f.append(el("p", "nota", "IA conectada por el servidor local. Las claves se configuran solo en PowerShell."));
    check("Leer las fotos con OCR en vez de visión (Tesseract.js, en el navegador)", c.ocr, (v) => { c.ocr = v; });
    check("Ahorrar solicitudes: clasificar los puntos con palabras clave, sin la segunda llamada a la IA", c.ahorrar, (v) => { c.ahorrar = v; });
    f.append(el("hr", "sep"));

    const selVoz = campo("Voz de Misty", el("select"));
    const poblar = () => {
      selVoz.replaceChildren();
      const auto = el("option", "", "Automática (español)"); auto.value = ""; selVoz.append(auto);
      MistyVoice.voces().forEach((v) => { const o = el("option", "", v.name + " (" + v.lang + ")"); o.value = v.voiceURI; if (v.voiceURI === c.voz) o.selected = true; selVoz.append(o); });
    };
    poblar(); repoblarVoces = poblar;
    selVoz.onchange = () => { c.voz = selVoz.value; MistyVoice.configurar({ voiceURI: c.voz }); guardar(); };
    const rango = (lab, min, max, step, val, fn) => {
      const r = el("input"); r.type = "range"; r.min = min; r.max = max; r.step = step; r.value = val;
      r.oninput = () => { fn(parseFloat(r.value)); guardar(); };
      campo(lab, r); return r;
    };
    rango("Tono de la voz (más alto = más agudo)", 0.8, 2, 0.1, c.pitch, (v) => { c.pitch = v; MistyVoice.configurar({ pitch: v }); });
    rango("Velocidad de la voz", 0.7, 1.3, 0.05, c.rate, (v) => { c.rate = v; MistyVoice.configurar({ rate: v }); });
    const probar = el("button", "btn", "🔊 Probar voz");
    probar.type = "button";
    probar.onclick = () => { MistyVoice.parar(); MistyVoice.hablar("Hola, soy Misty. ¿Empezamos?"); };
    f.append(probar);
    check("Silenciar a Misty (solo texto)", c.mute, (v) => { c.mute = v; MistyVoice.configurar({ enabled: !v }); if (v) MistyVoice.parar(); });
    f.append(el("hr", "sep"));

    rango("Tamaño de letra", 14, 22, 1, c.tam, (v) => { c.tam = v; document.documentElement.style.fontSize = v + "px"; });
    check("Modo oscuro", c.oscuro, (v) => { c.oscuro = v; document.body.classList.toggle("dark", v); });
    check("Gato en 3D (si lo apagas, usa el gato 2D)", c.gato3d, (v) => { c.gato3d = v; iniciarGato(); });
    abrirModal("Configuración", f);
  }

  /* ---------- accesorios ---------- */
  function abrirAccesorios() {
    const w = el("div");
    w.append(el("p", "", "Misty gana accesorios cuando subes de nivel (cada " + PUNTOS.porNivel + " puntos). Estás en el nivel " + nivel() + "."));
    ACC.forEach((a) => {
      const libre = nivel() >= a.nivel;
      const fila = el("div", "acc");
      const txt = el("div", "txt");
      txt.append(el("b", "", a.n), el("br"), el("small", "", libre ? "Desbloqueado" : "Se desbloquea en el nivel " + a.nivel));
      const bt = el("button", "btn" + (S.accesorios.equipped[a.id] ? " primary" : ""), libre ? (S.accesorios.equipped[a.id] ? "Quitar" : "Ponerle") : "🔒");
      bt.type = "button";
      bt.disabled = !libre;
      bt.onclick = () => {
        S.accesorios.equipped[a.id] = !S.accesorios.equipped[a.id];
        guardar();
        if (gato) gato.setAccessories(S.accesorios.equipped);
        abrirAccesorios();
      };
      fila.append(el("span", "ico", a.i), txt, bt);
      w.append(fila);
    });
    abrirModal("Accesorios de Misty", w);
  }

  /* ---------- mapa de progreso (grafo estilo Obsidian) ---------- */
  function abrirMapa() {
    const w = el("div");
    const cv = el("canvas", "graph");
    const ley = el("div", "graph-leyenda");
    ley.innerHTML = '<span><i style="background:#6c5ce7"></i>Tú</span><span><i style="background:#e8743b"></i>Áreas y competencias</span><span><i style="background:#b9b3cf"></i>Paso pendiente</span><span><i style="background:#25a56d"></i>Paso completado</span><span>Arrastra los puntos para moverlos</span>';
    w.append(cv, ley);
    abrirModal("Mapa de progreso", w, true);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = cv.clientWidth || 600, H = cv.clientHeight || 400;
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext("2d");
    const nodes = [], links = [];
    const add = (label, r, color, extra) => {
      const n = Object.assign({ label, r, color, x: W / 2 + (Math.random() - 0.5) * 220, y: H / 2 + (Math.random() - 0.5) * 220, vx: 0, vy: 0, alpha: 1 }, extra || {});
      nodes.push(n); return n;
    };
    const yo = add(S.perfil.nombre, 20, "#6c5ce7");
    const areaN = {}, compN = {};
    AREAS_N.forEach((a) => {
      areaN[a] = add(a, 15, AREAS[a].color);
      links.push([yo, areaN[a], 105]);
      AREAS[a].competencias.forEach((c) => {
        const pts = ((S.puntos.areas[a] || { comps: {} }).comps[c]) || 0;
        compN[c] = add(c.replace(/^Resuelve problemas de /, "").slice(0, 22), 7 + Math.min(7, pts / 20), AREAS[a].color, { alpha: pts > 0 ? 1 : 0.4 });
        links.push([areaN[a], compN[c], 62]);
      });
    });
    S.rutas.forEach((r) => {
      const padre = compN[r.competencia] || areaN[r.area] || yo;
      const rn = add(r.tema.slice(0, 22), 9, r.area ? AREAS[r.area].color : "#6c5ce7");
      links.push([padre, rn, 52]);
      r.nodos.forEach((nd) => {
        const pn = add(nd.titulo.slice(0, 20), 4.5, nd.estado === "hecho" ? "#25a56d" : "#b9b3cf");
        links.push([rn, pn, 30]);
      });
    });

    let arrastrado = null, hover = null;
    const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) }; };
    const cercano = (p) => { let best = null, bd = 1e9; nodes.forEach((n) => { const d = Math.hypot(n.x - p.x, n.y - p.y); if (d < n.r + 7 && d < bd) { best = n; bd = d; } }); return best; };
    cv.onpointerdown = (e) => { const n = cercano(pos(e)); if (n) { arrastrado = n; cv.setPointerCapture(e.pointerId); } };
    cv.onpointermove = (e) => { const p = pos(e); if (arrastrado) { arrastrado.x = p.x; arrastrado.y = p.y; arrastrado.vx = arrastrado.vy = 0; } hover = cercano(p); };
    cv.onpointerup = () => { arrastrado = null; };

    const oscuro = () => document.body.classList.contains("dark");
    function paso() {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          let dx = a.x - b.x, dy = a.y - b.y;
          const d2 = Math.max(dx * dx + dy * dy, 36), d = Math.sqrt(d2);
          const f = 420 / d2;
          dx = (dx / d) * f; dy = (dy / d) * f;
          a.vx += dx; a.vy += dy; b.vx -= dx; b.vy -= dy;
        }
      }
      links.forEach(([a, b, len]) => {
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.max(Math.hypot(dx, dy), 1);
        const f = (d - len) * 0.02;
        a.vx += (dx / d) * f; a.vy += (dy / d) * f; b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
      });
      nodes.forEach((n) => {
        n.vx += (W / 2 - n.x) * 0.002; n.vy += (H / 2 - n.y) * 0.002;
        if (n === arrastrado) return;
        n.vx *= 0.82; n.vy *= 0.82;
        n.x = Math.max(n.r, Math.min(W - n.r, n.x + n.vx));
        n.y = Math.max(n.r, Math.min(H - n.r, n.y + n.vy));
      });
    }
    function dibujar() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = oscuro() ? "rgba(200,190,240,.3)" : "rgba(110,100,150,.35)";
      ctx.lineWidth = 1.2;
      links.forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); });
      nodes.forEach((n) => {
        ctx.globalAlpha = n.alpha;
        ctx.fillStyle = n.color;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      });
      ctx.font = "700 11px Nunito, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = oscuro() ? "#f1eefc" : "#2b2540";
      nodes.forEach((n) => { if (n.r >= 9 || n === hover) ctx.fillText(n.label, n.x, n.y - n.r - 5); });
    }
    (function frame() { if (!cv.isConnected) return; paso(); dibujar(); requestAnimationFrame(frame); })();
  }

  /* ---------- reporte para padres o docentes ---------- */
  function construirReporte() {
    const p = S.perfil;
    const filas = AREAS_N.map((a) => {
      const d = S.puntos.areas[a] || { total: 0, comps: {} };
      const comps = AREAS[a].competencias.map((c) => {
        const pts = d.comps[c] || 0;
        return `<tr><td>${esc(c)}</td><td style="width:40%"><div class="b"><i style="width:${Math.min(100, pts / 2)}%;background:${AREAS[a].color}"></i></div></td><td class="n">${pts}</td></tr>`;
      }).join("");
      return `<h3 style="color:${AREAS[a].color}">${esc(a)} · ${d.total} pts</h3><table>${comps}</table>`;
    }).join("");
    const rutas = S.rutas.length ? S.rutas.map((r) => {
      const hechos = r.nodos.filter((n) => n.estado === "hecho").length;
      return `<li>${esc(r.tema)} <small>(${esc(r.area || "sin área")})</small>: ${hechos} de ${r.nodos.length} pasos${r.completada ? " ✓" : ""}</li>`;
    }).join("") : "<li>Todavía no hay rutas.</li>";
    const logros = LOGROS.filter((l) => S.logros[l.id]).map((l) => `<li>${l.i} ${esc(l.n)}: ${esc(l.d)}</li>`).join("") || "<li>Todavía no hay logros.</li>";
    return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Reporte de ${esc(p.nombre)} · Misty</title>
<style>body{font-family:Nunito,system-ui,sans-serif;max-width:760px;margin:2rem auto;padding:0 1rem;color:#2b2540}
h1{margin:0}h3{margin:1.2rem 0 .3rem}table{width:100%;border-collapse:collapse}td{padding:.25rem .3rem;font-size:.92rem}td.n{text-align:right;font-weight:700}
.b{background:#eee;border-radius:9px;height:10px;overflow:hidden}.b i{display:block;height:100%}
.top{display:flex;gap:1rem;flex-wrap:wrap;margin:1rem 0}.top div{background:#f6f2ff;border-radius:12px;padding:.6rem 1rem}.top b{display:block;font-size:1.4rem}
small{color:#6b6585}footer{margin-top:2rem;color:#6b6585;font-size:.8rem}</style></head><body>
<h1>🐱 Reporte de avance con Misty</h1>
<p><b>${esc(p.nombre)}</b> · ${esc(p.grado)} · ${esc(p.institucion)}<br><small>Generado el ${new Date().toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" })}</small></p>
<div class="top"><div><b>${nivel()}</b>Nivel</div><div><b>${S.puntos.total}</b>Puntos</div><div><b>${rachaEfectiva()}</b>Racha (días)</div><div><b>${S.stats.pasos}</b>Pasos completados</div><div><b>${S.stats.tutor}</b>Consultas al tutor</div></div>
<h2>Avance por área y competencia</h2>${filas}
<h2>Rutas de aprendizaje</h2><ul>${rutas}</ul>
<h2>Logros</h2><ul>${logros}</ul>
<footer>Los puntos reflejan práctica con Misty; no reemplazan la evaluación del docente. Competencias del Currículo Nacional de la Educación Básica (MINEDU).</footer>
</body></html>`;
  }
  function abrirReporte() {
    const w = el("div", "reporte-prev");
    w.append(el("p", "", "Un resumen del avance de " + S.perfil.nombre + " por área, para compartir con su familia o su docente."));
    const g = el("div", "stat-grid");
    [["Nivel", nivel()], ["Puntos", S.puntos.total], ["Racha", rachaEfectiva() + " d"], ["Pasos", S.stats.pasos], ["Rutas", S.stats.rutas], ["Logros", Object.keys(S.logros).length]]
      .forEach(([k, v]) => { const s = el("div", "stat"); s.append(el("b", "", String(v)), el("small", "", k)); g.append(s); });
    const fila = el("div", "fila");
    const d = el("button", "btn primary", "⬇ Descargar reporte (.html)"); d.type = "button";
    d.onclick = () => {
      const blob = new Blob([construirReporte()], { type: "text/html;charset=utf-8" });
      const a = el("a");
      a.href = URL.createObjectURL(blob);
      a.download = "Reporte_Misty_" + S.perfil.nombre.replace(/[^\p{L}\p{N}]+/gu, "_") + ".html";
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
    const i = el("button", "btn", "🖨 Imprimir o guardar como PDF"); i.type = "button";
    i.onclick = () => {
      const win = window.open("", "_blank");
      if (!win) { toast("El navegador bloqueó la ventana. Permite ventanas emergentes.", "error"); return; }
      win.document.write(construirReporte()); win.document.close(); win.focus(); setTimeout(() => win.print(), 400);
    };
    fila.append(d, i);
    w.append(g, fila);
    abrirModal("Reporte para padres o docentes", w);
  }

  /* ======================= arranque ======================= */
  function aplicarVisual() {
    document.body.classList.toggle("dark", !!S.config.oscuro);
    document.documentElement.style.fontSize = S.config.tam + "px";
    MistyVoice.configurar({ enabled: !S.config.mute, pitch: S.config.pitch, rate: S.config.rate, voiceURI: S.config.voz });
  }

  function saludo(hablar) {
    addMsg("misty", "¡Hola, " + S.perfil.nombre + "! Soy Misty, tu gata guía. Te voy a acompañar en tu paso a secundaria. Arriba puedes elegir el modo Guía, para aprender un tema paso a paso, o el modo Tutor, para que te ayude con lo que se te atascó.", { noGuardar: true, hablar: hablar });
  }

  function mostrarApp(primera) {
    $("registro").classList.add("hidden");
    $("app").classList.remove("hidden");
    aplicarVisual();
    iniciarGato();
    actualizarHUD();
    $("chatLog").replaceChildren();
    S.historial.slice(-40).forEach((m) => addMsg(m.rol, m.texto, { noGuardar: true, hablar: false, modo: m.modo }));
    if (!S.historial.length) saludo(primera);
    if (!prov().key) addMsg("sys", "Para hablar conmigo hace falta tu clave de IA (OpenRouter o Gemini). Pégala en Configuración.", { noGuardar: true });
    setModo(S.modo, true);
    irVista("inicio");
    if (MistyVoice.soportaEntrada() === false) { $("btnMic").disabled = true; $("btnMic").title = "Tu navegador no tiene reconocimiento de voz (usa Chrome)."; }
  }

  function mostrarRegistro() {
    $("registro").classList.remove("hidden");
  }

  function conectar() {
    $("regForm").onsubmit = (e) => {
      e.preventDefault();
      S.perfil = { nombre: $("regNombre").value.trim(), institucion: $("regColegio").value.trim(), grado: $("regGrado").value };
      const k = $("regKey").value.trim();
      if (k) { if (/^(AQ\.|AIza)/.test(k)) { S.config.keyGemini = k; S.config.proveedor = "gemini"; } else S.config.key = k; }
      guardar();
      mostrarApp(true);
    };
    $("chatBar").onsubmit = (e) => { e.preventDefault(); enviar(); };
    document.querySelectorAll("#modoSwitch button, #sidebar [data-vista]").forEach((b) => { b.onclick = () => { if (vista !== b.dataset.vista) irVista(b.dataset.vista); }; });
    $("rutaSel").onchange = (e) => { S.rutaActiva = e.target.value; guardar(); renderRuta(); const r = rutaActual(); if (r) { const i = r.nodos.findIndex((n) => n.estado === "activo"); abrirNodo(i >= 0 ? i : 0); } };

    const bd = el("button", "chip", "🕵️ Diagnóstico");
    bd.type = "button";
    bd.title = "Averiguar en qué área necesitas ayuda";
    bd.onclick = () => { addMsg("misty", "¿De qué área quieres que te haga unas preguntas?", { modo: "guia" }); chipsAreas(); };
    document.querySelector(".ruta-head").append(bd);

    $("btnFoto").onclick = () => $("fotoInput").click();
    $("fotoInput").onchange = async (e) => {
      const f = e.target.files[0];
      e.target.value = "";
      if (!f) return;
      try {
        fotoPend = await MistyAI.fileToDataURL(f, 1024);
        mostrarFotoPrev();
        if (S.modo !== "tutor") { setModo("tutor", true); toast("Las fotos las resolvemos en modo Tutor."); }
        $("chatInput").focus();
      } catch (err) { toast(err.message, "error"); }
    };

    $("btnMic").onclick = () => {
      if (MistyVoice.escuchando()) { MistyVoice.detenerEscucha(); return; }
      MistyVoice.parar();
      $("btnMic").classList.add("grabando");
      MistyVoice.escuchar({
        onTexto: (t) => { $("chatInput").value = t; },
        onError: (err) => toast(err.message, "error"),
        onFin: (t) => {
          $("btnMic").classList.remove("grabando");
          if (t) { S.stats.voz++; guardar(); revisarLogros(); $("chatInput").value = t; enviar(); }
        }
      });
    };

    document.querySelectorAll("#sidebar [data-panel]").forEach((b) => {
      b.onclick = () => {
        $("sidebar").classList.remove("abierto");
        ({ logros: abrirLogros, areas: abrirAreas, perfil: abrirPerfil, config: abrirConfig, mapa: abrirMapa, accesorios: abrirAccesorios, reporte: abrirReporte })[b.dataset.panel]();
      };
    });
    $("menuBtn").onclick = () => $("sidebar").classList.toggle("abierto");
    $("main").addEventListener("click", () => $("sidebar").classList.remove("abierto"));
    $("hoja").addEventListener("click", (e) => { if (e.target === $("hoja")) cerrarHoja(); });
    $("modalClose").onclick = cerrarModal;
    $("modal").addEventListener("click", (e) => { if (e.target === $("modal")) cerrarModal(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") { if (!$("modal").classList.contains("hidden")) cerrarModal(); else if (!$("hoja").classList.contains("hidden")) cerrarHoja(); } });
    if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = () => { if (repoblarVoces) repoblarVoces(); };
  }

  function iniciar() {
    cargar();
    conectar();
    bucleBoca();
    if (S.perfil) mostrarApp(false); else mostrarRegistro();
  }
  iniciar();
})();
