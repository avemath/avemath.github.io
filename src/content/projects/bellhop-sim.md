---
title: "BELLHOP Underwater Acoustic Simulator"
short: "bellhopSim"
type: engineering
tags: [engineering, research]
order: 12
period: { start: "2026-05" }
status: complete
summary: Jupyter notebooks that drive the BELLHOP ray model from Python, to show how sound bends, fades and echoes underwater and what that does to a BPSK link.
outcome: With no equalizer, a BPSK link through the BELLHOP channel got about 3 bits in 10 wrong even at 20 dB SNR. The echoes caused the errors, not the noise.
role: Solo. Code, notebooks and figures.
keywords: ["sonar", "underwater", "ocean", "acoustics", "ray tracing", "SOFAR", "multipath", "transmission loss", "Python", "Jupyter"]
stack: [Python, arlpy, BELLHOP (Fortran), Jupyter, ipywidgets, NumPy, SciPy, Matplotlib]
links:
  repo: https://github.com/avemath/bellhopSim
gallery:
  - src: ../../assets/projects/bellhop-sim/ssp_and_rays.png
    alt: Two plots side by side. On the left, sound speed against depth curves to a minimum of 1500 meters per second near 1300 meters deep. On the right, 50 colored rays leave a source at 1300 meters and arc up and down across 100 kilometers of ocean, some bending back before the surface and others bouncing off the sand bottom at 5000 meters.
    caption: The Munk deep-water profile and 50 rays traced from the slowest depth, where sound gets trapped.
  - src: ../../assets/projects/bellhop-sim/tl_map.png
    alt: A color map of transmission loss over 100 kilometers of range and 5000 meters of depth. Dark blue low-loss regions fan out from the source and form arching bands, and the loss rises toward green at long range.
    caption: Transmission loss from the same source. The low-loss bands follow the ray paths.
  - src: ../../assets/projects/bellhop-sim/arrivals.png
    alt: A stem plot of 35 sound arrivals at a receiver 65 kilometers away, by delay and amplitude. The two strongest arrive first and never touch the surface or bottom, then a long tail of weaker paths that bounced off the surface or bottom follows. An arrow marks the 7 paths within 20 dB of the strongest arrival, spread over 2128 milliseconds.
    caption: One ping at 65 km arrives as 35 echoes. The 7 within 20 dB of the strongest arrival spread over 2.1 seconds.
  - src: ../../assets/projects/bellhop-sim/ber_vs_snr.png
    alt: Bit error rate against SNR per sample, measured on the total received power, on a log scale. The theoretical BPSK curve for plain noise falls steeply below one in ten thousand by 10 dB, while the simulated link through the BELLHOP channel levels off near 0.3 from minus 2 to 20 dB.
    caption: BPSK through the BELLHOP channel against plain noise, by SNR per sample on the total received power. With no equalizer, more power doesn't help.
  - src: ../../assets/projects/bellhop-sim/frequency_sweep.png
    alt: Transmission loss against range at 100 meters depth for five frequencies from 100 Hz to 5000 Hz. All five curves start together, then spread apart with range, and the 5000 Hz curve ends far below the others at 100 kilometers.
    caption: The same path at five frequencies. Higher frequencies lose much more over distance.
metrics:
  - { label: "Arrivals at 65 km", value: "35" }
  - { label: "Delay spread within 20 dB of the strongest arrival", value: "2.1 s" }
  - { label: "BER at 20 dB SNR per sample, no equalizer", value: "0.30" }
  - { label: "Extra loss at 5 kHz vs 100 Hz, 100 km", value: "39 dB" }
---

## Context

BELLHOP is the standard ray-tracing model for underwater sound. I wanted to see how sound actually travels underwater and what that does to a communication link, so I built this on my own, starting from BELLHOP's public test cases.

## Approach

**Two notebooks, one set of modules.** The main notebook has seven sections. It builds a sound speed profile from six presets (Munk deep ocean, shallow water, Arctic and a surface duct among them), traces rays, maps transmission loss over range and depth, lists the multipath arrivals at a receiver with their delay spread and coherence bandwidth, compares up to four saved scenarios, and runs the sonar equation to turn loss into SNR. The second notebook animates the rays as the source moves deeper, sweeps frequency from 100 Hz to 5 kHz, adds a continental shelf that slopes from 200 m to 3500 m, and runs the comms simulator. The controls are ipywidgets sliders and dropdowns, and the notebooks and the figure export share the same Python modules.

**Make a Windows program read Linux paths.** I run Jupyter in WSL, but BELLHOP is a Windows .exe, and it can't open a Linux path like `/tmp/...`. One `configure()` call at the top of each notebook puts BELLHOP on the `PATH`, points the temp folder somewhere Windows can see, and patches arlpy's call to `bellhop.exe` so every path goes through `wslpath -w` first.

**Send bits through the ocean.** The comms simulator turns BELLHOP's arrivals into a complex impulse response, sends BPSK through it at complex baseband, adds noise and decides each bit by its sign. The receiver locks to the strongest path's delay and phase and has no equalizer. The same bits also go through plain noise, so the two error rates can be compared directly.

**Check the physics.** The repo's README lists three bugs I found and fixed while making the figures (range units, bottom density units and the BER model), each with a regression test.

## What it showed

**Sound gets trapped at the slowest depth.** In the Munk profile, sound speed runs from 1500.0 m/s near 1,307 m deep up to 1551.9 m/s. Of the 50 rays launched within 20° of horizontal from that depth, the flatter ones bend back toward it from above and below and never touch the surface or bottom. The steeper ones bounce off both.

**Loss levels off.** At the source depth, transmission loss is 76.3 dB at 10 km and 85.7 dB at 65 km, then only 86.0 dB at 100 km.

**One ping becomes many.** A receiver 65 km out hears 35 separate arrivals. The strongest is about 3.1 times the next one in amplitude, and the 7 paths within 20 dB of the strongest arrival come in over 2,128 ms.

These spreads are long because this is an idealized model. The surface is perfectly smooth and the flat sand bottom reflects almost everything at shallow angles, so echoes survive much longer than they do at sea. That's why they run longer than the typical measured values in the repo's README.

**Echoes, not noise, cause the errors.** In 1000 m of water at 15 km and 3.5 kHz, the 18 paths within 20 dB of the strongest arrival spread over 730 ms. At 2,500 symbols a second, each bit overlaps about 1,800 others. I measure SNR per sample, on the total received power. With no equalizer, the bit error rate is 0.37 at -2 dB and levels off around 0.30 all the way to 20 dB. That's the expected result: turning up the power makes the echoes louder too, so the interference never goes away. Through plain noise, the same simulation made no errors in 100,000 bits from 10 dB up.

**High frequencies die fast.** With the source and receiver at 100 m, the loss at 100 km is 96.8 dB at 100 Hz and 136.0 dB at 5 kHz, a 39 dB difference. At 10 km the gap is only 5.6 dB.

## The connection to my V2V radio

My [V2V radio link](/work/v2v-bsm-ofdm/) fights the same problems: multipath, delay spread, and a receiver that has to find the start of each packet and undo the channel. That's why it has a preamble for timing and phase and an equalizer on every subcarrier. Its cyclic prefix covers 1.6 µs of echoes. Underwater, the paths within 20 dB of the strongest arrival spread over 730 ms in the comms case, so a receiver would have to handle echoes hundreds of thousands of times longer. The BER curve that levels off at 0.30 shows what happens without equalization.
