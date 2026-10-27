// Checks the math behind the signals playground against known textbook values.
// Run with `npm run test:comms` (part of `npm run verify`). Uses Node's type stripping to load
// the same module the page runs, so a wrong formula fails the build instead of shipping.
import { Q, berTheory, ebn0ForBer, dbToLin, constellation, simulateBer, mulberry32, popcount } from '../src/lib/comms.ts';

let failures = 0;
function check(name, ok, detail) {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}  (${detail})`);
  if (!ok) failures++;
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;

check('Q(0) is 0.5', near(Q(0), 0.5, 1e-7), Q(0).toFixed(7));
check('Q(1) is about 0.1587', near(Q(1), 0.158655, 1e-5), Q(1).toFixed(6));
check('Q(3) is about 1.35e-3', near(Q(3), 1.3499e-3, 1e-6), Q(3).toExponential(4));

const bpsk = ebn0ForBer('bpsk', 1e-5);
check('BPSK reaches BER 1e-5 near 9.6 dB', near(bpsk, 9.6, 0.1), `${bpsk.toFixed(2)} dB`);

const qpsk = ebn0ForBer('qpsk', 1e-5);
check('QPSK matches BPSK per bit', near(qpsk, bpsk, 1e-6), `${qpsk.toFixed(2)} dB`);

const qam = ebn0ForBer('16qam', 1e-5);
check('16-QAM needs about 4 dB more than QPSK at 1e-5', near(qam - qpsk, 4, 0.5), `${(qam - qpsk).toFixed(2)} dB more`);

// The old study guide's mistake: using Eb as Es for 8-PSK and leaving off the divide by 3.
const psk8 = ebn0ForBer('8psk', 1e-5);
const wrong8 = (() => {
  let lo = -5, hi = 40;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (Q(Math.sqrt(2 * dbToLin(mid)) * Math.sin(Math.PI / 8)) > 1e-5) lo = mid;
    else hi = mid;
  }
  return lo;
})();
check('8-PSK sits between QPSK and the uncorrected formula', psk8 > qpsk && psk8 < wrong8, `${psk8.toFixed(2)} dB vs ${wrong8.toFixed(2)} dB`);

for (const s of ['bpsk', 'qpsk', '8psk', '16qam']) {
  const pts = constellation(s);
  const es = pts.reduce((a, [x, y]) => a + x * x + y * y, 0) / pts.length;
  check(`${s} average symbol energy is 1`, near(es, 1, 1e-9), es.toFixed(6));
  // Gray coding: each point's closest neighbor differs in exactly one bit.
  const gray = pts.every(([x, y], i) => {
    let best = Infinity;
    pts.forEach(([u, v], j) => j !== i && (best = Math.min(best, (u - x) ** 2 + (v - y) ** 2)));
    return pts.every(([u, v], j) => j === i || (u - x) ** 2 + (v - y) ** 2 > best + 1e-9 || popcount(i ^ j) === 1);
  });
  check(`${s} is Gray coded`, gray, 'nearest neighbors differ by one bit');
}

// The simulator should land on the exact curves.
for (const [s, db] of [['bpsk', 4], ['qpsk', 6]]) {
  const { errors, bits } = simulateBer(s, db, 200000, mulberry32(7));
  const sim = errors / bits;
  const th = berTheory(s, dbToLin(db));
  check(`${s} Monte Carlo at ${db} dB matches theory within 15%`, Math.abs(sim / th - 1) < 0.15, `${sim.toExponential(2)} vs ${th.toExponential(2)}`);
}

if (failures) {
  console.error(`\ntest:comms: ${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\ntest:comms: all checks passed.');
