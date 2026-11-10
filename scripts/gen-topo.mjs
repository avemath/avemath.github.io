// Generates public/topo.svg: the faint topographic contour lines behind the site's sections (used as
// a CSS mask over the ink color, so they follow the theme).
//
// The tile repeats across the whole page, so its edges must meet with no break: left edge to right edge and
// top to bottom. The height field is periodic over exactly one 1600 by 900 tile: a sum of
// sinusoids, each with a whole number of periods across the width and the height. It is sampled on
// a grid padded by one wrapped cell on every side, traced with d3-contour, and every line is clipped
// exactly to the tile, so a line leaving one edge is cut at the same point where it comes back in
// on the opposite edge. The run checks that, and keeps the total line length close to the previous
// file's so the density and spacing read the same (same stroke, 1.2, round joins).
//
// Seeded, so the file is the same on every run. Run with `node scripts/gen-topo.mjs`; commit the output.
import { writeFile, readFile } from 'node:fs/promises';
import { contours } from 'd3-contour';

const W = 1600;
const H = 900;
// Samples: about one every 8px each way (200 across, 113 down), each axis scaled exactly to the tile.
const NX = 200;
const NY = 113;
const SX = W / NX;
const SY = H / NY;

let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

// Wave terms: (p, q) whole periods across the width and the height, an amplitude falling off with
// frequency like the old layered noise, and a random phase.
const terms = [];
// Frequencies up to about 22 periods across, like the old four octaves of noise (3 to 24 cells
// across), so the lines keep their fine wiggle as well as the big shapes.
for (let p = -22; p <= 22; p++) {
  for (let q = 0; q <= 12; q++) {
    if (q === 0 && p <= 0) continue; // each direction once
    const k = Math.hypot(p, (q * W) / H);
    if (k < 1.5 || k > 16) continue;
    terms.push({ p, q, a: (0.3 + rnd()) / k ** 2.1, ph: rnd() * Math.PI * 2 });
  }
}
const field = (x, y) => {
  let h = 0;
  for (const t of terms) h += t.a * Math.sin(2 * Math.PI * ((t.p * x) / W + (t.q * y) / H) + t.ph);
  return h;
};

// Sample on a padded grid: sample (i, j) sits at grid coordinate (i + 0.5, j + 0.5) in d3-contour's
// output, and represents the tile point ((i - 1 + 0.5) * SX, (j - 1 + 0.5) * SY).
const gw = NX + 2;
const gh = NY + 2;
const values = new Float64Array(gw * gh);
for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) values[j * gw + i] = field((i - 1 + 0.5) * SX, (j - 1 + 0.5) * SY);
const lo = Math.min(...values);
const hi = Math.max(...values);

async function oldLength() {
  try {
    const old = await readFile(new URL('../public/topo.svg', import.meta.url), 'utf8');
    const d = old.match(/ d="([^"]+)"/)?.[1] ?? '';
    let len = 0;
    for (const sub of d.split('M').filter(Boolean)) {
      const pts = sub.split('L').map((s) => s.trim().split(/\s+/).map(Number));
      for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    }
    return len;
  } catch {
    return 0;
  }
}

// Liang-Barsky: clip one segment to the tile [0, W] x [0, H].
function clip(a, b) {
  let t0 = 0;
  let t1 = 1;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  for (const [p, q] of [
    [-dx, a[0]],
    [dx, W - a[0]],
    [-dy, a[1]],
    [dy, H - a[1]],
  ]) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }
  return [
    [a[0] + t0 * dx, a[1] + t0 * dy],
    [a[0] + t1 * dx, a[1] + t1 * dy],
  ];
}

function trace(levels) {
  const thresholds = Array.from({ length: levels - 1 }, (_, l) => lo + ((hi - lo) * (l + 1)) / levels);
  const polys = [];
  for (const mp of contours().size([gw, gh]).thresholds(thresholds)(values)) {
    for (const poly of mp.coordinates) {
      for (const ring of poly) {
        // Grid coordinates to tile pixels; the padding cell is outside the tile.
        const pts = ring.map(([x, y]) => [(x - 1) * SX, (y - 1) * SY]);
        let cur = [];
        const flush = () => {
          if (cur.length > 1) polys.push(cur);
          cur = [];
        };
        for (let i = 1; i < pts.length; i++) {
          const c = clip(pts[i - 1], pts[i]);
          // Drop pieces that run along the padded grid's frame (the region outline, not a contour).
          const onFrame = (p) => p[0] <= -SX + 1e-6 || p[0] >= W + SX - 1e-6 || p[1] <= -SY + 1e-6 || p[1] >= H + SY - 1e-6;
          if (!c || (onFrame(pts[i - 1]) && onFrame(pts[i]))) {
            flush();
            continue;
          }
          const [a, b] = c;
          if (!cur.length) cur.push(a);
          else {
            const last = cur[cur.length - 1];
            if (Math.hypot(last[0] - a[0], last[1] - a[1]) > 1e-6) {
              flush();
              cur.push(a);
            }
          }
          cur.push(b);
          // A segment cut by the tile edge ends the line there.
          if (b[0] !== pts[i][0] || b[1] !== pts[i][1]) flush();
        }
        flush();
      }
    }
  }
  return polys;
}
const lengthOf = (polys) => polys.reduce((s, p) => s + p.slice(1).reduce((t, q, i) => t + Math.hypot(q[0] - p[i][0], q[1] - p[i][1]), 0), 0);

// Match the old file's density by choosing the number of levels whose total length is closest.
const target = (await oldLength()) || 0;
let best = null;
for (let levels = 8; levels <= 30; levels++) {
  const polys = trace(levels);
  const len = lengthOf(polys);
  if (!best || Math.abs(len - target) < Math.abs(best.len - target)) best = { levels, polys, len };
  if (!target) break;
}
const { polys, levels, len } = best;

// Seam check: every point where a line meets an edge has a partner on the opposite edge.
const ends = polys.flatMap((p) => [p[0], p[p.length - 1]]);
const near = (v, w) => Math.abs(v - w) < 0.05;
let unmatched = 0;
for (const [x, y] of ends) {
  let partner = null;
  if (near(x, 0)) partner = [W, y];
  else if (near(x, W)) partner = [0, y];
  else if (near(y, 0)) partner = [x, H];
  else if (near(y, H)) partner = [x, 0];
  if (!partner) continue;
  if (!ends.some(([u, v]) => near(u, partner[0]) && near(v, partner[1]))) unmatched++;
}
if (unmatched) {
  console.error(`topo.svg: ${unmatched} line ends at an edge have no partner on the opposite edge.`);
  process.exit(1);
}

// Thin the points: Douglas-Peucker at half a pixel, invisible under a 1.2px stroke. The ends (where
// a line meets an edge) always stay exactly where they are.
function simplify(pts, tol = 0.5) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  let far = 0;
  let at = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const dist = len ? Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len : Math.hypot(p[0] - a[0], p[1] - a[1]);
    if (dist > far) (far = dist), (at = i);
  }
  if (far <= tol) return [a, b];
  return [...simplify(pts.slice(0, at + 1), tol).slice(0, -1), ...simplify(pts.slice(at), tol)];
}
const f = (n) => (Math.round(n * 10) / 10).toFixed(1);
const d = polys.map((p) => 'M' + simplify(p).map(([x, y]) => `${f(x)} ${f(y)}`).join('L')).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><path fill="none" stroke="#000" stroke-width="1.2" stroke-linejoin="round" d="${d}"/></svg>\n`;
await writeFile(new URL('../public/topo.svg', import.meta.url), svg);
console.log(`topo.svg: ${levels} levels, ${polys.length} lines, total length ${Math.round(len)} px (previous ${Math.round(target)} px), ${(svg.length / 1024).toFixed(1)} KB, every edge crossing matched.`);
