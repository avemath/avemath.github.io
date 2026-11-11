// The texture (src/styles/global.css): its tile anchored to the page, and its glow: with a fine pointer and motion welcome, the contour
// lines brighten in a soft circle under the cursor, on whichever textured section it is over. One
// rAF per pointer move at most, and one layout read: the section under the cursor.
import { prefersReducedMotion } from './preferences';

/**
 * Anchors every band's contour texture to the page: each .topo, .band-paper and .band-sheet gets
 * --topo-x and --topo-y, its offset from the document's top left, and the masks are positioned by
 * minus those, so the lines line up across band edges. Measured on load, after the fonts arrive,
 * and whenever a band or the page changes size (one ResizeObserver, batched to one frame); never
 * per frame.
 */
function anchorTexture() {
  const bands = () => [...document.querySelectorAll<HTMLElement>('.topo, .band-paper, .band-sheet')];
  let raf = 0;
  const measure = () => {
    raf = 0;
    const list = bands();
    const at = list.map((b) => b.getBoundingClientRect());
    list.forEach((b, i) => {
      b.style.setProperty('--topo-x', `${(at[i].left + scrollX).toFixed(1)}px`);
      b.style.setProperty('--topo-y', `${(at[i].top + scrollY).toFixed(1)}px`);
    });
  };
  const soon = () => {
    if (!raf) raf = requestAnimationFrame(measure);
  };
  // The first measure waits for the next frame, so starting up forces no layout of its own.
  soon();
  const ro = new ResizeObserver(soon);
  ro.observe(document.body);
  bands().forEach((b) => ro.observe(b));
  document.fonts?.ready.then(soon);
  addEventListener('load', soon, { once: true });
}

export function initTexture() {
  anchorTexture();
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
