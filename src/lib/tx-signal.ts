// The hero transmission. My name is sent once, as OFDM symbols: the name is drawn into a small
// raster in the browser (two lines, in the heading font), each raster row becomes one 512 point
// symbol, and each raster column is one subcarrier whose amplitude is that pixel's coverage, so
// letter edges come out smooth. A single up-chirp goes out first as the sync sweep. The hero
// computes its waterfall from this signal with an FFT; nothing is drawn from the raster directly.
// No imports, so it runs in the browser and at build time (for the still layout).

export const FS = 16000; // samples per second
export const N = 512; // FFT size and symbol body, 32 ms
export const BINS = N / 2; // 31.25 Hz per bin, 0 to 8 kHz
export const BIN_HZ = FS / N;
/** Cyclic prefix, 6 ms. Neighboring symbols crossfade inside it, and the receiver's FFT skips it. */
export const CP = 96;
export const SYMBOL = N + CP; // samples per symbol, 38 ms
export const FRAME_HZ = FS / SYMBOL; // waterfall rows per second
export const VIEW_ROWS = 160; // frames on screen, newest at the top, about 6 s

export const LINES = ['AVERY', 'MATHERNE'];
/** Subcarriers the name spans, centered in the band (about 440 Hz to 7.6 kHz). */
export const TEXT_BINS = 228;
export const FIRST_BIN = (BINS - TEXT_BINS) / 2;

// Frame layout of one transmission.
export const LEAD = 8; // quiet water before the sweep
export const CHIRP = { frames: 24, f0: 300, f1: 7500 };
export const GAP = 5;
export const NAME_START = LEAD + CHIRP.frames + GAP;


/** The newest frame when the name sits centered on screen, for a name `rows` frames tall. */
export const holdFrame = (rows: number) => NAME_START + Math.floor(rows / 2) + VIEW_ROWS / 2;

// Build-time estimate of the raster, used to place the still picture where the live name lands.
export const STILL = { font: 41, cap: 29, gap: 13, rows: 72 };

/** Radix-2 FFT in place. Pass sign -1 for the forward transform and +1 for the inverse (unscaled). */
export function makeFft(size: number) {
  const bits = Math.log2(size);
  const rev = Uint16Array.from({ length: size }, (_, i) => {
    let y = 0;
    for (let b = 0, x = i; b < bits; b++, x >>= 1) y = (y << 1) | (x & 1);
    return y;
  });
  const cos = Float64Array.from({ length: size / 2 }, (_, k) => Math.cos((2 * Math.PI * k) / size));
  const sin = Float64Array.from({ length: size / 2 }, (_, k) => Math.sin((2 * Math.PI * k) / size));
  return (re: Float64Array, im: Float64Array, sign: -1 | 1) => {
    for (let i = 0; i < size; i++) {
      const j = rev[i];
      if (j > i) {
        [re[i], re[j]] = [re[j], re[i]];
        [im[i], im[j]] = [im[j], im[i]];
      }
    }
    for (let len = 2; len <= size; len <<= 1) {
      const half = len >> 1;
      const stride = size / len;
      for (let start = 0; start < size; start += len) {
        for (let k = 0; k < half; k++) {
          const wr = cos[k * stride];
          const wi = sign * sin[k * stride];
          const a = start + k;
          const b = a + half;
          const tr = wr * re[b] - wi * im[b];
          const ti = wr * im[b] + wi * re[b];
          re[b] = re[a] - tr;
          im[b] = im[a] - ti;
          re[a] += tr;
          im[a] += ti;
        }
      }
    }
  };
}

/** Seeded uniform generator in [0, 1), so the signal is the same on every visit. */
export function rng(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One transmission, peak normalized: quiet water, the sweep, the name, then quiet water until
 * the name is centered on screen. `mask` is the name raster, `rows` by TEXT_BINS, top row first,
 * values 0 to 1. The bottom row goes out first: the waterfall puts the newest frame on top, so
 * the name then reads upright. Each symbol is one inverse FFT, sent as a cyclic prefix and then
 * the body. Neighboring symbols crossfade across the prefix with a raised cosine, so amplitudes
 * change smoothly and there are no clicks, while the body the receiver reads stays exact.
 */
export function synthesize(mask: Float32Array, rows: number): Float32Array<ArrayBuffer> {
  const rand = rng(1979);
  const frames = holdFrame(rows) + 1;
  const out = new Float32Array(frames * SYMBOL);
  const phase = Float64Array.from({ length: BINS }, () => rand() * 2 * Math.PI);
  const tone = 0.03;
  const ifft = makeFft(N);

  // Each name symbol, as one period of its own periodic signal.
  const symbols: (Float64Array | null)[] = Array.from({ length: frames }, (_, f) => {
    const r = f - NAME_START;
    if (r < 0 || r >= rows) return null;
    const row = rows - 1 - r;
    const re = new Float64Array(N);
    const im = new Float64Array(N);
    let any = false;
    for (let c = 0; c < TEXT_BINS; c++) {
      const a = mask[row * TEXT_BINS + c];
      if (a < 0.02) continue;
      any = true;
      const k = FIRST_BIN + c;
      re[k] = (tone / 2) * a * Math.cos(phase[k]);
      im[k] = (tone / 2) * a * Math.sin(phase[k]);
      re[N - k] = re[k];
      im[N - k] = -im[k];
    }
    if (!any) return null;
    ifft(re, im, 1);
    return re;
  });

  const w = (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * u);
  for (let f = 0; f < frames; f++) {
    const cur = symbols[f];
    const prev = symbols[f - 1] ?? null;
    const base = f * SYMBOL;
    // Prefix: the end of this symbol's period, faded in over the tail of the one before.
    for (let j = 0; j < CP; j++) {
      const g = w((j + 0.5) / CP);
      out[base + j] = (cur ? g * cur[N - CP + j] : 0) + (prev ? (1 - g) * prev[j] : 0);
    }
    if (cur) out.set(cur, base + CP);
  }

  // The sync sweep: one linear up-chirp with raised-cosine edges.
  const len = CHIRP.frames * SYMBOL;
  const ramp = 96;
  const T = len / FS;
  for (let n = 0; n < len; n++) {
    const t = n / FS;
    const edge = n < ramp ? w(n / ramp) : n >= len - ramp ? w((len - 1 - n) / ramp) : 1;
    out[LEAD * SYMBOL + n] += 0.05 * edge * Math.cos(2 * Math.PI * (CHIRP.f0 * t + ((CHIRP.f1 - CHIRP.f0) / (2 * T)) * t * t));
  }

  addNoise(out, rand);
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  const g = 0.9 / peak;
  for (let n = 0; n < out.length; n++) out[n] *= g;
  return out;
}

/** A low noise floor, so the water is never perfectly quiet. */
export function addNoise(out: Float32Array, rand = rng(7)) {
  for (let n = 0; n < out.length; n++) {
    let u = 0;
    while (u === 0) u = rand();
    out[n] += 0.0015 * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
  }
}
