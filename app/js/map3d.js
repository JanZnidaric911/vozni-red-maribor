/* =====================================================================
   Pravi 3D zemljevid poti (MapLibre GL + OpenFreeMap / OpenStreetMap)
   Map3D.mount(container, opts) -> { destroy() }
   opts = {
     legs: [{ id, color, coords: [[lon,lat],...] (cesta), stops: [{ lon, lat, name, t, end, transfer, at }] }],
            // at = indeks točke v coords, kjer je postaja
     fallback: container => void,   // brez interneta / WebGL
     reduceMotion: bool, fs: number
   }
   ===================================================================== */
(function () {
  'use strict';
  const LIB_JS = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';
  const LIB_CSS = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
  const STYLE = 'https://tiles.openfreemap.org/styles/liberty';
  const STYLE_2D = 'https://tiles.openfreemap.org/styles/positron', STYLE_2D_DARK = 'https://tiles.openfreemap.org/styles/dark';
  const pad = n => String(n).padStart(2, '0');
  const fmt = m => { m = Math.round(m); return pad(Math.floor(m / 60) % 24) + ':' + pad(((m % 60) + 60) % 60); };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let libP = null;
  function loadLib() {
    if (window.maplibregl) return Promise.resolve(window.maplibregl);
    if (libP) return libP;
    libP = new Promise((res, rej) => {
      if (!document.querySelector('link[data-ml]')) {
        const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = LIB_CSS; l.dataset.ml = '1'; document.head.appendChild(l);
      }
      const s = document.createElement('script'); s.src = LIB_JS; s.async = true;
      const t = setTimeout(() => rej(new Error('timeout')), 12000);
      s.onload = () => { clearTimeout(t); window.maplibregl ? res(window.maplibregl) : rej(new Error('no lib')); };
      s.onerror = () => { clearTimeout(t); rej(new Error('load')); };
      document.head.appendChild(s);
    });
    libP.catch(() => { libP = null; });
    return libP;
  }
  function webglOk() {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
  }

  const ICON = {
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>',
    follow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 2 4 21l8-4 8 4z"/></svg>',
    fit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/></svg>',
    full: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    bus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="15" rx="3"/><path d="M4 11h16M8 18v2M16 18v2"/></svg>',
    flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
  };

  /* razdalje v metrih */
  function meters(a, b) {
    const kx = 111320 * Math.cos((a[1] + b[1]) / 2 * Math.PI / 180);
    return Math.hypot((a[0] - b[0]) * kx, (a[1] - b[1]) * 110574);
  }
  function bearing(a, b) {
    const kx = Math.cos(a[1] * Math.PI / 180);
    return Math.atan2((b[0] - a[0]) * kx, b[1] - a[1]) * 180 / Math.PI;
  }

  function mount(container, opts) {
    const fs = opts.fs || 1, FLAT = !!opts.flat;
    let alive = true, map = null, raf = 0, markers = [];
    const destroy = () => {
      alive = false; cancelAnimationFrame(raf);
      markers.forEach(m => m.remove()); markers = [];
      if (map) { try { map.remove(); } catch (e) {} map = null; }
      container.classList.remove('m3d-full');
    };
    const fail = why => { if (!alive) return; destroy(); alive = true; container.innerHTML = ''; container.classList.remove('m3d'); opts.fallback(container, why); };

    if (!navigator.onLine) { fail('offline'); return { destroy }; }
    if (!webglOk()) { fail('webgl'); return { destroy }; }

    container.classList.add('m3d'); container.classList.toggle('flat', FLAT);
    container.innerHTML = `<div class="m3d-map"></div>
      <div class="m3d-load"><span class="spin"></span>Nalagam zemljevid …</div>
      <div class="r3d-hud m3d-hud"><div class="r3d-clock"><b>--:--</b><span>&nbsp;</span></div>
        <div class="r3d-btns">
          <button type="button" data-m="play" aria-label="Predvajaj / ustavi vožnjo"></button>
          <button type="button" data-m="follow" aria-label="Sledi avtobusu">${ICON.follow}</button>
          <button type="button" data-m="fit" aria-label="Pokaži celo pot">${ICON.fit}</button>
          <button type="button" data-m="full" aria-label="Celozaslonski prikaz">${ICON.full}</button>
        </div></div>
      <div class="r3d-progress"><i></i></div>`;
    const el = container.querySelector('.m3d-map'), loadEl = container.querySelector('.m3d-load');
    const clockB = container.querySelector('.r3d-clock b'), clockS = container.querySelector('.r3d-clock span');
    const bar = container.querySelector('.r3d-progress i');
    const btn = k => container.querySelector(`[data-m=${k}]`);

    /* ---------- pot: združene koordinate, razdalje, postaje ---------- */
    const path = [], cum = [], stops = [];
    opts.legs.forEach((leg, li) => {
      const base = path.length;
      leg.coords.forEach((c, i) => {
        if (i === 0 && path.length) { /* prestop: ista postaja, brez skoka */ }
        path.push(c); cum.push(path.length > 1 ? cum[cum.length - 1] + meters(path[path.length - 2], c) : 0);
      });
      leg.stops.forEach(s => stops.push({ ...s, leg: li, color: leg.color, d: cum[base + s.at] }));
    });
    const total = cum[cum.length - 1] || 1;
    const DUR = Math.min(38, Math.max(16, total / 260));   // sekund za celo pot
    let s = 0, playing = !opts.reduceMotion, follow = false, pauseT = 0, last = performance.now(), hdg = null, userMoved = false;

    function posAt(d) {
      let i = 1;
      while (i < cum.length - 1 && cum[i] < d) i++;
      const a = path[i - 1], b = path[i], seg = (cum[i] - cum[i - 1]) || 1, u = Math.max(0, Math.min(1, (d - cum[i - 1]) / seg));
      return { lon: a[0] + (b[0] - a[0]) * u, lat: a[1] + (b[1] - a[1]) * u, i, brg: bearing(a, b) };
    }
    function timeAt(d) {
      let k = 1;
      while (k < stops.length - 1 && stops[k].d < d) k++;
      const A = stops[k - 1], B = stops[k];
      if (!A || !B) return { t: stops[0].t, next: stops[0], at: true };
      const u = (B.d - A.d) ? Math.max(0, Math.min(1, (d - A.d) / (B.d - A.d))) : 1;
      return { t: A.t + (B.t - A.t) * u, next: d - A.d < 25 ? A : B, at: d - A.d < 25 || B.d - d < 25 };
    }

    const lons = path.map(p => p[0]), lats = path.map(p => p[1]);
    const bounds = [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]];

    function overview(anim) {
      if (!map) return;
      const h = el.clientHeight || 360;
      map.fitBounds(bounds, { padding: { top: Math.min(90, h * .22), bottom: 36, left: 28, right: 64 }, pitch: FLAT ? 0 : 50, bearing: FLAT ? 0 : -15, duration: anim && !opts.reduceMotion ? 900 : 0, maxZoom: 16.5 });
    }

    loadLib().then(ml => {
      if (!alive) return;
      try {
        map = new ml.Map({
          container: el, style: FLAT ? (opts.dark ? STYLE_2D_DARK : STYLE_2D) : STYLE, center: [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2],
          zoom: 14, pitch: FLAT ? 0 : 55, bearing: FLAT ? 0 : -18, antialias: true, attributionControl: { compact: true }, maxPitch: FLAT ? 0 : 75,
          dragRotate: !FLAT, pitchWithRotate: !FLAT,
          fadeDuration: opts.reduceMotion ? 0 : 300,
        });
      } catch (e) { fail('webgl'); return; }
      window.__m3d = map;
      map.addControl(new ml.NavigationControl({ visualizePitch: !FLAT, showZoom: true, showCompass: !FLAT }), 'bottom-right');
      if (FLAT) map.touchZoomRotate.disableRotation();
      if ('ResizeObserver' in window) { const ro = new ResizeObserver(() => { if (map) map.resize(); }); ro.observe(el); markers.push({ remove: () => ro.disconnect() }); }
      const stopErr = setTimeout(() => { if (alive && map && !map.loaded()) loadEl.textContent = 'Zemljevid se nalaga počasi … preveri internetno povezavo.'; }, 9000);
      map.on('error', ev => { if (alive && !map.isStyleLoaded() && ev && ev.error && /style|Failed to fetch|NetworkError/i.test(String(ev.error.message))) fail('offline'); });
      ['dragstart', 'rotatestart', 'pitchstart', 'zoomstart'].forEach(t => map.on(t, e => { if (e.originalEvent) { userMoved = true; if (follow) setFollow(false); } }));

      map.on('load', () => {
        if (!alive) return;
        clearTimeout(stopErr);
        loadEl.remove();
        // izrazitejše 3D stavbe
        (map.getStyle().layers || []).forEach(l => {
          if (l.type === 'fill-extrusion') { try { map.setPaintProperty(l.id, 'fill-extrusion-opacity', .78); } catch (e) {} }
        });
        const legsFC = { type: 'FeatureCollection', features: opts.legs.map(l => ({ type: 'Feature', properties: { color: l.color }, geometry: { type: 'LineString', coordinates: l.coords } })) };
        map.addSource('route', { type: 'geojson', data: legsFC, lineMetrics: true });
        map.addSource('done', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [path[0], path[0]] } } });
        map.addSource('stops', {
          type: 'geojson', data: {
            type: 'FeatureCollection', features: stops.map((p, i) => ({
              type: 'Feature', id: i,
              properties: { name: p.name, time: fmt(p.t), color: p.color, big: p.end || p.transfer ? 1 : 0, rank: p.end ? 0 : p.transfer ? 1 : 2 },
              geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
            })),
          },
        });
        map.addLayer({ id: 'route-shadow', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#000', 'line-opacity': .18, 'line-width': 16, 'line-blur': 6, 'line-translate': [0, 3] } });
        map.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#fff', 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 7, 17, 15] } });
        map.addLayer({ id: 'route-line', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-opacity': .45, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 4, 17, 10] } });
        map.addLayer({ id: 'route-done', type: 'line', source: 'done', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': opts.legs[0].color, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 4.5, 17, 11] } });
        map.addLayer({ id: 'route-arrows', type: 'symbol', source: 'route', layout: { 'symbol-placement': 'line', 'symbol-spacing': 90, 'text-field': '›', 'text-font': ['Noto Sans Bold'], 'text-size': 20, 'text-keep-upright': false, 'text-allow-overlap': true }, paint: { 'text-color': '#fff', 'text-halo-color': 'rgba(0,0,0,.25)', 'text-halo-width': 1 } });
        map.addLayer({ id: 'stop-dot', type: 'circle', source: 'stops', paint: {
          'circle-radius': ['case', ['==', ['get', 'big'], 1], 9, 6], 'circle-color': ['case', ['==', ['get', 'big'], 1], ['get', 'color'], '#fff'],
          'circle-stroke-color': ['case', ['==', ['get', 'big'], 1], '#fff', ['get', 'color']], 'circle-stroke-width': 3, 'circle-pitch-alignment': 'map',
        } });
        map.addLayer({ id: 'stop-name', type: 'symbol', source: 'stops', layout: {
          'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': ['case', ['==', ['get', 'big'], 1], 15 * fs, 12.5 * fs],
          'text-offset': [0, 1.15], 'text-anchor': 'top', 'symbol-sort-key': ['get', 'rank'], 'text-padding': 4, 'text-max-width': 10,
        }, paint: { 'text-color': FLAT && opts.dark ? '#F7EDEE' : '#1E1214', 'text-halo-color': FLAT && opts.dark ? '#120A0B' : '#fff', 'text-halo-width': 2.2 } });

        // začetek, cilj, avtobus
        const mk = (html, cls, lnglat, anchor) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; const m = new ml.Marker({ element: d, anchor: anchor || 'bottom' }).setLngLat(lnglat).addTo(map); markers.push(m); return d; };
        const A = stops[0], Z = stops[stops.length - 1];
        mk(`<span>${ICON.bus}</span><b>Vstop</b>`, 'm3d-pin start', [A.lon, A.lat]);
        mk(`<span>${ICON.flag}</span><b>Izstop</b>`, 'm3d-pin end', [Z.lon, Z.lat]);
        const busEl = document.createElement('div'); busEl.className = 'm3d-bus'; busEl.innerHTML = `<i></i><span>${ICON.bus}</span>`;
        const busM = new ml.Marker({ element: busEl, anchor: 'center', pitchAlignment: 'viewport', rotationAlignment: 'viewport' }).setLngLat([A.lon, A.lat]).addTo(map);
        markers.push(busM);

        // tap na postajo
        map.on('click', 'stop-dot', e => {
          const f = e.features && e.features[0]; if (!f) return;
          new ml.Popup({ closeButton: false, offset: 14, className: 'm3d-pop' }).setLngLat(f.geometry.coordinates)
            .setHTML(`<b>${esc(f.properties.name)}</b><span>Odhod ob ${esc(f.properties.time)}</span>`).addTo(map);
        });
        map.on('mouseenter', 'stop-dot', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'stop-dot', () => { map.getCanvas().style.cursor = ''; });

        overview(false);

        let doneIdx = -1, legNow = -1;
        function frame(now) {
          if (!alive || !container.isConnected) { destroy(); return; }
          const dt = Math.min(.05, (now - last) / 1000); last = now;
          if (playing) {
            if (pauseT > 0) { pauseT -= dt; if (pauseT <= 0) { s = 0; doneIdx = -1; } }
            else { s += total / DUR * dt * (follow ? .7 : 1); if (s >= total) { s = total; pauseT = 2; } }
          }
          const p = posAt(s), ti = timeAt(s);
          busM.setLngLat([p.lon, p.lat]);
          if (p.i !== doneIdx || playing) {
            map.getSource('done').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: path.slice(0, p.i).concat([[p.lon, p.lat]]) } });
            doneIdx = p.i;
          }
          const legIdx = ti.next ? ti.next.leg : 0;
          if (legIdx !== legNow) { legNow = legIdx; map.setPaintProperty('route-done', 'line-color', opts.legs[legIdx].color); busEl.style.setProperty('--c', opts.legs[legIdx].color); }
          if (follow) {
            const target = p.brg;
            if (hdg == null) hdg = target;
            let d = ((target - hdg + 540) % 360) - 180;
            hdg += d * Math.min(1, dt * 2.2);
            map.jumpTo(FLAT ? { center: [p.lon, p.lat], zoom: 16.3 } : { center: [p.lon, p.lat], bearing: hdg, pitch: 64, zoom: 17 });
          }
          clockB.textContent = fmt(ti.t);
          clockS.textContent = s >= total - 1 ? '● Cilj: ' + Z.name : (ti.at ? '● ' : '→ ') + ti.next.name;
          bar.style.width = (s / total * 100).toFixed(1) + '%';
          raf = requestAnimationFrame(frame);
        }
        raf = requestAnimationFrame(frame);
      });
    }).catch(() => fail('offline'));

    function setFollow(on) {
      follow = on; hdg = null;
      btn('follow').classList.toggle('on', on);
      if (on) { if (!playing) { playing = true; syncPlay(); } if (s >= total) { s = 0; pauseT = 0; } }
      else if (map && !FLAT) map.easeTo({ pitch: 55, duration: opts.reduceMotion ? 0 : 500 });
    }
    function syncPlay() { btn('play').innerHTML = playing ? ICON.pause : ICON.play; btn('play').classList.toggle('on', playing); }
    btn('play').addEventListener('click', () => { playing = !playing; if (playing && s >= total) { s = 0; pauseT = 0; } syncPlay(); });
    btn('follow').addEventListener('click', () => setFollow(!follow));
    btn('fit').addEventListener('click', () => { setFollow(false); overview(true); });
    btn('full').addEventListener('click', () => {
      const on = !container.classList.contains('m3d-full');
      container.classList.toggle('m3d-full', on);
      btn('full').innerHTML = on ? ICON.close : ICON.full;
      btn('full').setAttribute('aria-label', on ? 'Zapri celozaslonski prikaz' : 'Celozaslonski prikaz');
      setTimeout(() => { if (map) { map.resize(); if (!follow) overview(true); } }, 60);
    });
    syncPlay();
    return { destroy };
  }

  window.Map3D = { mount, loadLib, preload: () => { if (navigator.onLine) loadLib().catch(() => {}); } };
})();
