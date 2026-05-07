// embryo-canvas.js
// Procedurally rendered translucent IVF cells + swimming sperm.
// Pure 2D canvas — no SVG, no images. Devicepixel-aware, reduced-motion aware.
(function () {
  const canvas = document.getElementById('embryoCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth = window.innerWidth;
    H = canvas.clientHeight = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  // ─────────── pointer (lens influence)
  const pointer = { x: W / 2, y: H / 2, active: false };
  window.addEventListener('pointermove', e => {
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true;
  }, { passive: true });

  // ─────────── seeded rng
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  const rand = rng(7);

  // ─────────── embryos: layered translucent spheres with internal nucleus and bubbles
  const embryos = [];
  const N_EMB = window.innerWidth < 720 ? 2 : 4;
  for (let i = 0; i < N_EMB; i++) {
    const r = 140 + rand() * 220;
    embryos.push({
      x: rand() * W,
      y: rand() * H,
      vx: (rand() - 0.5) * 0.08,
      vy: (rand() - 0.5) * 0.08,
      r,
      hue: 200 + rand() * 30,         // soft cyan-blue band
      // inner sub-cells (cleavage stage embryo look)
      cells: Array.from({ length: 4 + Math.floor(rand() * 4) }, () => ({
        ox: (rand() - 0.5) * 0.55,
        oy: (rand() - 0.5) * 0.55,
        rr: 0.18 + rand() * 0.18,
        phase: rand() * Math.PI * 2,
      })),
      // surface specks / bubbles
      specks: Array.from({ length: 18 + Math.floor(rand() * 14) }, () => ({
        a: rand() * Math.PI * 2,
        d: 0.55 + rand() * 0.42,
        s: 1 + rand() * 3,
        phase: rand() * Math.PI * 2,
      })),
      rot: rand() * Math.PI * 2,
      rotV: (rand() - 0.5) * 0.0015,
      depth: 0.35 + rand() * 0.65,    // affects parallax + opacity
    });
  }

  // ─────────── sperm: head + animated tail (sine wave)
  const sperm = [];
  const N_SP = window.innerWidth < 720 ? 6 : 14;
  for (let i = 0; i < N_SP; i++) {
    sperm.push({
      x: rand() * W,
      y: rand() * H,
      ang: rand() * Math.PI * 2,
      angT: rand() * Math.PI * 2,     // target heading
      v: 0.25 + rand() * 0.5,
      tailLen: 38 + rand() * 30,
      tailFreq: 0.18 + rand() * 0.12,
      tailAmp: 5 + rand() * 4,
      phase: rand() * Math.PI * 2,
      depth: 0.4 + rand() * 0.6,
    });
  }

  // ─────────── floating micro-bubbles (background ambience)
  const bubbles = [];
  for (let i = 0; i < 60; i++) {
    bubbles.push({
      x: rand() * W,
      y: rand() * H,
      r: 1.5 + rand() * 4,
      vy: -0.05 - rand() * 0.12,
      drift: rand() * Math.PI * 2,
      driftV: 0.002 + rand() * 0.004,
      depth: 0.3 + rand() * 0.7,
    });
  }

  function drawEmbryo(e, t) {
    const px = (pointer.x - W / 2) * 0.012 * e.depth;
    const py = (pointer.y - H / 2) * 0.012 * e.depth;
    const cx = e.x + px;
    const cy = e.y + py;
    const r = e.r;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(e.rot);

    // outer halo
    const halo = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 1.45);
    halo.addColorStop(0, `hsla(${e.hue}, 80%, 90%, 0.10)`);
    halo.addColorStop(1, `hsla(${e.hue}, 80%, 90%, 0)`);
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.45, 0, Math.PI * 2); ctx.fill();

    // glassy body — main translucent sphere
    const body = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.05, 0, 0, r);
    body.addColorStop(0,    `hsla(${e.hue}, 90%, 98%, ${0.55 * e.depth})`);
    body.addColorStop(0.35, `hsla(${e.hue}, 75%, 88%, ${0.30 * e.depth})`);
    body.addColorStop(0.75, `hsla(${e.hue + 8}, 65%, 70%, ${0.18 * e.depth})`);
    body.addColorStop(1,    `hsla(${e.hue + 14}, 55%, 55%, 0)`);
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();

    // inner ring (zona pellucida glow)
    ctx.strokeStyle = `hsla(${e.hue}, 60%, 75%, ${0.25 * e.depth})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2); ctx.stroke();

    // inner cells (blastomeres)
    ctx.globalCompositeOperation = 'source-over';
    for (const c of e.cells) {
      const cr = r * c.rr;
      const cxC = c.ox * r + Math.sin(t * 0.0006 + c.phase) * r * 0.04;
      const cyC = c.oy * r + Math.cos(t * 0.0006 + c.phase) * r * 0.04;
      const cg = ctx.createRadialGradient(cxC - cr * 0.3, cyC - cr * 0.4, cr * 0.05, cxC, cyC, cr);
      cg.addColorStop(0,    `hsla(${e.hue - 5}, 85%, 96%, ${0.55 * e.depth})`);
      cg.addColorStop(0.55, `hsla(${e.hue}, 65%, 80%, ${0.28 * e.depth})`);
      cg.addColorStop(1,    `hsla(${e.hue + 10}, 60%, 65%, 0)`);
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.arc(cxC, cyC, cr, 0, Math.PI * 2); ctx.fill();
    }

    // surface bubbles / specks
    for (const sp of e.specks) {
      const a = sp.a + e.rot * 0.5;
      const d = sp.d * r;
      const sx = Math.cos(a) * d;
      const sy = Math.sin(a) * d;
      const ss = sp.s * (0.85 + 0.15 * Math.sin(t * 0.002 + sp.phase));
      ctx.fillStyle = `hsla(${e.hue}, 80%, 96%, ${0.55 * e.depth})`;
      ctx.beginPath(); ctx.arc(sx, sy, ss, 0, Math.PI * 2); ctx.fill();
    }

    // top-left specular highlight
    ctx.globalCompositeOperation = 'screen';
    const spec = ctx.createRadialGradient(-r * 0.45, -r * 0.5, r * 0.02, -r * 0.45, -r * 0.5, r * 0.45);
    spec.addColorStop(0, `hsla(0, 0%, 100%, ${0.55 * e.depth})`);
    spec.addColorStop(1, 'hsla(0, 0%, 100%, 0)');
    ctx.fillStyle = spec;
    ctx.beginPath(); ctx.arc(-r * 0.45, -r * 0.5, r * 0.45, 0, Math.PI * 2); ctx.fill();

    // bottom-right rim light
    const rim = ctx.createRadialGradient(r * 0.55, r * 0.55, r * 0.02, r * 0.55, r * 0.55, r * 0.55);
    rim.addColorStop(0, `hsla(${e.hue}, 90%, 96%, ${0.30 * e.depth})`);
    rim.addColorStop(1, 'hsla(0, 0%, 100%, 0)');
    ctx.fillStyle = rim;
    ctx.beginPath(); ctx.arc(r * 0.55, r * 0.55, r * 0.55, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  }

  function drawSperm(s, t) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.ang);

    const hr = 4 + s.depth * 2;
    const headAttach = -hr * 1.35;
    const tipX = headAttach - s.tailLen;

    // Build tail points ONCE — all strokes & mid-piece reuse the same path
    // so the silhouette is single-bodied, no doubling.
    const seg = 36;
    const pts = new Array(seg + 1);
    for (let i = 0; i <= seg; i++) {
      const u = i / seg;
      const tx = headAttach + (tipX - headAttach) * u;
      // amplitude: tiny near head, growing toward tip (whip-like)
      const env = u * u * (1.1 - u * 0.15);
      // traveling wave from head to tip
      const ty = Math.sin(u * 7.0 - t * 0.014 - s.phase) * s.tailAmp * env;
      pts[i] = [tx, ty];
    }

    // single shared path
    const tracePath = () => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i <= seg; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    };

    // soft halo
    tracePath();
    ctx.strokeStyle = `hsla(210, 55%, 60%, ${0.05 * s.depth})`;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // tapered body — draw segment-by-segment so width thins toward tip
    for (let i = 0; i < seg; i++) {
      const u = i / seg;
      // thicker near head, thinner toward tip
      const w = 1.4 * (1 - u * 0.85) + 0.25;
      const alpha = (0.16 - u * 0.10) * s.depth;
      ctx.beginPath();
      ctx.moveTo(pts[i][0], pts[i][1]);
      ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
      ctx.strokeStyle = `hsla(210, 65%, 50%, ${alpha})`;
      ctx.lineWidth = w;
      ctx.stroke();
    }

    // counter-rotation of head against tail beat at attachment
    const wobble = Math.sin(-t * 0.014 - s.phase) * 0.10;
    ctx.rotate(wobble);

    const hg = ctx.createRadialGradient(-hr * 0.3, -hr * 0.4, 0.5, 0, 0, hr * 1.4);
    hg.addColorStop(0,    `hsla(210, 90%, 95%, ${0.40 * s.depth})`);
    hg.addColorStop(0.5,  `hsla(210, 70%, 75%, ${0.20 * s.depth})`);
    hg.addColorStop(1,    'hsla(210, 60%, 60%, 0)');
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.ellipse(0, 0, hr * 1.5, hr, 0, 0, Math.PI * 2);
    ctx.fill();

    // tiny specular dot
    ctx.fillStyle = `hsla(0, 0%, 100%, ${0.30 * s.depth})`;
    ctx.beginPath();
    ctx.ellipse(-hr * 0.5, -hr * 0.4, hr * 0.32, hr * 0.20, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawBubble(b, t) {
    const dx = Math.sin(t * b.driftV + b.drift) * 8;
    const x = b.x + dx;
    const y = b.y;
    const g = ctx.createRadialGradient(x - b.r * 0.3, y - b.r * 0.4, 0, x, y, b.r);
    g.addColorStop(0,    `hsla(210, 90%, 95%, ${0.55 * b.depth})`);
    g.addColorStop(0.7,  `hsla(210, 70%, 80%, ${0.18 * b.depth})`);
    g.addColorStop(1,    'hsla(210, 60%, 60%, 0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, b.r, 0, Math.PI * 2); ctx.fill();

    // tiny highlight dot
    ctx.fillStyle = `hsla(0, 0%, 100%, ${0.7 * b.depth})`;
    ctx.beginPath(); ctx.arc(x - b.r * 0.4, y - b.r * 0.5, b.r * 0.18, 0, Math.PI * 2); ctx.fill();
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(now - last, 50);
    last = now;
    ctx.clearRect(0, 0, W, H);

    // depth-sort painters: bubbles → embryos (back ones first) → sperm
    // sort embryos by depth ascending (deeper = behind)
    embryos.sort((a, b) => a.depth - b.depth);

    // bubbles
    for (const b of bubbles) {
      b.y += b.vy * dt;
      if (b.y < -10) { b.y = H + 10; b.x = rand() * W; }
      drawBubble(b, now);
    }

    // embryos drift + draw
    for (const e of embryos) {
      e.x += e.vx * dt; e.y += e.vy * dt; e.rot += e.rotV * dt;
      // wrap softly
      if (e.x < -e.r * 1.5) e.x = W + e.r;
      if (e.x > W + e.r * 1.5) e.x = -e.r;
      if (e.y < -e.r * 1.5) e.y = H + e.r;
      if (e.y > H + e.r * 1.5) e.y = -e.r;
      drawEmbryo(e, now);
    }

    // sperm drift + draw — gentle steering, slight attraction to nearest embryo
    for (const s of sperm) {
      // periodically retarget heading
      if (Math.random() < 0.005) s.angT = Math.random() * Math.PI * 2;
      // turn toward target
      let da = s.angT - s.ang;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      s.ang += da * 0.01;
      // motion includes wiggle
      const wob = Math.sin(now * 0.006 + s.phase) * 0.4;
      s.x += Math.cos(s.ang + wob * 0.1) * s.v;
      s.y += Math.sin(s.ang + wob * 0.1) * s.v;
      // wrap
      if (s.x < -50) s.x = W + 50;
      if (s.x > W + 50) s.x = -50;
      if (s.y < -50) s.y = H + 50;
      if (s.y > H + 50) s.y = -50;

      drawSperm(s, now);
    }

    if (!reduce) requestAnimationFrame(frame);
  }

  // initial paint, then loop
  if (reduce) {
    frame(performance.now());
  } else {
    requestAnimationFrame(frame);
  }
})();
