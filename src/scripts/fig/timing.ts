// Fig. 01: tooltips on the traces, and "Fire the plow", which runs the real firmware port. The
// firmware boots on its virtual clock in an instant (its 3 s startup interlock is behavior, not
// something to wait through here), then runs, 4x slower than real by default (16x or real time
// by choice), only while a strike plays out.
// Nothing moves while nobody is pressing anything.
import { createFirmware, LOOP_MS, MAX_WEAPON_ACTIVATIONS } from '../../lib/rampage-firmware';

const WINDOW_MS = 700;

export function mountTiming(root: HTMLElement) {
  const svg = root.querySelector<SVGSVGElement>('.tf__svg')!;
  const tip = root.querySelector<HTMLElement>('[data-tf-tip]')!;
  const clip = root.querySelector<SVGRectElement>('[data-tf-clip]')!;
  const used = root.querySelector<HTMLElement>('[data-tf-used]')!;
  const state = root.querySelector<HTMLElement>('[data-tf-state]')!;
  const cells = [...root.querySelectorAll<SVGRectElement>('[data-cell]')];
  const card = root.closest<HTMLElement>('[data-fc]');
  // Two Fire buttons do the same thing: the compact one under the figure, and the big one in
  // the text column.
  const fires = [...(card ?? root).querySelectorAll<HTMLButtonElement>('[data-fire]')];
  const speedNote = root.querySelector<HTMLElement>('[data-tf-speed-note]');
  const speeds = [...root.querySelectorAll<HTMLInputElement>('[data-speed]')];
  const slowness = () => Number(speeds.find((r) => r.checked)?.value ?? 4);
  const describe = (k: number) => (k === 1 ? 'played in real time' : `played ${k}x slower than real`);
  speeds.forEach((r) => r.addEventListener('change', () => speedNote && (speedNote.textContent = describe(slowness()))));

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
    const out = fw.activations >= MAX_WEAPON_ACTIVATIONS;
    fires.forEach((b) => (b.textContent = out ? 'Refill (new match)' : b.closest('.tf') ? 'Fire' : 'Fire the plow'));
  };

  // ---- One strike, played 4x slower than real so the 50 ms steps can be seen ----
  // The firmware runs on its virtual clock at a quarter of real speed. A playhead sweeps the
  // timing rows, the traces redraw behind it, and the pneumatics drawing and its status word
  // follow the valves exactly as the firmware switches them.
  const pn = card?.querySelector<HTMLElement>('[data-pn]') ?? null;
  const pnMain = pn?.querySelector<SVGTextElement>('[data-pn-exhaust]');
  const pnPiston = pn?.querySelector<SVGTextElement>('[data-pn-inlets]');
  const pnStatus = pn?.querySelector<HTMLElement>('[data-pn-status]');
  const head = svg.querySelector<SVGLineElement>('[data-tf-head]')!;
  const x0 = Number(head.dataset.x0);
  const x1 = Number(head.dataset.x1);
  const span = Number(head.dataset.span);
  const xAt = (ms: number) => x0 + (Math.min(ms, span) / span) * (x1 - x0);

  // The word follows the valves themselves, so it can never run ahead of the drawing: exhaust open
  // (plow home), exhaust closed (settle), inlets open (plow out), then exhaust open again (vent).
  let closedSeen = false;
  const showStrike = (firedAt: number, elapsed: number) => {
    const fired = firedAt >= 0;
    if (!fired) closedSeen = false;
    else if (!fw.mainOpen) closedSeen = true;
    const venting = fired && closedSeen && fw.mainOpen && !fw.pistonOpen;
    if (pn) {
      // The firmware's main_solenoid is the exhaust (GP14); piston_solenoid is both inlets (GP15).
      pn.dataset.exhaust = fw.mainOpen ? 'open' : 'closed';
      pn.dataset.inlets = fw.pistonOpen ? 'open' : 'closed';
      pn.dataset.vent = venting ? 'on' : 'off';
      if (pnMain) pnMain.textContent = fw.mainOpen ? 'open' : 'closed';
      if (pnPiston) pnPiston.textContent = fw.pistonOpen ? 'open' : 'closed';
    }
    let word = fw.activations >= MAX_WEAPON_ACTIVATIONS ? 'Out of air' : 'Ready';
    if (fired && fw.pistonOpen) word = 'Plow out';
    else if (fired && !fw.mainOpen) word = 'Settling';
    else if (venting && elapsed < WINDOW_MS) word = 'Venting';
    else if (fired && !closedSeen) word = 'Filling';
    // The chip under the timing rows says the same word as the drawing.
    if (pnStatus && pnStatus.textContent !== word) pnStatus.textContent = word;
    if (state.textContent !== word) state.textContent = word;
  };

  let busy = false;
  const onFire = () => {
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
    const SLOW = slowness();
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
  };
  fires.forEach((b) => b.addEventListener('click', onFire));

  paint();
  showStrike(-1, 0);
}
