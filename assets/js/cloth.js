/* ==========================================================================
   cloth.js — procedural Ghanaian cloth
   --------------------------------------------------------------------------
   Every swatch on this site is drawn, not photographed: kente strip-weave,
   adinkra stamping, batik wax-resist, adire indigo and fugu smock check are
   generated as SVG and handed back as a data URI. Deterministic per seed, so
   a given cloth always renders identically across pages and reloads.
   ========================================================================== */

const Cloth = (() => {
  'use strict';

  /* --- deterministic PRNG (mulberry32) ---------------------------------- */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];
  const rint = (r, a, b) => a + Math.floor(r() * (b - a + 1));

  /* --- palettes ---------------------------------------------------------- */
  const PALETTES = {
    // Asante kente: gold for status, green for renewal, red for the blood
    // of the ancestors, black for spiritual maturity.
    kente: {
      ground: '#12100E',
      threads: ['#E9BE45', '#D69B21', '#9E2B22', '#14603C', '#12100E', '#F3EDDE', '#1D2C4E']
    },
    kenteRoyal: {
      ground: '#0F1A14',
      threads: ['#E9BE45', '#14603C', '#9E2B22', '#0F1A14', '#C9A227', '#F3EDDE']
    },
    kenteBride: {
      ground: '#7A1B16',
      threads: ['#E9BE45', '#9E2B22', '#F3EDDE', '#12100E', '#D69B21', '#B4623A']
    },
    adinkra: { ground: '#3A2318', ink: '#100C09', halo: '#5A392A' },
    adinkraIndigo: { ground: '#1D2C4E', ink: '#0C1428', halo: '#33477A' },
    batik: { ground: '#1D3557', wax: '#EFE7D6', accent: '#D69B21' },
    batikClay: { ground: '#B4623A', wax: '#F3EDDE', accent: '#12100E' },
    adire: { ground: '#16305C', resist: '#DCD3BE' },
    fugu: { threads: ['#1D2C4E', '#F3EDDE', '#12100E', '#9E2B22', '#2E4C7E'] },
    calico: { ground: '#E4DED1', thread: '#C9BFA9' }
  };

  /* --- shared defs: fibre texture + stamp jitter ------------------------- */
  function defs(seed) {
    return `
    <defs>
      <filter id="fib${seed}" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.72 0.04" numOctaves="3" seed="${seed}" result="n"/>
        <feColorMatrix in="n" type="saturate" values="0"/>
        <feComponentTransfer><feFuncA type="linear" slope="0.5"/></feComponentTransfer>
      </filter>
      <filter id="wax${seed}" x="-8%" y="-8%" width="116%" height="116%">
        <feTurbulence type="fractalNoise" baseFrequency="0.014" numOctaves="4" seed="${seed}" result="t"/>
        <feDisplacementMap in="SourceGraphic" in2="t" scale="17" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
      <filter id="crack${seed}" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="turbulence" baseFrequency="0.03 0.05" numOctaves="5" seed="${seed + 7}" result="t"/>
        <feDisplacementMap in="SourceGraphic" in2="t" scale="9" xChannelSelector="R" yChannelSelector="B"/>
      </filter>
    </defs>`;
  }

  // fine warp/weft threads laid over the whole cloth
  function weaveOverlay(w, h, seed, strength = 0.22) {
    return `
    <g opacity="${strength}" style="mix-blend-mode:overlay">
      <rect width="${w}" height="${h}" fill="#fff" filter="url(#fib${seed})"/>
    </g>`;
  }

  /* ======================================================================
     KENTE — strip weave
     Woven in narrow strips on a double-heddle loom, then hand-sewn edge to
     edge. Blocks alternate warp-faced (vertical) and weft-faced (horizontal)
     and neighbouring strips are offset, which is what gives kente its beat.
     ====================================================================== */

  function warpBlock(r, x, y, w, h, pal) {
    const base = pick(r, pal.threads);
    let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${base}"/>`;
    const lines = rint(r, 4, 9);
    const step = w / lines;
    for (let i = 0; i < lines; i++) {
      const c = pick(r, pal.threads);
      if (c === base) continue;
      const lw = Math.max(1.5, step * (r() * 0.42 + 0.16));
      s += `<rect x="${(x + i * step + (step - lw) / 2).toFixed(1)}" y="${y}" width="${lw.toFixed(1)}" height="${h}" fill="${c}"/>`;
    }
    return s;
  }

  function weftBlock(r, x, y, w, h, pal) {
    const base = pick(r, pal.threads);
    let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${base}"/>`;
    const bands = rint(r, 3, 7);
    const step = h / bands;
    for (let i = 0; i < bands; i++) {
      const c = pick(r, pal.threads);
      if (c === base) continue;
      const bh = Math.max(1.6, step * (r() * 0.46 + 0.2));
      s += `<rect x="${x}" y="${(y + i * step + (step - bh) / 2).toFixed(1)}" width="${w}" height="${bh.toFixed(1)}" fill="${c}"/>`;
    }
    return s;
  }

  // adweneasa — the "my skill is exhausted" block, a filled diamond motif
  function motifBlock(r, x, y, w, h, pal) {
    const base = pick(r, pal.threads);
    const fig = pick(r, pal.threads.filter(c => c !== base));
    let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${base}"/>`;
    const rows = Math.max(1, Math.round(h / (w * 0.55)));
    const ch = h / rows;
    for (let i = 0; i < rows; i++) {
      const cy = y + ch * (i + 0.5);
      const cx = x + w / 2;
      const rx = w * 0.3, ry = ch * 0.3;
      s += `<path d="M${cx} ${cy - ry}L${cx + rx} ${cy}L${cx} ${cy + ry}L${cx - rx} ${cy}Z" fill="${fig}"/>`;
      s += `<path d="M${cx} ${cy - ry * 0.42}L${cx + rx * 0.42} ${cy}L${cx} ${cy + ry * 0.42}L${cx - rx * 0.42} ${cy}Z" fill="${base}"/>`;
    }
    return s;
  }

  // babadua — thin stacked bars, the "reed" pattern
  function barBlock(r, x, y, w, h, pal) {
    const a = pick(r, pal.threads);
    const b = pick(r, pal.threads.filter(c => c !== a));
    let s = '';
    const bh = Math.max(2.5, h / rint(r, 6, 12));
    for (let i = 0, yy = y; yy < y + h; i++, yy += bh) {
      const hh = Math.min(bh, y + h - yy);
      s += `<rect x="${x}" y="${yy.toFixed(1)}" width="${w}" height="${hh.toFixed(1)}" fill="${i % 2 ? a : b}"/>`;
    }
    return s;
  }

  function checkBlock(r, x, y, w, h, pal) {
    const a = pick(r, pal.threads);
    const b = pick(r, pal.threads.filter(c => c !== a));
    const cols = rint(r, 3, 5);
    const cw = w / cols;
    const rows = Math.max(2, Math.round(h / cw));
    const rh = h / rows;
    let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${b}"/>`;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if ((i + j) % 2) continue;
        s += `<rect x="${(x + i * cw).toFixed(1)}" y="${(y + j * rh).toFixed(1)}" width="${(cw + .5).toFixed(1)}" height="${(rh + .5).toFixed(1)}" fill="${a}"/>`;
      }
    }
    return s;
  }

  function kente(seed, variant) {
    const r = rng(seed);
    const pal = PALETTES[variant] || PALETTES.kente;
    const W = 600, H = 840;
    const strips = rint(r, 5, 7);
    const sw = W / strips;
    let body = `<rect width="${W}" height="${H}" fill="${pal.ground}"/>`;

    for (let s = 0; s < strips; s++) {
      const x = s * sw;
      // stagger every other strip so the blocks break joint, as sewn cloth does
      let y = -rint(r, 0, 3) * 40 - (s % 2 ? 60 : 0);
      let turn = s % 2;
      while (y < H) {
        const h = pick(r, [150, 110, 62, 190, 44]);
        const fn = turn % 2
          ? pick(r, [warpBlock, warpBlock, barBlock])
          : pick(r, [weftBlock, motifBlock, checkBlock, weftBlock]);
        body += fn(r, x, y, sw + 0.6, h, pal);
        // seam between strips
        y += h;
        turn++;
      }
      body += `<rect x="${(x - 0.6).toFixed(1)}" y="0" width="1.2" height="${H}" fill="rgba(0,0,0,.22)"/>`;
    }

    return svg(W, H, defs(seed) + body + weaveOverlay(W, H, seed, 0.3));
  }

  /* ======================================================================
     ADINKRA — hand-stamped symbols
     Carved calabash stamps pressed into cloth with badie bark ink.
     ====================================================================== */

  const SYMBOLS = {
    // Adinkrahene — greatness, charisma
    adinkrahene: (s) => `<circle cx="0" cy="0" r="${s * .46}" fill="none" stroke-width="${s * .09}"/>
      <circle cx="0" cy="0" r="${s * .3}" fill="none" stroke-width="${s * .09}"/>
      <circle cx="0" cy="0" r="${s * .13}" fill="none" stroke-width="${s * .09}"/>`,
    // Nsoromma — child of the heavens, guardianship
    nsoromma: (s) => `<path d="M0 ${-s * .5}L${s * .13} ${-s * .16}L${s * .5} 0L${s * .13} ${s * .16}L0 ${s * .5}L${-s * .13} ${s * .16}L${-s * .5} 0L${-s * .13} ${-s * .16}Z" stroke-width="${s * .05}"/>`,
    // Nkyinkyim — initiative, dynamism, versatility
    nkyinkyim: (s) => `<path d="M${-s * .46} ${s * .42}L${-s * .46} ${-s * .1}L${-s * .15} ${-s * .1}L${-s * .15} ${-s * .46}L${s * .16} ${-s * .46}L${s * .16} ${s * .08}L${s * .46} ${s * .08}L${s * .46} ${s * .42}"
      fill="none" stroke-width="${s * .13}" stroke-linecap="square"/>`,
    // Fihankra — the compound house, security and safety
    fihankra: (s) => `<path d="M${-s * .44} ${-s * .44}H${s * .44}V${s * .44}H${-s * .04}V${s * .16}H${-s * .44}Z" fill="none" stroke-width="${s * .12}"/>`,
    // Akoma — the heart, patience and tolerance
    akoma: (s) => `<path d="M0 ${s * .44}C${-s * .5} ${s * .06} ${-s * .42} ${-s * .44} ${-s * .12} ${-s * .32}C${-s * .04} ${-s * .28} 0 ${-s * .2} 0 ${-s * .14}C0 ${-s * .2} ${s * .04} ${-s * .28} ${s * .12} ${-s * .32}C${s * .42} ${-s * .44} ${s * .5} ${s * .06} 0 ${s * .44}Z" stroke-width="${s * .04}"/>`,
    // Nyame Dua — the altar, God's presence and protection
    nyamedua: (s) => `<path d="M0 ${-s * .48}L${s * .17} ${-s * .17}L${s * .48} 0L${s * .17} ${s * .17}L0 ${s * .48}L${-s * .17} ${s * .17}L${-s * .48} 0L${-s * .17} ${-s * .17}Z" fill="none" stroke-width="${s * .11}"/>
      <circle cx="0" cy="0" r="${s * .09}"/>`,
    // Dwennimmen — ram's horns, humility together with strength
    dwennimmen: (s) => `<g fill="none" stroke-width="${s * .11}" stroke-linecap="round">
      <path d="M${-s * .06} ${-s * .34}A${s * .2} ${s * .2} 0 1 0 ${-s * .38} ${-s * .12}"/>
      <path d="M${s * .06} ${-s * .34}A${s * .2} ${s * .2} 0 1 1 ${s * .38} ${-s * .12}"/>
      <path d="M${-s * .06} ${s * .34}A${s * .2} ${s * .2} 0 1 1 ${-s * .38} ${s * .12}"/>
      <path d="M${s * .06} ${s * .34}A${s * .2} ${s * .2} 0 1 0 ${s * .38} ${s * .12}"/>
      <path d="M0 ${-s * .34}V${s * .34}"/></g>`,
    // Duafe — the wooden comb, care and feminine excellence
    duafe: (s) => `<path d="M${-s * .34} ${s * .44}H${s * .34}V${s * .16}H${-s * .34}Z" stroke-width="${s * .04}"/>
      <g stroke-width="${s * .1}" stroke-linecap="round">
      <path d="M${-s * .24} ${s * .16}V${-s * .44}"/><path d="M${-s * .08} ${s * .16}V${-s * .44}"/>
      <path d="M${s * .08} ${s * .16}V${-s * .44}"/><path d="M${s * .24} ${s * .16}V${-s * .44}"/></g>`,
    // Epa — the handcuff, law and justice
    epa: (s) => `<g fill="none" stroke-width="${s * .1}">
      <circle cx="${-s * .27}" cy="0" r="${s * .19}"/><circle cx="${s * .27}" cy="0" r="${s * .19}"/>
      <path d="M${-s * .08} 0H${s * .08}"/></g>`,
    // Akofena — the sword of war, courage and legitimate authority
    akofena: (s) => `<g fill="none" stroke-width="${s * .09}" stroke-linecap="round">
      <path d="M${-s * .42} ${s * .42}L${s * .34} ${-s * .34}"/><path d="M${s * .42} ${s * .42}L${-s * .34} ${-s * .34}"/>
      <path d="M${s * .2} ${-s * .44}l${s * .22} ${s * .1}l${-s * .1} ${s * .22}"/>
      <path d="M${-s * .2} ${-s * .44}l${-s * .22} ${s * .1}l${s * .1} ${s * .22}"/></g>`
  };

  function adinkra(seed, variant) {
    const r = rng(seed);
    const pal = PALETTES[variant] || PALETTES.adinkra;
    const W = 600, H = 840;
    const keys = Object.keys(SYMBOLS);
    // the cloth is divided by combed lines into panels, then stamped
    const cols = rint(r, 3, 4);
    const rows = Math.round(cols * (H / W));
    const cw = W / cols, ch = H / rows;

    let body = `<rect width="${W}" height="${H}" fill="${pal.ground}"/>`;

    // combed dividing lines (nwomu) — drawn by hand, so they wobble
    let lines = '';
    for (let i = 1; i < cols; i++) {
      const x = i * cw;
      lines += `<path d="M${x} 0 ${Array.from({ length: 8 }, (_, k) => `L${(x + (r() - .5) * 5).toFixed(1)} ${((k + 1) * H / 8).toFixed(0)}`).join(' ')}" stroke="${pal.halo}" stroke-width="2.6" fill="none" opacity=".85"/>`;
    }
    for (let j = 1; j < rows; j++) {
      const y = j * ch;
      lines += `<path d="M0 ${y} ${Array.from({ length: 8 }, (_, k) => `L${((k + 1) * W / 8).toFixed(0)} ${(y + (r() - .5) * 5).toFixed(1)}`).join(' ')}" stroke="${pal.halo}" stroke-width="2.6" fill="none" opacity=".85"/>`;
    }
    body += `<g filter="url(#crack${seed})">${lines}</g>`;

    // one symbol per panel, repeated in a small grid, each stamp misregistered
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const key = keys[(i * rows + j + seed) % keys.length];
        const n = 2;
        const sz = Math.min(cw, ch) / n * 0.74;
        let g = '';
        for (let a = 0; a < n; a++) {
          for (let b = 0; b < n; b++) {
            const cx = i * cw + cw * (a + .5) / n + (r() - .5) * 6;
            const cy = j * ch + ch * (b + .5) / n + (r() - .5) * 6;
            const rot = (r() - .5) * 9;
            g += `<g transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(${rot.toFixed(1)})" opacity="${(0.78 + r() * 0.22).toFixed(2)}">${SYMBOLS[key](sz)}</g>`;
          }
        }
        body += `<g fill="${pal.ink}" stroke="${pal.ink}" filter="url(#wax${seed})">${g}</g>`;
      }
    }

    return svg(W, H, defs(seed) + body + weaveOverlay(W, H, seed, 0.26));
  }

  /* ======================================================================
     BATIK / WAX PRINT — wax resist with the crackle that gives it away
     ====================================================================== */

  function batik(seed, variant) {
    const r = rng(seed);
    const pal = PALETTES[variant] || PALETTES.batik;
    const W = 600, H = 840;
    let body = `<rect width="${W}" height="${H}" fill="${pal.ground}"/>`;

    const mode = rint(r, 0, 2);
    let motifs = '';

    if (mode === 0) {
      // concentric rosettes on a staggered grid
      const cols = rint(r, 3, 4), rows = Math.round(cols * H / W);
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const cx = (i + .5 + (j % 2 ? .5 : 0)) * (W / cols);
          const cy = (j + .5) * (H / rows);
          const R = Math.min(W / cols, H / rows) * (0.3 + r() * 0.1);
          for (let k = 3; k >= 1; k--) {
            motifs += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(R * k / 3).toFixed(1)}" fill="none" stroke="${k === 2 ? pal.accent : pal.wax}" stroke-width="${(R * .17).toFixed(1)}"/>`;
          }
          motifs += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(R * .1).toFixed(1)}" fill="${pal.wax}"/>`;
        }
      }
    } else if (mode === 1) {
      // leaf / cowrie field
      for (let i = 0; i < 44; i++) {
        const cx = r() * W, cy = r() * H;
        const s = 26 + r() * 40;
        const rot = r() * 360;
        const col = r() > .78 ? pal.accent : pal.wax;
        motifs += `<g transform="translate(${cx.toFixed(0)} ${cy.toFixed(0)}) rotate(${rot.toFixed(0)})">
          <path d="M0 ${-s} C${s * .7} ${-s * .35} ${s * .7} ${s * .35} 0 ${s} C${-s * .7} ${s * .35} ${-s * .7} ${-s * .35} 0 ${-s}Z" fill="none" stroke="${col}" stroke-width="${(s * .12).toFixed(1)}"/>
          <path d="M0 ${-s * .7}V${s * .7}" stroke="${col}" stroke-width="${(s * .09).toFixed(1)}"/></g>`;
      }
    } else {
      // banded stripes broken by dotted rows
      let y = 0, i = 0;
      while (y < H) {
        const h = 26 + r() * 62;
        if (i % 3 === 1) {
          const dots = Math.floor(W / 34);
          for (let d = 0; d < dots; d++) {
            motifs += `<circle cx="${((d + .5) * W / dots).toFixed(1)}" cy="${(y + h / 2).toFixed(1)}" r="${(6 + r() * 5).toFixed(1)}" fill="${r() > .8 ? pal.accent : pal.wax}"/>`;
          }
        } else if (i % 3 === 2) {
          motifs += `<rect x="0" y="${y.toFixed(1)}" width="${W}" height="${(h * .5).toFixed(1)}" fill="${pal.wax}"/>`;
        } else {
          motifs += `<rect x="0" y="${y.toFixed(1)}" width="${W}" height="${(h * .22).toFixed(1)}" fill="${pal.accent}"/>`;
        }
        y += h; i++;
      }
    }

    body += `<g filter="url(#wax${seed})">${motifs}</g>`;

    // the crackle: hairline fractures where the wax broke before dyeing
    let cracks = '';
    for (let i = 0; i < 26; i++) {
      let x = r() * W, y = r() * H;
      let d = `M${x.toFixed(0)} ${y.toFixed(0)}`;
      const steps = rint(r, 5, 13);
      let ang = r() * Math.PI * 2;
      for (let k = 0; k < steps; k++) {
        ang += (r() - .5) * 1.5;
        const len = 20 + r() * 55;
        x += Math.cos(ang) * len; y += Math.sin(ang) * len;
        d += `L${x.toFixed(0)} ${y.toFixed(0)}`;
      }
      cracks += `<path d="${d}" fill="none" stroke="${pal.ground}" stroke-width="${(0.9 + r() * 1.5).toFixed(1)}" opacity=".55"/>`;
    }
    body += `<g filter="url(#crack${seed})">${cracks}</g>`;

    return svg(W, H, defs(seed) + body + weaveOverlay(W, H, seed, 0.24));
  }

  /* ======================================================================
     ADIRE / INDIGO RESIST — tied and stitched before the dye vat
     ====================================================================== */

  function adire(seed) {
    const r = rng(seed);
    const pal = PALETTES.adire;
    const W = 600, H = 840;
    let body = `<rect width="${W}" height="${H}" fill="${pal.ground}"/>`;
    let m = '';

    const cols = rint(r, 4, 6);
    const rows = Math.round(cols * H / W);
    const cw = W / cols, ch = H / rows;

    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const cx = (i + .5) * cw, cy = (j + .5) * ch;
        const kind = (i + j) % 3;
        const R = Math.min(cw, ch) * .42;
        if (kind === 0) {
          for (let k = 4; k >= 1; k--) {
            m += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(R * k / 4).toFixed(1)}" fill="none" stroke="${pal.resist}" stroke-width="${(R * .12).toFixed(1)}" opacity="${(0.35 + k * 0.15).toFixed(2)}"/>`;
          }
        } else if (kind === 1) {
          // stitched grid squares
          for (let k = 3; k >= 1; k--) {
            const s = R * k / 3;
            m += `<rect x="${(cx - s).toFixed(1)}" y="${(cy - s).toFixed(1)}" width="${(s * 2).toFixed(1)}" height="${(s * 2).toFixed(1)}" fill="none" stroke="${pal.resist}" stroke-width="${(R * .1).toFixed(1)}" stroke-dasharray="${(R * .22).toFixed(1)} ${(R * .13).toFixed(1)}" opacity=".7"/>`;
          }
        } else {
          // radiating rays from a tied point
          for (let k = 0; k < 10; k++) {
            const a = (k / 10) * Math.PI * 2;
            m += `<path d="M${(cx + Math.cos(a) * R * .18).toFixed(1)} ${(cy + Math.sin(a) * R * .18).toFixed(1)}L${(cx + Math.cos(a) * R).toFixed(1)} ${(cy + Math.sin(a) * R).toFixed(1)}" stroke="${pal.resist}" stroke-width="${(R * .11).toFixed(1)}" opacity=".7" stroke-linecap="round"/>`;
          }
          m += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(R * .14).toFixed(1)}" fill="${pal.resist}" opacity=".85"/>`;
        }
      }
    }
    body += `<g filter="url(#wax${seed})">${m}</g>`;
    return svg(W, H, defs(seed) + body + weaveOverlay(W, H, seed, 0.34));
  }

  /* ======================================================================
     FUGU — northern smock cloth, narrow loomed stripes
     ====================================================================== */

  function fugu(seed) {
    const r = rng(seed);
    const pal = PALETTES.fugu;
    const W = 600, H = 840;
    let body = `<rect width="${W}" height="${H}" fill="${pal.threads[1]}"/>`;

    // warp stripes
    let x = 0;
    const seq = [];
    while (x < W) {
      const w = pick(r, [6, 10, 4, 18, 26, 8]);
      seq.push([x, w, pick(r, pal.threads)]);
      x += w;
    }
    seq.forEach(([sx, sw, c]) => {
      body += `<rect x="${sx}" y="0" width="${sw + .5}" height="${H}" fill="${c}"/>`;
    });
    // weft crossing at lower opacity gives the true check
    let y = 0;
    while (y < H) {
      const h = pick(r, [6, 10, 4, 18, 26, 8]);
      body += `<rect x="0" y="${y}" width="${W}" height="${h + .5}" fill="${pick(r, pal.threads)}" opacity=".42"/>`;
      y += h;
    }
    return svg(W, H, defs(seed) + body + weaveOverlay(W, H, seed, 0.4));
  }

  /* ======================================================================
     CALICO — undyed base cloth, used for quiet backgrounds
     ====================================================================== */

  function calico(seed) {
    const r = rng(seed);
    const pal = PALETTES.calico;
    const W = 600, H = 840;
    let body = `<rect width="${W}" height="${H}" fill="${pal.ground}"/>`;
    for (let i = 0; i < 90; i++) {
      const y = r() * H;
      body += `<rect x="0" y="${y.toFixed(1)}" width="${W}" height="${(0.6 + r()).toFixed(1)}" fill="${pal.thread}" opacity="${(r() * .5).toFixed(2)}"/>`;
    }
    return svg(W, H, defs(seed) + body + weaveOverlay(W, H, seed, 0.5));
  }

  /* --- assembly ---------------------------------------------------------- */

  function svg(w, h, inner) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice">${inner}</svg>`;
  }

  const MAKERS = {
    kente, 'kente-royal': (s) => kente(s, 'kenteRoyal'), 'kente-bride': (s) => kente(s, 'kenteBride'),
    adinkra, 'adinkra-indigo': (s) => adinkra(s, 'adinkraIndigo'),
    batik, 'batik-clay': (s) => batik(s, 'batikClay'),
    adire, fugu, calico
  };

  const cache = new Map();

  /** make('kente', 12) -> "data:image/svg+xml,..." */
  function make(kind, seed = 1) {
    const key = kind + ':' + seed;
    if (cache.has(key)) return cache.get(key);
    const maker = MAKERS[kind] || kente;
    const uri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(maker(seed | 0));
    cache.set(key, uri);
    return uri;
  }

  function css(kind, seed) { return `url("${make(kind, seed)}")`; }

  /** Paint every [data-cloth] element. Cheap enough to run on load. */
  function paint(root = document) {
    root.querySelectorAll('[data-cloth]').forEach((el) => {
      const kind = el.dataset.cloth;
      const seed = parseInt(el.dataset.seed || '1', 10);
      el.style.backgroundImage = css(kind, seed);
    });
  }

  return { make, css, paint, kinds: Object.keys(MAKERS) };
})();

window.Cloth = Cloth;
