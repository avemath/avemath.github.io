// Scroll reveals. Browsers with CSS scroll-driven animations get them from
// global.css. Everyone else gets this IntersectionObserver fallback, which
// staggers items in the same visual row so grids fill left to right.
import { prefersReducedMotion } from './preferences';

/** Runs `fn` once the page has settled: after the load event, a short pause and an idle moment.
 *  Decorative motion waits for this, so the first screen paints once and stays still. */
export function whenSettled(fn: () => void, pause = 1200) {
  const go = () => setTimeout(() => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1500 }) : fn()), pause);
  if (document.readyState === 'complete') go();
  else addEventListener('load', go, { once: true });
}

export function initReveals() {
  if (CSS.supports('animation-timeline: view()') || prefersReducedMotion() || !('IntersectionObserver' in window)) return;

  const root = document.documentElement;
  root.classList.add('io-reveal');

  const io = new IntersectionObserver(
    (entries) => {
      // Group by row (same top edge, within a few pixels) and stagger within each row. The entries
      // carry their rectangles, so this reads no layout of its own.
      const rows = new Map<number, { el: HTMLElement; left: number }[]>();
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const top = Math.round(e.boundingClientRect.top / 8);
        rows.set(top, [...(rows.get(top) ?? []), { el: e.target as HTMLElement, left: e.boundingClientRect.left }]);
      }
      for (const row of rows.values()) {
        row
          .sort((a, b) => a.left - b.left)
          .map((r) => r.el)
          .forEach((el, i) => {
            el.style.setProperty('--reveal-delay', `${Math.min(i, 5) * 70}ms`);
            el.classList.add('is-in');
            io.unobserve(el);
          });
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );

  document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));

  // If the visitor turns motion off mid-visit, show everything at once.
  window.addEventListener('motionchange', () => {
    document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-in'));
  });
}
