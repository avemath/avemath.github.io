// Fig. 01: tooltips on the traces, and "Fire the plow", which runs the real firmware port. The
// firmware boots on its virtual clock in an instant (its 3 s startup interlock is behavior, not
// something to wait through here), then runs in real time only while a strike plays out. Nothing
// moves while nobody is pressing anything.
import { createFirmware, LOOP_MS, MAX_WEAPON_ACTIVATIONS } from '../../lib/rampage-firmware';
import { prefersReducedMotion } from '../preferences';

const WINDOW_MS = 700;

export function mountTiming(root: HTMLElement) {
  const svg = root.querySelector<SVGSVGElement>('svg')!;
  const tip = root.querySelector<HTMLElement>('[data-tf-tip]')!;
  const clip = root.querySelector<SVGRectElement>('[data-tf-clip]')!;
  const used = root.querySelector<HTMLElement>('[data-tf-used]')!;
  const state = root.querySelector<HTMLElement>('[data-tf-state]')!;
  const cells = [...root.querySelectorAll<SVGRectElement>('[data-cell]')];
  const card = root.closest<HTMLElement>('[data-fc]');
  const fire = card?.querySelector<HTMLButtonElement>('[data-fire]');

  // ---- Tooltips: hover or focus a trace ----
  const show = (row: SVGGElement) => {
    tip.textContent = row.dataset.tip ?? '';
    tip.dataset.on = '';
    const scale = svg.clientWidth / 640;
    const pr = root.querySelector<HTMLElement>('.tf__plot')!;
    const y = Number(row.dataset.y) * scale + 16;
    const left = Math.min(pr.clientWidth - tip.offsetWidth - 8, 180 * scale);
    tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(y - tip.offsetHeight - 6)}px)`;
  };
  const hide = () => delete tip.dataset.on;
  root.querySelectorAll<SVGGElement>('.tf__row').forEach((row) => {
    row.addEventListener('mouseenter', () => show(row));
    row.addEventListener('focus', () => show(row));
    row.addEventListener('mouseleave', hide);
    row.addEventListener('blur', hide);
  });

  // ---- The firmware ----
  const fw = createFirmware();
  const boot = () => {
    fw.reboot();
    while (!fw.ready) fw.step();
    // Past the startup reset blinks too, so the first press fires.
    for (let i = 0; i < 60; i++) fw.step();
  };
  boot();

  const paint = () => {
    used.textContent = String(fw.activations);
    cells.forEach((c, i) => c.toggleAttribute('data-used', i < fw.activations));
    const [label] = fw.stateLabel();
    state.textContent = label;
    if (!fire) return;
    const out = fw.activations >= MAX_WEAPON_ACTIVATIONS;
    fire.textContent = out ? 'Reboot to refill' : 'Fire the plow';
  };

  // Redraws the traces left to right in real time, as the valves would switch.
  const sweep = () => {
    if (prefersReducedMotion()) return clip.setAttribute('width', '640');
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / WINDOW_MS);
      clip.setAttribute('width', String(150 + t * 490));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  let busy = false;
  fire?.addEventListener('click', () => {
    if (busy) return;
    if (fw.activations >= MAX_WEAPON_ACTIVATIONS) {
      boot();
      paint();
      return;
    }
    busy = true;
    const before = fw.activations;
    fw.tx.trigger = true;
    let elapsed = 0;
    let swept = false;
    let last = performance.now();
    const run = (now: number) => {
      let dt = Math.min(100, now - last);
      last = now;
      while (dt >= LOOP_MS && elapsed < WINDOW_MS) {
        fw.step();
        elapsed += LOOP_MS;
        dt -= LOOP_MS;
        if (elapsed >= 160) fw.tx.trigger = false;
        if (!swept && fw.activations !== before) (swept = true), sweep();
      }
      last -= dt;
      paint();
      if (elapsed < WINDOW_MS) requestAnimationFrame(run);
      else busy = false;
    };
    requestAnimationFrame(run);
  });

  paint();
}
