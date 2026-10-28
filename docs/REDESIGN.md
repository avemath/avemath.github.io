# Redesign: a signal sent down through the ocean

Work in progress on the `redesign` branch. GitHub Pages only deploys `main`, so nothing here is live until it is merged.

## The concept

The home page is one transmission. My name goes out at the surface as a real signal, the page is the water it travels through, and the footer is the receiver on the seafloor that decodes it. Water and signals are the through-line of everything I do: underwater acoustics research, radios and spectrum analyzers, an acoustic pool alarm, and a family nonprofit about drowning. The design should say that before anyone reads a word, then get out of the way.

Rules for the concept:

- Every piece is real or honestly labeled. The spectrogram is computed from a synthesized signal, the CRC is computed from the footer text, and the sound speed curve is textbook physics with no project data.
- Less is better. The pieces below, nothing else.
- Content is unchanged. Only section labels and small UI text are new.

## Zone map

Each home page section is an ocean depth zone. The background steps one clear shade darker per section: solid bands, each rising over the one above with a soft wave edge, not one long gradient wash.

The "I'm here to..." switcher reorders the sections with CSS, so depth belongs to the **position** on the page, not to a section. Whatever sits third is always at 200 m. The table lives in `src/lib/depth.ts`, and everything about depth is generated from it: the band shade, the light or dark inks, the depth in each section's label, where the marine snow falls, and the depth gauge. The gauge and the labels cannot disagree.

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

Twelve band shades per theme, one per slot, as `--band-0` to `--band-11` in `global.css`. A zone redefines its surfaces and lines from its own shade, so cards always sit one step lighter than the water around them.

| Slot | Light | Dark |
|---|---|---|
| 0 | `#e4f8fd` | `#0f4955` |
| 1 | `#d9f0f7` | `#0a424f` |
| 2 | `#cee8f1` | `#083a48` |
| 3 | `#c4e0ec` | `#083442` |
| 4 | `#bad8e6` | `#062f3d` |
| 5 | `#b1d0e0` | `#062938` |
| 6 | `#1d4357` | `#062432` |
| 7 | `#18384a` | `#06202d` |
| 8 | `#142e3f` | `#061c29` |
| 9 | `#102534` | `#061824` |
| 10 | `#0b1c2a` | `#061420` |
| 11 | `#07141f` | `#05111c` |

The light theme starts at a bright pale surface and stays light through the twilight zone, then drops into dark water at the sound channel (slot 6), the way sunlight is gone by about 1,000 m. Mid-tone bands are skipped on purpose: neither dark nor light text reads well on them. From slot 6 down, zones set `--deep: 1` and switch to the light-on-dark inks. The dark theme starts at a clearly lighter teal and steps down to near-black navy.

| Ink | On light water | On dark water | Use |
|---|---|---|---|
| `--text` | `#0b1d29` | `#e4f0f5` | headings, body |
| `--text-soft` | `#223b49` | `#c3d6df` | long-form body |
| `--muted` | `#334d5a` | `#adc6d2` | labels, meta |
| `--accent` | `#1d6a86` | `#7ccbe6` | lines, focus, active states |
| `--accent-ink` | `#0f5168` | `#93d5ec` | teal text |
| `--amber` | `#f0a940` | `#f0a940` | primary buttons, lock state |
| `--amber-line` | `#b8700a` | `#f0a940` | amber strokes |
| `--amber-ink` | `#6f4200` | `#f5c27a` | amber text |

Every text ink passes AA (4.5:1) on every band, and on the cards and wells drawn on it, in both themes. The worst cases are about 4.6:1, for muted text on the wells of the first dark band. axe scans the home page in all three audience orders, so every section is checked on every band it can land on. Light `--accent` and `--amber-line` are for strokes only.

## Type

Unchanged faces, all self-hosted and preloaded: Space Grotesk for headings, Inter for body, JetBrains Mono for every readout, depth label, zone name, field name in the footer frame and axis tick. Mono labels are uppercase with wide tracking, like an instrument face.

## The pieces

### 1. Surface hero: the transmission

A waterfall spectrogram that receives my name once.

- **The signal is real.** The browser draws AVERY / MATHERNE into a small raster in the heading font, 228 pixels wide. Each raster row becomes one OFDM symbol: a 512 point inverse FFT at 16 kHz, with one subcarrier per raster column, so the letters are drawn by 228 subcarriers from about 440 Hz to 7.6 kHz. Each subcarrier's amplitude is that pixel's coverage, so anti-aliased edges come out smooth. Every symbol carries a 6 ms cyclic prefix, and neighboring symbols crossfade inside it with a raised cosine, so nothing starts or stops instantly and there are no clicks. One linear up-chirp goes out first as the sync sweep.
- **The water is the channel.** The signal passes through a gentle frequency-selective fade, as two paths would make, with a little level jitter per subcarrier and some noise. So the letters show real measured texture, while staying within a few dB of full level and clearly readable.
- **The display is computed.** The receiver runs a 512 point FFT over each symbol's body, skipping the prefix, just as an OFDM receiver does. So every subcarrier reads its own level with no leakage from its neighbors. One row per symbol, newest at the top, about 6 seconds on screen.
- **One copy, then a pause.** Each cycle starts on quiet water, sends the sweep and the name, holds for about 4 seconds with the full name centered, fades, and starts again.
- **Instrument look.** A perceptual colormap mixed in OKLab, from deep navy through teal to amber. A faint grid at every kilohertz and every second. Frequency runs along the bottom (0 to 8 kHz) and time down the left (0 to 6 s ago). The screen is navy in both themes.
- **Cursor readout.** Frequency, level (dBFS) and time under the pointer. The screen is focusable, and arrow keys move the same cursor.
- **Hear it.** Plays one transmission per cycle at low volume, only after a click. The display restarts with it so the sound and the picture arrive together, and the same button stops it.
- **Name, role, "See my work" and "Résumé" stay HTML** and fit in the first screen at 390px.
- **Lazy.** The signal code loads with a dynamic import after the page is idle. Until then, and without JavaScript, a still drawn at build time shows the name where the live display holds it.
- **Reduced motion and low power:** the held frame, with the full name centered. Hear it still works.
- **Light rays.** Soft rays fan down from the surface in the hero and the Now strip, fading with depth and swaying slowly.

### 2. The descent

Solid bands per slot (tables above), each rising over the band above with a soft wave edge. Each band overlaps the one above it, and a mask cuts the overlap into a wave, so the shade above shows in the troughs. The wave's phase shifts per slot, so no two edges match.

**Marine snow:** faint specks drift down through the two deepest section bands (slots 9 and 10).

Both effects are CSS only. They animate only `transform`, run only while their band is on screen, and stop completely under reduced motion. Without JavaScript they stay still.

### 3. Depth gauge and signal meter

- **One label per section.** The depth leads each section's eyebrow: "200 m · Featured work". Zone names (Twilight, Midnight) appear only in the gauge.
- **Desktop (1440px and up):** a gauge on the water itself, with no panel, 16px from the edge and 40px clear of the content column at 1440px. It shows the current depth large, then the zone name, then the section name. Each part of it (each readout line, every mark, the meter) takes the ink of the band directly under it. Band edges count from below the wave crest, so the gauge stays legible while it crosses from light water to dark. Twelve marks are labeled in meters, and each is a link to the section at that depth: one link per audience mode, with the others set to `display: none`, so it works without JavaScript.
- **One source of truth.** The current section is whichever band crosses 40% of the viewport. The gauge shows exactly that slot's depth, zone and name from `depth.ts`, which is the same slot the section's own label comes from. The marker still glides between marks with motion.
- **Signal meter:** five bars that drop as you go deeper. They lock (all amber, LOCK) when the footer frame is in view.
- **Narrower screens:** a 3px progress bar fixed at the very top, teal, turning amber on lock.
- **Reduced motion:** the marker, bar and meter jump per section.

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

The research section has an open layout with no card. The sound speed profile sits beside the text at full column width: depth from 0 to 4,000 m down the side, speed from about 1,490 to 1,550 m/s across. It is a Munk-style canonical profile with its minimum at 1,000 m, labeled "channel axis". The caption says it is textbook physics and not project data. Related work and the confidentiality note run underneath.

### 7. Variety

- **Header:** solid, in the surface shade, so page text never shows through.
- **Field notes:** tiles that glow softly like bioluminescence, with a slow breathing glow (opacity only, out of step tile to tile, only while on screen). Tap to decode works exactly as before.
- **Research:** open, as above. The packet footer is unchanged apart from its depth label.

## Deliberately not borrowed

Nicholas's site (`/nmdomke/`) was checked only to stay clear of it. Not used here:

- the Doto dot-matrix font
- the drafting-table dot grid (the old grid-paper texture on this site is removed too; the only grid left is the faint plot grid inside the spectrogram, which is part of the instrument)
- alternating light, grey, black and blue panes; this page only ever gets darker
- the engineering title-block footer; mine is a data frame, not a drawing sheet
- the scroll gear, the CAD crosshair cursor, blueprint blue sections and the exploded 3D model

One overlap remains: both sites use Space Grotesk for headings. See open questions.

## Phase 1 scope

Tokens, hero, descent, gauge and meter, packet footer, project signatures, sound speed curve, the home page, and the V2V case study.

## Phase 2: the other pages

Every page shares the tokens, the solid header and the packet footer, which sits on the seafloor band (slot 11) everywhere. Each page's sections are zones in `<main class="descent">`, and each zone after the first rises over the one before with the same wave edge. Depth labels in the eyebrows stay on the home page only; elsewhere the bands carry the descent quietly.

| Page | Bands |
|---|---|
| /work/ | 0 (header and filters, with light rays), 1 (the grid) |
| /about/ | 0 (with light rays), Now strip at 1, then 2, 3, 4 |
| /services/ | 0 (with light rays) through 4, one per section, grid paper removed |
| /resume/ | one band at 1, around the paper card |
| /contact/ | one band at 2 |
| 404 | one band at 3 |
| case studies | three bands one step apart: header and media, then demo and write-up, then gallery, pager and contact |

Case studies start where their kind of work lives (`caseStart` in `depth.ts`): client sites and the nonprofit at 0, software at 1, engineering at 2, research at 3. The deepest case study band is slot 5, so long write-ups stay on light water in the light theme and the content leads.

**Print:** zones restate the paper colors under `@media print`, so the résumé PDF prints exactly as it did on `main` (checked pixel for pixel against a build of `main`).

## Open questions

- Space Grotesk is shared with Nicholas's site. Swapping the display face would make the two sites more distinct, but it means new fallback metrics and a font download change.
- Later, not now: a sonar ping button on the gauge, bioluminescent specks near the cursor in the deep zones, case studies starting at their section's depth color.
