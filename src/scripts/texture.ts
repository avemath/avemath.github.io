// The texture's glow (src/styles/global.css): with a fine pointer and motion welcome, the contour
// lines brighten in a soft circle under the cursor, on whichever textured section it is over. One
// rAF per pointer move at most, and one layout read: the section under the cursor.
import { prefersReducedMotion } from './preferences';

export function initTexture() {
  const fine = matchMedia('(pointer: fine)');
  const sync = () => document.documentElement.toggleAttribute('data-glow', fine.matches && !prefersReducedMotion());
  sync();
  fine.addEventListener('change', sync);
  addEventListener('motionchange', sync);

  let last: HTMLElement | null = null;
  let x = 0;
  let y = 0;
  let target: Element | null = null;
  let raf = 0;
  const apply = () => {
    raf = 0;
    const el = target?.closest<HTMLElement>('.topo, .band-paper, .band-sheet') ?? null;
    if (last && last !== el) {
      last.style.removeProperty('--mx');
      last.style.removeProperty('--my');
    }
    last = el;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${Math.round(x - r.left)}px`);
    el.style.setProperty('--my', `${Math.round(y - r.top)}px`);
  };
  addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse' || !document.documentElement.hasAttribute('data-glow')) return;
      x = e.clientX;
      y = e.clientY;
      target = e.target as Element;
      if (!raf) raf = requestAnimationFrame(apply);
    },
    { passive: true },
  );
  document.documentElement.addEventListener('pointerleave', () => {
    target = null;
    if (!raf) raf = requestAnimationFrame(apply);
  });
}
