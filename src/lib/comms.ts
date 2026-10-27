// Shared math for the signals playground: a seeded random generator, the Q function, the
// modulation maps and the theory BER curves. No imports, so scripts/check-comms.mjs can load it
// with Node's type stripping and test the same code the page runs.

/** Seeded uniform generator in [0, 1). The same seed always gives the same stream. */
export function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal samples from a uniform generator (Box-Muller). */
export function gaussian(rand: () => number) {
  return () => {
    let u = 0;
    while (u === 0) u = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
  };
}

/** Complementary error function, Chebyshev fit with fractional error under 1.2e-7 everywhere. */
export function erfc(x: number) {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? r : 2 - r;
}

/** Gaussian tail probability: Q(x) = P(N(0,1) > x). */
export const Q = (x: number) => 0.5 * erfc(x / Math.SQRT2);

export const dbToLin = (db: number) => 10 ** (db / 10);

export type Scheme = 'bpsk' | 'qpsk' | '8psk' | '16qam';

export const schemes: Record<Scheme, { label: string; bits: number; approx: boolean }> = {
  bpsk: { label: 'BPSK', bits: 1, approx: false },
  qpsk: { label: 'QPSK', bits: 2, approx: false },
  '8psk': { label: '8-PSK', bits: 3, approx: true },
  '16qam': { label: '16-QAM', bits: 4, approx: true },
};

/**
 * Theory bit error rate against Eb/N0 (linear). BPSK and QPSK are exact. 8-PSK and 16-QAM are
 * the usual Gray-coded nearest-neighbor approximations, good at high SNR.
 */
export function berTheory(scheme: Scheme, ebn0: number) {
  switch (scheme) {
    case 'bpsk':
    case 'qpsk':
      return Q(Math.sqrt(2 * ebn0));
    case '8psk':
      // Es = 3 Eb, so the argument is sqrt(2 Es/N0) sin(pi/8), shared across 3 bits.
      return (2 / 3) * Q(Math.sqrt(6 * ebn0) * Math.sin(Math.PI / 8));
    case '16qam':
      return (3 / 4) * Q(Math.sqrt((4 / 5) * ebn0));
  }
}

/** The Eb/N0 in dB where a theory curve falls to a target BER, by bisection. */
export function ebn0ForBer(scheme: Scheme, target: number, lo = -5, hi = 30) {
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (berTheory(scheme, dbToLin(mid)) > target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

const gray = (n: number) => n ^ (n >> 1);

/**
 * Constellation points for a scheme, indexed by the bit label of each point and scaled so the
 * average symbol energy is 1. Labels are Gray coded, so neighbors differ in one bit.
 */
export function constellation(scheme: Scheme): [number, number][] {
  const pts: [number, number][] = [];
  if (scheme === 'bpsk') {
    pts[0] = [-1, 0];
    pts[1] = [1, 0];
  } else if (scheme === 'qpsk' || scheme === '8psk') {
    const m = scheme === 'qpsk' ? 4 : 8;
    const offset = scheme === 'qpsk' ? Math.PI / 4 : 0;
    for (let k = 0; k < m; k++) {
      const th = offset + (2 * Math.PI * k) / m;
      pts[gray(k)] = [Math.cos(th), Math.sin(th)];
    }
  } else {
    // 4-PAM per axis, Gray ordered, with average energy 10 before scaling.
    const level = [-3, -1, 1, 3];
    const s = 1 / Math.sqrt(10);
    for (let i = 0; i < 4; i++)
      for (let q = 0; q < 4; q++) pts[(gray(i) << 2) | gray(q)] = [level[i] * s, level[q] * s];
  }
  return pts;
}

/** Index of the nearest constellation point: the maximum likelihood decision in white noise. */
export function nearest(pts: [number, number][], x: number, y: number) {
  let best = 0;
  let bestD = Infinity;
  for (let k = 0; k < pts.length; k++) {
    const d = (pts[k][0] - x) ** 2 + (pts[k][1] - y) ** 2;
    if (d < bestD) (bestD = d), (best = k);
  }
  return best;
}

/** Noise standard deviation per dimension for unit symbol energy at a given Es/N0 (linear). */
export const sigmaFor = (esn0: number) => Math.sqrt(1 / (2 * esn0));

export const popcount = (n: number) => {
  let c = 0;
  for (; n; n &= n - 1) c++;
  return c;
};

/**
 * Monte Carlo bit errors for a scheme at one Eb/N0 (dB): send random symbols through white
 * Gaussian noise and count wrong bits after nearest-point decisions.
 */
export function simulateBer(scheme: Scheme, ebn0Db: number, symbols: number, rand: () => number) {
  const pts = constellation(scheme);
  const k = schemes[scheme].bits;
  const sigma = sigmaFor(k * dbToLin(ebn0Db));
  const g = gaussian(rand);
  let errors = 0;
  for (let n = 0; n < symbols; n++) {
    const sent = Math.floor(rand() * pts.length);
    const got = nearest(pts, pts[sent][0] + sigma * g(), pts[sent][1] + sigma * g());
    errors += popcount(sent ^ got);
  }
  return { errors, bits: symbols * k };
}
