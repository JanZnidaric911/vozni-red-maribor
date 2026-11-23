/* =====================================================================
   Avatar (v slogu bitmoji) — sestavljen iz SVG delov
   Avatar.svg(av, size) -> niz SVG;  Avatar.OPTS;  Avatar.random();  Avatar.DEFAULT
   ===================================================================== */
(function () {
  'use strict';
  const OPTS = {
    skin: ['#FFE0C7', '#F6CBA5', '#E8B088', '#C98E62', '#9C6640', '#6B4128'],
    shape: ['round', 'oval', 'square'],
    hair: ['short', 'side', 'curly', 'long', 'bob', 'bun', 'mohawk', 'cap', 'bald'],
    hairColor: ['#1E1214', '#4A2C1E', '#8A5A35', '#C98B4B', '#E8C27A', '#B3B3B3', '#C8102E', '#6B4CC2'],
    eyes: ['normal', 'happy', 'wink', 'big', 'sleepy'],
    brows: ['soft', 'raised', 'bold'],
    mouth: ['smile', 'grin', 'open', 'neutral', 'tongue'],
    glasses: ['none', 'round', 'square', 'sun'],
    facial: ['none', 'stubble', 'mustache', 'beard'],
    extra: ['none', 'blush', 'freckles', 'earrings'],
    outfit: ['#C8102E', '#1E1214', '#1F4FB4', '#00843D', '#E8930C', '#7C5CF0', '#F2F2F2', '#E0607E'],
    bg: ['#FDE3E7', '#FFD3C2', '#F7C8D0', '#E9D7FF', '#D4EDF9', '#DDF3E4', '#FFF0C7', '#2A1418'],
  };
  const LABELS = {
    shape: { round: 'Okrogel', oval: 'Ovalen', square: 'Oglat' },
    hair: { short: 'Kratki', side: 'Prečka', curly: 'Kodrasti', long: 'Dolgi', bob: 'Paž', bun: 'Figa', mohawk: 'Irokeza', cap: 'Kapa', bald: 'Brez' },
    eyes: { normal: 'Običajne', happy: 'Vesele', wink: 'Mežik', big: 'Velike', sleepy: 'Zaspane' },
    brows: { soft: 'Mehke', raised: 'Dvignjene', bold: 'Goste' },
    mouth: { smile: 'Nasmeh', grin: 'Širok', open: 'Začuden', neutral: 'Resen', tongue: 'Jezik' },
    glasses: { none: 'Brez', round: 'Okrogla', square: 'Oglata', sun: 'Sončna' },
    facial: { none: 'Brez', stubble: 'Strnišče', mustache: 'Brki', beard: 'Brada' },
    extra: { none: 'Brez', blush: 'Rdečica', freckles: 'Pegice', earrings: 'Uhani' },
  };
  const DEFAULT = { skin: '#F6CBA5', shape: 'round', hair: 'side', hairColor: '#4A2C1E', eyes: 'happy', brows: 'soft', mouth: 'smile', glasses: 'none', facial: 'none', extra: 'blush', outfit: '#C8102E', bg: '#FDE3E7' };

  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const f = v => Math.max(0, Math.min(255, Math.round(v * (1 + k))));
    return '#' + [n >> 16 & 255, n >> 8 & 255, n & 255].map(f).map(v => v.toString(16).padStart(2, '0')).join('');
  }

  function head(av) {
    if (av.shape === 'oval') return { d: 'M100 36 C128 36 142 60 142 94 C142 128 124 150 100 150 C76 150 58 128 58 94 C58 60 72 36 100 36Z', chin: 150 };
    if (av.shape === 'square') return { d: 'M66 40 H134 a12 12 0 0 1 12 12 V112 C146 134 126 148 100 148 C74 148 54 134 54 112 V52 a12 12 0 0 1 12 -12Z', chin: 148 };
    return { d: 'M100 38 C128 38 146 60 146 92 C146 124 126 146 100 146 C74 146 54 124 54 92 C54 60 72 38 100 38Z', chin: 146 };
  }

  function hairBack(av) {
    const c = av.hairColor;
    if (av.hair === 'long') return `<path d="M50 96 C44 42 76 28 100 28 C124 28 156 42 150 96 L156 168 C140 158 132 146 130 124 L70 124 C68 146 60 158 44 168Z" fill="${shade(c, -.12)}"/>`;
    if (av.hair === 'bob') return `<path d="M48 100 C44 44 76 30 100 30 C124 30 156 44 152 100 L152 132 C140 136 134 132 132 120 L68 120 C66 132 60 136 48 132Z" fill="${shade(c, -.12)}"/>`;
    if (av.hair === 'bun') return `<circle cx="100" cy="26" r="17" fill="${c}"/><circle cx="100" cy="26" r="17" fill="none" stroke="${shade(c, -.2)}" stroke-width="2"/>`;
    return '';
  }

  function hairFront(av) {
    const c = av.hairColor, dk = shade(c, -.18);
    switch (av.hair) {
      case 'short': return `<path d="M55 88 C52 50 76 34 100 34 C126 34 150 50 145 88 C140 70 126 60 100 60 C80 60 62 68 55 88Z" fill="${c}"/>`;
      case 'side': return `<path d="M54 94 C48 48 78 30 104 32 C134 34 152 54 146 92 C142 66 124 54 98 56 C88 70 70 78 54 94Z" fill="${c}"/><path d="M98 56 C92 46 104 38 116 40" stroke="${dk}" stroke-width="2" fill="none"/>`;
      case 'curly': {
        const pts = [[58, 80], [56, 64], [64, 50], [76, 40], [90, 34], [106, 33], [121, 38], [134, 47], [142, 60], [145, 76], [70, 62], [86, 52], [104, 50], [122, 56], [134, 66]];
        return pts.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i < 10 ? 13 : 11}" fill="${i % 2 ? c : shade(c, .06)}"/>`).join('');
      }
      case 'long': return `<path d="M56 84 C58 48 80 38 100 38 C122 38 142 48 144 84 C128 64 112 58 96 60 C82 62 66 70 56 84Z" fill="${c}"/>`;
      case 'bob': return `<path d="M54 80 C56 46 78 36 100 36 C122 36 144 46 146 80 L146 84 H54Z" fill="${c}"/>`;
      case 'bun': return `<path d="M56 84 C56 50 78 38 100 38 C122 38 144 50 144 84 C132 64 116 58 100 58 C84 58 68 64 56 84Z" fill="${c}"/>`;
      case 'mohawk': return `<path d="M90 62 C86 42 90 20 100 12 C110 20 114 42 110 62 C104 58 96 58 90 62Z" fill="${c}"/>`;
      case 'cap': {
        const k = av.outfit === '#F2F2F2' ? '#C8102E' : av.outfit;
        return `<path d="M52 80 C52 44 76 30 100 30 C124 30 148 44 148 80 C130 72 116 70 100 70 C84 70 68 72 52 80Z" fill="${k}"/>
          <path d="M100 72 C122 70 150 72 168 82 C164 88 150 88 136 84 C124 80 110 78 100 78Z" fill="${shade(k, -.25)}"/>
          <circle cx="100" cy="31" r="4" fill="${shade(k, -.25)}"/>
          <rect x="84" y="46" width="32" height="14" rx="4" fill="#fff"/><path d="M90 50 h20 M90 55 h12" stroke="${k}" stroke-width="2.4" stroke-linecap="round"/>`;
      }
      default: return '';
    }
  }

  function eyes(av) {
    const L = 82, R = 118, y = 92;
    const open = (x, big) => `<ellipse cx="${x}" cy="${y}" rx="${big ? 9 : 7}" ry="${big ? 10.5 : 8.5}" fill="#fff"/>
      <circle cx="${x + 1}" cy="${y + 1}" r="${big ? 5.5 : 4.4}" fill="#2B1A12"/><circle cx="${x + 2.6}" cy="${y - 1.4}" r="${big ? 2 : 1.6}" fill="#fff"/>`;
    const arc = x => `<path d="M${x - 7} ${y + 2} Q${x} ${y - 7} ${x + 7} ${y + 2}" stroke="#2B1A12" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
    switch (av.eyes) {
      case 'happy': return arc(L) + arc(R);
      case 'wink': return open(L) + arc(R);
      case 'big': return open(L, true) + open(R, true);
      case 'sleepy': return [L, R].map(x => `<path d="M${x - 7} ${y} Q${x} ${y + 6} ${x + 7} ${y}" stroke="#2B1A12" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M${x - 8} ${y - 3} h16" stroke="${shade(av.skin, -.25)}" stroke-width="2" stroke-linecap="round"/>`).join('');
      default: return open(L) + open(R);
    }
  }
  function brows(av) {
    const c = av.hair === 'bald' || av.hair === 'cap' ? '#4A2C1E' : shade(av.hairColor, -.15);
    const w = av.brows === 'bold' ? 5 : 3.2, dy = av.brows === 'raised' ? -5 : 0;
    return `<path d="M73 ${76 + dy} Q82 ${71 + dy} 91 ${75 + dy}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round"/>
      <path d="M109 ${75 + dy} Q118 ${71 + dy} 127 ${76 + dy}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
  }
  function mouth(av) {
    switch (av.mouth) {
      case 'grin': return `<path d="M84 116 Q100 136 116 116 Z" fill="#7A1B2A"/><path d="M86 117 Q100 124 114 117 L114 116 H86Z" fill="#fff"/>`;
      case 'open': return `<ellipse cx="100" cy="123" rx="7" ry="9" fill="#7A1B2A"/><ellipse cx="100" cy="127" rx="4.5" ry="3.5" fill="#E86A7A"/>`;
      case 'neutral': return `<path d="M90 121 h20" stroke="#7A1B2A" stroke-width="3.4" stroke-linecap="round"/>`;
      case 'tongue': return `<path d="M84 116 Q100 134 116 116 Z" fill="#7A1B2A"/><path d="M93 124 q7 12 14 0" fill="#E86A7A"/>`;
      default: return `<path d="M86 117 Q100 130 114 117" stroke="#7A1B2A" stroke-width="3.6" fill="none" stroke-linecap="round"/>`;
    }
  }
  function glasses(av) {
    if (av.glasses === 'none') return '';
    const st = 'stroke="#1E1214" stroke-width="3" fill="none"';
    if (av.glasses === 'round') return `<circle cx="82" cy="92" r="12" ${st}/><circle cx="118" cy="92" r="12" ${st}/><path d="M94 92 h12" ${st}/><path d="M70 90 L56 86 M130 90 L144 86" ${st}/>`;
    if (av.glasses === 'square') return `<rect x="68" y="82" width="28" height="20" rx="5" ${st}/><rect x="104" y="82" width="28" height="20" rx="5" ${st}/><path d="M96 90 h8 M68 88 L56 85 M132 88 L144 85" ${st}/>`;
    return `<path d="M66 84 H96 V94 C96 102 90 106 82 106 C72 106 66 100 66 92Z M104 84 H134 V92 C134 100 128 106 118 106 C110 106 104 102 104 94Z" fill="#1E1214"/>
      <path d="M96 88 h8 M66 86 L56 83 M134 86 L144 83" stroke="#1E1214" stroke-width="3"/><path d="M72 88 l6 -2 M110 88 l6 -2" stroke="rgba(255,255,255,.55)" stroke-width="2" stroke-linecap="round"/>`;
  }
  function facial(av, chin) {
    const c = av.hair === 'bald' || av.hair === 'cap' ? '#3A2418' : av.hairColor;
    if (av.facial === 'stubble') return `<path d="M64 112 C70 ${chin - 4} 88 ${chin + 2} 100 ${chin + 2} C112 ${chin + 2} 130 ${chin - 4} 136 112 C128 126 116 132 100 132 C84 132 72 126 64 112Z" fill="${c}" opacity=".22"/>`;
    if (av.facial === 'mustache') return `<path d="M84 112 C90 106 98 108 100 111 C102 108 110 106 116 112 C110 116 104 114 100 113 C96 114 90 116 84 112Z" fill="${c}"/>`;
    if (av.facial === 'beard') return `<path d="M60 104 C62 ${chin - 2} 82 ${chin + 8} 100 ${chin + 8} C118 ${chin + 8} 138 ${chin - 2} 140 104 C134 118 124 128 116 128 C110 120 90 120 84 128 C76 128 66 118 60 104Z" fill="${c}"/>
      <path d="M84 112 C90 106 98 108 100 111 C102 108 110 106 116 112 C110 116 104 114 100 113 C96 114 90 116 84 112Z" fill="${shade(c, -.1)}"/>`;
    return '';
  }
  function extra(av) {
    if (av.extra === 'blush') return `<ellipse cx="72" cy="110" rx="8" ry="5" fill="#FF7A8A" opacity=".35"/><ellipse cx="128" cy="110" rx="8" ry="5" fill="#FF7A8A" opacity=".35"/>`;
    if (av.extra === 'freckles') return [[70, 106], [76, 110], [66, 112], [130, 106], [124, 110], [134, 112]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="${shade(av.skin, -.35)}"/>`).join('');
    return '';
  }

  function svg(avIn, size) {
    const av = Object.assign({}, DEFAULT, avIn || {});
    const h = head(av), skinD = shade(av.skin, -.12), dark = av.bg === '#2A1418';
    const out = av.outfit, outD = shade(out, -.18);
    const sz = size || 96;
    return `<svg viewBox="0 0 200 200" width="${sz}" height="${sz}" style="width:${sz}px;height:${sz}px" class="avatar-svg" aria-hidden="true">
      <circle cx="100" cy="100" r="100" fill="${av.bg}"/>
      <circle cx="100" cy="100" r="86" fill="${dark ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.35)'}"/>
      <g>
        ${hairBack(av)}
        <path d="M28 206 C30 166 62 150 100 150 C138 150 170 166 172 206Z" fill="${out}"/>
        <path d="M78 152 L100 176 L122 152" fill="none" stroke="${outD}" stroke-width="4" stroke-linejoin="round"/>
        <rect x="86" y="124" width="28" height="32" rx="12" fill="${skinD}"/>
        <ellipse cx="54" cy="98" rx="9" ry="12" fill="${skinD}"/><ellipse cx="146" cy="98" rx="9" ry="12" fill="${skinD}"/>
        ${av.extra === 'earrings' ? '<circle cx="52" cy="112" r="4" fill="#F2C14E"/><circle cx="148" cy="112" r="4" fill="#F2C14E"/>' : ''}
        <path d="${h.d}" fill="${av.skin}"/>
        <path d="M100 98 q-4 10 0 12" stroke="${skinD}" stroke-width="3" fill="none" stroke-linecap="round"/>
        ${extra(av)}${facial(av, h.chin)}${mouth(av)}${eyes(av)}${brows(av)}${glasses(av)}${hairFront(av)}
      </g>
    </svg>`;
  }
  function random() {
    const pick = a => a[Math.floor(Math.random() * a.length)];
    const av = {};
    Object.keys(OPTS).forEach(k => { av[k] = pick(OPTS[k]); });
    if (Math.random() < .6) av.glasses = 'none';
    if (Math.random() < .6) av.facial = 'none';
    av.bg = pick(OPTS.bg.slice(0, 7));
    return av;
  }
  window.Avatar = { svg, OPTS, LABELS, DEFAULT, random };
})();
