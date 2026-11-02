// Fig. 01: tooltips on the traces, and "Fire the plow", which runs the real firmware port. The
// firmware boots on its virtual clock in an instant (its 3 s startup interlock is behavior, not
// something to wait through here), then runs, 4x slower than real, only while a strike plays out.
// Nothing moves while nobody is pressing anything.
import { createFirmware, LOOP_MS, MAX_WEAPON_ACTIVATIONS, SOLENOID_ACTIVATION_TIME, SOLENOID_SEQUENCE_DELAY } from '../../lib/rampage-firmware';

const WINDOW_MS = 700;

export function mountTiming(root: HTMLElement) {
  const svg = root.querySelector<SVGSVGElement>('.tf__svg')!;
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
    fire.textContent = out ? 'Refill (new match)' : 'Fire the plow';
  };

  // ---- One strike, played 4x slower than real so the 50 ms steps can be seen ----
  // The firmware runs on its virtual clock at a quarter of real speed. A playhead sweeps the
  // timing rows, the traces redraw behind it, and the pneumatics drawing and its status word
  // follow the valves exactly as the firmware switches them.
  const SLOW = 4;
  const pn = card?.querySelector<HTMLElement>('[data-pn]') ?? null;
  const pnMain = pn?.querySelector<SVGTextElement>('[data-pn-main]');
  const pnPiston = pn?.querySelector<SVGTextElement>('[data-pn-piston]');
  const pnStatus = pn?.querySelector<HTMLElement>('[data-pn-status]');
  const head = svg.querySelector<SVGLineElement>('[data-tf-head]')!;
  const x0 = Number(head.dataset.x0);
  const x1 = Number(head.dataset.x1);
  const span = Number(head.dataset.span);
  const xAt = (ms: number) => x0 + (Math.min(ms, span) / span) * (x1 - x0);
  const STROKE_MS = SOLENOID_SEQUENCE_DELAY * 2 + SOLENOID_ACTIVATION_TIME; // fill, settle, plow out

  const showStrike = (firedAt: number, elapsed: number) => {
    const fired = firedAt >= 0;
    const rel = elapsed - firedAt;
    if (pn) {
      pn.dataset.main = fw.mainOpen ? 'open' : 'closed';
      pn.dataset.piston = fw.pistonOpen ? 'open' : 'closed';
      pn.dataset.pressure = fired && rel < STROKE_MS ? 'on' : 'off';
      pn.dataset.vent = fired && fw.mainOpen && rel >= STROKE_MS ? 'on' : 'off';
      if (pnMain) pnMain.textContent = fw.mainOpen ? 'open' : 'closed';
      if (pnPiston) pnPiston.textContent = fw.pistonOpen ? 'open' : 'closed';
    }
    if (!pnStatus) return;
    let word = fw.activations >= MAX_WEAPON_ACTIVATIONS ? 'Out of air' : 'Ready';
    if (fired && rel < SOLENOID_SEQUENCE_DELAY) word = 'Filling';
    else if (fired && rel < SOLENOID_SEQUENCE_DELAY * 2) word = 'Settling';
    else if (fired && rel < STROKE_MS) word = 'Plow out';
    else if (fired && elapsed < WINDOW_MS) word = 'Venting';
    if (pnStatus.textContent !== word) pnStatus.textContent = word;
  };

  let busy = false;
  fire?.addEventListener('click', () => {
    if (busy) return;
    if (fw.activations >= MAX_WEAPON_ACTIVATIONS) {
      boot();
      paint();
      showStrike(-1, 0);
      return;
    }
    busy = true;
    root.dataset.running = '';
    const before = fw.activations;
    fw.tx.trigger = true;
    let elapsed = 0;
    let firedAt = -1;
    let acc = 0;
    let last = performance.now();
    head.setAttribute('x1', String(x0));
    head.setAttribute('x2', String(x0));
    const run = (now: number) => {
      acc += Math.min(100, now - last) / SLOW;
      last = now;
      while (acc >= LOOP_MS && elapsed < WINDOW_MS) {
        fw.step();
        elapsed += LOOP_MS;
        acc -= LOOP_MS;
        if (elapsed >= 160) fw.tx.trigger = false;
        // The strike started on this loop; the traces redraw from here, behind the playhead.
        if (firedAt < 0 && fw.activations !== before) firedAt = elapsed - LOOP_MS;
      }
      const x = String(xAt(elapsed));
      head.setAttribute('x1', x);
      head.setAttribute('x2', x);
      if (firedAt >= 0) clip.setAttribute('width', x);
      paint();
      showStrike(firedAt, elapsed);
      if (elapsed < WINDOW_MS) requestAnimationFrame(run);
      else {
        busy = false;
        delete root.dataset.running;
        clip.setAttribute('width', '640');
        showStrike(-1, elapsed);
      }
    };
    requestAnimationFrame(run);
  });

  paint();
}
