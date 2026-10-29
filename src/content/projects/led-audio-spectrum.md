---
title: 16×16 LED Audio Spectrum Visualizer
short: LED spectrum
type: engineering
tags: [engineering]
featured: false
order: 6
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

I built two of them, one for each of my sisters. Each one scrolls that sister's name across the matrix when it powers up, then runs the same spectrum firmware.

## Approach

**Three parts and one supply.** A 5 V, 10 A supply feeds the LED matrix directly, since 256 LEDs can pull up to about 5 A depending on brightness. The ESP32 runs on USB, drives the matrix data line from GPIO 5, and powers the microphone from its 3.3 V pin. All the grounds are tied together, so the data signal and the supply share one reference.

<figure class="wiring">
  <div class="wiring__frame">
    <svg viewBox="0 0 360 612" role="img" aria-labelledby="wiring-title wiring-desc">
      <title id="wiring-title">Wiring diagram for the LED spectrum visualizer</title>
      <desc id="wiring-desc">A 5 volt, 10 amp power supply connects its +5 V terminal to the LED matrix VCC and its ground to the matrix ground and to an ESP32 ground, so all grounds are common. ESP32 GPIO 5 drives the matrix data input. The ESP32 is powered over USB. A MAX4466 microphone takes VCC from the ESP32 3.3 V pin, ground from an ESP32 ground pin, and sends its output to ESP32 GPIO 34. Two parts are drawn dashed as recommended but not in the first build: a 300 to 500 ohm resistor in series on the data line close to the matrix input, and a 1000 microfarad capacitor across the matrix 5 V and ground. A note says the ESP32 VIN pin can take 5 V, but it should never be powered from USB and VIN at the same time.</desc>
      <rect class="wiring__box" x="16" y="16" width="328" height="56" rx="8" />
      <text class="wiring__t" x="28" y="40">Power supply</text>
      <text class="wiring__s" x="28" y="58">5 V, 10 A (ALITOVE)</text>
      <text class="wiring__pin" x="236" y="64" text-anchor="middle">+5 V</text>
      <text class="wiring__pin" x="320" y="64" text-anchor="middle">GND</text>
      <rect class="wiring__box" x="136" y="140" width="208" height="104" rx="8" />
      <text class="wiring__pin" x="236" y="156" text-anchor="middle">VCC</text>
      <text class="wiring__pin" x="320" y="156" text-anchor="middle">GND</text>
      <text class="wiring__t" x="148" y="186">LED matrix</text>
      <text class="wiring__s" x="148" y="204">WS2812B 16×16, 256 LEDs</text>
      <text class="wiring__pin" x="176" y="236" text-anchor="middle">DIN</text>
      <g class="wiring__leds">
        <circle cx="216" cy="232" r="2.2" /><circle cx="224" cy="232" r="2.2" /><circle cx="232" cy="232" r="2.2" /><circle cx="240" cy="232" r="2.2" /><circle cx="248" cy="232" r="2.2" /><circle cx="256" cy="232" r="2.2" /><circle cx="264" cy="232" r="2.2" /><circle cx="272" cy="232" r="2.2" /><circle cx="280" cy="232" r="2.2" /><circle cx="288" cy="232" r="2.2" /><circle cx="296" cy="232" r="2.2" /><circle cx="304" cy="232" r="2.2" /><circle cx="312" cy="232" r="2.2" /><circle cx="320" cy="232" r="2.2" /><circle cx="328" cy="232" r="2.2" /><circle cx="336" cy="232" r="2.2" />
      </g>
      <path class="wiring__w wiring__w--5v" d="M236 72V140" />
      <path class="wiring__w wiring__w--gnd" d="M320 72V140M320 88H352V342H216" />
      <circle class="wiring__dot" cx="320" cy="88" r="3" />
      <text class="wiring__note" x="284" y="336" text-anchor="middle">common ground</text>
      <path class="wiring__rec" d="M236 114H274M274 104V124M282 104V124M282 114H320" />
      <circle class="wiring__rec-dot" cx="236" cy="114" r="2.5" />
      <circle class="wiring__rec-dot" cx="320" cy="114" r="2.5" />
      <text class="wiring__note" x="228" y="104" text-anchor="end">1000 µF capacitor</text>
      <text class="wiring__note wiring__note--muted" x="228" y="118" text-anchor="end">recommended, not in</text>
      <text class="wiring__note wiring__note--muted" x="228" y="132" text-anchor="end">the first build</text>
      <path class="wiring__w wiring__w--sig" d="M176 312V250" />
      <path class="wiring__arrow wiring__arrow--sig" d="M176 245l-4.5 8h9z" />
      <rect class="wiring__rec" x="170" y="256" width="12" height="28" rx="1.5" />
      <text class="wiring__note" x="162" y="264" text-anchor="end">300 to 500 Ω resistor</text>
      <text class="wiring__note wiring__note--muted" x="162" y="278" text-anchor="end">recommended, not in</text>
      <text class="wiring__note wiring__note--muted" x="162" y="292" text-anchor="end">the first build</text>
      <rect class="wiring__box" x="16" y="312" width="200" height="108" rx="8" />
      <text class="wiring__pin" x="176" y="328" text-anchor="middle">GPIO 5</text>
      <text class="wiring__pin" x="208" y="346" text-anchor="end">GND</text>
      <text class="wiring__t" x="28" y="362">ESP32 dev board</text>
      <text class="wiring__s" x="28" y="380">HiLetgo ESP-WROOM-32</text>
      <text class="wiring__pin" x="208" y="396" text-anchor="end">USB</text>
      <text class="wiring__pin" x="48" y="412" text-anchor="middle">3.3 V</text>
      <text class="wiring__pin" x="112" y="412" text-anchor="middle">GND</text>
      <text class="wiring__pin" x="176" y="412" text-anchor="middle">GPIO 34</text>
      <path class="wiring__w wiring__w--usb" d="M216 392H256" />
      <rect class="wiring__box" x="256" y="378" width="88" height="28" rx="6" />
      <text class="wiring__pin" x="300" y="396" text-anchor="middle">USB power</text>
      <text class="wiring__note" x="228" y="428">VIN can take 5 V,</text>
      <text class="wiring__note" x="228" y="442">but never power it</text>
      <text class="wiring__note" x="228" y="456">from USB and VIN</text>
      <text class="wiring__note" x="228" y="470">at the same time.</text>
      <path class="wiring__w wiring__w--3v" d="M48 420V476" />
      <path class="wiring__w wiring__w--gnd" d="M112 420V476" />
      <path class="wiring__w wiring__w--sig" d="M176 476V426" />
      <path class="wiring__arrow wiring__arrow--sig" d="M176 421l-4.5 8h9z" />
      <rect class="wiring__box" x="16" y="476" width="200" height="68" rx="8" />
      <text class="wiring__pin" x="48" y="492" text-anchor="middle">VCC</text>
      <text class="wiring__pin" x="112" y="492" text-anchor="middle">GND</text>
      <text class="wiring__pin" x="176" y="492" text-anchor="middle">OUT</text>
      <text class="wiring__t" x="28" y="518">Microphone</text>
      <text class="wiring__s" x="28" y="535">MAX4466 breakout</text>
      <g class="wiring__legend">
        <path class="wiring__w wiring__w--5v" d="M16 572H36" /><text class="wiring__note" x="42" y="576">5 V</text>
        <path class="wiring__w wiring__w--3v" d="M84 572H104" /><text class="wiring__note" x="110" y="576">3.3 V</text>
        <path class="wiring__w wiring__w--gnd" d="M164 572H184" /><text class="wiring__note" x="190" y="576">Ground</text>
        <path class="wiring__w wiring__w--sig" d="M252 572H272" /><text class="wiring__note" x="278" y="576">Signal</text>
        <path class="wiring__rec" d="M16 596H36" /><text class="wiring__note" x="42" y="600">Dashed: recommended, not in the first build</text>
      </g>
    </svg>
  </div>
  <figcaption>The wiring as built, with the two parts I'd add next time drawn dashed.</figcaption>
</figure>

The connections, as built:

- Power supply +5 V to the matrix VCC.
- Power supply GND to the matrix GND and to an ESP32 GND. Every ground in the build is tied together.
- ESP32 GPIO 5 to the matrix DIN.
- Microphone VCC to the ESP32 3.3 V pin, microphone GND to an ESP32 GND, and microphone OUT to ESP32 GPIO 34.
- The ESP32 runs on USB power. Its VIN pin can take 5 V instead, but never power it from USB and VIN at the same time.

Recommended, not in the first build: a 300 to 500 Ω resistor in series on the data line, close to the matrix DIN, and a 1000 µF capacitor across the matrix 5 V and GND.

**Sample, window, transform.** The ESP32 grabs 128 samples at 10 kHz from an analog microphone, removes the DC offset, applies a Hamming window and runs an FFT. Each bin is about 78 Hz wide.

**Bands that match how we hear.** The 16 columns are built from roughly logarithmic groups of bins covering about 156 Hz to 4 kHz, so bass doesn't get one column while the treble gets twelve. A noise gate drops the electrical hiss.

**Automatic gain that rises fast and falls slow.** The display's ceiling jumps up quickly when something loud hits and drifts down slowly afterward. That keeps a kick drum from blowing out the screen and keeps quiet passages visible.

**Know when the room is quiet.** An adaptive baseline learns the room's noise floor, but only while it's quiet, so music can't drag the baseline up and hide itself. It learns fast for the first 2.5 seconds after the name scroll ends, then slowly. Switching modes takes 4 loud frames to enter the spectrum and 8 quiet frames to leave it, so the display never flickers between modes.

**Something to look at in silence.** When it's quiet the matrix fades into a slow radial breathing glow instead of going dark. Peak dots hold for a moment and then fall, which is what makes a spectrum feel alive.

**Tuned by experiment.** The code keeps the history of its own tuning in comments: sensitivity raised from 2.6 to 4.5 to pick up distant music, the AGC decay slowed from 0.03 to 0.008 for more range, the noise gate raised from 6 to 20 to filter electrical noise, since the first build has no capacitor across the matrix power.

## Outcome

It runs on its own and handles the cases I built it for: quiet music, distant sources and long silences. Try the browser version on this page. It runs the same band edges, gain and silence logic as the firmware.

## What I'd do next

Move sampling from a busy-wait loop to the ESP32's I2S peripheral for steadier timing. I'd also fix the thresholds so the exit level stays below the enter level at every noise level. In a quiet room the floor values already do that (enter above 25, exit below 18), but once the baseline climbs past about 13 the multipliers flip them, and the frame debounce ends up doing all the work.
