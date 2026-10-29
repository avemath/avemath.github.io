// Runs the RAMpage live tile: the real firmware on its virtual clock, driven by Fire, E-stop and
// Reset, drawn into the tile's panel. Fire sends one pulse on the trigger channel, the way the
// transmitter switch does; E-stop holds the kill switch on until pressed again; Reset reboots.
import { createFirmware, MAX_WEAPON_ACTIVATIONS, LOOP_MS } from '../../lib/rampage-firmware';
import { prefersReducedMotion } from '../preferences';

export function mount(panel: HTMLElement) {
  const $ = <T extends Element>(s: string) => panel.querySelector<T>(s)!;
  const led = $<HTMLElement>('[data-rl-led]');
  const state = $<HTMLElement>('[data-rl-state]');
  const left = $<HTMLElement>('[data-rl-left]');
  const shots = [...panel.querySelectorAll<HTMLElement>('[data-rl-shots] li')];
  const plow = $<SVGElement>('[data-rl-plow]');
  const mainV = $<HTMLElement>('[data-rl-main]');
  const pistonV = $<HTMLElement>('[data-rl-piston]');
  const kill = $<HTMLButtonElement>('[data-rl-kill]');

  const fw = createFirmware();
  fw.reboot();

  let raf = 0;
  let last = performance.now();
  let visible = true;

  function paint() {
    // With reduced motion the status light holds steady instead of blinking its patterns.
    led.toggleAttribute('data-on', prefersReducedMotion() ? fw.ready && !fw.estop : fw.led);
    const [name, tone] = fw.stateLabel();
    if (state.textContent !== name) state.textContent = name;
    state.dataset.tone = tone;
    left.textContent = String(MAX_WEAPON_ACTIVATIONS - fw.activations);
    shots.forEach((li, i) => li.toggleAttribute('data-spent', i < fw.activations));
    plow.toggleAttribute('data-up', fw.pistonOpen);
    mainV.textContent = fw.mainOpen ? 'OPEN' : 'CLOSED';
    pistonV.textContent = fw.pistonOpen ? 'OPEN' : 'CLOSED';
  }

  function frame(now: number) {
    let dt = Math.min(250, now - last);
    last = now;
    while (dt >= LOOP_MS) {
      fw.step();
      dt -= LOOP_MS;
    }
    last -= dt;
    paint();
    raf = requestAnimationFrame(frame);
  }

  const run = () => {
    cancelAnimationFrame(raf);
    if (!visible || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };

  $('[data-rl-fire]').addEventListener('click', () => {
    fw.tx.trigger = true;
    setTimeout(() => (fw.tx.trigger = false), 160);
  });
  kill.addEventListener('click', () => {
    fw.tx.kill = !fw.tx.kill;
    kill.setAttribute('aria-pressed', String(fw.tx.kill));
  });
  $('[data-rl-reset]').addEventListener('click', () => {
    fw.tx.kill = false;
    kill.setAttribute('aria-pressed', 'false');
    fw.reboot();
  });

  // System blocks: one shows its code at a time.
  const blocks = [...panel.querySelectorAll<HTMLButtonElement>('[data-rl-block]')];
  const codes = [...panel.querySelectorAll<HTMLElement>('[data-rl-code]')];
  blocks.forEach((b) =>
    b.addEventListener('click', () => {
      blocks.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      codes.forEach((c) => (c.hidden = c.dataset.rlCode !== b.dataset.rlBlock));
    }),
  );

  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    run();
  });
  io.observe(panel);
  const onVis = () => run();
  document.addEventListener('visibilitychange', onVis);
  paint();
  run();

  return () => {
    cancelAnimationFrame(raf);
    io.disconnect();
    document.removeEventListener('visibilitychange', onVis);
  };
}
