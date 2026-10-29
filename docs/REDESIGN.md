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

The home page has eight slots. Each slot names one of the twelve band shades, so the water still steps clearly darker and drops into dark water at the sound channel.

| Slot | Depth | Zone | Band | Hire (default) | Research | Website |
|---|---|---|---|---|---|---|
| 0 | 0 m | Surface | 0 | hero | hero | hero |
| 1 | 50 m | Sunlight zone | 1 | Now strip | Now strip | Now strip |
| 2 | 200 m | Twilight zone | 3 | Featured work | Research | Client work |
| 3 | 1,000 m | Sound channel | 6 | Research | Featured work | Featured work |
| 4 | 2,000 m | Midnight zone | 8 | Client work | Field notes | Field notes |
| 5 | 3,000 m | Midnight zone | 9 | Field notes | Client work | Research |
| 6 | 4,000 m | Abyss | 10 | Contact | Contact | Contact |
| 7 | 4,500 m | Seafloor | 11 | Footer | Footer | Footer |

The section order for each audience is generated from the same table (`zoneStyles` in `depth.ts`), so the order, the depths and the gauge cannot drift apart. Experience, Skills and Recommendations live on /about/; the home page links to them from Featured work.

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

A waterfall spectrogram that receives my name once. (Band and display updated in the third pass, below.)

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

### 8. Home layout, second pass

- **A shorter page:** hero, Now, featured work, research, a compact strip of the client sites, field notes, contact. Featured work shows each project once: the research, engineering and software work, with the client sites in their own strip. The services pitch sits under the strip.
- **The signal trace:** a thin waveform down the left gutter from TX in the hero to RX in the footer, with a node and a depth at each section. Each section draws its own segment from its slot's trace (`traceMask` in `depth.ts`), so the noise grows with depth and the trace follows any audience order with no script. It draws in as each section scrolls into view, and is static under reduced motion. On phones it is a faint straight line at the very edge.
- **Trace and gauge stay separate.** The trace scrolls with the page and shows the path; the gauge stays fixed and reads where you are. One element cannot do both, so the gauge moved to the right edge (from 1440px) and the trace has the left gutter.
- **Pinned side headings** for Featured work and Field notes from 1100px: the label, heading and links stay in a left column with a fine tick ruler while the content scrolls on the right.
- **A varied bento:** one tall tile (RAMpage's photo), one wide (the research drawing) and four smaller ones, placed by named grid areas per audience, so no row can have a hole. Tiles with real metrics show the first one as a large numeral; limited-detail work never does.
- **Projects tune in:** a drawn signature has a light speckle of noise at rest and resolves clean while its tile is hovered or focused. Always clean under reduced motion and on touch screens.
- **Instrument details, sparingly:** the tick rulers on the pinned columns, and a mono count in one corner of Featured work, Client work and Field notes.

### 9. Interactions, second pass

- **Sound channel (home, research):** the textbook profile beside ten rays traced through it, from 0 to 100 km of range. The source on the depth axis is a slider: drag it, or focus it and use the arrow keys (Shift for bigger steps, Page Up and Down, Home and End). Rays that stay in the channel are teal; rays that reach the surface or the floor fade back, and a readout counts them. The tracer (`src/lib/sound-channel.ts`) steps the ray equations through Munk's profile and reflects at the surface and a flat floor at 4,000 m. The build draws the rays for a source on the axis; the script loads only as the figure nears the screen. Nothing moves on its own.
- **Skills constellation (/about/):** every skill is a point in one of five clusters (comms and DSP, embedded, web, tools, professional) around an ideal point. Know well skills sit close in; have built with skills scatter further out. Picking a skill (click, or focus and arrow keys, one tab stop for the whole field) names it and lights up the projects whose `stack` lists it, from the table in `src/lib/skills.ts`. When no project lists it, it says so. The plain list below has every skill, its group and its project links; it is the whole section on phones and without JavaScript, and folds away on wide screens.
- **About:** Experience, Skills and Recommendations sit between the story and Off the clock. Experience and Recommendations use the shared pinned heading (`.pinned`, `.pinned__head` in `global.css`, also used by Featured work and Field notes). The bands stop at slot 5, so the closing sections stay on light water in the light theme.
- **Gauge ink:** each gauge line reads the band behind it from the real wave curve, so it switches ink exactly where the edge crosses it, and carries a soft halo in its own water's color for the moment it straddles an edge. Measured at 12 scroll stops in both themes: every text line passes 4.5:1 and every tick and scale segment 3:1.
- **Spectrogram:** whenever the display comes back into view or the tab is shown again, it opens on the held frame with the full name centered, then continues the cycle.

### 10. Third pass

- **Client work** is the full showcase again: large browser and phone frames in alternating rows, with the kind line, what I did, the metrics as large numerals, and the case study and live site links. The services line and buttons sit under it. Client sites appear only here on the home page.
- **Skills** on /about/ are grouped chips by area. Filled chips are know well, outlined chips are have built with. Each chip is a native disclosure, so a tap, Enter or Space shows "Used in:" with the project links from `src/lib/skills.ts`, or "Not on a project page yet", with no script. The script adds opening on hover and focus, one open at a time, Escape to close, and keeps the card on screen. The constellation is gone.
- **Signatures play once:** hovering or focusing a tile plays a short animation on its drawn art (the constellation settles in, bars rise, rays grow out from the source, the hop pattern steps through, ripples spread). Transform and opacity only, under a second, nothing at rest, none on touch screens or with reduced motion. The noise effect is gone.
- **Hero sound:** the name now uses 80 subcarriers from 500 Hz to 3 kHz (at most 57 tones at once), the sweep runs 400 Hz to 3.2 kHz, a second-order low-pass at 3.4 kHz and 30 ms raised-cosine fades shape the buffer, and it plays at a lower level. The waterfall shows 0 to 4 kHz and is still the FFT of exactly the buffer that plays. Hear it restarts the cycle from quiet water, so the sweep and the name are heard and seen together.

### 11. How it works

The hero panel has two tabs, Display and How it works (arrow keys, Home and End). The tab row shows only once the head script has marked the page as running JavaScript, before first paint, so it never shifts the layout. The walkthrough's code and styles load the first time its tab opens.

- **Five steps** of the real pipeline: the bitmap, one OFDM symbol per row, the cyclic prefix and its fade, the sync chirp, and the receiver FFT. Each has two sentences, an excerpt of the code that runs, and a small live view of that step's output.
- **The excerpts are the running code.** They are cut at build time from `src/lib/tx-raster.ts` and `src/lib/tx-signal.ts`, between `#region how:` markers, with their real line numbers. The hero and the walkthrough call the same `synthesize()` and `receive()`; the hero uses the defaults, and its output is bit for bit what it was.
- **Break it on purpose:** turn off the cyclic prefix (the echo smears each row into the next), turn off the fade (the spectrum at a join jumps up, and Hear it plays the clicks), or raise the noise until the name fades into static. A small received waterfall shows the result, and Reset puts everything back.
- **One honest difference:** the walkthrough gives the water a second path, 1 ms late, so the prefix has an echo to absorb. The display tab sends the signal without it, and the walkthrough says so.

### 12. Live tiles

A live tile is a small working version of a project over its picture in Featured work, built from the project's real code (`src/components/live/`). At first paint only the picture shows, with a Try it button; the tile's script loads when the tile nears the screen, and the version starts only when someone presses Try it. Nothing plays sound. Close puts the picture back. Each tile has a screen-reader description and a link to the full version on its case study. On phones the compact row opens to the full width.

- **RAMpage:** the weapon and safety firmware (`src/lib/rampage-firmware.ts`, the same module the case study's simulator now uses) behind Fire, E-stop and Reset. Air counts down from 17 and locks out at zero; E-stop holds the kill switch on; Reset reboots, which refills the count as a power cycle does on the robot. The system as built (FlySky receiver, ESCs, Pico W, Pi 4B) has one button per block, each showing the code that runs there, cut at build time from the vendored firmware in `vendor/rampage/` with real line numbers. The ESCs run no code, and the tile says so.
- **V2V:** the MATLAB scenario (car 1 at 30 m/s, 20 m behind car 2 at 25 m/s) with a closing-speed slider, and the brake rule from `V2V_TXRXf.m`: warn when time to collision is under 5.0 s (`src/lib/v2v-scenario.ts`). At the default it reads 4.0 s and recommends braking. The receiver (`src/lib/ofdm-rx.ts`, shared with the case study's demo) cleans up a packet's payload as its four stages lock in order.
- **Reduced motion:** the stages lock at once, the packet dot is hidden and the status light holds steady. The firmware's own timing (boot, cooldown) still runs, since that is behavior, not animation.

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
