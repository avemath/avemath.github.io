// Fig. 02: picking a stage of the receiver. The constellation after each stage comes from
// src/lib/ofdm-rx.ts with the live tile's settings (5 kHz of carrier offset, 18 dB SNR, packet 42),
// turning on the corrections in the order V2V_TXRXf.m applies them. "Step through the receiver"
// moves to the next stage. The last stage shows the decoded fields next to the transmitted ones.
import { createReceiver, type Stages } from '../../lib/ofdm-rx';
import { collision, GAP_M, TTC_WARN } from '../../lib/v2v-scenario';
import { prefersReducedMotion } from '../preferences';

const CFO_HZ = 5000;
const SNR_DB = 18;

type Stage = { key: string; name: string; text: string; io: string; look: string };

const OFF: Stages = { cfo: false, lin: false, pll: false, mmse: false };
// What has been switched on by the end of each stage.
const upTo: Record<string, { on: Stages; view: 'sync' | 'payload' | 'bsm' }> = {
  detect: { on: OFF, view: 'sync' },
  tau: { on: OFF, view: 'sync' },
  cfo: { on: { ...OFF, cfo: true }, view: 'sync' },
  train: { on: { ...OFF, cfo: true, lin: true }, view: 'sync' },
  pll: { on: { ...OFF, cfo: true, lin: true, pll: true }, view: 'sync' },
  ofdm: { on: { cfo: true, lin: true, pll: true, mmse: false }, view: 'payload' },
  mmse: { on: { cfo: true, lin: true, pll: true, mmse: true }, view: 'payload' },
  viterbi: { on: { cfo: true, lin: true, pll: true, mmse: true }, view: 'payload' },
  bsm: { on: { cfo: true, lin: true, pll: true, mmse: true }, view: 'bsm' },
};

export function mountChain(root: HTMLElement) {
  const stages: Stage[] = JSON.parse(root.querySelector('[data-cf-stages]')!.textContent!);
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-stage]')];
  const wires = [...root.querySelectorAll<HTMLElement>('.cf__wire')];
  const text = root.querySelector<HTMLElement>('[data-cf-text]')!;
  const io = root.querySelector<HTMLElement>('[data-cf-io]')!;
  const svg = root.querySelector<SVGSVGElement>('[data-cf-svg]')!;
  const bsm = root.querySelector<HTMLElement>('[data-cf-bsm]')!;
  const cap = root.querySelector<HTMLElement>('[data-cf-cap]')!;
  const card = root.closest<HTMLElement>('[data-fc]');
  const stepBtn = card?.querySelector<HTMLButtonElement>('[data-step]');
  // The receiver (and the packet it decodes) is built on the first plot, not at page load.
  let rx: ReturnType<typeof createReceiver> | null = null;
  const axes = svg.innerHTML;
  let shown: [number, number][] | null = null;
  let morph = 0;
  let current = buttons.findIndex((b) => b.getAttribute('aria-pressed') === 'true');

  function plot(i: number) {
    const key = stages[i].key;
    const { on, view } = upTo[key];
    rx ??= createReceiver(42);
    const r = rx.receive(CFO_HZ, SNR_DB, on);
    if (view === 'bsm') {
      shown = null;
      const c = collision(30);
      svg.style.display = 'none';
      bsm.hidden = false;
      // The fields each car sends (V2V_TXRXf.m, TX-1). On the radios, the decoded fields matched
      // these exactly in all five runs.
      const rows = [
        ['ID', '1', '2'],
        ['velocity, m/s', '30', '25'],
        ['accel, m/s\u00b2', '0', '\u22121'],
        ['pos X, m', '100', '120'],
        ['pos Y, m', '0', '0'],
      ];
      bsm.innerHTML =
        `<table><caption class="sr-only">BSM fields each car sent, and what the receiver decoded</caption><thead>` +
        `<tr><td></td><th scope="colgroup" colspan="2">car 1</th><th scope="colgroup" colspan="2">car 2</th></tr>` +
        `<tr><th scope="col">field</th><th scope="col">sent</th><th scope="col">rx</th><th scope="col">sent</th><th scope="col">rx</th></tr></thead><tbody>` +
        rows.map(([f, a, b]) => `<tr><th scope="row">${f}</th><td>${a}</td><td>${a}</td><td>${b}</td><td>${b}</td></tr>`).join('') +
        `</tbody></table><p>gap ${GAP_M.toFixed(1)} m, closing ${c.closingRate.toFixed(0)} m/s, TTC ${c.ttc.toFixed(1)} s, under ${TTC_WARN.toFixed(1)} s</p>` +
        `<p class="cf__warn">${c.brakeWarn ? 'WARNING: Brake Recommended' : 'no warning'}</p>`;
      cap.textContent = `${stages[i].look} Decoded on the radios, the same in all five runs.`;
      return;
    }
    svg.style.display = '';
    bsm.hidden = true;
    const pts = view === 'sync' ? r.rx : r.pts;
    // Scale so the clean points sit at plus and minus one.
    const clip = (v: number) => Math.max(-1.55, Math.min(1.55, v));
    const decided = key === 'viterbi';
    const next = pts.map(([a, b]) => [clip(a), clip(-b)] as [number, number]);
    let dots = '';
    next.forEach(([x, y], k) => {
      const wrong = decided && (pts[k][0] >= 0 ? 1 : 0) !== r.bits[k];
      dots += `<circle cx="${x.toFixed(3)}" cy="${y.toFixed(3)}" r="0.035"${wrong ? ' class="hot"' : ''}/>`;
    });
    svg.innerHTML = axes + dots;
    // From the previous stage's points to this one's over 300 ms, so the move is what the stage did.
    // Only between two views of the same signal (same number of points), and never with reduced motion.
    const from = shown;
    shown = next;
    cancelAnimationFrame(morph);
    if (from && from.length === next.length && !prefersReducedMotion()) {
      const circles = [...svg.querySelectorAll('circle')];
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / 300);
        const e = 1 - (1 - t) ** 3;
        circles.forEach((c, k) => {
          c.setAttribute('cx', (from[k][0] + (next[k][0] - from[k][0]) * e).toFixed(3));
          c.setAttribute('cy', (from[k][1] + (next[k][1] - from[k][1]) * e).toFixed(3));
        });
        if (t < 1) morph = requestAnimationFrame(step);
      };
      step(t0);
    }
    cap.textContent = `${stages[i].look}${decided ? ` ${r.errors} of ${r.bits.length} decisions wrong, in green.` : ''}`;
  }

  function select(i: number) {
    current = i;
    buttons.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
    // The wires into and out of the stage light up.
    wires.forEach((w, j) => w.toggleAttribute('data-hot', j === i - 1 || j === i));
    text.textContent = stages[i].text;
    io.textContent = stages[i].io;
    plot(i);
  }

  // A wire joins a stage to the next one only when both sit on the same row; at a row's end it
  // would point at nothing.
  const items = buttons.map((b) => b.closest('li')!);
  const fitWires = () => wires.forEach((w, j) => { w.style.visibility = items[j + 1] && items[j + 1].offsetTop > items[j].offsetTop + 4 ? 'hidden' : ''; });
  new ResizeObserver(fitWires).observe(root);
  fitWires();

  buttons.forEach((b, i) => {
    b.addEventListener('click', () => select(i));
    b.addEventListener('mouseenter', () => select(i));
    b.addEventListener('focus', () => select(i));
  });
  // Step through the receiver: the first press always goes to stage 1, then each press to the next,
  // back to stage 1 after the last. Picking a stage by hand, or leaving the Live view, starts the
  // stepping over. The button only shows on the Live view, the one view where it works.
  let stepping = false;
  stepBtn?.addEventListener('click', () => {
    const next = stepping ? (current + 1) % stages.length : 0;
    select(next);
    stepping = true;
  });
  buttons.forEach((b) => b.addEventListener('click', () => (stepping = false)));
  card?.addEventListener('viewchange', (e) => {
    const live = (e as CustomEvent).detail === 'live';
    if (stepBtn) stepBtn.hidden = !live;
    stepping = false;
  });

  // The first constellation runs the receiver, so it waits until the figure is near the screen.
  const near = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting) return;
      near.disconnect();
      select(current < 0 ? 4 : current);
    },
    { rootMargin: '600px 0px' },
  );
  near.observe(root);
}
