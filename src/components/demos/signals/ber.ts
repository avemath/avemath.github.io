// BER against Eb/N0: theory curves, plus a Monte Carlo run for one scheme so you can see the
// curve hold. The simulation runs in small slices so the page stays responsive.
import { berTheory, dbToLin, ebn0ForBer, mulberry32, schemes, simulateBer, type Scheme } from '../../../lib/comms';
import { q } from './util';

// Plot size in SVG units; phones get a smaller box so the axis text stays readable.
let W = 520, H = 400;
const L = 58, R = 14, T = 14, B = 40;
const X_MAX = 20;
const Y_MIN = -7; // 1e-7
const Y_MAX = 0; // 1
const MAX_BITS = 1_000_000; // per point
const MIN_ERRORS = 10; // plot a dot only with at least this many errors
const SLICE = 20_000; // symbols per slice

const curves: { id: Scheme | 'bq'; label: string; scheme: Scheme; color: string; dash: boolean }[] = [
  { id: 'bq', label: 'BPSK and QPSK', scheme: 'bpsk', color: 'var(--accent)', dash: false },
  { id: '8psk', label: '8-PSK (approx.)', scheme: '8psk', color: 'var(--amber-ink)', dash: true },
  { id: '16qam', label: '16-QAM (approx.)', scheme: '16qam', color: 'var(--text-soft)', dash: true },
];

const px = (db: number) => L + (db / X_MAX) * (W - L - R);
const py = (ber: number) => T + ((Y_MAX - Math.log10(Math.max(ber, 10 ** (Y_MIN - 1)))) / (Y_MAX - Y_MIN)) * (H - T - B);
const curveId = (s: Scheme) => (s === 'bpsk' || s === 'qpsk' ? 'bq' : s);

type Point = { db: number; errors: number; bits: number };

export function init(panel: HTMLElement) {
  const svg = q<SVGSVGElement>(panel, '[data-ber-plot]');
  const radios = [...panel.querySelectorAll<HTMLInputElement>('[data-ber-scheme]')];
  const simBtn = q<HTMLButtonElement>(panel, '[data-ber="sim"]');
  const status = q<HTMLElement>(panel, '[data-ber-status]');
  const tableWrap = q<HTMLElement>(panel, '[data-ber-table]');
  const rows = q<HTMLElement>(panel, '[data-ber-rows]');
  const results = new Map<Scheme, Point[]>();
  let runs = 0;
  let busy = false;

  const selected = () => (radios.find((r) => r.checked)?.value ?? 'bpsk') as Scheme;

  // Reference numbers, computed from the same formulas the curves use.
  const b5 = ebn0ForBer('bpsk', 1e-5), q16 = ebn0ForBer('16qam', 1e-5), p8 = ebn0ForBer('8psk', 1e-5);
  q(panel, '[data-ber-ref]').textContent =
    `At a BER of 1e-5, BPSK and QPSK need ${b5.toFixed(1)} dB, 8-PSK about ${p8.toFixed(1)} dB and 16-QAM about ${q16.toFixed(1)} dB. ` +
    `So 16-QAM costs about ${(q16 - b5).toFixed(1)} dB more than QPSK for twice the bits per symbol.`;

  q(panel, '[data-ber-legend]').innerHTML =
    curves.map((c) => `<li><span class="sw" style="background:${c.color}"></span>${c.label}</li>`).join('') +
    '<li><span class="sw" style="background:var(--text);border-radius:50%"></span>Simulated</li>';

  function draw() {
    const narrow = svg.getBoundingClientRect().width < 460;
    W = narrow ? 340 : 520;
    H = narrow ? 300 : 400;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const sel = curveId(selected());
    let h = '';
    for (let e = Y_MIN; e <= Y_MAX; e++) {
      const yy = py(10 ** e);
      h += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="var(--line)"/>`;
      h += `<text x="${L - 6}" y="${yy + 4}" text-anchor="end">${e === 0 ? '1' : `1e${e}`}</text>`;
    }
    for (let d = 0; d <= X_MAX; d += 2) {
      const xx = px(d);
      h += `<line x1="${xx}" x2="${xx}" y1="${T}" y2="${H - B}" stroke="var(--line)" stroke-dasharray="2 4"/>`;
      h += `<text x="${xx}" y="${H - B + 16}" text-anchor="middle">${d}</text>`;
    }
    h += `<text x="${(L + W - R) / 2}" y="${H - 6}" text-anchor="middle">Eb/N0, dB</text>`;
    h += `<text x="12" y="${(T + H - B) / 2}" transform="rotate(-90 12 ${(T + H - B) / 2})" text-anchor="middle">bit error rate</text>`;
    h += `<clipPath id="ber-clip"><rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}"/></clipPath>`;
    h += `<g clip-path="url(#ber-clip)">`;
    for (const c of curves) {
      let pts = '';
      for (let d = 0; d <= X_MAX; d += 0.1) pts += `${px(d).toFixed(1)},${py(berTheory(c.scheme, dbToLin(d))).toFixed(1)} `;
      const on = c.id === sel;
      h += `<polyline points="${pts}" fill="none" stroke="${c.color}" stroke-width="${on ? 2.6 : 1.6}" opacity="${on ? 1 : 0.7}"${c.dash ? ' stroke-dasharray="6 4"' : ''}/>`;
    }
    for (const p of results.get(selected()) ?? []) {
      if (p.errors < MIN_ERRORS) continue;
      h += `<circle cx="${px(p.db)}" cy="${py(p.errors / p.bits)}" r="4.5" fill="var(--text)" stroke="var(--bg)" stroke-width="1.5"/>`;
    }
    h += `</g><rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="none" stroke="var(--line-strong)"/>`;
    svg.innerHTML = h;
    renderTable();
  }

  function renderTable() {
    const pts = results.get(selected());
    tableWrap.hidden = !pts?.length;
    if (!pts) return;
    rows.innerHTML = pts
      .map((p) => {
        const th = berTheory(selected(), dbToLin(p.db));
        const meas = p.errors >= MIN_ERRORS ? (p.errors / p.bits).toExponential(2) : `under ${MIN_ERRORS} errors`;
        return `<tr><td>${p.db} dB</td><td>${p.errors.toLocaleString('en-US')}</td><td>${p.bits.toLocaleString('en-US')}</td><td>${meas}</td><td>${th.toExponential(2)}</td></tr>`;
      })
      .join('');
  }

  async function simulate() {
    if (busy) return;
    busy = true;
    // aria-disabled rather than disabled, so keyboard focus stays on the button.
    simBtn.setAttribute('aria-disabled', 'true');
    const scheme = selected();
    const k = schemes[scheme].bits;
    const rand = mulberry32(1000 + ++runs);
    const pts: Point[] = [];
    results.set(scheme, pts);
    for (let db = 0; db <= X_MAX; db += 2) {
      // Stop once the theory says a million bits would show almost no errors.
      if (berTheory(scheme, dbToLin(db)) * MAX_BITS < MIN_ERRORS) break;
      status.textContent = `Simulating ${schemes[scheme].label} at ${db} dB.`;
      const p: Point = { db, errors: 0, bits: 0 };
      pts.push(p);
      while (p.errors < 200 && p.bits < MAX_BITS) {
        const r = simulateBer(scheme, db, Math.min(SLICE, Math.ceil((MAX_BITS - p.bits) / k)), rand);
        p.errors += r.errors;
        p.bits += r.bits;
        await new Promise((res) => setTimeout(res, 0));
      }
      draw();
    }
    const total = pts.reduce((a, p) => a + p.bits, 0);
    status.textContent = `Done: ${total.toLocaleString('en-US')} ${schemes[scheme].label} bits at ${pts.length} points. The table below lists each one.`;
    busy = false;
    simBtn.removeAttribute('aria-disabled');
  }

  simBtn.addEventListener('click', simulate);
  radios.forEach((r) => r.addEventListener('change', draw));

  return { show: draw };
}
