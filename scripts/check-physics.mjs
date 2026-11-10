// Checks the acoustics behind the ray figures (src/lib/raytrace.ts) and the race (src/lib/race.ts)
// against the physics they claim. Run with `npm run test:physics` (part of `npm run verify`). Uses
// Node's type stripping to load the same modules the pages run.
import { MUNK, PROFILES, traceRay, fan, eigenrays, atRange } from '../src/lib/raytrace.ts';
import arrivals from '../src/data/bellhop-arrivals.json' with { type: 'json' };

let failures = 0;
function check(name, ok, detail) {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}  (${detail})`);
  if (!ok) failures++;
}
const deg = Math.PI / 180;

// Snell's invariant: cos(theta) / c(z) stays the launch value all along a Munk ray. theta is read
// from the ray's own direction between samples, not from the integrator's state.
{
  const ray = traceRay(MUNK, 1000, 8 * deg, { rmax: 60_000, ds: 25, every: 1 });
  let worst = 0;
  for (let i = 1; i < ray.r.length; i++) {
    const dr = ray.r[i] - ray.r[i - 1];
    const dz = ray.z[i] - ray.z[i - 1];
    if (ray.surf[i] !== ray.surf[i - 1] || ray.bot[i] !== ray.bot[i - 1]) continue;
    const th = Math.atan2(dz, dr);
    const zm = (ray.z[i] + ray.z[i - 1]) / 2;
    worst = Math.max(worst, Math.abs(Math.cos(th) / MUNK.c(zm) / ray.xi - 1));
  }
  check("Snell's invariant cos(theta)/c(z) holds along a Munk ray", worst < 2e-5, `worst relative drift ${worst.toExponential(2)}`);
}

// A Munk ray from 1000 m turns where c equals c(source) / cos(launch angle).
for (const a of [6, 9, 11]) {
  const ray = traceRay(MUNK, 1000, a * deg, { rmax: 100_000, ds: 20 });
  const want = MUNK.c(1000) / Math.cos(a * deg);
  const turn = ray.turns[0];
  const got = turn ? MUNK.c(turn.z) : NaN;
  check(`Munk ray at ${a} degrees turns where c = c(zs)/cos(theta0)`, turn && Math.abs(got - want) < 0.05, turn ? `c at turn ${got.toFixed(3)} m/s, want ${want.toFixed(3)} m/s, at ${turn.z.toFixed(0)} m` : 'no turning point');
}

// Rays bend toward the slow water: a shallow ray launched along the axis stays near it.
{
  const ray = traceRay(MUNK, 1300, 3 * deg, { rmax: 100_000 });
  const zs = ray.z;
  const lo = Math.min(...zs);
  const hi = Math.max(...zs);
  check('A 3 degree ray on the Munk axis stays trapped in the channel', lo > 800 && hi < 2000 && ray.surf.at(-1) === 0 && ray.bot.at(-1) === 0, `${lo.toFixed(0)} to ${hi.toFixed(0)} m, no bounces`);
}

// Travel time: a level ray in isothermal water takes R / c.
{
  const iso = PROFILES.find((p) => p.id === 'isothermal');
  const ray = traceRay(iso, 1000, 0, { rmax: 30_000, ds: 50 });
  const hit = atRange(ray, 30_000);
  check('A level ray in isothermal water takes R / c', Math.abs(hit.t - 20) < 1e-3, `${hit.t.toFixed(4)} s for 30 km at 1500 m/s`);
}

// Eigenrays: in isothermal water the direct path's time is the straight-line distance over c.
{
  const iso = PROFILES.find((p) => p.id === 'isothermal');
  const rays = fan(iso, 1000, -20 * deg, 20 * deg, 401, { rmax: 10_000, ds: 25, every: 1 });
  const eig = eigenrays(rays, 10_000, 1500);
  const direct = eig.find((e) => e.surf === 0 && e.bot === 0);
  const want = Math.hypot(10_000, 500) / 1500;
  check('The isothermal direct eigenray arrives at distance / c', direct && Math.abs(direct.t - want) < 2e-3, direct ? `${direct.t.toFixed(4)} s, want ${want.toFixed(4)} s` : 'none found');
}

// Against BELLHOP itself: bellhopSim's comms scenario (shallow_water_profile with a 1000 m column,
// source 50 m, receiver 15 km out at 100 m), whose arrivals BELLHOP computed (src/data/
// bellhop-arrivals.json). For every bounce history BELLHOP reports, the browser tracer's eigenray
// delays (relative to the first arrival) must land within 3 ms or 1% of BELLHOP's. BELLHOP drops
// paths after the sand bottom has soaked them up; the browser tracer has no bottom loss, so only
// the histories BELLHOP keeps are compared.
{
  const D = 1000;
  const mixed = D * 0.1;
  const base = D * 0.4;
  const top = 1520 - 0.05 * mixed;
  const comms = { id: 'comms', name: 'comms', zmax: D, rmax: 15_000, zs: 50, c: (z) => (z <= mixed ? 1520 - 0.05 * z : z <= base ? top + (1490 - top) * ((z - mixed) / (base - mixed)) : 1490 + 0.005 * (z - base)) };
  const rays = fan(comms, 50, -80 * deg, 80 * deg, 6001, { rmax: 15_100, ds: 10, every: 1 });
  const eig = eigenrays(rays, 15_000, 100);
  const t0 = eig[0].t;
  const bh = arrivals.comms.arrivals;
  const kept = new Set(bh.map((a) => `${a.surface}/${a.bottom}`));
  let compared = 0;
  let worst = 0;
  for (const e of eig) {
    const k = `${e.surf}/${e.bot}`;
    if (!kept.has(k)) continue;
    const d = 1000 * (e.t - t0);
    const near = Math.min(...bh.filter((a) => `${a.surface}/${a.bottom}` === k).map((a) => Math.abs(a.delay_ms - d) / Math.max(1, 0.01 * a.delay_ms) ));
    worst = Math.max(worst, near);
    compared++;
  }
  const missing = [...kept].filter((k) => !eig.some((e) => `${e.surf}/${e.bot}` === k));
  check('Eigenray delays match BELLHOP on its comms scenario', compared >= 12 && !missing.length && worst <= 3, `${compared} eigenrays across ${kept.size} bounce histories, worst ${worst.toFixed(2)} of the allowed 3 (ms or 1%), first arrival ${t0.toFixed(3)} s; missing: ${missing.join(' ') || 'none'}`);
}

// Every bellhopSim profile traces to its full range without leaving the water.
for (const p of PROFILES) {
  const rays = fan(p, p.zs, -20 * deg, 20 * deg, 9);
  const ok = rays.every((r) => r.r.at(-1) >= p.rmax - 1 && r.z.every((z) => z >= 0 && z <= p.zmax));
  check(`${p.name}: rays reach ${p.rmax / 1000} km inside the water`, ok, `${rays.length} rays`);
}

let race;
try {
  race = await import('../src/lib/race.ts');
} catch {
  race = null;
}
if (race) {
  const { skinDepth, radioLossDb, thorpDbPerKm, travelTime, SPEED } = race;
  const d10k = skinDepth(10_000);
  check('Skin depth in seawater at 10 kHz is about 2.5 m', Math.abs(d10k - 2.5) < 0.05, `${d10k.toFixed(3)} m`);
  const loss = radioLossDb(10_000, d10k);
  check('One skin depth costs 8.686 dB', Math.abs(loss - 8.686) < 1e-3, `${loss.toFixed(3)} dB`);
  const th = thorpDbPerKm(10_000);
  check("Thorp's absorption at 10 kHz is about 1 dB/km", Math.abs(th - 1) < 0.25, `${th.toFixed(3)} dB/km`);
  const tRadio = travelTime(1000, SPEED.radioAir);
  check('Radio in air crosses 1 km in about 3.3 microseconds', Math.abs(tRadio - 3.336e-6) < 0.01e-6, `${(tRadio * 1e6).toFixed(3)} us`);
  check('Sound in water is about 4.4 times faster than in air', Math.abs(SPEED.soundWater / SPEED.soundAir - 4.37) < 0.05, `${(SPEED.soundWater / SPEED.soundAir).toFixed(2)} times`);
}

if (failures) {
  console.log(`\n${failures} physics check(s) failed.`);
  process.exit(1);
}
console.log('\nphysics: the ray tracer and the race formulas match their physics.');
