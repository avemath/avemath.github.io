// The hero's signal: a 32-chip FH-BFSK preamble in the JANUS band. The band (9440 to 13600 Hz),
// the 13 tone pairs and the 6.25 ms chip come from the public JANUS papers, through
// src/lib/fhbfsk.ts. The real hop pattern and preamble bits are not public, so the hop order is
// the Signals playground's own (seed 87) and the bits come from the same seeded generator.
// No DOM here, so scripts/check-comms.mjs can test it.
import { mulberry32 } from './comms.ts';
import { DF, F_LOW, PAIRS, hopSequence, toneHz } from './fhbfsk.ts';

export const CHIPS = 32;
export const CHIP_MS = 6.25;
export const DURATION_MS = CHIPS * CHIP_MS; // 200 ms on air
/** Playback stretches each chip ten times so every hop can be heard: 2 s in all. */
export const LISTEN_STRETCH = 10;
export const RAMP_MS = 6;
export const SEED = 87;

export interface Chip {
  index: number;
  pair: number;
  bit: number;
  hz: number;
  startMs: number;
}

export function preamble(seed = SEED): Chip[] {
  const hops = hopSequence(CHIPS, seed);
  const rand = mulberry32(seed * 31 + 7);
  return hops.map((pair, index) => {
    const bit = rand() < 0.5 ? 0 : 1;
    return { index, pair, bit, hz: toneHz(pair, bit), startMs: index * CHIP_MS };
  });
}

/** All 26 tone centers, low to high: the frequencies the cursor snaps to. */
export const tones = Array.from({ length: PAIRS * 2 }, (_, k) => F_LOW + (k + 0.5) * DF);

// #region how:synth
/**
 * The preamble as audio samples, starting exactly at chip 0. Each chip is a pure tone at its
 * hop frequency, with a raised-cosine ramp up and down over RAMP_MS at both ends, so the level
 * never jumps between chips and there are no clicks.
 */
export function synthesize(chips: Chip[], sampleRate: number, stretch = LISTEN_STRETCH, level = 0.18) {
  const chipLen = Math.round((CHIP_MS * stretch * sampleRate) / 1000);
  const ramp = Math.round((RAMP_MS * sampleRate) / 1000);
  const out = new Float32Array(chipLen * chips.length);
  chips.forEach((c, i) => {
    const w = (2 * Math.PI * c.hz) / sampleRate;
    for (let n = 0; n < chipLen; n++) {
      const edge = Math.min(n, chipLen - 1 - n);
      const env = edge >= ramp ? 1 : 0.5 - 0.5 * Math.cos((Math.PI * edge) / ramp);
      out[i * chipLen + n] = level * env * Math.sin(w * n);
    }
  });
  return out;
}
// #endregion
