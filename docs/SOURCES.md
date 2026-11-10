# Sources

Where each kind of fact on the site and the résumé comes from, so an audit can trace a claim instead of guessing. When a fact has no source here, it goes on the audit's open questions list until Ave confirms it, and the confirmation is added below with its date.

Documents in `docs/sources/` are kept locally and are never committed or published (`docs/sources/` is in `.gitignore`). Paths below that start with `/mnt/c/Users/avery/` are Ave's own copies.

## RAMpage (combat robot)

- **The final presentation deck**, Project #22, "30 lb. Combat Robot RAMpage", May 2025. Local copy: `docs/sources/RAMpage-final-presentation.pdf` (original: `OneDrive/LSU/EE 4820/Project22_CPFPS.pdf`). The source for:
  - the competition: the Bengal Bot Brawl, "a competition between three LSU senior design teams and the LSU Bengal Bot club team" (deck page 5), and the result, first place overall (page 58, "Bengal Bot Brawl Results": remote pilot round 1 win and 1 draw, line of sight round first place, round robin second place, overall first place);
  - the team, the advisor (Dr. Adrian Stein) and the timeline, August 2024 to May 2025 (pages 1 and 57);
  - latency: trigger to solenoid 28 ms minimum, 36 ms maximum, 31.5 ms average against a 50 ms target; kill switch cuts power within 35 ms (page 50);
  - video: 6.2 FPS average before the external antenna, 17.4 FPS after, an 11.2 FPS increase; adaptive JPEG quality 80 to 50 (pages 24 and 49);
  - the thermal test: keep the Pi under 85 °C (page 51);
  - electronics: 4-in-1 BLHeli_32 70 A ESC, BA3520 650 Kv brushless motors, 5 cell LiPo, 100 A maxi fuse, 5 V to 3.3 V level shifter, solid-state relay, fisheye Pi camera, Pico W, Pi 4B (pages 39 and 40);
  - controls: CH2 and CH3 drive, CH5 (SwA) kill switch, CH6 (SwD) weapon trigger (page 43);
  - pneumatics: two inlet valves (1/4 in, 8.5 W) and one outlet valve (1/2 in, 16 W), all 12 V (page 81); one-piece reservoirs rated 200 psi, Schrader fill, 200 psi limited by the compressor (pages 52 and 82); no compressor on the robot, for vibration, power and weight (page 66); 80 lbf per cylinder at 200 psi (page 66); effective cycle means at least 30 lbf, predicted at least 5, exceeded by 1 (page 29).
- **The final report**, "Project 22: 30 lb. Combat Robot, RAMpage" (original: `OneDrive/LSU/EE 4820/NEW_P22_CPFR.pdf`). Settles two points the deck leaves loose: the robot "was able to fire 6 times at 30 lbs. or greater", and the radios are the FlySky FS-i6X transmitter with the FS-iA6B receiver. It also says the reservoirs are aluminum.
- **The firmware**, `vendor/rampage/pico_direct.py` (pinned at commit 929c280 of github.com/avemath/RAMpage): thresholds (900 to 2100 µs valid, on above 1700, off below 1300), the six-step sequence (50, 50, 400 ms), the 500 ms cooldown, the 17 activation limit, the one second signal-loss timeout, and the startup interlock. `pi4_direct.py` and `video_direct.py`: UDP port 5000, 65,000 byte frames.
- **The RAMpage README** (github.com/avemath/RAMpage): Team 22, "for the Bengal Bot competition". The site calls it the Bengal Bot Brawl, as the deck does.
- **Photos**: the shop and arena photos in `src/assets/projects/rampage/` show the plow as one flat plate on two pairs of rods.

## V2V collision warning over OFDM

- **The final report**, EE 4003, "V2V Collision Warning System" (original: `Downloads/4003 Final Report V2V Collision Warning System.pdf`).
- **The repo**, github.com/avemath/v2v-bsm-ofdm: README and `V2V_TXRXf.m` (vendored at `vendor/v2v/`, byte-identical to commit c5328e5). The five over-the-air runs, distances, obstructions and SNRs come from the README and report.

## Plate I: the eigenray hero

- **The rays are traced in the browser** (`src/lib/raytrace.ts`, shared with the Research ray tracer), not read from BELLHOP output: bellhopSim has no committed `.ray` file for its Munk case (its `docs/figures/` holds rendered PNGs and `figures.json`, which records settings, not ray paths).
- **The model is bellhopSim's Munk profile:** c0 1500 m/s, channel axis 1300 m, B 1300 m, epsilon 0.00737, 5000 m of water, 100 km of range (`docs/figures/figures.json`, `deep_water.parameters`).
- **The source is at 1000 m** for the plate, as the approved mockup draws it; bellhopSim's own Munk figure puts it on the axis at 1300 m.
- **The tracer** (since Nov 9) integrates BELLHOP's ray equations (r, z and zeta = sin(theta)/c, with xi = cos(theta)/c held fixed, which is Snell's law) by fourth-order Runge-Kutta, with mirror reflections at the surface and bottom; the plate draws 21 launch angles from -13 to +13 degrees. `scripts/check-physics.mjs` checks Snell's invariant along a ray (relative drift under 1e-7), that a Munk ray from 1000 m turns where c = c(zs)/cos(theta0), travel times in isothermal water, and (below) BELLHOP's own arrivals.

## Fig. R3: the ray tracer on /research/

- **Profiles** are bellhopSim's five from `src/profiles.py` with its default parameters: Munk (5000 m), surface duct (duct 100 m at 1520 m/s), Arctic (surface 1435 m/s, 4000 m), shallow water shelf (200 m, 1520 to 1490 m/s) and isothermal (1500 m/s). The defaults follow bellhopSim's deep-water figure (`scripts/export_figures.py`, `DEEP`): source on the axis at 1300 m, a fan of plus or minus 20 degrees, receiver at 65 km and 1300 m.
- **No `.ray` or `.arr` files are committed in bellhopSim** (its `outputs/` holds PNGs only), so the browser tracer is compared with the BELLHOP arrivals this site already keeps (`src/data/bellhop-arrivals.json`, bellhopSim's comms scenario: a 1000 m shallow-water profile, source 50 m, receiver 15 km out at 100 m). Result (Nov 9): every one of the 17 bounce histories BELLHOP reports is found by the browser tracer, and its 22 eigenray delays for those histories land within 0.56 ms (or 1%) of BELLHOP's, relative to the first arrival. BELLHOP lists fewer paths overall (43 against the tracer's 138) because it drops paths once the sand bottom has absorbed them; the browser tracer has no bottom loss, so it keeps paths with many more bounces. That difference is said in the figure's note.
- **Eigenrays** are found the way BELLHOP's eigenray mode finds them: a dense fan (361 rays), and wherever two neighbors with the same bounce history land on either side of the receiver, one ray between them passes through it.

## Plate III: the V2V constellation

- **The modulation is BPSK:** `V2V_TXRXf.m` modulates every payload with `pskmod(..., 2)`, so the plate draws two clusters at +1 and -1 on the I axis (not 16-QAM).
- **No received symbols are in the repo.** Run 4's post-MMSE constellation exists only as a figure (`figures/run4-fig9_bpsk_constellation.png` in v2v-bsm-ofdm), so the points are simulated (`src/components/plates/V2vConstellation.astro`, seeded): 140 per car, spread about 0.08 in I and 0.07 in Q, matching that figure (a symbol SNR near 19 dB, zero bit errors).
- **The 7.5 dB SNR** in run 4's table (the case study and ChainFig) is the preamble correlation SNR, not the symbol SNR; simulating at 7.5 dB would draw clusters far wider than the radios produced.

## The Research seafloor

- **An illustration, not data.** The terraces, formations, jellyfish and crabs are drawn from a seeded layout (`src/lib/seafloor.ts`); no bathymetry or survey is behind it. The crabs are for Ave's grandfathers, who worked the water in Lafitte as fishermen and crabbers.

## The Signals playground (Plate VIII)

- **Every bit is computed, not drawn.** `src/lib/fhbfsk.ts` turns the text into 8 bits per character, makes a 48 kHz waveform with one 6.25 ms chip per bit at the JANUS tone pairs (the hop order is the playground's own, seed 87), puts it through the channel (Doppler as a time scaling by 1 + v/1500 m/s, a surface echo as a delayed, weaker copy, then white Gaussian noise at the SNR, measured per sample over the full 24 kHz), and decodes each chip by comparing the energy at its two tones (Goertzel, noncoherent BFSK). Chip timing is known: there is no preamble or synchronization. `npm run test:comms` checks that 30 dB decodes exactly, -20 dB makes errors, a moderate echo still decodes and 12 m/s of Doppler costs bits.
- **The drawing is the picture of that run.** The ripple spacing per bit, the echo's lag and the noise roughness follow the settings; the Doppler stretch is drawn 40 times larger than it is so you can see it. The spectrogram is the received waveform's.

## Other projects

- **Repo READMEs and code**: bellhopSim (its main case is the Munk deep-water profile; the arrivals and spreads in Fig. R2 come from `docs/figures/figures.json`), led-audio-spectrum (firmware constants; the boot scroll is "LEA"), the client site repos (gracemaealterations, plvinc, BcofADAM, nmdomke.github.io), and this repo for the Signals playground.
- **Client site order**: the GitHub repo creation dates: gracemaealterations 2026-04-15, plvinc 2026-06-05, BcofADAM 2026-09-28, nmdomke.github.io 2026-10-26.
- **Client site metrics, everywhere on the site** (`src/data/sites.json`, the website showcase and the Grace Mae case study): Google's PageSpeed Insights, mobile, and nothing else. `scripts/measure-sites.mjs` runs it three times per site and records the median performance, accessibility and "Loads in" (Largest Contentful Paint, in seconds) with the date. Until that has run with an API key (the keyless quota was used up on Nov 8, 2026), the showcase shows the PageSpeed runs of Nov 1, 2026 (Nov 2 for nmdomke.github.io), performance and accessibility only, and no Loads in.

## Research and Integer

- **LSU's announcement**, "LSU, Integer Partner to Optimize U.S. Navy, Marine Corps Operations" (LSU Engineering, September 2024), and LSU's July 2024 release, "LSU and Integer Technologies Announce $9.8M Navy Research Contract, Baton Rouge Office". The ONR project's name, its purpose, Dr. Wei's quote, and Integer's office on LSU's campus.
- **The Department of Defense contract announcement**, via ClearanceJobs (March 2024): the sentence quoted on /research/, "the development of decision-making tools for data management on board distributed naval platforms."
- **Integer's "Integer in Focus" post**, International Women in Engineering Day, June 2026 (linkedin.com/feed/update/urn:li:ugcPost:7475180996028510208): Ave's quote on /about/, and that both of her grandfathers worked the water in Lafitte as fishermen and crabbers.
- Confidentiality: ONR and Integer entries use only what these public sources say. Integer has confirmed that controlled information covers numbers; no test numbers appear on the site.

## Family (Because of ADAM)

- **Mom's Because of ADAM posts**:
  - Both grandfathers worked the water in Lafitte as fishermen and crabbers (also in Integer's post above).
  - August 30, 2021: after Hurricane Ida, Ave's grandpa waded through his yard to check on his boats and crab traps. The Ida photo on /about/ was taken by Ave's grandma Peggy.
  - October 3, 2020: Dad became a Red Cross CPR instructor in summer 2020.
- **Adam's story** is shared in Ave's words, as approved (see the children and family rule in the project notes).
- **Because of ADAM's name and status**: "Because of ADAM: Allies in the Drowning Awareness Movement", described as a nonprofit, not a 501(c)(3), until its tax-exempt status is reinstated (BcofADAM `docs/LAUNCH-CHECKLIST.md`).

## Confirmed by Ave

Facts with no document behind them, confirmed by Ave directly. Each line gives the date she confirmed it.

- 2026-11-06: open to summer 2027 internships in comms, embedded or DSP, Baton Rouge or remote (home status strip). Withdrawn 2026-11-09.
- 2026-11-09: not available for summer 2027 internships; the research assistantship likely runs through the summer. The status strip says "Graduate research assistant at LSU" instead, with no date. Degree focus is written "communications and signal processing" everywhere (LSU ECE's graduate area name).
- 2026-11-06: land agent work since 2020, for Harold J. Anderson Inc., Lemoine Landman Services and Petro Land Ventures Inc. (résumé).
- 2026-11-06: the Tiger Excellence Scholars Award and the Tiger Alumni Legacy Scholarship, all four years (résumé).
- 2026-11-06: the LED visualizer was built in 2025, as a Christmas 2025 gift; its repo came later.
- 2026-11-06: Landspace started in 2025, as the site has always said; its repo came later (first commit 2026-04-14), so the repo date is not the start date. Ave: "it probably was 2025". Worth a firm month if one turns up.
- 2026-11-06: Nicholas Domke is a senior in mechanical engineering at LSU.
- 2026-11-06: none of the four client sites were paid work.
- 2026-11-06: the acoustic pool alarm is Ave's own project; Because of ADAM is the reason it exists, not a partner.
- 2026-11-06: Integer's thruster characterization sentence may stay (no numbers).
- 2026-11-06: keep as written: "Because of ADAM" (short form) on the résumé, "Grace Mae Alterations", the PLV Abstract Builder "AI reading step" line, and "quoted up front" on Services.
