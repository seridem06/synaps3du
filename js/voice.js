/* Voz: salida con speechSynthesis (por oraciones, en cola) y entrada con reconocimiento de voz. */
const MistyVoice = (() => {
  "use strict";
  const cfg = { enabled: true, pitch: 1.4, rate: 1.0, voiceURI: "" };
  let buffer = "";
  const synth = window.speechSynthesis || null;

  function configurar(o) { Object.assign(cfg, o || {}); }

  function voces() {
    if (!synth) return [];
    return synth.getVoices().filter((v) => /^es/i.test(v.lang));
  }

  function elegirVoz() {
    const todas = voces();
    if (!todas.length) return null;
    if (cfg.voiceURI) {
      const v = todas.find((x) => x.voiceURI === cfg.voiceURI);
      if (v) return v;
    }
    for (const pref of ["es-PE", "es-MX", "es-US", "es-419", "es-AR", "es-CO", "es-ES"]) {
      const v = todas.find((x) => x.lang.replace("_", "-").toLowerCase() === pref.toLowerCase());
      if (v) return v;
    }
    return todas[0];
  }

  // Quita markdown, emojis y enlaces para que la voz no los lea.
  function limpiar(t) {
    return String(t)
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/[*_#`>~|]/g, " ")
      .replace(/\p{Extended_Pictographic}/gu, " ")
      .replace(/[‍️]/g, "")
      .replace(/\n+/g, ". ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hablar(texto) {
    if (!synth || !cfg.enabled) return;
    const limpio = limpiar(texto);
    if (!limpio || !/[\p{L}\p{N}]/u.test(limpio)) return;
    const u = new SpeechSynthesisUtterance(limpio);
    const v = elegirVoz();
    if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = "es-MX"; }
    u.pitch = cfg.pitch;
    u.rate = cfg.rate;
    synth.speak(u);
  }

  // Streaming: acumula texto y manda a hablar cada oración completa.
  function alimentar(token) {
    buffer += token;
    const re = /[.!?…]+["')»]*(\s+)|\n+/;
    for (;;) {
      const m = re.exec(buffer);
      if (!m) break;
      const fin = m.index + m[0].length;
      const oracion = buffer.slice(0, fin);
      buffer = buffer.slice(fin);
      hablar(oracion);
    }
  }
  function terminar() {
    if (buffer.trim()) hablar(buffer);
    buffer = "";
  }
  function parar() {
    buffer = "";
    if (synth) synth.cancel();
  }
  function hablando() { return !!synth && (synth.speaking || synth.pending); }

  /* ---- entrada por voz ---- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  function soportaEntrada() { return !!SR; }
  function escuchar(o) {
    if (!SR) { if (o.onError) o.onError(new Error("Tu navegador no tiene reconocimiento de voz. Usa Chrome.")); return; }
    detenerEscucha();
    rec = new SR();
    rec.lang = "es-PE";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    let finalTxt = "";
    rec.onresult = (e) => {
      let parcial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalTxt += r[0].transcript; else parcial += r[0].transcript;
      }
      if (o.onTexto) o.onTexto((finalTxt + parcial).trim(), false);
    };
    rec.onerror = (e) => {
      const msgs = { "not-allowed": "No tengo permiso para usar el micrófono.", "service-not-allowed": "El micrófono no está permitido en esta página.",
        "no-speech": "No te escuché. Intenta de nuevo.", "audio-capture": "No encuentro un micrófono.", "network": "El reconocimiento de voz necesita internet." };
      if (o.onError) o.onError(new Error(msgs[e.error] || ("Error de voz: " + e.error)));
    };
    rec.onend = () => {
      const t = finalTxt.trim();
      rec = null;
      if (o.onFin) o.onFin(t);
    };
    try { rec.start(); } catch (e) { rec = null; if (o.onError) o.onError(e); }
  }
  function detenerEscucha() { if (rec) { try { rec.stop(); } catch (e) { /* ya detenido */ } } }
  function escuchando() { return !!rec; }

  return { configurar, voces, hablar, alimentar, terminar, parar, hablando, soportaEntrada, escuchar, detenerEscucha, escuchando, limpiar };
})();
