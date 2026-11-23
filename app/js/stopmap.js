/* =====================================================================
   Pravi zemljevid za izbiro postaje (MapLibre + OpenFreeMap)
   StopMap.mount(el, { stations, lines, selected, home, dark, fs, onSelect, onFail })
     -> { select(id, fly), setMe(loc), focus(lon, lat, zoom), zoom(dir), destroy() }
   stations: [{ id, name, lon, lat, hub }]
   lines:    [{ color, coords: [[lon,lat],...] }]   (mreža linij, prikazana nežno)
   ===================================================================== */
(function () {
  'use strict';
  const STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/positron';
  const STYLE_DARK = 'https://tiles.openfreemap.org/styles/dark';

  function webglOk() {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
  }

  function mount(el, o) {
    let map = null, alive = true, meMarker = null, ready = false, pend = [];
    const api = {
      select(id, fly) { run(() => { setSel(id); if (fly) { const s = o.stations.find(x => x.id === id); if (s) map.easeTo({ center: [s.lon, s.lat], zoom: Math.max(map.getZoom(), 15), duration: 600 }); } }); },
      setMe(p) { run(() => setMe(p)); },
      focus(lon, lat, z) { run(() => map.easeTo({ center: [lon, lat], zoom: z || 15.5, duration: 700 })); },
      zoom(dir) { run(() => (dir > 0 ? map.zoomIn() : map.zoomOut())); },
      destroy() { alive = false; if (meMarker) meMarker.remove(); if (map) { try { map.remove(); } catch (e) {} map = null; } },
    };
    const run = fn => { if (ready && map) fn(); else pend.push(fn); };
    if (!navigator.onLine || !webglOk() || !window.Map3D || !window.Map3D.loadLib) { setTimeout(() => o.onFail && o.onFail(), 0); return api; }

    window.Map3D.loadLib().then(ml => {
      if (!alive) return;
      // začetni pogled: mestno jedro (postaje do ~3 km od središča), ne cela občina
      const c0 = o.center || [o.stations.reduce((a, s) => a + s.lon, 0) / o.stations.length, o.stations.reduce((a, s) => a + s.lat, 0) / o.stations.length];
      const near = o.stations.filter(s => Math.hypot((s.lon - c0[0]) * 76.5, (s.lat - c0[1]) * 111) < 3);
      const core = near.length >= 5 ? near : o.stations;
      const lons = core.map(s => s.lon), lats = core.map(s => s.lat);
      try {
        map = new ml.Map({
          container: el, style: o.dark ? STYLE_DARK : STYLE_LIGHT,
          bounds: [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]],
          fitBoundsOptions: { padding: 24 }, attributionControl: { compact: true },
          dragRotate: false, pitchWithRotate: false, maxPitch: 0, renderWorldCopies: false,
        });
        map.touchZoomRotate.disableRotation();
      } catch (e) { o.onFail && o.onFail(); return; }
      const failT = setTimeout(() => { if (alive && map && !map.isStyleLoaded()) { api.destroy(); o.onFail && o.onFail(); } }, 12000);
      if ('ResizeObserver' in window) { const ro = new ResizeObserver(() => map && map.resize()); ro.observe(el); }

      map.on('load', () => {
        if (!alive) return;
        clearTimeout(failT);
        const fs = o.fs || 1, red = o.dark ? '#FF4D63' : '#D7193A';
        map.addSource('net', { type: 'geojson', data: { type: 'FeatureCollection', features: (o.lines || []).map(l => ({ type: 'Feature', properties: { color: l.color }, geometry: { type: 'LineString', coordinates: l.coords } })) } });
        map.addLayer({ id: 'net', type: 'line', source: 'net', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-opacity': o.dark ? .55 : .42, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.5, 16, 4] } });
        map.addSource('st', {
          type: 'geojson', promoteId: 'id',
          data: { type: 'FeatureCollection', features: o.stations.map(s => ({ type: 'Feature', properties: { id: s.id, name: s.name, hub: s.hub ? 1 : 0, home: s.id === o.home ? 1 : 0 }, geometry: { type: 'Point', coordinates: [s.lon, s.lat] } })) },
        });
        map.addLayer({ id: 'st-halo', type: 'circle', source: 'st', paint: {
          'circle-radius': ['case', ['boolean', ['feature-state', 'sel'], false], 18, 0], 'circle-color': red, 'circle-opacity': .2 } });
        map.addLayer({ id: 'st-dot', type: 'circle', source: 'st', paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, ['case', ['==', ['get', 'hub'], 1], 5.5, 3.5], 16, ['case', ['==', ['get', 'hub'], 1], 10, 7.5]],
          'circle-color': ['case', ['boolean', ['feature-state', 'sel'], false], red, ['==', ['get', 'hub'], 1], red, o.dark ? '#1B1012' : '#ffffff'],
          'circle-stroke-color': ['case', ['boolean', ['feature-state', 'sel'], false], '#ffffff', ['==', ['get', 'home'], 1], '#F2A100', red],
          'circle-stroke-width': ['case', ['boolean', ['feature-state', 'sel'], false], 3.5, ['==', ['get', 'home'], 1], 3.5, 2.2],
        } });
        map.addLayer({ id: 'st-name', type: 'symbol', source: 'st',
          filter: ['any', ['==', ['get', 'hub'], 1], ['>=', ['zoom'], 13.6]],
          layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': ['interpolate', ['linear'], ['zoom'], 12, 11 * fs, 16, 13.5 * fs],
            'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-padding': 3, 'text-max-width': 9, 'symbol-sort-key': ['-', 1, ['get', 'hub']] },
          paint: { 'text-color': o.dark ? '#F7EDEE' : '#1E1214', 'text-halo-color': o.dark ? '#120A0B' : '#ffffff', 'text-halo-width': 2 } });
        // tap na postajo (povečano območje dotika)
        map.on('click', e => {
          const p = e.point, box = [[p.x - 18, p.y - 18], [p.x + 18, p.y + 18]];
          const f = map.queryRenderedFeatures(box, { layers: ['st-dot'] });
          if (!f.length) return;
          f.sort((a, b) => {
            const pa = map.project(a.geometry.coordinates), pb = map.project(b.geometry.coordinates);
            return Math.hypot(pa.x - p.x, pa.y - p.y) - Math.hypot(pb.x - p.x, pb.y - p.y);
          });
          o.onSelect && o.onSelect(f[0].properties.id);
        });
        map.on('mouseenter', 'st-dot', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'st-dot', () => { map.getCanvas().style.cursor = ''; });
        ready = true;
        pend.splice(0).forEach(fn => { try { fn(); } catch (e) {} });
        if (o.selected) api.select(o.selected, false);
      });
    }).catch(() => { o.onFail && o.onFail(); });

    let selId = null;
    function setSel(id) {
      if (selId) map.setFeatureState({ source: 'st', id: selId }, { sel: false });
      selId = id;
      if (id) map.setFeatureState({ source: 'st', id }, { sel: true });
    }
    function setMe(p) {
      if (!p) return;
      if (!meMarker) {
        const d = document.createElement('div'); d.className = 'sm-me'; d.innerHTML = '<i></i><b></b>';
        meMarker = new window.maplibregl.Marker({ element: d }).setLngLat([p.lon, p.lat]).addTo(map);
      } else meMarker.setLngLat([p.lon, p.lat]);
    }
    return api;
  }
  window.StopMap = { mount };
})();
