// The hero transmission. My name is sent as OFDM symbols: each row of a 5 by 7 bitmap font is
// one 512 point symbol, and each lit column of a letter switches on three subcarriers. A short
// up-chirp goes out first as a preamble. The hero computes its waterfall from this signal with
// an FFT; nothing is drawn from the font directly. The build uses the same plan for the still
// picture that shows before the script loads. No imports, so it runs in the browser and at build.

export const FS = 16000; // samples per second
export const N = 512; // FFT size and symbol length, 32 ms
export const BINS = N / 2; // 31.25 Hz per bin, 0 to 8 kHz
export const BIN_HZ = FS / N;
export const FRAMES_PER_ROW = 3; // each font row lasts three symbols
export const BINS_PER_COL = 3; // each font column is three subcarriers wide
export const LOOP = 100; // frames per loop, 3.2 s
export const VIEW_ROWS = 160; // frames on screen, newest at the top

export const TEXT = 'AVERY MATHERNE';

// Frame layout of one loop.
export const CHIRP = { start: 4, frames: 22, f0: 300, f1: 7500 };
export const NAME_START = 32;

const FONT: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  ' ': ['...', '...', '...', '...', '...', '...', '...'],
};

/** The name as 7 rows of on/off columns, top row first. Letters are 5 wide with 1 column between. */
export function bitmap(text = TEXT) {
  const rows: boolean[][] = Array.from({ length: 7 }, () => []);
  [...text].forEach((ch, i) => {
    const glyph = FONT[ch] ?? FONT[' '];
    rows.forEach((row, r) => {
      if (i > 0 && ch !== ' ' && text[i - 1] !== ' ') row.push(false);
      for (const c of glyph[r]) row.push(c === '#');
    });
  });
  return rows;
}

const ROWS = bitmap();
export const COLS = ROWS[0].length;
/** First subcarrier of the name, so it sits centered in the band. */
export const FIRST_BIN = Math.floor((BINS - COLS * BINS_PER_COL) / 2);
export const NAME_FRAMES = ROWS.length * FRAMES_PER_ROW;

/**
 * Which subcarriers are on in a frame of the loop, or null outside the name. The bottom font row
 * goes out first: the waterfall puts the newest frame on top, so the name then reads upright.
 */
export function nameBins(frame: number): number[] | null {
  const f = frame - NAME_START;
  if (f < 0 || f >= NAME_FRAMES) return null;
  const row = ROWS[ROWS.length - 1 - Math.floor(f / FRAMES_PER_ROW)];
  const bins: number[] = [];
  row.forEach((on, c) => {
    if (on) for (let b = 0; b < BINS_PER_COL; b++) bins.push(FIRST_BIN + c * BINS_PER_COL + b);
  });
  return bins;
}

/** Seeded uniform generator in [0, 1), so the signal is the same on every visit. */
function rng(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One loop of the transmitted signal, peak normalized. The name is built symbol by symbol as a
 * sum of subcarriers; each keeps a fixed phase, and every subcarrier fits a whole number of
 * cycles in a symbol, so the tones run continuously from row to row.
 */
export function synthesize(): Float32Array<ArrayBuffer> {
  const rand = rng(1979);
  const out = new Float32Array(LOOP * N);
  const phase = Float64Array.from({ length: BINS }, () => rand() * 2 * Math.PI);
  const tone = 0.032;

  // Subcarriers, as a sum of cosines per symbol. About 30 ms of work on a phone.
  const cosTable = Float64Array.from({ length: N }, (_, n) => Math.cos((2 * Math.PI * n) / N));
  for (let frame = 0; frame < LOOP; frame++) {
    const bins = nameBins(frame);
    if (!bins) continue;
    const base = frame * N;
    for (const k of bins) {
      const p0 = Math.round((phase[k] / (2 * Math.PI)) * N);
      for (let n = 0; n < N; n++) out[base + n] += tone * cosTable[(k * n + p0) % N];
    }
  }

  // Preamble: a linear up-chirp.
  const { start, frames, f0, f1 } = CHIRP;
  const len = frames * N;
  for (let n = 0; n < len; n++) {
    const t = n / FS;
    const T = len / FS;
    const ramp = Math.min(1, n / 160, (len - n) / 160);
    out[start * N + n] += 0.05 * ramp * Math.cos(2 * Math.PI * (f0 * t + ((f1 - f0) / (2 * T)) * t * t));
  }

  // A low noise floor, so the water is never perfectly quiet.
  for (let n = 0; n < out.length; n++) {
    let u = 0;
    while (u === 0) u = rand();
    out[n] += 0.0016 * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
  }

  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  const g = 0.9 / peak;
  for (let n = 0; n < out.length; n++) out[n] *= g;
  return out;
}

/** The newest frame shown when the waterfall stands still, chosen so the name sits mid-screen. */
export const STILL_TOP = NAME_START + Math.floor(NAME_FRAMES / 2) + VIEW_ROWS / 2;
