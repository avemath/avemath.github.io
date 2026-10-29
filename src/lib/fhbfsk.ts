// The FH-BFSK chip math from my standalone study tool, shared by the Signals playground demo
// (src/components/demos/signals/fhbfsk.ts) and the home page's live tile. Each chip hops to one of
// 13 tone pairs and sends the low tone for a 0 or the high tone for a 1.
import { mulberry32 } from './comms';

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
