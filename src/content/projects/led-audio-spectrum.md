---
title: 16×16 LED Audio Spectrum Visualizer
short: LED spectrum
type: engineering
tags: [engineering]
featured: false
order: 10
period: { start: "2025", end: "2025" }
status: complete
summary: ESP32 firmware that turns a microphone into a 16-band spectrum on a 256-LED matrix, tuned by ear until quiet music across the room still reads.
outcome: Reads quiet music from across the room, fades to a glow in silence, and runs the same logic in a browser demo on this page.
role: Solo. Hardware, firmware and tuning.
keywords: ["ESP32", "FFT", "music", "audio", "LEDs", "FastLED", "microphone", "firmware"]
stack: [C++, ESP32, FastLED, arduinoFFT, WS2812B]
links:
  repo: https://github.com/avemath/led-audio-spectrum
gallery:
  - video: /media/led-spectrum.mp4
    poster: ../../assets/projects/led-audio-spectrum/matrix-poster.jpg
    captions: /media/led-spectrum.vtt
    alt: Video of a 16 by 16 LED matrix on a desk showing a live audio spectrum. Columns of light rise and fall, red at the bottom through yellow and green to blue peaks at the top.
    caption: The matrix running on the bench. Each column is one frequency band, red at the base and blue at the peak.
  - src: ../../assets/projects/led-audio-spectrum/breadboard.jpg
    alt: An ESP32 development board on a blue soldering mat, with jumper wires running to a microphone module held in a helping-hands clip and to the back of the LED matrix panel.
    caption: First wiring on the bench. The ESP32, the microphone module in a clip, and the back of the matrix.
  - src: ../../assets/projects/led-audio-spectrum/mic-module.jpg
    alt: A small purple microphone breakout board held between two fingers, labeled adjustable gain, with three wires soldered to its output, ground and power pads. A lit LED strip glows in the background.
    caption: The microphone module with its three leads soldered on.
demo: spectrum
---

## Context

I wanted a spectrum display that looks good in a real room: music from across the room, people talking, a fan running, long stretches of quiet. I built it to handle all of that: I wired the hardware, wrote the firmware, and tuned it by listening.

## Approach

**Sample, window, transform.** The ESP32 grabs 128 samples at 10 kHz from an analog microphone, removes the DC offset, applies a Hamming window and runs an FFT. Each bin is about 78 Hz wide.

**Bands that match how we hear.** The 16 columns are built from roughly logarithmic groups of bins covering about 156 Hz to 4 kHz, so bass doesn't get one column while the treble gets twelve. A noise gate drops the electrical hiss.

**Automatic gain that rises fast and falls slow.** The display's ceiling jumps up quickly when something loud hits and drifts down slowly afterward. That keeps a kick drum from blowing out the screen and keeps quiet passages visible.

**Know when the room is quiet.** An adaptive baseline learns the room's noise floor, but only while it's quiet, so music can't drag the baseline up and hide itself. It learns fast for the first few seconds after boot, then slowly. Switching modes takes 4 loud frames to enter the spectrum and 8 quiet frames to leave it, so the display never flickers between modes.

**Something to look at in silence.** When it's quiet the matrix fades into a slow radial breathing glow instead of going dark. Peak dots hold for a moment and then fall, which is what makes a spectrum feel alive.

**Tuned by experiment.** The code keeps the history of its own tuning in comments: sensitivity raised from 2.6 to 4.5 to pick up distant music, the AGC decay slowed from 0.03 to 0.008 for more range, the noise gate raised from 6 to 20 to filter electrical noise.

## Outcome

It runs on its own and handles the cases I built it for: quiet music, distant sources and long silences. Try the browser version on this page. It runs the same band edges, gain and silence logic as the firmware.

## What I'd do next

Move sampling from a busy-wait loop to the ESP32's I2S peripheral for steadier timing. I'd also fix the thresholds so the exit level stays below the enter level at every noise level. In a quiet room the floor values already do that (enter above 25, exit below 18), but once the baseline climbs past about 13 the multipliers flip them, and the frame debounce ends up doing all the work.
