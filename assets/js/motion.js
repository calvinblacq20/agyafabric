/* ==========================================================================
   motion.js — typography splitting, reveals, and the scroll engine
   --------------------------------------------------------------------------
   Design rules this file is built to, learned the hard way on iOS:

   · Motion level is resolved ONCE, in <head>, into <html data-motion>. Nothing
     here reads a media query, so CSS and JS can never disagree.
   · "calm" means less motion, not none. Opacity and constant-rate ambient
     loops keep running; parallax and scroll-coupled travel do not.
   · No IntersectionObserver gates the START of anything. Reveals are decided
     from cached geometry inside the loop and again on the scroll event, so a
     single undelivered callback cannot strand content at opacity 0.
   · Everything advances on elapsed milliseconds, clamped, so returning from
     background does not lurch.
   · Layout is measured on resize and cached. The loop reads scrollY and
     nothing else, and only writes a style when the value actually changed.
   · A watchdog restarts the loop. Safari suspends rAF on backgrounding, on
     bfcache restore, and while a finger is down, and does not reliably resume.
   ========================================================================== */

const Motion = (() => {
  'use strict';

  const root = document.documentElement;
  const declared = root.getAttribute('data-motion');
  const mode = (declared === 'calm' || declared === 'off' || declared === 'full')
    ? declared
    : 'full';

  const runs  = mode !== 'off';    // scripted animation at all
  const moves = mode === 'full';   // positional / scaling motion allowed

  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const round = (v, p = 2) => Math.round(v * 10 ** p) / 10 ** p;

  /* ======================================================================
     1. Split text into masked words / letters
     ====================================================================== */

  function shell() {
    const s = document.createElement('span');
    s.className = 'split-line';
    s.style.display = 'inline-block';
    s.style.verticalAlign = 'bottom';
    return s;
  }

  function split(el, kind = 'words', startIndex = 0) {
    if (el.dataset.splitDone) return startIndex;
    const frag = document.createDocumentFragment();
    let i = startIndex;

    const token = (word) => {
      const holder = shell();
      if (kind === 'chars') {
        [...word].forEach((ch) => {
          const inner = document.createElement('span');
          inner.className = 'split-char';
          inner.textContent = ch;
          inner.style.setProperty('--d', (i * 26) + 'ms');
          holder.appendChild(inner);
          i++;
        });
      } else {
        const inner = document.createElement('span');
        inner.className = 'split-word';
        inner.textContent = word;
        inner.style.setProperty('--d', (i * 62) + 'ms');
        holder.appendChild(inner);
        i++;
      }
      frag.appendChild(holder);
      frag.appendChild(document.createTextNode(' '));
    };

    // walk children so <br> line breaks and inline markup survive
    [...el.childNodes].forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        node.textContent.replace(/\s+/g, ' ').split(' ').filter(Boolean).forEach(token);
      } else if (node.nodeName === 'BR') {
        frag.appendChild(document.createElement('br'));
      } else {
        frag.appendChild(node.cloneNode(true));
      }
    });

    el.textContent = '';
    el.appendChild(frag);
    el.dataset.splitDone = '1';
    return i;
  }

  function splitAll(scope) {
    const groups = new Map();
    scope.querySelectorAll('[data-split]').forEach((el) => {
      const g = el.dataset.splitGroup || Math.random().toString(36);
      groups.set(g, split(el, el.dataset.split, groups.get(g) || 0));
    });
  }

  /* ======================================================================
     2. Geometry cache — every layout read happens here, never in the loop
     ====================================================================== */

  let vh = window.innerHeight;
  let vw = window.innerWidth;
  const measurers = [];

  function onMeasure(fn) { measurers.push(fn); fn(); }

  function measureAll() {
    vh = window.innerHeight;
    vw = window.innerWidth;
    for (let i = 0; i < measurers.length; i++) measurers[i]();
  }

  const docTop = (el) => el.getBoundingClientRect().top + window.scrollY;

  /* ======================================================================
     3. The loop
     ====================================================================== */

  const updaters = [];
  const onFrame = (fn) => updaters.push(fn);

  let rafId = 0;
  let started = false;
  let lastTs = 0;
  let lastBeat = 0;     // last frame ACTUALLY delivered — never faked
  let lastStart = 0;    // last restart, so the watchdog gives it a grace period

  let smoothY = window.scrollY;
  let velocity = 0;          // px per second

  // delivered-frame stats, for the diagnostics page
  let frames = 0;
  let fpsWindowStart = 0;
  let fps = 0;

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    lastBeat = now;

    let dt = now - lastTs;
    if (!lastTs || dt < 0 || dt > 100) dt = 16.7;   // clamp: no lurch on resume
    lastTs = now;

    frames++;
    if (now - fpsWindowStart >= 500) {
      fps = Math.round((frames * 1000) / (now - fpsWindowStart));
      frames = 0;
      fpsWindowStart = now;
    }

    const targetY = window.scrollY;
    const prev = smoothY;
    // exponential smoothing on a time constant, so it is frame-rate independent
    smoothY += (targetY - smoothY) * (1 - Math.exp(-dt / 90));
    if (Math.abs(targetY - smoothY) < 0.05) smoothY = targetY;
    velocity = (smoothY - prev) / dt * 1000;

    const state = { y: smoothY, vh, vw, dt, now, velocity };
    for (let i = 0; i < updaters.length; i++) updaters[i](state);

    checkReveals(smoothY);
  }

  function start() {
    if (!runs) return;
    cancelAnimationFrame(rafId);
    lastTs = 0;
    lastStart = performance.now();
    fpsWindowStart = lastStart;
    frames = 0;
    started = true;
    rafId = requestAnimationFrame(frame);
  }

  /* Watchdog. Timers keep firing when rAF does not, so this is the one thing
     that can notice the loop has died and bring it back. It keeps trying for
     as long as frames are missing — a suspended tab may swallow several
     restarts before one takes. */
  function watchdog() {
    if (!started) return;
    const now = performance.now();
    // measure from the later of the last delivered frame and the last restart,
    // so a restart that never produced a frame is not mistaken for a healthy loop
    if (now - Math.max(lastBeat, lastStart) > 1200) start();
  }

  /* ======================================================================
     4. Reveals — geometry, not observers
     ====================================================================== */

  const revealItems = [];

  function setupReveals(scope) {
    scope.querySelectorAll('[data-reveal]').forEach((el) => {
      revealItems.push({ el, top: 0, delay: parseInt(el.dataset.revealDelay || '0', 10), done: false });
    });
    if (!revealItems.length) return;
    onMeasure(() => { for (const it of revealItems) it.top = docTop(it.el); });
  }

  function checkReveals(y) {
    if (!revealItems.length) return;
    const line = y + vh * 0.88;
    for (let i = 0; i < revealItems.length; i++) {
      const it = revealItems[i];
      if (it.done || it.top > line) continue;
      it.done = true;
      if (it.delay) setTimeout(() => it.el.classList.add('is-revealed'), it.delay);
      else it.el.classList.add('is-revealed');
    }
  }

  /* ======================================================================
     5. Count-up figures — elapsed time, gentle ease
     ====================================================================== */

  const countItems = [];

  function setupCounters(scope) {
    scope.querySelectorAll('[data-count]').forEach((el) => {
      const to = parseFloat(el.dataset.count);
      countItems.push({
        el, to, top: 0, t0: 0, running: false, done: false,
        dec: (el.dataset.count.split('.')[1] || '').length,
        last: ''
      });
    });
    if (!countItems.length) return;

    if (!runs) {
      countItems.forEach((it) => { it.el.textContent = it.to.toFixed(it.dec); });
      return;
    }

    onMeasure(() => { for (const it of countItems) it.top = docTop(it.el); });

    onFrame(({ y, now }) => {
      const line = y + vh * 0.78;
      for (let i = 0; i < countItems.length; i++) {
        const it = countItems[i];
        if (it.done) continue;
        if (!it.running) {
          if (it.top > line) continue;
          it.running = true;
          it.t0 = now;
        }
        const p = clamp((now - it.t0) / 1400);
        const eased = 1 - (1 - p) * (1 - p);        // quadratic out: never parks
        const text = (it.to * eased).toFixed(it.dec);
        if (text !== it.last) { it.el.textContent = text; it.last = text; }
        if (p >= 1) it.done = true;
      }
    });
  }

  /* ======================================================================
     6. Ink words — colour only, so it survives calm
     ====================================================================== */

  const inkItems = [];

  function setupInk(scope) {
    const holders = [...scope.querySelectorAll('[data-ink]')];
    if (!holders.length) return;

    holders.forEach((h) => {
      const source = h.textContent.replace(/\s+/g, ' ').trim();
      const accents = (h.dataset.inkAccent || '').toLowerCase()
        .split(',').map((s) => s.trim()).filter(Boolean);
      h.textContent = '';
      source.split(' ').forEach((word, i, arr) => {
        const s = document.createElement('span');
        s.className = 'ink-word';
        const bare = word.replace(/[^\p{L}\p{N}'’-]/gu, '').toLowerCase();
        if (accents.includes(bare)) s.classList.add('is-accent');
        s.textContent = word;
        h.appendChild(s);
        if (i < arr.length - 1) h.appendChild(document.createTextNode(' '));
      });
      inkItems.push({ el: h, words: [...h.querySelectorAll('.ink-word')], top: 0, height: 0, last: -1 });
    });

    if (!runs) {
      inkItems.forEach((it) => it.words.forEach((w) => w.classList.add('is-inked')));
      return;
    }

    onMeasure(() => {
      for (const it of inkItems) {
        const r = it.el.getBoundingClientRect();
        it.top = r.top + window.scrollY;
        it.height = r.height;
      }
    });

    onFrame(({ y }) => {
      for (let i = 0; i < inkItems.length; i++) {
        const it = inkItems[i];
        const p = clamp((y + vh * 0.72 - it.top) / (it.height + vh * 0.5));
        const upto = clamp(Math.round(p * it.words.length * 1.35), 0, it.words.length);
        if (upto === it.last) continue;              // write only on change
        if (upto > it.last) {
          for (let w = Math.max(0, it.last); w < upto; w++) it.words[w].classList.add('is-inked');
        } else {
          for (let w = it.last - 1; w >= upto; w--) it.words[w]?.classList.remove('is-inked');
        }
        it.last = upto;
      }
    });
  }

  /* ======================================================================
     7. Parallax — full only. Measured from the clip box, never from the
        element being transformed.
     ====================================================================== */

  function setupParallax(scope) {
    const els = [...scope.querySelectorAll('[data-parallax]')];
    if (!els.length) return;

    if (!moves) {                                   // calm / off: sit still
      els.forEach((el) => { el.style.transform = ''; });
      return;
    }

    const items = els.map((el) => ({
      el, box: el.parentElement,
      amt: parseFloat(el.dataset.parallax) || 0.15,
      top: 0, boxH: 0, slack: 0, last: null
    }));

    onMeasure(() => {
      for (const it of items) {
        const br = it.box.getBoundingClientRect();
        it.top = br.top + window.scrollY;
        it.boxH = br.height;
        // never travel further than the bleed the clip box gives us
        it.slack = Math.max(0, (it.el.offsetHeight - br.height) / 2);
      }
    });

    onFrame(({ y }) => {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const top = it.top - y;
        if (top + it.boxH < -200 || top > vh + 200) continue;
        const centre = top + it.boxH / 2 - vh / 2;
        let shift = -centre * it.amt;
        if (it.slack > 0) shift = clamp(shift, -it.slack, it.slack);
        shift = round(shift, 1);
        if (shift === it.last) continue;
        it.el.style.transform = `translate3d(0, ${shift}px, 0)`;
        it.last = shift;
      }
    });
  }

  /* ======================================================================
     8. Pinned horizontal rail — full only. In calm the pin is dropped and
        the rail becomes a normal horizontal scroller (see CSS), so the
        panels stay reachable without scroll-coupled travel.
     ====================================================================== */

  function setupHorizontal(scope) {
    const tracks = [...scope.querySelectorAll('[data-horiz]')];
    if (!tracks.length) return;

    if (!moves) {
      tracks.forEach((t) => { t.style.height = ''; });
      return;
    }

    const items = tracks.map((track) => ({
      track,
      rail: track.querySelector('.horiz-rail'),
      bar: track.querySelector('[data-horiz-bar]'),
      idx: track.querySelector('[data-horiz-index]'),
      panels: 0, top: 0, travel: 0, distance: 0, lastX: null, lastIdx: ''
    })).filter((it) => it.rail);

    onMeasure(() => {
      for (const it of items) {
        it.distance = Math.max(0, it.rail.scrollWidth - vw);
        // pin for the scroll distance plus a viewport of lead-in
        it.track.style.height = (it.distance + vh) + 'px';
        it.top = it.track.getBoundingClientRect().top + window.scrollY;
        it.travel = it.distance || 1;
        it.panels = it.rail.children.length;
      }
    });

    onFrame(({ y }) => {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const p = clamp((y - it.top) / it.travel);
        const x = round(-p * it.distance, 1);
        if (x !== it.lastX) {
          it.rail.style.transform = `translate3d(${x}px, 0, 0)`;
          if (it.bar) it.bar.style.transform = `scaleX(${round(p, 3)})`;
          it.lastX = x;
        }
        if (it.idx) {
          const n = String(Math.min(it.panels, Math.floor(p * it.panels) + 1)).padStart(2, '0');
          if (n !== it.lastIdx) { it.idx.textContent = n; it.lastIdx = n; }
        }
      }
    });
  }

  /* ======================================================================
     9. Step lists — opacity only, so it survives calm
     ====================================================================== */

  function setupSteps(scope) {
    const lists = [...scope.querySelectorAll('[data-steps]')];
    if (!lists.length || !runs) return;

    const items = lists.map((list) => ({
      list,
      section: list.closest('section') || list.parentElement,
      items: [...list.children],
      top: 0, height: 1, last: -1
    }));

    onMeasure(() => {
      for (const it of items) {
        const r = it.section.getBoundingClientRect();
        it.top = r.top + window.scrollY;
        it.height = r.height || 1;
      }
    });

    onFrame(({ y }) => {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const p = clamp((y + vh * 0.6 - it.top) / (it.height * 0.82));
        const active = Math.min(it.items.length - 1, Math.floor(p * it.items.length));
        if (active === it.last) continue;
        if (it.last > -1) it.items[it.last].classList.remove('is-active');
        it.items[active].classList.add('is-active');
        it.last = active;
      }
    });
  }

  /* ======================================================================
     10. Marquee — an ambient loop at a constant rate, so it keeps running in
         calm. Only the scroll-velocity coupling is dropped there.
     ====================================================================== */

  function setupMarquee(scope) {
    const rows = [...scope.querySelectorAll('[data-marquee]')];
    if (!rows.length || !runs) return;

    const items = [];
    rows.forEach((row) => {
      const unit = row.firstElementChild;
      if (!unit) return;
      items.push({
        row, unit, x: 0, width: 0, lastX: null,
        dir: row.dataset.marquee === 'reverse' ? 1 : -1,
        speed: (parseFloat(row.dataset.marqueeSpeed || '0.55')) * 60   // px per second
      });
    });

    onMeasure(() => {
      for (const it of items) {
        const w = it.unit.offsetWidth;
        if (!w) continue;
        // duplicate until the row is at least twice the viewport, so it wraps
        if (!it.width) {
          const need = Math.ceil((vw * 2) / w) + 1;
          for (let i = 0; i < need; i++) it.row.appendChild(it.unit.cloneNode(true));
        }
        it.width = w;
      }
    });

    onFrame(({ dt, velocity }) => {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!it.width) continue;
        const boost = moves ? Math.min(Math.abs(velocity) * 0.24, 840) : 0;
        it.x += it.dir * (it.speed + boost) * (dt / 1000);
        if (it.x <= -it.width) it.x += it.width;
        if (it.x >= 0) it.x -= it.width;
        const x = round(it.x, 1);
        if (x === it.lastX) continue;
        it.row.style.transform = `translate3d(${x}px, 0, 0)`;
        it.lastX = x;
      }
    });
  }

  /* ======================================================================
     11. Boot
     ====================================================================== */

  let resizeQueued = false;
  function queueMeasure() {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => { resizeQueued = false; measureAll(); checkReveals(window.scrollY); });
  }

  function init(scope = document) {
    splitAll(scope);
    setupReveals(scope);
    setupCounters(scope);
    setupInk(scope);
    setupParallax(scope);
    setupHorizontal(scope);
    setupSteps(scope);
    setupMarquee(scope);

    measureAll();
    checkReveals(window.scrollY);

    if (!runs) return;

    // A second, independent path to reveals: if rAF is suspended, scroll
    // events still arrive, and this uses only cached numbers.
    window.addEventListener('scroll', () => checkReveals(window.scrollY), { passive: true });
    window.addEventListener('resize', queueMeasure);
    window.addEventListener('orientationchange', () => { queueMeasure(); start(); });

    // Safari drops rAF on backgrounding, on bfcache restore, and mid-touch.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') start();
    });
    window.addEventListener('pageshow', (e) => { if (e.persisted) queueMeasure(); start(); });
    window.addEventListener('focus', start);
    window.addEventListener('touchend', start, { passive: true });
    setInterval(watchdog, 1000);

    if (document.fonts && document.fonts.ready) document.fonts.ready.then(queueMeasure);

    start();
  }

  return {
    init, split, splitAll, onFrame, onMeasure, measureAll, clamp,
    mode, runs, moves,
    stats: () => ({
      mode, fps,
      // honest: true only if a frame was really delivered recently
      beating: lastBeat > 0 && performance.now() - lastBeat < 1200,
      sinceLastFrame: lastBeat ? Math.round(performance.now() - lastBeat) : null,
      updaters: updaters.length
    })
  };
})();

window.Motion = Motion;
