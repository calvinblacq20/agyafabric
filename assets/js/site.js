/* ==========================================================================
   site.js — chrome behaviour and page boot
   ========================================================================== */

(() => {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const lerp = (a, b, t) => a + (b - a) * t;

  /* --- Accra clock ------------------------------------------------------- */

  function clock() {
    const out = $('[data-clock]');
    if (!out) return;
    const fmt = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Accra'
    });
    const tick = () => { out.textContent = fmt.format(new Date()); };
    tick();
    setInterval(tick, 10000);
  }

  /* --- Capsule nav pill --------------------------------------------------- */

  function capsule() {
    const nav = $('.capsule');
    if (!nav) return;
    const pill = $('.capsule-pill', nav);
    const links = $$('a', nav);
    const active = $('a[aria-current="page"]', nav) || links[0];
    if (!pill || !active) return;

    const move = (el) => {
      pill.style.width = el.offsetWidth + 'px';
      pill.style.transform = `translate3d(${el.offsetLeft}px, 0, 0)`;
    };

    requestAnimationFrame(() => {
      pill.style.transition = 'none';
      move(active);
      requestAnimationFrame(() => { pill.style.transition = ''; });
    });

    links.forEach((a) => a.addEventListener('mouseenter', () => move(a)));
    nav.addEventListener('mouseleave', () => move(active));
    window.addEventListener('resize', () => move(active));
  }

  /* --- Hover preview on index rows ---------------------------------------- */

  function hoverPreview() {
    const rows = $$('[data-preview]');
    if (!rows.length || window.matchMedia('(hover: none)').matches) return;

    const box = document.createElement('div');
    box.className = 'hover-preview';
    box.innerHTML = '<div class="swatch"></div>';
    document.body.appendChild(box);
    const swatch = $('.swatch', box);

    let tx = 0, ty = 0, x = 0, y = 0, on = false;

    window.addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; }, { passive: true });

    const loop = () => {
      x = lerp(x, tx, 0.12); y = lerp(y, ty, 0.12);
      const skew = Math.max(-8, Math.min(8, (tx - x) * 0.09));
      box.style.left = x + 'px';
      box.style.top = y + 'px';
      box.style.setProperty('--skew', skew.toFixed(2) + 'deg');
      if (on) box.style.transform = `translate(-50%, -50%) rotate(${(-2 + skew * 0.4).toFixed(2)}deg)`;
      requestAnimationFrame(loop);
    };
    loop();

    rows.forEach((row) => {
      row.addEventListener('pointerenter', () => {
        swatch.style.backgroundImage = Cloth.css(row.dataset.preview || 'kente', parseInt(row.dataset.previewSeed || '1', 10));
        box.classList.add('is-on');
        on = true;
      });
      row.addEventListener('pointerleave', () => { box.classList.remove('is-on'); on = false; });
    });
  }

  /* --- Cloth filter -------------------------------------------------------- */

  function filters() {
    const chips = $$('[data-filter]');
    const grid = $('[data-filter-grid]');
    if (!chips.length || !grid) return;
    const cells = $$('[data-tag]', grid);
    const count = $('[data-stock-count]');

    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const tag = chip.dataset.filter;
        chips.forEach((c) => c.classList.toggle('is-on', c === chip));

        let shown = 0;
        cells.forEach((cell) => {
          const match = tag === 'all' || cell.dataset.tag === tag;
          cell.classList.toggle('is-filtered-out', !match);
          if (match) shown++;
        });
        if (count) count.textContent = shown;

        // re-run the entrance so the new set arrives rather than just appearing
        cells.forEach((cell, i) => {
          if (cell.classList.contains('is-filtered-out')) return;
          cell.classList.remove('is-revealed');
          void cell.offsetWidth;
          setTimeout(() => cell.classList.add('is-revealed'), i * 45);
        });
      });
    });
  }

  /* --- Anchor links ------------------------------------------------------- */

  function anchors() {
    $$('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        if (id.length < 2) return;
        const t = $(id);
        if (!t) return;
        e.preventDefault();
        window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 40, behavior: 'smooth' });
      });
    });
  }

  /* --- Boot ---------------------------------------------------------------- */

  function boot() {
    Cloth.paint();
    clock();
    capsule();
    hoverPreview();
    filters();
    anchors();
    Motion.init();

    const stage = $('[data-stage]');
    if (stage && window.SITE_CLOTHS) {
      Ribbon.init(stage, $('[data-hero-track]'), window.SITE_CLOTHS);
    }

    // Above-the-fold copy still arrives in sequence, it just no longer waits
    // behind a loading screen. Nothing gates it but the stagger itself.
    $$('[data-reveal-onload]').forEach((el, i) => {
      setTimeout(() => el.classList.add('is-revealed'), 60 + i * 90);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
