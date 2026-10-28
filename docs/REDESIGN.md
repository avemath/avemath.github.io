# Redesign: a signal sent down through the ocean

Work in progress on the `redesign` branch. GitHub Pages only deploys `main`, so nothing here is live until it is merged.

## The concept

The home page is one transmission. My name goes out at the surface as a real signal, the page is the water it travels through, and the footer is the receiver on the seafloor that decodes it. Water and signals are the through-line of everything I do: underwater acoustics research, radios and spectrum analyzers, an acoustic pool alarm, and a family nonprofit about drowning. The design should say that before anyone reads a word, then get out of the way.

Rules for the concept:

- Every piece is real or honestly labeled. The spectrogram is computed from a synthesized signal, the CRC is computed from the footer text, and the sound speed curve is textbook physics with no project data.
- Less is better. Six pieces (below), nothing else.
- Content is unchanged. Only section labels and small UI text are new.

## Zone map

Each home page section is an ocean depth zone. The background steps one shade darker per section: solid bands with a short soft edge from the shade above, not one long gradient wash.

The "I'm here to..." switcher reorders the sections with CSS, so depth belongs to the **position** on the page, not to a section. Whatever sits third is always at 200 m. The table lives in `src/lib/depth.ts`, and both the band colors and the depth gauge are generated from it, so they cannot drift apart.

| Slot | Depth | Zone | Hire (default) | Research | Website |
|---|---|---|---|---|---|
| 0 | 0 m | Surface | hero | hero | hero |
| 1 | 50 m | Sunlight zone | Now strip | Now strip | Now strip |
| 2 | 200 m | Twilight zone | Featured work | Research | Websites |
| 3 | 400 m | Twilight zone | Experience | Featured work | Services |
| 4 | 600 m | Twilight zone | Skills | Recommendations | Featured work |
| 5 | 800 m | Twilight zone | Recommendations | Experience | Field notes |
| 6 | 1,000 m | Sound channel | Research | Skills | Recommendations |
| 7 | 1,500 m | Midnight zone | Websites | Field notes | Experience |
| 8 | 2,000 m | Midnight zone | Field notes | Websites | Skills |
| 9 | 3,000 m | Midnight zone | Services | Services | Research |
| 10 | 4,000 m | Abyss | Contact | Contact | Contact |
| 11 | 4,500 m | Seafloor | Footer | Footer | Footer |

In the default order the research section lands on the sound channel axis at 1,000 m, which is where its sound speed curve puts the minimum.

## Palette

Two endpoints per theme. Band shades are mixed between them in OKLab (`color-mix`), one step per slot. Surfaces, lines and wells are derived from each band's own shade, so cards always sit one step lighter than the water around them.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--z-top` | `#dff1f3` | `#0e3a51` | surface shade (slot 0) |
| `--z-floor` | `#adcfdb` | `#03101c` | seafloor shade (slot 11) |
| `--text` | `#0b1d29` | `#e4f0f5` | headings, body |
| `--text-soft` | `#223b49` | `#bfd4de` | long-form body |
| `--muted` | `#334d5a` | `#9fb9c6` | labels, meta, zone names |
| `--accent` | `#1d6a86` (sonar teal) | `#56b6d8` | lines, focus, active states |
| `--accent-ink` | `#0f5168` | `#8fd3ea` | teal text |
| `--amber` | `#f0a940` | `#f0a940` | primary buttons, lock state |
| `--amber-line` | `#b8700a` | `#f0a940` | amber strokes in art and readouts |
| `--amber-ink` | `#6f4200` | `#f5c27a` | amber text |
| `--leaf` | `#4a7c59` | `#8fd19e` | live-site dots and About contours only |

Measured contrast, worst case over all twelve shades and the cards on them (WCAG AA needs 4.5 for text):

| Pair | Light (worst) | Dark (worst) |
|---|---|---|
| text | 10.4 | 9.2 |
| text-soft | 7.1 | 7.0 |
| muted | 5.4 | 5.2 |
| accent-ink | 5.3 | 6.5 |
| accent as text | not used | 4.6 |
| amber-ink | 5.2 | 6.6 |
| button text on amber | 9.2 | 9.2 |

Light `--accent` (3.7 on the floor) and `--amber-line` are for strokes only, never text.

## Type

Unchanged faces, all self-hosted and preloaded: Space Grotesk for headings, Inter for body, JetBrains Mono for every readout, depth label, zone name, field name in the footer frame and axis tick. Mono labels are uppercase with wide tracking, like an instrument face.

## The pieces

### 1. Surface hero: the transmission

A waterfall spectrogram where AVERY MATHERNE scrolls down through the frequency display.

- **The signal is real.** Each row of a 5 by 7 bitmap font is one OFDM symbol: 512 point inverse FFT, 16 kHz sample rate, each lit column of the letter is three subcarriers switched on, every subcarrier keeps its phase so the tones are continuous. A short up-chirp goes out before the name as a preamble, over a low noise floor.
- **The display is computed.** A 512 point FFT with a Hann window runs over that signal as it plays, one row per 32 ms frame, newest at the top. Nothing is drawn from the font directly. The canvas is 256 by 160 internal pixels (one per bin, one per frame) and the browser scales it.
- **Cursor readout.** Frequency and level (dBFS) under the pointer. The panel is focusable, and arrow keys move the same cursor.
- **Hear it.** Plays the same buffer through Web Audio at low volume, looped, only after a click, with a Stop state on the same button. The display follows the audio clock while it plays.
- **Name, role, "See my work" and "Résumé" stay HTML**, left of the panel on desktop and above it on phones, so a recruiter gets all four in the first screen.
- **Lazy.** The signal code loads with a dynamic import after the page is idle. Until then, and without JavaScript, the panel shows a still drawn at build time from the same font table.
- **Reduced motion and low power:** one still frame with the name centered. Hear it still works, since sound you start yourself is not motion.
- The hero band is the light surface, with a soft wave edge into the Now strip.

### 2. The descent

Solid bands per slot (table above). Each band starts with a 4rem blend from the shade above, so the edges are soft without one big wash. A small mono zone tag sits at the top of each band ("200 M · TWILIGHT ZONE"). It is decorative and hidden from screen readers; the depth gauge carries the same information as links.

### 3. Depth gauge and signal meter

- **Desktop (1360px and up):** a slim vertical gauge fixed on the left. Twelve marks, evenly spaced and labeled in meters. Each mark is a link to the section at that depth (one link per audience mode, the others are `display: none`, so it works without JavaScript). A marker slides to the current depth, and the current depth and zone name show beside it.
- **Signal meter:** five bars under the gauge. Strength drops one bar every few slots as you go deeper. When the footer frame is in view, the meter locks: all bars amber, label LOCK.
- **Narrower screens:** a 3px progress bar fixed at the very top, teal, turning amber on lock.
- **Reduced motion:** the marker, bar and meter jump to each section's value with no transitions.

### 4. Seafloor packet footer: the reception

The footer is drawn as a received data frame with four fields, each with a mono field name:

- **PREAMBLE:** a sync pattern of alternating bits, drawn as a short square wave.
- **HEADER:** my name and Baton Rouge, LA.
- **PAYLOAD:** email, GitHub, LinkedIn and the résumé PDF, as real links.
- **CRC:** a real CRC-16/CCITT of the header and payload text, computed at build time, with the status OK.

With JavaScript and motion allowed, the CRC status reads WAIT until the frame scrolls into view, then the preamble sweeps once and the status changes to OK as the meter locks. Screen readers always get "CRC OK". Reduced motion and no-JS show OK from the start. The footer's existing site links, reduce motion toggle and small print are unchanged.

### 5. Project signatures

Every `ProjectArt` cover is redrawn in one shared line style: plain well background, a single 1.5px stroke weight in teal with one amber element, round caps, mono labels top left. No grids, no glows, no fills beyond small dots.

| Project | Signature |
|---|---|
| V2V BSM over OFDM | BPSK constellation with the 52 subcarrier strip under it |
| LED audio spectrum | spectrum bars with amber peak caps |
| BELLHOP simulator | ray paths bending around the channel axis |
| Signals playground | a frequency hop pattern on a time by channel grid |
| Acoustic pool alarm | ripples on a still surface |
| ONR research | nodes and thin links, abstract on purpose |
| Integer internship | arcs from one source over a seabed line, abstract on purpose |
| RAMpage | top-down outline of the chassis and its parts |
| LandSpace, client sites, nonprofit | a plain browser window outline (only used where no screenshot exists) |
| Swim intake, abstract builder | form, sheet, document, as before but in the shared style |

Gentle animation on hover or keyboard focus of the tile only (clusters tighten, bars move, dashes travel, ripples widen). None under reduced motion.

### 6. Sound speed curve

In the research section's side panel, a small sound speed profile: depth from 0 to 4,000 m down the side, speed from about 1,490 to 1,550 m/s across. It is a Munk-style canonical profile with its minimum at 1,000 m, labeled "channel axis". The caption says it is textbook physics and not project data. It replaces the duplicate ONR art in that panel (the ONR tile in the bento still shows it).

## Deliberately not borrowed

Nicholas's site (`/nmdomke/`) was checked only to stay clear of it. Not used here:

- the Doto dot-matrix font
- the drafting-table dot grid (the old grid-paper texture on this site is removed too, so there is no dot or grid paper anywhere)
- alternating light, grey, black and blue panes; this page only ever gets darker
- the engineering title-block footer; mine is a data frame, not a drawing sheet
- the scroll gear, the CAD crosshair cursor, blueprint blue sections and the exploded 3D model

One overlap remains: both sites use Space Grotesk for headings. See open questions.

## Phase 1 scope

Tokens, hero, descent, gauge and meter, packet footer, project signatures, sound speed curve, the home page, and the V2V case study. The other pages pick up the new tokens automatically and get their own pass in phase 2.

## Open questions

- Dark theme starts at a dark teal surface (`#0e3a51`), not the pale `#dff1f3`, so dark mode stays dark from the top. The pale surface is the light theme's hero.
- Space Grotesk is shared with Nicholas's site. Swapping the display face would make the two sites more distinct, but it means new fallback metrics and a font download change.
- Later, not now: a sonar ping button on the gauge, bioluminescent specks near the cursor in the deep zones, case studies starting at their section's depth color.
