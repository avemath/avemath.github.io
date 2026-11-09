// Generates public/topo.svg: topographic contour lines from layered noise, like stacked paper. The
// home hero shows it behind everything at about 6% opacity (as a CSS mask over the ink color, so it
// follows the theme), and the Research teaser draws the same lines glowing over the seafloor.
// Seeded, so the file is the same on every run. Run with `node scripts/gen-topo.mjs`; commit the output.
import { writeFile } from 'node:fs/promises';

const W = 1600;
const H = 900;
const NX = 200; // grid cells across
const NY = Math.round((NX * H) / W);
const LEVELS = 16;

let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

// Smooth value noise on a lattice, summed over four octaves.
function lattice(n) {
  const g = Array.from({ length: (n + 2) * (n + 2) }, () => rnd());
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const s = (t) => t * t * (3 - 2 * t);
    const at = (i, j) => g[(j % (n + 1)) * (n + 2) + (i % (n + 1))];
    const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * s(fx);
    const b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * s(fx);
    return a + (b - a) * s(fy);
  };
}
const octaves = [
  [lattice(8), 3, 1],
  [lattice(16), 6, 0.5],
  [lattice(32), 12, 0.25],
  [lattice(64), 24, 0.12],
];
const field = (u, v) => {
  let h = 0;
  let w = 0;
  for (const [f, scale, amp] of octaves) {
    h += f(u * scale, v * scale * (H / W)) * amp;
    w += amp;
  }
  return h / w;
};

const grid = [];
for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) grid.push(field(i / NX, j / NY));
const val = (i, j) => grid[j * (NX + 1) + i];
const lo = Math.min(...grid);
const hi = Math.max(...grid);

// Marching squares: segments per level, joined into polylines.
const paths = [];
for (let l = 1; l < LEVELS; l++) {
  const t = lo + ((hi - lo) * l) / LEVELS;
  const segs = [];
  const edge = (i0, j0, i1, j1) => {
    const a = val(i0, j0);
    const b = val(i1, j1);
    const k = (t - a) / (b - a);
    return [((i0 + (i1 - i0) * k) * W) / NX, ((j0 + (j1 - j0) * k) * H) / NY];
  };
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const c = (val(i, j) > t ? 8 : 0) | (val(i + 1, j) > t ? 4 : 0) | (val(i + 1, j + 1) > t ? 2 : 0) | (val(i, j + 1) > t ? 1 : 0);
      if (c === 0 || c === 15) continue;
      const top = () => edge(i, j, i + 1, j);
      const right = () => edge(i + 1, j, i + 1, j + 1);
      const bottom = () => edge(i, j + 1, i + 1, j + 1);
      const left = () => edge(i, j, i, j + 1);
      const table = {
        1: [[left, bottom]], 2: [[bottom, right]], 3: [[left, right]], 4: [[top, right]],
        5: [[left, top], [bottom, right]], 6: [[top, bottom]], 7: [[left, top]], 8: [[left, top]],
        9: [[top, bottom]], 10: [[left, bottom], [top, right]], 11: [[top, right]], 12: [[left, right]],
        13: [[bottom, right]], 14: [[left, bottom]],
      };
      for (const [a, b] of table[c]) segs.push([a(), b()]);
    }
  }
  // Join segments that share an end into longer lines.
  const key = (p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`;
  const ends = new Map();
  segs.forEach((s, n) => {
    for (const p of s) {
      const k = key(p);
      if (!ends.has(k)) ends.set(k, []);
      ends.get(k).push(n);
    }
  });
  const used = new Set();
  for (let n = 0; n < segs.length; n++) {
    if (used.has(n)) continue;
    used.add(n);
    const line = [...segs[n]];
    for (const dir of [1, -1]) {
      for (;;) {
        const tip = dir === 1 ? line[line.length - 1] : line[0];
        const next = (ends.get(key(tip)) || []).find((m) => !used.has(m));
        if (next === undefined) break;
        used.add(next);
        const [a, b] = segs[next];
        const other = key(a) === key(tip) ? b : a;
        if (dir === 1) line.push(other);
        else line.unshift(other);
      }
    }
    if (line.length < 4) continue;
    // Thin the points: keep every other one on long lines, rounded to 0.1 px.
    const pts = line.filter((_, k) => k % 2 === 0 || k === line.length - 1);
    paths.push('M' + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L'));
  }
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><path fill="none" stroke="#000" stroke-width="1.2" stroke-linejoin="round" d="${paths.join('')}"/></svg>\n`;
await writeFile('public/topo.svg', svg);
console.log(`public/topo.svg: ${paths.length} lines, ${(svg.length / 1024).toFixed(0)} KB`);
