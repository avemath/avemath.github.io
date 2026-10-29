// Runs the V2V live tile. The slider sets car 1's speed over car 2's 25 m/s; the brake decision
// comes from the rule in V2V_TXRXf.m (src/lib/v2v-scenario.ts). Each "receive" runs the demo's
// receiver chain (src/lib/ofdm-rx.ts) with the stages switching on in order, the way the MATLAB
// receiver locks: coarse CFO, linear phase fit, Costas loop, then the MMSE equalizer.
import { createReceiver, type Stages } from '../../lib/ofdm-rx';
import { collision, LEAD_V, POS_1, POS_2, TTC_WARN } from '../../lib/v2v-scenario';
import { prefersReducedMotion } from '../preferences';

const CFO_HZ = 5000;
const SNR_DB = 18;
const ORDER: (keyof Stages)[] = ['cfo', 'lin', 'pll', 'mmse'];
const STEP_MS = 550;

export function mount(panel: HTMLElement) {
  const $ = <T extends Element>(s: string) => panel.querySelector<T>(s)!;
  const input = $<HTMLInputElement>('[data-vl-closing]');
  const out = $<HTMLOutputElement>('[data-vl-out]');
  const ttcEl = $<HTMLElement>('[data-vl-ttc]');
  const warn = $<HTMLElement>('[data-vl-warn]');
  const v1Lbl = $<SVGTextElement>('[data-vl-v1]');
  const car1 = $<SVGGElement>('[data-vl-car1]');
  const car2 = $<SVGGElement>('[data-vl-car2]');
  const gapLine = $<SVGPathElement>('[data-vl-gapline]');
  const pkt = $<SVGCircleElement>('[data-vl-pkt]');
  const canvas = $<HTMLCanvasElement>('[data-vl-plot]');
  const stageEls = [...panel.querySelectorAll<HTMLElement>('[data-st]')];
  const ber = $<HTMLElement>('[data-vl-ber]');

  // The road: 60 m of it, car 2 fixed at 120 m.
  const X0 = POS_2 - 50;
  const x = (m: number) => ((m - X0) / 60) * 320;
  car1.setAttribute('transform', `translate(${x(POS_1)} 0)`);
  car2.setAttribute('transform', `translate(${x(POS_2)} 0)`);
  gapLine.setAttribute('d', `M ${x(POS_1)} 46 H ${x(POS_2)}`);

  function update() {
    const closing = Number(input.value);
    const v1 = LEAD_V + closing;
    const { ttc, brakeWarn } = collision(v1);
    out.value = `${closing.toFixed(1)} m/s`;
    v1Lbl.textContent = `${v1} m/s`;
    ttcEl.textContent = Number.isFinite(ttc) ? `${ttc.toFixed(1)} s` : 'not closing';
    warn.toggleAttribute('data-on', brakeWarn);
    warn.textContent = brakeWarn ? 'Brake recommended' : Number.isFinite(ttc) ? `No warning (TTC at or above ${TTC_WARN.toFixed(1)} s)` : 'No warning (not closing)';
    input.setAttribute('aria-valuetext', `${closing.toFixed(1)} meters per second, ${Number.isFinite(ttc) ? `${ttc.toFixed(1)} seconds to collision` : 'not closing'}${brakeWarn ? ', brake recommended' : ''}`);
  }
  input.addEventListener('input', update);
  update();

  // ---- Receiver ----
  const rx = createReceiver(42);
  const on: Stages = { cfo: false, lin: false, pll: false, mmse: false };
  const css = (n: string) => getComputedStyle(panel).getPropertyValue(n).trim();

  function draw() {
    const { pts, bits, errors } = rx.receive(CFO_HZ, SNR_DB, on);
    const c = canvas.getContext('2d')!;
    const w = canvas.width;
    const sc = w / 4.4;
    c.clearRect(0, 0, w, w);
    c.strokeStyle = css('--line');
    c.beginPath();
    c.moveTo(0, w / 2);
    c.lineTo(w, w / 2);
    c.moveTo(w / 2, 0);
    c.lineTo(w / 2, w);
    c.stroke();
    pts.forEach((z, i) => {
      c.fillStyle = bits[i] ? css('--accent') : css('--amber-line');
      c.globalAlpha = 0.85;
      c.beginPath();
      c.arc(w / 2 + z[0] * sc, w / 2 - z[1] * sc, 3.2, 0, Math.PI * 2);
      c.fill();
    });
    c.globalAlpha = 1;
    stageEls.forEach((li) => li.toggleAttribute('data-on', on[li.dataset.st as keyof Stages]));
    const locked = ORDER.filter((k) => on[k]).length;
    ber.textContent = `Raw bit errors ${errors} of ${bits.length} (${((errors / bits.length) * 100).toFixed(1)}%), ${locked} of 4 stages locked`;
  }

  let timers: number[] = [];
  function receive() {
    timers.forEach(clearTimeout);
    timers = [];
    rx.newPacket();
    ORDER.forEach((k) => (on[k] = false));
    if (prefersReducedMotion()) {
      ORDER.forEach((k) => (on[k] = true));
      draw();
      return;
    }
    draw();
    ORDER.forEach((k, i) => timers.push(window.setTimeout(() => ((on[k] = true), draw()), STEP_MS * (i + 1))));
  }
  $('[data-vl-again]').addEventListener('click', receive);
  receive();

  // ---- Packets: car 2's Basic Safety Message reaching car 1, as a dot crossing the gap ----
  let raf = 0;
  let visible = true;
  function frame(now: number) {
    const u = (now % 1200) / 1200;
    pkt.setAttribute('cx', String(x(POS_2) - u * (x(POS_2) - x(POS_1))));
    raf = requestAnimationFrame(frame);
  }
  const run = () => {
    cancelAnimationFrame(raf);
    const still = prefersReducedMotion() || !visible || document.hidden;
    pkt.style.display = prefersReducedMotion() ? 'none' : '';
    if (!still) raf = requestAnimationFrame(frame);
  };
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    run();
  });
  io.observe(panel);
  document.addEventListener('visibilitychange', run);
  addEventListener('motionchange', run);
  run();

  return () => {
    cancelAnimationFrame(raf);
    timers.forEach(clearTimeout);
    io.disconnect();
    document.removeEventListener('visibilitychange', run);
    removeEventListener('motionchange', run);
  };
}
