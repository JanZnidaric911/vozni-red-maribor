/* =====================================================================
   3D prikaz poti — lasten izris na <canvas> (brez knjižnic, deluje brez interneta)
   Route3D.mount(container, scene) -> { destroy() }
   scene = {
     legs: [{ color, line, pts: [{ x, y, name, t, end, transfer }] }],   // x, y v km
     ctx:  { outline: [[x,y]], river: [[x,y]], forest: [[x,y]], stations: [[x,y]] },
     reduceMotion: bool
   }
   ===================================================================== */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const pad = n => String(n).padStart(2, '0');
  const fmt = m => { m = Math.round(m); return pad(Math.floor(m / 60) % 24) + ':' + pad(((m % 60) + 60) % 60); };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function hexRgb(hex) {
    let h = String(hex || '#E5243F').replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16) || 0;
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const lighten = (c, k) => c.map(v => Math.round(v + (255 - v) * k));

  const ICON = {
    orbit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v5h-5"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>',
    reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="5"/></svg>',
  };

  function mount(container, scene) {
    container.innerHTML = `<canvas aria-label="3D prikaz poti avtobusa"></canvas>
      <div class="r3d-hud"><div class="r3d-clock"><b>--:--</b><span>&nbsp;</span></div>
        <div class="r3d-btns">
          <button type="button" data-r="play" aria-label="Predvajaj / ustavi vožnjo"></button>
          <button type="button" data-r="orbit" aria-label="Samodejno vrtenje">${ICON.orbit}</button>
          <button type="button" data-r="reset" aria-label="Ponastavi pogled">${ICON.reset}</button>
        </div></div>
      <div class="r3d-tip">Povleci za vrtenje · razširi s prsti za povečavo · tapni postajo</div>
      <div class="r3d-progress"><i></i></div>`;
    const canvas = container.querySelector('canvas');
    const g = canvas.getContext('2d');
    const clockB = container.querySelector('.r3d-clock b'), clockS = container.querySelector('.r3d-clock span');
    const btnPlay = container.querySelector('[data-r=play]'), btnOrbit = container.querySelector('[data-r=orbit]');
    const tip = container.querySelector('.r3d-tip'), bar = container.querySelector('.r3d-progress i');
    const fs = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fs')) || 1;
    const FONT = 'Plus Jakarta Sans, system-ui, sans-serif';

    /* ---------- pot ---------- */
    const stops = [];       // vse točke poti (z vozlišči prestopov)
    const segs = [];        // odseki med zaporednimi točkami (znotraj iste vožnje)
    scene.legs.forEach((leg, li) => {
      const col = hexRgb(leg.color), lite = lighten(col, .35);
      leg.pts.forEach((p, pi) => {
        stops.push({ x: p.x, y: p.y, name: p.name, t: p.t, end: p.end, transfer: p.transfer, via: !!p.via, col, lite, leg: li });
        if (pi > 0) segs.push({ a: stops[stops.length - 2], b: stops[stops.length - 1], col, lite, leg: li });
      });
    });
    // razdalja vzdolž poti (prestopi = skok brez dolžine)
    let total = 0;
    const along = [];       // { s0, s1, seg }
    segs.forEach(sg => { const d = Math.hypot(sg.b.x - sg.a.x, sg.b.y - sg.a.y); along.push({ s0: total, s1: total + d, seg: sg }); total += d; });
    total = total || 1;

    const xs = stops.map(p => p.x), ys = stops.map(p => p.y);
    const bx0 = Math.min(...xs), bx1 = Math.max(...xs), by0 = Math.min(...ys), by1 = Math.max(...ys);
    const ext = Math.max(bx1 - bx0, by1 - by0, .6);
    const target = [(bx0 + bx1) / 2, (by0 + by1) / 2, 0];
    const HGT = clamp(ext * .1, .08, .45);           // višina "traku" poti
    const BUS = HGT * .9;
    const cam = { yaw: -.55, pitch: .72, dist: ext * 1.35 + .9 };
    const home = { ...cam };
    const minD = ext * .35 + .25, maxD = ext * 4 + 4;

    const step = [.1, .25, .5, 1, 2][[.6, 1.5, 3, 6, 1e9].findIndex(v => ext <= v)];
    const gr = Math.ceil((ext * 1.8 + 1.5) / step) * step;

    let W = 0, H = 0, dpr = 1, F = 1, basis = null;
    let auto = !scene.reduceMotion, playing = !scene.reduceMotion;
    let s = 0, pauseT = 0, last = performance.now(), raf = 0, selected = -1, selT = 0, alive = true, interacted = false;
    const SPEED = total / 13;                          // celotna pot v ~13 s

    function resize() {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      F = H / (2 * Math.tan(25 * Math.PI / 180));
    }
    const ro = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(canvas); else window.addEventListener('resize', resize);
    resize();

    /* ---------- kamera ---------- */
    function setBasis() {
      const cp = Math.cos(cam.pitch);
      const eye = [target[0] + cam.dist * cp * Math.sin(cam.yaw), target[1] - cam.dist * cp * Math.cos(cam.yaw), target[2] + cam.dist * Math.sin(cam.pitch)];
      const f = norm(sub(target, eye)), r = norm(cross(f, [0, 0, 1])), u = cross(r, f);
      basis = { eye, f, r, u };
    }
    const toCam = p => { const v = sub(p, basis.eye); return [dot(v, basis.r), dot(v, basis.u), dot(v, basis.f)]; };
    const NEAR = .05;
    const scr = c => [W / 2 + F * c[0] / c[2], H * .54 - F * c[1] / c[2]];
    const P = (x, y, z) => { const c = toCam([x, y, z || 0]); return c[2] > NEAR ? { p: scr(c), z: c[2] } : null; };
    function clipSeg(a, b) {
      if (a[2] < NEAR && b[2] < NEAR) return null;
      if (a[2] < NEAR) { const t = (NEAR - a[2]) / (b[2] - a[2]); a = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]; }
      if (b[2] < NEAR) { const t = (NEAR - b[2]) / (a[2] - b[2]); b = [b[0] + (a[0] - b[0]) * t, b[1] + (a[1] - b[1]) * t, NEAR]; }
      return [scr(a), scr(b)];
    }
    function clipPoly(cs) {
      const out = [];
      for (let i = 0; i < cs.length; i++) {
        const a = cs[i], b = cs[(i + 1) % cs.length], ai = a[2] >= NEAR, bi = b[2] >= NEAR;
        if (ai) out.push(a);
        if (ai !== bi) { const t = (NEAR - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]); }
      }
      return out.map(scr);
    }
    function pathPoly(list, close) {
      if (!list || list.length < 2) return false;
      g.beginPath();
      list.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]));
      if (close) g.closePath();
      return true;
    }
    function polyline(world, z, stroke, width) {
      g.strokeStyle = stroke; g.lineWidth = width; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath();
      let prev = null, open = false;
      world.forEach(([x, y]) => {
        const c = toCam([x, y, z]);
        if (prev) {
          const sg = clipSeg(prev, c);
          if (sg) { if (!open || prev[2] < NEAR) g.moveTo(sg[0][0], sg[0][1]); g.lineTo(sg[1][0], sg[1][1]); open = c[2] >= NEAR; } else open = false;
        }
        prev = c;
      });
      g.stroke();
    }

    /* ---------- položaj avtobusa ---------- */
    function busAt(sv) {
      const k = along.find(a => sv <= a.s1) || along[along.length - 1];
      if (!k) return { x: stops[0].x, y: stops[0].y, dir: [1, 0], t: stops[0].t, seg: null, u: 0 };
      const len = k.s1 - k.s0 || 1, u = clamp((sv - k.s0) / len, 0, 1), sg = k.seg;
      const dx = sg.b.x - sg.a.x, dy = sg.b.y - sg.a.y, l = Math.hypot(dx, dy) || 1;
      return { x: sg.a.x + dx * u, y: sg.a.y + dy * u, dir: [dx / l, dy / l], t: sg.a.t + (sg.b.t - sg.a.t) * u, seg: sg, u };
    }

    function label(x, y, text, opt) {
      g.font = `${opt.weight || 700} ${Math.round((opt.size || 12) * fs)}px ${FONT}`;
      const w = g.measureText(text).width + 14, h = Math.round((opt.size || 12) * fs) + 10;
      let lx = x - w / 2, ly = y - h - (opt.lift || 10);
      lx = clamp(lx, 4, W - w - 4);
      g.fillStyle = opt.bg || 'rgba(15,4,7,.82)';
      g.beginPath();
      const r = h / 2;
      g.moveTo(lx + r, ly); g.arcTo(lx + w, ly, lx + w, ly + h, r); g.arcTo(lx + w, ly + h, lx, ly + h, r); g.arcTo(lx, ly + h, lx, ly, r); g.arcTo(lx, ly, lx + w, ly, r);
      g.fill();
      if (opt.ring) { g.strokeStyle = opt.ring; g.lineWidth = 1.5; g.stroke(); }
      g.fillStyle = opt.fg || '#fff'; g.textBaseline = 'middle'; g.textAlign = 'left';
      g.fillText(text, lx + 7, ly + h / 2 + .5);
      return [lx, ly, w, h];
    }

    /* ---------- izris ---------- */
    function draw(now) {
      if (!alive || !canvas.isConnected) { destroy(); return; }
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      if (auto) cam.yaw += dt * .16;
      if (playing) {
        if (pauseT > 0) { pauseT -= dt; if (pauseT <= 0) s = 0; }
        else { s += SPEED * dt; if (s >= total) { s = total; pauseT = 1.6; } }
      }
      setBasis();
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);

      // mreža tal
      g.lineWidth = 1;
      for (let v = -gr; v <= gr + 1e-6; v += step) {
        const major = Math.abs(Math.round(v / step) % 4) === 0;
        g.strokeStyle = major ? 'rgba(255,255,255,.075)' : 'rgba(255,255,255,.035)';
        [[[target[0] + v, target[1] - gr], [target[0] + v, target[1] + gr]], [[target[0] - gr, target[1] + v], [target[0] + gr, target[1] + v]]].forEach(([a, b]) => {
          const sg = clipSeg(toCam([a[0], a[1], 0]), toCam([b[0], b[1], 0]));
          if (sg) { g.beginPath(); g.moveTo(sg[0][0], sg[0][1]); g.lineTo(sg[1][0], sg[1][1]); g.stroke(); }
        });
      }
      const C = scene.ctx || {};
      // mesto, Pohorje, reka
      if (C.outline && pathPoly(clipPoly(C.outline.map(([x, y]) => toCam([x, y, 0]))), true)) {
        g.fillStyle = 'rgba(255,190,200,.045)'; g.fill(); g.strokeStyle = 'rgba(255,150,165,.22)'; g.lineWidth = 1.2; g.stroke();
      }
      if (C.forest && pathPoly(clipPoly(C.forest.map(([x, y]) => toCam([x, y, 0]))), true)) {
        g.fillStyle = 'rgba(90,150,90,.16)'; g.fill();
      }
      (C.rivers || (C.river ? [C.river] : [])).forEach(rv => { polyline(rv, 0, 'rgba(90,160,220,.22)', 9); polyline(rv, 0, 'rgba(120,185,240,.6)', 2.5); });
      if (C.stations) {
        g.fillStyle = 'rgba(255,255,255,.22)';
        C.stations.forEach(([x, y]) => { const q = P(x, y, 0); if (q) { g.beginPath(); g.arc(q.p[0], q.p[1], 1.6, 0, TAU); g.fill(); } });
      }

      // zavese pod trakom (globinsko urejene)
      const quads = [];
      segs.forEach(sg => {
        const c = [toCam([sg.a.x, sg.a.y, 0]), toCam([sg.b.x, sg.b.y, 0]), toCam([sg.b.x, sg.b.y, HGT]), toCam([sg.a.x, sg.a.y, HGT])];
        quads.push({ c, z: (c[0][2] + c[1][2] + c[2][2] + c[3][2]) / 4, col: sg.col });
      });
      quads.sort((a, b) => b.z - a.z).forEach(q => {
        if (pathPoly(clipPoly(q.c), true)) {
          const p = clipPoly(q.c);
          const grd = g.createLinearGradient(0, Math.max(...p.map(v => v[1])), 0, Math.min(...p.map(v => v[1])));
          grd.addColorStop(0, rgba(q.col, .04)); grd.addColorStop(1, rgba(q.col, .34));
          g.fillStyle = grd; g.fill();
        }
      });

      // stebrički in sence na tleh
      stops.forEach(p => {
        if (p.via) return;
        const a = P(p.x, p.y, 0), b = P(p.x, p.y, HGT);
        if (!a || !b) return;
        g.strokeStyle = rgba(p.lite, p.end || p.transfer ? .75 : .4); g.lineWidth = p.end ? 2 : 1.2;
        g.beginPath(); g.moveTo(a.p[0], a.p[1]); g.lineTo(b.p[0], b.p[1]); g.stroke();
        g.fillStyle = rgba(p.col, .35);
        g.beginPath(); g.ellipse(a.p[0], a.p[1], 6 * (3 / a.z) * .4 + 2, 2.5, 0, 0, TAU); g.fill();
      });

      // trak poti: celoten (prosojen) + prevoženi del (žareč)
      const bus = busAt(s);
      scene.legs.forEach((leg, li) => {
        const pts = stops.filter(p => p.leg === li), col = pts[0].lite;
        polyline(pts.map(p => [p.x, p.y]), HGT, rgba(col, .35), 4);
      });
      g.save(); g.shadowBlur = 14;
      along.forEach(k => {
        if (k.s0 >= s) return;
        const sg = k.seg, u = clamp((s - k.s0) / ((k.s1 - k.s0) || 1), 0, 1);
        g.shadowColor = rgba(sg.col, .9);
        polyline([[sg.a.x, sg.a.y], [sg.a.x + (sg.b.x - sg.a.x) * u, sg.a.y + (sg.b.y - sg.a.y) * u]], HGT, rgba(sg.lite, 1), 4.5);
      });
      g.restore();

      // vozlišča postaj
      const nodes = [];
      stops.forEach((p, i) => {
        if (p.via) return;
        const q = P(p.x, p.y, HGT);
        if (!q) return;
        const big = p.end || p.transfer, r = clamp((big ? 7 : 4.2) * 2.4 / q.z, big ? 4.5 : 3, big ? 9 : 6);
        g.beginPath(); g.arc(q.p[0], q.p[1], r, 0, TAU);
        g.fillStyle = big ? rgba(p.col, 1) : '#fff'; g.fill();
        g.lineWidth = big ? 2.5 : 2; g.strokeStyle = big ? '#fff' : rgba(p.col, 1); g.stroke();
        if (i === selected) { g.beginPath(); g.arc(q.p[0], q.p[1], r + 5, 0, TAU); g.strokeStyle = 'rgba(255,194,102,.9)'; g.lineWidth = 2; g.stroke(); }
        nodes.push({ i, x: q.p[0], y: q.p[1], z: q.z });
      });
      lastNodes = nodes;

      // avtobus (3D kvader v smeri vožnje)
      drawBus(bus);

      // napisi: začetek, konec, prestopi, izbrana postaja (od daleč proti blizu)
      const boxes = [];
      const hit = b => boxes.some(o => b[0] < o[0] + o[2] && b[0] + b[2] > o[0] && b[1] < o[1] + o[3] && b[1] + b[3] > o[1]);
      nodes.slice().sort((a, b) => b.z - a.z).forEach(n => {
        const p = stops[n.i];
        const show = p.end || p.transfer || n.i === selected;
        if (!show) return;
        const txt = (n.i === selected ? fmt(p.t) + ' · ' : '') + p.name;
        g.font = `700 ${Math.round(12 * fs)}px ${FONT}`;
        const w = g.measureText(txt).width + 14, h = Math.round(12 * fs) + 10;
        const b = [clamp(n.x - w / 2, 4, W - w - 4), n.y - h - 12, w, h];
        if (hit(b) && n.i !== selected) return;
        boxes.push(label(n.x, n.y, txt, { ring: n.i === selected ? 'rgba(255,194,102,.9)' : rgba(p.lite, .7), lift: 12 }));
      });

      // HUD
      let nextStop = bus.seg ? (bus.u > .02 ? bus.seg.b : bus.seg.a) : stops[0];
      if (nextStop.via) { const k = stops.indexOf(nextStop); nextStop = stops.slice(k).find(p => !p.via) || stops[stops.length - 1]; }
      clockB.textContent = fmt(bus.t);
      const atStop = bus.seg && !bus.seg.a.via && bus.u < .05;
      clockS.textContent = s >= total - 1e-6 ? '● Cilj: ' + stops[stops.length - 1].name : (atStop || !bus.seg ? '● ' : '→ ') + nextStop.name;
      bar.style.width = (s / total * 100).toFixed(1) + '%';
      if (selected >= 0 && now - selT > 6000) selected = -1;
      raf = requestAnimationFrame(draw);
    }
    let lastNodes = [];

    function drawBus(b) {
      const L = BUS * 1.25, Wd = BUS * .55, Hh = BUS * .5, z0 = HGT + .004;
      const [dx, dy] = b.dir, nx = -dy, ny = dx;
      const corner = (fl, sd, up) => [b.x + dx * L / 2 * fl + nx * Wd / 2 * sd, b.y + dy * L / 2 * fl + ny * Wd / 2 * sd, z0 + Hh * up];
      const V = [corner(-1, -1, 0), corner(1, -1, 0), corner(1, 1, 0), corner(-1, 1, 0), corner(-1, -1, 1), corner(1, -1, 1), corner(1, 1, 1), corner(-1, 1, 1)];
      const C = V.map(toCam);
      if (C.some(c => c[2] < NEAR)) return;
      const S = C.map(scr);
      // svetlobni žarek do tal
      const gnd = P(b.x, b.y, 0), top = P(b.x, b.y, z0);
      if (gnd && top) {
        const grd = g.createLinearGradient(gnd.p[0], gnd.p[1], top.p[0], top.p[1]);
        grd.addColorStop(0, 'rgba(255,194,102,0)'); grd.addColorStop(1, 'rgba(255,194,102,.55)');
        g.strokeStyle = grd; g.lineWidth = 3; g.beginPath(); g.moveTo(gnd.p[0], gnd.p[1]); g.lineTo(top.p[0], top.p[1]); g.stroke();
        g.fillStyle = 'rgba(255,194,102,.25)'; g.beginPath(); g.ellipse(gnd.p[0], gnd.p[1], 9, 3.5, 0, 0, TAU); g.fill();
      }
      const faces = [
        { i: [0, 1, 5, 4], c: '#E7E2E3' }, { i: [1, 2, 6, 5], c: '#FFFFFF' }, { i: [2, 3, 7, 6], c: '#D9D2D4' },
        { i: [3, 0, 4, 7], c: '#C8BFC1' }, { i: [4, 5, 6, 7], c: '#E5243F' },
      ];
      faces.map(f => ({ ...f, z: f.i.reduce((a, k) => a + C[k][2], 0) / 4 })).sort((a, b2) => b2.z - a.z).forEach(f => {
        g.beginPath(); f.i.forEach((k, j) => j ? g.lineTo(S[k][0], S[k][1]) : g.moveTo(S[k][0], S[k][1])); g.closePath();
        g.fillStyle = f.c; g.fill(); g.strokeStyle = 'rgba(60,10,20,.5)'; g.lineWidth = 1; g.stroke();
      });
      g.save(); g.shadowColor = 'rgba(255,194,102,.9)'; g.shadowBlur = 16;
      const tp = P(b.x, b.y, z0 + Hh);
      if (tp) { g.fillStyle = '#FFC266'; g.beginPath(); g.arc(tp.p[0], tp.p[1], 2.5, 0, TAU); g.fill(); }
      g.restore();
    }

    /* ---------- upravljanje ---------- */
    const ptrs = new Map();
    let downX = 0, downY = 0, moved = 0, pinch0 = 0, dist0 = 0;
    function stopAuto() { if (!interacted) { interacted = true; tip.style.opacity = '0'; } auto = false; btnOrbit.classList.remove('on'); }
    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (ptrs.size === 1) { downX = e.clientX; downY = e.clientY; moved = 0; }
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); dist0 = cam.dist; }
    });
    canvas.addEventListener('pointermove', e => {
      if (!ptrs.has(e.pointerId)) return;
      const prev = ptrs.get(e.pointerId);
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (ptrs.size === 1) {
        const dx = e.clientX - prev[0], dy = e.clientY - prev[1];
        moved += Math.abs(dx) + Math.abs(dy);
        if (moved > 4) { stopAuto(); cam.yaw -= dx * .009; cam.pitch = clamp(cam.pitch + dy * .006, .22, 1.45); }
      } else if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (pinch0 > 0) { stopAuto(); cam.dist = clamp(dist0 * pinch0 / d, minD, maxD); moved = 99; }
      }
    });
    const up = e => {
      const wasTap = ptrs.size === 1 && moved <= 6;
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch0 = 0;
      if (wasTap) {
        const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        let best = -1, bd = 26;
        lastNodes.forEach(n => { const d = Math.hypot(n.x - x, n.y - y); if (d < bd) { bd = d; best = n.i; } });
        selected = best; selT = performance.now();
      }
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); pinch0 = 0; });
    canvas.addEventListener('wheel', e => { e.preventDefault(); stopAuto(); cam.dist = clamp(cam.dist * Math.exp(e.deltaY * .0012), minD, maxD); }, { passive: false });

    function syncBtns() { btnPlay.innerHTML = playing ? ICON.pause : ICON.play; btnPlay.classList.toggle('on', playing); btnOrbit.classList.toggle('on', auto); }
    btnPlay.addEventListener('click', () => { playing = !playing; if (playing && s >= total) { s = 0; pauseT = 0; } syncBtns(); });
    btnOrbit.addEventListener('click', () => { auto = !auto; if (auto) interacted = true; syncBtns(); });
    container.querySelector('[data-r=reset]').addEventListener('click', () => { Object.assign(cam, home); selected = -1; });
    syncBtns();
    if (scene.reduceMotion) tip.textContent = 'Povleci za vrtenje · tapni ▶ za vožnjo';
    setTimeout(() => { if (!interacted) tip.style.opacity = '0'; }, 6000);

    function destroy() {
      alive = false; cancelAnimationFrame(raf);
      if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
    }
    raf = requestAnimationFrame(draw);
    return { destroy };
  }

  window.Route3D = { mount };
})();
