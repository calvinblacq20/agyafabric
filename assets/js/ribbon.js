/* ==========================================================================
   ribbon.js — the hero: a rack of cloth travelling through Z space
   --------------------------------------------------------------------------
   Cards sit on one straight diagonal path, all parallel, receding to the top
   right. Cards that fall off the near end wrap to the far end while invisible,
   so the rack reads as endless.

   Motion levels:
     full — scroll through the pinned hero drives the rack, drag moves it by
            hand, and a slow drift keeps it alive when nothing else happens.
     calm — the drift alone. It is an ambient loop at a constant rate inside
            its own frame, which is exactly the kind of motion that survives a
            reduced-motion request; the scroll coupling and pointer parallax,
            which do not, are dropped. The hero is unpinned in CSS to match.
     off  — built and painted once, then left alone.

   Everything advances on elapsed milliseconds, geometry is measured through
   Motion's cache, and styles are written only when a value actually changed.
   ========================================================================== */

const Ribbon = (() => {
  'use strict';

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  function build(stage, cloths) {
    const rack = document.createElement('div');
    rack.className = 'ribbon';

    const cards = cloths.map((c, i) => {
      const el = document.createElement('article');
      el.className = 'cloth';

      const face = document.createElement('div');
      face.className = 'cloth-face';
      const img = Cloth.css(c.kind, c.seed);
      face.style.backgroundImage = img;

      const mirror = document.createElement('div');
      mirror.className = 'cloth-mirror';
      mirror.style.backgroundImage = img;

      const cap = document.createElement('div');
      cap.className = 'cloth-caption';
      cap.innerHTML = `<span class="micro">${String(i + 1).padStart(2, '0')}</span>
        <span class="label">${c.name}</span>
        <span class="micro dim">${c.origin}</span>`;

      el.append(face, mirror, cap);
      rack.appendChild(el);
      return { el, face, data: c, lastT: '', lastA: '', lastSheen: -1, lastVis: '' };
    });

    stage.appendChild(rack);
    return { rack, cards };
  }

  function init(stage, track, cloths, opts = {}) {
    if (!stage || !cloths.length) return;

    const { cards } = build(stage, cloths);
    const N = cards.length;
    const half = N / 2;

    const SX = opts.spacingX ?? 128;   // step to the right
    const SY = opts.spacingY ?? 34;    // step upward
    const SZ = opts.spacingZ ?? 236;   // step away from the viewer
    const TILT = opts.tilt ?? -52;     // every card shares the same Y rotation

    const moves = Motion.moves;        // scroll coupling + pointer parallax
    const runs = Motion.runs;

    let scrollP = 0, dragP = 0, driftP = 0;
    let shown = 0;
    let pointerX = 0, pointerY = 0, px = 0, py = 0, lastOrigin = '';
    let frontIndex = -1;

    const cycles = opts.cycles ?? N * 0.92;
    const DRIFT = 0.096;               // slots per second — constant rate

    const bar = document.querySelector('[data-hero-bar]');
    const counter = document.querySelector('[data-hero-count]');
    const nameOut = document.querySelector('[data-ribbon-name]');
    let lastBar = -1, lastCount = '';

    /* --- geometry, cached ------------------------------------------------ */
    let trackTop = 0, trackTravel = 1;
    if (track && moves) {
      Motion.onMeasure(() => {
        trackTop = track.getBoundingClientRect().top + window.scrollY;
        trackTravel = Math.max(1, track.offsetHeight - window.innerHeight);
      });
    }

    /* --- drag ------------------------------------------------------------ */
    let down = false, dragging = false, touch = false;
    let lastX = 0, lastY = 0, startX = 0, startY = 0, moved = 0;

    stage.addEventListener('pointerdown', (e) => {
      down = true; moved = 0;
      touch = e.pointerType === 'touch';
      lastX = startX = e.clientX;
      lastY = startY = e.clientY;
      // on touch we wait to see whether this is a swipe or a page scroll;
      // with a mouse there is nothing to disambiguate, so start straight away
      if (!touch) {
        dragging = true;
        stage.classList.add('is-dragging');
        stage.setPointerCapture?.(e.pointerId);
      }
    });

    stage.addEventListener('pointermove', (e) => {
      pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      pointerY = (e.clientY / window.innerHeight) * 2 - 1;
      if (!down) return;

      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      moved += Math.abs(dx) + Math.abs(dy);
      lastX = e.clientX; lastY = e.clientY;

      if (!dragging) {
        // claim the gesture only once it is clearly sideways
        const tx = Math.abs(e.clientX - startX);
        const ty = Math.abs(e.clientY - startY);
        if (tx < 10 || tx <= ty) return;
        dragging = true;
        stage.classList.add('is-dragging');
        stage.setPointerCapture?.(e.pointerId);
      }

      dragP -= (dx + (touch ? 0 : dy * 0.35)) / 132;
    });

    const release = (e) => {
      if (!down) return;
      down = false;
      dragging = false;
      stage.classList.remove('is-dragging');
      stage.releasePointerCapture?.(e?.pointerId);
    };
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);
    stage.addEventListener('pointerleave', release);

    /* --- paint ----------------------------------------------------------- */

    function paint(p) {
      let bestDist = Infinity, best = -1;

      for (let i = 0; i < N; i++) {
        // wrap the card's slot into [-half, half)
        let o = (i - p) % N;
        if (o < -half) o += N;
        if (o >= half) o -= N;

        const card = cards[i];

        // fade at both ends of the rack so the wrap is never seen
        const edge = half - Math.abs(o);
        const alpha = Math.min(clamp(edge / 1.35, 0, 1), clamp((o + half) / 1.1, 0, 1));

        const vis = alpha < 0.01 ? 'hidden' : 'visible';
        if (vis !== card.lastVis) { card.el.style.visibility = vis; card.lastVis = vis; }
        if (vis === 'hidden') { if (Math.abs(o) < bestDist) { bestDist = Math.abs(o); best = i; } continue; }

        const t = `translate3d(${(o * SX).toFixed(1)}px, ${(-o * SY).toFixed(1)}px, ${(-o * SZ).toFixed(1)}px) rotateY(${TILT}deg)`;
        if (t !== card.lastT) { card.el.style.transform = t; card.el.style.zIndex = String(1000 - Math.round(o * 10)); card.lastT = t; }

        const a = alpha.toFixed(2);
        if (a !== card.lastA) { card.el.style.opacity = a; card.lastA = a; }

        // the sheen slides as the card passes the front
        const sheen = Math.round((0.28 + clamp(Math.abs(o) / half, 0, 1) * 0.55) * 20) / 20;
        if (sheen !== card.lastSheen) { card.face.style.setProperty('--sheen', sheen); card.lastSheen = sheen; }

        const d = Math.abs(o);
        if (d < bestDist) { bestDist = d; best = i; }
      }

      if (best !== frontIndex) {
        if (frontIndex > -1) cards[frontIndex].el.classList.remove('is-front');
        if (best > -1) cards[best].el.classList.add('is-front');
        frontIndex = best;
        if (nameOut && best > -1) nameOut.textContent = cards[best].data.name;
      }
    }

    /* --- the frame -------------------------------------------------------- */

    if (runs) {
      Motion.onFrame(({ y, dt }) => {
        if (track && moves) {
          const p = clamp((y - trackTop) / trackTravel, 0, 1);
          scrollP = p * cycles;

          const b = Math.round(p * 1000) / 1000;
          if (b !== lastBar) {
            if (bar) bar.style.transform = `scaleX(${b})`;
            lastBar = b;
          }
          const n = String(Math.min(N, Math.floor(p * N) + 1)).padStart(2, '0');
          if (counter && n !== lastCount) { counter.textContent = n; lastCount = n; }
        }

        if (!dragging) driftP += DRIFT * (dt / 1000);   // constant rate, in slots per second

        const target = scrollP + dragP + driftP;
        // time-based smoothing, so the rack settles at the same speed on any device
        shown += (target - shown) * (1 - Math.exp(-dt / 130));

        if (moves) {
          px += (pointerX - px) * (1 - Math.exp(-dt / 240));
          py += (pointerY - py) * (1 - Math.exp(-dt / 240));
          const origin = `${(50 + px * 7).toFixed(1)}% ${(48 + py * 6).toFixed(1)}%`;
          if (origin !== lastOrigin) { stage.style.perspectiveOrigin = origin; lastOrigin = origin; }
        }

        paint(shown);
      });
    }

    paint(0);

    /* --- clicking a card opens its collection ----------------------------- */
    stage.addEventListener('click', (e) => {
      if (moved > 8) return;                       // that was a drag, not a click
      const card = e.target.closest('.cloth');
      if (!card) return;
      const i = cards.findIndex((c) => c.el === card);
      const href = cards[i]?.data.href;
      if (href) window.location.href = href;
    });

    return { cards };
  }

  return { init };
})();

window.Ribbon = Ribbon;
