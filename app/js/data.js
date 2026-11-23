/* Podatki: postajališča so prave lokacije v Mestni občini Maribor (približne koordinate),
   linije, prevozniki, vozni redi in cene so izmišljeni. */

const CITY = { name: 'Maribor', tagline: 'Mestni avtobusi ob Dravi – hitro, preprosto, ob pravem času' };

/* reg: mestna četrt / krajevna skupnost (glej DISTRICTS) */
const STATIONS = {
  // Center
  glt:  { name: 'Glavni trg', sub: 'Center', reg: 'Center', lat: 46.5576, lon: 15.6455, hub: true },
  trs:  { name: 'Trg svobode', sub: 'Mestna hiša', reg: 'Center', lat: 46.5603, lon: 15.6486 },
  sls:  { name: 'Slomškov trg', sub: 'Univerza', reg: 'Center', lat: 46.5588, lon: 15.6434 },
  lent: { name: 'Lent', sub: 'Stara trta', reg: 'Center', lat: 46.5562, lon: 15.6418 },
  ap:   { name: 'Avtobusna postaja', sub: 'Mlinska ulica', reg: 'Center', lat: 46.5596, lon: 15.6555, hub: true },
  zp:   { name: 'Železniška postaja', sub: 'Partizanska cesta', reg: 'Center', lat: 46.5617, lon: 15.6566, hub: true },
  tls:  { name: 'Trg Leona Štuklja', sub: 'Ulica heroja Tomšiča', reg: 'Center', lat: 46.5592, lon: 15.6508 },

  // Ivan Cankar
  mpk:  { name: 'Mestni park', sub: 'Akvarij', reg: 'Ivan Cankar', lat: 46.5658, lon: 15.6480 },
  pir:  { name: 'Piramida', sub: 'Pod Piramido', reg: 'Ivan Cankar', lat: 46.5690, lon: 15.6445 },
  mhr:  { name: 'Meljski hrib', sub: 'Meljski dol', reg: 'Ivan Cankar', lat: 46.5688, lon: 15.6620 },
  mel:  { name: 'Melje', sub: 'Meljska cesta', reg: 'Ivan Cankar', lat: 46.5655, lon: 15.6700 },

  // Koroška vrata
  krv:  { name: 'Koroška vrata', sub: 'Koroška cesta', reg: 'Koroška vrata', lat: 46.5598, lon: 15.6395, hub: true },
  lvt:  { name: 'Ljudski vrt', sub: 'Stadion', reg: 'Koroška vrata', lat: 46.5640, lon: 15.6382 },
  feri: { name: 'Fakulteta za elektrotehniko', sub: 'Koroška cesta', reg: 'Koroška vrata', lat: 46.5588, lon: 15.6325 },
  kal:  { name: 'Kalvarija', sub: 'Gosposvetska cesta', reg: 'Koroška vrata', lat: 46.5665, lon: 15.6300 },
  std:  { name: 'Študentski domovi', sub: 'Gosposvetska cesta', reg: 'Koroška vrata', lat: 46.5640, lon: 15.6260 },

  // Kamnica
  mot:  { name: 'Mariborski otok', sub: 'Kopališče', reg: 'Kamnica', lat: 46.5662, lon: 15.6135 },
  kam:  { name: 'Kamnica', sub: 'Center', reg: 'Kamnica', lat: 46.5720, lon: 15.6040 },
  ros:  { name: 'Rošpoh', sub: 'Rošpoh', reg: 'Kamnica', lat: 46.5870, lon: 15.6250 },

  // Bresternica
  bre:  { name: 'Bresternica', sub: 'Šola', reg: 'Bresternica', lat: 46.5720, lon: 15.5700 },
  gaj:  { name: 'Gaj nad Mariborom', sub: 'Gaj', reg: 'Bresternica', lat: 46.5830, lon: 15.5560 },

  // Studenci
  stu:  { name: 'Studenci', sub: 'Center Studenci', reg: 'Studenci', lat: 46.5545, lon: 15.6240 },
  lic:  { name: 'Limbuška cesta', sub: 'Studenci', reg: 'Studenci', lat: 46.5525, lon: 15.6100 },

  // Tabor
  tab:  { name: 'Tabor', sub: 'Ljubljanska ulica', reg: 'Tabor', lat: 46.5500, lon: 15.6420, hub: true },
  ukc:  { name: 'UKC Maribor', sub: 'Ljubljanska ulica', reg: 'Tabor', lat: 46.5537, lon: 15.6465, hub: true },
  dvt:  { name: 'Dvorana Tabor', sub: 'Ljubljanska ulica', reg: 'Tabor', lat: 46.5475, lon: 15.6360 },

  // Nova vas
  nv:   { name: 'Nova vas', sub: 'Kardeljeva cesta', reg: 'Nova vas', lat: 46.5440, lon: 15.6300 },
  jad:  { name: 'Jadranska cesta', sub: 'Nova vas', reg: 'Nova vas', lat: 46.5410, lon: 15.6390 },

  // Radvanje
  rad:  { name: 'Radvanje', sub: 'Trg Radvanje', reg: 'Radvanje', lat: 46.5375, lon: 15.6200 },
  zgr:  { name: 'Zgornje Radvanje', sub: 'Lackova cesta', reg: 'Radvanje', lat: 46.5325, lon: 15.6160 },
  vzp:  { name: 'Vzpenjača Pohorje', sub: 'Spodnja postaja', reg: 'Radvanje', lat: 46.5340, lon: 15.6010 },

  // Pekre, Limbuš
  pek:  { name: 'Pekre', sub: 'Pekrska cesta', reg: 'Pekre', lat: 46.5440, lon: 15.5870 },
  lim:  { name: 'Limbuš', sub: 'Limbuška cesta', reg: 'Limbuš', lat: 46.5560, lon: 15.5880 },

  // Magdalena
  eup:  { name: 'Europark', sub: 'Pobreška cesta', reg: 'Magdalena', lat: 46.5545, lon: 15.6532, hub: true },
  mag:  { name: 'Magdalena', sub: 'Magdalenski park', reg: 'Magdalena', lat: 46.5500, lon: 15.6520 },
  trz:  { name: 'Tržaška cesta', sub: 'Magdalena', reg: 'Magdalena', lat: 46.5450, lon: 15.6560 },

  // Tezno
  tez:  { name: 'Tezno', sub: 'Ptujska cesta', reg: 'Tezno', lat: 46.5390, lon: 15.6680 },
  pct:  { name: 'Poslovna cona Tezno', sub: 'Ptujska cesta', reg: 'Tezno', lat: 46.5330, lon: 15.6780 },

  // Pobrežje
  pob:  { name: 'Pobrežje', sub: 'Cesta XIV. divizije', reg: 'Pobrežje', lat: 46.5530, lon: 15.6690 },
  pok:  { name: 'Pokopališče Pobrežje', sub: 'Cesta XIV. divizije', reg: 'Pobrežje', lat: 46.5480, lon: 15.6800 },

  // Brezje-Dogoše-Zrkovci
  zrk:  { name: 'Zrkovci', sub: 'Zrkovska cesta', reg: 'Brezje-Dogoše-Zrkovci', lat: 46.5420, lon: 15.7030 },
  dog:  { name: 'Dogoše', sub: 'Dogoška cesta', reg: 'Brezje-Dogoše-Zrkovci', lat: 46.5290, lon: 15.6990 },

  // Malečnik
  mal:  { name: 'Malečnik', sub: 'Center', reg: 'Malečnik', lat: 46.5640, lon: 15.7030 },
  rup:  { name: 'Ruperče', sub: 'Ruperče', reg: 'Malečnik', lat: 46.5790, lon: 15.7180 },

  // Razvanje
  raz:  { name: 'Razvanje', sub: 'Razvanjska cesta', reg: 'Razvanje', lat: 46.5270, lon: 15.6390 },
};

/* Vrstni red skupin v izbirniku postajališč */
const DISTRICTS = [
  'Center', 'Ivan Cankar', 'Koroška vrata', 'Kamnica', 'Bresternica', 'Studenci', 'Tabor',
  'Nova vas', 'Radvanje', 'Pekre', 'Limbuš', 'Magdalena', 'Tezno', 'Pobrežje',
  'Brezje-Dogoše-Zrkovci', 'Malečnik', 'Razvanje',
];

const OPERATORS = {
  a: { name: 'Štajerski mestni promet', color: '#b3122e' },
  b: { name: 'Dravska linija', color: '#1f6f8b' },
};

/* type: city | fast | suburban
   freq: prvi odhod, zadnji odhod, interval v minutah (delavnik) */
const LINES = [
  { id: '1',  op: 'a', type: 'city',     stops: ['kam','mot','std','krv','glt','trs','tls','ap','zp','mel'], freq: ['04:50','23:10',12], color: '#c8102e', amen: ['ac','acc','usb'] },
  { id: '2',  op: 'a', type: 'city',     stops: ['lic','stu','feri','krv','sls','glt','ukc','mag','trz','tez','pct'], freq: ['04:40','23:00',10], color: '#1f4fb4', amen: ['ac','acc','eco'] },
  { id: '3',  op: 'a', type: 'city',     stops: ['zgr','rad','nv','dvt','tab','ukc','glt','trs','mpk','pir'], freq: ['05:00','22:50',12], color: '#00843d', amen: ['ac','acc'] },
  { id: '4',  op: 'a', type: 'city',     stops: ['nv','jad','tab','ukc','eup','pob','pok'], freq: ['05:10','22:30',15], color: '#c75b00', amen: ['acc','eco'] },
  { id: '6',  op: 'a', type: 'city',     stops: ['lvt','krv','sls','glt','tls','ap','eup','mag','tez'], freq: ['04:55','23:05',12], color: '#7b2d8e', amen: ['ac','acc','wifi'] },
  { id: '7',  op: 'b', type: 'city',     stops: ['zp','ap','tls','eup','pob','pok','zrk','dog'], freq: ['05:05','22:35',15], color: '#00838f', amen: ['ac','acc'] },
  { id: '8',  op: 'b', type: 'city',     stops: ['lic','stu','dvt','tab','mag','trz','tez'], freq: ['05:20','22:20',20], color: '#9b5a1a', amen: ['acc'] },
  { id: '9',  op: 'a', type: 'city',     stops: ['std','kal','lvt','mpk','zp','mhr','mel'], freq: ['05:30','22:10',20], color: '#c2185b', amen: ['acc','eco'] },
  { id: '12', op: 'b', type: 'suburban', stops: ['glt','trs','ap','zp','mel','mal','rup'], freq: ['05:15','22:15',30], color: '#6b7a1e', amen: ['ac','bike'] },
  { id: '13', op: 'b', type: 'suburban', stops: ['ap','trs','sls','krv','kal','ros'], freq: ['05:45','21:45',45], color: '#3d5a80', amen: ['ac'], noSun: true },
  { id: '15', op: 'b', type: 'suburban', stops: ['glt','sls','krv','mot','kam','bre','gaj'], freq: ['05:20','22:00',40], color: '#0277bd', amen: ['ac','bike','usb'] },
  { id: '16', op: 'b', type: 'suburban', stops: ['trs','glt','lent','tab','stu','lic','lim'], freq: ['05:10','22:40',30], color: '#283593', amen: ['ac','acc'] },
  { id: '17', op: 'b', type: 'suburban', stops: ['ap','tls','glt','ukc','tab','nv','rad','pek'], freq: ['05:25','22:25',30], color: '#455a64', amen: ['ac','acc','bike'] },
  { id: '18', op: 'b', type: 'suburban', stops: ['ap','eup','mag','trz','jad','raz'], freq: ['05:40','21:40',60], color: '#8e244d', amen: ['ac'], noSun: true },
  { id: 'P1', op: 'a', type: 'fast',     stops: ['zp','ap','glt','ukc','tab','rad','vzp'], freq: ['06:00','21:30',20], color: '#2e6b30', amen: ['ac','bike','usb','wifi'] },
  { id: 'X1', op: 'a', type: 'fast',     stops: ['zp','ap','glt','ukc','tab','nv'], freq: ['05:30','21:00',15], color: '#d84315', amen: ['ac','acc','wifi','usb'] },
  { id: 'X2', op: 'a', type: 'fast',     stops: ['zp','ap','trs','sls','feri','std'], freq: ['06:15','20:15',15], color: '#5b3fa8', amen: ['wifi','usb','ac','eco'], noSun: true },
  { id: 'N1', op: 'a', type: 'city',     stops: ['zp','ap','glt','ukc','tab','nv','rad'], freq: ['21:30','00:30',30], color: '#1a2a4a', amen: ['acc','ac'] },
  { id: 'N2', op: 'b', type: 'city',     stops: ['std','krv','sls','glt','ap','eup','pob','tez'], freq: ['21:45','00:15',45], color: '#3a2a5a', amen: ['acc'] },
];

const AMENITIES = {
  wifi: { label: 'Wi‑Fi', icon: 'wifi' },
  ac:   { label: 'Klima', icon: 'snow' },
  usb:  { label: 'USB polnilci', icon: 'plug' },
  acc:  { label: 'Nizkopodni', icon: 'access' },
  bike: { label: 'Prevoz koles', icon: 'bike' },
  eco:  { label: 'Električni avtobus', icon: 'leaf' },
};

/* Enotna mestna vozovnica (izmišljeno): ena vožnja vključuje prestope v transferMinutes */
const FARE = { single: 1.20, transferMinutes: 60, day: 3.50 };

const INSPIRATION = [
  { id: 'lent', title: 'Lent', text: 'Stara trta in sprehod ob Dravi', g: ['#8e1b2c', '#e0604f'], kind: 'river' },
  { id: 'vzp',  title: 'Pohorje', text: 'Z vzpenjačo nad mesto in v gozd', g: ['#4a1438', '#b0476a'], kind: 'mountain' },
  { id: 'mpk',  title: 'Mestni park', text: 'Trije ribniki in senčni drevoredi', g: ['#a8442a', '#f0a35e'], kind: 'park' },
  { id: 'pir',  title: 'Piramida', text: 'Razgled nad strehami starega mesta', g: ['#6b1f3a', '#d4766a'], kind: 'mountain' },
  { id: 'mot',  title: 'Mariborski otok', text: 'Kopanje sredi reke', g: ['#7a2e1f', '#e8b04a'], kind: 'river' },
  { id: 'glt',  title: 'Glavni trg', text: 'Rotovž, kužno znamenje in kavarne', g: ['#5a1a2e', '#c9503f'], kind: 'city' },
];

/* Mini zemljevid (lon, lat) */
const MAP = {
  bounds: [15.543, 15.730, 46.523, 46.592],
  outline: [
    [15.548,46.575],[15.552,46.589],[15.575,46.587],[15.600,46.583],[15.620,46.591],[15.640,46.590],
    [15.650,46.578],[15.668,46.576],[15.690,46.578],[15.712,46.586],[15.726,46.582],[15.724,46.568],
    [15.716,46.556],[15.712,46.544],[15.706,46.533],[15.698,46.525],[15.682,46.527],[15.668,46.530],
    [15.652,46.528],[15.640,46.524],[15.628,46.528],[15.614,46.529],[15.598,46.530],[15.590,46.538],
    [15.580,46.541],[15.576,46.550],[15.570,46.557],[15.556,46.560],[15.546,46.566],
  ],
  river: [
    [15.546,46.5648],[15.560,46.5658],[15.572,46.5664],[15.585,46.5655],[15.597,46.5640],[15.607,46.5650],
    [15.616,46.5640],[15.623,46.5612],[15.629,46.5582],[15.636,46.5562],[15.641,46.5553],[15.6455,46.5559],
    [15.653,46.5562],[15.660,46.5560],[15.668,46.5568],[15.676,46.5575],[15.684,46.5570],[15.692,46.5560],
    [15.700,46.5555],[15.710,46.5550],[15.722,46.5538],[15.730,46.5530],
  ],
  pohorje: [
    [15.543,46.523],[15.543,46.548],[15.556,46.547],[15.568,46.543],[15.580,46.536],[15.592,46.530],
    [15.606,46.526],[15.622,46.524],[15.640,46.5235],[15.652,46.523],
  ],
};
