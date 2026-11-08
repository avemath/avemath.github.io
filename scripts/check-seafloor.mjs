// Fails if any jellyfish or crab on the Research page's seafloor ever passes through a terrace or a
// formation. It runs the scene's own layout (src/lib/seafloor.ts) over two minutes of drift, 20 times
// a second, and checks every creature's whole body against the solid ground under it:
//   - a jellyfish's lowest tentacle tip stays above the highest terrain or slab within its full
//     reach (bell, tentacle sway and drift);
//   - a crab's body and the ends of its legs never sit below the ground under its footprint.
// Run with `npm run test:seafloor` (part of verify; Node 22 runs the TypeScript module directly).
import { jellies, jellyAt, JELLY, crabs, crabAt, CRAB, groundAt, viewer } from '../src/lib/seafloor.ts';

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

if (problems) {
  console.log(`\n${problems} seafloor placement problem(s).`);
  process.exit(1);
}
console.log(`seafloor: ${jellies.length} jellyfish and ${crabs.length} crabs stay clear of every terrace and formation.`);
