// Scroll reveals. Browsers with CSS scroll-driven animations get them from
// global.css. Everyone else gets this IntersectionObserver fallback, which
// staggers items in the same visual row so grids fill left to right.
import { prefersReducedMotion } from './preferences';

export function initReveals() {
  if (CSS.supports('animation-timeline: view()') || prefersReducedMotion() || !('IntersectionObserver' in window)) return;

  const root = document.documentElement;
  root.classList.add('io-reveal');

  const io = new IntersectionObserver(
    (entries) => {
      const entering = entries.filter((e) => e.isIntersecting).map((e) => e.target as HTMLElement);
      // Group by row (same top edge, within a few pixels) and stagger within each row.
      const rows = new Map<number, HTMLElement[]>();
      for (const el of entering) {
        const top = Math.round(el.getBoundingClientRect().top / 8);
        rows.set(top, [...(rows.get(top) ?? []), el]);
      }
      for (const row of rows.values()) {
        row
          .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left)
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
