# Design system: the bench

A communications engineer's test report. The home page is the surface: navy hero and footer, white paper for the body, one muted buoy orange, wide Archivo headings, and figures that read like instrument readouts and timing diagrams. Only /research/ goes underwater. The concept, what changed and what was removed are in [REDESIGN.md](REDESIGN.md#redesign-3-bench-on-the-surface-water-below).

The live reference is `/styleguide/` (not linked or indexed). Toggle the theme to check both palettes.

## Color

Tokens live in `src/styles/tokens.css`, light first and dark under `[data-theme='dark']`. Tailwind reads them through `@theme` in `global.css`, so utilities like `text-muted` and `bg-surface` follow the theme.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--navy` | `#0b1f3a` | same | hero, nav, footer, research ground |
| `--navy-deep`, `--navy-deeper` | `#071527`, `#040c18` | same | gradients that darken downward |
| `--bg`, `--surface` | `#ffffff` | `#071527`, `#0e2340` | page and paper cards |
| `--ground-alt` | `#eef1f5` with a dot grid | `#0a1a30` | alternate sections (`.ground-alt`) |
| `--text` | `#0b1f3a` | `#f4f6fa` | ink |
| `--muted` | `#5b6778` | `#a9b6cc` | labels, meta |
| `--line` | `#cbd3df` | `#2a3f5e` | 1px borders |
| `--accent` | `#de6a41` | same | fills and strokes only: primary buttons, the marquee, active traces, callouts |
| `--accent-ink` | `#b4502a` | `#ef8d66` | text in the accent color (passes 4.5:1) |

On navy (`.on-navy`) the inks are `#f4f6fa`, `#a9b6cc` and lines at 22% white, in both themes. White on the accent is 3.4:1, so white text on it is always 19px bold (large text): the primary button and the marquee. A small primary button turns into a solid ink button instead.

## Type

One family, Archivo (variable weight and width), self-hosted from Fontsource, Latin only. Headings: weight 800, `'wdth' 112`, letter-spacing -0.03em, line-height 0.94. Body 17px/1.5. IBM Plex Mono for code (14px), readouts and depth labels. Both are preloaded, and each has a fallback face sized to its metrics (`src/styles/fonts.css`, measured with `scripts/measure-fallback.mjs`), so the swap does not move the layout. No pixel or dot-matrix fonts.

## Shape

Square corners on cards and buttons. Buttons: 2px border, 50px tall, weight 700. Paper cards: 1px border and a soft shadow. Numbered callouts are the only round things.

## Motion

Everything respects `prefers-reduced-motion` and the site's own "Reduce motion" toggle (`html[data-motion='reduce']`).

- **Decode headings** (`src/scripts/decode-headings.ts`): headings with `data-decode` resolve out of random glyphs once, in 400 ms, as they come into view. The real text stays in the DOM; a layer hidden from screen readers draws the glyphs.
- **Plotter draw-in** (`initDrawIn` in `src/scripts/motion.ts`): `[data-draw]` plots sweep in left to right over a second the first time they are on screen. Plots already on screen at load are never hidden.
- **Signal panel**: still unless the mouse moves. Touch screens get one slow drift in. Sound only on a press.
- **Marquee**: slow, decorative, `aria-hidden`, still with reduced motion.
- **Scroll reveals**: CSS scroll-driven animations with an IntersectionObserver fallback.

No animation library (see below).

### Why no GSAP

The original plan used GSAP for the hero. In practice the only effect that needed it was a text scramble, and GSAP plus the plugin cost about 80 KB and a second of main-thread time on a throttled phone. A 20-line helper does the same job, so the site ships no animation library.

## Components

| Component | Notes |
|---|---|
| `Header` | navy on every page. Name, five links, a small label at the right (`surface` on home, the live depth on /research/), search and theme. A native `<details>` menu below 860px |
| `Hero` | the headline as HTML, and the signal panel |
| `SignalPanel` | the preamble on a scope (`src/scripts/signal-panel.ts`, signal in `src/lib/preamble.ts`); `empty` for the 404 page |
| `MarginNote` | one field note beside the figure it is about, tap to decode |
| `HomeSkills` | Fig. 06, the skills matrix: a real table, every dot a link to a file |
| `fig/FigureCard` | a project spotlight: a 7/5 paper card with a figure label row and Live, How it works and Code tabs. The code views widen to the full card |
| `fig/TimingFig`, `ChainFig`, `MatrixFig` | the three live figures, each run by the project's real code in `src/lib` |
| `fig/CodeHow`, `fig/CodeFile` | code panels cut at build time from the real files (`src/lib/excerpt.ts`), with real line numbers |
| `Marquee`, `StatusStrip`, `BelowSurface`, `HomeSkills` | home page sections |
| `WebsitesShowcase` | the client sites two by two, only those with `client.permission` |
| `DepthGauge` | /research/ only |
| `Footer` | "Say hi." and the links; the research variant has "Back to the surface" |
| `ProjectTile`, `ProjectArt` | /work/ and services |
| `CommandPalette` | native `<dialog>`; Ctrl K, Cmd K or `/` |
| `demos/*` | each demo loads only on its own case study |

## Layout

Content width 76rem with a `clamp(1rem, 4vw, 2.5rem)` gutter (16px on phones). Designed at 390px first: the hero headline wraps cleanly and the signal panel stacks under it, figure cards stack figure over words, and code panels scroll sideways instead of wrapping below 60 characters.
