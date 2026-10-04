# Design system: Signal

Naval acoustics meets interface craft. A deep-ocean UI with sonar motifs, thin lines and crisp engineering labels, so the research side and the design side read as one person. The bento grid comes from a "blueprint" direction, and the About page borrows topographic contour lines as a nod to land work.

The live reference is `/styleguide/` (not linked or indexed). Toggle the theme to check both palettes.

## Color

Tokens live in `src/styles/global.css` as CSS variables, redefined under `[data-theme='dark']`. Tailwind reads them through `@theme`, so utilities like `text-muted` and `bg-surface` follow the theme.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#f6f8fb` | `#0b1220` (abyss navy) | page |
| `--surface` | `#ffffff` | `#111a2e` | cards |
| `--surface-2` | `#eef2f8` | `#17223a` | wells, frames |
| `--text` | `#0b1220` | `#e6edf7` | headings, body |
| `--text-soft` | `#34425c` | `#c3cfe2` | long-form body |
| `--muted` | `#4f5e79` | `#8a9bb8` | labels, meta |
| `--accent` | `#0077a8` | `#3ddcff` (sonar cyan) | lines, focus, active states |
| `--accent-ink` | `#005f87` | `#7fe8ff` | accent-colored text |
| `--amber` | `#ffb547` | `#ffb547` (signal amber) | primary buttons only |

### Measured contrast (WCAG AA needs 4.5:1 for body text)

| Pair | Light | Dark |
|---|---|---|
| text on bg | 17.6 | 15.9 |
| text-soft on bg | 9.5 | 11.9 |
| muted on bg | 6.2 | 6.7 |
| muted on surface-2 | 5.8 | 5.6 |
| accent-ink on bg | 6.6 | 13.3 |
| accent on bg | 4.7 | 11.5 |
| button text on amber | 10.6 | 10.6 |

The one pair under 4.5 is light-theme `--accent` on `--surface-2` (4.45). It's only used for icons and decoration, never text.

## Type

- **Space Grotesk** for headings: semibold, tight tracking (`-0.02em` to `-0.045em`).
- **Inter** for body text at 17px with a 1.65 line height.
- **JetBrains Mono** for labels, chips, dates and data. It's uppercase with wide tracking for eyebrows.

All three are variable fonts, self-hosted through Fontsource, with only the Latin subset downloaded. The Latin files are preloaded, and each face has a metric-matched local fallback in `global.css` (`size-adjust` plus ascent and descent overrides against Arial or Courier New), so the swap to the web font does not move the layout.

## Motion

Every animation respects `prefers-reduced-motion` and the site's own "Reduce motion" toggle (footer and command palette), which sets `html[data-motion='reduce']`.

- **Hero scope** (`src/scripts/sonar-canvas.ts`): a 2D canvas with no libraries. The rings and ticks are drawn once to an offscreen layer, and the sweep is a single conic gradient. It's capped at 30 fps, mounts after the page is idle, pauses off-screen and in background tabs, shows a still frame under reduced motion, and skips animation on low-power devices.
- **Scroll reveals**: CSS scroll-driven animations (`animation-timeline: view()`) where supported, with an IntersectionObserver fallback that staggers each visual row left to right. Nothing is hidden unless motion is allowed and the browser can bring it back.
- **Entrances**: CSS only. The headline and lede never start invisible, which keeps Largest Contentful Paint fast.
- **Decode effect** (`src/scripts/decode.ts`): characters resolve out of random glyphs. Used on the hero eyebrow and the field note cards.

### Why no GSAP

The original plan used GSAP for the hero. In practice the only effect that needed it was the eyebrow scramble, and GSAP plus the plugin cost about 80 KB and a second of main-thread time on a throttled phone. A 20-line helper does the same job, so the site ships no animation library.

## Components

| Component | Notes |
|---|---|
| `Header` | Inline nav from 768px. Below that, a native `<details>` Menu with the same links and a search entry, so it works before JavaScript loads |
| `Hero` | canvas, CTAs, audience switcher |
| `AudienceSwitcher` | radio group. Section order is CSS `:has()`, and JS only syncs the URL (`?for=research`) and the main CTA |
| `ProjectTile` | used in the bento grid and on /work. The whole card is clickable through a stretched link, and the "Live site" link sits above it |
| `BrowserFrame` | static screenshot with a URL bar, plus an optional phone shot. Client sites are never iframed |
| `Timeline` | native `<details>`, so it works by keyboard with no JS. "Expand all" is a progressive extra |
| `CommandPalette` | native `<dialog>` with a combobox and listbox. Ctrl K, Cmd K or `/` opens it, and a visible header button covers touch |
| `FieldNotes` | each card decodes once as it scrolls into view, and a tap replays it. With no JS or reduced motion every fact is simply visible |
| `Testimonials` | renders only quotes with `approved: true`, as a `figure` with `blockquote` and `figcaption` |
| `ContactForm` | Web3Forms when a key is set, otherwise mailto. Honeypot, inline validation, live status |
| `ProjectArt` | drawn SVG covers for projects without screenshots. Research art is abstract on purpose. Pattern ids get a per-instance suffix so the same art can appear twice on a page |
| `demos/*` | each demo loads only on its own case study page |

## Layout

- Content width is 76rem with a `clamp(1rem, 4vw, 2.5rem)` gutter (16px on phones).
- Designed at 390px first. The bento stacks to one column, the timeline is already an accordion, and the hero scope moves behind the heading.
- Section rhythm comes from `.section` padding (`clamp(4rem, 9vw, 7.5rem)`), with 1px dividers between sections.
