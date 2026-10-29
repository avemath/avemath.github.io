// The V2V receiver chain from the OFDM demo, as a module the case study's demo and the home page
// tile share: the 802.11p-style frame, the three-path channel, and the four sync stages (coarse
// CFO, linear phase fit, Costas loop, MMSE equalizer). No DOM here.

export type C = [number, number];
export type Stages = { cfo: boolean; lin: boolean; pll: boolean; mmse: boolean };

export const FS = 10e6;
export const SPS = 16;
export const RS = FS / SPS; // sync symbol rate
export const NSYNC = 256;
export const NFFT = 64;
export const CP = 16;
export const PILOTS = [12, 26, 40, 54];
export const NULLS = new Set([0, 1, 2, 3, 4, 5, 32, 59, 60, 61, 62, 63]);
export const DATA = Array.from({ length: NFFT }, (_, k) => k).filter((k) => !NULLS.has(k) && !PILOTS.includes(k));
export const FFT_BACKOFF = 3; // samples the FFT window starts inside the cyclic prefix
export const PATHS = [
  { delay: 0, gainDb: 0 },
  { delay: 100e-9, gainDb: -5 },
  { delay: 250e-9, gainDb: -9 },
];


export function createReceiver(initialSeed = 42) {
  let seed = 42;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const gauss = () => {
    let u = 0, v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const rot = ([a, b]: C, th: number): C => [a * Math.cos(th) - b * Math.sin(th), a * Math.sin(th) + b * Math.cos(th)];
  const mul = ([a, b]: C, [c, d]: C): C => [a * c - b * d, a * d + b * c];
  const conj = ([a, b]: C): C => [a, -b];
  const abs2 = ([a, b]: C) => a * a + b * b;

  let packetSeed = initialSeed;
  let packet: ReturnType<typeof makePacket>;

  // Everything random about a packet is drawn once, so sliders move smoothly.
  function makePacket() {
    seed = packetSeed;
    const sync = Array.from({ length: NSYNC }, () => (rand() < 0.5 ? -1 : 1));
    const phase0 = rand() * 2 * Math.PI;
    const syncNoise = Array.from({ length: NSYNC }, () => [gauss(), gauss()] as C);
    const phaseWalk: number[] = [];
    let w = 0;
    for (let n = 0; n < NSYNC; n++) phaseWalk.push((w += gauss() * 0.012));
    const bits = Array.from({ length: 4 * DATA.length }, () => (rand() < 0.5 ? 0 : 1));
    const dataNoise = bits.map(() => [gauss(), gauss()] as C);
    const prNoise = Array.from({ length: NFFT }, () => [gauss(), gauss()] as C);
    return { sync, phase0, syncNoise, phaseWalk, bits, dataNoise, prNoise };
  }

  function channel(k: number): C {
    const f = (k < NFFT / 2 ? k : k - NFFT) * (FS / NFFT);
    let h: C = [0, 0];
    for (const p of PATHS) {
      const g = 10 ** (p.gainDb / 20);
      const th = -2 * Math.PI * f * p.delay;
      h = [h[0] + g * Math.cos(th), h[1] + g * Math.sin(th)];
    }
    // Starting the FFT early in the CP adds a linear phase ramp across subcarriers.
    return rot(h, (2 * Math.PI * k * FFT_BACKOFF) / NFFT);
  }

  packet = makePacket();

  return {
    /** Draw a new random packet (the demo's New packet button), or the one for `seed`. */
    newPacket(seed = Math.floor(Math.random() * 1e9) + 1) {
      packetSeed = seed;
      packet = makePacket();
    },
    receive(cfoHz: number, snrDb: number, on: Stages) {
      const sigma = Math.sqrt(1 / (2 * 10 ** (snrDb / 10)));
      const p = packet;

      // ---- Single-carrier sync symbols ----
      const dphi = (2 * Math.PI * cfoHz) / RS;
      let rx: C[] = p.sync.map((b, n) => {
        const clean = rot([b, 0], p.phase0 + dphi * n + p.phaseWalk[n]);
        return [clean[0] + sigma * p.syncNoise[n][0], clean[1] + sigma * p.syncNoise[n][1]];
      });

      // 1. Coarse CFO from the summed differential phase, with the known symbols stripped off.
      let est = 0;
      if (on.cfo) {
        let acc: C = [0, 0];
        for (let n = 1; n < NSYNC; n++) {
          const a = mul(rx[n], [p.sync[n], 0]);
          const b = mul(rx[n - 1], [p.sync[n - 1], 0]);
          const d = mul(a, conj(b));
          acc = [acc[0] + d[0], acc[1] + d[1]];
        }
        const step = Math.atan2(acc[1], acc[0]);
        est = (step / (2 * Math.PI)) * RS;
        rx = rx.map((z, n) => rot(z, -step * n));
      }

      let linCfo = 0;
      // 2. Fit a line to the unwrapped phase on the training symbols, then fix polarity.
      if (on.lin) {
        const ph: number[] = [];
        let prev = 0;
        rx.forEach((z, n) => {
          let a = Math.atan2(...(mul(z, [p.sync[n], 0]).reverse() as C));
          while (a - prev > Math.PI) a -= 2 * Math.PI;
          while (a - prev < -Math.PI) a += 2 * Math.PI;
          ph.push((prev = a));
        });
        const n = ph.length;
        const mx = (n - 1) / 2;
        const my = ph.reduce((x, y) => x + y, 0) / n;
        let sxy = 0, sxx = 0;
        ph.forEach((y, i) => ((sxy += (i - mx) * (y - my)), (sxx += (i - mx) ** 2)));
        const slope = sxy / sxx;
        const icpt = my - slope * mx;
        linCfo = (slope / (2 * Math.PI)) * RS;
        rx = rx.map((z, i) => rot(z, -(icpt + slope * i)));
        const corr = rx.reduce((acc, z, i) => acc + z[0] * p.sync[i], 0);
        if (corr < 0) rx = rx.map(([a, b]) => [-a, -b]);
      }

      // 3. Decision-directed Costas loop for the leftover phase wander.
      if (on.pll) {
        let theta = 0;
        const mu = 0.06;
        rx = rx.map((z) => {
          const y = rot(z, -theta);
          const err = Math.sign(y[0]) * y[1];
          theta += mu * err;
          return y;
        });
      }

      const phaseErr = rx.reduce((acc, z, n) => {
        const a = Math.atan2(z[1] * p.sync[n], z[0] * p.sync[n]);
        return acc + Math.abs(a);
      }, 0) / NSYNC;

      // ---- OFDM payload through the three-path channel ----
      // Any CFO the sync chain didn't remove shows up as a common rotation.
      const residualCfo = cfoHz - (on.cfo ? est : 0) - linCfo;
      const ofdmRot = on.lin ? 0 : p.phase0;
      const symDur = (NFFT + CP) / FS;
      const H = Array.from({ length: NFFT }, (_, k) => channel(k));
      const Hhat = H.map((h, k) => [h[0] + sigma * p.prNoise[k][0], h[1] + sigma * p.prNoise[k][1]] as C);
      const pts: C[] = [];
      let errors = 0;
      p.bits.forEach((bit, i) => {
        const sym = Math.floor(i / DATA.length);
        const k = DATA[i % DATA.length];
        const x: C = [bit ? 1 : -1, 0];
        const drift = ofdmRot + 2 * Math.PI * residualCfo * (sym + 1) * symDur;
        let y = rot(mul(H[k], x), drift);
        y = [y[0] + sigma * p.dataNoise[i][0], y[1] + sigma * p.dataNoise[i][1]];
        if (on.mmse) {
          const hk = Hhat[k];
          const n0 = 2 * sigma * sigma;
          const num = mul(conj(hk), y);
          const den = abs2(hk) + n0;
          y = [num[0] / den, num[1] / den];
        }
        pts.push(y);
        if ((y[0] >= 0 ? 1 : 0) !== bit) errors++;
      });

      return { rx, pts, H, Hhat, est, phaseErr, errors, bits: p.bits, sync: p.sync };
    },
  };
}
