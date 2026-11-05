/* Gato de Misty (inspirado en el gato moteado de la referencia: pelaje dorado con manchas,
 * ojos ámbar, bufanda andina, mochila, cola anillada y pata saludando).
 *
 * MistyCat.crear(host, {prefer3d}) devuelve un objeto con la misma API en 3D (Three.js) o en 2D (SVG):
 *   setMouth(0..1), setMood('idle'|'think'|'happy'|'sad'), setTalking(bool), jump(), wave(ms),
 *   setAccessories({hat, glasses, scope}), onTap, dispose(), tipo
 * Si Three.js o WebGL no están disponibles, cae solo al SVG 2D.
 */
const MistyCat = (() => {
  "use strict";
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const PAL = {
    fur: "#cfa86a", furLight: "#dcbb82", furDark: "#a9854f", spot: "#4a2f1e", cream: "#f6ebd6",
    pink: "#e79a9a", nose: "#d98780", pad: "#cf9189", tongue: "#e8667a", mouth: "#5a1f2b",
    red: "#c0392b", orange: "#e8892b", yellow: "#f2c230", teal: "#2a9d8f", brown: "#7a4a26", brass: "#d6a94a"
  };

  /* ======================================================================
   *  Texturas pintadas con canvas (pelaje, ojos, bufanda…)
   * ====================================================================== */
  const lienzo = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
  const semilla = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);

  // Roseta: anillo oscuro irregular con el centro un poco más oscuro que el pelaje.
  function roseta(ctx, x, y, r, rnd) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rnd() * Math.PI);
    ctx.fillStyle = "rgba(150,112,64,.55)";
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.9, r * 0.62, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = PAL.spot;
    ctx.lineWidth = Math.max(3, r * 0.34);
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.68, 0, 0.25, Math.PI * 2 - 0.15); ctx.stroke();
    ctx.restore();
  }
  function mancha(ctx, x, y, r, rnd) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rnd() * Math.PI);
    ctx.fillStyle = PAL.spot;
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * (0.6 + rnd() * 0.3), 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function envolver(ctx, W, x, fn) { fn(x); if (x < 120) fn(x + W); if (x > W - 120) fn(x - W); }

  function texPelaje(T, W, H, n, escala, seed) {
    const c = lienzo(W, H), ctx = c.getContext("2d"), rnd = semilla(seed);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, PAL.furDark); g.addColorStop(0.45, PAL.fur); g.addColorStop(1, PAL.furLight);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // moteado suave del pelaje
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = "rgba(" + (rnd() < 0.5 ? "120,88,48" : "235,205,150") + "," + (0.05 + rnd() * 0.07) + ")";
      ctx.beginPath(); ctx.arc(rnd() * W, rnd() * H, 4 + rnd() * 14, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < n; i++) {
      const x = rnd() * W, y = H * (0.1 + rnd() * 0.8), r = (16 + rnd() * 18) * escala;
      envolver(ctx, W, x, (xx) => { if (rnd() < 0.62) roseta(ctx, xx, y, r, rnd); else mancha(ctx, xx, y, r * 0.38, rnd); });
    }
    return textura(T, c);
  }

  // Cabeza: frente al centro (x = W/2), rayas de la frente, líneas de las mejillas y manchas atrás.
  function texCabeza(T) {
    const W = 1024, H = 512, c = lienzo(W, H), ctx = c.getContext("2d"), rnd = semilla(77);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, PAL.furDark); g.addColorStop(0.5, PAL.fur); g.addColorStop(1, PAL.furLight);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 220; i++) {
      ctx.fillStyle = "rgba(" + (rnd() < 0.5 ? "120,88,48" : "235,205,150") + "," + (0.05 + rnd() * 0.07) + ")";
      ctx.beginPath(); ctx.arc(rnd() * W, rnd() * H, 3 + rnd() * 11, 0, Math.PI * 2); ctx.fill();
    }
    const F = W / 2;                       // centro del frente
    ctx.strokeStyle = PAL.spot; ctx.lineCap = "round";
    const trazo = (pts, ancho) => {        // curva suave por puntos
      ctx.lineWidth = ancho; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
        ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
      }
      ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]); ctx.stroke();
    };
    // frente: tres rayas
    trazo([[F, 60], [F, 100], [F, 140]], 15);
    [-1, 1].forEach((s) => {
      trazo([[F + s * 34, 70], [F + s * 40, 105], [F + s * 36, 140]], 12);
      trazo([[F + s * 70, 88], [F + s * 80, 116], [F + s * 76, 146]], 10);
      trazo([[F + s * 104, 110], [F + s * 116, 134], [F + s * 112, 160]], 9);
      // delineado del ojo y líneas de la mejilla
      trazo([[F + s * 96, 232], [F + s * 132, 236], [F + s * 168, 246]], 8);
      trazo([[F + s * 110, 256], [F + s * 146, 266], [F + s * 178, 282]], 7);
      trazo([[F + s * 120, 282], [F + s * 150, 294], [F + s * 176, 312]], 6);
      // ceja
      trazo([[F + s * 62, 196], [F + s * 92, 186], [F + s * 124, 194]], 8);
    });
    // manchas arriba y atrás
    for (let i = 0; i < 26; i++) {
      const x = rnd() * W, y = 40 + rnd() * 210;
      if (Math.abs(x - F) < 150 && y < 200) continue;
      envolver(ctx, W, x, (xx) => { if (rnd() < 0.5) roseta(ctx, xx, y, 12 + rnd() * 10, rnd); else mancha(ctx, xx, y, 6 + rnd() * 5, rnd); });
    }
    // hocico más claro
    const rg = ctx.createRadialGradient(F, 330, 8, F, 330, 150);
    rg.addColorStop(0, "rgba(246,235,214,.95)"); rg.addColorStop(1, "rgba(246,235,214,0)");
    ctx.fillStyle = rg; ctx.fillRect(F - 170, 240, 340, 220);
    // puntitos de los bigotes
    ctx.fillStyle = "rgba(74,47,30,.6)";
    [-1, 1].forEach((s) => { for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(F + s * (62 + (i % 3) * 22), 318 + Math.floor(i / 3) * 24, 3.2, 0, Math.PI * 2); ctx.fill(); } });
    return textura(T, c);
  }

  function texOjo(T) {
    const S = 256, c = lienzo(S, S), ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(S / 2, S / 2 + 10, 8, S / 2, S / 2, S / 2 - 4);
    g.addColorStop(0, "#f0bd55"); g.addColorStop(0.5, "#cf9024"); g.addColorStop(0.86, "#7b4a15"); g.addColorStop(1, "#2a170a");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#120a06"; ctx.beginPath(); ctx.ellipse(S / 2, S / 2 + 4, 52, 72, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.96)"; ctx.beginPath(); ctx.ellipse(S / 2 - 46, S / 2 - 52, 30, 34, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(S / 2 + 44, S / 2 + 46, 13, 0, Math.PI * 2); ctx.fill();
    return textura(T, c);
  }

  function texBufanda(T) {
    const W = 512, H = 128, c = lienzo(W, H), ctx = c.getContext("2d");
    ctx.fillStyle = PAL.red; ctx.fillRect(0, 0, W, H);
    const franja = (y, h, col) => { ctx.fillStyle = col; ctx.fillRect(0, y, W, h); };
    franja(14, 10, PAL.cream); franja(26, 22, PAL.orange); franja(50, 28, PAL.yellow); franja(80, 22, PAL.orange); franja(104, 10, PAL.cream);
    // rombos andinos
    ctx.fillStyle = PAL.teal;
    for (let x = 16; x < W; x += 64) { ctx.beginPath(); ctx.moveTo(x, 64); ctx.lineTo(x + 14, 52); ctx.lineTo(x + 28, 64); ctx.lineTo(x + 14, 76); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = PAL.red;
    for (let x = 48; x < W; x += 64) { ctx.beginPath(); ctx.moveTo(x, 64); ctx.lineTo(x + 8, 57); ctx.lineTo(x + 16, 64); ctx.lineTo(x + 8, 71); ctx.closePath(); ctx.fill(); }
    ctx.strokeStyle = PAL.teal; ctx.lineWidth = 4; ctx.beginPath();
    for (let x = 0; x <= W; x += 16) { const y = 32 + ((x / 16) % 2 ? 0 : 8) - 4; if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
    const t = textura(T, c, true); t.repeat.set(3, 1); t.offset.y = 0.22;
    return t;
  }

  function texChullo(T) {
    const W = 512, H = 256, c = lienzo(W, H), ctx = c.getContext("2d");
    ctx.fillStyle = PAL.red; ctx.fillRect(0, 0, W, H);
    const franja = (y, h, col) => { ctx.fillStyle = col; ctx.fillRect(0, y, W, h); };
    franja(150, 14, PAL.cream); franja(164, 36, PAL.yellow); franja(200, 14, PAL.cream); franja(214, 42, PAL.teal);
    ctx.fillStyle = PAL.orange;
    for (let x = 0; x < W; x += 48) { ctx.beginPath(); ctx.moveTo(x, 110); ctx.lineTo(x + 24, 60); ctx.lineTo(x + 48, 110); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = PAL.cream;
    for (let x = 12; x < W; x += 48) { ctx.beginPath(); ctx.arc(x + 12, 128, 7, 0, Math.PI * 2); ctx.fill(); }
    return textura(T, c, true);
  }

  function texSombra(T) {
    const S = 256, c = lienzo(S, S), ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(S / 2, S / 2, 6, S / 2, S / 2, S / 2);
    g.addColorStop(0, "rgba(40,60,110,.38)"); g.addColorStop(1, "rgba(40,60,110,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    return textura(T, c);
  }

  function textura(T, canvas, repetir) {
    const t = new T.CanvasTexture(canvas);
    if (repetir) { t.wrapS = T.RepeatWrapping; t.wrapT = T.RepeatWrapping; }
    t.anisotropy = 4;
    return t;
  }

  /* ======================================================================
   *  GATO 3D (Three.js, armado con formas básicas)
   * ====================================================================== */
  function crear3D(host) {
    const T = window.THREE;
    if (!T) throw new Error("Three.js no disponible");

    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    const canvas = renderer.domElement;
    canvas.className = "cat-canvas";
    host.appendChild(canvas);

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(33, 1, 0.1, 60);
    camera.position.set(0, 1.0, 9);
    camera.lookAt(0, 1.0, 0);

    scene.add(new T.HemisphereLight(0xfff6ea, 0xbcd2f0, 0.62));
    const luzKey = new T.DirectionalLight(0xffffff, 0.62); luzKey.position.set(-3, 5, 6); scene.add(luzKey);
    const luzRim = new T.DirectionalLight(0xcfe2ff, 0.3); luzRim.position.set(4, 2.5, -3); scene.add(luzRim);

    const std = (o) => new T.MeshStandardMaterial(Object.assign({ roughness: 0.82, metalness: 0 }, o));
    const col = (h) => new T.Color(h);
    const tPelaje = texPelaje(T, 1024, 512, 70, 1, 11);
    const tPelajeS = texPelaje(T, 512, 512, 14, 0.9, 5);
    const M = {
      cuerpo: std({ map: tPelaje }), cabeza: std({ map: texCabeza(T) }), miembro: std({ map: tPelajeS }),
      fur: std({ color: col(PAL.fur) }), furDark: std({ color: col(PAL.furDark) }), spot: std({ color: col(PAL.spot) }),
      cream: std({ color: col(PAL.cream) }), pink: std({ color: col(PAL.pink), roughness: 0.6 }),
      nose: std({ color: col(PAL.nose), roughness: 0.45 }), pad: std({ color: col(PAL.pad), roughness: 0.6 }),
      mouth: std({ color: col(PAL.mouth), roughness: 1 }), tongue: std({ color: col(PAL.tongue), roughness: 0.55 }),
      white: std({ color: 0xffffff, roughness: 0.4 }), whisk: new T.MeshBasicMaterial({ color: 0xfffaf0 }),
      bufanda: std({ map: texBufanda(T), roughness: 0.95 }), brown: std({ color: col(PAL.brown), roughness: 0.7 }),
      brownDark: std({ color: col("#5c3519"), roughness: 0.7 }), brass: std({ color: col(PAL.brass), roughness: 0.35, metalness: 0.5 }),
      dark: std({ color: 0x2b2540, roughness: 0.4 }), lente: new T.MeshStandardMaterial({ color: 0x9ed0ff, transparent: true, opacity: 0.28, roughness: 0.1 }),
      chullo: std({ map: texChullo(T), roughness: 0.95 }), red: std({ color: col(PAL.red) }), yellow: std({ color: col(PAL.yellow) }),
      teal: std({ color: col(PAL.teal) }), orange: std({ color: col(PAL.orange) }),
      libro1: std({ color: 0x9b3d2e }), libro2: std({ color: 0x5b7fa6 }), libro3: std({ color: 0xc8a56a }), paginas: std({ color: 0xf8f1df }),
      ojoBorde: std({ color: 0x2a170a, roughness: 0.5 })
    };
    M.iris = new T.MeshBasicMaterial({ map: texOjo(T), transparent: true });
    M.sombra = new T.MeshBasicMaterial({ map: texSombra(T), transparent: true, depthWrite: false });

    const esfera = (r, ws, hs) => new T.SphereGeometry(r, ws || 36, hs || 26);
    const esferaUV = (r) => { const g = esfera(r); g.rotateY(-Math.PI / 2); return g; };   // costura atrás, frente en u=.5
    const malla = (geo, m, x, y, z, sx, sy, sz) => {
      const o = new T.Mesh(geo, m);
      o.position.set(x || 0, y || 0, z || 0);
      o.scale.set(sx == null ? 1 : sx, sy == null ? 1 : sy, sz == null ? 1 : sz);
      return o;
    };

    const gato = new T.Group();
    scene.add(gato);

    // sombra en el suelo y libros
    const sombra = malla(new T.PlaneGeometry(3.6, 2.2), M.sombra, 0, -1.07, 0.1);
    sombra.rotation.x = -Math.PI / 2;
    scene.add(sombra);
    const libros = new T.Group();
    libros.position.set(-1.6, -1.07, 0.9);
    libros.scale.setScalar(0.85);
    [[1.05, 0.2, 0.74, M.libro1, 0.0, 0.1], [0.98, 0.18, 0.68, M.libro2, 0.12, 0.29], [0.92, 0.19, 0.64, M.libro3, -0.1, 0.475]].forEach(([w, h, d, mat, rot, y]) => {
      const g = new T.Group();
      g.position.y = y; g.rotation.y = rot;
      g.add(malla(new T.BoxGeometry(w, h, d), mat));
      g.add(malla(new T.BoxGeometry(w - 0.04, h - 0.06, d + 0.03), M.paginas, 0.02, 0, 0.02));
      libros.add(g);
    });
    scene.add(libros);

    /* ---- cuerpo sentado ---- */
    const torso = malla(esferaUV(1), M.cuerpo, 0, 0.1, -0.08, 0.92, 1.12, 0.84);
    gato.add(torso);
    gato.add(malla(esferaUV(0.72), M.cream, 0, 0.0, 0.52, 0.8, 1.0, 0.5));          // pecho crema
    [-1, 1].forEach((s) => {
      gato.add(malla(esferaUV(0.58), M.cuerpo, s * 0.74, -0.48, 0.08, 0.92, 0.98, 1.2));   // ancas
      gato.add(malla(esfera(0.26), M.cream, s * 0.62, -0.97, 0.78, 1.0, 0.55, 1.35));       // patas traseras
    });

    // pata delantera derecha del gato (a la derecha de la pantalla, quieta)
    const patasDelanteras = [];
    const patita = (g, s) => {
      g.add(malla(esfera(0.24), M.cream, 0, -0.84, 0.06, 1.0, 0.62, 1.3));
      [-0.07, 0.07].forEach((x) => g.add(malla(new T.BoxGeometry(0.014, 0.012, 0.16), M.spot, x, -0.755, 0.2)));
    };
    {
      const g = new T.Group();
      g.position.set(0.4, 0.4, 0.62);
      g.add(malla(new T.CapsuleGeometry(0.17, 0.62, 6, 16), M.miembro, 0, -0.38, 0));
      patita(g, 1);
      gato.add(g);
      patasDelanteras.push(g);
    }

    // brazo que saluda (a la izquierda de la pantalla)
    const brazo = new T.Group();
    brazo.position.set(-0.46, 0.5, 0.58);
    brazo.add(malla(new T.CapsuleGeometry(0.17, 0.62, 6, 16), M.miembro, 0, -0.38, 0));
    {
      const pata = new T.Group();
      pata.position.set(0, -0.84, 0.0);
      pata.add(malla(esfera(0.25), M.fur, 0, 0, 0, 1.0, 1.12, 0.78));
      pata.add(malla(esfera(0.105), M.pad, 0, 0.0, 0.17, 1.15, 0.9, 0.42));
      [[-0.115, -0.15], [-0.04, -0.2], [0.04, -0.2], [0.115, -0.15]].forEach(([x, y]) => pata.add(malla(esfera(0.052), M.pad, x, y, 0.15, 1, 1.1, 0.5)));
      brazo.add(pata);
    }
    gato.add(brazo);

    /* ---- cola anillada (cadena de cápsulas) ---- */
    const colaRaiz = new T.Group();
    colaRaiz.position.set(0.5, -0.62, -0.62);
    colaRaiz.rotation.z = -0.95;
    gato.add(colaRaiz);
    const colaSegs = [];
    {
      let padre = colaRaiz;
      const NSEG = 11;
      for (let i = 0; i < NSEG; i++) {
        const g = new T.Group();
        if (i > 0) g.position.y = 0.2;
        const r = lerp(0.17, 0.15, i / (NSEG - 1));
        const mat = i >= NSEG - 3 ? M.spot : (i % 2 ? M.spot : M.fur);
        g.add(malla(new T.CapsuleGeometry(r, 0.2, 6, 14), mat, 0, 0.1, 0));
        padre.add(g);
        colaSegs.push(g);
        padre = g;
      }
    }

    /* ---- mochila y correas ---- */
    const mochila = new T.Group();
    mochila.position.set(0.86, 0.15, -0.3);
    mochila.rotation.y = 0.35;
    mochila.add(malla(new T.BoxGeometry(0.42, 0.7, 0.32), M.brown));
    mochila.add(malla(new T.BoxGeometry(0.44, 0.3, 0.34), M.brownDark, 0, 0.22, 0));
    mochila.add(malla(new T.CylinderGeometry(0.035, 0.035, 0.03, 12), M.brass, 0.0, 0.1, 0.18)).rotation.x = Math.PI / 2;
    gato.add(mochila);
    [-1, 1].forEach((s) => {
      const c = new T.Group();
      c.position.set(s * 0.5, 0.42, 0.7);
      c.rotation.z = s * 0.22;
      c.add(malla(new T.BoxGeometry(0.1, 0.92, 0.05), M.brown));
      c.add(malla(new T.BoxGeometry(0.075, 0.06, 0.07), M.brass, 0, -0.1, 0.02));
      gato.add(c);
    });

    /* ---- bufanda andina ---- */
    const bufanda = new T.Group();
    bufanda.position.set(0, 0.84, 0.1);
    {
      const aro = malla(new T.TorusGeometry(0.7, 0.2, 18, 44), M.bufanda, 0, 0, 0, 1.12, 1, 1.0);
      aro.rotation.x = Math.PI / 2 - 0.12;
      bufanda.add(aro);
      [[0.2, -0.38, 0.86, -0.12, 0.34, 0.66], [-0.1, -0.34, 0.88, 0.1, 0.3, 0.6]].forEach(([x, y, z, rz, w, h]) => {
        const g = new T.Group();
        g.position.set(x, y, z); g.rotation.z = rz;
        g.add(malla(new T.BoxGeometry(w, h, 0.09), M.bufanda));
        for (let k = 0; k < 7; k++) g.add(malla(new T.CylinderGeometry(0.014, 0.014, 0.16, 6), [M.red, M.orange, M.yellow][k % 3], -w / 2 + 0.03 + k * (w - 0.06) / 6, -h / 2 - 0.07, 0.0));
        bufanda.add(g);
      });
    }
    gato.add(bufanda);

    /* ---- cabeza ---- */
    const cabeza = new T.Group();
    cabeza.position.set(0, 1.55, 0.15);
    gato.add(cabeza);
    cabeza.add(malla(esferaUV(0.9), M.cabeza, 0, 0, 0, 1.12, 0.96, 1.0));

    // orejas con mechones
    const orejas = [];
    [-1, 1].forEach((s) => {
      const g = new T.Group();
      g.position.set(s * 0.64, 0.74, -0.03);
      g.add(malla(new T.ConeGeometry(0.36, 0.72, 24), M.fur, 0, 0.0, 0));
      g.add(malla(new T.ConeGeometry(0.1, 0.2, 24), M.spot, 0, 0.27, 0, 1.02, 1.02, 1.02));   // punta oscura
      g.add(malla(new T.ConeGeometry(0.25, 0.52, 24), M.pink, 0, -0.06, 0.1, 1, 1, 0.6));
      [-0.1, 0.0, 0.1].forEach((dx, i) => {
        const m = malla(new T.ConeGeometry(0.045, 0.28 - Math.abs(dx) * 0.7, 8), M.cream, dx * 1.2 - s * 0.02, -0.12 + (i === 1 ? 0.04 : 0), 0.17);
        m.rotation.z = -dx * 1.4; g.add(m);
      });
      g.rotation.y = -s * 0.2;
      cabeza.add(g);
      orejas.push({ g, s });
    });

    // mechones de las mejillas
    [-1, 1].forEach((s) => {
      [[-0.2, 0.28], [-0.32, 0.18], [-0.44, 0.08]].forEach(([y, z], i) => {
        const m = malla(new T.ConeGeometry(0.075, 0.3, 8), M.cream, s * (0.92 - i * 0.02), y + 0.03, z + 0.18);
        m.rotation.z = -s * (Math.PI / 2 + 0.2 * (i - 1));
        cabeza.add(m);
      });
    });

    // ojos grandes ámbar
    const ojos = [];
    [-1, 1].forEach((s) => {
      const g = new T.Group();
      g.position.set(s * 0.4, 0.1, 0.79);
      g.rotation.y = s * 0.12;
      const ojo = new T.Group();
      ojo.add(malla(esfera(0.215), M.ojoBorde, 0, 0, 0, 1, 1.08, 0.5));
      const iris = malla(new T.CircleGeometry(0.2, 40), M.iris, 0, 0, 0.12);
      iris.scale.set(1, 1.07, 1);
      ojo.add(iris);
      g.add(ojo);
      // guiño: arco ∩
      const arco = malla(new T.TorusGeometry(0.17, 0.026, 10, 28, Math.PI), M.spot, 0, -0.05, 0.1);
      arco.visible = false;
      g.add(arco);
      cabeza.add(g);
      ojos.push({ g, ojo, iris, arco, s });
    });

    // nariz, hocico y sonrisa
    cabeza.add(malla(esfera(0.08), M.nose, 0, -0.12, 0.9, 1.3, 0.9, 0.8));
    [-1, 1].forEach((s) => cabeza.add(malla(esfera(0.22), M.cream, s * 0.17, -0.3, 0.71, 1.05, 0.8, 0.9)));
    const lineaBoca = new T.Group();
    lineaBoca.add(malla(new T.CylinderGeometry(0.011, 0.011, 0.1, 6), M.spot, 0, -0.205, 0.93));
    [-1, 1].forEach((s) => {
      const arc = malla(new T.TorusGeometry(0.075, 0.012, 8, 18, Math.PI), M.spot, s * 0.075, -0.26, 0.92);
      arc.rotation.z = Math.PI;
      lineaBoca.add(arc);
    });
    cabeza.add(lineaBoca);
    const bocaOscura = malla(esfera(0.1), M.mouth, 0, -0.42, 0.83, 1.7, 0.04, 0.6);
    cabeza.add(bocaOscura);
    const colmillos = [-1, 1].map((s) => { const m = malla(new T.ConeGeometry(0.02, 0.07, 8), M.white, s * 0.1, -0.395, 0.9); m.rotation.x = Math.PI; m.visible = false; cabeza.add(m); return m; });
    const mandibula = new T.Group();
    mandibula.position.set(0, -0.38, 0.62);
    mandibula.add(malla(esfera(0.17), M.cream, 0, -0.1, 0.12, 1.05, 0.55, 0.92));
    const lengua = malla(esfera(0.07), M.tongue, 0, -0.07, 0.15, 1.3, 0.4, 1.3);
    lengua.visible = false;
    mandibula.add(lengua);
    cabeza.add(mandibula);

    // bigotes
    [-1, 1].forEach((s) => {
      for (let i = 0; i < 3; i++) {
        const g = new T.Group();
        g.position.set(s * 0.22, -0.26 + (i - 1) * 0.075, 0.86);
        g.rotation.z = -s * (i - 1) * 0.22;
        g.rotation.y = -s * 0.42;
        const c = malla(new T.CylinderGeometry(0.0055, 0.0055, 0.85, 6), M.whisk, s * 0.425, 0, 0);
        c.rotation.z = Math.PI / 2;
        g.add(c);
        cabeza.add(g);
      }
    });

    /* ---- accesorios ---- */
    const chullo = new T.Group();
    chullo.position.set(0, 0.04, 0.02);
    {
      const gorro = malla(new T.SphereGeometry(0.95, 36, 18, 0, Math.PI * 2, 0, Math.PI * 0.46), M.chullo, 0, 0, 0, 1.15, 1.0, 1.04);
      chullo.add(gorro);
      chullo.add(malla(esfera(0.13), M.red, 0, 0.98, 0));
      for (let k = 0; k < 8; k++) { const m = malla(new T.CylinderGeometry(0.012, 0.012, 0.16, 6), [M.red, M.yellow, M.orange][k % 3], Math.cos(k) * 0.07, 1.12, Math.sin(k) * 0.07); m.rotation.z = Math.cos(k) * 0.6; m.rotation.x = Math.sin(k) * 0.6; chullo.add(m); }
      [-1, 1].forEach((s) => {
        const o = new T.Group();
        o.position.set(s * 1.02, -0.02, 0.1);
        o.rotation.z = s * 0.1;
        o.add(malla(new T.BoxGeometry(0.2, 0.5, 0.1), M.chullo, 0, -0.2, 0));
        o.add(malla(new T.CylinderGeometry(0.018, 0.018, 0.4, 6), M.red, 0, -0.62, 0.02));
        o.add(malla(esfera(0.06), M.yellow, 0, -0.84, 0.02));
        chullo.add(o);
      });
    }
    chullo.visible = false;
    cabeza.add(chullo);

    const lentes = new T.Group();
    lentes.position.set(0, 0.1, 0.96);
    [-1, 1].forEach((s) => {
      lentes.add(malla(new T.TorusGeometry(0.255, 0.032, 14, 40), M.dark, s * 0.42, 0, 0));
      lentes.add(malla(new T.CircleGeometry(0.25, 32), M.lente, s * 0.42, 0, 0.0));
    });
    const puente = malla(new T.CylinderGeometry(0.02, 0.02, 0.2, 8), M.dark, 0, 0.03, 0);
    puente.rotation.z = Math.PI / 2;
    lentes.add(puente);
    lentes.visible = false;
    cabeza.add(lentes);

    const telescopio = new T.Group();
    telescopio.position.set(1.75, 2.15, 0.5);
    telescopio.rotation.z = 0.9;
    {
      const tubo = malla(new T.CylinderGeometry(0.1, 0.13, 0.95, 16), M.brown);
      telescopio.add(tubo);
      [-0.35, 0.0, 0.34].forEach((y) => telescopio.add(malla(new T.CylinderGeometry(0.135, 0.135, 0.05, 16), M.brass, 0, y, 0)));
      telescopio.add(malla(new T.CylinderGeometry(0.15, 0.1, 0.14, 16), M.brass, 0, 0.52, 0));
      telescopio.add(malla(new T.CircleGeometry(0.095, 20), new T.MeshBasicMaterial({ color: 0xbfe6ff }), 0, 0.592, 0)).rotation.x = -Math.PI / 2;
    }
    telescopio.visible = false;
    scene.add(telescopio);

    // destellos que flotan alrededor (decoración)
    const destellos = [];
    for (let i = 0; i < 9; i++) {
      const m = malla(esfera(0.035 + (i % 3) * 0.012, 8, 6), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
      m.userData = { a: i * 0.7, r: 1.6 + (i % 4) * 0.25, y: 0.4 + (i % 5) * 0.55 };
      scene.add(m);
      destellos.push(m);
    }

    /* ---------- estado de animación ---------- */
    const est = {
      mouthTarget: 0, mouth: 0, mood: "idle", talking: false,
      lookX: 0, lookY: 0, lx: 0, ly: 0,
      blink: 1, nextBlink: 1.5, blinkT: -1,
      jumpY: 0, jumpV: 0, jumping: false,
      tilt: 0, ojoAbierto: 1, orejaArriba: 0, cola: 1,
      saludo: 0, saludoObj: 0, saludaHasta: 0, proximoSaludo: 5, accHat: false
    };

    function onPointer(e) {
      const r = canvas.getBoundingClientRect();
      est.lookX = clamp((e.clientX - (r.left + r.width / 2)) / (window.innerWidth * 0.5), -1, 1);
      est.lookY = clamp((e.clientY - (r.top + r.height * 0.35)) / (window.innerHeight * 0.5), -1, 1);
    }
    window.addEventListener("pointermove", onPointer);

    const api = {
      tipo: "3d", onTap: null, canvas,
      setMouth(v) { est.mouthTarget = clamp(v, 0, 1); },
      setMood(m) { est.mood = m; },
      setTalking(b) { est.talking = !!b; },
      jump() { if (!est.jumping) { est.jumping = true; est.jumpV = 5.2; } },
      wave(ms) { est.saludaHasta = performance.now() + (ms || 2200); },
      setAccessories(a) {
        est.accHat = !!(a && a.hat);
        chullo.visible = est.accHat;
        lentes.visible = !!(a && a.glasses);
        telescopio.visible = !!(a && a.scope);
        orejas.forEach((o) => { o.g.visible = !est.accHat; });
      },
      dispose() {
        cancelAnimationFrame(raf);
        window.removeEventListener("pointermove", onPointer);
        canvas.removeEventListener("click", onClick);
        ro.disconnect();
        renderer.dispose();
        canvas.remove();
      }
    };
    function onClick() { if (api.onTap) api.onTap(); else api.jump(); }
    canvas.addEventListener("click", onClick);

    function resize() {
      const w = Math.max(40, host.clientWidth), h = Math.max(40, host.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const dist = clamp(4.3 / (0.592 * camera.aspect), 8.6, 19);
      camera.position.z = dist;
      camera.updateProjectionMatrix();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    let t = 0, last = performance.now(), raf = 0;
    function tick(now) {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now; t += dt;
      const m = est.mood;

      // parpadeo
      est.nextBlink -= dt;
      if (est.nextBlink <= 0 && est.blinkT < 0) { est.blinkT = 0; est.nextBlink = 2 + Math.random() * 3.5; }
      if (est.blinkT >= 0) {
        est.blinkT += dt;
        const p = est.blinkT / 0.16;
        est.blink = p < 0.5 ? 1 - p * 2 * 0.92 : 0.08 + (p - 0.5) * 2 * 0.92;
        if (p >= 1) { est.blink = 1; est.blinkT = -1; }
      }

      // salto
      if (est.jumping) {
        est.jumpY += est.jumpV * dt; est.jumpV -= 14 * dt;
        if (est.jumpY <= 0) { est.jumpY = 0; est.jumping = false; est.jumpV = 0; }
      }
      gato.position.y = est.jumpY;
      sombra.scale.setScalar(1 - Math.min(0.35, est.jumpY * 0.3));

      // saludo (pata arriba) al estar contento o cada cierto tiempo
      est.proximoSaludo -= dt;
      if (est.proximoSaludo <= 0) { est.saludaHasta = performance.now() + 2200; est.proximoSaludo = 11 + Math.random() * 6; }
      est.saludoObj = (m === "happy" || performance.now() < est.saludaHasta) && m !== "sad" ? 1 : 0;
      est.saludo = lerp(est.saludo, est.saludoObj, dt * 6);

      // ánimo
      est.tilt = lerp(est.tilt, m === "sad" ? 0.2 : m === "think" ? -0.12 : 0, dt * 5);
      est.ojoAbierto = lerp(est.ojoAbierto, m === "sad" ? 0.78 : 1, dt * 8);
      est.orejaArriba = lerp(est.orejaArriba, m === "sad" ? -0.35 : m === "happy" ? 0.12 : 0, dt * 5);
      est.cola = lerp(est.cola, m === "happy" ? 2.2 : m === "sad" ? 0.35 : est.talking ? 1.5 : 1, dt * 4);
      est.lx = lerp(est.lx, m === "think" ? -0.5 : est.lookX, dt * 4);
      est.ly = lerp(est.ly, m === "think" ? -0.7 : m === "sad" ? 0.6 : est.lookY, dt * 4);

      // respiración y cabeza
      torso.scale.y = 1.12 + Math.sin(t * 2) * 0.012;
      const bob = est.talking ? Math.sin(t * 13) * 0.025 : 0;
      cabeza.position.y = 1.55 + Math.sin(t * 2) * 0.014;
      cabeza.rotation.y = lerp(cabeza.rotation.y, est.lx * 0.4, dt * 6);
      cabeza.rotation.x = lerp(cabeza.rotation.x, est.ly * 0.2 + bob, dt * 10);
      cabeza.rotation.z = lerp(cabeza.rotation.z, est.tilt, dt * 6);

      // ojos y guiño
      const guinio = m === "happy";
      ojos.forEach((o) => {
        const cierra = guinio && o.s > 0;
        const k = cierra ? 0.001 : est.blink * est.ojoAbierto;
        o.ojo.scale.y = Math.max(0.001, k);
        o.ojo.visible = !cierra;
        o.arco.visible = cierra;
        o.iris.position.x = est.lx * 0.04;
        o.iris.position.y = -est.ly * 0.035;
      });

      // orejas
      orejas.forEach((o) => {
        const tw = Math.sin(t * 0.7 + (o.s > 0 ? 1.7 : 0)) > 0.985 ? Math.sin(t * 40) * 0.1 : 0;
        o.g.rotation.z = -o.s * (0.28 - est.orejaArriba) + tw;
      });

      // boca
      est.mouth = lerp(est.mouth, est.mouthTarget, Math.min(1, dt * 20));
      mandibula.rotation.x = est.mouth * 0.55;
      bocaOscura.scale.y = 0.04 + est.mouth * 1.35;
      lengua.visible = est.mouth > 0.3;
      colmillos.forEach((c) => { c.visible = est.mouth > 0.22; });
      lineaBoca.visible = est.mouth < 0.14;

      // brazo saludando
      const w = est.saludo;
      brazo.rotation.z = lerp(0.1, -2.45, w) + Math.sin(t * 10) * 0.3 * w;
      brazo.rotation.x = lerp(0, -0.12, w);
      patasDelanteras[0].rotation.z = Math.sin(t * 1.3) * 0.015;

      // cola
      colaSegs.forEach((g, i) => { g.rotation.z = 0.2 + Math.sin(t * 2.2 * est.cola - i * 0.5) * 0.12; });

      // telescopio y destellos
      if (telescopio.visible) { telescopio.position.y = 2.15 + Math.sin(t * 1.6) * 0.1; telescopio.rotation.z = 0.9 + Math.sin(t * 1.1) * 0.06; }
      destellos.forEach((d) => {
        const u = d.userData;
        d.position.set(Math.cos(t * 0.5 + u.a) * u.r, u.y + Math.sin(t * 1.4 + u.a) * 0.15, 0.4 + Math.sin(t * 0.5 + u.a) * 0.9);
        d.material.opacity = 0.35 + 0.55 * Math.abs(Math.sin(t * 2 + u.a * 3));
      });

      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(tick);
    return api;
  }

  /* ======================================================================
   *  GATO 2D (SVG) — plan B automático, mismo estilo
   * ====================================================================== */
  function crearSVG(host) {
    const f = PAL;
    const rosetas = [[112, 262, 11], [150, 292, 9], [186, 258, 12], [124, 318, 8], [176, 322, 9], [96, 296, 7], [206, 296, 8], [150, 252, 7]]
      .map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.68}" fill="rgba(150,112,64,.5)" stroke="${f.spot}" stroke-width="${Math.max(2.5, r * 0.3)}" transform="rotate(${(x * 7) % 90} ${x} ${y})"/>`).join("");
    const html = `
<svg class="cat-svg" viewBox="0 0 340 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Misty, la gata">
  <defs>
    <pattern id="pAndino" width="44" height="44" patternUnits="userSpaceOnUse">
      <rect width="44" height="44" fill="${f.red}"/><rect y="4" width="44" height="6" fill="${f.cream}"/><rect y="12" width="44" height="12" fill="${f.orange}"/>
      <rect y="26" width="44" height="12" fill="${f.yellow}"/><path d="M0 18 L11 10 L22 18 L33 10 L44 18" stroke="${f.teal}" stroke-width="3" fill="none"/>
      <path d="M11 32 l6 -6 l6 6 l-6 6z" fill="${f.teal}"/>
    </pattern>
    <pattern id="pChullo" width="46" height="46" patternUnits="userSpaceOnUse">
      <rect width="46" height="46" fill="${f.red}"/><path d="M0 24 L23 4 L46 24z" fill="${f.orange}"/><rect y="32" width="46" height="8" fill="${f.yellow}"/><circle cx="23" cy="26" r="4" fill="${f.cream}"/>
    </pattern>
    <radialGradient id="gIris" cx=".5" cy=".55" r=".55"><stop offset="0" stop-color="#f0bd55"/><stop offset=".55" stop-color="#cf9024"/><stop offset=".9" stop-color="#7b4a15"/><stop offset="1" stop-color="#2a170a"/></radialGradient>
    <linearGradient id="gPelaje" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${f.furDark}"/><stop offset=".5" stop-color="${f.fur}"/><stop offset="1" stop-color="${f.furLight}"/></linearGradient>
    <radialGradient id="gSombra"><stop offset="0" stop-color="rgba(40,60,110,.35)"/><stop offset="1" stop-color="rgba(40,60,110,0)"/></radialGradient>
  </defs>
  <ellipse cx="170" cy="382" rx="120" ry="16" fill="url(#gSombra)"/>
  <g id="mTail" style="transform-origin:236px 330px">
    <path d="M232 332 C 300 336, 322 262, 292 214 C 280 196, 266 192, 258 200" stroke="${f.fur}" stroke-width="30" fill="none" stroke-linecap="round"/>
    <path d="M232 332 C 300 336, 322 262, 292 214 C 280 196, 266 192, 258 200" stroke="${f.spot}" stroke-width="30" fill="none" stroke-dasharray="14 26" stroke-dashoffset="-6"/>
    <path d="M296 226 C 284 196, 266 192, 258 200" stroke="${f.spot}" stroke-width="31" fill="none" stroke-linecap="round"/>
  </g>
  <g id="mBody" style="transform-origin:170px 380px">
    <ellipse cx="170" cy="294" rx="86" ry="92" fill="url(#gPelaje)"/>
    <g transform="translate(20 0)">${rosetas}</g>
    <ellipse cx="170" cy="300" rx="44" ry="66" fill="${f.cream}"/>
    <ellipse cx="108" cy="338" rx="42" ry="40" fill="${f.fur}"/><ellipse cx="232" cy="338" rx="42" ry="40" fill="${f.fur}"/>
    <circle cx="100" cy="332" r="9" fill="none" stroke="${f.spot}" stroke-width="3"/><circle cx="240" cy="330" r="9" fill="none" stroke="${f.spot}" stroke-width="3"/>
    <rect x="212" y="236" width="22" height="64" rx="6" fill="#7a4a26" transform="rotate(14 223 268)"/><rect x="214" y="236" width="18" height="22" rx="5" fill="#5c3519" transform="rotate(14 223 268)"/>
    <rect x="198" y="246" width="12" height="92" rx="3" fill="#7a4a26" transform="rotate(-12 204 292)"/><circle cx="200" cy="270" r="4.5" fill="${f.brass}"/>
    <rect x="136" y="246" width="12" height="92" rx="3" fill="#7a4a26" transform="rotate(12 142 292)"/>
    <rect x="198" y="296" width="30" height="62" rx="15" fill="${f.fur}"/>
    <ellipse cx="213" cy="368" rx="24" ry="13" fill="${f.cream}"/>
    <path d="M205 366 v8 M213 364 v10 M221 366 v8" stroke="${f.spot}" stroke-width="2" stroke-linecap="round"/>
    <ellipse cx="128" cy="376" rx="26" ry="12" fill="${f.cream}"/>
    <g id="mScarf">
      <path d="M96 224 Q170 258 244 224 L244 252 Q170 290 96 252Z" fill="url(#pAndino)" stroke="rgba(90,30,20,.35)" stroke-width="1.5"/>
      <path d="M176 246 L206 244 L210 306 L180 310Z" fill="url(#pAndino)" stroke="rgba(90,30,20,.35)" stroke-width="1.5"/>
      <path d="M144 250 L172 250 L172 296 L148 300Z" fill="url(#pAndino)" stroke="rgba(90,30,20,.35)" stroke-width="1.5"/>
      <path d="M182 310 v12 M190 310 v12 M198 310 v12 M206 308 v12 M150 300 v12 M158 299 v12 M166 298 v12" stroke="${f.orange}" stroke-width="3" stroke-linecap="round"/>
    </g>
  </g>
  <g id="mArm" style="transform-origin:112px 262px">
    <rect x="96" y="262" width="34" height="86" rx="17" fill="${f.fur}"/>
    <circle cx="106" cy="290" r="6" fill="none" stroke="${f.spot}" stroke-width="2.5"/><circle cx="120" cy="318" r="5" fill="${f.spot}"/>
    <g id="mPata"><ellipse cx="113" cy="352" rx="26" ry="29" fill="${f.fur}"/>
      <ellipse cx="113" cy="358" rx="13" ry="11" fill="${f.pad}"/>
      <ellipse cx="94" cy="340" rx="6" ry="7.5" fill="${f.pad}"/><ellipse cx="106" cy="331" rx="6" ry="7.5" fill="${f.pad}"/><ellipse cx="120" cy="331" rx="6" ry="7.5" fill="${f.pad}"/><ellipse cx="132" cy="340" rx="6" ry="7.5" fill="${f.pad}"/></g>
  </g>
  <g id="mHead" style="transform-origin:170px 200px">
    <g id="mEarL"><polygon points="82,128 92,30 152,86" fill="${f.fur}"/><polygon points="92,118 98,56 138,92" fill="${f.pink}"/><polygon points="92,30 99 56 120 66" fill="${f.spot}"/><path d="M112 98 q4 -14 12 -22 M122 100 q4 -12 12 -18 M132 100 q2 -10 8 -16" stroke="${f.cream}" stroke-width="5" stroke-linecap="round" fill="none"/></g>
    <g id="mEarR"><polygon points="258,128 248,30 188,86" fill="${f.fur}"/><polygon points="248,118 242,56 202,92" fill="${f.pink}"/><polygon points="248,30 241 56 220 66" fill="${f.spot}"/><path d="M228 98 q-4 -14 -12 -22 M218 100 q-4 -12 -12 -18 M208 100 q-2 -10 -8 -16" stroke="${f.cream}" stroke-width="5" stroke-linecap="round" fill="none"/></g>
    <ellipse cx="170" cy="178" rx="108" ry="90" fill="url(#gPelaje)"/>
    <path d="M62 190 l-22 8 l24 4z M64 206 l-24 12 l28 -2z M72 222 l-20 16 l28 -8z M278 190 l22 8 l-24 4z M276 206 l24 12 l-28 -2z M268 222 l20 16 l-28 -8z" fill="${f.cream}"/>
    <g stroke="${f.spot}" stroke-linecap="round" fill="none"><path d="M170 92 v32" stroke-width="7"/><path d="M148 96 q-3 18 0 32 M192 96 q3 18 0 32" stroke-width="6"/><path d="M128 104 q-4 14 -2 28 M212 104 q4 14 2 28" stroke-width="5"/><path d="M106 118 q-4 12 -2 22 M234 118 q4 12 2 22" stroke-width="4.5"/>
      <path d="M86 188 q20 2 42 8 M254 188 q-20 2 -42 8 M84 206 q20 4 40 12 M256 206 q-20 4 -40 12" stroke-width="4"/></g>
    <ellipse cx="148" cy="214" rx="38" ry="28" fill="${f.cream}"/><ellipse cx="192" cy="214" rx="38" ry="28" fill="${f.cream}"/>
    <g id="mEyeL" style="transform-origin:128px 174px"><ellipse cx="128" cy="174" rx="25" ry="28" fill="#2a170a"/><g class="pupila"><ellipse cx="128" cy="175" rx="22" ry="25" fill="url(#gIris)"/><ellipse cx="128" cy="177" rx="8.5" ry="14" fill="#120a06"/><ellipse cx="119" cy="165" rx="6" ry="7" fill="#fff"/><circle cx="137" cy="187" r="3" fill="#fff"/></g></g>
    <g id="mEyeR" style="transform-origin:212px 174px"><ellipse cx="212" cy="174" rx="25" ry="28" fill="#2a170a"/><g class="pupila"><ellipse cx="212" cy="175" rx="22" ry="25" fill="url(#gIris)"/><ellipse cx="212" cy="177" rx="8.5" ry="14" fill="#120a06"/><ellipse cx="203" cy="165" rx="6" ry="7" fill="#fff"/><circle cx="221" cy="187" r="3" fill="#fff"/></g></g>
    <path id="mGuinio" d="M188 178 Q212 156 236 178" stroke="${f.spot}" stroke-width="6" fill="none" stroke-linecap="round" style="display:none"/>
    <path d="M158 204 q12 -9 24 0 q-12 14 -24 0z" fill="${f.nose}"/>
    <path id="mBocaCerrada" d="M170 212 v9 M170 221 q-14 14 -30 2 M170 221 q14 14 30 2" stroke="${f.spot}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <g id="mBocaAbierta" style="transform-origin:170px 222px;transform:scale(1,0)"><path d="M146 222 Q170 214 194 222 Q190 262 170 264 Q150 262 146 222Z" fill="${f.mouth}"/><ellipse cx="170" cy="252" rx="13" ry="9" fill="${f.tongue}"/><path d="M152 223 l5 9 l5 -9z M178 223 l5 9 l5 -9z" fill="#fff"/></g>
    <g stroke="#fffaf0" stroke-width="2.3" stroke-linecap="round" fill="none"><path d="M124 216 L62 206 M124 224 L58 230 M128 232 L70 252"/><path d="M216 216 L278 206 M216 224 L282 230 M212 232 L270 252"/></g>
    <g id="mGlasses" style="display:none" fill="rgba(158,208,255,.25)" stroke="#2b2540" stroke-width="5"><circle cx="128" cy="174" r="33"/><circle cx="212" cy="174" r="33"/><path d="M160 172 h20" fill="none"/></g>
    <g id="mHat" style="display:none"><path d="M60 150 Q60 36 170 32 Q280 36 280 150 Q170 130 60 150Z" fill="url(#pChullo)"/><circle cx="170" cy="30" r="13" fill="${f.red}"/><path d="M62 150 l-4 56 q6 14 20 4 l6 -52z M278 150 l4 56 q-6 14 -20 4 l-6 -52z" fill="url(#pChullo)"/><circle cx="68" cy="218" r="7" fill="${f.yellow}"/><circle cx="272" cy="218" r="7" fill="${f.yellow}"/></g>
  </g>
  <g id="mTele" style="display:none;transform-origin:300px 90px"><g transform="rotate(-42 300 90)"><rect x="268" y="80" width="64" height="20" rx="6" fill="#7a4a26"/><rect x="280" y="76" width="7" height="28" rx="2" fill="${f.brass}"/><rect x="306" y="76" width="7" height="28" rx="2" fill="${f.brass}"/><rect x="326" y="73" width="12" height="34" rx="3" fill="${f.brass}"/></g></g>
</svg>`;
    host.insertAdjacentHTML("beforeend", html);
    const svg = host.querySelector(".cat-svg");
    const $ = (id) => svg.querySelector("#" + id);
    const E = { tail: $("mTail"), body: $("mBody"), head: $("mHead"), arm: $("mArm"), eyeL: $("mEyeL"), eyeR: $("mEyeR"), guinio: $("mGuinio"),
      cerrada: $("mBocaCerrada"), abierta: $("mBocaAbierta"), glasses: $("mGlasses"), hat: $("mHat"), tele: $("mTele"), earL: $("mEarL"), earR: $("mEarR") };
    const pupilas = svg.querySelectorAll(".pupila");

    const est = { mouthTarget: 0, mouth: 0, mood: "idle", talking: false, blink: 1, nextBlink: 1.5, blinkT: -1,
      jumpY: 0, jumpV: 0, jumping: false, lookX: 0, lookY: 0, lx: 0, ly: 0, ojo: 1, tilt: 0, cola: 1,
      saludo: 0, saludaHasta: 0, proximoSaludo: 5, hat: false };

    function onPointer(e) {
      const r = svg.getBoundingClientRect();
      est.lookX = clamp((e.clientX - (r.left + r.width / 2)) / (window.innerWidth * 0.5), -1, 1);
      est.lookY = clamp((e.clientY - (r.top + r.height * 0.35)) / (window.innerHeight * 0.5), -1, 1);
    }
    window.addEventListener("pointermove", onPointer);

    const api = {
      tipo: "2d", onTap: null,
      setMouth(v) { est.mouthTarget = clamp(v, 0, 1); },
      setMood(m) { est.mood = m; },
      setTalking(b) { est.talking = !!b; },
      jump() { if (!est.jumping) { est.jumping = true; est.jumpV = 380; } },
      wave(ms) { est.saludaHasta = performance.now() + (ms || 2200); },
      setAccessories(a) {
        est.hat = !!(a && a.hat);
        E.hat.style.display = est.hat ? "" : "none";
        E.glasses.style.display = a && a.glasses ? "" : "none";
        E.tele.style.display = a && a.scope ? "" : "none";
        E.earL.style.display = E.earR.style.display = est.hat ? "none" : "";
      },
      dispose() { cancelAnimationFrame(raf); window.removeEventListener("pointermove", onPointer); svg.remove(); }
    };
    svg.addEventListener("click", () => { if (api.onTap) api.onTap(); else api.jump(); });

    let t = 0, last = performance.now(), raf = 0;
    function tick(now) {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now; t += dt;
      const m = est.mood;

      est.nextBlink -= dt;
      if (est.nextBlink <= 0 && est.blinkT < 0) { est.blinkT = 0; est.nextBlink = 2 + Math.random() * 3.5; }
      if (est.blinkT >= 0) {
        est.blinkT += dt;
        const p = est.blinkT / 0.16;
        est.blink = p < 0.5 ? 1 - p * 2 * 0.92 : 0.08 + (p - 0.5) * 2 * 0.92;
        if (p >= 1) { est.blink = 1; est.blinkT = -1; }
      }
      if (est.jumping) {
        est.jumpY += est.jumpV * dt; est.jumpV -= 1000 * dt;
        if (est.jumpY <= 0) { est.jumpY = 0; est.jumping = false; est.jumpV = 0; }
      }

      est.proximoSaludo -= dt;
      if (est.proximoSaludo <= 0) { est.saludaHasta = performance.now() + 2200; est.proximoSaludo = 11 + Math.random() * 6; }
      est.saludo = lerp(est.saludo, (m === "happy" || performance.now() < est.saludaHasta) && m !== "sad" ? 1 : 0, dt * 6);

      est.tilt = lerp(est.tilt, m === "sad" ? 7 : m === "think" ? -5 : 0, dt * 5);
      est.ojo = lerp(est.ojo, m === "sad" ? 0.78 : 1, dt * 8);
      est.cola = lerp(est.cola, m === "happy" ? 2.2 : m === "sad" ? 0.35 : est.talking ? 1.5 : 1, dt * 4);
      est.lx = lerp(est.lx, m === "think" ? -0.6 : est.lookX, dt * 4);
      est.ly = lerp(est.ly, m === "think" ? -0.8 : m === "sad" ? 0.6 : est.lookY, dt * 4);

      const respira = 1 + Math.sin(t * 2) * 0.008;
      E.body.style.transform = `translateY(${-est.jumpY}px) scale(1,${respira})`;
      const bob = est.talking ? Math.sin(t * 13) * 1.8 : 0;
      E.head.style.transform = `translate(${est.lx * 4}px, ${-est.jumpY + bob}px) rotate(${est.tilt + est.lx * 2}deg)`;
      E.tail.style.transform = `translateY(${-est.jumpY}px) rotate(${Math.sin(t * 2.2 * est.cola) * 8}deg)`;
      E.arm.style.transform = `translateY(${-est.jumpY}px) rotate(${est.saludo * (150 + Math.sin(t * 10) * 14)}deg)`;

      const guinio = m === "happy";
      const sy = Math.max(0.001, est.blink * est.ojo);
      E.eyeL.style.transform = `scaleY(${sy})`;
      E.eyeR.style.transform = guinio ? "scaleY(0.001)" : `scaleY(${sy})`;
      E.guinio.style.display = guinio ? "" : "none";
      pupilas.forEach((p) => { p.style.transform = `translate(${est.lx * 5}px, ${est.ly * 4}px)`; });

      est.mouth = lerp(est.mouth, est.mouthTarget, Math.min(1, dt * 20));
      E.abierta.style.transform = `scale(1,${est.mouth.toFixed(3)})`;
      E.cerrada.style.opacity = est.mouth < 0.12 ? 1 : 0;
    }
    raf = requestAnimationFrame(tick);
    return api;
  }

  function crear(host, opts) {
    const prefer3d = !opts || opts.prefer3d !== false;
    if (prefer3d) {
      try { return crear3D(host); }
      catch (e) { console.warn("[Misty] 3D no disponible, uso gato 2D:", e.message); host.querySelectorAll("canvas").forEach((c) => c.remove()); }
    }
    return crearSVG(host);
  }

  return { crear, crear3D, crearSVG };
})();
