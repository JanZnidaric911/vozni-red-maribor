(() => {
'use strict';

/* ================= Pomožne funkcije ================= */
const $ = (s, el = document) => el.querySelector(s);
const pad = n => String(n).padStart(2, '0');
const fmt = m => { m = Math.round(m); return pad(Math.floor(m / 60) % 24) + ':' + pad(((m % 60) + 60) % 60); };
const tm = m => fmt(m) + (m >= 1440 ? '<sup>+1</sup>' : '');
const durFmt = m => m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '');
const eur = v => (Math.round(v * 100) / 100).toFixed(2).replace('.', ',') + ' €';
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ICONS = new Set([...document.querySelectorAll('symbol[id^="i-"]')].map(s => s.id.slice(2)));
const icon = (id, cls = '') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${ICONS.has(id) ? id : 'bus'}"/></svg>`;
const toMin = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const plural = (n, one, two, few, many) => n % 100 === 1 ? one : n % 100 === 2 ? two : n % 100 === 3 || n % 100 === 4 ? few : many;

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed) {
  let s = seed || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}
/* prvi indeks v urejenem polju, kjer je vrednost >= x */
function lb(arr, x) {
  let lo = 0, hi = arr.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < x) lo = m + 1; else hi = m; }
  return lo;
}
/* barva besedila (bela/temna) z boljšim kontrastom na dani barvi */
const inkCache = {};
function ink(hex) {
  if (inkCache[hex]) return inkCache[hex];
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  if (isNaN(n)) return '#fff';
  const lin = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
  const L = .2126 * lin(n >> 16 & 255) + .7152 * lin(n >> 8 & 255) + .0722 * lin(n & 255);
  return (inkCache[hex] = 1.05 / (L + .05) >= (L + .05) / .058 ? '#fff' : '#1E1214');
}

/* ================= Podatki (z varnimi privzetimi vrednostmi) ================= */
const CITYD = typeof CITY !== 'undefined' ? CITY : { name: 'Maribor', tagline: '' };
const FARED = Object.assign({ single: 1.2, transferMinutes: 60, day: 3.5 }, typeof FARE !== 'undefined' ? FARE : {});
const MAPD = typeof MAP !== 'undefined' ? MAP : null;
const ST_IDS = Object.keys(STATIONS);
const DISTRICT_LIST = (() => {
  const base = typeof DISTRICTS !== 'undefined' && Array.isArray(DISTRICTS) ? DISTRICTS.slice() : [];
  ST_IDS.forEach(id => { const r = STATIONS[id].reg; if (r && !base.includes(r)) base.push(r); });
  return base;
})();
const HUB = ST_IDS.find(id => STATIONS[id].hub) || ST_IDS[0];
const INSP = (typeof INSPIRATION !== 'undefined' ? INSPIRATION : []).filter(it => STATIONS[it.id]);
const DEFAULT_TO = (INSP.find(it => it.id !== HUB) || {}).id || ST_IDS.find(id => id !== HUB);
const TYPE_LABEL = { city: 'mestna linija', fast: 'hitra linija', suburban: 'primestna linija' };

/* ================= Datumi ================= */
const DAYS_SHORT = ['ned', 'pon', 'tor', 'sre', 'čet', 'pet', 'sob'];
const DAYS_LONG = ['nedelja', 'ponedeljek', 'torek', 'sreda', 'četrtek', 'petek', 'sobota'];
const MONTHS = ['januar', 'februar', 'marec', 'april', 'maj', 'junij', 'julij', 'avgust', 'september', 'oktober', 'november', 'december'];
const dateKey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return dateKey(d); };
const todayKey = () => dateKey(new Date());
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}
const holCache = {};
function holidays(y) {
  if (holCache[y]) return holCache[y];
  const set = new Set(['01-01', '01-02', '02-08', '04-27', '05-01', '05-02', '06-25', '08-15', '10-31', '11-01', '12-25', '12-26'].map(s => y + '-' + s));
  const em = easter(y); em.setDate(em.getDate() + 1); set.add(dateKey(em));
  return (holCache[y] = set);
}
const isHoliday = k => holidays(+k.slice(0, 4)).has(k);
function dayType(k) {
  if (isHoliday(k)) return 'sun';
  const w = parseKey(k).getDay();
  return w === 0 ? 'sun' : w === 6 ? 'sat' : 'wk';
}
const DT_LABEL = { wk: 'delavnik', sat: 'sobota', sun: 'nedelja / praznik' };
function dateLabel(k, long) {
  const t = todayKey();
  if (k === t) return 'Danes';
  if (k === addDays(t, 1)) return 'Jutri';
  const d = parseKey(k);
  return (long ? DAYS_LONG : DAYS_SHORT)[d.getDay()] + ', ' + d.getDate() + '. ' + (long ? MONTHS[d.getMonth()] : MONTHS[d.getMonth()].slice(0, 3) + '.');
}

/* ================= Omrežje ================= */
const SPEED = { city: 19, fast: 26, suburban: 30 };   // km/h z upoštevanim prometom
const DWELL = { city: 1, fast: 1, suburban: 1 };       // min postanka na vmesni postaji
const ROAD = 1.35, MIN_SEG = 2;
const XFER = 3, MAX_WAIT = 30;                         // prestop: najmanj 3 min, največ 30 min čakanja
function km(a, b) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

const DIRS = [];
LINES.forEach(line => {
  line.color = line.color || (OPERATORS[line.op] && OPERATORS[line.op].color) || '#D7193A';
  line.amen = line.amen || [];
  line.stops = line.stops.filter(s => STATIONS[s]);
  if (line.stops.length < 2) return;
  const sp = SPEED[line.type] || 22, dw = DWELL[line.type] != null ? DWELL[line.type] : 1;
  [line.stops, [...line.stops].reverse()].forEach((stops, d) => {
    const off = [0], kms = [0];
    for (let i = 1; i < stops.length; i++) {
      const dist = km(STATIONS[stops[i - 1]], STATIONS[stops[i]]) * ROAD;
      kms.push(kms[i - 1] + dist);
      off.push(off[i - 1] + Math.max(MIN_SEG, Math.round(dist / sp * 60)) + (i > 1 ? dw : 0));
    }
    const pos = {};
    stops.forEach((s, i) => { if (!(s in pos)) pos[s] = i; });
    DIRS.push({ line, d, stops, off, kms, pos, key: line.id + '.' + d });
  });
});
const DIR_BY_KEY = {};
DIRS.forEach(d => (DIR_BY_KEY[d.key] = d));
const STOP_DIRS = {};
DIRS.forEach(dir => dir.stops.forEach((s, i) => (STOP_DIRS[s] = STOP_DIRS[s] || []).push({ dir, i })));
const linesAtCache = {};
const linesAt = id => linesAtCache[id] != null ? linesAtCache[id] : (linesAtCache[id] = new Set((STOP_DIRS[id] || []).map(a => a.dir.line.id)).size);

const tripCache = {};
function trips(dir, dt) {
  const k = dir.key + '|' + dt;
  if (tripCache[k]) return tripCache[k];
  const line = dir.line, [f, l, every] = line.freq;
  let first = toMin(f), last = toMin(l), ev = every;
  if (last < first) last += 1440;                       // nočne linije čez polnoč
  const long = last - first > 600;
  if (dt === 'sat') { if (long) { first += 60; last -= 60; } ev = Math.round(every * 1.5); }
  if (dt === 'sun') { if (line.noSun) return (tripCache[k] = []); if (long) { first += 120; last -= 90; } ev = Math.round(every * 2); }
  if (dir.d === 1) first += 4 + (hash(line.id) % 4) * 3;
  const r = rng(hash(k)), out = [];
  let t = first;
  while (t <= last) {
    out.push(t);
    const peak = dt === 'wk' && ((t >= 360 && t < 495) || (t >= 840 && t < 1020));
    const step = peak ? ev * 0.7 : ev;
    t += Math.max(4, Math.round(step + (r() - 0.5) * ev * 0.2));
  }
  return (tripCache[k] = out);
}

const isHubStop = id => !!(STATIONS[id] && STATIONS[id].hub);
const peron = (dir, i) => { const s = dir.stops[i]; return isHubStop(s) ? 1 + hash(dir.key + s) % 12 : null; };
function delayOf(id, k) {
  const r = hash(id + k) % 100;
  return r < 70 ? 0 : r < 93 ? 1 + r % 3 : 4 + r % 5;
}

function mkLeg(dir, i, j, start) {
  return { dir, i, j, start, dep: start + dir.off[i], arr: start + dir.off[j], id: dir.key + '@' + start };
}
/* enotna cena: prestopi v okviru FARE.transferMinutes so vključeni, sicer nova vozovnica */
function fareOf(legs) {
  let n = 1, win = legs[0].dep;
  for (const l of legs) if (l.dep - win > FARED.transferMinutes) { n++; win = l.dep; }
  return n * FARED.single;
}
function mkConn(legs) {
  const dep = legs[0].dep, arr = legs[legs.length - 1].arr;
  return { legs, dep, arr, dur: arr - dep, transfers: legs.length - 1, price: fareOf(legs) };
}

const searchCache = {};
const searchKey = (from, to, k) => from + '>' + to + '|' + dayType(k);
const cachedSearch = (from, to, k) => searchCache[searchKey(from, to, k)];
function search(from, to, k) {
  const ck = searchKey(from, to, k);
  if (searchCache[ck]) return searchCache[ck];
  const dt = dayType(k), out = [];
  const fromDirs = STOP_DIRS[from] || [];
  // neposredno
  for (const a of fromDirs) {
    const j = a.dir.pos[to];
    if (j > a.i) for (const s of trips(a.dir, dt)) out.push(mkConn([mkLeg(a.dir, a.i, j, s)]));
  }
  // en prestop
  for (const a of fromDirs) {
    const ja = a.dir.pos[to];
    if (ja > a.i) continue;
    const t1 = trips(a.dir, dt);
    if (!t1.length) continue;
    for (let v = a.i + 1; v < a.dir.stops.length; v++) {
      const via = a.dir.stops[v];
      if (via === from) break;
      for (const b of STOP_DIRS[via] || []) {
        if (b.dir.line === a.dir.line) continue;
        const j = b.dir.pos[to];
        if (!(j > b.i)) continue;
        const fp = b.dir.pos[from];
        if (fp >= b.i && fp <= j) continue;
        const t2 = trips(b.dir, dt), ob = b.dir.off[b.i];
        if (!t2.length) continue;
        for (const s1 of t1) {
          const arr1 = s1 + a.dir.off[v];
          const x = lb(t2, arr1 + XFER - ob);
          if (x >= t2.length) break;
          const s2 = t2[x];
          if (s2 + ob - arr1 > MAX_WAIT) continue;
          out.push(mkConn([mkLeg(a.dir, a.i, v, s1), mkLeg(b.dir, b.i, j, s2)]));
        }
      }
    }
  }
  // dva prestopa (RAPTOR) – samo za odhode tega dne, brez podvojenih začetnih časov
  const starts = new Set();
  for (const a of fromDirs) if (a.i < a.dir.stops.length - 1) for (const s of trips(a.dir, dt)) starts.add(s + a.dir.off[a.i]);
  const sorted = [...starts].sort((x, y) => x - y);
  for (const t0 of sorted) { const c = raptor(from, to, dt, t0); if (c && c.transfers === 2) out.push(c); }

  const res = prune(out);
  searchCache[ck] = res;
  return res;
}
/* odstrani povezave, ki jih druga prekaša (kasnejši ali enak odhod, zgodnejši ali enak prihod, ne več prestopov) */
function prune(out) {
  out.sort((x, y) => y.dep - x.dep || x.arr - y.arr || x.transfers - y.transfers);
  const best = [Infinity, Infinity, Infinity, Infinity], keep = [];
  for (const c of out) {
    const t = Math.min(c.transfers, 3);
    if (best[t] <= c.arr) continue;
    keep.push(c);
    for (let u = t; u < 4; u++) if (c.arr < best[u]) best[u] = c.arr;
  }
  return keep.reverse();
}

function raptor(from, to, dt, t0, maxLegs = 3) {
  const best = { [from]: t0 };
  const labels = [{ [from]: { t: t0, prev: null } }];
  let marked = [from];
  for (let k = 1; k <= maxLegs && marked.length; k++) {
    const prevL = labels[k - 1], cur = {};
    for (const s of marked) {
      const lab = prevL[s], ready = lab.t + (lab.prev ? XFER : 0);
      for (const a of STOP_DIRS[s] || []) {
        if (a.i === a.dir.stops.length - 1) continue;
        if (lab.prev && lab.prev.leg.dir.line === a.dir.line) continue;
        const tr = trips(a.dir, dt), oa = a.dir.off[a.i];
        const x = lb(tr, ready - oa);
        if (x >= tr.length) continue;
        const st = tr[x];
        if (k === 1 && st + oa !== t0) continue;
        if (k > 1 && st + oa - lab.t > MAX_WAIT + XFER) continue;
        const bt = best[to] != null ? best[to] : Infinity;
        for (let j = a.i + 1; j < a.dir.stops.length; j++) {
          const stop = a.dir.stops[j], arr = st + a.dir.off[j];
          if (stop === from || arr >= bt) break;
          if (arr < (best[stop] != null ? best[stop] : Infinity)) {
            best[stop] = arr;
            cur[stop] = { t: arr, prev: { from: s, k: k - 1, leg: mkLeg(a.dir, a.i, j, st) } };
          }
        }
      }
    }
    labels.push(cur);
    marked = Object.keys(cur);
  }
  let kk = -1;
  for (let k = 1; k < labels.length; k++) if (labels[k][to] && (kk < 0 || labels[k][to].t < labels[kk][to].t)) kk = k;
  if (kk < 0) return null;
  const legs = [];
  let s = to, k = kk;
  while (s !== from) { const lab = labels[k][s]; legs.unshift(lab.prev.leg); s = lab.prev.from; k = lab.prev.k; }
  return mkConn(legs);
}

function departures(st, k, fromMin, limit = 30) {
  const dt = dayType(k), out = [];
  const yDt = dayType(addDays(k, -1));
  for (const a of STOP_DIRS[st] || []) {
    if (a.i === a.dir.stops.length - 1) continue;
    const off = a.dir.off[a.i];
    const tr = trips(a.dir, dt);
    for (let x = lb(tr, fromMin - off); x < tr.length; x++) out.push({ a, s: tr[x], dep: tr[x] + off });
    // nočni odhodi prejšnjega dne po polnoči
    if (fromMin < 300) for (const s of trips(a.dir, yDt)) { const dep = s + off - 1440; if (dep >= fromMin) out.push({ a, s: s - 1440, dep }); }
  }
  return out.sort((x, y) => x.dep - y.dep).slice(0, limit);
}

/* ================= Shramba ================= */
const store = (() => {
  let data = { favs: [], recent: [], tickets: [], theme: null };
  try { Object.assign(data, JSON.parse(localStorage.getItem('voznired-mb') || '{}')); } catch (e) {}
  const okRoute = r => r && STATIONS[r.from] && STATIONS[r.to];
  data.favs = (data.favs || []).filter(okRoute);
  data.recent = (data.recent || []).filter(okRoute);
  data.tickets = (data.tickets || []).filter(t => t && STATIONS[t.from] && STATIONS[t.to]);
  data.settings = Object.assign({ fs: 'm', contrast: false, motion: false, simple: false, bold: false, vibrate: true, speak: false, home: null, pickMode: 'map', view3d: false }, data.settings || {});
  if (data.settings.home && !STATIONS[data.settings.home]) data.settings.home = null;
  return { data, save() { try { localStorage.setItem('voznired-mb', JSON.stringify(data)); } catch (e) {} } };
})();
const D = store.data;
const SET = D.settings;
const CAN_SPEAK = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
const CAN_VIBRATE = 'vibrate' in navigator;
const reduceMotion = () => SET.motion || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
function applySettings() {
  const r = document.documentElement.dataset;
  r.fs = SET.fs;
  r.contrast = SET.contrast ? 'high' : 'normal';
  r.motion = SET.motion ? 'reduce' : 'auto';
  r.simple = SET.simple ? '1' : '0';
  r.bold = SET.bold ? '1' : '0';
}

/* ================= Stanje ================= */
const HOME_ST = SET.home || HUB;
const S = {
  tab: 'home', from: HOME_ST, to: DEFAULT_TO !== HOME_ST ? DEFAULT_TO : (INSP.find(it => it.id !== HOME_ST) || {}).id || ST_IDS.find(id => id !== HOME_ST),
  date: todayKey(), time: null,
  directOnly: false, sort: 'dep', results: [], sel: null, selDate: null,
  boardStation: HOME_ST, ticket: null, buy: { type: 'odr', count: 1 }, picker: null, view3d: SET.view3d,
};
const nav = { home: ['home'], board: ['board'], tickets: ['tickets'], favs: ['favs'], profile: ['profile'] };
const scrolls = {};
const views = $('#views');
const current = () => nav[S.tab][nav[S.tab].length - 1];

/* ================= Gradniki ================= */
const badge = (line, sm) => `<span class="badge ${sm ? 'sm' : ''}" style="background:${line.color};color:${ink(line.color)}">${sm ? '' : icon('bus')}${esc(line.id)}</span>`;
const stName = id => STATIONS[id] ? STATIONS[id].name : '–';
const stSub = s => s.sub || s.reg || '';
const kmFmt = v => v < 10 ? v.toFixed(1).replace('.', ',') + ' km' : Math.round(v) + ' km';

function connStatus(c, k) {
  if (k !== todayKey()) return null;
  const n = nowMin(), delay = delayOf(c.legs[0].id, k), dep = c.dep + delay, diff = dep - n;
  if (dep < n - 1) return { cls: 'gone', txt: 'Odpeljal' };
  if (diff <= 60) {
    if (delay) return { cls: 'warn', txt: `+${delay} min · čez ${Math.max(0, diff)} min` };
    return { cls: 'ok', txt: diff <= 0 ? 'Odhaja zdaj' : `čez ${diff} min` };
  }
  return null;
}

/* ---- ilustracije ---- */
const W = 'rgba(255,255,255,';
/* Glavna ilustracija: rdeč mestni avtobus pred Mariborom ob sončnem zahodu */
function heroArt() {
  const wins = [0, 1, 2, 3, 4, 5].map(i => {
    const x = 146 + i * 27;
    return `<rect x="${x}" y="134" width="23" height="24" rx="4" fill="url(#hbGlass)"/>
      <path d="M${x + 4} 156 L${x + 15} 136 h5 L${x + 9} 156Z" fill="rgba(255,255,255,.16)"/>`;
  }).join('');
  const arches = [0, 1, 2, 3, 4, 5, 6].map(i => { const x = -10 + i * 62; return `M${x} 188 Q${x + 31} 150 ${x + 62} 188`; }).join(' ');
  const lights = Array.from({ length: 14 }, (_, i) => `<circle cx="${(i * 31 + 9) % 400}" cy="${118 + (i * 7) % 26}" r="1.3" fill="rgba(255,220,170,${.35 + (i % 3) * .15})"/>`).join('');
  return `<svg class="skyline hero-bus" viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs>
      <linearGradient id="hbBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF5468"/><stop offset=".55" stop-color="#E3203B"/><stop offset="1" stop-color="#B0122C"/></linearGradient>
      <linearGradient id="hbGlass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5A1322"/><stop offset="1" stop-color="#22050B"/></linearGradient>
      <linearGradient id="hbRoad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(30,4,10,.55)"/><stop offset="1" stop-color="rgba(30,4,10,.15)"/></linearGradient>
      <radialGradient id="hbSun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFE3B8"/><stop offset=".45" stop-color="rgba(255,190,140,.55)"/><stop offset="1" stop-color="rgba(255,150,120,0)"/></radialGradient>
      <radialGradient id="hbLamp" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="rgba(255,236,190,.95)"/><stop offset="1" stop-color="rgba(255,236,190,0)"/></radialGradient>
    </defs>
    <g transform="translate(0 -30)">
    <circle cx="300" cy="96" r="70" fill="url(#hbSun)"/>
    <circle cx="300" cy="96" r="22" fill="rgba(255,232,200,.75)"/>
    <!-- Pohorje -->
    <path d="M0 120 C40 98 80 86 128 84 C170 82 196 70 236 72 C280 74 320 92 360 94 C380 95 392 98 400 100 V200 H0Z" fill="rgba(255,255,255,.06)"/>
    <path d="M30 128 L118 82" stroke="rgba(255,255,255,.25)" stroke-width=".8"/>
    <rect x="80" y="100" width="6" height="5" rx="1.2" fill="rgba(255,255,255,.45)"/>
    <!-- mesto: stolnica, vodni stolp, strehe -->
    <g fill="rgba(46,3,12,.42)">
      <path d="M0 170 V140 h18 v-8 l9 -7 l9 7 v8 h14 V170Z"/>
      <path d="M52 170 V112 l7 -26 l7 26 V170Z"/><rect x="48" y="118" width="22" height="52"/>
      <path d="M76 170 V132 h20 v-6 h18 v44Z"/>
      <path d="M118 170 V122 l11 -9 l11 9 V170Z"/>
      <path d="M232 170 V128 h10 v-10 a8 8 0 0 1 16 0 v10 h10 V170Z"/>
      <path d="M272 170 V136 h26 V170Z M302 170 V126 l12 -10 l12 10 V170Z M330 170 V138 h22 V170Z M356 170 V120 l7 -20 l7 20 V170Z M374 170 V134 h26 V170Z"/>
    </g>
    ${lights}
    <!-- Stari most in Drava -->
    <rect x="0" y="170" width="400" height="34" fill="rgba(40,3,10,.28)"/>
    <path d="M0 174 H400" stroke="rgba(255,255,255,.45)" stroke-width="2.5"/>
    <path d="${arches}" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="2"/>
    <path d="M14 196 h30 M80 192 h18 M300 194 h40 M360 199 h22" stroke="rgba(255,220,200,.25)" stroke-width="1.2" stroke-linecap="round"/>
    <!-- cesta -->
    <rect x="0" y="204" width="400" height="96" fill="url(#hbRoad)"/>
    <path d="M0 204 H400" stroke="rgba(255,255,255,.22)" stroke-width="1"/>
    <path d="M6 236 h34 M74 236 h34 M142 236 h34 M210 236 h34 M278 236 h34 M346 236 h34" stroke="rgba(255,255,255,.35)" stroke-width="2.4" stroke-linecap="round"/>
    <!-- postajališče -->
    <g>
      <rect x="64" y="150" width="3" height="56" rx="1.5" fill="rgba(255,255,255,.7)"/>
      <rect x="54" y="140" width="23" height="18" rx="4" fill="#fff"/>
      <rect x="59" y="144" width="13" height="9" rx="2" fill="none" stroke="#B0122C" stroke-width="1.8"/>
      <path d="M61 150 h9" stroke="#B0122C" stroke-width="1.4"/>
    </g>
    <!-- hitrostne črte -->
    <path d="M26 176 h60 M10 188 h70 M40 198 h46 M8 166 h40" stroke="rgba(255,255,255,.28)" stroke-width="2" stroke-linecap="round"/>
    <!-- senca -->
    <ellipse cx="236" cy="214" rx="118" ry="8" fill="rgba(20,0,6,.45)"/>
    <!-- avtobus -->
    <g>
      <path d="M124 128 a12 12 0 0 1 12 -12 H318 c14 0 24 6 28 18 l8 28 c2 8 2 16 2 24 v12 a6 6 0 0 1 -6 6 H130 a6 6 0 0 1 -6 -6Z" fill="url(#hbBody)"/>
      <path d="M136 116 H318 c8 0 15 2 20 7 H136Z" fill="rgba(255,255,255,.22)"/>
      <rect x="146" y="120" width="110" height="9" rx="2" fill="#1A0408"/>
      <text x="150" y="127.6" font-family="ui-monospace,Consolas,monospace" font-size="8" font-weight="700" fill="#FFC266">6  TEZNO</text>
      ${wins}
      <path d="M314 132 h20 c4 0 7 2 8 6 l7 22 c1 3 -1 6 -4 6 H314Z" fill="url(#hbGlass)"/>
      <path d="M320 136 l14 0 l-9 26 h-5Z" fill="rgba(255,255,255,.14)"/>
      <rect x="286" y="132" width="24" height="56" rx="3" fill="rgba(30,4,10,.55)"/>
      <path d="M298 134 V186" stroke="rgba(255,255,255,.35)" stroke-width="1.2"/>
      <rect x="128" y="164" width="226" height="7" fill="#fff" opacity=".92"/>
      <rect x="128" y="171" width="226" height="2" fill="rgba(0,0,0,.15)"/>
      <circle cx="352" cy="188" r="4" fill="#FFF1CF"/>
      <circle cx="352" cy="188" r="16" fill="url(#hbLamp)"/>
      <rect x="125" y="180" width="4" height="9" rx="1.5" fill="#FF8A6E"/>
      <path d="M190 178 h70" stroke="rgba(255,255,255,.3)" stroke-width="1.5" stroke-linecap="round"/>
      <g><circle cx="168" cy="204" r="15" fill="#1A0408"/><circle cx="168" cy="204" r="7" fill="#C9BDC0"/><circle cx="168" cy="204" r="2.5" fill="#5A4A4E"/></g>
      <g><circle cx="312" cy="204" r="15" fill="#1A0408"/><circle cx="312" cy="204" r="7" fill="#C9BDC0"/><circle cx="312" cy="204" r="2.5" fill="#5A4A4E"/></g>
    </g>
    </g>
    <path d="M0 300 V280 Q100 270 200 276 T400 272 V300Z" fill="var(--bg)"/>
  </svg>`;
}

function inspoArt(it, i) {
  const [a, b] = it.g || ['#7A0C24', '#E0384F'];
  const kind = it.kind || 'city';
  let land;
  if (kind === 'mountain') {
    land = `<path d="M0 122 C30 96 50 80 78 74 C104 68 120 84 168 70 V200 H0Z" fill="${W}.18)"/>
      <path d="M0 150 C40 128 74 136 110 120 C134 110 150 116 168 112 V200 H0Z" fill="${W}.14)"/>
      ${Array.from({ length: 9 }, (_, k) => `<path d="M${8 + k * 18} ${142 - (k % 3) * 4} l6 -13 l6 13z" fill="${W}.16)"/>`).join('')}
      <path d="M20 150 L130 84" stroke="${W}.4)" stroke-width="1"/><rect x="72" y="113" width="8" height="7" rx="1.5" fill="${W}.6)"/>`;
  } else if (kind === 'river') {
    land = `<path d="M0 118 C40 108 70 114 100 106 C130 98 150 104 168 100 V200 H0Z" fill="${W}.14)"/>
      <rect y="136" width="168" height="64" fill="${W}.1)"/>
      <path d="M0 132 H168" stroke="${W}.55)" stroke-width="3"/>
      ${[0, 1, 2].map(k => `<path d="M${k * 56} 146 Q${k * 56 + 28} 118 ${k * 56 + 56} 146" fill="none" stroke="${W}.45)" stroke-width="2.2"/><path d="M${k * 56} 148 Q${k * 56 + 28} 168 ${k * 56 + 56} 148" fill="none" stroke="${W}.14)" stroke-width="1.6"/>`).join('')}
      <path d="M14 178 h22 M70 184 h16 M110 176 h28" stroke="${W}.25)" stroke-width="1.2" stroke-linecap="round"/>`;
  } else if (kind === 'park') {
    land = `<path d="M0 140 C40 120 80 128 120 118 C140 113 156 116 168 114 V200 H0Z" fill="${W}.16)"/>
      <path d="M0 162 C50 146 100 156 168 140 V200 H0Z" fill="${W}.14)"/>
      ${[[30, 124, 14], [56, 118, 18], [112, 112, 16], [138, 118, 12]].map(([x, y, r]) => `<rect x="${x - 1.5}" y="${y}" width="3" height="${r + 4}" fill="${W}.3)"/><circle cx="${x}" cy="${y}" r="${r}" fill="${W}.22)"/>`).join('')}
      <path d="M70 200 C80 176 96 168 104 150" stroke="${W}.3)" stroke-width="3" fill="none" stroke-linecap="round" stroke-dasharray="2 6"/>`;
  } else {
    land = `<g fill="${W}.2)"><path d="M0 200 V140 h22 v-14 h18 v74Z"/><path d="M44 200 V118 l10 -8 l10 8 V200Z"/>
      <path d="M70 200 V96 l7 -26 l7 26 V200Z"/><rect x="66" y="100" width="22" height="100"/>
      <path d="M94 200 V130 h26 V200Z M124 200 V112 l12 -10 l12 10 V200Z M150 200 V138 h18 V200Z"/></g>
      <g fill="rgba(255,236,190,.4)">${[[8, 150], [28, 136], [100, 140], [110, 152], [130, 122], [140, 136], [156, 148]].map(([x, y]) => `<rect x="${x}" y="${y}" width="4" height="5" rx="1"/>`).join('')}</g>`;
  }
  return `<svg class="art" viewBox="0 0 168 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="ig${i}" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="${b}"/><stop offset="1" stop-color="${a}"/></linearGradient>
    <linearGradient id="is${i}" x1="0" y1="0" x2="0" y2="1"><stop offset=".4" stop-color="rgba(0,0,0,0)"/><stop offset="1" stop-color="rgba(0,0,0,.45)"/></linearGradient></defs>
    <rect width="168" height="200" fill="url(#ig${i})"/><circle cx="${122 - (i % 3) * 20}" cy="${44 + (i % 2) * 10}" r="18" fill="rgba(255,236,200,.42)"/>
    <circle cx="${122 - (i % 3) * 20}" cy="${44 + (i % 2) * 10}" r="30" fill="rgba(255,236,200,.1)"/>
    ${land}<rect width="168" height="200" fill="url(#is${i})"/></svg>`;
}

const fastCache = {};
function fastest(from, to) {
  const k = from + '>' + to;
  if (!(k in fastCache)) {
    const r = from === to ? [] : search(from, to, todayKey());
    fastCache[k] = r.length ? Math.min(...r.map(c => c.dur)) : null;
  }
  return fastCache[k];
}

function routeItem(r, i, kind) {
  const f = fastest(r.from, r.to);
  return `<button class="route-item" data-a="route" data-from="${r.from}" data-to="${r.to}">
    <span class="ic ${kind === 'recent' ? 'amber' : ''}">${icon(kind === 'recent' ? 'history' : 'star')}</span>
    <span class="tx"><strong><span class="nm">${esc(stName(r.from))}</span> ${icon('arrow')} <span class="nm">${esc(stName(r.to))}</span></strong>
    <span>${f ? 'najhitreje ' + durFmt(f) : 'danes ni povezave'}</span></span>
    ${kind === 'fav-edit' ? `<span class="rm" data-a="unfav" data-i="${i}" role="button" aria-label="Odstrani">${icon('x')}</span>` : icon('chev')}
  </button>`;
}

function nextUp(from, to) {
  if (!from || !to || from === to) return null;
  const k = todayKey(), n = nowMin();
  const list = search(from, to, k);
  return list.find(c => c.dep + delayOf(c.legs[0].id, k) >= n) || null;
}

/* ================= Zasloni ================= */
const SCREENS = {};

SCREENS.home = () => {
  const h = new Date().getHours();
  const greet = h < 5 ? 'Lahko noč' : h < 11 ? 'Dobro jutro' : h < 18 ? 'Dober dan' : 'Dober večer';
  const t = todayKey(), tm1 = addDays(t, 1);
  const other = S.date !== t && S.date !== tm1;
  const f = S.from && STATIONS[S.from], to = S.to && STATIONS[S.to];
  const dark = effectiveTheme() === 'dark';
  const base = S.from || HUB;
  const nx = nextUp(S.from, S.to);
  let nextHtml = '';
  if (nx) {
    const k = todayKey(), delay = delayOf(nx.legs[0].id, k), diff = Math.max(0, nx.dep + delay - nowMin());
    nextHtml = `<button class="next-card" data-a="opennext">
      <span class="eta ${diff <= 2 ? 'now' : ''}">${diff <= 2 ? '<b style="font-size:calc(15px * var(--fs))">zdaj</b>' : diff < 100 ? `<b>${diff}</b><small>min</small>` : `<b style="font-size:calc(16px * var(--fs))">${fmt(nx.dep)}</b>`}</span>
      <span class="tx"><small>Naslednji avtobus${delay ? ` · <span style="color:var(--warn-fg);display:inline">+${delay} min</span>` : ''}</small>
        <strong>${tm(nx.dep)} ${icon('arrow')} ${tm(nx.arr)}</strong>
        <span>${nx.legs.map(l => badge(l.dir.line)).join('')}<span class="meta">&nbsp;${durFmt(nx.dur)}${nx.transfers ? ' · ' + nx.transfers + ' ' + plural(nx.transfers, 'prestop', 'prestopa', 'prestopi', 'prestopov') : ''}</span></span></span>
      ${icon('chev')}</button>`;
  }
  const eco = LINES.filter(l => l.amen.includes('eco')).length;
  return `
  <header class="hero">
    <div class="hero-top">
      <div><p class="eyebrow">${greet} <span class="city">${icon('pin')}${esc(CITYD.name)}</span></p><h1>Kam greš<br>danes?</h1>
        ${CITYD.tagline ? `<p class="tagline">${esc(CITYD.tagline)}</p>` : ''}</div>
      <div class="hero-btns">
        <button class="round-btn" data-a="theme" aria-label="Preklopi temo">${icon(dark ? 'sun' : 'moon')}</button>
        <button class="round-btn" data-a="settings" aria-label="Nastavitve">${icon('gear')}</button>
      </div>
    </div>
    ${heroArt()}
  </header>

  <section class="search-card">
    <button class="field" data-a="pick" data-w="from">
      <span class="dot"></span>
      <span><small>Od</small>${f ? `<strong>${esc(f.name)}</strong><em>${esc(stSub(f))}</em>` : '<strong class="placeholder">Izberi postajo</strong>'}</span>
    </button>
    <div class="field-sep"><button class="swap" data-a="swap" aria-label="Zamenjaj smer">${icon('swap')}</button></div>
    <button class="field" data-a="pick" data-w="to">
      <span class="dot to"></span>
      <span><small>Do</small>${to ? `<strong>${esc(to.name)}</strong><em>${esc(stSub(to))}</em>` : '<strong class="placeholder">Izberi cilj</strong>'}</span>
    </button>
    <div class="when">
      <button class="chip ${S.date === t ? 'on' : ''}" data-a="day" data-d="${t}">Danes</button>
      <button class="chip ${S.date === tm1 ? 'on' : ''}" data-a="day" data-d="${tm1}">Jutri</button>
      <label class="chip ${other ? 'on' : ''}">${icon('cal')}${other ? dateLabel(S.date) : 'Datum'}<input type="date" data-in="date" value="${S.date}" min="${t}" aria-label="Datum"></label>
      <label class="chip ${S.time != null ? 'on' : ''}">${icon('clock')}${S.time != null ? fmt(S.time) : 'Zdaj'}<input type="time" data-in="time" value="${S.time != null ? fmt(S.time) : fmt(nowMin())}" aria-label="Ura"></label>
    </div>
    <button class="cta" data-a="search">Poišči povezave ${icon('arrow')}</button>
  </section>
  ${freqHtml()}
  ${nextHtml ? `<div style="padding:${loggedIn() && freqRoutes(1).length ? '12px' : '0'} 16px 0">${nextHtml}</div>` : ''}

  ${D.favs.length ? `<section class="section"><div class="section-head"><h2>Priljubljene relacije</h2><button data-a="tab" data-t="favs">Vse</button></div>
    <div class="route-list">${D.favs.slice(0, 3).map((r, i) => routeItem(r, i, 'fav')).join('')}</div></section>` : ''}

  ${D.recent.length ? `<section class="section"><div class="section-head"><h2>Nedavna iskanja</h2></div>
    <div class="route-list">${D.recent.slice(0, 3).map((r, i) => routeItem(r, i, 'recent')).join('')}</div></section>` : ''}

  ${INSP.length ? `<section class="section inspo-sec">
    <div class="section-head"><h2>Odkrij ${esc(CITYD.name)}</h2><span class="meta">z postaje ${esc(stName(base))}</span></div>
    <div class="inspo">${INSP.map((it, i) => {
      const fd = it.id === base ? null : fastest(base, it.id);
      return `<button class="inspo-card" data-a="inspo" data-id="${it.id}">${inspoArt(it, i)}
        ${fd ? `<span class="tag">${icon('bus')} ${durFmt(fd)}</span>` : ''}
        <h3>${esc(it.title)}</h3><p>${esc(it.text)}</p></button>`;
    }).join('')}</div>
  </section>` : ''}

  <section class="section stats-sec">
    <div class="stats">
      <div class="stat"><b>${ST_IDS.length}</b><span>postaj</span></div>
      <div class="stat"><b>${LINES.length}</b><span>linij</span></div>
      ${eco ? `<div class="stat"><b>${eco}</b><span>${plural(eco, 'električna linija', 'električni liniji', 'električne linije', 'električnih linij')}</span></div>`
        : `<div class="stat"><b>${DISTRICT_LIST.length}</b><span>${plural(DISTRICT_LIST.length, 'četrt', 'četrti', 'četrti', 'četrti')}</span></div>`}
    </div>
    <p class="foot-note">Enotna vozovnica ${eur(FARED.single)} · prestopi v ${FARED.transferMinutes} min brezplačni</p>
  </section>`;
};

function resultsBody() {
  const t = todayKey();
  let list = search(S.from, S.to, S.date).slice();
  if (S.directOnly) list = list.filter(c => !c.transfers);
  if (S.sort === 'dur') list.sort((a, b) => a.dur - b.dur || a.dep - b.dep);
  if (S.sort === 'price') list.sort((a, b) => a.price - b.price || a.transfers - b.transfers || a.dep - b.dep);
  S.results = list;
  const base = S.time != null ? S.time : S.date === t ? nowMin() : -1;
  const nextIdx = S.sort === 'dep' && base >= 0 ? list.findIndex(c => c.dep >= base) : -1;
  const direct = list.filter(c => !c.transfers).length;
  if (!list.length) return `
  <div class="empty"><div class="em-ic">${icon('bus')}</div><h3>Ni povezav</h3>
    <p>Za izbrani dan med tema postajama ni voženj${S.directOnly ? ' brez prestopa' : ''}. Poskusi drug dan${S.directOnly ? ' ali dovoli prestope' : ''}.</p>
    ${S.directOnly ? `<button class="cta" data-a="direct">${icon('transfer')} Pokaži tudi prestope</button>` : ''}</div>`;
  return `
  <div class="summary"><span><b>${list.length}</b> ${plural(list.length, 'povezava', 'povezavi', 'povezave', 'povezav')} · ${direct} ${plural(direct, 'neposredna', 'neposredni', 'neposredne', 'neposrednih')}</span><span>od <b>${eur(Math.min(...list.map(c => c.price)))}</b></span></div>
  <div class="conn-list">${list.map((c, i) => {
    const st = connStatus(c, S.date);
    const past = S.date === t && c.dep < nowMin() - 1 && S.sort === 'dep';
    const legs = c.legs.map(l => badge(l.dir.line)).join(icon('chev'));
    const via = c.transfers
      ? `<span class="xchip">${icon('transfer')}<span class="nm">${c.legs.slice(0, -1).map(l => esc(stName(l.dir.stops[l.j]))).join(', ')}</span></span>`
      : `<span class="meta">Neposredno</span>`;
    return `<button class="conn ${past ? 'past' : ''} ${i === nextIdx ? 'next' : ''}" data-a="open" data-i="${i}" style="animation-delay:${Math.min(i, 8) * 30}ms">
      ${i === nextIdx ? `<span class="flag">${icon('clock')}Naslednji odhod</span>` : ''}
      <div class="conn-top">
        <div class="times"><strong>${tm(c.dep)}</strong><span class="dur"><i></i>${durFmt(c.dur)}<i class="${c.transfers ? 'dash' : ''}"></i></span><strong>${tm(c.arr)}</strong></div>
        <div class="price">${eur(c.price)}</div>
      </div>
      <div class="conn-bottom"><span class="legs">${legs}</span>${via}
        ${st ? `<span class="pill ${st.cls}">${st.txt}</span>` : ''}</div>
    </button>`;
  }).join('')}</div>`;
}
const skeleton = () => `<div class="skel-line"></div><div class="conn-list">${'<div class="skel"></div>'.repeat(5)}</div>`;

function scrollToNext(v) {
  const nx = v && v.querySelector('.conn.next');
  if (nx && nx.offsetTop > 300) v.scrollTop = nx.offsetTop - 220;
}

SCREENS.results = () => {
  const t = todayKey();
  const isFav = D.favs.some(r => r.from === S.from && r.to === S.to);
  const days = Array.from({ length: 14 }, (_, i) => addDays(t, i));
  const ready = !!cachedSearch(S.from, S.to, S.date);
  if (!ready) {
    setTimeout(() => {
      search(S.from, S.to, S.date);
      const body = $('#res-body');
      if (current() === 'results' && body) { body.innerHTML = resultsBody(); scrollToNext(views.firstElementChild); }
    }, 60);
  }
  return `
  <header class="topbar">
    <button class="round-btn" data-a="back" aria-label="Nazaj">${icon('back')}</button>
    <div class="ttl"><h2><span class="nm">${esc(stName(S.from))}</span> ${icon('arrow')} <span class="nm">${esc(stName(S.to))}</span></h2>
      <p>${dateLabel(S.date, true)} · ${DT_LABEL[dayType(S.date)]}</p></div>
    <button class="round-btn fav ${isFav ? 'on' : ''}" data-a="fav" aria-label="Priljubljeno">${icon('star')}</button>
  </header>
  <div class="days">${days.map(k => {
    const d = parseKey(k), hol = dayType(k) === 'sun';
    return `<button class="day ${k === S.date ? 'on' : ''} ${hol ? 'hol' : ''}" data-a="day" data-d="${k}" ${hol ? `title="${isHoliday(k) ? 'Praznik' : 'Nedelja'} – nedeljski vozni red"` : ''}>
      <small>${k === t ? 'danes' : DAYS_SHORT[d.getDay()]}</small><b>${d.getDate()}</b></button>`;
  }).join('')}</div>
  <div class="filters">
    <button class="chip ${S.sort === 'dep' ? 'on' : ''}" data-a="sort" data-s="dep">${icon('clock')}Odhod</button>
    <button class="chip ${S.sort === 'dur' ? 'on' : ''}" data-a="sort" data-s="dur">Najhitrejše</button>
    <button class="chip ${S.sort === 'price' ? 'on' : ''}" data-a="sort" data-s="price">Najcenejše</button>
    <button class="chip ${S.directOnly ? 'on' : ''}" data-a="direct">Brez prestopa</button>
  </div>
  <div id="res-body">${ready ? resultsBody() : skeleton()}</div>`;
};

/* ---- mini zemljevid ---- */
const MAP_W = 320, MAP_PAD = 12;
const mapGeo = (() => {
  let b = MAPD && MAPD.bounds;
  if (!b) {
    const lons = ST_IDS.map(id => STATIONS[id].lon), lats = ST_IDS.map(id => STATIONS[id].lat);
    const dl = (Math.max(...lons) - Math.min(...lons)) * .08 || .01, da = (Math.max(...lats) - Math.min(...lats)) * .08 || .01;
    b = [Math.min(...lons) - dl, Math.max(...lons) + dl, Math.min(...lats) - da, Math.max(...lats) + da];
  }
  const [x0, x1, y0, y1] = b;
  const kx = Math.cos(((y0 + y1) / 2) * Math.PI / 180);          // ≈ 0,69 pri 46,5° S
  const iw = MAP_W - 2 * MAP_PAD, ih = iw * (y1 - y0) / ((x1 - x0) * kx);
  return { x0, x1, y0, y1, iw, ih, H: Math.round(ih + 2 * MAP_PAD) };
})();
function project(lon, lat) {
  const g = mapGeo;
  return [MAP_PAD + (lon - g.x0) / (g.x1 - g.x0) * g.iw, MAP_PAD + (g.y1 - lat) / (g.y1 - g.y0) * g.ih];
}
const pts = arr => arr.map(([lo, la]) => project(lo, la).map(v => v.toFixed(1)).join(',')).join(' ');
let mapBase = null;
function mapBaseSvg() {
  if (mapBase) return mapBase;
  let s = '';
  if (MAPD && MAPD.outline && MAPD.outline.length) s += `<polygon points="${pts(MAPD.outline)}" fill="var(--map-land)" stroke="var(--map-edge)" stroke-width="1.2" stroke-linejoin="round"/>`;
  if (MAPD && MAPD.pohorje && MAPD.pohorje.length) s += `<polygon points="${pts(MAPD.pohorje)}" fill="var(--map-forest)" stroke="none"/>`;
  (MAPD && (MAPD.rivers || (MAPD.river ? [MAPD.river] : [])) || []).forEach(rv => {
    if (!rv || rv.length < 2) return;
    const rp = pts(rv);
    s += `<polyline points="${rp}" fill="none" stroke="var(--map-water)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity=".35"/>
      <polyline points="${rp}" fill="none" stroke="var(--map-water)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  });
  if (MAPD && MAPD.pohorje && MAPD.pohorje.length) {
    const cx = MAPD.pohorje.reduce((a, p) => a + p[0], 0) / MAPD.pohorje.length, cy = MAPD.pohorje.reduce((a, p) => a + p[1], 0) / MAPD.pohorje.length;
    const [px, py] = project(cx, cy);
    s += `<text class="map-river" x="${px.toFixed(1)}" y="${py.toFixed(1)}" text-anchor="middle" style="fill:var(--faint)">POHORJE</text>`;
  }
  s += ST_IDS.map(id => { const [x, y] = project(STATIONS[id].lon, STATIONS[id].lat); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.3" fill="var(--faint)" opacity=".7"/>`; }).join('');
  return (mapBase = s);
}
function mapSvg(c) {
  let routes = '', nodes = '', labels = '';
  const boxes = [], routePts = [];
  c.legs.forEach(l => l.dir.stops.slice(l.i, l.j + 1).forEach(id => routePts.push(project(STATIONS[id].lon, STATIONS[id].lat))));
  // napis reke tja, kjer je najdlje od poti
  if (MAPD && MAPD.river && MAPD.river.length > 2) {
    let bestP = null, bestD = -1;
    MAPD.river.slice(1, -2).forEach(q => {
      const p = project(q[0], q[1]);
      if (p[0] < 20 || p[0] > MAP_W - 60) return;
      const d = Math.min(...routePts.map(r => Math.hypot(r[0] - p[0], r[1] - p[1])));
      if (d > bestD) { bestD = d; bestP = p; }
    });
    if (bestP) { labels += `<text class="map-river" x="${bestP[0].toFixed(1)}" y="${(bestP[1] - 7).toFixed(1)}" text-anchor="middle">DRAVA</text>`; boxes.push([bestP[0] - 16, bestP[1] - 14, 32, 9]); }
  }
  const hit = (b) => boxes.some(o => b[0] < o[0] + o[2] && b[0] + b[2] > o[0] && b[1] < o[1] + o[3] && b[1] + b[3] > o[1]);
  const placeLabel = (id, q) => {
    const txt = stName(id), w = txt.length * 5.6 + 2, h = 11;
    const opts = [];
    const right = q[0] + 9 + w < MAP_W - 2, left = q[0] - 9 - w > 2;
    if (right) opts.push([q[0] + 9, q[1] + 3.5, 'start']);
    if (left) opts.push([q[0] - 9, q[1] + 3.5, 'end']);
    [[0, -13], [0, 16]].forEach(([, dy]) => opts.push([Math.min(MAP_W - w / 2 - 2, Math.max(w / 2 + 2, q[0])), q[1] + dy, 'middle']));
    let pick = opts[0] || [q[0], q[1] - 12, 'middle'];
    for (const o of opts) {
      const x0 = o[2] === 'start' ? o[0] : o[2] === 'end' ? o[0] - w : o[0] - w / 2;
      const b = [x0, o[1] - 9, w, h];
      if (!hit(b)) { pick = o; break; }
    }
    const x0 = pick[2] === 'start' ? pick[0] : pick[2] === 'end' ? pick[0] - w : pick[0] - w / 2;
    boxes.push([x0, pick[1] - 9, w, h]);
    labels += `<text class="map-stop" x="${pick[0].toFixed(1)}" y="${pick[1].toFixed(1)}" text-anchor="${pick[2]}">${esc(txt)}</text>`;
  };
  c.legs.forEach((l, li) => {
    const p = l.dir.stops.slice(l.i, l.j + 1).map(id => project(STATIONS[id].lon, STATIONS[id].lat));
    const ps = legRoad(l).coords.map(([lo, la]) => project(lo, la)).map(q => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ');
    routes += `<polyline points="${ps}" fill="none" stroke="${l.dir.line.color}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" opacity=".18"/>
      <polyline points="${ps}" fill="none" stroke="${l.dir.line.color}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`;
    p.forEach(([x, y], pi) => {
      const end = pi === 0 || pi === p.length - 1;
      nodes += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${end ? 4.8 : 2.4}" fill="${end ? l.dir.line.color : 'var(--surface)'}" stroke="${end ? 'var(--surface)' : l.dir.line.color}" stroke-width="${end ? 2 : 1.5}"/>`;
    });
    if (li === 0) placeLabel(l.dir.stops[l.i], p[0]);
    placeLabel(l.dir.stops[l.j], p[p.length - 1]);
  });
  return `<svg viewBox="0 0 ${MAP_W} ${mapGeo.H}" role="img" aria-label="Zemljevid poti">${mapBaseSvg()}${routes}${nodes}${labels}</svg>`;
}

SCREENS.detail = () => {
  const c = S.sel, k = S.selDate;
  if (!c) return '';
  const first = c.legs[0], last = c.legs[c.legs.length - 1];
  const from = first.dir.stops[first.i], to = last.dir.stops[last.j];
  const delay = k === todayKey() ? delayOf(first.id, k) : 0;
  const amen = [...new Set(c.legs.flatMap(l => l.dir.line.amen))].filter(a => AMENITIES[a]);
  const st = connStatus(c, k);
  const distance = c.legs.reduce((s, l) => s + l.dir.kms[l.j] - l.dir.kms[l.i], 0);

  const legsHtml = c.legs.map((l, li) => {
    const line = l.dir.line, stops = l.dir.stops.slice(l.i, l.j + 1);
    const prev = c.legs[li - 1];
    const transfer = prev ? `<div class="transfer">${icon('transfer')}<span>Prestop: <b>${esc(stName(stops[0]))}</b>${prev.arr <= l.dep ? ' · ' + (l.dep - prev.arr) + ' min časa' : ''}</span></div>` : '';
    const pr = peron(l.dir, l.i);
    return `${transfer}
    <div class="leg-head">${badge(line)}<div class="tx"><b>Smer ${esc(stName(l.dir.stops[l.dir.stops.length - 1]))}</b><span>${TYPE_LABEL[line.type] || 'mestna linija'} · ${stops.length - 1} ${plural(stops.length - 1, 'postaja', 'postaji', 'postaje', 'postaj')}</span></div>
      ${pr ? `<div class="peron"><small>Peron</small><b>${pr}</b></div>` : ''}</div>
    <ol class="timeline" style="--c:${line.color}">${stops.map((id, si) => {
      const end = si === 0 || si === stops.length - 1;
      return `<li class="${end ? 'end' : ''}"><span class="tm">${tm(l.start + l.dir.off[l.i + si])}</span><span class="nd"><i></i></span>
        <span class="st">${esc(stName(id))}${STATIONS[id].sub && end ? `<small>${esc(STATIONS[id].sub)}</small>` : ''}</span></li>`;
    }).join('')}</ol>`;
  }).join('');

  return `
  <header class="topbar">
    <button class="round-btn" data-a="back" aria-label="Nazaj">${icon('back')}</button>
    <div class="ttl"><h2>Podrobnosti</h2><p>${dateLabel(k, true)} · ${DT_LABEL[dayType(k)]}</p></div>
  </header>
  <section class="trip-hero">
    <div class="th-row">
      <div><div class="t">${fmt(c.dep)}</div><div class="n">${esc(stName(from))}</div></div>
      <div class="th-mid">${durFmt(c.dur)}<div class="ln">${icon('bus')}</div></div>
      <div class="r"><div class="t">${fmt(c.arr)}</div><div class="n">${esc(stName(to))}</div></div>
    </div>
    <div class="th-foot">
      <span>${c.transfers ? c.transfers + ' ' + plural(c.transfers, 'prestop', 'prestopa', 'prestopi', 'prestopov') : 'Brez prestopa'}</span>
      <span>${kmFmt(distance)}</span>
      ${st ? `<span>${st.cls === 'gone' ? 'Že odpeljal' : delay ? `Zamuda +${delay} min` : 'Vozi točno'}</span>` : ''}
    </div>
    ${SET.speak && CAN_SPEAK ? `<button class="speak-btn" data-a="speak">${icon('speaker')}Preberi na glas</button>` : ''}
  </section>
  <section class="card map">
    <div class="view-toggle"><h3>Pot</h3>
      <div class="segctl" role="tablist" aria-label="Pogled poti">
        <button class="${S.view3d ? '' : 'on'}" data-a="mapview" data-v="2d" role="tab" aria-selected="${!S.view3d}">${icon('map')}2D</button>
        <button class="${S.view3d ? 'on' : ''}" data-a="mapview" data-v="3d" role="tab" aria-selected="${S.view3d}">${icon('cube')}3D</button>
      </div></div>
    <div id="mapbox"><div class="r3d" id="r3d"></div></div>
  </section>
  <section class="card">${legsHtml}</section>
  ${amen.length ? `<section class="card"><h3>Na avtobusu</h3><div class="amen">${amen.map(a => `<span class="${a === 'eco' ? 'eco' : ''}">${icon(AMENITIES[a].icon)}${esc(AMENITIES[a].label)}</span>`).join('')}</div></section>` : ''}
  <div class="buybar">
    <div class="p"><small>Cena</small><b>${eur(c.price)}</b></div>
    <button class="cta" data-a="buy">${icon('ticket')} Kupi vozovnico</button>
  </div>`;
};

SCREENS.board = () => {
  const st = STATIONS[S.boardStation] || STATIONS[HUB];
  const n = linesAt(S.boardStation);
  return `
  <div class="page-title"><h1>Odhodi</h1><p>Prikaz odhodov v živo s postajališča</p></div>
  <div class="board-pick"><button class="route-item" data-a="pick" data-w="board">
    <span class="ic">${icon('pin')}</span><span class="tx"><strong><span class="nm">${esc(st.name)}</span></strong><span>${esc(stSub(st))} · ${n} ${plural(n, 'linija', 'liniji', 'linije', 'linij')}</span></span>${icon('chev')}</button></div>
  <section class="board">
    <div class="board-head"><div><h3>${esc(st.name)}</h3><p>${dateLabel(todayKey(), true)} · ${DT_LABEL[dayType(todayKey())]}</p></div><div class="clock" id="clock">${clockText()}</div></div>
    <div class="board-cols"><span>Odhod</span><span>Linija</span><span>Smer</span><span style="text-align:center">Čez</span></div>
    <div id="board-rows">${boardRows()}</div>
  </section>`;
};
function clockText() {
  const d = new Date();
  return `${pad(d.getHours())}<span class="blink">:</span>${pad(d.getMinutes())}`;
}
function boardRows() {
  const k = todayKey(), n = nowMin();
  const deps = departures(S.boardStation, k, n - 2, 30);
  if (!deps.length) return `<div class="empty"><h3>Danes ni več odhodov</h3><p>Prvi odhodi so jutri zjutraj.</p></div>`;
  return deps.map((x, i) => {
    const dir = x.a.dir, delay = delayOf(dir.key + '@' + x.s, k), diff = x.dep + delay - n;
    const dest = dir.stops[dir.stops.length - 1], via = dir.stops[x.a.i + 1];
    let info = via !== dest ? `prek ${esc(stName(via))}` : 'neposredno';
    let cls = '';
    if (diff <= 0) { info = 'odhaja'; cls = 'now'; }
    else if (delay && diff <= 90) { info = `zamuda +${delay} min`; cls = 'late'; }
    const eta = diff <= 0 ? 'zdaj' : diff < 60 ? diff + "'" : fmt(x.dep + delay);
    return `<button class="board-row" data-a="brow" data-k="${dir.key}" data-i="${x.a.i}" data-s="${x.s}" style="animation-delay:${Math.min(i, 12) * 25}ms">
      <span class="bt">${fmt(x.dep)}</span><span>${badge(dir.line, true)}</span>
      <span class="bd"><b>${esc(stName(dest))}</b><span class="${cls}">${info}</span></span>
      <span class="bp ${diff <= 1 ? 'now' : cls === 'late' ? 'late' : ''}">${eta}</span></button>`;
  }).join('');
}

function ticketPast(t) {
  const tk = todayKey();
  if (t.type === 'day') return t.date < tk;
  return t.date < tk || (t.date === tk && Math.max(t.arr, t.validTo || 0) < nowMin());
}
function ticketCard(t, big) {
  const lines = t.lines.map(id => { const l = LINES.find(x => x.id === id); return l ? badge(l, true) : `<span class="badge sm" style="background:${t.color}">${esc(id)}</span>`; }).join('');
  const past = ticketPast(t);
  const d = parseKey(t.date);
  return `<${big ? 'div' : 'button'} class="ticket ${!big && past ? 'used' : ''}" ${big ? '' : `data-a="ticket" data-id="${t.id}"`}>
    <div class="ticket-top"><div class="k"><span>${big ? 'Mestni promet · ' + esc(CITYD.name) : dateLabel(t.date, true)}</span><span class="lns">${lines}</span></div>
      <div class="ticket-route"><div><b>${fmt(t.dep)}</b><span>${esc(stName(t.from))}</span></div>${icon('arrow')}<div class="r"><b>${fmt(t.arr)}</b><span>${esc(stName(t.to))}</span></div></div></div>
    <div class="perf"></div>
    <div class="ticket-bot">
      <div><small>Potnik</small><b>${t.count}× ${TYPES[t.type] ? TYPES[t.type].short : 'odrasli'}</b></div>
      <div><small>${big ? 'Datum' : 'Velja do'}</small><b>${big ? d.getDate() + '. ' + (d.getMonth() + 1) + '.' : t.type === 'day' ? 'polnoči' : fmt(t.validTo || t.arr)}</b></div>
      <div style="text-align:right"><small>Cena</small><b>${eur(t.total)}</b></div>
    </div>
    ${big ? `<div class="qr-wrap"><div class="qr">${qrSvg(t.code)}</div><div class="code">${t.code}</div>
      <span class="valid ${past ? 'off' : ''}"><i></i>${past ? 'Vozovnica je potekla' : t.type === 'day' ? 'Velja ves dan do polnoči' : 'Velja do ' + fmt(t.validTo || t.arr) + ' · prestopi vključeni'}</span>
      <p class="qr-note">${past ? 'Vozovnica je bila že uporabljena.' : 'Pokaži QR kodo vozniku ob vstopu.'}</p></div>` : ''}
  </${big ? 'div' : 'button'}>`;
}

SCREENS.tickets = () => {
  const up = D.tickets.filter(t => !ticketPast(t)).sort((a, b) => (a.date + fmt(a.dep)).localeCompare(b.date + fmt(b.dep)));
  const past = D.tickets.filter(ticketPast).sort((a, b) => b.created - a.created);
  return `
  <div class="page-title"><h1>Vozovnice</h1><p>${up.length ? `${up.length} ${plural(up.length, 'aktivna vozovnica', 'aktivni vozovnici', 'aktivne vozovnice', 'aktivnih vozovnic')}` : 'Tvoje kupljene vozovnice'}</p></div>
  ${!D.tickets.length ? `<div class="empty"><div class="em-ic">${icon('ticket')}</div><h3>Še nimaš vozovnic</h3>
    <p>Poišči povezavo in kupi vozovnico – prikazala se bo tukaj, skupaj s QR kodo za voznika.</p>
    <button class="cta" data-a="tab" data-t="home">${icon('search')} Poišči povezavo</button></div>` : ''}
  ${up.length ? `<div class="tickets-list">${up.map(t => ticketCard(t)).join('')}</div>` : ''}
  ${past.length ? `<div class="section-head" style="padding:16px 20px 0"><h2>Pretekle</h2></div><div class="tickets-list" style="padding-top:8px">${past.map(t => ticketCard(t)).join('')}</div>` : ''}`;
};

SCREENS.ticket = () => {
  const t = D.tickets.find(x => x.id === S.ticket);
  if (!t) return '';
  return `
  <header class="topbar">
    <button class="round-btn" data-a="back" aria-label="Nazaj">${icon('back')}</button>
    <div class="ttl"><h2>Vozovnica</h2><p>${dateLabel(t.date, true)}</p></div>
    <button class="round-btn" data-a="delticket" aria-label="Izbriši">${icon('trash')}</button>
  </header>
  <div style="padding-top:8px">${ticketCard(t, true)}</div>`;
};

SCREENS.favs = () => `
  <div class="page-title"><h1>Shranjeno</h1><p>Priljubljene relacije in zgodovina iskanj</p></div>
  ${!D.favs.length && !D.recent.length ? `<div class="empty"><div class="em-ic">${icon('star')}</div><h3>Nič shranjenega</h3>
    <p>Pri rezultatih iskanja tapni zvezdico in relacija bo vedno pri roki.</p></div>` : ''}
  ${D.favs.length ? `<section class="section" style="padding-top:16px"><div class="section-head"><h2>Priljubljene relacije</h2></div>
    <div class="route-list">${D.favs.map((r, i) => routeItem(r, i, 'fav-edit')).join('')}</div></section>` : ''}
  ${D.recent.length ? `<section class="section"><div class="section-head"><h2>Nedavna iskanja</h2><button data-a="clearrecent">Počisti</button></div>
    <div class="route-list">${D.recent.map((r, i) => routeItem(r, i, 'recent')).join('')}</div></section>` : ''}`;

/* ================= QR (dekorativni) ================= */
function qrSvg(code) {
  const N = 25, r = rng(hash(code)), cells = [];
  const finder = (x, y) => (x < 7 && y < 7) || (x >= N - 7 && y < 7) || (x < 7 && y >= N - 7);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (finder(x, y)) continue;
    if ((x === 7 || y === 7 || x === N - 8 || y === N - 8) && (x < 8 || y < 8) && (x < 8 || x >= N - 8) && !(x >= N - 8 && y >= N - 8)) continue;
    if (r() > 0.52) cells.push(`M${x} ${y}h1v1h-1z`);
  }
  const fp = (x, y) => `M${x} ${y}h7v7h-7zM${x + 1} ${y + 1}v5h5v-5zM${x + 2} ${y + 2}h3v3h-3z`;
  return `<svg viewBox="0 0 ${N} ${N}" shape-rendering="crispEdges"><path fill="#1E1214" fill-rule="evenodd" d="${fp(0, 0)}${fp(N - 7, 0)}${fp(0, N - 7)}${cells.join('')}"/></svg>`;
}

/* ================= Lokacija ================= */
const KM_LAT = 110.574;
const LAT0 = mapGeo.y0, LON0 = mapGeo.x0, KM_LON = 111.32 * Math.cos(((mapGeo.y0 + mapGeo.y1) / 2) * Math.PI / 180);
const toKm = (lon, lat) => [(lon - LON0) * KM_LON, (lat - LAT0) * KM_LAT];
const kmBetween = (a, b) => { const p = toKm(a.lon, a.lat), q = toKm(b.lon, b.lat); return Math.hypot(p[0] - q[0], p[1] - q[1]); };
const inCity = p => p.lon >= mapGeo.x0 - .01 && p.lon <= mapGeo.x1 + .01 && p.lat >= mapGeo.y0 - .01 && p.lat <= mapGeo.y1 + .01;
const distFmt = k => k < 1 ? Math.round(k * 100) * 10 + ' m' : kmFmt(k);
let myLoc = null;     // { lon, lat, acc, at }
function locate(cb) {
  if (myLoc && Date.now() - myLoc.at < 60000) return cb(null, myLoc);
  if (!navigator.geolocation) return cb('unsupported');
  navigator.geolocation.getCurrentPosition(
    p => { myLoc = { lon: p.coords.longitude, lat: p.coords.latitude, acc: p.coords.accuracy || 50, at: Date.now() }; cb(null, myLoc); },
    e => cb(e && e.code === 1 ? 'denied' : 'error'),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
}
function nearestStop(p) {
  let best = null, bd = Infinity;
  ST_IDS.forEach(id => { const d = kmBetween(p, STATIONS[id]); if (d < bd) { bd = d; best = id; } });
  return { id: best, km: bd };
}
const locError = e => e === 'denied' ? 'Dostop do lokacije je zavrnjen. Dovoli ga v nastavitvah telefona.' : e === 'unsupported' ? 'Ta naprava ne podpira lokacije.' : 'Lokacije ni bilo mogoče določiti.';

/* ================= Nastavitve ================= */
const FS_OPTS = [['s', 'Majhna', .9], ['m', 'Običajna', 1], ['l', 'Velika', 1.15], ['xl', 'Zelo velika', 1.32]];
const sw = on => `<span class="switch ${on ? 'on' : ''}" aria-hidden="true"></span>`;
function togRow(k, ic, title, desc) {
  return `<button class="set-row" data-a="settog" data-k="${k}" role="switch" aria-checked="${!!SET[k]}">
    <span class="ic">${icon(ic)}</span><span class="tx"><b>${title}</b><span>${desc}</span></span>${sw(SET[k])}</button>`;
}
function themeBlock() {
  const cur = D.theme || 'auto';
  return `<div class="theme-pick" role="radiogroup" aria-label="Tema">${[['auto', 'Samodejno', 'a'], ['light', 'Svetla', 'l'], ['dark', 'Temna', 'd']].map(([v, n, c]) =>
    `<button class="${cur === v ? 'on' : ''}" data-a="settheme" data-v="${v}" role="radio" aria-checked="${cur === v}"><span class="mini ${c}"><i></i><span><em></em><em></em><em></em></span></span>${n}</button>`).join('')}</div>`;
}
function fsBlock() {
  return `<div class="fs-pick" role="radiogroup" aria-label="Velikost pisave">${FS_OPTS.map(([v, n, k]) =>
    `<button class="${SET.fs === v ? 'on' : ''}" data-a="setfs" data-v="${v}" role="radio" aria-checked="${SET.fs === v}"><b style="font-size:${Math.round(18 * k)}px">Aa</b><small>${n}</small></button>`).join('')}</div>
    <div class="fs-preview"><b>12:25 → 12:37 · linija 3</b><span>Takole bo videti besedilo v aplikaciji.</span></div>`;
}
function comfortRows() {
  return togRow('simple', 'simple', 'Poenostavljen pogled', 'Manj okraskov, večji gumbi in samo najpomembnejše') +
    togRow('motion', 'motion', 'Zmanjšaj animacije', 'Brez premikanja in prehodov na zaslonu') +
    (CAN_VIBRATE ? togRow('vibrate', 'vibrate', 'Vibriranje ob dotiku', 'Kratek odziv, ko pritisneš gumb') : '') +
    (CAN_SPEAK ? togRow('speak', 'speaker', 'Glasovno branje', 'Gumb »Preberi na glas« pri podrobnostih vožnje') : '');
}
SCREENS.settings = () => `
  <header class="topbar">
    <button class="round-btn" data-a="back" aria-label="Nazaj">${icon('back')}</button>
    <div class="ttl"><h2>Nastavitve</h2><p>Prikaz, dostopnost in potovanje</p></div>
  </header>
  <div class="set-title">Videz</div>
  <div class="set-card">${themeBlock()}${togRow('contrast', 'contrast', 'Visok kontrast', 'Temnejše besedilo in izrazitejši robovi')}</div>
  <div class="set-title">Besedilo</div>
  <div class="set-card">${fsBlock()}${togRow('bold', 'bold', 'Krepkejša pisava', 'Debelejše črke za lažje branje')}</div>
  <div class="set-title">Udobje</div>
  <div class="set-card">${comfortRows()}</div>
  <div class="set-title">Potovanje</div>
  <div class="set-card">
    <button class="set-row" data-a="pick" data-w="home"><span class="ic">${icon('home')}</span><span class="tx"><b>Domača postaja</b><span>Privzeti začetek iskanja in tabla odhodov</span></span><span class="val">${SET.home ? esc(stName(SET.home)) : 'Ni izbrana'}</span>${icon('chev')}</button>
    <div class="set-row" style="flex-wrap:wrap"><span class="ic">${icon('map')}</span><span class="tx"><b>Izbira postaje</b><span>Kaj se najprej odpre pri izbiri postaje</span></span></div>
    <div class="segctl"><button class="${SET.pickMode === 'map' ? 'on' : ''}" data-a="setpick" data-v="map">${icon('map')}Zemljevid</button><button class="${SET.pickMode === 'list' ? 'on' : ''}" data-a="setpick" data-v="list">${icon('list')}Seznam</button></div>
    ${togRow('view3d', 'cube', 'Pot najprej v 3D', 'Podrobnosti vožnje odpre s 3D prikazom poti')}
  </div>
  <div class="set-card" style="margin-top:20px">
    <button class="set-row" data-a="onboard"><span class="ic">${icon('refresh')}</span><span class="tx"><b>Ponovi uvodno nastavitev</b><span>Znova odpri vodič ob prvem zagonu</span></span>${icon('chev')}</button>
  </div>
  <button class="danger-btn" data-a="wipe">${icon('trash')}Izbriši vse podatke</button>
  <p class="set-foot">Vozni red Maribor · različica 1.5<br>Lokacije postaj so prave, vozni redi so izmišljeni (demo).</p>`;

/* ================= Uvodni vodič (prvi zagon) ================= */
const OB = { i: 0, el: null, note: '' };
const OB_STEPS = [
  () => `<div class="ob-hero"><svg class="bgart" viewBox="0 0 400 210" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <path d="M0 150 C60 120 120 128 180 110 C240 92 300 104 400 96 V210 H0Z" fill="rgba(255,255,255,.08)"/>
      <path d="M0 176 C80 160 160 170 240 156 C300 146 350 150 400 144 V210 H0Z" fill="rgba(255,255,255,.07)"/>
      <path d="M40 186 H360" stroke="rgba(255,255,255,.4)" stroke-width="3"/>
      ${[0, 1, 2, 3, 4, 5].map(k => `<path d="M${40 + k * 53} 186 Q${66 + k * 53} 160 ${93 + k * 53} 186" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="2.4"/>`).join('')}
    </svg><div class="logo">${icon('bus')}</div></div>
    <div class="ob-head"><h1>Dobrodošel v aplikaciji Vozni red ${esc(CITYD.name)}</h1><p>V nekaj korakih si prilagodi prikaz, da bo branje voznih redov čim lažje. Vse lahko kasneje spremeniš v nastavitvah.</p></div>
    <div class="ob-feats">
      <div>${icon('search')}Povezave med vsemi ${ST_IDS.length} postajami, tudi s prestopi</div>
      <div>${icon('map')}Zemljevid postaj in tvoja trenutna lokacija</div>
      <div>${icon('cube')}3D prikaz poti, po kateri se pelješ</div>
    </div>`,
  () => `<div class="ob-head"><h1>Kako naj bo videti?</h1><p>Izberi temo. Samodejno sledi nastavitvi telefona.</p></div>
    ${themeBlock()}
    <div class="set-card">${togRow('contrast', 'contrast', 'Visok kontrast', 'Priporočeno za slabovidne – temnejše besedilo in jasni robovi')}</div>`,
  () => `<div class="ob-head"><h1>Velikost pisave</h1><p>Izberi velikost, ki jo najlažje bereš. Predogled se spremeni takoj.</p></div>
    ${fsBlock()}
    <div class="set-card">${togRow('bold', 'bold', 'Krepkejša pisava', 'Debelejše črke za lažje branje')}</div>`,
  () => `<div class="ob-head"><h1>Udobje uporabe</h1><p>Dodatne možnosti za lažjo uporabo aplikacije.</p></div>
    <div class="set-card">${comfortRows()}</div>`,
  () => `<div class="ob-head"><h1>Tvoja domača postaja</h1><p>Od tu bo aplikacija privzeto iskala povezave in prikazovala odhode.</p></div>
    <button class="loc-btn" data-a="obloc">${icon('locate')}Najbližja postaja glede na mojo lokacijo</button>
    <p class="loc-note" id="ob-note">${esc(OB.note)}</p>
    <div class="set-title" style="padding-top:8px">Ali izberi vozlišče</div>
    <div class="hub-pick">${ST_IDS.filter(id => STATIONS[id].hub).map(id => `<button class="chip ${SET.home === id ? 'on' : ''}" data-a="obhome" data-id="${id}">${icon(SET.home === id ? 'home' : 'bus')}${esc(stName(id))}</button>`).join('')}</div>
    <div class="set-card"><button class="set-row" data-a="pick" data-w="home"><span class="ic">${icon('map')}</span><span class="tx"><b>Izberi na zemljevidu</b><span>${SET.home ? 'Izbrano: ' + esc(stName(SET.home)) : 'Katera koli od ' + ST_IDS.length + ' postaj'}</span></span>${icon('chev')}</button></div>`,
];
function renderOnboard() {
  const n = OB_STEPS.length, last = OB.i === n - 1;
  OB.el.innerHTML = `<div class="ob-top"><div class="ob-dots" aria-label="Korak ${OB.i + 1} od ${n}">${OB_STEPS.map((_, k) => `<i class="${k === OB.i ? 'on' : ''}"></i>`).join('')}</div>
      ${last ? '<span></span>' : '<button class="ob-skip" data-a="obdone">Preskoči</button>'}</div>
    <div class="ob-body"><div class="ob-step">${OB_STEPS[OB.i]()}</div></div>
    <div class="ob-bar">${OB.i > 0 ? `<button class="ghost" data-a="obprev" aria-label="Nazaj">${icon('back')}</button>` : ''}
      <button class="cta" data-a="${last ? 'obdone' : 'obnext'}">${last ? 'Začni uporabljati' : OB.i === 0 ? 'Začnimo' : 'Naprej'} ${icon('arrow')}</button></div>`;
}
function openOnboard() {
  OB.i = 0; OB.note = '';
  if (!OB.el) { OB.el = document.createElement('div'); OB.el.className = 'onboard'; OB.el.setAttribute('role', 'dialog'); OB.el.setAttribute('aria-label', 'Uvodna nastavitev'); }
  OB.el.classList.remove('hide');
  $('#app').appendChild(OB.el);
  renderOnboard();
}
function closeOnboard() {
  D.onboarded = true; store.save();
  if (SET.home) { S.from = SET.home; S.boardStation = SET.home; if (S.to === SET.home) S.to = (INSP.find(it => it.id !== SET.home) || {}).id || ST_IDS.find(id => id !== SET.home); }
  render('none');
  OB.el.classList.add('hide');
  setTimeout(() => { if (OB.el && OB.el.classList.contains('hide')) OB.el.remove(); }, reduceMotion() ? 0 : 360);
}
function refreshUI() {
  if (OB.el && OB.el.isConnected && !OB.el.classList.contains('hide')) {
    const b = OB.el.querySelector('.ob-body'), y = b ? b.scrollTop : 0;
    renderOnboard();
    const b2 = OB.el.querySelector('.ob-body'); if (b2) { b2.scrollTop = y; const st = b2.querySelector('.ob-step'); if (st) st.style.animation = 'none'; }
  } else {
    const v = views.firstElementChild, y = v ? v.scrollTop : 0;
    render('none');
    if (views.firstElementChild) views.firstElementChild.scrollTop = y;
  }
}

/* ================= Zemljevid postaj (izbirnik) ================= */
const SMAP = { vb: null, el: null, sel: null, cw: 0, ch: 0 };
const linesOf = id => { const seen = new Set(), out = []; (STOP_DIRS[id] || []).forEach(a => { if (!seen.has(a.dir.line.id)) { seen.add(a.dir.line.id); out.push(a.dir.line); } }); return out; };
function smFit() {
  const r = SMAP.el.getBoundingClientRect();
  SMAP.cw = r.width || 300; SMAP.ch = r.height || 300;
  // prilagodi pogled vsem postajam (z robom)
  const P = ST_IDS.map(id => project(STATIONS[id].lon, STATIONS[id].lat));
  let x0 = Math.min(...P.map(p => p[0])), x1 = Math.max(...P.map(p => p[0])), y0 = Math.min(...P.map(p => p[1])), y1 = Math.max(...P.map(p => p[1]));
  const mx = (x1 - x0) * .1 + 8, my = (y1 - y0) * .12 + 14;
  x0 -= mx; x1 += mx; y0 -= my; y1 += my;
  const a = SMAP.cw / SMAP.ch;
  let w = x1 - x0, h = y1 - y0;
  if (w / h > a) h = w / a; else w = h * a;
  SMAP.vb = { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - h / 2, w, h };
}
function smFocus(lon, lat, w) {
  if (SMAP.ml) { SMAP.ml.focus(lon, lat, 15.6); return; }
  const [x, y] = project(lon, lat), a = SMAP.cw / SMAP.ch;
  SMAP.vb = { w, h: w / a, x: x - w / 2, y: y - w / a / 2 };
}
function smDraw() {
  if (SMAP.ml) { SMAP.ml.select(SMAP.sel, false); if (myLoc && inCity(myLoc)) SMAP.ml.setMe(myLoc); return; }
  const vb = SMAP.vb, k = vb.w / SMAP.cw;            // enot SVG na zaslonski piksel
  const svg = SMAP.el.querySelector('svg.sm');
  svg.setAttribute('viewBox', `${vb.x.toFixed(2)} ${vb.y.toFixed(2)} ${vb.w.toFixed(2)} ${vb.h.toFixed(2)}`);
  let dyn = '';
  if (myLoc && inCity(myLoc)) {
    const [x, y] = project(myLoc.lon, myLoc.lat), accR = myLoc.acc / 1000 * (mapGeo.iw / ((mapGeo.x1 - mapGeo.x0) * KM_LON));
    dyn += `<circle cx="${x}" cy="${y}" r="${Math.max(accR, 6 * k)}" fill="rgba(30,111,224,.12)" stroke="rgba(30,111,224,.35)" stroke-width="${k}"/>
      <circle class="sm-pulse" cx="${x}" cy="${y}" r="${9 * k}" fill="rgba(30,111,224,.35)"/>
      <circle cx="${x}" cy="${y}" r="${7 * k}" fill="#1E6FE0" stroke="#fff" stroke-width="${2.5 * k}"/>`;
  }
  const boxes = [], labels = [];
  const fsz = 11.5 * k * (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fs')) || 1);
  const order = ST_IDS.slice().sort((a, b) => (b === SMAP.sel) - (a === SMAP.sel) || (!!STATIONS[b].hub) - (!!STATIONS[a].hub));
  order.forEach(id => {
    const s = STATIONS[id], [x, y] = project(s.lon, s.lat), sel = id === SMAP.sel;
    if (!sel && !(s.hub ? k < 1.3 : k < .5)) return;
    const w = s.name.length * fsz * .56, h = fsz * 1.2, bx = [x - w / 2, y - 9 * k - h, w, h];
    if (!sel && boxes.some(o => bx[0] < o[0] + o[2] && bx[0] + bx[2] > o[0] && bx[1] < o[1] + o[3] && bx[1] + bx[3] > o[1])) return;
    boxes.push(bx);
    labels.push(`<text class="sm-label ${sel ? 'sel' : ''}" x="${x}" y="${y - 9 * k}" text-anchor="middle" font-size="${(sel ? fsz * 1.15 : fsz).toFixed(2)}" stroke-width="${3 * k}">${esc(s.name)}</text>`);
  });
  ST_IDS.forEach(id => {
    const s = STATIONS[id], [x, y] = project(s.lon, s.lat), sel = id === SMAP.sel, home = id === SET.home;
    const r = (sel ? 9 : s.hub ? 6.5 : 5) * k;
    dyn += `<circle cx="${x}" cy="${y}" r="${r}" fill="${sel ? 'var(--primary)' : s.hub ? 'var(--primary-fill)' : 'var(--surface)'}" stroke="${sel ? '#fff' : 'var(--primary)'}" stroke-width="${(sel ? 3 : 2) * k}"/>`;
    if (home && !sel) dyn += `<circle cx="${x}" cy="${y}" r="${r + 3.5 * k}" fill="none" stroke="var(--star)" stroke-width="${2 * k}"/>`;
  });
  svg.querySelector('#sm-dyn').innerHTML = dyn + labels.join('');
}
function smInfo(html, hint) {
  const box = sheet.querySelector('#sm-info');
  if (box) { box.className = 'sm-info' + (hint ? ' hint' : ''); box.innerHTML = html; }
}
function smSelect(id, note) {
  SMAP.sel = id;
  const s = STATIONS[id], ls = linesOf(id);
  const d = myLoc && inCity(myLoc) ? kmBetween(myLoc, s) : null;
  smInfo(`<span class="tx"><b>${esc(s.name)}</b><span>${note ? esc(note) + ' · ' : ''}${esc(s.reg || s.sub || '')}${d != null ? ' · ' + distFmt(d) + ' peš (~' + Math.max(1, Math.round(d / 0.08)) + ' min)' : ''}</span>
    <span class="lines">${ls.map(l => badge(l, true)).join('')}</span></span>
    <button class="cta" data-a="pickst" data-id="${id}">Izberi</button>`);
  smDraw();
}
function smLocate(auto) {
  const btn = sheet.querySelector('.sm-ctrl .loc');
  if (btn) btn.classList.add('busy');
  if (!auto) smInfo(`${icon('locate')}<span class="tx">Iščem tvojo lokacijo …</span>`, true);
  locate((err, p) => {
    if (btn) btn.classList.remove('busy');
    if (!SMAP.el || !SMAP.el.isConnected) return;
    if (err) { if (!auto || !SMAP.sel) smInfo(`${icon('info')}<span class="tx">${locError(err)} Postajo lahko izbereš tudi s tapom na zemljevidu.</span>`, true); return; }
    if (!inCity(p)) {
      const km = kmBetween(p, STATIONS[HUB]);
      smInfo(`${icon('info')}<span class="tx">Nahajaš se približno ${Math.round(km)} km od Maribora. Tapni postajo na zemljevidu.</span>`, true);
      return;
    }
    const n = nearestStop(p);
    smFocus(p.lon, p.lat, SMAP.vb ? Math.min(SMAP.vb.w, 90) : 90);
    smSelect(n.id, 'Najbližja postaja');
  });
}
function initStopMap() {
  SMAP.el = sheet.querySelector('#stopmap');
  if (!SMAP.el) return;
  SMAP.sel = null;
  smFit();
  const cur = S.picker === 'board' ? S.boardStation : S.picker === 'home' ? SET.home : S[S.picker];
  // pravi zemljevid (MapLibre); brez interneta ostane shematski SVG
  if (SMAP.ml) { SMAP.ml.destroy(); SMAP.ml = null; }
  if (window.StopMap) {
    const box = document.createElement('div'); box.className = 'sm-ml';
    SMAP.el.prepend(box); SMAP.el.classList.add('ml');
    SMAP.ml = window.StopMap.mount(box, {
      stations: ST_IDS.map(id => ({ id, name: STATIONS[id].name, lon: STATIONS[id].lon, lat: STATIONS[id].lat, hub: !!STATIONS[id].hub })),
      lines: LINES.map(l => ({ color: l.color, coords: l.stops.slice(1).reduce((acc, id, k) => acc.concat(roadPath(l.stops[k], id).slice(acc.length ? 1 : 0)), []) })),
      selected: cur && STATIONS[cur] ? cur : null, home: SET.home, dark: effectiveTheme() === 'dark', center: [STATIONS[HUB].lon, STATIONS[HUB].lat],
      fs: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fs')) || 1,
      onSelect: id => { haptic(); smSelect(id); },
      onFail: () => { box.remove(); SMAP.ml = null; if (SMAP.el) { SMAP.el.classList.remove('ml'); smDraw(); } },
    });
  }
  smDraw();
  smInfo(`${icon('pin')}<span class="tx">Tapni postajo na zemljevidu, da vidiš njeno ime in linije.</span>`, true);
  if (cur && STATIONS[cur]) smSelect(cur, 'Trenutno izbrana');
  smLocate(true);
  // premikanje in povečava
  const ptrs = new Map();
  let moved = 0, pinch0 = 0, vb0 = null, mid0 = null;
  const toSvg = (cx, cy) => { const r = SMAP.el.getBoundingClientRect(); return [SMAP.vb.x + (cx - r.left) / SMAP.cw * SMAP.vb.w, SMAP.vb.y + (cy - r.top) / SMAP.ch * SMAP.vb.h]; };
  const zoomAt = (f, sx, sy) => {
    const vb = SMAP.vb, nw = Math.max(28, Math.min(MAP_W * 1.4, vb.w * f)), rf = nw / vb.w;
    SMAP.vb = { x: sx - (sx - vb.x) * rf, y: sy - (sy - vb.y) * rf, w: nw, h: vb.h * rf };
    smDraw();
  };
  SMAP.zoomAt = zoomAt;
  const el = SMAP.el;
  el.addEventListener('pointerdown', e => {
    if (SMAP.ml || e.target.closest('.sm-ctrl')) return;
    el.setPointerCapture && el.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.size === 1) moved = 0;
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); vb0 = { ...SMAP.vb }; mid0 = toSvg((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
  });
  el.addEventListener('pointermove', e => {
    if (SMAP.ml || !ptrs.has(e.pointerId)) return;
    const prev = ptrs.get(e.pointerId);
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.size === 1) {
      const dx = e.clientX - prev[0], dy = e.clientY - prev[1];
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 5) {
        el.classList.add('drag');
        SMAP.vb.x -= dx / SMAP.cw * SMAP.vb.w; SMAP.vb.y -= dy / SMAP.ch * SMAP.vb.h;
        smDraw();
      }
    } else if (ptrs.size === 2 && pinch0) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      moved = 99;
      SMAP.vb = { ...vb0 };
      zoomAt(pinch0 / d, mid0[0], mid0[1]);
    }
  });
  const end = e => {
    if (SMAP.ml) return;
    const tap = ptrs.size === 1 && moved <= 6 && ptrs.has(e.pointerId);
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch0 = 0;
    el.classList.remove('drag');
    if (!tap || e.target.closest('.sm-ctrl')) return;
    const r = el.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    let best = null, bd = 24;
    ST_IDS.forEach(id => {
      const [x, y] = project(STATIONS[id].lon, STATIONS[id].lat);
      const sx = (x - SMAP.vb.x) / SMAP.vb.w * SMAP.cw, sy = (y - SMAP.vb.y) / SMAP.vb.h * SMAP.ch;
      const d = Math.hypot(sx - px, sy - py);
      if (d < bd) { bd = d; best = id; }
    });
    if (best) { haptic(); smSelect(best); }
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); pinch0 = 0; el.classList.remove('drag'); });
  el.addEventListener('wheel', e => { if (SMAP.ml) return; e.preventDefault(); const [sx, sy] = toSvg(e.clientX, e.clientY); zoomAt(Math.exp(e.deltaY * .0015), sx, sy); }, { passive: false });
}
function pickerBody(mode) {
  if (mode === 'list') return `<div class="st-list" id="st-list">${stationList('')}</div>`;
  return `<div class="stopmap-wrap">
    <div class="stopmap" id="stopmap">
      <svg class="sm" viewBox="0 0 ${MAP_W} ${mapGeo.H}" role="img" aria-label="Zemljevid postaj">${mapBaseSvg()}<g id="sm-dyn"></g></svg>
      <div class="sm-ctrl">
        <button class="loc" data-a="smloc" aria-label="Moja lokacija">${icon('locate')}</button>
        <button data-a="smzoom" data-v="in" aria-label="Povečaj">+</button>
        <button data-a="smzoom" data-v="out" aria-label="Pomanjšaj">−</button>
      </div>
      <div class="sm-legend"><span><i style="background:var(--primary-fill)"></i>vozlišče</span><span><i style="background:var(--surface);box-shadow:0 0 0 2px var(--primary) inset"></i>postaja</span><span><i style="background:#1E6FE0"></i>ti</span></div>
    </div>
    <div class="sm-info hint" id="sm-info"></div>
  </div>`;
}
function setPickMode(mode) {
  if (SMAP.ml) { SMAP.ml.destroy(); SMAP.ml = null; }
  S.pickMode = mode;
  sheet.querySelectorAll('.pick-mode button').forEach(b => b.classList.toggle('on', b.dataset.v === mode));
  const host = sheet.querySelector('#pick-body');
  host.innerHTML = pickerBody(mode);
  host.style.display = 'flex'; host.style.flexDirection = 'column'; host.style.flex = '1'; host.style.minHeight = '0';
  if (mode === 'map') initStopMap();
}

/* ================= Prave ceste (OpenStreetMap) ================= */
const ROADSD = typeof ROADS !== 'undefined' ? ROADS : {};
function roadPath(a, b) {
  const A = STATIONS[a], B = STATIONS[b];
  if (ROADSD[a + '>' + b]) return ROADSD[a + '>' + b];
  if (ROADSD[b + '>' + a]) return ROADSD[b + '>' + a].slice().reverse();
  return [[A.lon, A.lat], [B.lon, B.lat]];
}
/* koordinate ceste za vožnjo (leg) + indeks točke za vsako postajo */
function legRoad(l) {
  const ids = l.dir.stops.slice(l.i, l.j + 1), coords = [], at = [0];
  ids.forEach((id, k) => {
    if (k === 0) { coords.push([STATIONS[id].lon, STATIONS[id].lat]); return; }
    const seg = roadPath(ids[k - 1], id);
    seg.slice(1).forEach(p => coords.push(p));
    at.push(coords.length - 1);
  });
  return { ids, coords, at };
}

/* ================= 3D pot ================= */
let r3d = null;
function legsInfo(c) {
  return c.legs.map((l, li) => {
    const r = legRoad(l);
    return {
      l, r,
      stops: r.ids.map((id, k) => ({
        id, lon: STATIONS[id].lon, lat: STATIONS[id].lat, name: STATIONS[id].name, t: l.start + l.dir.off[l.i + k], at: r.at[k],
        end: (li === 0 && k === 0) || (li === c.legs.length - 1 && k === r.ids.length - 1),
        transfer: (k === 0 && li > 0) || (k === r.ids.length - 1 && li < c.legs.length - 1),
      })),
    };
  });
}
function mountCanvas3d(host, info, why) {
  if (!window.Route3D) return null;
  host.className = 'r3d';
  const conv = arr => (arr || []).map(([lo, la]) => toKm(lo, la));
  // vmesne točke ceste (brez imena) dobijo čas po razdalji med postajama
  const legs = info.map(({ l, r, stops }) => {
    const pts = [];
    stops.forEach((s, k) => {
      if (k > 0) {
        const A = stops[k - 1], seg = r.coords.slice(A.at, s.at + 1);
        let tot = 0; const d = [0];
        for (let q = 1; q < seg.length; q++) { tot += Math.hypot(...[0, 1].map(i => (toKm(...seg[q])[i] - toKm(...seg[q - 1])[i]))); d.push(tot); }
        for (let q = 1; q < seg.length - 1; q++) { const [x, y] = toKm(seg[q][0], seg[q][1]); pts.push({ x, y, via: true, t: A.t + (s.t - A.t) * (tot ? d[q] / tot : 0) }); }
      }
      const [x, y] = toKm(s.lon, s.lat);
      pts.push({ x, y, name: s.name, t: s.t, end: s.end, transfer: s.transfer });
    });
    return { color: l.dir.line.color, line: l.dir.line.id, pts };
  });
  const inst = window.Route3D.mount(host, {
    legs,
    ctx: { outline: MAPD && conv(MAPD.outline), rivers: MAPD && (MAPD.rivers || [MAPD.river]).filter(Boolean).map(conv), forest: MAPD && conv(MAPD.pohorje), stations: ST_IDS.map(id => toKm(STATIONS[id].lon, STATIONS[id].lat)) },
    reduceMotion: reduceMotion(),
  });
  if (why) {
    const n = document.createElement('p'); n.className = 'm3d-note';
    n.innerHTML = `${icon('info')}<span>${why === 'offline' ? 'Za pravi 3D zemljevid ulic potrebuješ internet – prikazan je poenostavljen pogled.' : 'Ta naprava ne podpira 3D zemljevida – prikazan je poenostavljen pogled.'}</span>`;
    host.after(n);
  }
  return inst;
}
function mount3d() {
  if (r3d) { r3d.destroy(); r3d = null; }
  const host = document.getElementById('r3d');
  if (!host || !S.sel) return;
  const info = legsInfo(S.sel), flat = !S.view3d;
  // brez interneta: 2D -> shematski zemljevid, 3D -> poenostavljen 3D prikaz
  const fallback = (el, why) => {
    if (flat) { r3d = null; el.className = ''; el.innerHTML = mapSvg(S.sel); return; }
    r3d = mountCanvas3d(el, info, why);
  };
  if (window.Map3D) {
    r3d = window.Map3D.mount(host, {
      legs: info.map(({ l, r, stops }) => ({ id: l.dir.line.id, color: l.dir.line.color, coords: r.coords, stops })),
      fallback, reduceMotion: reduceMotion(), flat, dark: effectiveTheme() === 'dark',
      fs: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fs')) || 1,
    });
  } else fallback(host);
}
function speakTrip() {
  if (!CAN_SPEAK || !S.sel) return;
  const c = S.sel, f = c.legs[0], l = c.legs[c.legs.length - 1];
  const say = t => t.replace(':', ' in ');
  let txt = `Odhod ob ${say(fmt(c.dep))} s postaje ${stName(f.dir.stops[f.i])}, linija ${f.dir.line.id}, v smeri ${stName(f.dir.stops[f.dir.stops.length - 1])}. `;
  c.legs.slice(1).forEach(x => { txt += `Prestop na postaji ${stName(x.dir.stops[x.i])} na linijo ${x.dir.line.id} ob ${say(fmt(x.dep))}. `; });
  txt += `Prihod ob ${say(fmt(c.arr))} na postajo ${stName(l.dir.stops[l.j])}. Vožnja traja ${durFmt(c.dur).replace('h', 'ur').replace('min', 'minut')}.`;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(txt); u.lang = 'sl-SI'; u.rate = .95;
    const v = speechSynthesis.getVoices().find(x => /^sl/i.test(x.lang)); if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch (e) { toast('Glasovno branje ni na voljo'); }
}
function haptic() { if (SET.vibrate && CAN_VIBRATE) { try { navigator.vibrate(8); } catch (e) {} } }

/* ================= Račun in avatar ================= */
const HAS_ACC = typeof window.Acc !== 'undefined';
const loggedIn = () => HAS_ACC && Acc.loggedIn && !!Acc.profile;
const AV = window.Avatar;
const orderTotal = () => Math.round(unitPrice(S.buy.type) * S.buy.count * 100) / 100;

/* --- sinhronizacija lokalnih podatkov z računom --- */
const okRoute = r => r && STATIONS[r.from] && STATIONS[r.to];
function syncFromAccount() {
  if (!loggedIn()) return;
  const d = Acc.profile.data;
  D.recent = (d.recents || []).filter(okRoute).slice(0, 8);
  const fk = r => r.from + '>' + r.to;
  const favs = [...(d.favs || []).filter(okRoute)];
  D.favs.forEach(r => { if (!favs.some(x => fk(x) === fk(r))) favs.push(r); });
  D.favs = favs;
  const tk = [...(d.tickets || []).filter(t => t && STATIONS[t.from] && STATIONS[t.to])];
  D.tickets.forEach(t => { if (!tk.some(x => x.id === t.id)) tk.push(t); });
  D.tickets = tk;
  baseSave();
  Acc.save(p => { p.data.recents = D.recent; p.data.favs = D.favs; p.data.tickets = D.tickets.slice(-60); });
}
const baseSave = store.save;
store.save = () => {
  baseSave();
  if (loggedIn()) Acc.save(p => { p.data.recents = D.recent; p.data.favs = D.favs; p.data.tickets = D.tickets.slice(-60); });
};

function freqRoutes(n) {
  if (!loggedIn()) return [];
  const rc = Acc.profile.data.routeCounts || {};
  return Object.entries(rc).map(([k, c]) => { const [from, to] = k.split('>'); return { from, to, c }; })
    .filter(r => okRoute(r) && r.c >= 3).sort((a, b) => b.c - a.c).slice(0, n || 3);
}
function freqHtml() {
  if (!loggedIn()) {
    if (!HAS_ACC) return '';
    return `<section class="section"><button class="acc-cta" data-a="tab" data-t="profile">
      <span class="av-stack">${AV ? AV.svg({ hair: 'curly', hairColor: '#1E1214', skin: '#C98E62', bg: '#FFD3C2', outfit: '#1F4FB4', eyes: 'happy' }, 40) + AV.svg({ hair: 'long', hairColor: '#C98B4B', bg: '#FDE3E7', mouth: 'grin' }, 40) + AV.svg({ hair: 'cap', outfit: '#C8102E', bg: '#E9D7FF', eyes: 'wink' }, 40) : ''}</span>
      <span class="tx"><b>Ustvari svoj račun</b><span>Shrani relacije na vseh napravah in si nariši svoj avatar.</span></span>${icon('chev')}</button></section>`;
  }
  const fr = freqRoutes(3);
  if (!fr.length) return '';
  return `<section class="section freq-sec"><div class="section-head"><h2>${icon('spark')} Tvoje pogoste relacije</h2></div>
    <div class="freq">${fr.map(r => {
      const nx = nextUp(r.from, r.to), k = todayKey();
      const diff = nx ? Math.max(0, nx.dep + delayOf(nx.legs[0].id, k) - nowMin()) : null;
      return `<button class="freq-card" data-a="route" data-from="${r.from}" data-to="${r.to}">
        <span class="fc-top"><b>${esc(stName(r.from))}</b>${icon('arrow')}<b>${esc(stName(r.to))}</b></span>
        <span class="fc-bot">${nx ? `${nx.legs.map(l => badge(l.dir.line, true)).join('')}<span>${diff <= 1 ? 'odhod zdaj' : diff < 100 ? 'čez ' + diff + ' min' : 'ob ' + fmt(nx.dep)}</span>` : '<span>danes ni več odhodov</span>'}<em>${r.c}×</em></span>
      </button>`;
    }).join('')}</div></section>`;
}

/* --- profil --- */
const agoText = ms => { const m = Math.round((Date.now() - ms) / 60000); return m < 1 ? 'pravkar' : m < 60 ? 'pred ' + m + ' min' : m < 1440 ? 'pred ' + Math.round(m / 60) + ' h' : 'pred ' + Math.round(m / 1440) + ' dnevi'; };
SCREENS.profile = () => {
  if (!loggedIn()) {
    const cfgOk = HAS_ACC && Acc.configured;
    return `<div class="page-title"><h1>Profil</h1><p>Tvoj račun za vozni red</p></div>
    <section class="acc-hero">
      <div class="acc-avs">${AV ? [AV.svg({ hair: 'bun', hairColor: '#1E1214', bg: '#FFD3C2', eyes: 'happy', mouth: 'grin', outfit: '#7C5CF0' }, 74), AV.svg({ hair: 'side', hairColor: '#C98B4B', bg: '#FDE3E7', glasses: 'round', outfit: '#C8102E' }, 92), AV.svg({ hair: 'cap', skin: '#9C6640', bg: '#E9D7FF', eyes: 'wink', outfit: '#1F4FB4', facial: 'beard' }, 74)].join('') : ''}</div>
      <h2>Ustvari svoj račun</h2>
      <p>Prijaviš se lahko na kateremkoli telefonu – vse ostane shranjeno v oblaku.</p>
    </section>
    <div class="set-card benefits">
      <div class="set-row"><span class="ic">${icon('history')}</span><span class="tx"><b>Shranjene relacije</b><span>Nedavna iskanja in priljubljene relacije na vseh napravah</span></span></div>
      <div class="set-row"><span class="ic">${icon('spark')}</span><span class="tx"><b>Pogoste relacije na začetku</b><span>Kar pogosto iščeš, je takoj na glavnem zaslonu</span></span></div>
      <div class="set-row"><span class="ic">${icon('user')}</span><span class="tx"><b>Tvoj avatar</b><span>Nariši lik, ki je podoben tebi</span></span></div>
    </div>
    ${cfgOk ? `<div style="padding:16px 16px 0;display:grid;gap:10px">
      <button class="cta" data-a="signupstart">${icon('user')} Ustvari račun</button>
      <button class="ghost-btn" data-a="auth" data-m="login">Že imam račun – prijava</button></div>`
    : `<p class="set-foot">Povezava z bazo računov še ni nastavljena.</p>`}`;
  }
  const p = Acc.profile;
  const fr = freqRoutes(5);
  const searches = Object.values(p.data.routeCounts || {}).reduce((a, b) => a + b, 0);
  return `<section class="prof-hero">
      <button class="prof-av" data-a="aved" aria-label="Uredi avatar">${AV ? AV.svg(p.avatar, 92) : ''}<span>${icon('edit')}</span></button>
      <div class="prof-tx"><h1>${esc(p.name || 'Potnik')}</h1><p>${esc(Acc.user.email)}</p></div>
      <button class="round-btn" data-a="editname" aria-label="Uredi ime">${icon('edit')}</button>
    </section>
    <div class="set-card how prof-stats">
      <div><b>${searches}</b><span>${plural(searches, 'iskanje', 'iskanji', 'iskanja', 'iskanj')}</span></div>
      <div><b>${D.favs.length}</b><span>${plural(D.favs.length, 'priljubljena', 'priljubljeni', 'priljubljene', 'priljubljenih')}</span></div>
      <div><b>${D.tickets.length}</b><span>${plural(D.tickets.length, 'vozovnica', 'vozovnici', 'vozovnice', 'vozovnic')}</span></div>
    </div>
    ${fr.length ? `<div class="set-title">Pogoste relacije</div><div class="route-list" style="padding:0 16px">${fr.map(r => `<button class="route-item" data-a="route" data-from="${r.from}" data-to="${r.to}">
      <span class="ic">${icon('spark')}</span><span class="tx"><strong><span class="nm">${esc(stName(r.from))}</span> ${icon('arrow')} <span class="nm">${esc(stName(r.to))}</span></strong><span>Iskano ${r.c}×</span></span>${icon('chev')}</button>`).join('')}</div>` : ''}
    <div class="set-title">Račun</div>
    <div class="set-card">
      <button class="set-row" data-a="syncnow"><span class="ic">${icon('cloud')}</span><span class="tx"><b>${Acc.error ? 'Sinhronizacija' : 'Shranjeno v oblaku'}</b><span>${Acc.error ? esc(Acc.error) : Acc.lastSync ? 'Zadnja sinhronizacija ' + agoText(Acc.lastSync) : 'Prijavi se na drugem telefonu z istim e-naslovom'}</span></span><span class="val">Osveži</span></button>
      <button class="set-row" data-a="logout"><span class="ic">${icon('logout')}</span><span class="tx"><b>Odjava</b><span>Podatki ostanejo shranjeni v tvojem računu</span></span></button>
    </div>`;
};

/* --- urejevalnik avatarja --- */
const AV_CATS = [['skin', 'Koža', 'color'], ['shape', 'Obraz'], ['hair', 'Lasje'], ['hairColor', 'Barva las', 'color'], ['eyes', 'Oči'], ['brows', 'Obrvi'], ['mouth', 'Usta'], ['glasses', 'Očala'], ['facial', 'Brada'], ['extra', 'Dodatki'], ['outfit', 'Oblačila', 'color'], ['bg', 'Ozadje', 'color']];
S.av = { draft: null, mode: 'edit', cat: 'hair' };
SCREENS.avatar = () => {
  const dr = S.av.draft, cat = AV_CATS.find(c => c[0] === S.av.cat) || AV_CATS[2];
  const opts = AV.OPTS[cat[0]];
  return `<header class="topbar">
      <button class="round-btn" data-a="back" aria-label="Nazaj">${icon('back')}</button>
      <div class="ttl"><h2>${S.av.mode === 'signup' ? 'Nariši svoj avatar' : 'Uredi avatar'}</h2><p>${S.av.mode === 'signup' ? 'Korak 1 od 2 · nato e-naslov in geslo' : 'Spremembe se shranijo v tvoj račun'}</p></div>
    </header>
    <section class="av-stage"><div class="av-big" id="av-big">${AV.svg(dr, 168)}</div>
      <button class="av-dice" data-a="avrand" aria-label="Naključni avatar">${icon('dice')}</button></section>
    <div class="av-cats" role="tablist">${AV_CATS.map(c => `<button class="chip ${c[0] === cat[0] ? 'on' : ''}" data-a="avcat" data-k="${c[0]}" role="tab">${c[1]}</button>`).join('')}</div>
    <div class="av-grid ${cat[2] === 'color' ? 'colors' : ''}">${opts.map(v => cat[2] === 'color'
      ? `<button class="sw ${dr[cat[0]] === v ? 'on' : ''}" data-a="avset" data-k="${cat[0]}" data-v="${v}" style="background:${v}" aria-label="${v}"></button>`
      : `<button class="opt ${dr[cat[0]] === v ? 'on' : ''}" data-a="avset" data-k="${cat[0]}" data-v="${v}">${AV.svg(Object.assign({}, dr, { [cat[0]]: v }), 64)}<small>${esc((AV.LABELS[cat[0]] || {})[v] || v)}</small></button>`).join('')}</div>
    <div class="av-bar"><button class="cta" data-a="avsave">${S.av.mode === 'signup' ? 'Naprej ' + icon('arrow') : icon('edit') + ' Shrani avatar'}</button></div>`;
};

/* --- prijava / registracija --- */
let authMode = 'login', authMsg = '', authBusy = false, authEmail = '';
function authHtml() {
  const m = authMode;
  if (m === 'sent') return `<div class="sheet-head"><h3>Preveri e-pošto</h3><button class="round-btn" data-a="close" aria-label="Zapri">${icon('x')}</button></div>
    <div class="sheet-body auth"><div class="auth-done">${icon('mail')}</div>
      <p class="auth-p">${authMsg}</p>
      <button class="cta" data-a="auth" data-m="login">Na prijavo</button></div>`;
  const dr = S.av.draft;
  return `<div class="sheet-head"><h3>${m === 'signup' ? 'Ustvari račun' : m === 'reset' ? 'Pozabljeno geslo' : 'Prijava'}</h3><button class="round-btn" data-a="close" aria-label="Zapri">${icon('x')}</button></div>
  <form class="sheet-body auth" data-form="auth" novalidate>
    ${m === 'signup' && dr ? `<div class="auth-av">${AV.svg(dr, 72)}<span>Korak 2 od 2</span></div>` : ''}
    ${m === 'reset' ? '<p class="auth-p">Vpiši e-naslov svojega računa. Poslali ti bomo povezavo za novo geslo.</p>' : ''}
    ${m === 'signup' ? `<label class="fld">${icon('user')}<input name="name" type="text" autocomplete="nickname" placeholder="Ime ali vzdevek" maxlength="30" required></label>` : ''}
    <label class="fld">${icon('mail')}<input name="email" type="email" autocomplete="email" inputmode="email" placeholder="E-naslov" value="${esc(authEmail)}" required></label>
    ${m !== 'reset' ? `<label class="fld">${icon('lock')}<input name="password" type="password" autocomplete="${m === 'signup' ? 'new-password' : 'current-password'}" placeholder="${m === 'signup' ? 'Geslo (vsaj 8 znakov)' : 'Geslo'}" minlength="${m === 'signup' ? 8 : 1}" required><button type="button" class="eye" data-a="pwshow" aria-label="Pokaži geslo">${icon('eye')}</button></label>` : ''}
    <p class="auth-err" role="alert">${authMsg ? esc(authMsg) : ''}</p>
    <button class="cta" type="submit" ${authBusy ? 'disabled' : ''}>${authBusy ? '<span class="spin-s"></span>' : ''}${m === 'signup' ? 'Ustvari račun' : m === 'reset' ? 'Pošlji povezavo' : 'Prijava'}</button>
    <div class="auth-links">
      ${m === 'login' ? `<button type="button" data-a="auth" data-m="reset">Pozabljeno geslo?</button><button type="button" data-a="signupstart">Nov račun</button>` : `<button type="button" data-a="auth" data-m="login">Že imam račun – prijava</button>`}
    </div>
    <p class="demo-note">${icon('lock')} Geslo je šifrirano shranjeno v bazi računov (Supabase); aplikacija ga ne vidi.</p>
  </form>`;
}
function openAuth(mode) {
  authMode = mode; authMsg = '';
  if (sheet.classList.contains('open')) sheet.innerHTML = '<div class="grab"></div>' + authHtml();
  else openSheet(authHtml());
}
async function submitAuth(form) {
  if (authBusy) return;
  const f = new FormData(form), email = String(f.get('email') || '').trim(), pw = String(f.get('password') || ''), name = String(f.get('name') || '').trim();
  authEmail = email;
  const fail = msg => { authMsg = msg; authBusy = false; sheet.innerHTML = '<div class="grab"></div>' + authHtml(); };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('Vpiši veljaven e-naslov.');
  if (authMode === 'signup' && !name) return fail('Vpiši ime ali vzdevek.');
  if (authMode === 'signup' && pw.length < 8) return fail('Geslo naj ima vsaj 8 znakov.');
  if (authMode === 'login' && !pw) return fail('Vpiši geslo.');
  authBusy = true; authMsg = ''; sheet.innerHTML = '<div class="grab"></div>' + authHtml();
  let r;
  if (authMode === 'signup') r = await Acc.signUp(email, pw, name, S.av.draft);
  else if (authMode === 'reset') r = await Acc.reset(email);
  else r = await Acc.signIn(email, pw);
  authBusy = false;
  if (!r.ok) return fail(r.error);
  if (authMode === 'reset') { authMode = 'sent'; authMsg = `Na <b>${esc(email)}</b> smo poslali povezavo za nastavitev novega gesla.`; sheet.innerHTML = '<div class="grab"></div>' + authHtml(); return; }
  if (r.needsConfirm) { authMode = 'sent'; authMsg = `Na <b>${esc(email)}</b> smo poslali povezavo za potrditev računa. Klikni jo, nato se tukaj prijavi.`; sheet.innerHTML = '<div class="grab"></div>' + authHtml(); return; }
  syncFromAccount();
  closeSheet();
  S.tab = 'profile'; nav.profile = ['profile'];
  render('fade');
  toast('Pozdravljen, ' + (Acc.profile && Acc.profile.name || '') + '!');
}
function nameHtml() {
  return `<div class="sheet-head"><h3>Tvoje ime</h3><button class="round-btn" data-a="close" aria-label="Zapri">${icon('x')}</button></div>
  <form class="sheet-body auth" data-form="name"><label class="fld">${icon('user')}<input name="name" type="text" maxlength="30" value="${esc(Acc.profile.name || '')}" required></label>
  <button class="cta" type="submit">Shrani</button></form>`;
}
function updateTabAvatar() {
  const b = document.getElementById('tab-profile');
  if (!b) return;
  b.innerHTML = loggedIn() && AV ? `<span class="tab-av">${AV.svg(Acc.profile.avatar, 26)}</span><span>${esc((Acc.profile.name || 'Profil').split(' ')[0].slice(0, 9))}</span>` : `<svg><use href="#i-user"/></svg><span>Profil</span>`;
}

/* ================= Izris in navigacija ================= */
function render(anim = 'fade') {
  const name = current();
  const v = document.createElement('section');
  v.className = `view ${anim} v-${name}`;
  v.innerHTML = SCREENS[name]();
  if (r3d) { r3d.destroy(); r3d = null; }
  views.replaceChildren(v);
  if (name === 'detail') mount3d();
  document.querySelectorAll('#tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === S.tab));
  $('#tabbar').classList.toggle('hidden', name === 'detail' || name === 'avatar');
  const key = S.tab + ':' + name;
  if (anim === 'enter-back' && scrolls[key] != null) v.scrollTop = scrolls[key];
  else if (name === 'results') scrollToNext(v);
}
function saveScroll() {
  const v = views.firstElementChild;
  if (v) scrolls[S.tab + ':' + current()] = v.scrollTop;
}
function push(name) {
  saveScroll();
  nav[S.tab].push(name);
  try { history.pushState({ depth: nav[S.tab].length }, ''); } catch (e) {}
  render('enter');
}
function back() {
  if (nav[S.tab].length > 1) { nav[S.tab].pop(); render('enter-back'); }
}
function switchTab(t) {
  saveScroll();
  if (S.tab === t && nav[t].length > 1) nav[t] = [nav[t][0]];
  S.tab = t;
  render('fade');
  if (t === 'board') startBoard();
}
window.addEventListener('popstate', () => {
  if ($('#sheet').classList.contains('open')) { closeSheet(true); return; }
  back();
});

let boardTimer = null;
function startBoard() {
  clearInterval(boardTimer);
  let ticks = 0;
  boardTimer = setInterval(() => {
    if (current() !== 'board') { clearInterval(boardTimer); return; }
    const c = $('#clock'); if (c) c.innerHTML = clockText();
    if (++ticks % 30 === 0) { const r = $('#board-rows'); if (r) r.innerHTML = boardRows(); }
  }, 1000);
}

/* ================= Spodnji listi ================= */
const sheet = $('#sheet'), backdrop = $('#backdrop');
function openSheet(html, tall) {
  sheet.innerHTML = '<div class="grab"></div>' + html;
  sheet.classList.toggle('tall', !!tall);
  void sheet.offsetHeight; // reflow, da se prehod sproži
  sheet.classList.add('open'); backdrop.classList.add('open');
  try { history.pushState({ sheet: 1 }, ''); } catch (e) {}
}
function closeSheet(fromPop) {
  if (typeof SMAP !== 'undefined' && SMAP.ml) { SMAP.ml.destroy(); SMAP.ml = null; }
  if (document.activeElement) document.activeElement.blur();
  window.scrollTo(0, 0);
  sheet.classList.remove('open'); backdrop.classList.remove('open');
  if (!fromPop) { try { history.back(); } catch (e) {} }
}
backdrop.addEventListener('click', () => closeSheet());

function openPicker(which) {
  S.picker = which;
  const title = which === 'from' ? 'Od kod potuješ?' : which === 'to' ? 'Kam potuješ?' : which === 'home' ? 'Domača postaja' : 'Izberi postajališče';
  const ex = (INSP[0] && stName(INSP[0].id)) || stName(ST_IDS[1] || HUB);
  const mode = SET.pickMode === 'list' ? 'list' : 'map';
  openSheet(`<div class="sheet-head"><h3>${title}</h3><button class="round-btn" data-a="close" aria-label="Zapri">${icon('x')}</button></div>
    <label class="searchbox">${icon('search')}<input type="search" data-in="stq" placeholder="Išči postajo ali četrt, npr. ${esc(ex)}" autocomplete="off" enterkeyhint="search"></label>
    <div class="segctl pick-mode" role="tablist"><button data-a="pickmode" data-v="map" class="${mode === 'map' ? 'on' : ''}">${icon('map')}Zemljevid</button><button data-a="pickmode" data-v="list" class="${mode === 'list' ? 'on' : ''}">${icon('list')}Seznam</button></div>
    <div id="pick-body"></div>`, true);
  // počakaj, da se list odpre (velikost zemljevida)
  setTimeout(() => setPickMode(mode), mode === 'map' ? 60 : 0);
  if (mode === 'list') setTimeout(() => { const i = sheet.querySelector('input'); if (i && matchMedia('(pointer:fine)').matches) i.focus(); }, 350);
}
function stItem(id, q) {
  const s = STATIONS[id];
  let name = esc(s.name);
  if (q) {
    const i = norm(s.name).indexOf(q);
    if (i >= 0) name = esc(s.name.slice(0, i)) + '<mark>' + esc(s.name.slice(i, i + q.length)) + '</mark>' + esc(s.name.slice(i + q.length));
  }
  const n = linesAt(id);
  return `<button class="st-item" data-a="pickst" data-id="${id}"><span class="ic ${s.hub ? 'hub' : ''}">${icon(s.hub ? 'bus' : 'pin')}</span>
    <span><b>${name}</b><span>${esc(s.sub && s.sub !== s.reg ? s.sub + ' · ' : '')}${esc(s.reg || '')} · ${n} ${plural(n, 'linija', 'liniji', 'linije', 'linij')}</span></span></button>`;
}
function stationList(q) {
  q = norm(q.trim());
  const ids = ST_IDS;
  if (q) {
    const m = ids.filter(id => norm(STATIONS[id].name).includes(q) || norm(STATIONS[id].reg).includes(q) || norm(STATIONS[id].sub).includes(q))
      .sort((a, b) => (norm(STATIONS[b].name).startsWith(q) - norm(STATIONS[a].name).startsWith(q)) || STATIONS[a].name.localeCompare(STATIONS[b].name, 'sl'));
    return m.length ? m.map(id => stItem(id, q)).join('') : `<div class="empty"><div class="em-ic">${icon('search')}</div><h3>Ni zadetkov</h3><p>Poskusi z drugim imenom postaje ali četrti.</p></div>`;
  }
  const hubs = ids.filter(id => STATIONS[id].hub);
  return (hubs.length ? `<div class="st-group">Glavna vozlišča</div><div class="hub-chips">${hubs.map(id => `<button class="chip" data-a="pickst" data-id="${id}">${icon('bus')}${esc(STATIONS[id].name)}</button>`).join('')}</div>` : '') +
    DISTRICT_LIST.map(reg => {
      const list = ids.filter(id => STATIONS[id].reg === reg).sort((a, b) => STATIONS[a].name.localeCompare(STATIONS[b].name, 'sl'));
      return list.length ? `<div class="st-group">${esc(reg)}<span>${list.length}</span></div>` + list.map(id => stItem(id, '')).join('') : '';
    }).join('') +
    (() => { const rest = ids.filter(id => !STATIONS[id].reg); return rest.length ? `<div class="st-group">Ostalo</div>` + rest.map(id => stItem(id, '')).join('') : ''; })();
}

const TYPES = {
  odr: { name: 'Odrasli', short: 'odrasli', d: 0 },
  dij: { name: 'Dijak / študent', short: 'dijak', d: 0.3, note: '−30 %' },
  upo: { name: 'Upokojenec', short: 'upokojenec', d: 0.25, note: '−25 %' },
  otr: { name: 'Otrok do 12 let', short: 'otrok', d: 0.5, note: '−50 %' },
  day: { name: 'Dnevna vozovnica', short: 'dnevna', fixed: true, note: 'Neomejene vožnje do polnoči' },
};
const unitPrice = type => TYPES[type].fixed ? FARED.day : Math.round(S.sel.price * (1 - TYPES[type].d) * 100) / 100;
function buyHtml() {
  const b = S.buy;
  const row = ([id, t]) => `<button class="${b.type === id ? 'on' : ''}" data-a="btype" data-t="${id}">
      <span><b>${t.name}</b><span>${t.note || 'Redna cena · prestopi ' + FARED.transferMinutes + ' min'}</span></span><span class="r">${eur(unitPrice(id))}</span></button>`;
  const ents = Object.entries(TYPES);
  return `<div class="sheet-head"><h3>Nakup vozovnice</h3><button class="round-btn" data-a="close" aria-label="Zapri">${icon('x')}</button></div>
  <div class="sheet-body">
    <div class="seg">${ents.filter(e => !e[1].fixed).map(row).join('')}</div>
    <div class="seg-label">Ali</div>
    <div class="seg">${ents.filter(e => e[1].fixed).map(row).join('')}</div>
    <div class="stepper"><span><b>Število potnikov</b></span><div class="ctr"><button data-a="bcount" data-v="-1" aria-label="Manj">−</button><b>${b.count}</b><button data-a="bcount" data-v="1" aria-label="Več">+</button></div></div>
    <div class="total"><span>Skupaj za plačilo</span><b>${eur(orderTotal())}</b></div>
    <button class="cta" data-a="bconfirm">${icon('ticket')} Potrdi nakup</button>
    <p class="demo-note">Demo aplikacija – plačilo se ne izvede, vozovnica je samo za prikaz.</p>
  </div>`;
}

/* ================= Dejanja ================= */
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.tm); toast.tm = setTimeout(() => t.classList.remove('show'), 2200);
}
function effectiveTheme() {
  return D.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}
function applyTheme() {
  if (D.theme) document.documentElement.dataset.theme = D.theme; else delete document.documentElement.dataset.theme;
  document.documentElement.dataset.dark = effectiveTheme() === 'dark' ? '1' : '0';
  const m = document.querySelector('meta[name="theme-color"]:not([media])');
  if (m) m.content = effectiveTheme() === 'dark' ? '#240307' : '#4A0814';
}
function doSearch() {
  if (!S.from || !S.to) return toast('Izberi začetno in končno postajo');
  if (S.from === S.to) return toast('Začetna in končna postaja sta enaki');
  // nedavne relacije in štetje se shranjujejo samo z računom
  if (loggedIn()) {
    D.recent = [{ from: S.from, to: S.to }, ...D.recent.filter(r => !(r.from === S.from && r.to === S.to))].slice(0, 8);
    Acc.save(p => { const k = S.from + '>' + S.to; p.data.routeCounts[k] = (p.data.routeCounts[k] || 0) + 1; });
    store.save();
  }
  if (S.tab !== 'home') { S.tab = 'home'; nav.home = ['home']; }
  if (current() === 'results') render('fade'); else push('results');
}

const A = {
  pick: el => openPicker(el.dataset.w),
  close: () => closeSheet(),
  pickst: el => {
    const id = el.dataset.id;
    haptic();
    if (S.picker === 'board') { S.boardStation = id; closeSheet(); render('fade'); startBoard(); return; }
    if (S.picker === 'home') {
      SET.home = id; store.save(); closeSheet();
      if (!OB.el || !OB.el.isConnected || OB.el.classList.contains('hide')) { S.from = id; S.boardStation = id; }
      refreshUI(); toast('Domača postaja: ' + stName(id)); return;
    }
    S[S.picker] = id;
    if (S.picker === 'from' && S.to === id) S.to = null;
    if (S.picker === 'to' && S.from === id) S.from = null;
    closeSheet(); render('fade');
  },
  swap: el => {
    [S.from, S.to] = [S.to, S.from];
    el.classList.add('spin');
    setTimeout(() => render('none'), 260);
  },
  day: el => { S.date = el.dataset.d; if (current() === 'results') S.time = null; render(current() === 'results' ? 'fade' : 'none'); },
  search: doSearch,
  route: el => { S.from = el.dataset.from; S.to = el.dataset.to; S.date = todayKey(); S.time = null; doSearch(); },
  back: () => history.back(),
  fav: () => {
    const i = D.favs.findIndex(r => r.from === S.from && r.to === S.to);
    if (i >= 0) { D.favs.splice(i, 1); toast('Odstranjeno iz priljubljenih'); }
    else { D.favs.unshift({ from: S.from, to: S.to }); toast('★ Dodano med priljubljene'); }
    store.save(); render('none');
  },
  unfav: (el, e) => { e.stopPropagation(); D.favs.splice(+el.dataset.i, 1); store.save(); render('none'); },
  clearrecent: () => { D.recent = []; store.save(); render('none'); },
  sort: el => { S.sort = el.dataset.s; render('none'); },
  direct: () => { S.directOnly = !S.directOnly; render('none'); },
  open: el => { S.sel = S.results[+el.dataset.i]; S.selDate = S.date; push('detail'); },
  opennext: () => { const c = nextUp(S.from, S.to); if (!c) return; S.sel = c; S.selDate = todayKey(); push('detail'); },
  brow: el => {
    const dir = DIR_BY_KEY[el.dataset.k];
    if (!dir) return;
    S.sel = mkConn([mkLeg(dir, +el.dataset.i, dir.stops.length - 1, +el.dataset.s)]);
    S.selDate = todayKey(); push('detail');
  },
  buy: () => { S.buy = { type: 'odr', count: 1 }; openSheet(buyHtml()); },
  btype: el => { S.buy.type = el.dataset.t; sheet.innerHTML = '<div class="grab"></div>' + buyHtml(); },
  bcount: el => { S.buy.count = Math.min(9, Math.max(1, S.buy.count + +el.dataset.v)); sheet.innerHTML = '<div class="grab"></div>' + buyHtml(); },
  bconfirm: () => {
    const c = S.sel, f = c.legs[0], l = c.legs[c.legs.length - 1];
    const code = 'MB-' + Array.from({ length: 3 }, () => Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, '0')).join('-');
    const t = {
      id: Date.now().toString(36), code, created: Date.now(), date: S.selDate,
      from: f.dir.stops[f.i], to: l.dir.stops[l.j], dep: c.dep, arr: c.arr,
      validTo: Math.max(c.arr, c.dep + FARED.transferMinutes * Math.max(1, Math.round(c.price / FARED.single))),
      lines: c.legs.map(x => x.dir.line.id), color: f.dir.line.color, peron: peron(f.dir, f.i),
      type: S.buy.type, count: S.buy.count, total: orderTotal(),
    };
    D.tickets.push(t); store.save();
    if (document.activeElement) document.activeElement.blur();
    sheet.classList.remove('open'); backdrop.classList.remove('open');
    S.tab = 'tickets'; nav.tickets = ['tickets', 'ticket']; S.ticket = t.id;
    try { history.replaceState({}, ''); } catch (e) {}
    render('enter');
    toast('Vozovnica je kupljena ✓');
  },
  ticket: el => { S.ticket = el.dataset.id; push('ticket'); },
  delticket: () => {
    if (!confirm('Izbrišem to vozovnico?')) return;
    D.tickets = D.tickets.filter(t => t.id !== S.ticket); store.save(); history.back();
  },
  inspo: el => {
    const id = el.dataset.id;
    if (!S.from || S.from === id) S.from = HUB !== id ? HUB : ST_IDS.find(x => x !== id);
    S.to = id; S.date = todayKey(); S.time = null; doSearch();
  },
  theme: () => { D.theme = effectiveTheme() === 'dark' ? 'light' : 'dark'; store.save(); applyTheme(); render('none'); },
  tab: el => switchTab(el.dataset.t),

  /* nastavitve */
  settings: () => { if (current() !== 'settings') push('settings'); },
  settog: el => {
    const k = el.dataset.k; SET[k] = !SET[k]; store.save();
    if (k === 'view3d') S.view3d = SET.view3d;
    applySettings(); haptic(); refreshUI();
  },
  settheme: el => { D.theme = el.dataset.v === 'auto' ? null : el.dataset.v; store.save(); applyTheme(); refreshUI(); },
  setfs: el => { SET.fs = el.dataset.v; store.save(); applySettings(); refreshUI(); },
  setpick: el => { SET.pickMode = el.dataset.v; store.save(); refreshUI(); },
  onboard: () => openOnboard(),
  wipe: () => {
    if (!confirm('Izbrišem vse vozovnice, priljubljene, zgodovino in nastavitve?')) return;
    try { localStorage.removeItem('voznired-mb'); } catch (e) {}
    location.reload();
  },

  /* uvodni vodič */
  obnext: () => { OB.i = Math.min(OB_STEPS.length - 1, OB.i + 1); renderOnboard(); },
  obprev: () => { OB.i = Math.max(0, OB.i - 1); renderOnboard(); },
  obdone: () => closeOnboard(),
  obhome: el => { SET.home = el.dataset.id; store.save(); OB.note = ''; refreshUI(); },
  obloc: () => {
    OB.note = 'Iščem tvojo lokacijo …'; const n = $('#ob-note'); if (n) n.textContent = OB.note;
    locate((err, p) => {
      if (err) OB.note = locError(err);
      else if (!inCity(p)) OB.note = `Nahajaš se približno ${Math.round(kmBetween(p, STATIONS[HUB]))} km od Maribora – izberi postajo spodaj.`;
      else { const ns = nearestStop(p); SET.home = ns.id; store.save(); OB.note = `Najbližja postaja: ${stName(ns.id)} (${distFmt(ns.km)})`; }
      refreshUI();
    });
  },

  /* izbirnik postaj in zemljevid */
  pickmode: el => setPickMode(el.dataset.v),
  smloc: () => smLocate(false),
  smzoom: el => { if (SMAP.ml) { SMAP.ml.zoom(el.dataset.v === 'in' ? 1 : -1); return; } if (!SMAP.zoomAt) return; const vb = SMAP.vb; SMAP.zoomAt(el.dataset.v === 'in' ? .6 : 1.6, vb.x + vb.w / 2, vb.y + vb.h / 2); },

  /* podrobnosti */
  mapview: el => {
    S.view3d = el.dataset.v === '3d';
    const box = $('#mapbox'); if (!box) return;
    if (r3d) { r3d.destroy(); r3d = null; }
    box.innerHTML = '<div class="r3d" id="r3d"></div>';
    el.parentElement.querySelectorAll('button').forEach(b => { const on = b === el; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    mount3d();
  },
  speak: () => speakTrip(),

  /* račun */
  signupstart: () => {
    if (sheet.classList.contains('open')) closeSheet();
    S.av = { draft: AV.random(), mode: 'signup', cat: 'hair' };
    if (S.tab !== 'profile') { S.tab = 'profile'; nav.profile = ['profile']; }
    setTimeout(() => push('avatar'), 30);
  },
  auth: el => openAuth(el.dataset.m),
  aved: () => { S.av = { draft: Object.assign({}, AV.DEFAULT, Acc.profile.avatar || {}), mode: 'edit', cat: 'hair' }; push('avatar'); },
  avcat: el => { S.av.cat = el.dataset.k; const v = views.firstElementChild, y = v.scrollTop; render('none'); views.firstElementChild.scrollTop = y; },
  avset: el => {
    S.av.draft[el.dataset.k] = el.dataset.v; haptic();
    const v = views.firstElementChild, y = v.scrollTop; render('none'); views.firstElementChild.scrollTop = y;
  },
  avrand: () => {
    S.av.draft = AV.random(); haptic();
    const v = views.firstElementChild, y = v.scrollTop; render('none'); views.firstElementChild.scrollTop = y;
    const b = $('#av-big'); if (b && !reduceMotion()) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
  },
  avsave: () => {
    if (S.av.mode === 'signup') { openAuth('signup'); return; }
    Acc.save(p => { p.avatar = Object.assign({}, S.av.draft); });
    toast('Avatar je shranjen');
    history.back();
  },
  pwshow: el => { const i = el.parentElement.querySelector('input'); i.type = i.type === 'password' ? 'text' : 'password'; },
  editname: () => openSheet(nameHtml()),
  syncnow: async () => { toast('Sinhroniziram …'); await Acc.load(); syncFromAccount(); toast(Acc.error ? Acc.error : 'Podatki so posodobljeni ✓'); },
  logout: async () => {
    if (!confirm('Se odjavim iz računa?')) return;
    await Acc.signOut();
    D.recent = []; baseSave();
    nav.profile = ['profile']; render('fade'); toast('Odjavljen si');
  },
};
document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-form]');
  if (!f) return;
  e.preventDefault();
  if (f.dataset.form === 'auth') submitAuth(f);
  if (f.dataset.form === 'name') {
    const n = String(new FormData(f).get('name') || '').trim();
    if (n) { Acc.save(p => { p.name = n; }); closeSheet(); toast('Ime je shranjeno'); }
  }
});

document.addEventListener('click', e => {
  const tab = e.target.closest('[data-tab]');
  if (tab) return switchTab(tab.dataset.tab);
  const el = e.target.closest('[data-a]');
  if (el && A[el.dataset.a]) A[el.dataset.a](el, e);
});
document.addEventListener('change', e => {
  const k = e.target.dataset.in;
  if (k === 'date' && e.target.value) { S.date = e.target.value; render('none'); }
  if (k === 'time' && e.target.value) { S.time = toMin(e.target.value); render('none'); }
});
document.addEventListener('input', e => {
  if (e.target.dataset.in === 'stq') {
    if (S.pickMode !== 'list') setPickMode('list');
    const l = $('#st-list'); if (l) l.innerHTML = stationList(e.target.value);
  }
});

/* ================= Zagon ================= */
applySettings();
applyTheme();
// račun: nedavne relacije le s prijavo; ob zagonu osveži profil iz oblaka
if (!loggedIn()) { D.recent = []; baseSave(); } else syncFromAccount();
updateTabAvatar();
if (HAS_ACC) {
  let accT = null;
  Acc.on(() => {
    updateTabAvatar();
    clearTimeout(accT);
    accT = setTimeout(() => { if (['profile', 'home'].includes(current()) && !sheet.classList.contains('open')) refreshUI(); }, 120);
  });
  if (Acc.loggedIn) Acc.load().then(() => syncFromAccount());
}
render('fade');
if (!D.onboarded) openOnboard();
// knjižnico za 3D zemljevid naloži vnaprej, da se pogled odpre takoj
setTimeout(() => { if (window.Map3D) window.Map3D.preload(); }, 2500);
setInterval(() => {
  if (current() === 'results' && S.date === todayKey() && !sheet.classList.contains('open')) { saveScroll(); const y = scrolls['home:results']; render('none'); views.firstElementChild.scrollTop = y; }
  else if (current() === 'home' && !sheet.classList.contains('open')) { const v = views.firstElementChild, y = v.scrollTop; render('none'); views.firstElementChild.scrollTop = y; }
}, 60000);
if (window.matchMedia) {
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => { if (!D.theme) { applyTheme(); if (current() === 'home') render('none'); } };
  if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
}
/* ================= Samodejne posodobitve =================
   - Ob vsakem zagonu service worker najprej prenese sveže datoteke (brez vprašanj).
   - Če je aplikacija odprta med objavo nove različice, se ta tiho naloži,
     ko gre aplikacija v ozadje. Nobenih ponavljajočih se oken.
   - Preverjanje največ na 10 minut, samo ob zagonu in ob vrnitvi v aplikacijo. */
const APP_BUILD = window.APP_BUILD || 'dev';
const REMOTE_APP = 'https://janznidaric911.github.io/vozni-red-maribor/app/';
let updPending = false, updLast = 0;
async function checkForUpdate() {
  if (APP_BUILD === 'dev' || !navigator.onLine) return;
  if (Date.now() - updLast < 10 * 60e3) return;
  updLast = Date.now();
  try {
    const fromFile = location.protocol === 'file:';
    const r = await fetch((fromFile ? REMOTE_APP : '') + 'version.json?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return;
    const j = await r.json();
    // zagon brez interneta je naložil vgrajeno kopijo: ko je splet spet dosegljiv, preklopi na sveže
    if (fromFile) {
      let jumped = null; try { jumped = sessionStorage.getItem('vr-jump'); } catch (e) {}
      if (!jumped) { try { sessionStorage.setItem('vr-jump', '1'); } catch (e) {} location.replace(REMOTE_APP); }
      return;
    }
    if (j && j.build && j.build !== APP_BUILD) updPending = true;
  } catch (e) {}
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    if (updPending) { updPending = false; try { localStorage.setItem('vr-updated', '1'); } catch (e) {} location.reload(); }
  } else checkForUpdate();
});
setTimeout(checkForUpdate, 5000);
try {
  if (localStorage.getItem('vr-updated')) { localStorage.removeItem('vr-updated'); setTimeout(() => toast('Aplikacija je posodobljena ✓'), 1500); }
} catch (e) {}
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
// za razvoj/teste
window.__vr = { search, departures, trips, DIRS, S, upd: { check: () => { updLast = 0; return checkForUpdate(); }, pending: () => updPending } };
})();
