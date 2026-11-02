// Drawings draw in once: their strokes (marked pathLength="1") trace in over a second the first
// time the drawing is visible, then labels and callouts fade in. A drawing in a hidden tab has no
// size, so it waits until its tab opens. Without this script, or with reduced motion, every
// drawing is simply there.
import { prefersReducedMotion } from './preferences';

export function initSketches() {
  if (prefersReducedMotion() || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const svg = e.target as SVGElement;
        io.unobserve(svg);
        svg.classList.replace('sketch-pending', 'sketch-run');
      }
    },
    { threshold: 0.3 },
  );
  document.querySelectorAll<SVGElement>('[data-sketch]').forEach((svg) => {
    const r = svg.getBoundingClientRect();
    if (r.width && r.top < innerHeight && r.bottom > 0) return;
    svg.classList.add('sketch-pending');
    io.observe(svg);
  });
  window.addEventListener('motionchange', () => {
    if (!prefersReducedMotion()) return;
    io.disconnect();
    document.querySelectorAll('.sketch-pending').forEach((el) => el.classList.remove('sketch-pending'));
  });
}
