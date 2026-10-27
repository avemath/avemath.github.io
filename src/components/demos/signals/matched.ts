// Matched filter preamble detection. A seeded ±1 preamble is hidden in white noise, and the
// receiver slides a copy of it along the signal. Everything random comes from one seed per
// draw, so the sliders change the picture smoothly instead of redrawing the noise.
import { gaussian, mulberry32 } from '../../../lib/comms';
import { polyline, q } from './util';

const N = 512;
const MAX_LEN = 128;

export function init(panel: HTMLElement) {
  const inNoise = q<HTMLInputElement>(panel, '[data-mf-in="noise"]');
  const inLen = q<HTMLInputElement>(panel, '[data-mf-in="len"]');
  const outNoise = q<HTMLOutputElement>(panel, '[data-mf-out="noise"]');
  const outLen = q<HTMLOutputElement>(panel, '[data-mf-out="len"]');
  const plot = (k: string) => q<SVGSVGElement>(panel, `[data-mf-plot="${k}"]`);
  const s = (k: string) => q<HTMLElement>(panel, `[data-mf-s="${k}"]`);
  const status = q<HTMLElement>(panel, '[data-mf-status]');

  let seed = 31;
  let pre: Int8Array;
  let noise: Float64Array;
  let pos = 0;

  function draw() {
    const rand = mulberry32(seed);
    const g = gaussian(rand);
    pre = Int8Array.from({ length: MAX_LEN }, () => (rand() < 0.5 ? -1 : 1));
    noise = Float64Array.from({ length: N }, g);
    pos = Math.floor(rand() * (N - MAX_LEN));
  }

  function run() {
    const sigma = Number(inNoise.value);
    const len = Number(inLen.value);
    outNoise.value = sigma.toFixed(1);
    outLen.value = `${len} chips`;

    const rx = new Float64Array(N);
    for (let n = 0; n < N; n++) rx[n] = sigma * noise[n] + (n >= pos && n < pos + len ? pre[n - pos] : 0);

    // Correlate, normalized by length so a perfect match with no noise peaks at 1.
    const M = N - len + 1;
    const corr = new Float64Array(M);
    let peak = 0;
    for (let m = 0; m < M; m++) {
      let acc = 0;
      for (let k = 0; k < len; k++) acc += rx[m + k] * pre[k];
      corr[m] = acc / len;
      if (corr[m] > corr[peak]) peak = m;
    }
    // Biggest value away from the peak, past any partial overlap with the preamble.
    let side = 0;
    for (let m = 0; m < M; m++) if (Math.abs(m - peak) >= len) side = Math.max(side, Math.abs(corr[m]));

    const found = peak === pos;
    const w = 600;

    plot('pre').innerHTML =
      `<line x1="0" x2="${w}" y1="35" y2="35" stroke="var(--line)" vector-effect="non-scaling-stroke"/>` +
      `<polyline points="${stepLine(pre.subarray(0, len), w, 70, 1.4)}" fill="none" stroke="var(--accent)" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`;

    const rxMax = Math.max(1.5, 1 + 3 * sigma);
    const x = (n: number) => (n / (N - 1)) * w;
    plot('rx').innerHTML =
      `<rect x="${x(pos)}" width="${x(pos + len) - x(pos)}" y="0" height="120" fill="var(--accent-wash-strong)" opacity="${found ? 1 : 0}"/>` +
      `<line x1="0" x2="${w}" y1="60" y2="60" stroke="var(--line)" vector-effect="non-scaling-stroke"/>` +
      `<polyline points="${polyline(rx, w, 120, -rxMax, rxMax)}" fill="none" stroke="var(--text-soft)" stroke-width="1" vector-effect="non-scaling-stroke"/>`;

    const cMin = -0.5, cMax = 1.25;
    const cy = (v: number) => 120 - ((v - cMin) / (cMax - cMin)) * 120;
    const cx = (m: number) => (m / (N - 1)) * w;
    plot('corr').innerHTML =
      `<line x1="0" x2="${w}" y1="${cy(0)}" y2="${cy(0)}" stroke="var(--line)" vector-effect="non-scaling-stroke"/>` +
      `<line x1="0" x2="${w}" y1="${cy(side)}" y2="${cy(side)}" stroke="var(--muted)" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/>` +
      `<line x1="${cx(pos)}" x2="${cx(pos)}" y1="112" y2="120" stroke="var(--amber-ink)" stroke-width="3" vector-effect="non-scaling-stroke"/>` +
      `<polyline points="${Array.from(corr, (v, m) => `${cx(m).toFixed(1)},${cy(Math.min(cMax, Math.max(cMin, v))).toFixed(1)}`).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="1.5" vector-effect="non-scaling-stroke"/>` +
      `<line x1="${cx(peak)}" x2="${cx(peak)}" y1="${cy(Math.min(cMax, corr[peak]))}" y2="${cy(0)}" stroke="${found ? 'var(--accent)' : 'var(--danger)'}" stroke-width="3" vector-effect="non-scaling-stroke"/>`;

    const ratio = side > 0 ? corr[peak] / side : Infinity;
    s('true').textContent = String(pos);
    s('found').textContent = `${peak} ${found ? '(right)' : '(wrong)'}`;
    s('ratio').textContent = Number.isFinite(ratio) ? `${ratio.toFixed(1)}×` : 'no noise';
    status.textContent = found
      ? `Found at sample ${peak}. The peak is ${Number.isFinite(ratio) ? ratio.toFixed(1) : 'far'} times the next highest value.`
      : `Missed: the peak landed at sample ${peak}, but the preamble starts at ${pos}.`;
  }

  /** A ±1 sequence drawn as a square wave across a given width. */
  function stepLine(v: ArrayLike<number>, width: number, h: number, max: number) {
    const dx = width / v.length;
    const y = (a: number) => (h / 2 - (a / max) * (h / 2)).toFixed(1);
    let out = '';
    for (let i = 0; i < v.length; i++) out += `${(i * dx).toFixed(1)},${y(v[i])} ${((i + 1) * dx).toFixed(1)},${y(v[i])} `;
    return out;
  }

  const rerun = () => requestAnimationFrame(run);
  inNoise.addEventListener('input', rerun);
  inLen.addEventListener('input', rerun);
  q(panel, '[data-mf="new"]').addEventListener('click', () => {
    seed = (seed * 48271) % 2147483647;
    draw();
    run();
  });

  draw();
  return { show: run };
}
