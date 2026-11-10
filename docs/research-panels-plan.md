# Research panels: plan (polish round 3)

Inventory of every panel on `/research/` before the redesign, and what each one becomes. Layout for
all of them from 1024 px: a two-column plate, the figure on the left (7 of 12 columns), the text on
the right (5 of 12). Below 1024 px the figure stacks above the text. Each panel is a glass sheet over
the fixed seafloor scene, tinted for its depth, with a double hairline plate border and a mono depth
tag in its top corner that matches the depth gauge.

## Depth

There was no depth gauge on `/research/` before this round. The page now has one: a small mono
readout fixed at the right edge from 1024 px, reading the dive as the 0 to 5000 m water column the
figures use (Munk's depth). Scrolling the whole page is the whole dive, so the gauge reads 5000 m
times the scroll fraction. Each panel's tag is the gauge reading when that panel is centered on
screen, worked out by the same function, so the two always agree. Without JavaScript the tags stay
hidden (they would only guess).

## Panels

| # | Panel (id) | Before | Figure it gets | Layout |
|---|---|---|---|---|
| 0 | Intro: "Research, below the surface." | h1, scene caption, "drag the water" hint; text only, no figure | None of its own: nothing real to show beside the title. **Merged** into panel 1's text column, so no panel has an empty column. | Becomes the page header inside panel 1 |
| 1 | Why sound (`#below`) | Paragraph, Fig. R0 with Race and Drawing tabs (one lane: radio vs sound across 1.5 km), 1500 m/s field note | **Fig. R0, the race**: one figure split by a waterline, four lanes (radio and sound in air above, radio and sound in water below), distance slider 10 m to 10 km (log), radio frequency selector (1 kHz, 10 kHz, 100 MHz, 2.4 GHz) with skin-depth loss, acoustic frequency selector with Thorp absorption, a real clock and playback rate. Formulas in `src/lib/race.ts`, tested. The old static three-path drawing goes (the ray tracer in panel 4 shows real paths). | Figure left, h1 + text + 1500 m/s note right |
| 2 | ONR (`#onr`) | Fig. R1 network (illustration, not data) with message dots, text, advisor, links, "A radio link" note | **Fig. R1, the platform network** as it is: an illustration of the kind of network, labeled as not project data. Public wording only, no numbers. | Figure left, text + note right |
| 3 | Getting bits through (`#signals`), **new** | Not on `/research/` before; the FH-BFSK mesh lives on home and `/work/signals-playground/` | **Fig. R2, the FH-BFSK mesh**: the compact playground on the real `src/lib/fhbfsk.ts` (Send a packet, decoded result, link to the full playground). Added because the page says "I work on getting data through them anyway" and this is the one live figure of that. | Figure left, text right (from the playground's own write-up) + "13 pairs" note |
| 4 | Sound channel, bellhopSim (`#bellhop`) | Text, Fig. R2 with Arrivals (real BELLHOP data, 15 km) and Drawing (static ray sketch) tabs, "g/cm³" note | **Fig. R3, the ray tracer** (default view): bellhopSim-style 2D rays in c(z) from the shared `src/lib/raytrace.ts`, its five profiles, source depth, fan width, draggable receiver, Ping with a running clock, eigenrays and an arrivals stem plot. **Arrivals** stays as the second view (real BELLHOP output). The static Drawing view is replaced by the tracer. | Figure left, text + note right |
| 5 | Pool alarm (`#pool-alarm`) | Fig. R3 Concept (moving drawing, "not results") and Drawing tabs, text, "Adam" note | **Fig. R4, the pool**: the concept animation and the side view, both labeled concept, not results. | Figure left, text + note right |

Figures are renumbered R0 to R4 in page order.

## Not changed

- "Back to the surface" in the footer keeps working (tested).
- three.js still loads only on `/research/`, after the visitor moves.
