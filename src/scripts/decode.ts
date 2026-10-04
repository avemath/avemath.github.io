// A small "signal acquiring" text effect: characters resolve left to right
// out of random glyphs. Used by the hero eyebrow and the field notes.
import { prefersReducedMotion } from './preferences';

const GLYPHS = '01<>/#*+=·';

export const mask = (text: string) => text.replace(/[^\s]/g, () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]);

export function decode(el: HTMLElement, text: string, duration = 650) {
  if (prefersReducedMotion()) {
    el.textContent = text;
    return;
  }
  const start = performance.now();
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    const shown = Math.floor(t * text.length);
    el.textContent = text.slice(0, shown) + mask(text.slice(shown));
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = text;
  };
  requestAnimationFrame(tick);
}
