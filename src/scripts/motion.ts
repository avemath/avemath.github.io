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

/** Plotter draw-in: each `[data-draw]` plot sweeps in left to right over about a second, the first
 *  time it is on screen. The pending state is set here, so without this script (or with reduced
 *  motion) every figure is simply drawn. */
export function initDrawIn() {
  if (prefersReducedMotion() || !('IntersectionObserver' in window)) return;
  const els = [...document.querySelectorAll<HTMLElement>('[data-draw]')];
  // A plot clipped to nothing never counts as on screen, so each one is watched through its parent.
  const plotOf = new Map<Element, HTMLElement>();
  // The observer's first report for each plot says where it starts, so setting up reads no layout:
  // anything already on screen at load is left alone (the first paint never has a hidden figure),
  // and anything below is set pending then, before it can scroll into view.
  const seen = new WeakSet<Element>();
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const el = plotOf.get(e.target)!;
        if (!seen.has(e.target)) {
          seen.add(e.target);
          const r = e.boundingClientRect;
          if (r.top < innerHeight && r.bottom > 0) {
            io.unobserve(e.target);
            continue;
          }
          el.classList.add('draw-pending');
          continue;
        }
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        el.classList.remove('draw-pending');
        el.classList.add('draw-run');
        el.addEventListener('animationend', () => el.classList.remove('draw-run'), { once: true });
      }
    },
    { threshold: 0.25 },
  );
  for (const el of els) {
    if (!el.parentElement) continue;
    plotOf.set(el.parentElement, el);
    io.observe(el.parentElement);
  }
  window.addEventListener('motionchange', () => {
    if (!prefersReducedMotion()) return;
    io.disconnect();
    els.forEach((el) => el.classList.remove('draw-pending', 'draw-run'));
  });
}
