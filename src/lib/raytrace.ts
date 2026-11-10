// One acoustic ray tracer for the site: the home hero's eigenray plate and the Research ray figure
// both use it. Range-independent sound speed c(z), depth positive down, launch angles in radians
// with positive pointing down (BELLHOP's convention). The sound speed profiles are the ones in
// bellhopSim (src/profiles.py), with its default parameters.
//
// The ray equations are BELLHOP's: with s the arc length, xi = cos(theta) / c and zeta =
// sin(theta) / c,
//   dr/ds = c xi,   dz/ds = c zeta,   dxi/ds = 0 (no range dependence),   dzeta/ds = -c_z / c^2,
// integrated with fourth-order Runge-Kutta. xi staying fixed is Snell's law, cos(theta) / c(z)
// constant along the ray. Travel time accumulates as ds / c. The surface and the bottom reflect
// the ray (zeta changes sign) and are counted.

export type Profile = {
  id: string;
  name: string;
  /** Water depth, m. */
  zmax: number;
  /** Range to trace, m. */
  rmax: number;
  /** A sensible default source depth, m. */
  zs: number;
  c: (z: number) => number;
  /** Depth of the slowest sound, if the profile has a channel inside the water. */
  axis?: number;
  /** From bellhopSim's src/profiles.py. */
  source: string;
};

const munkC = (z: number, c0 = 1500, zAxis = 1300, B = 1300, eps = 0.00737) => {
  const e = (2 * (z - zAxis)) / B;
  return c0 * (1 + eps * (e + Math.exp(-e) - 1));
};

export const MUNK: Profile = {
  id: 'munk',
  name: 'Munk, deep water',
  zmax: 5000,
  rmax: 100_000,
  zs: 1300,
  c: (z) => munkC(z),
  axis: 1300,
  source: 'munk_profile(c0=1500, z_axis=1300, B=1300, epsilon=0.00737)',
};

export const SURFACE_DUCT: Profile = {
  id: 'surface-duct',
  name: 'Surface duct',
  zmax: 5000,
  rmax: 50_000,
  zs: 50,
  c: (z) => {
    const duct = 100;
    const base = duct * 3;
    if (z <= duct) return 1520 - 0.02 * z;
    if (z <= base) {
      const f = (z - duct) / (base - duct);
      return (1520 - 0.02 * duct) * (1 - f) + 1480 * f;
    }
    return 1480 + 0.017 * (z - base);
  },
  source: 'surface_duct_profile(duct_depth=100, duct_speed=1520)',
};

export const ARCTIC: Profile = {
  id: 'arctic',
  name: 'Arctic',
  zmax: 4000,
  rmax: 100_000,
  zs: 100,
  c: (z) => (z < 200 ? 1435 + 0.1 * z : 1435 + 20 + 0.016 * (z - 200)),
  source: 'arctic_profile(surface_speed=1435)',
};

export const SHALLOW: Profile = {
  id: 'shallow',
  name: 'Shallow water shelf',
  zmax: 200,
  rmax: 10_000,
  zs: 50,
  c: (z) => {
    const mixed = 20;
    const base = 80;
    if (z <= mixed) return 1520 - 0.05 * z;
    if (z <= base) {
      const top = 1520 - 0.05 * mixed;
      return top + (1490 - top) * ((z - mixed) / (base - mixed));
    }
    return 1490 + 0.005 * (z - base);
  },
  source: 'shallow_water_profile(total_depth=200, surface_speed=1520, bottom_speed=1490)',
};

export const ISOTHERMAL: Profile = {
  id: 'isothermal',
  name: 'Isothermal',
  zmax: 5000,
  rmax: 100_000,
  zs: 1000,
  c: () => 1500,
  source: 'isothermal_profile(speed=1500)',
};

export const PROFILES = [MUNK, SURFACE_DUCT, ARCTIC, SHALLOW, ISOTHERMAL];

/** dc/dz by a central difference (the piecewise profiles have no closed-form derivative). */
const dcdz = (p: Profile, z: number) => {
  const h = 0.5;
  return (p.c(Math.min(p.zmax, z + h)) - p.c(Math.max(0, z - h))) / (Math.min(p.zmax, z + h) - Math.max(0, z - h));
};

export type Ray = {
  /** Launch angle, radians, positive down. */
  theta: number;
  /** Snell's invariant cos(theta0) / c(zs). */
  xi: number;
  /** Samples along the ray: range m, depth m, travel time s, and the surface and bottom bounces so far. */
  r: number[];
  z: number[];
  t: number[];
  surf: number[];
  bot: number[];
  /** Where the ray turned around inside the water (not at a boundary). */
  turns: { r: number; z: number; t: number; upper: boolean }[];
};

export type TraceOptions = {
  /** Range to trace to, m (default the profile's). */
  rmax?: number;
  /** Arc length step, m (default about 1/400 of the range). */
  ds?: number;
  /** Keep every n-th step as a sample (default 4). */
  every?: number;
};

export function traceRay(p: Profile, zs: number, theta: number, opts: TraceOptions = {}): Ray {
  const rmax = opts.rmax ?? p.rmax;
  const ds = opts.ds ?? rmax / 400;
  const every = opts.every ?? 4;
  const c0 = p.c(zs);
  const xi = Math.cos(theta) / c0;
  let r = 0;
  let z = zs;
  let zeta = Math.sin(theta) / c0;
  let t = 0;
  let surf = 0;
  let bot = 0;
  const ray: Ray = { theta, xi, r: [0], z: [zs], t: [0], surf: [0], bot: [0], turns: [] };
  // The derivatives of (r, z, zeta).
  const f = (zz: number, ze: number) => {
    const zc = Math.min(p.zmax, Math.max(0, zz));
    const c = p.c(zc);
    return [c * xi, c * ze, -dcdz(p, zc) / (c * c)];
  };
  for (let i = 1; r < rmax && i < 200_000; i++) {
    const k1 = f(z, zeta);
    const k2 = f(z + (ds / 2) * k1[1], zeta + (ds / 2) * k1[2]);
    const k3 = f(z + (ds / 2) * k2[1], zeta + (ds / 2) * k2[2]);
    const k4 = f(z + ds * k3[1], zeta + ds * k3[2]);
    const cMid = p.c(Math.min(p.zmax, Math.max(0, z + (ds / 2) * k1[1])));
    const prevZeta = zeta;
    r += (ds / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    z += (ds / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    zeta += (ds / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
    t += ds / cMid;
    if (z < 0) {
      z = -z;
      zeta = -zeta;
      surf++;
    } else if (z > p.zmax) {
      z = 2 * p.zmax - z;
      zeta = -zeta;
      bot++;
    } else if (prevZeta !== 0 && Math.sign(prevZeta) !== Math.sign(zeta)) {
      // Refracted back inside the water: an upper turning point if it was rising (zeta < 0).
      ray.turns.push({ r, z, t, upper: prevZeta < 0 });
    }
    if (i % every === 0 || r >= rmax) {
      ray.r.push(r);
      ray.z.push(z);
      ray.t.push(t);
      ray.surf.push(surf);
      ray.bot.push(bot);
    }
  }
  return ray;
}

/** A fan of rays, evenly spaced in launch angle from lo to hi (radians). */
export function fan(p: Profile, zs: number, lo: number, hi: number, n: number, opts: TraceOptions = {}) {
  const out: Ray[] = [];
  for (let i = 0; i < n; i++) out.push(traceRay(p, zs, n === 1 ? lo : lo + ((hi - lo) * i) / (n - 1), opts));
  return out;
}

/** Where a ray first reaches range R: its depth, time and bounce counts there (linear between samples). */
export function atRange(ray: Ray, R: number) {
  for (let i = 1; i < ray.r.length; i++) {
    if (ray.r[i] >= R) {
      const a = (R - ray.r[i - 1]) / (ray.r[i] - ray.r[i - 1] || 1);
      return {
        z: ray.z[i - 1] + a * (ray.z[i] - ray.z[i - 1]),
        t: ray.t[i - 1] + a * (ray.t[i] - ray.t[i - 1]),
        surf: ray.surf[i],
        bot: ray.bot[i],
        i,
      };
    }
  }
  return null;
}

export type Eigenray = { theta: number; t: number; surf: number; bot: number; a: number; b: number };

/**
 * The eigenrays to a receiver at range R and depth zr, from a fan sorted by launch angle: wherever
 * two neighboring rays land on either side of the receiver with the same bounce history, one ray
 * between them passes through it. Its angle and travel time are interpolated from the pair (a and
 * b are the pair's indices in the fan). Sorted by travel time.
 */
export function eigenrays(rays: Ray[], R: number, zr: number): Eigenray[] {
  const hits = rays.map((ray) => atRange(ray, R));
  const out: Eigenray[] = [];
  for (let i = 1; i < rays.length; i++) {
    const p = hits[i - 1];
    const q = hits[i];
    if (!p || !q || p.surf !== q.surf || p.bot !== q.bot) continue;
    const dp = p.z - zr;
    const dq = q.z - zr;
    if (dp === 0 || Math.sign(dp) !== Math.sign(dq)) {
      const a = dp === dq ? 0 : dp / (dp - dq);
      out.push({ theta: rays[i - 1].theta + a * (rays[i].theta - rays[i - 1].theta), t: p.t + a * (q.t - p.t), surf: p.surf, bot: p.bot, a: i - 1, b: i });
    }
  }
  return out.sort((x, y) => x.t - y.t);
}
