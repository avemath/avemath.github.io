// Fails if any jellyfish or crab on the Research page's seafloor ever passes through a terrace or a
// formation. It runs the scene's own layout (src/lib/seafloor.ts) over two minutes of drift, 20 times
// a second, and checks every creature's whole body against the solid ground under it:
//   - a jellyfish's lowest tentacle tip stays above the highest terrain or slab within its full
//     reach (bell, tentacle sway and drift);
//   - a crab's body and the ends of its legs never sit below the ground under its footprint.
// Run with `npm run test:seafloor` (part of verify; Node 22 runs the TypeScript module directly).
import { jellies, jellyAt, JELLY, crabs, crabAt, CRAB, groundAt, viewer, cameraAt, shallow } from '../src/lib/seafloor.ts';

let problems = 0;
const fail = (msg) => {
  problems++;
  if (problems <= 20) console.log(`  FAIL ${msg}`);
};

for (const [i, j] of jellies.entries()) {
  let minClear = Infinity;
  for (let t = 0; t <= 120; t += 0.05) {
    const p = jellyAt(j, t);
    const lowest = p.y - JELLY.below * j.s;
    const ground = groundAt(p.x, p.z, JELLY.reach * j.s);
    minClear = Math.min(minClear, lowest - ground);
  }
  if (minClear <= 0.25) fail(`jellyfish ${i} comes within ${minClear.toFixed(2)} of the ground or a formation`);
  if (Math.hypot(j.x - viewer.x, j.z - viewer.z) < 8) fail(`jellyfish ${i} sits on top of the viewer`);
}

const above = jellies.filter((j) => j.y > viewer.eye).length;
if (above !== jellies.length / 2) fail(`${above} of ${jellies.length} jellyfish are above eye level; it should be half`);

for (const [i, c] of crabs.entries()) {
  let worst = Infinity;
  for (let t = 0; t <= 120; t += 0.05) {
    const p = crabAt(c, t);
    const under = groundAt(p.x, p.z, CRAB.reach);
    worst = Math.min(worst, p.y - under);
  }
  if (worst < 0) fail(`crab ${i} sinks ${(-worst).toFixed(2)} into the ground`);
  // It walks one ledge: the ground under it stays level along the whole walk.
  const ys = [];
  for (let t = 0; t <= 30; t += 0.25) ys.push(crabAt(c, t).y);
  const drop = Math.max(...ys) - Math.min(...ys);
  if (drop > 0.2) fail(`crab ${i} climbs or drops ${drop.toFixed(2)} along its walk (it should stay on one ledge)`);
}

// No two crabs walk into each other.
for (let t = 0; t <= 120; t += 0.25) {
  const at = crabs.map((c) => crabAt(c, t));
  for (let a = 0; a < at.length; a++)
    for (let b = a + 1; b < at.length; b++)
      if (Math.hypot(at[a].x - at[b].x, at[a].z - at[b].z) < 2 * CRAB.reach) {
        fail(`crabs ${a} and ${b} overlap at t=${t}`);
        t = Infinity;
      }
}

// The camera's way down never enters a terrace or a formation, and moves smoothly.
let prev = null;
for (let p = 0; p <= 1.0001; p += 0.002) {
  const c = cameraAt(p);
  const clear = c.y - groundAt(c.x, c.z, 1.5);
  if (clear < 3) fail(`the camera at depth ${p.toFixed(3)} is only ${clear.toFixed(2)} above the ground`);
  if (prev && Math.abs(c.y - prev.y) > 1.2) fail(`the camera jumps ${Math.abs(c.y - prev.y).toFixed(2)} between depths near ${p.toFixed(3)}`);
  prev = c;
}
// The crabs sit below the shallow camera, in front of it.
for (const [i, c] of crabs.entries()) {
  const y = crabAt(c, 0).y;
  if (y > shallow.eye - 3) fail(`crab ${i} is not below the shallow camera`);
  if (c.z > shallow.z) fail(`crab ${i} is behind the shallow camera`);
}

if (problems) {
  console.log(`\n${problems} seafloor placement problem(s).`);
  process.exit(1);
}
console.log(`seafloor: ${jellies.length} jellyfish and ${crabs.length} crabs stay clear of every terrace and formation.`);
