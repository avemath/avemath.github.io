---
title: V2V Collision Warning over OFDM
short: V2V over OFDM
type: engineering
tags: [engineering, research]
featured: false
order: 9
period: { start: "2026-01", end: "2026-05" }
status: complete
summary: Two cars' safety messages sent through an 802.11p-style OFDM radio link I built in MATLAB and ran over real software-defined radios, ending in a time-to-collision brake warning.
outcome: Went past a research assignment to a working radio link on hardware.
role: Co-author with Jason Phan. Final project for EE 4003, Communications Engineering Design.
team: Jason Phan
seoDescription: "An 802.11p-style OFDM link built in MATLAB and run over two ADALM-PLUTO radios, carrying two cars' safety messages to a time-to-collision brake warning."
keywords: ["radio", "SDR", "software-defined radio", "wireless", "802.11p", "cars", "vehicles", "MATLAB", "Viterbi", "Costas loop"]
stack: [MATLAB, Communications Toolbox, ADALM-PLUTO SDR, OFDM, Viterbi decoding]
links:
  repo: https://github.com/avemath/v2v-bsm-ofdm
demo: ofdm
---

## Context

Cars that talk to each other can warn a driver before a crash they can't see yet. The messages they send are Basic Safety Messages: who I am, how fast I'm going, and where I am, broadcast many times a second over IEEE 802.11p.

The assignment for our communications design final was a research report on vehicle-to-vehicle networks. We wrote that, and then I wanted to see the link work on real radios, so I built one.

## My role

Jason and I wrote the report together. I built the MATLAB transmitter and receiver and ran it on two ADALM-PLUTO software-defined radios, starting from the synchronization chain we developed in the course labs.

## Approach

**Pack the message like the standard.** Each vehicle's message is 10 bytes of scaled integers, most significant bit first: ID, velocity, acceleration and position, in the style of SAE J2735. It's protected with the same rate-1/2, K=7 convolutional code 802.11 uses.

**An 802.11p-style payload.** A 64-subcarrier OFDM symbol at 10 MHz with a 16-sample cyclic prefix, 48 data subcarriers, 4 pilots and a null at DC. The coded message fills four BPSK OFDM symbols.

**A sync front end you can debug.** Before the OFDM data, each packet carries a root-raised-cosine preamble for timing and a training sequence for phase. The receiver works through it one stage at a time:

1. Cross-correlate to find packets, and predict where the next ones should be so a missed peak can still be tried.
2. Sweep the sample offset to find the best timing.
3. Estimate carrier frequency offset from the phase step between preamble symbols, and remove it.
4. Fit a line to the leftover phase on the training sequence, and fix the polarity.
5. Track what's left with a decision-directed Costas loop.
6. Estimate the channel on each subcarrier from an OFDM preamble and equalize with MMSE, using a noise estimate from just before the packet.
7. Viterbi decode, and assign each packet to a vehicle by whichever reference gives fewer bit errors.

Every stage saves its own figure (correlation peaks, constellations before and after each correction, the channel per subcarrier, the resource grid), so when something breaks you can see exactly where.

**Work around the hardware.** Real V2V runs at 5.9 GHz, but the Pluto's AD9363 radio can't reach that, so the link runs at 2.9 GHz. For testing without radios, the same chain runs over a simulated Rician fading channel with three paths and 500 Hz of Doppler.

**End at a decision.** With both messages decoded, the receiver computes the gap, the closing speed and the time to collision. In the built-in scenario, a car at 30 m/s is 20 m behind one doing 25 m/s, which gives 4 seconds to impact and triggers the brake warning.

## Outcome

The assignment asked for research. We turned in that plus a working physical layer on real radios, with every stage of the receiver visible and checkable.

## What I'd do next

Append tail bits so the Viterbi decoder's terminated mode matches the encoder, move from BPSK to QPSK on the data subcarriers, and record bit error rate against SNR over the air instead of only in simulation.
