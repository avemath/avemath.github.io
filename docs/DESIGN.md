# Design system: Specimen

A field notebook of engraved plates: paper by day, a glowing night bench after dark. Figures sit in plate frames (a double hairline) with "Fig. N." captions in Bodoni italic, and every plate is drawn from Ave's own data. The approved mockups are `docs/mockups/specimen-study.html` and `docs/mockups/specimen-choices.html`; what changed is in [REDESIGN.md](REDESIGN.md#specimen).

The live reference is `/styleguide/` (not linked or indexed). Toggle the theme to check both palettes.

## Color

Tokens live in `src/styles/tokens.css`, light first and dark under `[data-theme='dark']`. The palette is the whole system; the older role names (`--bg`, `--text`, `--line`, `--accent` and so on) point at it, so every component follows. Tailwind reads them through `@theme` in `global.css`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#eef2ec` | `#0c1512` | page ground (`--bg`) |
| `--sheet` | `#f8faf6` | `#13201b` | plates, sheet sections (`--surface`) |
| `--ink` | `#1c2823` | `#e6efea` | text (`--text`): 13.5:1 and 15.8:1 on paper |
| `--muted` | `#586660` | `#9db0a6` | labels, meta: 5.3:1 (5.7:1 on sheet) and 8.1:1 (7.4:1 on sheet) |
| `--rule` | `#cbd6ce` | `#2a3b34` | hairlines (`--line`), decoration only |
| `--line-strong` | `#7e8c84` | `#5f7369` | borders that mark a control, 3.1:1 and 3.3:1 |
| `--green` (`--accent`) | `#2e7d5b` | `#7fd6a8` | the accent: fills, strokes, large type; 4.4:1 light, so not for small text |
| `--green-strong` (`--accent-ink`, `--accent-strong`, `--focus`) | `#1f5e44` | `#7fd6a8` | links, small accent text, focus rings: 6.8:1 on paper, 7.3:1 on sheet; paper text on it is 6.8:1 |
| `--deep`, `--deep-ink`, `--deep-muted`, `--deep-accent` | `#0e2a22`, `#e6efea`, `#9db0a6`, `#7fd6a8` | same | the deep band (footer, marquee, Research teaser): 13.0:1, 6.7:1, 8.8:1 |
| `--teal`, `--lilac`, `--rose`, `--gold`, `--sage` and their `*-ink` | as before | as before | only the eigenray plate, data figures and the handwritten notes; `*-ink` is 4.9:1 or better on light paper |
| `--photo` | `#fbfaf7` | `#f2efea` | print borders |
| `--screen` and `--screen-*` | `#0f1a16` | `#08100d` | the oscilloscope, the LED matrix, the spectrogram: dark in both themes |
| `--bit` | `#1e8a5a` | `#5cf2a6` (with glow) | the bit girl |

Green is the accent for links, buttons, headings and focus; purple is no longer a UI accent. Prints and handwritten notes stay light in both themes (`--photo-ink`, `--note-*`). Outside CSS, `src/lib/theme.ts` (the two theme-color tags), `src/lib/tokens-client.ts` (canvases) and `scripts/render-assets.mjs` (favicon, social cards) read the tokens, so `npm run assets` follows any change.

### Surfaces

Sections alternate paper, sheet and the deep band (`.band-paper`, `.band-sheet`, `.band-deep` in `global.css`) so no two neighbors share a background; the footer is always deep. `.band-deep` re-points the role tokens, so anything inside reads light on deep green. Plates on sheet sections get `--plate-shadow`. The home hero has a faint contour texture (`.topo`, `public/topo.svg` from `scripts/gen-topo.mjs`, about 6%), and the Research teaser draws the same lines glowing over a still of the seafloor.

## Type

- **Bodoni Moda** (display): headings at weight 400 (h3 and h4 at 500), italic for accents (`h1 em` is green), plate numbers and "Fig. N." captions.
- **Hanken Grotesk** (body): 17px/1.5.
- **JetBrains Mono** (data, pin names, labels, code).
- **Kalam** (handwritten notes and captions only).

All are self-hosted from Fontsource, Latin only, `font-display: swap`. Bodoni Moda roman and italic (the hero name) are preloaded. Each family has a fallback face sized to its metrics (`src/styles/fonts.css`, measured with `scripts/measure-fallback.mjs` against Georgia, Arial and Courier New; Hanken Grotesk also has Roboto and DejaVu Sans faces for systems without Arial), so the swap does not move the layout.

## Shape

Square corners on cards and buttons. Buttons: 2px border, 50px tall, weight 700. Paper cards: 1px border and a soft shadow. Numbered callouts are the only round things.

## Motion

Everything respects `prefers-reduced-motion` and the site's own "Reduce motion" toggle (`html[data-motion='reduce']`).

- **Decode headings** (`src/scripts/decode-headings.ts`): headings with `data-decode` resolve out of random glyphs once, in about 900 ms, letter by letter from the left (each settles about 25 ms after the one before), as they come into view. The real text stays in the DOM; a layer hidden from screen readers draws the glyphs.
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
| `WorkCard` | a project on /work/: figure label, picture, title, what it offers (Live, Drawing, Code), one line |
| `drawings/*` | schematic line drawings, one per project, in one style (see REDESIGN.md, Redesign 3c) |
| `MarginNote` | one field note beside the figure it is about, tap to decode |
| `Toolbox` | Home page tools in two rows (Know well, Have built with); each chip links to a project, and the panel names the real file (`toolbox` in `src/lib/skills.ts`) |
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
