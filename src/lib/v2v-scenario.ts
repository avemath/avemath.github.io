// The V2V scenario and brake rule from V2V_TXRXf.m (github.com/avemath/v2v-bsm-ofdm):
//   bsm1.velocity = 30; bsm1.posX = 100;   bsm2.velocity = 25; bsm2.posX = 120;
//   TTC_WARN_THRESH = 5.0;   % s, brake warning if closing TTC below this
// Car 1 trails car 2. Velocities travel in the BSM as integers in hundredths of a m/s.

export const LEAD_V = 25; // m/s, car 2
export const POS_1 = 100; // m, car 1
export const POS_2 = 120; // m, car 2
export const GAP_M = POS_2 - POS_1;
export const TTC_WARN = 5.0; // s

/** A velocity as it comes out of the BSM: scaled by 100, rounded, and scaled back. */
export const viaBsm = (v: number) => Math.round(v * 100) / 100;

/** Time to collision and the brake decision, the same rule as RX-8 in V2V_TXRXf.m. */
export function collision(v1: number, v2 = LEAD_V, gap = GAP_M) {
  const closingRate = viaBsm(v1) - viaBsm(v2);
  const ttc = closingRate > 0 && gap > 0 ? gap / closingRate : Infinity;
  return { closingRate, ttc, brakeWarn: Number.isFinite(ttc) && ttc < TTC_WARN };
}
