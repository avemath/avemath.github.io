// Textbook ocean acoustics for the research section: Munk's canonical sound speed profile with
// its axis at 1,000 m, and a simple ray tracer through it. General physics only; nothing here
// comes from the sponsored research. No imports, so it runs at build time and in the browser.

export const AXIS = 1000; // m, depth of the sound speed minimum
const B = 1300; // m, scale depth of the profile
const EPS = 0.00737;
export const FLOOR = 4000; // m, a flat seafloor
export const RANGE = 100_000; // m of range traced

/** Sound speed at depth z (m), in m/s. */
export function speed(z: number) {
  const eta = (2 * (z - AXIS)) / B;
  return 1500 * (1 + EPS * (eta - 1 + Math.exp(-eta)));
}

/** How fast the speed changes with depth, dc/dz, in 1/s. */
function gradient(z: number) {
  const eta = (2 * (z - AXIS)) / B;
  return 1500 * EPS * (1 - Math.exp(-eta)) * (2 / B);
}

/** Launch angles in degrees from horizontal, positive downward: ten rays from -12 to +12. */
export const ANGLES = [-12, -9, -6, -4, -2, 2, 4, 6, 9, 12];

/**
 * Traces one ray from a source at depth z0 (m), launched at `deg` degrees below horizontal. It
 * steps along the ray with the ray equations for a profile that only changes with depth: the
 * horizontal slowness stays constant (Snell's law) and the vertical slowness changes with the
 * speed gradient. The ray reflects off the surface and the flat floor. Returns [range, depth]
 * points in meters, one every `step` meters of path, and whether it ever touched the surface or
 * the floor (a ray that never does is held in the channel).
 */
export function trace(z0: number, deg: number, step = 250): { pts: [number, number][]; bounced: boolean } {
  const th = (deg * Math.PI) / 180;
  const c0 = speed(z0);
  const xi = Math.cos(th) / c0; // horizontal slowness, constant
  let zeta = Math.sin(th) / c0; // vertical slowness
  let r = 0;
  let z = z0;
  const pts: [number, number][] = [[r, z]];
  let bounced = false;
  while (r < RANGE) {
    const c = speed(z);
    r += c * xi * step;
    z += c * zeta * step;
    zeta -= (gradient(z) / (c * c)) * step;
    if (z < 0) {
      z = -z;
      zeta = -zeta;
      bounced = true;
    } else if (z > FLOOR) {
      z = 2 * FLOOR - z;
      zeta = -zeta;
      bounced = true;
    }
    pts.push([Math.min(r, RANGE), z]);
  }
  return { pts, bounced };
}

/** Plot geometry shared by the build and the browser, in each panel's viewBox units. */
export const PLOT = { y0: 30, y1: 266, rayX0: 38, rayX1: 368 };
export const depthY = (z: number) => PLOT.y0 + (z / FLOOR) * (PLOT.y1 - PLOT.y0);
export const rangeX = (r: number) => PLOT.rayX0 + (r / RANGE) * (PLOT.rayX1 - PLOT.rayX0);

/** Every ray from a source at z0, as SVG path data, and how many stay in the channel. */
export function rays(z0: number) {
  const all = ANGLES.map((a) => trace(z0, a));
  return {
    paths: all.map(({ pts, bounced }) => ({ d: pts.map(([r, z], i) => `${i ? 'L' : 'M'}${rangeX(r).toFixed(1)} ${depthY(z).toFixed(1)}`).join(''), bounced })),
    held: all.filter((t) => !t.bounced).length,
  };
}

export const describe = (z0: number, held: number) => `Source at ${Math.round(z0).toLocaleString('en-US')} m. ${held} of ${ANGLES.length} rays stay in the channel.`;
