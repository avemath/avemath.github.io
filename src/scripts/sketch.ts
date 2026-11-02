// Drawings draw in once: their strokes (marked pathLength="1") trace in over a second the first
// time the drawing is visible, then labels and callouts fade in. A drawing in a hidden tab has no
// size, so it waits until its tab opens. Without this script, or with reduced motion, every
// drawing is simply there.
import { prefersReducedMotion } from './preferences';

// Strokes trace in over a second, then the labels, callouts and accent fills fade in. Each
// animation fills backwards only, so once it ends the drawing is left in its plain, drawn state.
function run(svg: SVGElement) {
  svg.classList.remove('sketch-pending');
  const easing = 'cubic-bezier(0.45, 0, 0.25, 1)';
  svg.querySelectorAll<SVGElement>('[pathLength]').forEach((el) =>
    el.animate(
      [
        { strokeDasharray: '1', strokeDashoffset: '1' },
        { strokeDasharray: '1', strokeDashoffset: '0' },
      ],
      { duration: 1000, easing, fill: 'backwards' },
    ),
  );
  svg.querySelectorAll<SVGElement>('.t, .co, .f--hot').forEach((el) => el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 700, fill: 'backwards' }));
}

export function initSketches() {
  if (prefersReducedMotion() || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const svg = e.target as SVGElement;
        io.unobserve(svg);
        run(svg);
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
