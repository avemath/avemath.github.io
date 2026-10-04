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
