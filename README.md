# Uncle Agya — Textile House, Accra

A five-page editorial site for a Ghanaian cloth shop: kente, adinkra, batik, adire and fugu.
Static HTML, CSS and vanilla JS. No build step, no dependencies, no framework.

## Run it

```bash
node server.mjs
```

Then open <http://localhost:5173>. Any static server works; `server.mjs` is a ~30 line
zero-dependency one so the project needs nothing installed.

## Pages

| File | Role |
| --- | --- |
| `index.html` | Hero cloth rack, manifesto, pinned collections rail, craft steps, stock list |
| `collections.html` | Six houses of cloth, each with its own scroll section |
| `cloth.html` | What is in stock, filterable, with prices |
| `atelier.html` | Made-to-measure services and how a commission runs |
| `about.html` | Info page — who we are, who we buy from, how to reach us |

## How it is put together

```
assets/
  css/
    main.css      tokens, reset, type scale, split-text + reveal primitives
    chrome.css    preloader, fixed frame, capsule nav, cursor, scroll cue
    sections.css  every section layout
  js/
    cloth.js      procedural cloth generator  ← the visual identity
    motion.js     text splitting, reveals, the scroll engine
    ribbon.js     the 3D hero rack
    data.js       catalogue content
    site.js       chrome behaviour and page boot
```

### The cloth is drawn, not photographed

`cloth.js` generates every swatch as SVG and returns it as a data URI. There are no image
files in this repo. Each generator is seeded, so a given cloth renders identically on every
page and every reload.

| Kind | What it draws |
| --- | --- |
| `kente`, `kente-royal`, `kente-bride` | Strip weave. Warp-faced and weft-faced blocks alternate down each strip, and neighbouring strips are offset so the blocks break joint — the same reason real kente has its rhythm. |
| `adinkra`, `adinkra-indigo` | Combed panels stamped with ten symbols (Adinkrahene, Nsoromma, Nkyinkyim, Fihankra, Akoma, Nyame Dua, Dwennimmen, Duafe, Epa, Akofena), each stamp misregistered and rotated a little. |
| `batik`, `batik-clay` | Wax resist with rosette, leaf or banded motifs, then hairline crackle where the wax broke. |
| `adire` | Indigo tie and stitch resist — rings, stitched squares, radiating rays. |
| `fugu` | Northern smock cloth: narrow warp stripes crossed by weft at lower opacity. |
| `calico` | Undyed base cloth for quiet backgrounds. |

Add a swatch anywhere with `<div data-cloth="kente" data-seed="1201"></div>`; `Cloth.paint()`
fills it on load. Or call `Cloth.css('adire', 404)` for a background-image value.

### Motion

Everything scroll-linked runs through one `requestAnimationFrame` loop in `motion.js`.
One-shot things (entrance reveals, count-ups) use `IntersectionObserver` instead, so the
loop stays cheap.

| Effect | Markup |
| --- | --- |
| Letter-by-letter mask reveal | `data-split="chars" data-reveal` |
| Word-by-word mask reveal | `data-split="words" data-reveal` |
| Shared stagger across elements | `data-split-group="hero"` |
| Fires after the preloader instead of on scroll | `data-reveal-onload` |
| Words ink in as the section passes | `data-ink` (+ `data-ink-accent="hand,loom"` to redden some) |
| Parallax | `data-parallax="0.12"` |
| Pinned horizontal rail | `data-horiz` on the track, `.horiz-rail` inside |
| Step list that follows scroll depth | `data-steps` |
| Marquee, pushed by scroll velocity | `data-marquee` (`data-marquee="reverse"` to flip) |
| Count-up figure | `data-count="1974"` |
| Cursor label on hover | `data-cursor="Drag"` |
| Hover-follow preview card | `data-preview="kente" data-preview-seed="101"` |

The hero rack (`ribbon.js`) puts every cloth on one straight diagonal path, all cards
parallel. Scrolling the pinned hero pushes them past the viewer, dragging does the same by
hand, and a slow drift keeps it breathing when the page is still. Cards that fall off the
near end wrap to the far end while invisible, so the rack reads as endless.

### Motion levels

The level is resolved ONCE by an inline script in `<head>`, before first paint, into
`<html data-motion="full|calm|off">`. CSS and JS both read that attribute and neither reads
the media query, so they cannot disagree. `off` is the markup default, so with scripting
disabled the page is delivered complete and readable.

| Level | When | What runs |
| --- | --- | --- |
| `full` | nothing requested | everything |
| `calm` | reduced motion requested | opacity fades, and ambient loops at a constant rate — the marquee, the rack drift, the loom mark |
| `off` | no JavaScript | nothing; every element ships in its final state |

**calm is not a kill switch.** On iOS `prefers-reduced-motion` is true for Low Power Mode as
well as the Reduce Motion toggle, so a phone at 20% battery reports the same thing as one
whose owner asked for less movement. Switching everything off there makes the site look
broken to a large share of real visitors, with nothing on screen to explain why. So calm
keeps what the preference is not about — opacity is not motion, and a marquee turning at a
constant rate inside its own frame is not either — and drops what it is about: parallax,
scroll-coupled travel, slide-ins, scaling.

Dropping a coupling is not enough on its own. A pinned section whose transform no longer
runs is just a tall block of dead scroll holding content you can never reach, so in calm the
hero unpins to one viewport and the collections rail becomes an ordinary horizontal
scroller with scroll snapping. Every panel stays reachable.

Add `?motion=full`, `?motion=calm` or `?motion=off` to any URL to force a level. That is how
you tell a device setting apart from a bug on a handset you cannot inspect.

### Why the loop is built the way it is

- **No observer starts anything.** Reveals and count-ups are decided from cached geometry
  inside the loop, and again on the scroll event. One undelivered IntersectionObserver
  callback would otherwise strand content at `opacity: 0` permanently.
- **Elapsed milliseconds, never frame counts.** Every advance is `px/second × dt`, and `dt` is
  clamped to 100ms so returning from background does not lurch. Smoothing uses a time
  constant, so the rack settles at the same speed at 30fps and 120fps.
- **A watchdog restarts the loop.** Safari suspends rAF on backgrounding, on bfcache restore,
  and while a finger is down, and does not reliably resume. A 1s timer notices missing frames
  and restarts, measuring from the later of the last delivered frame and the last restart so
  a restart that produced nothing is not mistaken for a healthy loop.
- **No layout reads in the loop.** Everything is measured on resize, orientation change,
  bfcache restore and font load, then cached. The loop reads `scrollY` and nothing else, and
  writes a style only when the value actually changed.
- **Easing stays near linear.** A steep curve holds an element still for most of its duration
  and then whips it, which reads as broken rather than eased.
- **No live filters on anything that re-renders every frame.** The blur on the ribbon
  reflections is gone; the softness is carried by the mask instead.

### motion-check.html

Open `/motion-check.html` on the handset. It reports the resolved level, the raw media query,
frames actually delivered, the longest gap between them, whether CSS animations and
`document.timeline` are advancing, `visibilityState`, and how many times the watchdog fired —
with one bar moved by JS beside one moved by CSS. If the CSS bar moves and the JS bar does
not, script is being throttled rather than the compositor. Two seconds there beats an hour
of theorising.

### On touch devices

The hover-only layers are not built at all on a coarse pointer: no custom cursor, no
hover-follow preview card. Rows and panels stay tappable links, they just do not preview.

- The hero rack claims a swipe only once it is clearly sideways, so a vertical drag scrolls
  the page instead of spinning the cloth.
- Pinned sections use `100svh`, so nothing jumps when the phone address bar hides.
- The fixed frame respects `env(safe-area-inset-*)` for notched phones.
- The preloader unlocks the page on a failsafe timer as well as on its animation, because a
  backgrounded tab throttles `requestAnimationFrame` to a crawl.
- Step lists keep inactive items at 62% rather than 32%: on a phone the whole list is on
  screen at once, so the desktop dimming would make most of it unreadable.

`prefers-reduced-motion` is honoured throughout: transforms resolve to their end state, the
preloader skips, and the marquee and drift stop.

## Things worth knowing before this ships

- The frame markup (top bar, capsule nav, preloader) is duplicated across the five pages.
  Fine at this size; if it grows past a handful of pages, move it to a template or a static
  site generator rather than hand-editing five copies.
- Phone number, social links and the street address are placeholders.
- Prices are hard-coded in the markup. A real shop wants them in one place — either
  `data.js` rendered client-side, or a CMS.
- There is no cart or checkout. Every product links to the atelier enquiry page.
- Fonts load from Google Fonts. Self-host them before launch if you want to drop the
  third-party request.
