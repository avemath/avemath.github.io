---
title: Signals Playground
short: Signals
type: engineering
tags: [engineering, software]
featured: false
order: 10
period: { start: "2026-10" }
status: ongoing
summary: "Interactive demos of the ideas behind my comms work: frequency hopping, constellations, bit error rates, matched filters and multipath."
outcome: Five browser demos you can see and hear. The bit error curves are checked against the textbook math on every build.
role: Solo. Built to study, then cleaned up to share.
keywords: ["radio", "communications", "FH-BFSK", "frequency hopping", "JANUS", "underwater acoustics", "BER", "QAM", "PSK", "matched filter", "multipath", "Web Audio"]
stack: [TypeScript, Web Audio API, SVG, Canvas]
demo: signals
---

## Context

I learn by building. I wanted to see and hear these ideas, not just read the equations, so I started making small tools while I studied. This page collects five of them and cleans them up to share.

The first one was a standalone page for frequency-hopping BFSK, the modulation the JANUS underwater acoustic standard uses. The other four cover the basics underneath every link I've worked on: where symbols land in noise, how often bits flip, how a receiver finds a packet, and what echoes do.

## What's in it

**Frequency hopping.** A port of my FH-BFSK chip visualizer. Each chip hops to one of 13 tone pairs and sends the low or high tone of that pair. You can click a column to flip its bit, play one chip or the whole sequence slowed down (only when you press play), and switch between three pitch mappings, from an exaggerated gap that's easy to hear to the real 9.5 to 13.5 kHz tones.

**Constellations.** BPSK, QPSK, 8-PSK and 16-QAM with the average symbol energy set to 1, and a slider for E<sub>s</sub>/N<sub>0</sub>. The noise is seeded, so the cloud grows and shrinks smoothly instead of flickering, and every symbol the receiver gets wrong turns red.

**Bit errors.** Theory curves for all four schemes from 0 to 20 dB, and a simulate button that sends up to a million random bits per point through noise in your browser and plots the measured error rate on top. Building this one turned up two mistakes in my old study guide: it plotted 8-PSK with E<sub>b</sub> standing in for E<sub>s</sub> and no divide by 3, and it said 16-QAM needs about 10 dB more than BPSK. It's about 4 dB more at a BER of 1e-5. A small check script now runs with every build and fails if the formulas drift: Q(1) has to come out near 0.1587, BPSK has to reach 1e-5 near 9.6 dB, and 16-QAM has to need about 4 dB more than QPSK.

**Matched filter.** A random ±1 preamble hidden at a random spot in noise, the received signal, and the correlation output with its peak. Sliders for noise and preamble length show how a longer preamble makes the peak stand out: four times the length gives four times the peak, while the noise in the output only doubles.

**Multipath.** A stream of BPSK symbols through a two or three path channel, with sliders for each echo's delay and gain. Once an echo is a good part of a symbol late, it smears into the next one. That's why my [V2V receiver](/work/v2v-bsm-ofdm/) put a cyclic prefix in front of every OFDM symbol, and why FH-BFSK hops to a new tone pair on every chip.

## What's real and what's simplified

From the JANUS standard, as reported in two public papers:

- The band is 9440 to 13600 Hz, with a center of 11520 Hz and a bandwidth of 4160 Hz, divided into 13 tone pairs. Source: Table I of Li, Hall and Zheng, [Utilizing JANUS for Very High Frequency Underwater Acoustic Modem](https://par.nsf.gov/servlets/purl/10278930).
- 26 tones, 160 Hz apart, and a chip duration of 1/160 s, which is 6.25 ms or 160 chips per second. Source: Table 1 of Cömertpay and Bauch, [Underwater Distance Estimation Using the JANUS Communication Standard](https://pub.dega-akustik.de/DAGA_2023/data/articles/000252.pdf), which matches Table I of the first paper. (The first paper's body text says 62.5 ms, but both tables say 6.25 ms.)
- A baseline transmission starts with a fixed 32-chip preamble, whose bits come from a length-31 m-sequence plus a 0, and the hop pattern comes from Galois field arithmetic. Source: Cömertpay and Bauch.

Simplified on purpose:

- **The hop order is made up.** The real order is set by the standard. I couldn't read it from NATO's reference implementation, so the demo uses a seeded pseudo-random pattern and says so on the page.
- **Each pair is drawn as two neighboring tones**, at the centers of 26 equal slots across the band. The papers say the tones are evenly spaced but don't say which two make a pair.
- **No preamble is shown**, because I haven't confirmed the exact m-sequence.
- **Each chip carries one raw bit.** In the real waveform the bits are coded and interleaved before they become chips.
- The other four demos are textbook models: ideal timing, white Gaussian noise, and rectangular pulses for the multipath panel. The 8-PSK and 16-QAM curves are the usual Gray-coded approximations, labeled as approximations on the plot.

## What I'd add next

Swap in the standard's real hop order, tone pairs and preamble once I can read them straight from the reference implementation. After that, add the coding and interleaving step to the hopping demo, and a Doppler slider, since a moving source shifts every tone at once.
