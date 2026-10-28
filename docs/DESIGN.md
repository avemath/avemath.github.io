# Design system: Descent

A signal sent down through the ocean. The home page is one transmission: my name goes out at the surface as a real signal, the page is the water, and the footer is the receiver on the seafloor. Thin teal lines, one amber highlight, and monospace instrument labels, so the research side and the design side read as one person. The concept, zone map and every piece are written up in [REDESIGN.md](REDESIGN.md).

Both themes keep a leaf green for living things only: the live-site dots and the contour lines on the About page.

The live reference is `/styleguide/` (not linked or indexed). Toggle the theme to check both palettes.

## Color

Tokens live in `src/styles/global.css` as CSS variables, redefined under `[data-theme='dark']`. Tailwind reads them through `@theme`, so utilities like `text-muted` and `bg-surface` follow the theme.

The full table, the twelve depth shades and the measured contrast for each are in [REDESIGN.md](REDESIGN.md#palette). In short: `--z-top` and `--z-floor` are the two ends of the descent, a `.zone` mixes its shade between them from its `--slot`, and surfaces and lines are derived from whatever `--bg` is in scope. Text tokens are fixed and pass AA on every shade in both themes. Light `--accent` and `--amber-line` are for strokes only; text uses `--accent-ink` and `--amber-ink`.

## Type

- **Space Grotesk** for headings: semibold, tight tracking (`-0.02em` to `-0.045em`).
- **Inter** for body text at 17px with a 1.65 line height.
- **JetBrains Mono** for labels, chips, dates and data. It's uppercase with wide tracking for eyebrows.

All three are variable fonts, self-hosted through Fontsource, with only the Latin subset downloaded. The Latin files are preloaded, and each face has a metric-matched local fallback in `global.css` (`size-adjust` plus ascent and descent overrides against Arial or Courier New), so the swap to the web font does not move the layout.

## Motion

Every animation respects `prefers-reduced-motion` and the site's own "Reduce motion" toggle (footer and command palette), which sets `html[data-motion='reduce']`.

- **Hero spectrogram** (`src/scripts/spectrogram.ts`, signal in `src/lib/tx-signal.ts`): a 2D canvas with no libraries, one pixel per FFT bin and one per frame, scaled by CSS. It loads with a dynamic import after the page is idle, pauses off-screen and in background tabs, shows a still frame under reduced motion and on low-power devices, and only makes sound after a click. Until it loads, a still drawn at build time from the same plan holds its place.
- **Depth gauge and footer lock**: the gauge marker and meter follow scroll with short transitions, and jump per section under reduced motion. The footer frame's preamble sweeps once when it comes into view; under reduced motion it simply reads OK.
- **Scroll reveals**: CSS scroll-driven animations (`animation-timeline: view()`) where supported, with an IntersectionObserver fallback that staggers each visual row left to right. Nothing is hidden unless motion is allowed and the browser can bring it back.
- **Entrances**: CSS only. The headline and lede never start invisible, which keeps Largest Contentful Paint fast.
- **Decode effect** (`src/scripts/decode.ts`): characters resolve out of random glyphs. Used on the hero eyebrow and on the field notes, whose values start masked and decode as they scroll into view; a tap replays one. The label above each value never masks, so the card always says what the fact is about.

### Why no GSAP

The original plan used GSAP for the hero. In practice the only effect that needed it was the eyebrow scramble, and GSAP plus the plugin cost about 80 KB and a second of main-thread time on a throttled phone. A 20-line helper does the same job, so the site ships no animation library.

## Components

| Component | Notes |
|---|---|
| `Header` | Inline nav from 768px. Below that, a native `<details>` Menu with the same links and a search entry, so it works before JavaScript loads |
| `Hero` | name, role and CTAs as HTML, the audience switcher, and the TX spectrogram panel with its readout and Hear it button |
| `DepthGauge` | home only. Fixed scale from 1360px with one link per depth per audience (CSS picks the visible one), signal meter, and a top bar below 1360px |
| `Footer` | the received data frame: preamble, header, payload links, and a CRC computed at build time |
| `SoundSpeed` | textbook sound speed profile in the research panel, no project data |
| `AudienceSwitcher` | radio group. Section order is CSS `:has()`, and JS only syncs the URL (`?for=research`) and the main CTA |
| `ProjectTile` | used in the bento grid and on /work. The whole card is clickable through a stretched link, and the "Live site" link sits above it |
| `BrowserFrame` | static screenshot with a URL bar, plus an optional phone shot. Client sites are never iframed |
| `Timeline` | native `<details>`, so it works by keyboard with no JS. "Expand all" is a progressive extra |
| `CommandPalette` | native `<dialog>` with a combobox and listbox. Ctrl K, Cmd K or `/` opens it, and a visible header button covers touch |
| `FieldNotes` | static cards: a label, a number or short value, and the story behind it. Nothing to click, just the shared scroll reveal |
| `Testimonials` | renders only quotes with `approved: true`, as a `figure` with `blockquote` and `figcaption` |
| `ContactForm` | Web3Forms when a key is set, otherwise mailto. Honeypot, inline validation, live status |
| `ProjectArt` | project signatures: drawn SVG covers in one line style for projects without screenshots. Research art is abstract on purpose. Moves gently only while its tile is hovered or focused |
| `demos/*` | each demo loads only on its own case study page |

## Layout

- Content width is 76rem with a `clamp(1rem, 4vw, 2.5rem)` gutter (16px on phones).
- Designed at 390px first. The bento stacks to one column, the timeline is already an accordion, the spectrogram sits under the hero text, and the depth gauge becomes a thin bar across the top.
- Section rhythm comes from `.section` padding (`clamp(3rem, 7vw, 6rem)`). On the home page the sections are depth bands, so a change of shade replaces the divider line.
