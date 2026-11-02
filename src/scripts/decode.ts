// A small "signal acquiring" text effect: characters resolve left to right
// out of random glyphs. Used by the hero eyebrow and the field notes.
import { prefersReducedMotion } from './preferences';

const GLYPHS = '01<>/#*+=·';

// One animation per element: starting a new decode cancels the one in flight.
const active = new WeakMap<HTMLElement, number>();

export const mask = (text: string) => text.replace(/[^\s]/g, () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]);

export function decode(el: HTMLElement, text: string, duration = 650) {
  const running = active.get(el);
  if (running !== undefined) cancelAnimationFrame(running);
  if (prefersReducedMotion()) {
    el.textContent = text;
    active.delete(el);
    return;
  }
  const start = performance.now();
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    const shown = Math.floor(t * text.length);
    el.textContent = text.slice(0, shown) + mask(text.slice(shown));
    if (t < 1) active.set(el, requestAnimationFrame(tick));
    else {
      el.textContent = text;
      active.delete(el);
    }
  };
  active.set(el, requestAnimationFrame(tick));
}

/**
 * The heading version: a short scramble, then each letter settles about 25 ms after the one before
 * it, so the settle visibly travels left to right. Long headings tighten the step so the whole
 * thing stays near `total` ms. The glyphs change every 60 ms rather than every frame, so the
 * effect reads as a signal locking on instead of a flicker. Returns how long it runs.
 */
export function decodeStaggered(el: HTMLElement, text: string, total = 900, lead = 150) {
  const running = active.get(el);
  if (running !== undefined) cancelAnimationFrame(running);
  if (prefersReducedMotion()) {
    el.textContent = text;
    active.delete(el);
    return 0;
  }
  const step = Math.min(25, (total - lead) / Math.max(1, text.length));
  const end = lead + step * text.length;
  const start = performance.now();
  let lastSwap = -Infinity;
  let noise = mask(text);
  const tick = (now: number) => {
    const t = now - start;
    if (t - lastSwap >= 60) (noise = mask(text)), (lastSwap = t);
    const settled = Math.max(0, Math.floor((t - lead) / step));
    el.textContent = text.slice(0, settled) + noise.slice(settled);
    if (t < end) active.set(el, requestAnimationFrame(tick));
    else {
      el.textContent = text;
      active.delete(el);
    }
  };
  active.set(el, requestAnimationFrame(tick));
  return end;
}
