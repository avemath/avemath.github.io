// The FH-BFSK chip math from my standalone study tool, shared by the Signals playground demo
// (src/components/demos/signals/fhbfsk.ts), the mesh playground (src/scripts/playground.ts) and the
// home page's live tile. Each chip hops to one of 13 tone pairs and sends the low tone for a 0 or
// the high tone for a 1. The mesh playground's whole link is here too: text to bits, the
// waveform, the channel (Doppler, a surface echo, noise), the detector and a spectrogram. No DOM, so
// scripts/check-comms.mjs tests the same code the page runs.
import { mulberry32, gaussian } from './comms.ts';

// JANUS band plan, from the public papers cited on the Signals page.
export const F_LOW = 9440;
export const F_HIGH = 13600;
export const PAIRS = 13;
export const DF = (F_HIGH - F_LOW) / (2 * PAIRS); // 160 Hz

export type Mode = 'exag' | 'prop' | 'true';

// Simplified tone grid: 26 equal slots across the band, tone at each slot center, and pair p
// uses tones 2p (bit 0) and 2p + 1 (bit 1). The standard's real pair layout may differ.
export const toneHz = (p: number, bit: number) => F_LOW + (2 * p + bit + 0.5) * DF;

/** The tone you hear for pair p and a bit, in one of the three pitch mappings. */
export function audioHz(mode: Mode, p: number, bit: number) {
  if (mode === 'true') return toneHz(p, bit);
  const base = 165;
  const oct = 3;
  if (mode === 'prop') return base * 2 ** ((oct * (toneHz(p, bit) - F_LOW)) / (F_HIGH - F_LOW));
  const center = base * 2 ** ((oct * (p + 0.5)) / PAIRS);
  return center * 2 ** ((bit ? 2 : -2) / 12);
}

/** A seeded hop sequence of n pairs that never stays on the same pair twice in a row. */
export function hopSequence(n: number, seed: number) {
  const rand = mulberry32(seed);
  const out: number[] = [];
  let prev = -1;
  for (let i = 0; i < n; i++) {
    let s: number;
    do s = Math.floor(rand() * PAIRS);
    while (s === prev);
    out.push((prev = s));
  }
  return out;
}

// ---- The mesh playground's link ----

/** Sample rate of every waveform here, and the JANUS chip length. */
export const FS = 48000;
/** Listening only, an eighth: the hero panel synthesizes each tone at an eighth of its frequency
 *  (three octaves lower; its chips are stretched ten times separately), and the playground plays its
 *  recording at an eighth of its speed (eight times slower, so three octaves lower). The 9.4 to
 *  13.6 kHz band comes out at about 1.2 to 1.7 kHz. The drawings and the link use the real band. */
export const LISTEN_PITCH = 1 / 8;
export const CHIP_S = 6.25e-3;
export const CHIP_N = Math.round(FS * CHIP_S); // 300 samples
/** Speed of sound in seawater, for Doppler. */
export const C_WATER = 1500;
/** The playground's hop order: the same seeded sequence as the hero's preamble. */
export const HOP_SEED = 87;

/** Text to bits, 8 per character, most significant first. Anything outside printable ASCII becomes "?". */
export function textToBits(text: string) {
  const bits: number[] = [];
  for (const ch of text) {
    let c = ch.charCodeAt(0);
    if (c < 32 || c > 126) c = 63;
    for (let k = 7; k >= 0; k--) bits.push((c >> k) & 1);
  }
  return bits;
}

/** Bits back to text, 8 per character; a byte that is not printable ASCII shows as a middle dot. */
export function bitsToText(bits: number[]) {
  let out = '';
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let c = 0;
    for (let k = 0; k < 8; k++) c = (c << 1) | bits[i + k];
    out += c >= 32 && c <= 126 ? String.fromCharCode(c) : '·';
  }
  return out;
}

/** The transmitted waveform: one 6.25 ms chip per bit, each at its hop pair's low or high tone,
 *  with a short raised-cosine edge so the hops do not click. Unit amplitude. */
export function modulate(bits: number[], seed = HOP_SEED) {
  const hops = hopSequence(bits.length, seed);
  const x = new Float32Array(bits.length * CHIP_N);
  const ramp = Math.round(FS * 0.0005);
  let phase = 0;
  bits.forEach((b, i) => {
    const w = (2 * Math.PI * toneHz(hops[i], b)) / FS;
    for (let n = 0; n < CHIP_N; n++) {
      const e = n < ramp ? 0.5 - 0.5 * Math.cos((Math.PI * n) / ramp) : n >= CHIP_N - ramp ? 0.5 - 0.5 * Math.cos((Math.PI * (CHIP_N - 1 - n)) / ramp) : 1;
      x[i * CHIP_N + n] = e * Math.sin(phase);
      phase += w;
    }
  });
  return { x, hops };
}

export interface Channel {
  /** Signal to noise ratio per sample, in dB (signal power over noise power in the full 24 kHz). */
  snrDb: number;
  /** Surface echo: delay in ms and strength (0 to 1) relative to the direct path. */
  echoMs: number;
  echoGain: number;
  /** Source speed toward the receiver, m/s (negative: moving away). */
  speed: number;
  /** Seed for the noise, so a run can be repeated. */
  seed: number;
}

/** The underwater channel: Doppler (the whole waveform squeezed or stretched by 1 + v/c), a weaker
 *  delayed copy off the surface, then white Gaussian noise at the given SNR. */
export function channel(x: Float32Array, ch: Channel) {
  const a = 1 + ch.speed / C_WATER;
  const n = x.length;
  const at = (t: number) => {
    // Linear interpolation of x at a fractional sample index.
    if (t < 0 || t >= n - 1) return 0;
    const i = Math.floor(t);
    const f = t - i;
    return x[i] * (1 - f) + x[i + 1] * f;
  };
  const d = (ch.echoMs / 1000) * FS;
  const y = new Float32Array(n);
  const rand = gaussian(mulberry32(ch.seed));
  const sigma = Math.sqrt(0.5 / 10 ** (ch.snrDb / 10));
  for (let k = 0; k < n; k++) {
    const direct = at(k * a);
    const echo = ch.echoGain > 0 ? ch.echoGain * at((k - d) * a) : 0;
    y[k] = direct + echo + sigma * rand();
  }
  return y;
}

/** Energy at one frequency over a window (the Goertzel algorithm). */
export function goertzel(y: Float32Array, from: number, len: number, hz: number) {
  const w = (2 * Math.PI * hz) / FS;
  const c = 2 * Math.cos(w);
  let s1 = 0;
  let s2 = 0;
  for (let k = from; k < from + len && k < y.length; k++) {
    const s0 = y[k] + c * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return s1 * s1 + s2 * s2 - c * s1 * s2;
}

/** The receiver: for each chip, knowing the hop pair, compare the energy at the pair's high and low
 *  tones (noncoherent BFSK). Chip timing is known (the packet is already synchronized). */
export function demodulate(y: Float32Array, nBits: number, seed = HOP_SEED) {
  const hops = hopSequence(nBits, seed);
  const bits: number[] = [];
  const margins: number[] = [];
  for (let i = 0; i < nBits; i++) {
    const e0 = goertzel(y, i * CHIP_N, CHIP_N, toneHz(hops[i], 0));
    const e1 = goertzel(y, i * CHIP_N, CHIP_N, toneHz(hops[i], 1));
    bits.push(e1 > e0 ? 1 : 0);
    margins.push((e1 - e0) / (e1 + e0 + 1e-12));
  }
  return { bits, margins };
}

/** A spectrogram of the band: magnitudes in dB, one column per `hop` samples, rows from F_LOW - 160
 *  to F_HIGH + 160 Hz (row 0 at the top is the highest frequency). */
export function spectrogram(y: Float32Array, win = 512, hop = 96) {
  const lo = F_LOW - 160;
  const hi = F_HIGH + 160;
  const binHz = FS / win;
  const b0 = Math.floor(lo / binHz);
  const b1 = Math.ceil(hi / binHz);
  const rows = b1 - b0 + 1;
  const cols = Math.max(1, Math.floor((y.length - win) / hop) + 1);
  const hann = Float32Array.from({ length: win }, (_, n) => 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (win - 1)));
  const cosT = new Float32Array(rows * win);
  const sinT = new Float32Array(rows * win);
  for (let r = 0; r < rows; r++)
    for (let n = 0; n < win; n++) {
      const w = (2 * Math.PI * (b0 + r) * n) / win;
      cosT[r * win + n] = Math.cos(w) * hann[n];
      sinT[r * win + n] = Math.sin(w) * hann[n];
    }
  const db = new Float32Array(cols * rows);
  for (let c = 0; c < cols; c++) {
    const off = c * hop;
    for (let r = 0; r < rows; r++) {
      let re = 0;
      let im = 0;
      for (let n = 0; n < win; n++) {
        const v = y[off + n];
        re += v * cosT[r * win + n];
        im += v * sinT[r * win + n];
      }
      db[c * rows + (rows - 1 - r)] = 10 * Math.log10(re * re + im * im + 1e-9);
    }
  }
  return { db, cols, rows, hop, lo, hi };
}
