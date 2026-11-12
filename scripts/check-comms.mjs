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

// The hero's preamble: real JANUS numbers, every tone inside the band, and click-free audio.
const { preamble, synthesize, CHIPS, CHIP_MS, LISTEN_STRETCH } = await import('../src/lib/preamble.ts');
const chips = preamble();
check('Preamble has 32 chips of 6.25 ms', chips.length === 32 && CHIPS * CHIP_MS === 200, `${chips.length} chips, ${CHIPS * CHIP_MS} ms`);
check('Every preamble tone is inside 9440 to 13600 Hz', chips.every((c) => c.hz > 9440 && c.hz < 13600), `${Math.min(...chips.map((c) => c.hz))} to ${Math.max(...chips.map((c) => c.hz))} Hz`);
check('The hop never stays on the same pair twice in a row', chips.every((c, i) => i === 0 || c.pair !== chips[i - 1].pair), 'checked 31 hops');
const sr = 48000;
const audio = synthesize(chips, sr);
const chipLen = (CHIP_MS * LISTEN_STRETCH * sr) / 1000;
check('Playback is 2 s long and starts at chip 0', audio.length === 2 * sr && audio[0] === 0, `${audio.length / sr} s`);
// A click is a jump between neighboring samples. With the ramps, the largest jump at any chip
// join is no bigger than the largest step inside a steady tone.
let maxJoin = 0;
for (let i = 1; i < CHIPS; i++) maxJoin = Math.max(maxJoin, Math.abs(audio[i * chipLen] - audio[i * chipLen - 1]));
const { LISTEN_PITCH } = await import('../src/lib/fhbfsk.ts');
const steady = 0.18 * 2 * Math.sin((Math.PI * 13600 * LISTEN_PITCH) / sr);
// Listening is lowered three octaves: count the first chip's zero crossings.
{
  let zc = 0;
  for (let n = 1; n < chipLen; n++) if ((audio[n - 1] < 0) !== (audio[n] < 0)) zc++;
  const hz = (zc / 2) / (chipLen / sr);
  check('Playback is three octaves below the real tone', Math.abs(hz - chips[0].hz * LISTEN_PITCH) < 15 && LISTEN_PITCH === 1 / 8, `${hz.toFixed(0)} Hz for a ${chips[0].hz} Hz chip`);
}
check('No clicks at chip joins', maxJoin < 1e-3 && maxJoin < steady, `largest join step ${maxJoin.toExponential(2)}`);

// The mesh playground's link (src/lib/fhbfsk.ts): text to bits and back, a clean channel decodes
// exactly, a noisy one makes errors, and Doppler shifts the tones.
{
  const { textToBits, bitsToText, modulate, channel, demodulate, FS, CHIP_N } = await import('../src/lib/fhbfsk.ts');
  const msg = 'hi from Ave';
  const bits = textToBits(msg);
  check('Text to bits and back', bitsToText(bits) === msg && bits.length === 88, `${bits.length} bits`);
  const { x } = modulate(bits);
  check('One 6.25 ms chip per bit at 48 kHz', x.length === bits.length * CHIP_N && CHIP_N === 300 && FS === 48000, `${x.length} samples`);
  const rx = (snrDb, extra = {}) => {
    const y = channel(x, { snrDb, echoMs: 0, echoGain: 0, speed: 0, seed: 3, ...extra });
    const r = demodulate(y, bits.length).bits;
    return { errs: r.filter((b, i) => b !== bits[i]).length, text: bitsToText(r) };
  };
  const hi = rx(30);
  check('30 dB SNR decodes exactly', hi.errs === 0 && hi.text === msg, `${hi.errs} errors, "${hi.text}"`);
  const lo = rx(-20);
  check('-20 dB SNR makes bit errors', lo.errs >= 1, `${lo.errs} errors`);
  const echo = rx(30, { echoMs: 2.4, echoGain: 0.36 });
  check('A moderate surface echo still decodes', echo.errs === 0, `${echo.errs} errors`);
  const fast = rx(30, { speed: 12 });
  check('12 m/s of Doppler costs bits', fast.errs >= 1, `${fast.errs} errors`);
}

if (failures) {
  console.error(`\ntest:comms: ${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\ntest:comms: all checks passed.');
