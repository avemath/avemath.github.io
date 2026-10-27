// Multipath and intersymbol interference. Rectangular BPSK symbols go through a two or three
// path channel: the direct path plus delayed, scaled copies. The receiver samples each symbol at
// its center and decides by sign.
import { mulberry32 } from '../../../lib/comms';
import { q } from './util';

const SYMS = 12;
const SPS = 40; // samples per symbol
const N = SYMS * SPS;

export function init(panel: HTMLElement) {
  const inp = (k: string) => q<HTMLInputElement>(panel, `[data-mp-in="${k}"]`);
  const out = (k: string) => q<HTMLOutputElement>(panel, `[data-mp-out="${k}"]`);
  const plot = (k: string) => q<SVGSVGElement>(panel, `[data-mp-plot="${k}"]`);
  const s = (k: string) => q<HTMLElement>(panel, `[data-mp-s="${k}"]`);
  const status = q<HTMLElement>(panel, '[data-mp-status]');
  const on2 = inp('on2');

  const rand = mulberry32(12);
  const syms = Int8Array.from({ length: SYMS }, () => (rand() < 0.5 ? -1 : 1));
  const tx = Float64Array.from({ length: N }, (_, n) => syms[Math.floor(n / SPS)]);

  function run() {
    const paths = [{ d: 0, g: 1 }, { d: Number(inp('d1').value), g: Number(inp('g1').value) }];
    if (on2.checked) paths.push({ d: Number(inp('d2').value), g: Number(inp('g2').value) });
    out('d1').value = `${paths[1].d.toFixed(2)} symbols`;
    out('g1').value = paths[1].g.toFixed(2);
    out('d2').value = `${Number(inp('d2').value).toFixed(2)} symbols`;
    out('g2').value = Number(inp('g2').value).toFixed(2);
    inp('d2').disabled = inp('g2').disabled = !on2.checked;

    const copies = paths.map(({ d, g }) => {
      const lag = Math.round(d * SPS);
      return Float64Array.from({ length: N }, (_, n) => (n >= lag ? g * tx[n - lag] : 0));
    });
    const rx = Float64Array.from({ length: N }, (_, n) => copies.reduce((a, c) => a + c[n], 0));

    const w = 600;
    const x = (n: number) => (n / N) * w;
    const grid = (h: number) =>
      Array.from({ length: SYMS + 1 }, (_, k) => `<line x1="${x(k * SPS)}" x2="${x(k * SPS)}" y1="0" y2="${h}" stroke="var(--line)" vector-effect="non-scaling-stroke"/>`).join('');
    const line = (v: Float64Array, h: number, max: number) =>
      Array.from(v, (a, n) => `${x(n).toFixed(1)},${(h / 2 - (a / max) * (h / 2)).toFixed(1)}`).join(' ') + ` ${w},${(h / 2 - (v[N - 1] / max) * (h / 2)).toFixed(1)}`;

    plot('tx').innerHTML =
      grid(90) +
      `<line x1="0" x2="${w}" y1="45" y2="45" stroke="var(--line-strong)" vector-effect="non-scaling-stroke"/>` +
      `<polyline points="${line(tx, 90, 1.4)}" fill="none" stroke="var(--accent)" stroke-width="1.8" vector-effect="non-scaling-stroke"/>`;

    const max = Math.max(1.4, ...Array.from(rx, Math.abs)) * 1.1;
    let wrong = 0;
    let margin = Infinity;
    let dots = '';
    const hR = 150;
    for (let k = 0; k < SYMS; k++) {
      const n = k * SPS + SPS / 2;
      const m = rx[n] * syms[k];
      margin = Math.min(margin, m);
      const bad = m <= 0;
      if (bad) wrong++;
      const cy = hR / 2 - (rx[n] / max) * (hR / 2);
      // A short thick line reads as a dot even though the plot stretches sideways.
      dots += `<line x1="${x(n)}" x2="${x(n)}" y1="${cy - 0.01}" y2="${cy + 0.01}" stroke="${bad ? 'var(--danger)' : 'var(--text)'}" stroke-width="${bad ? 10 : 7}" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
    }
    plot('rx').innerHTML =
      grid(hR) +
      `<line x1="0" x2="${w}" y1="${hR / 2}" y2="${hR / 2}" stroke="var(--line-strong)" vector-effect="non-scaling-stroke"/>` +
      copies
        .slice(1)
        .map((c) => `<polyline points="${line(c, hR, max)}" fill="none" stroke="var(--amber-ink)" stroke-width="1" stroke-dasharray="3 3" opacity="0.8" vector-effect="non-scaling-stroke"/>`)
        .join('') +
      `<polyline points="${line(rx, hR, max)}" fill="none" stroke="var(--accent)" stroke-width="1.8" vector-effect="non-scaling-stroke"/>` +
      dots;

    const spread = Math.max(...paths.map((p) => (p.g === 0 ? 0 : p.d)));
    s('spread').textContent = `${spread.toFixed(2)} symbols`;
    s('wrong').textContent = `${wrong} of ${SYMS}`;
    s('margin').textContent = margin.toFixed(2);
    status.textContent = `${wrong} of ${SYMS} symbols decided wrong. Smallest margin ${margin.toFixed(2)}.`;
  }

  const rerun = () => requestAnimationFrame(run);
  ['d1', 'g1', 'd2', 'g2', 'on2'].forEach((k) => inp(k).addEventListener('input', rerun));

  return { show: run };
}
