// Fig. 02: picking a stage of the receiver. The constellation after each stage comes from
// src/lib/ofdm-rx.ts with the live tile's settings (5 kHz of carrier offset, 18 dB SNR, packet 42),
// turning on the corrections in signal order. "Step through the receiver" moves to the next stage.
import { createReceiver, type Stages } from '../../lib/ofdm-rx';
import { collision, TTC_WARN } from '../../lib/v2v-scenario';
import { prefersReducedMotion } from '../preferences';

const CFO_HZ = 5000;
const SNR_DB = 18;

type Stage = { key: string; name: string; text: string; io: string };

const OFF: Stages = { cfo: false, lin: false, pll: false, mmse: false };
// What has been switched on by the end of each stage.
const upTo: Record<string, { on: Stages; view: 'sync' | 'payload' | 'bsm' }> = {
  detect: { on: OFF, view: 'sync' },
  timing: { on: OFF, view: 'sync' },
  cfo: { on: { ...OFF, cfo: true, lin: true }, view: 'sync' },
  costas: { on: { ...OFF, cfo: true, lin: true, pll: true }, view: 'sync' },
  fft: { on: { cfo: true, lin: true, pll: true, mmse: false }, view: 'payload' },
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
  const rx = createReceiver(42);
  const axes = svg.innerHTML;
  let shown: [number, number][] | null = null;
  let morph = 0;
  let current = buttons.findIndex((b) => b.getAttribute('aria-pressed') === 'true');

  function plot(i: number) {
    const key = stages[i].key;
    const { on, view } = upTo[key];
    const r = rx.receive(CFO_HZ, SNR_DB, on);
    if (view === 'bsm') {
      shown = null;
      const c = collision(30);
      svg.style.display = 'none';
      bsm.hidden = false;
      bsm.textContent = `bit errors before decoding: ${r.errors} of ${r.bits.length}\ncar 1: 30 m/s, car 2: 25 m/s, gap 20 m\ntime to collision: ${c.ttc.toFixed(1)} s\n${c.brakeWarn ? `under ${TTC_WARN.toFixed(1)} s: brake recommended` : 'no warning'}`;
      cap.textContent = 'decoded message, then the brake rule';
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
    cap.textContent = decided ? `${r.errors} of ${r.bits.length} decisions wrong, in orange` : view === 'sync' ? 'preamble symbols after this stage' : 'data subcarriers after this stage';
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

  buttons.forEach((b, i) => {
    b.addEventListener('click', () => select(i));
    b.addEventListener('mouseenter', () => select(i));
    b.addEventListener('focus', () => select(i));
  });
  stepBtn?.addEventListener('click', () => select((current + 1) % stages.length));

  select(current < 0 ? 3 : current);
}
