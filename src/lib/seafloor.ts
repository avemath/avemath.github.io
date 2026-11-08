// The Research page's seafloor, as plain numbers: the terraced terrain, the stacked-slab formations,
// where the viewer stands, and where every jellyfish and crab goes. No three.js here, so the layout
// can be checked on its own (scripts/check-seafloor.mjs proves nothing ever passes through a
// terrace or a formation). src/scripts/seafloor-scene.ts draws it.

export const LEV = 14; // terrace levels
export const HMAX = 48; // height of the top level
export const STEP = HMAX / LEV;

function rnd(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

// A smooth field: a bowl whose floor is the basin in the middle and whose walls rise toward the rim,
// with mounds and hollows on the slope so the terraces wander.
const field = rnd(5);
const bumps: number[][] = [];
for (let i = 0; i < 30; i++) {
  const a = field() * Math.PI * 2;
  const d = 15 + field() * 110;
  bumps.push([Math.cos(a) * d, Math.sin(a) * d, 8 + field() * 18, (field() - 0.35) * 0.32]);
}
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
function hraw(x: number, z: number) {
  const d = Math.hypot(x, z);
  let h = 0.04 + smooth(8, 120, d) * 0.9;
  for (const b of bumps) {
    const q = ((x - b[0]) ** 2 + (z - b[1]) ** 2) / (b[2] * b[2]);
    // Past 3.5 widths a mound adds under 0.00001 of a level: skip it (it keeps the scene's mesh fast).
    if (q < 12.25) h += b[3] * Math.exp(-q);
  }
  h += 0.03 * Math.sin(x * 0.08) * Math.cos(z * 0.06);
  return Math.max(0, Math.min(0.999, h));
}

/** The smooth field in terrace levels (0 to LEV). The shader draws the contours from this, not from
 *  the mesh's height, so the glowing edges stay smooth curves between mesh vertices. */
export const levels = (x: number, z: number) => hraw(x, z) * LEV;

/** Height from a value of the smooth field in levels: flat terrace tops joined by risers. The riser
 *  is a smooth S over the top 45% of each level (the mockup used 22%), so it spans several mesh cells
 *  and never stair-steps. */
export function heightFromLevels(t: number) {
  const f = t - Math.floor(t);
  const s = f < 0.55 ? 0 : (f - 0.55) / 0.45;
  const e = s * s * (3 - 2 * s);
  return ((Math.floor(t) + e) / LEV) * HMAX;
}

/** Terrain height at a point. */
export const height = (x: number, z: number) => heightFromLevels(levels(x, z));

/** The viewer stands on a ledge halfway down the slope, looking along -z. */
export const viewer = (() => {
  let best = 1e9;
  let z = 60;
  for (let zz = 24; zz < 125; zz += 0.5) {
    const d = Math.abs(height(0, zz) - HMAX * 0.5);
    if (d < best) {
      best = d;
      z = zz;
    }
  }
  return { x: 0, z, eye: height(0, z) + 5 };
})();

export interface Slab {
  x: number;
  z: number;
  r: number;
  y0: number;
  y1: number;
  sides: number;
  rot: number;
}

/** Stacked-slab formations, some rising above the viewer, some down in the basin. Each slab is
 *  recorded with its own center and radius, so a lean is part of the footprint. */
export const slabs: Slab[] = (() => {
  const r = rnd(77);
  const out: Slab[] = [];
  for (let n = 0; n < 16; n++) {
    let x = 0;
    let z = 0;
    let tries = 0;
    do {
      const a = r() * Math.PI * 2;
      const d = 14 + r() * 85;
      x = Math.cos(a) * d;
      z = Math.sin(a) * d + viewer.z * 0.35;
      tries++;
    } while (Math.hypot(x - viewer.x, z - viewer.z) < 16 && tries < 20);
    const g0 = Math.floor(height(x, z) / STEP);
    const k = 3 + Math.floor(r() * 7);
    const r0 = 3 + r() * 5;
    let ox = 0;
    let oz = 0;
    const lx = (r() - 0.5) * 0.9;
    const lz = (r() - 0.5) * 0.9;
    for (let s = 0; s < k; s++) {
      const rad = r0 * (1 - s / (k + 2)) * (0.85 + r() * 0.3);
      out.push({ x: x + ox, z: z + oz, r: rad, y0: (g0 + s) * STEP, y1: (g0 + s + 1) * STEP, sides: 7 + Math.floor(r() * 3), rot: r() * 3 });
      ox += lx * (0.6 + r());
      oz += lz * (0.6 + r());
    }
  }
  return out;
})();

/** The highest solid point (terrain or formation) anywhere within `rad` of (x, z). */
export function groundAt(x: number, z: number, rad: number) {
  let h = 0;
  for (let a = 0; a < 12; a++) {
    for (const rr of [0, rad * 0.34, rad * 0.67, rad]) {
      const ang = (a / 12) * Math.PI * 2;
      h = Math.max(h, height(x + Math.cos(ang) * rr, z + Math.sin(ang) * rr));
    }
  }
  for (const s of slabs) if (Math.hypot(x - s.x, z - s.z) < s.r + rad) h = Math.max(h, s.y1);
  return h;
}

// ---- Jellyfish ----
// In jelly units (multiplied by the jelly's scale): bell radius 1 that pulses to 1.08, tentacles that
// sway sideways by up to 0.35 and reach 4.0 x 1.3 = 5.2 below the bell.
export const JELLY = { reach: 1.45, below: 5.2, above: 0.8 };
// In world units: the slow drift around the base point.
export const DRIFT = { x: 1.2, z: 1.2, yUp: 1.45, yDown: 0 };
const CLEAR = 1.5;

export interface Jelly {
  x: number;
  y: number;
  z: number;
  s: number;
  ph: number;
  color: number;
}

/** The jellyfish drift around each base point. */
export function jellyAt(j: Jelly, t: number) {
  const p = 0.5 + 0.5 * Math.sin(t * 1.6 + j.ph);
  return {
    x: j.x + Math.sin(t * 0.15 + j.ph) * DRIFT.x,
    y: j.y + 0.6 + Math.sin(t * 0.4 + j.ph) * 0.6 + p * 0.25,
    z: j.z + Math.cos(t * 0.12 + j.ph) * DRIFT.z,
    pulse: p,
  };
}

/** Sixteen jellyfish, upright, half above eye level and half below, each placed so its whole body,
 *  tentacles and drift included, stays clear of every terrace and formation. */
export const jellies: Jelly[] = (() => {
  const r = rnd(21);
  const out: Jelly[] = [];
  for (let i = 0; i < 16; i++) {
    const above = i % 2 === 1;
    const s = 1.4 + r() * 2.0;
    const ph = r() * 10;
    const footprint = JELLY.reach * s + Math.hypot(DRIFT.x, DRIFT.z);
    // Try spots until one fits: a jelly meant for below eye level needs ground low enough under it.
    for (let tries = 0; ; tries++) {
      const a = r() * Math.PI * 2;
      const d = 10 + r() * 50;
      const x = viewer.x + Math.cos(a) * d;
      const z = viewer.z + Math.sin(a) * d;
      const floor = groundAt(x, z, footprint) + JELLY.below * s + CLEAR;
      const want = above ? viewer.eye + 4 + r() * 18 : viewer.eye - 3 - r() * 14;
      const y = Math.max(floor, want);
      const fits = above ? y < viewer.eye + 26 : y + DRIFT.yUp < viewer.eye - 2;
      if (fits || tries > 400) {
        if (!fits) throw new Error(`no room for jellyfish ${i}`);
        out.push({ x, y, z, s, ph, color: i % 3 });
        break;
      }
    }
  }
  return out;
})();

// ---- Crabs ----
// Drawn at scale 1, the legs reach 2.9 to the side and the claws 2.3 forward; times the scale, plus
// a margin, that is the footprint every placement and the test use.
export const CRAB = { scale: 0.9, reach: 3.0 };

export interface Crab {
  x: number;
  z: number;
  span: number;
  ph: number;
}

/** Where a crab is at time t: it walks back and forth along x on its ledge. */
export function crabAt(c: Crab, t: number) {
  const x = c.x + Math.sin(t * 0.25 + c.ph) * c.span;
  return { x, z: c.z, y: groundAt(x, c.z, CRAB.reach) + 0.05 };
}

/** Four glowing blue crabs on ledges near the viewer. Each walks a stretch that is one flat terrace
 *  top, so it never climbs a riser or walks into a formation. */
export const crabs: Crab[] = (() => {
  // [x, z offset from the viewer, phase]: in front of the ledge, close enough to see, far enough
  // that a whole crab fits in view.
  const starts = [
    [5, -11, 0.6],
    [-6, -14, 2.4],
    [13, -19, 4.0],
    [-14, -8, 1.2],
  ];
  const span = 2;
  // A walk is level when the ground under the crab's whole footprint stays flat from end to end.
  const level = (x: number, z: number) => {
    const y = groundAt(x, z, CRAB.reach);
    for (let i = -8; i <= 8; i++) if (Math.abs(groundAt(x + (i / 8) * span, z, CRAB.reach) - y) > 0.02) return false;
    return true;
  };
  return starts.map(([dx, dz, ph]) => {
    // Search outward from the wanted spot, ring by ring, for the nearest level walk.
    for (let ring = 0; ring <= 30; ring++) {
      const n = Math.max(1, ring * 6);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const x = dx + Math.cos(a) * ring * 0.5;
        const z = viewer.z + dz + Math.sin(a) * ring * 0.5;
        if (Math.hypot(x - viewer.x, z - viewer.z) > 3 && level(x, z)) return { x, z, span, ph };
      }
    }
    throw new Error(`no level ledge for the crab near (${dx}, ${dz})`);
  });
})();
