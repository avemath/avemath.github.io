// The physics behind the Research page's race (src/components/research/SoundRace.astro): radio and
// sound, in air and in seawater. Checked by scripts/check-physics.mjs.

/** Speeds in m/s: radio at the speed of light (air is close enough to vacuum here), sound in air
 *  at 20 °C, sound in seawater (it varies from about 1450 to 1550 m/s; 1500 is the usual round
 *  number). */
export const SPEED = { radioAir: 299_792_458, soundAir: 343, soundWater: 1500 } as const;

/** Seawater conductivity, S/m. */
export const SIGMA = 4;
const MU0 = 4 * Math.PI * 1e-7;
/** One skin depth costs 1 neper, 20 log10(e) = 8.686 dB. */
export const DB_PER_SKIN_DEPTH = 20 * Math.log10(Math.E);
/** When the race calls radio "lost": 40 dB down, a ten-thousandth of the power, from absorption
 *  alone (no spreading counted). */
export const LOST_DB = 40;

/** Skin depth in seawater, m: delta = 1 / sqrt(pi f mu0 sigma). About 2.5 m at 10 kHz. */
export const skinDepth = (fHz: number, sigma = SIGMA) => 1 / Math.sqrt(Math.PI * fHz * MU0 * sigma);

/** Radio absorption in seawater over a distance, dB: 8.686 dB per skin depth. */
export const radioLossDb = (fHz: number, meters: number) => (DB_PER_SKIN_DEPTH * meters) / skinDepth(fHz);

/** How far radio gets in seawater before it is LOST_DB down, m. */
export const radioReach = (fHz: number) => (LOST_DB / DB_PER_SKIN_DEPTH) * skinDepth(fHz);

/** Thorp's absorption of sound in seawater, dB/km, f in Hz (the formula takes kHz). About 1.2 dB/km
 *  at 10 kHz. */
export const thorpDbPerKm = (fHz: number) => {
  const f = fHz / 1000;
  const f2 = f * f;
  return (0.11 * f2) / (1 + f2) + (44 * f2) / (4100 + f2) + 2.75e-4 * f2 + 0.003;
};

export const travelTime = (meters: number, speed: number) => meters / speed;

/** Two significant figures, as the race shows numbers. */
const sig2 = (x: number) => Number(x.toPrecision(2));

/** A time in the unit that reads best: 3.3 µs, 29 ms, 0.67 s, 2.9 s. */
export const fmtTime = (s: number) => (s < 1e-3 ? `${sig2(s * 1e6)} µs` : s < 0.1 ? `${sig2(s * 1e3)} ms` : `${sig2(s)} s`);

/** A distance: 12 m, 0.12 m, 1 km, 2.5 km. */
export const fmtDist = (m: number) => (m >= 1000 ? `${sig2(m / 1000)} km` : `${sig2(m)} m`);

/** A frequency: 1 kHz, 100 MHz, 2.4 GHz. */
export const fmtFreq = (f: number) => (f >= 1e9 ? `${sig2(f / 1e9)} GHz` : f >= 1e6 ? `${sig2(f / 1e6)} MHz` : `${sig2(f / 1e3)} kHz`);

/** The distance slider: 0 to 1000 maps to 10 m to 10 km on a log scale, rounded to two figures. */
export const sliderToMeters = (v: number) => sig2(10 * 1000 ** (v / 1000));
export const metersToSlider = (m: number) => Math.round((1000 * Math.log10(m / 10)) / 3);

/** Everything the race shows for one distance and pair of frequencies. */
export function raceAt(meters: number, radioHz: number, soundHz: number) {
  const reach = radioReach(radioHz);
  return {
    meters,
    radioAir: travelTime(meters, SPEED.radioAir),
    soundAir: travelTime(meters, SPEED.soundAir),
    soundWater: travelTime(meters, SPEED.soundWater),
    radioWaterReach: reach,
    radioWaterArrives: meters <= reach,
    radioWaterTime: travelTime(meters, SPEED.radioAir),
    radioWaterLossDb: radioLossDb(radioHz, meters),
    skinDepth: skinDepth(radioHz),
    soundWaterDbPerKm: thorpDbPerKm(soundHz),
    soundWaterLossDb: (thorpDbPerKm(soundHz) * meters) / 1000,
  };
}

/** The sentence the race reads out after a Send. */
export function summary(meters: number, radioHz: number, soundHz: number) {
  const r = raceAt(meters, radioHz, soundHz);
  const water = r.radioWaterArrives
    ? `radio in water arrives at ${fmtFreq(radioHz)}, ${Math.round(r.radioWaterLossDb)} dB down`
    : `radio in water lost after ${fmtDist(r.radioWaterReach)} at ${fmtFreq(radioHz)}`;
  return `At ${fmtDist(meters)}: radio in air ${fmtTime(r.radioAir)}, sound in air ${fmtTime(r.soundAir)}, sound in water ${fmtTime(r.soundWater)}, ${water}. Sound in water loses ${sig2(r.soundWaterDbPerKm)} dB per km at ${fmtFreq(soundHz)}.`;
}
