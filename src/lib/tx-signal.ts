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
/** Subcarriers the name spans: 80 of them, from 500 Hz to just under 3 kHz, where tones are easy
 *  on the ear. Fewer, wider letter pixels also mean fewer tones sound at once. */
export const TEXT_BINS = 80;
export const FIRST_BIN = 16;
/** The display shows 0 to 4 kHz, the lower half of the band, so the name fills most of it. */
export const SHOW_BINS = 128;
/** A display column is twice as wide as a row is tall, so the name is drawn twice as tall in rows. */
export const STRETCH = 2;

// Frame layout of one transmission.
export const LEAD = 8; // quiet water before the sweep
export const CHIRP = { frames: 24, f0: 400, f1: 3200 };
export const GAP = 5;
export const NAME_START = LEAD + CHIRP.frames + GAP;


/** The newest frame when the name sits centered on screen, for a name `rows` frames tall. */
export const holdFrame = (rows: number) => NAME_START + Math.floor(rows / 2) + VIEW_ROWS / 2;

// Build-time estimate of the raster, used to place the still picture where the live name lands.
export const STILL = { font: 15.26, cap: 10.68, gap: 4.88, rows: 55 };

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
 *
 * `pause` is awaited between small batches of work, so a browser can yield to the page while
 * this runs. The batches run in the same order with the same random stream, so the result is the
 * same with or without pauses.
 */
export interface Channel {
  /** Send each symbol with its cyclic prefix. Off: bodies back to back, so an echo smears rows. */
  prefix?: boolean;
  /** Crossfade neighboring symbols across the prefix. Off: they switch in one sample. */
  ramp?: boolean;
  /** Noise floor, as a multiple of the usual level. */
  noise?: number;
  /** A second path through the water: the same signal again, `delay` samples later. */
  echo?: { delay: number; gain: number };
}

export async function synthesize(
  mask: Float32Array,
  rows: number,
  pause: () => Promise<unknown> = async () => {},
  { prefix = true, ramp: crossfade = true, noise = 1, echo }: Channel = {},
): Promise<Float32Array<ArrayBuffer>> {
  const rand = rng(1979);
  const frames = holdFrame(rows) + 1;
  const cp = prefix ? CP : 0;
  const step = N + cp;
  const out = new Float32Array(frames * step);
  const phase = Float64Array.from({ length: BINS }, () => rand() * 2 * Math.PI);
  const tone = 0.03;
  const ifft = makeFft(N);
  const gauss = () => {
    let u = 0;
    while (u === 0) u = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
  };
  // The water is the channel: a gentle frequency-selective fade, as two paths would make, and a
  // little level jitter per subcarrier and symbol. The name then reads as a measured signal
  // with real texture, not flat text, while staying a few dB from full level.
  const fade = Float64Array.from({ length: BINS }, (_, k) => 10 ** ((2.4 * Math.sin((2 * Math.PI * k) / 47 + 0.7) + 1.3 * Math.sin((2 * Math.PI * k) / 13 + 2.1)) / 20));

  // Each name symbol, as one period of its own periodic signal.
  const symbol = (f: number): Float64Array | null => {
    const r = f - NAME_START;
    if (r < 0 || r >= rows) return null;
    const row = rows - 1 - r;
    const re = new Float64Array(N);
    const im = new Float64Array(N);
    let any = false;
    // #region how:symbol
    for (let c = 0; c < TEXT_BINS; c++) {
      const a = mask[row * TEXT_BINS + c];
      if (a < 0.02) continue;
      any = true;
      const k = FIRST_BIN + c;
      const amp = (tone / 2) * a * fade[k] * Math.max(0.4, 1 + 0.16 * gauss());
      re[k] = amp * Math.cos(phase[k]);
      im[k] = amp * Math.sin(phase[k]);
      re[N - k] = re[k];
      im[N - k] = -im[k];
    }
    if (!any) return null;
    ifft(re, im, 1);
    // #endregion
    return re;
  };
  const symbols: (Float64Array | null)[] = [];
  for (let f = 0; f < frames; f++) {
    symbols.push(symbol(f));
    if (f % 16 === 15) await pause();
  }

  const w = (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * u);
  // #region how:prefix
  for (let f = 0; f < frames; f++) {
    const cur = symbols[f];
    const prev = symbols[f - 1] ?? null;
    const base = f * step;
    // Prefix: the end of this symbol's period, faded in over the tail of the one before.
    for (let j = 0; j < cp; j++) {
      const g = crossfade ? w((j + 0.5) / cp) : 1;
      out[base + j] = (cur ? g * cur[N - cp + j] : 0) + (prev ? (1 - g) * prev[j] : 0);
    }
    if (cur) out.set(cur, base + cp);
  }
  // #endregion

  // The sync sweep: one linear up-chirp with raised-cosine edges.
  // #region how:chirp
  const len = CHIRP.frames * step;
  const ramp = 96;
  const T = len / FS;
  for (let n = 0; n < len; n++) {
    const t = n / FS;
    const edge = n < ramp ? w(n / ramp) : n >= len - ramp ? w((len - 1 - n) / ramp) : 1;
    out[LEAD * step + n] += 0.05 * edge * Math.cos(2 * Math.PI * (CHIRP.f0 * t + ((CHIRP.f1 - CHIRP.f0) / (2 * T)) * t * t));
  }
  // #endregion

  // A second path through the water, if there is one: the signal again, later and weaker.
  if (echo) for (let n = out.length - 1; n >= echo.delay; n--) out[n] += echo.gain * out[n - echo.delay];

  for (let from = 0; from < out.length; from += 16384) {
    addNoise(out, rand, from, Math.min(out.length, from + 16384), noise);
    await pause();
  }

  // A gentle low-pass (second-order Butterworth at 3.4 kHz) softens the edges of the tones, then
  // 30 ms raised-cosine fades at both ends, so the sound starts and stops without a click. This is
  // the buffer that plays and the one the waterfall analyzes, so the picture shows exactly this.
  lowPass(out, 3400);
  const fadeLen = Math.round(0.03 * FS);
  for (let n = 0; n < fadeLen; n++) {
    const g = 0.5 - 0.5 * Math.cos((Math.PI * n) / fadeLen);
    out[n] *= g;
    out[out.length - 1 - n] *= g;
  }

  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  const g = 0.9 / peak;
  for (let n = 0; n < out.length; n++) out[n] *= g;
  return out;
}

/** Second-order Butterworth low-pass, in place (a standard biquad). */
function lowPass(x: Float32Array, fc: number) {
  const w = (2 * Math.PI * fc) / FS;
  const alpha = Math.sin(w) / Math.SQRT2;
  const cw = Math.cos(w);
  const a0 = 1 + alpha;
  const b0 = (1 - cw) / 2 / a0;
  const b1 = (1 - cw) / a0;
  const a1 = (-2 * cw) / a0;
  const a2 = (1 - alpha) / a0;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let n = 0; n < x.length; n++) {
    const x0 = x[n];
    const y0 = b0 * x0 + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
    x[n] = y0;
  }
}

/** A low noise floor, so the water is never perfectly quiet. Adds to out[from] up to out[to]. */
export function addNoise(out: Float32Array, rand = rng(7), from = 0, to = out.length, level = 1) {
  for (let n = from; n < to; n++) {
    let u = 0;
    while (u === 0) u = rand();
    out[n] += level * 0.0021 * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
  }
}

/**
 * The receiver for one symbol: an FFT over the symbol's body, skipping its prefix, like an OFDM
 * receiver. No window is needed, because each subcarrier fits whole cycles in the body. Writes the
 * level of the first `out.length` bins, in dBFS, where a full-scale tone reads 0. `cp` is the
 * prefix length the signal was sent with.
 */
export function receive(signal: Float32Array, frame: number, out: Float32Array, fft: ReturnType<typeof makeFft>, re: Float64Array, im: Float64Array, cp = CP) {
  // #region how:receive
  const base = frame * (N + cp) + cp;
  for (let n = 0; n < N; n++) {
    re[n] = signal[base + n] ?? 0;
    im[n] = 0;
  }
  fft(re, im, -1);
  const scale = 2 / N;
  for (let k = 0; k < out.length; k++) out[k] = 20 * Math.log10(Math.hypot(re[k], im[k]) * scale + 1e-9);
  // #endregion
}
