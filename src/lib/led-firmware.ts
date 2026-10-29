// The 16x16 LED spectrum firmware (github.com/avemath/led-audio-spectrum), ported to the browser.
// Shared by the case study's demo (SpectrumDemo) and the live spotlight on the home page.
// Constants, the loop() signal chain, the idle glow and the boot scroll follow the ESP32 source.

// ---- Firmware constants, copied from the ESP32 source ----
export const N = 128;
export const FS = 10000;
export const W = 16;
export const H = 16;
const BAND_EDGES = [2, 3, 4, 5, 6, 7, 9, 11, 14, 17, 20, 24, 28, 33, 38, 44, 52];
const SENSITIVITY_GAIN = 4.5;
const SMOOTHING = 0.7;
const FFT_NOISE_GATE = 20;
const AGC_RISE = 0.25;
const AGC_FALL = 0.008;
const LEVELMAX_FLOOR = 120;
const PEAK_HOLD_FRAMES = 5;
const PEAK_FALL_RATE = 3;
const SILENT_PEAK_FALL_RATE = 5;
const AMP_DECAY = 0.9;
const BASELINE_ALPHA_FAST = 0.02;
const BASELINE_ALPHA_SLOW = 0.0015;
export const WARMUP_MS = 2500;
const ENTER_MULT = 1.25;
const ENTER_ADD = 5;
const EXIT_MULT = 1.5;
const EXIT_ADD = 5;
export const ENTER_FRAMES = 4;
export const EXIT_FRAMES = 8;
const IDLE_MIN = 18;
const IDLE_MAX = 90;
const IDLE_PERIOD = 2600;
export const FRAME_MS = 28; // about the firmware's loop time (12.8 ms sampling + 10 ms delay + FFT and render)

// ---- Boot scroll: the firmware's 5x7 font, scrollMessage() and drawLetter() ----
const FONT: Record<string, number[]> = {
  G: [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01110],
  R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  C: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  M: [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
  L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  I: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b11111],
};
/** The first word of the board's boot message. */
export const BOOT_MESSAGE = 'LEA';
const LETTER_WIDTH = 6;
export const SCROLL_LOOPS = 3;
export const SCROLL_STEP_MS = 80; // delay(80) per column
export const SCROLL_END_MS = 150; // the blank pause before setup() moves on
/** Columns per pass: from offset MATRIX_WIDTH down to just past -TOTAL_WIDTH. */
export const scrollSteps = (message = BOOT_MESSAGE) => W + message.length * LETTER_WIDTH;

/** Calls `set(x, y, hue)` for every lit LED of scroll frame `step` (0 based, across all loops). */
export function scrollFrame(step: number, set: (x: number, y: number, hue: number) => void, message = BOOT_MESSAGE) {
  const per = scrollSteps(message);
  const loop = Math.floor(step / per);
  let xPos = W - (step % per);
  for (let i = 0; i < message.length; i++) {
    const glyph = FONT[message[i]];
    if (glyph) {
      const hue = (i * 30 + loop * 20) % 256;
      for (let row = 0; row < 7; row++)
        for (let col = 0; col < 5; col++) {
          const x = xPos + col;
          const y = 4 + row;
          if (glyph[row] & (1 << (4 - col)) && x >= 0 && x < W) set(x, y, hue);
        }
    }
    xPos += LETTER_WIDTH;
  }
}

// ---- Radix-2 FFT, in place, magnitudes left in re ----
const bitrev = new Uint8Array(N);
for (let i = 0, bits = Math.log2(N); i < N; i++) {
  let x = i, y = 0;
  for (let b = 0; b < bits; b++) (y = (y << 1) | (x & 1)), (x >>= 1);
  bitrev[i] = y;
}
const hamming = Float64Array.from({ length: N }, (_, i) => 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (N - 1)));

function fft(re: Float64Array, im: Float64Array) {
  for (let i = 0; i < N; i++) {
    const j = bitrev[i];
    if (j > i) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let size = 2; size <= N; size <<= 1) {
    const half = size >> 1;
    const step = (-2 * Math.PI) / size;
    for (let start = 0; start < N; start += size) {
      for (let k = 0; k < half; k++) {
        const wr = Math.cos(step * k), wi = Math.sin(step * k);
        const a = start + k, b = a + half;
        const tr = wr * re[b] - wi * im[b];
        const ti = wr * im[b] + wi * re[b];
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
  for (let i = 0; i < N; i++) re[i] = Math.hypot(re[i], im[i]);
}

// ---- Signal sources, in 12-bit ADC counts around a mid-rail offset ----

/**
 * A generated track: kick, plucked bass, a moving arpeggio, a soft pad and high-passed hats.
 * Each loop opens with 3 s of room tone, like the quiet room the board boots into, so the
 * detector can learn the noise floor during warmup and you can watch it switch modes.
 */
export function createDemoTrack() {
  let noiseSeed = 1;
  const noise = () => ((noiseSeed = (noiseSeed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const LOOP = 13000;
  const QUIET = 3000;
  const roots = [98, 98, 116.5, 87.3];
  const arp = [1, 1.5, 2, 3, 4, 6, 8, 12, 16, 12, 8, 6, 4, 3, 2, 1.5];
  let lastNoise = 0;
  return function sample(tMs: number) {
    const t = tMs / 1000;
    const pos = tMs % LOOP;
    let v = noise() * 9; // electrical noise floor
    if (pos >= QUIET) {
      const fade = Math.min(1, (pos - QUIET) / 300, (LOOP - pos) / 700);
      const beat = (t * 2) % 1; // 120 bpm
      const eighth = (t * 4) % 1;
      const bar = Math.floor((t * 2) / 4) % roots.length;
      const f = roots[bar];
      const kick = Math.exp(-beat * 16) * Math.sin(2 * Math.PI * (60 + 110 * Math.exp(-beat * 24)) * t) * 380;
      const bass = Math.exp(-eighth * 5) * (Math.sin(2 * Math.PI * f * 2 * t) * 90 + Math.sin(2 * Math.PI * f * 4 * t) * 35);
      const step = Math.floor(t * 8) % arp.length;
      const arpF = f * 4 * arp[step];
      const lead = Math.exp(-((t * 8) % 1) * 5) * Math.sin(2 * Math.PI * arpF * t) * 120;
      const pad =
        (Math.sin(2 * Math.PI * f * 6 * t) + Math.sin(2 * Math.PI * f * 7.5 * t) + Math.sin(2 * Math.PI * f * 9 * t)) *
        22 *
        (0.5 + 0.5 * Math.sin(2 * Math.PI * 0.25 * t));
      const n = noise();
      const hiss = n - lastNoise; // first difference: a cheap high-pass
      lastNoise = n;
      const hat = hiss * Math.exp(-((t * 4 + 0.5) % 1) * 28) * 110;
      v += (kick + bass + lead + pad + hat) * fade;
    }
    return 1850 + v;
  };
}

/** Fills `re` with the newest microphone audio, resampled to 128 samples at 10 kHz. */
export function fillFromMic(re: Float64Array, im: Float64Array, timeData: Float32Array, sampleRate: number) {
  const ratio = sampleRate / FS;
  const startIdx = timeData.length - 1 - (N - 1) * ratio;
  for (let i = 0; i < N; i++) {
    const x = startIdx + i * ratio;
    const i0 = Math.floor(x);
    const frac = x - i0;
    const s = timeData[i0] * (1 - frac) + timeData[Math.min(timeData.length - 1, i0 + 1)] * frac;
    re[i] = 1850 + s * 2048 * 2.5;
    im[i] = 0;
  }
}

// ---- The firmware's state and one pass of loop() ----
export function createSpectrum() {
  const s = {
    re: new Float64Array(N),
    im: new Float64Array(N),
    smoothed: new Float64Array(16),
    bandValues: new Int32Array(16),
    peakValues: new Int32Array(16),
    peakHold: new Int32Array(16),
    levelMax: 650,
    ampSmoothed: 0,
    noiseBaseline: 0,
    enterThreshold: 25,
    exitThreshold: 18,
    enterCount: 0,
    exitCount: 0,
    spectrumMode: false,
    idleHue: 150,
    lastHueStep: 0,
    startClock: 0, // virtual ms when the detector last reset
    clock: 0, // virtual milliseconds of signal time
  };

  /** Runs one loop() pass on the samples already in `s.re`. */
  function step() {
    const { re, im } = s;
    let mean = 0;
    for (let i = 0; i < N; i++) mean += re[i];
    mean /= N;
    let amp = 0;
    for (let i = 0; i < N; i++) {
      re[i] -= mean;
      amp += Math.abs(re[i]);
    }
    amp /= N;
    s.ampSmoothed = s.ampSmoothed * AMP_DECAY + amp * (1 - AMP_DECAY);

    const warmingUp = s.clock - s.startClock < WARMUP_MS;
    if (s.noiseBaseline < 0.1) s.noiseBaseline = s.ampSmoothed;
    s.enterThreshold = Math.max(25, s.noiseBaseline * ENTER_MULT + ENTER_ADD);
    s.exitThreshold = Math.max(18, s.noiseBaseline * EXIT_MULT + EXIT_ADD);
    if (warmingUp || s.ampSmoothed < s.exitThreshold) {
      const a = warmingUp ? BASELINE_ALPHA_FAST : BASELINE_ALPHA_SLOW;
      s.noiseBaseline = s.noiseBaseline * (1 - a) + s.ampSmoothed * a;
    }

    if (!s.spectrumMode) {
      if (s.ampSmoothed > s.enterThreshold) {
        if (++s.enterCount >= ENTER_FRAMES) (s.spectrumMode = true), (s.enterCount = 0), (s.exitCount = 0);
      } else s.enterCount = 0;
    } else if (s.ampSmoothed < s.exitThreshold) {
      if (++s.exitCount >= EXIT_FRAMES) (s.spectrumMode = false), (s.exitCount = 0), (s.enterCount = 0);
    } else s.exitCount = 0;

    for (let i = 0; i < N; i++) re[i] *= hamming[i];
    fft(re, im);
    mapBands(!s.spectrumMode);
  }

  function mapBands(silent: boolean) {
    const { re, smoothed, bandValues, peakValues, peakHold } = s;
    if (silent) {
      for (let i = 0; i < 16; i++) {
        smoothed[i] = 0;
        bandValues[i] = 0;
        peakValues[i] = Math.max(0, peakValues[i] - SILENT_PEAK_FALL_RATE);
        peakHold[i] = 0;
      }
      s.levelMax = Math.max(s.levelMax, LEVELMAX_FLOOR);
      return;
    }
    const raw = new Float64Array(16);
    let peak = 0;
    for (let b = 0; b < 16; b++) {
      let sum = 0, cnt = 0;
      for (let j = BAND_EDGES[b]; j < BAND_EDGES[b + 1]; j++) (sum += re[j]), cnt++;
      let val = cnt ? sum / cnt : 0;
      if (val < FFT_NOISE_GATE) val = 0;
      raw[b] = val;
      if (val > peak) peak = val;
    }
    if (peak > s.levelMax) s.levelMax += (peak - s.levelMax) * AGC_RISE;
    else s.levelMax = Math.max(LEVELMAX_FLOOR, s.levelMax * (1 - AGC_FALL));

    for (let b = 0; b < 16; b++) {
      const h = Math.min(H, Math.max(0, (raw[b] / s.levelMax) * H * SENSITIVITY_GAIN));
      smoothed[b] = smoothed[b] * (1 - SMOOTHING) + h * SMOOTHING;
      bandValues[b] = Math.min(H, Math.max(0, Math.floor(smoothed[b] + 0.5)));
      if (bandValues[b] > peakValues[b]) (peakValues[b] = bandValues[b]), (peakHold[b] = PEAK_HOLD_FRAMES);
      else if (peakHold[b] > 0) peakHold[b]--;
      else peakValues[b] = Math.max(0, peakValues[b] - PEAK_FALL_RATE);
    }
  }

  /** What setup() does after the scroll: restart the baseline timing and the detector. */
  function reset() {
    s.startClock = s.clock;
    s.noiseBaseline = 0;
    s.ampSmoothed = 0;
    s.spectrumMode = false;
    s.enterCount = s.exitCount = 0;
    s.levelMax = 650;
  }

  return { s, step, reset };
}

export type Spectrum = ReturnType<typeof createSpectrum>;

// ---- Drawing. FastLED's rainbow hue 0..255 maps to roughly 0..360 degrees. ----
export const hsv = (hue: number, sat: number, val: number) =>
  `hsl(${(hue / 256) * 360} ${(sat / 255) * 100}% ${Math.max(4, (val / 255) * 58)}%)`;
export const OFF = '#121826';

export function createMatrix(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  const cell = canvas.width / W;

  function led(x: number, y: number, color: string, glow = false) {
    const cxp = x * cell + cell / 2;
    const cyp = y * cell + cell / 2;
    if (glow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = cell * 0.6;
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cxp, cyp, cell * 0.36, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  const clear = () => ctx.clearRect(0, 0, canvas.width, canvas.height);

  /** Every LED off, the way the board looks before power. */
  function dark() {
    clear();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) led(x, y, OFF);
  }

  /** One frame of the boot scroll. */
  function scroll(step: number, message = BOOT_MESSAGE) {
    dark();
    scrollFrame(step, (x, y, hue) => led(x, y, hsv(hue, 255, 255), true), message);
  }

  /** displayIdleGlow() or displaySpectrum(), whichever mode the firmware is in. */
  function render(sp: Spectrum, now: number, running: boolean) {
    const s = sp.s;
    clear();
    if (!s.spectrumMode) {
      const phase = (now % IDLE_PERIOD) / IDLE_PERIOD;
      const breath = (Math.sin(phase * Math.PI * 2 - Math.PI / 2) + 1) / 2;
      const baseV = IDLE_MIN + breath * (IDLE_MAX - IDLE_MIN);
      if (now - s.lastHueStep > 40 && running) (s.idleHue = (s.idleHue + 1) % 256), (s.lastHueStep = now);
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const d2 = (x - 7) ** 2 + (y - 7) ** 2;
          const fall = 255 - (d2 / 98) * 165;
          const v = (baseV * fall) / 255;
          led(x, y, hsv((s.idleHue + (d2 >> 1)) % 256, 170, v * 2.2));
        }
    } else {
      for (let x = 0; x < W; x++) {
        for (let y = 0; y < H; y++) {
          const fromBottom = H - 1 - y;
          const on = fromBottom < s.bandValues[x];
          led(x, y, on ? hsv((fromBottom / H) * 160, 255, 255) : OFF, on);
        }
        if (s.peakValues[x] > 0) led(x, H - 1 - Math.min(H - 1, s.peakValues[x]), '#ffffff', true);
      }
    }
  }

  return { dark, scroll, render };
}

/** Opens the microphone with the browser's processing off and a 4.5 kHz anti-alias filter. */
export async function openMic() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const audioCtx = new AudioContext();
  const src = audioCtx.createMediaStreamSource(stream);
  // Anti-alias before the 10 kHz resample. (The real board has no filter here; see the notes.)
  const lp = audioCtx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 4500;
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  const timeData = new Float32Array(new ArrayBuffer(analyser.fftSize * 4));
  src.connect(lp).connect(analyser);
  return {
    read(re: Float64Array, im: Float64Array) {
      analyser.getFloatTimeDomainData(timeData);
      fillFromMic(re, im, timeData, audioCtx.sampleRate);
    },
    close() {
      stream.getTracks().forEach((t) => t.stop());
      audioCtx.close();
    },
  };
}
