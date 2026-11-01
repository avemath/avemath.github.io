// Decode headings: each section heading marked `data-decode` resolves out of random glyphs once,
// in about 400 ms, as it scrolls into view. It never loops. The heading's real text stays in the
// DOM the whole time (only its color goes transparent), and a layer hidden from screen readers
// draws the glyphs over it, so readers and search engines always get the plain words.
import { decode } from './decode';
import { prefersReducedMotion } from './preferences';

export function initDecodeHeadings() {
  if (prefersReducedMotion() || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        run(e.target as HTMLElement);
      }
    },
    { threshold: 0.6 },
  );
  document.querySelectorAll<HTMLElement>('[data-decode]').forEach((h) => {
    // Plain-text headings only, and only ones that start below the first screen.
    if (h.children.length || h.getBoundingClientRect().top < innerHeight) return;
    const text = h.textContent!.trim();
    h.textContent = '';
    const real = document.createElement('span');
    real.className = 'dh__real';
    real.textContent = text;
    const fx = document.createElement('span');
    fx.className = 'dh__fx';
    fx.setAttribute('aria-hidden', 'true');
    h.classList.add('dh');
    h.append(real, fx);
    io.observe(h);
  });
}

function run(h: HTMLElement) {
  if (prefersReducedMotion()) return;
  const real = h.querySelector<HTMLElement>('.dh__real')!;
  const fx = h.querySelector<HTMLElement>('.dh__fx')!;
  const text = real.textContent ?? '';
  h.dataset.decoding = '';
  decode(fx, text, 400);
  setTimeout(() => {
    delete h.dataset.decoding;
    fx.textContent = '';
  }, 460);
}
