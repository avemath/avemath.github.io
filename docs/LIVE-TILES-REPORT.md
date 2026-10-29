# Live tiles: overnight report

Branch `live-tiles`. Nothing is merged or pushed. Each step is its own commit.

## Needs your answer first

**The LED boot scroll shows "LEA".** You asked for the board's real boot scroll of a sister's first name. The firmware's message is her full name (`LEA MARIE`). I used only the first word, `LEA`, drawn with the firmware's own font, and left the middle name out of the page and out of the vendored excerpt. This conflicts with the children and family rule in the project rules (no names of Lea). I followed your newer, specific request and am flagging it here. It is one constant: `BOOT_MESSAGE` in `src/lib/led-firmware.ts`. If you'd rather keep her name off the site, change it before merging. Any word built from the firmware's letters (G R A C E M L I) will work.

## What I built

| Step | Commit | What it is |
| --- | --- | --- |
| 1 | `7d72934` | Featured work is now three full-width spotlight rows (RAMpage, V2V, LED), with the sides alternating, then a compact "More work" grid. Each row has: what you're looking at, Try this, Why it matters, the metric and the case study link. The RAMpage system blocks sit in one row with the code full width below once the panel is wide enough (container query). |
| 2 | `d6b8e89` | LED spotlight. Power on plays setup(): the boot scroll at 80 ms per column, three passes, then the 150 ms blank. After that, loop() runs on the generated demo track, with an optional "Try my mic". The firmware port moved into `src/lib/led-firmware.ts`, shared with the case study's SpectrumDemo (checked: the case study demo still reaches SPECTRUM). The excerpt is the adaptive baseline, lines 195 to 211, vendored at `a21c77d`. |
| 3 | `c55db3b` | Because of ADAM: a "Try it" inside the browser frame in the client showcase opens a port of LayersBuilder from BcofADAM `f3a96b3`. It keeps the same drawing, switches, wording, stop rules and messages. No photos. |
| 4a | `bb2bc60` | Grace Mae: the bustle explorer inside her showcase row. The drawing is her site's own `bustleDrawing.tsx`, vendored unmodified at `2f74f40` and compiled by `scripts/port-bustle.mjs` into SVG calls (no React). Wording comes from the explorer's Guides and tools defaults. |
| 4c | `fdfca5e` | Landspace: draw a parcel on a made-up grid. Area and perimeter come from Landspace's `geo.js` and `format.js`, vendored unmodified at `c560da2`. A quarter-quarter drawn by keyboard comes out at exactly 40.00 ac. |
| 4d | `da54e92` | Signals: an 8-chip FH-BFSK preview in a grid tile. The chip math moved into `src/lib/fhbfsk.ts`, shared with the full visualizer. It uses the same seed (87) and bits as the demo. Sound plays only on Play. |
| 5 | `80c85f0` | Fix from the screenshot review: when one tile or site card goes live, the others in its row no longer stretch to its height. |

Every live version keeps its picture until Try it is pressed. Each loads its script only when it comes near the screen, works by keyboard (focus moves into the panel, and Close returns it to Try it), and holds still with reduced motion. Nothing plays sound without a press, and mic audio stays on the device.

## What I skipped, and why

- **4b BELLHOP.** BELLHOP's real outputs exist only as exported figures for one source depth, so a source-depth slider over them would fake behavior. The textbook tracer that can move the source already runs as the interactive in the Research section, on the same page, so a second copy in the BELLHOP card would repeat it. The card stays as it was.

## Choices I made without you

- Moved the shared firmware ports into `src/lib/` (`led-firmware.ts`, `fhbfsk.ts`, `highlight.ts`). The demos and the tiles now run the same code.
- LED panel: "Try it" opens the panel, and Power on inside it starts the boot. Play during the boot skips the rest of the scroll. With reduced motion, the scroll shows as one still frame and the track starts paused.
- ADAM and Grace Mae run inside the client's browser frame, in the client's own colors in both themes. The small phone mockup hides while a live version runs, because it would cover the controls. Try it sits bottom left on those frames for the same reason.
- Grace Mae uses the explorer's default wording from `tools.json`. If her Studio has published edits, the live site may word some captions differently.
- Signals wasn't on the home page, so it joined the "More work" grid as the third tile, before ONR. The grid is four across on wide screens again.
- **Phones only:** to stay near 10 screens, I made several cuts.
  - The ONR tile is hidden on phones, since the Research section right after it covers the same work.
  - The spotlight's type and years line is hidden on phones.
  - The spotlight posters are 2:1 on phones.
  - The sound speed chart is narrower on phones.
  - Wider screens are unchanged.
- The LED spotlight has no numeral, because its case study lists no metrics.

## Numbers

**Mobile Lighthouse, home page** (local `astro preview`), four runs, all identical:

| | Score |
| --- | --- |
| Performance | 98 |
| Accessibility | 100 |
| Best practices | 96 |
| SEO | 100 |

Each run had LCP 2.3 s, TBT 0 ms and CLS 0. The last run came after the final CSS fix.

Best practices loses 4 points to a console error from the Cloudflare analytics beacon. On localhost its request is blocked by CORS, which doesn't happen on the real domain.

**Phone page height at 390 px:** 8,557 px, about 10.1 screens, with no horizontal scroll.

| Section | Height |
| --- | --- |
| Top | 988 |
| Now | 432 |
| Featured | 2,049 |
| Research | 1,956 |
| Websites | 916 |
| Field notes | 499 |
| Contact | 924 |
| Footer | 868 |

**Checks:** `npm run verify` and `npm run test:a11y` pass, with 23 pages and 142 scans clean. axe also comes back clean with every live panel open, in both themes, at 1440 and 390.

## How to preview

```
npm run dev
```

Then open http://localhost:4321. Every spotlight and tile with a "Try it" button has a live version.
