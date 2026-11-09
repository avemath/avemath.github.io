# Redesign: a signal sent down through the ocean

Redesign 3, at the end of this file, replaced most of what is described here. The sections before it are kept as the record of redesigns 1 and 2.

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

## Redesign 3: bench on the surface, water below

Branch `redesign-3`. The ocean stays, but only on one page. The rest of the site is "the bench": a communications engineer's test report, with figure labels, timing diagrams, block diagrams you can hover and numbered callouts. The mockups are `Final direction home page.pdf` and `Final direction research page (underwater).pdf` (kept out of git).

### What changed

- **Tokens and type** (`src/styles/tokens.css`, `fonts.css`): navy `#0b1f3a` for the hero, nav, footer and research page, white paper cards with a 1px border, one accent `#de6a41`. Archivo for everything (headings at width 112, weight 800), IBM Plex Mono for code and readouts. Square corners; callouts are the only round things. Light and dark themes both stay; the navy is the same in both.
- **Hero**: the headline sentence, the subline and two buttons, beside a signal panel that replaces the spectrogram of my name. It draws a 32-chip FH-BFSK preamble in the JANUS band (`src/lib/preamble.ts`, using the band plan in `src/lib/fhbfsk.ts`). Scope cursors follow the mouse and snap to chip and tone; the arrow keys move them too. "Hear it, 2 s" plays the 200 ms preamble ten times slower, from chip 0, with 6 ms raised-cosine ramps (checked for clicks in `scripts/check-comms.mjs`). The hop order is the playground's own, not the standard's, and the caption says so.
- **Home page**, in order: hero, accent marquee, the Right now / Research / Open to strip, Projects (three figure cards and three small cards), the "Below the surface" band, Websites (two by two), Skills, footer.
- **Figure cards** (`src/components/fig/`): each has Live, How it works and Code tabs. How it works shows real lines from the file that runs, with notes that light up their lines; Code shows the whole file. Both widen to the full card.
  - Fig. 01, RAMpage timing diagram: drawn from the firmware constants, fired by the firmware port. The trigger row is RC channel 6, because channel 5 is the kill switch in `pico_direct.py`.
  - Fig. 02, V2V receiver chain: eight focusable stages in signal order (detect, timing, CFO, Costas, FFT, MMSE, Viterbi, BSM). The CFO and Costas stages run on the preamble before the FFT, as in `V2V_TXRXf.m`, so the order differs from the mockup. The browser port has no Viterbi decoder, and the Viterbi stage says so.
  - Fig. 03, LED matrix: the firmware port on the mic, the clip or the idle glow, in the accent on navy. Typing a name scrolls it; the letters the firmware font lacks come from a standard 5x7 set, marked as not from the firmware.
- **Research page** (`/research/`): the only page underwater. Four depth bands (0 to 20, 20 to 50, 50 to 80 and 80 to 100 m) from `src/lib/depth.ts`, a depth gauge, the depth in the nav, a background that darkens downward and a layer that darkens with depth. Fig. R2 plots every BELLHOP arrival from the bellhopSim comms scenario (`src/data/bellhop-arrivals.json`, recomputed with the repo's own export settings; the counts match its `figures.json`). Fig. R1 and R3 are labeled as drawings, not data. The field notes moved here, three per row.
- **Everywhere**: section headings decode once as they come into view, and figure plots draw in left to right the first time they are seen. Both are skipped with reduced motion.
- **Social cards and icons**: navy with the accent and a short hop pattern; a new favicon. The résumé PDF prints in Archivo, slightly narrowed so it stays one page.

### What was removed

The spectrogram hero and its How it works walkthrough (`tx-raster.ts`, `tx-signal.ts`, `spectrogram.ts`, `how-it-works.ts` and `.css`), the audience switcher, the depth bands, wave edges, light rays, marine snow and signal trace on every page, the old depth gauge and packet footer, the sound speed figure (`SoundSpeed`, `sound-channel.ts`), the home Research section, the spotlight rows and the RAMpage, V2V, LED and Landspace live tiles (with `vendor/landspace` and `vendor/led-audio-spectrum`, which only those tiles used). The Signals, Because of ADAM and Grace Mae live versions stay. All of it is in git history.

### Where the ocean went

`src/lib/depth.ts` now holds only the research page's four zones. `DepthGauge` and `FieldNotes` render only there. `BelowSurface` is the one ocean element on the home page: the way down.

### Placeholders for Ave (`grep -rn "TODO(ave)" src`)

- The LED clip: "Play the clip" plays the firmware demo's generated track; swap in a recording if you want one: `src/scripts/fig/matrix.ts`.
- The pool alarm name: the NAME comments in `src/pages/research.astro` and `acoustic-pool-alarm.md`.

Client quotes from Rickey (PLV) and Grace (Grace Mae) are on their site cards, approved by each owner.

### Copy that differs from the mockups, and why

- The R1 tooltip numbers (2 kbps, 1.8 s, 40 MB) are not used: they would read as ONR project figures. The nodes describe each kind of platform in general terms.
- R2 is titled "Arrivals, 15 km, sandy bottom" with a 730 ms window: the real values from bellhopSim. No 200 m or 11.4 ms run exists.
- The pool alarm says it is at the prior-work and planning stage, as `acoustic-pool-alarm.md` does, instead of "the signal chain, a recording rig, and a dataset".
- The field notes are the six existing ones from `facts.json`.
- Skills are the full two groups from `skills.json`, one line per area, so they match the résumé.
- The footer email is the personal one in `site.json`, by Ave's choice.

### Checks

`npm run verify` and `npm run test:a11y` pass (24 pages, 156 scans, now including each figure card's How it works and Code views). Mobile Lighthouse on `astro preview`: home 99 / 100 / 96 / 100, research 99 / 100 / 96 / 100 (performance, accessibility, best practices, SEO), CLS 0 and TBT 0 ms on both. Best practices loses 4 points only to the analytics beacon, which is blocked on localhost.

## Redesign 3b: polish pass

Every page should give a visitor a reason to keep scrolling and something to touch.

### What moved

- **Field notes** left their own section. Each is now one small card under the figure it is about (`MarginNote`, data in `src/data/facts.json` with a `where`): "1500 m/s" in the 0 to 20 m band, "A radio link" with the ONR figure, "g/cm³" (the bottom density bug) with bellhopSim, "Adam" with the pool alarm, and "13 pairs" (JANUS) under the Signals card on the home page. One per place, same decode behavior.
- **Skills** became Fig. 06, a matrix of skills by project. **Website cards** became Fig. 07 to 10, with a label row and each site's mobile performance score from `src/data/sites.json`. Rickey's and Grace's approved quotes moved into that file's `quote` slot.
- The hero panel became its own component, `SignalPanel`, so the 404 page can show it with no signal.

### What was added

- A plain caption under the hero panel ("This is the preamble an underwater modem sends before it talks.") with a mouse and a touch version of the second sentence.
- A "Try:" line in the footer of every project figure; "hover" reads "tap" on touch screens.
- Scroll cues: "See what I have built" under Open to, "Three more below, then the research." between the large and small project cards (placed there because that is where it is true), and "Or see the websites" beside "Back to the surface".
- The 404 page: "No carrier." beside an empty scope whose cursors still move and read `t = --`, `f = --`. Its HTML is 18 KB gzipped (77 KB raw, mostly the inline stylesheet every page shares), plus about 5 KB of scripts.
- `rev <date>` in the footer, from the last commit's date (`git log -1 --format=%cs`), or the build date without git.
- The ONR band says: "Details are limited to what the project has published. Ask me about the methods, not the data."
- Small details: a progress bar on "Hear it"; the V2V constellation moves from one stage's points to the next over 300 ms; "Fire the plow" becomes "Refill (new match)" at zero; project card titles decode on first view.
- A plain-words pass: JANUS, BELLHOP, eigenrays, Costas and the BSM each get a few plain words at their first use on a page.

### What was deleted

Four field notes, because no band is about them: "Land agent" (day job plot twist), "17" (shots per match), "2.9 GHz" (radio workaround) and "113 posts" (where the voice came from). Their stories are still in the RAMpage, V2V, Because of ADAM and About pages. The "surface" label in the home nav is gone.

### Skills mapping rules

- `usedIn` in `src/lib/skills.ts` holds, per skill, one entry per project: what the file does, the file's path, and for client sites which repo.
- A dot needs a tracked file on the repo's `main` branch. Nothing is mapped from a description alone. The first map was built by checking each file with git, and every link was then checked for a 200 on GitHub.
- Columns: RAMpage, V2V, bellhopSim, Signals, LED, Landspace, Client sites. Landspace is defined but hidden, because its repo is private and its dots would not open.
- Skills with no public file stay in the data with a `TODO(ave)` and are left off the matrix.

### Notes on facts

- The JANUS hop pattern is part of the published standard, so the copy no longer says it is not public; it says the playground hops in its own order.
- Nicholas's site moved from avemath.github.io/nmdomke/ (now a 404) to nmdomke.github.io; the project link is updated.
- The website scores are Lighthouse mobile runs from 2026-11-01, made locally because the PageSpeed Insights API was over its daily quota.

### New TODO(ave) items

- Re-measure the website scores on pagespeed.web.dev: `src/components/WebsitesShowcase.astro`, data in `src/data/sites.json`.
- Make the Landspace repo public to show its column: `src/lib/skills.ts`.
- Ten skills have no public file: Embedded wiring and soldering, Client communication, Project management, Fundraising and outreach, Linux, Google Apps Script, and, until Landspace is public, Public records and title research, Excel runsheets, Supabase and Leaflet: `src/lib/skills.ts`.

## Redesign 3c: flow and clarity

### The hero

The headline is `clamp(34px, 4.2vw, 62px)` at line-height 1.02 and the subline 18px. The marquee moved into the hero, so the first screen ends on it. On wide screens the hero holds the sentence, the subline, both buttons, the signal panel and the top of the marquee inside one screen; the panel gives up height first when the screen is short. On phones the order is sentence and buttons, marquee, then the panel. Measured at 1366 by 768, 1440 by 900 and 390 by 844: the headline's last word, both buttons and the top of the marquee are on the first screen in all three.

### The audio fix

"Hear it" could wait about two seconds and then play only the last chips. Some systems report the AudioContext as running before the output device has started, then jump its clock forward past chips that were already scheduled. Now:

- The AudioContext is made on the first press and resumed before anything is scheduled.
- Playback waits until `currentTime` has visibly advanced on two polls in a row (up to 3 s).
- Each of the 32 chips is its own buffer source (each one is the tested, click-free `synthesize()` output), all scheduled from one start time, `currentTime + 0.05`, taken after that wait.
- While starting, the button reads "Starting" and is disabled; during playback it reads "Restart", and a press starts over from chip 0; at the end it reads "Hear it, 2 s" again.
- A browser that never starts its audio output gets "No sound output" after 3 s instead of hanging.
- In development, a console assertion checks that 32 sources were scheduled.

How it was tested: a Playwright script loads the page cold, presses the button, records what reaches the speakers through a tap on the audio graph, logs the button's states, and decodes the tone in every 62.5 ms slot with a Goertzel filter at each of the 26 tones. Chrome, headless and headed through WSLg's PulseAudio output: 32 sources scheduled, all 32 chips decoded in order, first chip 9680 Hz as expected. Firefox could not be tested this way: Playwright's Firefox never starts any AudioContext here, so the button correctly fell back to "No sound output".

### Headings

The decode now takes about 900 ms: a 150 ms scramble, then each letter settles about 25 ms after the one before, so the settle moves across the word. Glyphs change every 60 ms instead of every frame. Project card titles use it too.

### The nav map

| Page | Nav and the links it ends with |
|---|---|
| Every page | Nav: Projects (`/work/#engineering`), Websites (`/work/#websites`), Research (`/research/`), Contact (`/#contact`, the footer). Footer: email, GitHub, LinkedIn, résumé; site links to All work, Research, Services, About, Résumé. |
| `/` | Hero: See the projects (`#projects`), Résumé. Status strip: See what I have built. Projects ends with "All engineering projects" (`/work/#engineering`). Below the surface: Go below (`/research/`). Websites ends with See how I work, Start a project, "All websites" (`/work/#websites`). Skills ends with More about me (`/about/`) and the résumé. |
| `/work/` | Projects is marked. Filters are plain anchors: All, Engineering, Websites, Research. Ends with the research page, About and Get in touch. |
| Case studies | Breadcrumb "Work / Engineering / RAMpage Combat Robot". Projects, Websites or Research is marked by the project's section. Ends with Back to all work, previous and next in /work/ order, and Get in touch. |
| `/research/` | Research is marked; the label shows the live depth, 0 m at the top and 100 m at the bottom. Ends with Back to the surface and "Or see the websites". |
| `/contact/` | Ends with See all work and the research page. |
| `/about/`, `/services/`, `/resume/` | Already ended with forward links (contact, case studies, all work). |
| 404 | Back to the surface and "Or see all work". |

### Websites

The heading is "Websites I built and keep running", with "Small businesses, a nonprofit and one engineer. Fast, accessible, and the owners update their own content." The large alternating showcase from before redesign 3 is back (browser and phone frames, what the business needed, what I did, the numbers, the live versions), in the new type and colors, with the figure label as a quiet row above each site's copy. Client quotes are pull-quote bands between the sites, from `src/data/sites.json`, shown only when filled. The services heading "Sites for people who'd rather be running their business" is now "Sites the owners run themselves".

### Drawings

Every project figure has a Drawing tab (Live, Drawing, How it works, Code). The drawings live in `src/components/drawings/`, one per project, all through `Drawing.astro`:

- Ink strokes at 1.5 px, the accent at 2 px for the one key path, numbered callouts in accent circles with a legend under the figure, labels in Archivo and readouts in Plex Mono.
- Schematics of signal paths and hardware, drawn only from what the repos and case studies say; anything uncertain is said in the drawing's note or marked `TODO(ave): confirm`.
- Each has an `aria-label` sentence and a `<title>`. Strokes draw in once with stroke-dashoffset (Web Animations, filling backwards, so a drawing always ends fully drawn), skipped with reduced motion.

What the facts changed: V2V is drawn as one transmitting Pluto carrying both simulated cars' messages to one receiving Pluto, because that is how it was built (README: "two simulated vehicles", "one TX, one RX"). The LED drawing shows "LEA" only; the firmware's full boot message includes a second name that may be a middle name, which the content rules keep off the site. The LED fan is bins 2 to 51 of the 128-point FFT, not 128 bins, because that is what the band edges use.

RAMpage's Live view adds the pneumatics drawing beside the timing rows. "Fire the plow" runs the firmware port 4x slower than real: a playhead sweeps the rows, the valves and the piston move as the firmware switches them, and a status word reads Filling, Settling, Plow out, Venting, then Ready.

### Small things

- Project cards show what they offer (Live, Drawing, Code) in a quiet row under the title.
- The marquee pauses while hovered. It is hidden from screen readers and has nothing to focus, so it has no focus pause.
- The footer's rev line links to the commit on GitHub.
- The Code tab fetches its file (`/code/<key>.json`) the first time it opens, which took the home page from 504 KB to 288 KB of HTML.

### New TODO(ave) items

- Confirm RAMpage's plumbing: what the main valve does, one reservoir or two tanks, how many pistons (`src/components/drawings/RampagePneumatics.astro`).
- Confirm the pool alarm plan: how many hydrophones and where (`src/components/drawings/PoolSide.astro`).
- Test "Hear it" in your own Firefox: it could not be automated here.

## Redesign 3d: fixes from a real walkthrough

### What changed

- **Nav on /work/:** the marked item follows the section in view (Projects for Engineering, Research for Research, Websites for Websites), and a hash on load counts, so `/work/#websites` marks Websites. Other pages mark by route. About joined the nav, between Research and Contact; below 860px the nav lives in the menu, so the bar stays one line at 390px.
- **Hero:** "See my work" goes to `/work/`. The "See what I have built" link under Open to is gone.
- **Readable text:** every font size under 14px went up to 14px (SVG labels inside figures to 13px, the allowed minimum), and anything under 15px that used the muted grey now uses the softer ink. The status strip labels are 15px, weight 600, in the accent ink; their text is 19px ink at line-height 1.45. Figure label rows are 14px, figure footers and "Try:" lines 15px, the note beside Projects 16px.
- **Live, Drawing, Code:** under each project title these are links now. On the home page they open that view of the figure and bring it into view; on /work/ they go to the case study's demo or the live site, the drawing (a hash such as `/#rampage-drawing` opens that tab on load) and the repo.
- **RAMpage:**
  - The drawing shows the plumbing Ave confirmed: two air tanks, the main valve (GP14), the piston valve (GP15), and two cylinders side by side, each with its own rod, both pushing the plow. The timing rows are unchanged; one valve drives both cylinders.
  - The vent arrow and label are in ink at 1.5 px with a 13px label, and turn to the accent while venting.
  - A compact Fire button and a speed control (4x slower, 16x slower, real time; 4x by default) sit right under the figure. The footer says which speed is playing. The big "Fire the plow" button does the same thing.
  - The legend numbers are callout circles. The status chip replaces "Armed" and says what the drawing says: Ready, Filling, Settling, Plow out, Venting, Out of air. At zero air both buttons read "Refill (new match)".
- **About teaser:** after the status strip, the portrait, the About page's opening lines and "More about me".
- **/work/:** the first heading starts 56px under the nav. Website cards are labeled by address ("Fig. 12 / becauseofadam.org"). Figures are numbered per page.
- **Website facts:** each site card shows mobile performance, accessibility, home page weight, live since and who edits it, from `src/data/sites.json`. The commit counts and similar numbers are gone from the cards (the case studies keep their own metrics).
- **Depth:** paper cards have a two-layer shadow and lift 2px on hover or focus (a faint light ring instead of a shadow in dark mode). Figure areas sit on a light tint. Section grounds alternate on the home page: status white, About alt, Projects white, Below the surface navy, Websites alt, Skills white. On a hovered card the accent strokes brighten and the "Try:" word pulses once; nothing moves without a hover.
- **Small fixes:** the RAMpage case study's serial log is focusable, since bigger text made it scroll on phones.

### Checked

`/work/#websites` marks Websites, scrolling to Research marks Research, and the top marks Projects. The RAMpage legend reads "1 fill 50 ms, 2 extend 400 ms, 3 1 of 17 shots used" with circles; the Fire button sits 13px under the timing rows; at 16x slower the chip and the drawing both read "Plow out" mid-strike. The marquee pauses on hover. The header is one line (65px) at 390. The research nav reads "depth 0 m" at the top and changes on scroll. The breadcrumb on Because of ADAM reads "Work / Websites / Because of ADAM". "Hear it" still plays all 32 chips from the first in Chrome.

### Performance

The LED matrix's resting frame (9 s of the firmware run on the clip) and the V2V figure's first constellation now wait until their figure is near the screen, which kept the home page's main thread free at load. Mobile Lighthouse: home 97 to 98 over three runs, /work/ 98, /research/ 99; accessibility 100 and CLS 0 on all three. One earlier home run scored 75 with 610 ms of blocking time, before the deferral; runs after it did not repeat that.

### New TODO(ave) items

- Website scores: re-measured by Ave on PageSpeed Insights on 2026-11-01 (mobile performance and accessibility: Because of ADAM 100, 100; PLV 98, 100; Grace Mae 98, 100; Nicholas 97, 100, then 100 for mobile on 2026-11-02). Page weights are from local Lighthouse runs that day.
- `liveSince` is confirmed by Ave: Grace Mae Apr 2026, PLV Jun 2026, Because of ADAM Sep 2026, Nicholas Oct 2026.
- The RAMpage plumbing TODO is cleared. Cylinder bore and stroke are still not stated; the drawing does not need them.

### Websites showcase layout

The site rows are media 7 columns, words 5, with both halves centered and the sides alternating. The browser frame fills its column (56% of the container at 1366 and 1440), keeps 16:10, and the phone overlay stays on its bottom right. The screenshots' `sizes` match the real frame width, so a 2x screen gets the 1440px file. Below 960px the media stacks above the words at the full container width, and "Try it" sits bottom left at every width so it never covers the phone. /work/ shows the same rows in its Websites section (Fig. 11 to 14), with website work that has no live site, the PLV Abstract Builder, as a card after them.

## Project facts

RAMpage and V2V, corrected from the source documents on branch `project-facts`.

### Sources

- RAMpage: the team's final presentation (May 2025), `pico_direct.py`, `pi4_direct.py` and `video_direct.py`.
- V2V: the final report and final presentation for EE 4003 (May 2026), `V2V_TXRXf.m`, and the Run 4 figures from the course folder.

### RAMpage

- Pneumatics as built: two 200 psi aluminum reservoirs, charged before a match through a Schrader valve (no compressor on the robot), each with its own inlet valve; both inlets open together on GP15 into one shared line that drives two stacked cylinders pushing one plow. The exhaust valve (GP14) branches off that line to atmosphere: open at idle, forced open on error or E-stop. The drawing, timing rows ("GP14 exhaust", "GP15 inlets"), legend and How notes follow the six-step sequence, and the status word now follows the valve states, so it can't run ahead of the drawing.
- Air budget: 17 cells, the first six shaded as full force. "About six cycles above 30 lbf, 17 allowed by firmware."
- Safety: kill on channel 5, trigger on channel 6; a kill, lost signal or error opens the exhaust and cuts the receiver's power through a solid-state relay, which puts the ESC into failsafe, within 35 ms. Trigger to solenoid 28 to 36 ms, 31.5 ms on average. Drive is receiver to ESC with no software.
- Video, electronics and team credit as in the case study. The RAMpage repo README's Weapon System section is fixed on branch `readme-pneumatics` (not pushed).

### V2V

- The receiver is nine stages in `V2V_TXRXf.m` order: PRE detect, tau sweep, CFO, TRAIN fit, decision-directed PLL, OFDM demod and channel estimate, MMSE, Viterbi, BSM. "Costas loop" is gone from the site; the stage is a decision-directed PLL (gain 0.001, 8-symbol burn-in), and `src/lib/ofdm-rx.ts` now matches it. The 3c entry above still says Costas; that was the wording then.
- The live figure stays simulated, because `run4.zip` holds only figures and no IQ capture; its footer says so and shows the five-run table. The last stage shows each car's fields sent and decoded, the gap, TTC 4.0 s and the warning.
- How it works shows each stage's Run 4 figure, labeled with the report's figure number, and its lines in `V2V_TXRXf.m`. The Code tab is `V2V_TXRXf.m` itself (`vendor/v2v/`, line endings only changed), with MATLAB highlighting.
- Role: "Final project for EE 4003 with lab partner Jason Phan. I designed and wrote the transmitter, receiver and warning logic, and ran all five hardware tests." No "co-author" and no "we built" or "we ran".
- Figures also went to the V2V repo on branch `figures` (not pushed). Course helper files were not copied. The printout photos are printed code pages, so none were used, and no photo of a person is on the site.

## About and Toolbox

Branch `about-toolbox`, from the mockups in `docs/mockups/` (`about-mockup.html`, `toolbox-mockup.html`). New rule: Projects and Websites hold the work; About holds the person.

### About

- Removed: the skills list (`Skills.astro`), the "Four rules I keep" rail and its `principles`, the spinning ring portrait fallback, the topographic contours, the "Engineering", "Websites" and "Land work" prose, the "Off the clock" cards (`offclock.json`; its photos moved into the pinout), the Now strip (`NowStrip.astro`, `now.json`) and the RE+ photo. The meta description no longer says computer engineer.
- Experience is off About (the résumé has it), and `Timeline.astro` is gone. Recommendations are a pull-quote band right after The longer version (`about/PullQuotes.astro`), which replaced `Testimonials.astro`. The RE+ photo is deleted.
- Order: pixel hero with the Integer card, Fig. 01 the AVE-26 datasheet, The longer version, Why underwater, Experience, Recommendations, Say hi. The site footer on About shows only its links, since the page ends on its own "Say hi."
- Palette: "Garden", in `src/styles/about.css`, scoped by `data-page="about"` on `<html>` (`BaseLayout`'s `page` prop). It redefines the site tokens there, so everything on the page follows; the navy nav keeps its own inks and orange. Buttons and cards get 10px corners on About only. axe reports no contrast problems in either theme.
- The pixel scene (`src/components/about/PixelScene.astro`) is the mockup's `scene()`, run at build time into 768 inline rects; no script, `aria-hidden`. The hero is at least as tall as the scene. LCP is the hero paragraph, not the scene.
- The Integer card (`FeatureCard.astro`) is native, not LinkedIn's embed: Integer in Focus, International Women in Engineering Day, June 2026, with the quote and the lab coat photo, shown whole. With no quote it would say only that the post exists; with no photo it has no photo column.
- Pin, row and feature data: `src/data/about.json`. Pin photos are paths under `src/assets/`; a pin with no photo shows its line drawing (`PrintArt.astro`). Pin text can link with `[words](/path/)`. The pins are buttons: hover, click, Enter, Space or an arrow key selects; Tab only moves focus, so a pin's links stay reachable; Home and End jump to pins 1 and 10.
- Polaroids (`Polaroid.astro`): the pin photos, the graduation pair and the two Why underwater prints. Off-white frame in both themes, 88 by 107 with a 79 by 79 image, a 1 to 3 degree tilt that alternates and straightens on hover or focus (no motion with reduced motion). Captions are in Kalam (`src/styles/hand.css`, loaded by /about/ only, 20px). Pin 08 is now FILM; the old TASTE line moved into Compatibility.
- Not done: the scattered Polaroids along The longer version. The right column already holds the graduation prints, and the only other photos are the pin photos, so extra prints would repeat them and crowd the column.

### Toolbox

- The home page's Fig. 10 skills matrix (`HomeSkills.astro`) is gone. `Toolbox.astro` replaces it in the site's navy and orange: Know well (Python, MATLAB, MicroPython and C, Digital communications, Git and Linux) and Have built with (Astro and TypeScript, BELLHOP, Apps Script, Web Audio, React, Supabase).
- Data: `toolbox` in `src/lib/skills.ts`, built from `usedIn`, plus one file each for BELLHOP (`bellhopSim/src/environment_builder.py`) and Web Audio (`avemath.github.io/src/components/demos/signals/fhbfsk.ts`). Every file path was checked on GitHub. Apps Script, React and Supabase say "case study only" (the Little Explorer Swim and Landspace repos are private). `skills.ts` lost the matrix-only `areas` and `terms`.
- Hover (after a short wait), focus or a first tap fills the panel; a second tap follows the chip's link, and the panel's project links work at once.

### Labels

- `scripts/check-labels.mjs`, run by `npm run test:a11y`, loads every page at 390, 768, 1366 and 1440 in both themes, opens every figure view, V2V stage, About pin and plow status, and fails on any SVG label that crosses its box or comes within 4px of it across (1px up and down), overlaps another label or a line from another group, or is clipped (callout circles included), and on HTML text that runs out of its box. It writes `audit/label-overflow.md`.
- Fixed: the LED drawing (Mic box wider, ESP32 and matrix labels on two lines), the RAMpage Valves label (two lines), the Signals playground bit chips (taller) and axis title (inside the plot), the hop plot's 13.6k and 9.44k (wider margin, callout 2 back inside), the research callouts (larger circles), and the Grace Mae address in its browser bar at 390 (the window dots hide on phones).
- Services: the heading spans the whole hero, three lines at 768 to 1440.

### TODO(ave)

- THRIFT: take a photo of the bellows camera. The pin shows a drawing of it until then.

Answered Nov 2: Mom's quote is under the prints in The longer version; the Ida print is in, with no credit line (Grandma Peggy took it); the FAIRE friends, the FAIRE text and the trach sentence are approved; the name is "Because of ADAM: Allies in the Drowning Awareness Movement". The Contemporary Pediatrics article is not about Adam: it is by Todd R. Porter, MD, and Nicole Hughes (June 16, 2021), about her son Levi, so it is not linked as Adam's story.

### Photos, November 2026

- No photo is cropped anywhere. Polaroids take the photo's own shape (fixed width, height follows); the datasheet's pin panel keeps a square window and fits the whole photo inside it on the panel tint, so a tall photo gets side margins. The FILM pin shows the instant print as it is, border and all, with no frame added. FAIRE adds a small second print (`polaroid-pirate.jpg`) beside its photo, under it on phones.
- About photos go through `<Picture>` as AVIF and WebP at 320 to 640px, lazy. The RAMpage case study's two inline photos are Markdown images inside a `<figure class="case__fig">`, which Astro sizes and serves as lazy WebP.
- No image in the repo had EXIF or GPS data. Two video posters carry an ffmpeg encoder tag and one Landspace screenshot an ICC color profile; the built images carry no metadata at all.
- The home teaser shows the new `portrait.jpg` whole. The old portrait (Tiger Stadium) is `about/polaroid-tiger-stadium.jpg`, the first print in The longer version.


## Specimen (November 2026)

Branch `specimen`, from `docs/mockups/specimen-study.html` and `docs/mockups/specimen-choices.html`. Approved from the study: type, palette, plate frames, the Plate I eigenray hero and the small line-art project plates. Not used: the signal mesh, the RAMpage CAD plate, the scan-line portrait and the record of prints. Approved from the choices: the seafloor, the chip prints with handwritten notes and the bit girl.

### 1. Tokens and type

- Palette in `src/styles/tokens.css`: paper, sheet, ink, muted, rule, lilac, sage, teal, gold, rose and photo, light and dark, with darker text inks (`--lilac-ink`, `--sage-ink`, `--gold-ink`, `--rose-ink`) where a color carries text. Screen, print, note, chip and bit tokens for the dark figures, the prints, the notes, the chip and the bit girl. The navy, orange and Garden colors are gone (`navy.ts`, `about.css`, `hand.css` deleted).
- Type: Bodoni Moda (display, roman and italic), Hanken Grotesk (text), JetBrains Mono (labels), Kalam (handwriting), self-hosted, Latin only, `font-display: swap`. Both Bodoni files are preloaded (the h1's surname is italic, and it is the LCP element). Metric-matched fallbacks for every face; Hanken Grotesk also has Roboto and DejaVu Sans fallbacks, so phones without Arial do not reflow when the font arrives.
- Plates: `.plate` frames with an inset hairline, "Plate N" heads and "Fig. N." captions in display italic. Buttons are pills.
- Theme color, favicon, social cards, touch icon and the résumé PDF are regenerated (`npm run assets`). The PDF is still one page.

### 2. Plate I, the eigenray hero

- `src/scripts/eigenrays.ts` traces 21 rays through bellhopSim's Munk profile in the browser (no `.ray` file is committed; see SOURCES.md) and draws them as seven slices of a wedge. Drag or arrow keys rotate it; it turns slowly once the visitor has moved or scrolled, only while on screen; rays add up like light in dark mode; reduced motion draws one still frame.
- The name is in Bodoni with the surname in lilac italic, then "I study how sound travels through water." Hear it is kept (`src/scripts/hear-it.ts`).

### 3. Project plates

- V2V (Plate III): the received constellation for BPSK, simulated from run 4's figure (see SOURCES.md). LED (Plate IV): a 16 by 16 matrix with bars and a pixel heart. RAMpage keeps its interactive figure and timing diagram (Plate II). The CAD redraw was not started.
- The home page's V2V and LED interactive cards became these plates; the interactive figures are still on their case studies.

### 4. The Research seafloor

- The opening scene of /research/ (`src/components/research/Seafloor.astro`): you stand on a ledge halfway down a terraced seafloor. Lit terrace tops, darker risers, a glowing contour along the top edge of every riser, a slow shimmer, stacked-slab formations above and below you, sixteen line-drawn jellyfish (eight above eye level, eight below), four glowing blue crabs on the ledges near you, plankton. Caption: "The little blue crabs on the ledges are for my grandfathers."
- Layout in `src/lib/seafloor.ts` (no three.js), drawing in `src/scripts/seafloor-scene.ts` (three.js from npm). `npm run test:seafloor` (part of verify) runs two minutes of drift and fails if any jellyfish, tentacle or crab ever enters a terrace or a formation, if the jellyfish are not half above and half below eye level, or if a crab leaves its ledge or walks into another crab.
- Smooth risers: a polar mesh centered on the viewer, rings close together near the ledge and never more than 0.45 apart far away, and the riser takes 45% of each level instead of 22%. The contours are drawn from the smooth height field, not the mesh, so they stay curves.
- Loading: the page ships a still image (`src/assets/research/seafloor-still.jpg`, rendered from the live scene by `npm run assets`). three.js is a separate chunk, imported only on /research/, only near the viewport, only with WebGL and motion allowed, and only after the visitor moves, scrolls, touches or types. It pauses off screen and when the tab is hidden. Without WebGL, or with reduced motion, the still is the scene.
- Removed: the depth gauge, the "depth 0 m" nav label, the range labels and the darkening bands (`DepthGauge.astro`, `src/lib/depth.ts`). The home teaser no longer says the page darkens with depth.

### 5. The About chip

- `src/components/about/Datasheet.astro`: pins 01 to 05 down the left, 06 to 10 up the right. Each pin is a button with `aria-pressed`; pressing one slides its print out of the chip (no slide with reduced motion) with a taped, lined note in Kalam beside it, and lights its row in the Characteristics table. Pin 08 FILM is out to start. Arrow keys move focus the way the chip looks; Home and End jump to 01 and 10.
- FAIRE shows the pirate print as a second, larger print (175px, 130px on phones) captioned "Started early." FILM shows the new cropped print whole, with no extra frame. VCC and THRIFT show their line drawings until there are photos. TYGA and SIDEQ already had photos (`offclock/tyga.jpg`, the LED matrix), so they keep them; there is no line drawing for either.
- Notes are in `src/data/about.json`, each with a `TODO(ave): check wording`. The separate pin photo panel is gone. The "bad memory" line is gone from the site and the data (it was never on the résumé). The kayak alt names Lea.

### 6. The bit girl

- One fixed canvas over the viewport (`src/components/BitGirl.astro`, `src/scripts/bit-girl.ts`): pointer-events none, `aria-hidden`, under the sticky header, never takes a click. On home, About and Research (`bitGirl` on `BaseLayout`).
- Perches are declared in the markup (`data-perch`, see the script's header). When she picks one she checks that her whole body would be clear of text, images and cards and inside the page, so phones only use perches with room. She starts just right of the About intro on desktop and on the Integer card on phones.
- She turns to the cursor and waves after about 3 s left alone with the cursor on the page. The first approach on a perch may send her running once to another perch on the same ledge; the next scatters her into bits that fly to a perch off screen, never straight back to the one she just left. About shows the count in handwriting ("found her 2 times. She ran down the page."). Reduced motion: she fades out and back in, and holds still.
- One rAF loop at about 30 frames a second while she is on screen, stopped when she is off screen and still; per frame it reads only the current (and, while moving, the target) perch's position.

### 7. Checks

- `npm run test:layout` adds, at 320, 390, 768 and 1440 in both themes: the chip and tray (ten 44px pins inside the page, each press showing its own print, no sideways scroll), the seafloor filling its band edge to edge, and the bit girl (her canvas never takes a click, a real click through it reaches the pin under it, every perch she may use is clear of text, at least two per page).
- Lighthouse (local, gzip, Lighthouse 12): mobile / 95 (94 to 96 over five runs), /about/ 97, /research/ 96, /work/rampage/ 96; desktop 100 on all four. Accessibility, best practices and SEO 100 everywhere. three.js loads on none of them during the run (it waits for the visitor), and never on any page but /research/.
- Screenshots of every page at 390 and 1440, light and dark: `docs/specimen/` (full length for home, About, Research and RAMpage; the first 1800px for the rest).

### Changes from the mockups

- Seafloor: the mockup's terrain filled the whole slope to the top level, so the viewer was not halfway down; the field is now a bowl with mounds. Jellyfish are placed by trying spots until each fits, so half really are below eye level (the mockup pushed most of them up). Crabs are smaller (0.9 of the drawing, not 1.3), further out, and walk sideways along a level ledge (the mockup turned them at random angles and walked them across risers). The caption sits inside the scene from 760px and under it on phones, led by "On a ledge above the deep."
- Chip: hovering a pin no longer changes the print (only a press does); the note sits under the print on phones so it no longer covers the print's caption; the Characteristics table stays under the chip; there is extra room above the chip on wide screens for the bit girl to stand. The mockup's "draft, edit me" line is a TODO in the data instead.
- Bit girl: perches come from the page and are checked for clearance at runtime instead of fixed coordinates; she waves at most once every 6 s; no wave with reduced motion.

### TODO(ave), all of them

- `src/data/about.json`: check the wording of each of the ten pin notes (VCC, OUTSIDE, SNOW, FIELD, THRIFT, TYGA, SIDEQ, FILM, FAIRE, GND).
- `src/data/about.json`, `Datasheet.astro`: a latte photo for VCC and a photo of the bellows camera for THRIFT.
- `src/lib/skills.ts`: Landspace's repo is private; make it public to link its files.
- `src/scripts/fig/matrix.ts`: "Play a demo" plays the firmware's generated demo track (captioned "A generated demo track, not a recording."); add a recorded clip if you want one.
- `src/components/plates/V2vConstellation.astro`: replace with run 4 received symbols if I can export them from MATLAB.

### Fixes before push

- The LED figure's button is "Play a demo", captioned "A generated demo track, not a recording."
- Plate III's caption says the constellation is simulated BPSK at the SNR of the hardware runs, not measured data.
- The home teaser for Research lost its 0 to 100 m gauge.
- `/styleguide/` is the "Specimen design system" (title and heading), still `noindex`.
- Kept as is, by choice: the Characteristics row "Known issues" says "than she builds them".

## Specimen, round 2 (November 8, 2026)

### Interactions restored (compared with main before Specimen, b8a3090)

Lost on the home page and now back, restyled: the hero's signal scope (SignalPanel: cursors, readout, Hear it), the marquee (hover pauses it), the V2V receiver-chain card (hover a stage, Step through the receiver, Live, Drawing with its draw-in, How it works, Code, decode heading) and the LED matrix card (mic, Play a demo, Idle glow, the name field, the same four views). Both cards also gained a Plate view with the Specimen line art. The RAMpage card's Fire the plow, timing diagram, signal path drawing, How it works and Code moved, unchanged, to the RAMpage case study (`#fire`); home shows a photo plate with a hover preview (the arena clip) and a Fire the plow link. The case studies lost nothing. `scripts/check-interactions.mjs` (in `npm run test:layout`) tests each interaction.

### Other fixes

- Contact in the nav went to `/#contact`, the home footer, and lazily laid-out sections (`content-visibility`) made the jump land in the Websites list. It now goes to /contact/, and arriving at any `/#section` turns the lazy layout off for that visit.
- Toolbox chips are toggle filters (`aria-pressed`): matching project plates stay lit, the rest fade to 35%, and a polite live line says where the tool was used. Press again or Escape to clear. Hover still fills the "Used in" panel.
- Green is the accent (see DESIGN.md); surfaces alternate paper, sheet and deep; the hero has the contour texture; the Research teaser and the footer are deep bands.
- The seafloor drag never worked in a real browser: the still image sat on top of the WebGL canvas (later in the DOM), so you were looking at and dragging the image, whose native drag cancelled the pointer. Rebuilt with the Research scene below; the drag test checks what is under the pointer and that the camera turns.
- /research/ is one scene: the seafloor is a fixed canvas behind the page, scrolling moves the camera from the murky green shallows (light shafts, the crabs) down to the glowing deep, and the content sits in sheet panels with a slight blur. Drag open water to look around (on touch, a sideways swipe turns, an up-and-down swipe scrolls); arrow keys from the scene control in the first panel. Phones render at 60% resolution; it pauses when the tab is hidden. Reduced motion or no WebGL: a still gradient from shallow green to deep, with a still render of the shallows at the top.
- The Signals playground (Plate VIII, `src/components/playground/MeshPlayground.astro`) leads the Signals case study; the five earlier demos stay under it. The home Signals plate opens on a still of the mesh and keeps its Live and Drawing views.
- Website metrics are now performance, accessibility and Loads in (mobile LCP), measured Nov 8, 2026 (see SOURCES.md).

### Lighthouse (local, Lighthouse 12)

Mobile: / 95 (median of 94, 98, 95), /research/ 98 (median of 98, 89, 98), /about/ 97, /work/rampage/ 96, /work/signals-playground/ 97. Desktop: / 100, /research/ 100. Accessibility, best practices and SEO 100 on all. three.js loads on none of them during a run, because it waits for the visitor to move, scroll or type.

### TODO(ave), new

- `src/components/RampagePlate.astro`: replace with CAD render when I get the SolidWorks files.
- `src/components/plates/V2vConstellation.astro`: replace with run 4 received symbols if I can export them from MATLAB.

## Specimen, round 3 (November 8, 2026)

- **Site metrics** come only from PageSpeed Insights (mobile). The keyless API quota was used up, so `scripts/measure-sites.mjs` (median of 3 runs, with the date) waits for an API key: `PSI_KEY=... node scripts/measure-sites.mjs`. Until then the showcase shows the PageSpeed runs of Nov 1 and 2 (performance and accessibility), and no Loads in. The Grace Mae case study cites PageSpeed throughout.
- **Case studies** are fluid: a 220px contents rail from 1024px, text to 80 characters, figures, images, tables and code out to 1100px, body type from 17 to 20px with the screen. The gallery is one large photo per row, aligned with the content column, and the RAMpage instant print shows at the text column's width.
- **V2V figures**: one figure viewer (`src/scripts/figure-viewer.ts`) gathers the 13 MATLAB plots: Previous and Next, thumbnails, arrow keys, swipe, full screen, captions kept, and a button in the text where each figure was. Without JavaScript the figures stay inline.
- **V2V receiver card**: the Plate view is gone (and with it the constellation plate component and its TODO). Step through the receiver starts at stage 1, then moves on; picking a stage or leaving the Live view starts it over, and it is hidden on the views where it cannot work. The stage order was checked against `V2V_TXRXf.m` (lines 220 to 496, in order) and is right. Each stage has a one-line caption saying what it did and why it looks as it does: the tau sweep looks like detection (the timing was already right), and after the FFT the subcarriers scatter until MMSE.
- **Home**: the Research teaser's still has no light shafts and no tentacles crossing it; the marquee is 1.5 times larger and the status words under it bigger; the Toolbox is a crate of records (`src/components/Toolbox.astro`) with the same project filter.
- **Texture**: contours on every plain section, a cursor glow, plankton in dark mode (see DESIGN.md).
- **Dark mode**: cards, plates and panes are `#1a2a24` with `#2c4038` borders on the `#0c1512` page.
- **Research**: muted translucent panels; Back to the surface scrolls to the top so the camera rises, with a Home link beside it.
- **Tests**: the figure viewer, Step through starting at stage 1 and the crate (mouse, keyboard, touch, reduced motion) are in `scripts/check-interactions.mjs`, with Back to the surface.
- **Lighthouse (mobile)**: / 95 (median of 5), /research/ 98, /work/v2v-bsm-ofdm/ 98, /work/rampage/ 95, /about/ 97; desktop 100.

## Large screens (November 8, 2026)

- One root size: 16px up to 1440 wide, then growing to about 19.8px at 2560 and stopping there (`html` in `global.css`). Body text is 17px at 1440, about 19px at 1920 and 21px at 2560; headings, the hero name, the marquee, labels and spacing are in rem and follow. Laptop and phone sizes are unchanged. SVG labels stay in px, in each drawing's own units.
- The container grows from 1216px at 1440 to about 1466px at 1920 and 1800px at 2560 (capped); the case study rail and figure widths are in rem. Paragraphs keep about 80 characters; the extra width goes to figures, columns and gutters.
- About: the chip, its pins, the tray, the print that slides out, the note and the pirate print grow together (zoom steps from 1600px): the print is about 380px at 1920 and 460px at 2560. Every print on About is at least about 240px wide at 1920.
- The crate's sleeves are in rem; the bit girl grows to about 1.2 times at 2560.
- Arriving at a #section re-lands on it after fonts and the page load, so a late shift above it can't leave you mid-page.
- Screenshots at 1440, 1920, 2560 and 3440 by 1440, light and dark, of home, About, Research, Signals and RAMpage: `docs/specimen/large/` (WebP, the first four screens of each page).
- Tests: the layout checks and the label checks now also run at 1920 and 2560.
