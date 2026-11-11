// Decode headings: each section heading marked `data-decode` resolves out of random glyphs once,
// in about 900 ms, letter by letter from the left, as it scrolls into view. It never loops. The heading's real text stays in the
// DOM the whole time (only its color goes transparent), and a layer hidden from screen readers
// draws the glyphs over it, so readers and search engines always get the plain words.
import { decodeStaggered } from './decode';
import { prefersReducedMotion } from './preferences';

export function initDecodeHeadings() {
  if (prefersReducedMotion() || !('IntersectionObserver' in window)) return;
  // The observer's first report for each heading says where it starts, so nothing here reads
  // layout: a heading already on the first screen is left alone, and one below it is set up for the
  // effect then, long before it scrolls into view.
  const seen = new WeakSet<Element>();
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const h = e.target as HTMLElement;
        if (!seen.has(h)) {
          seen.add(h);
          if (e.boundingClientRect.top < innerHeight) {
            io.unobserve(h);
            continue;
          }
          prepare(h);
          continue;
        }
        if (!e.isIntersecting) continue;
        io.unobserve(h);
        run(h);
      }
    },
    { threshold: 0.6 },
  );
  // Plain-text headings only.
  document.querySelectorAll<HTMLElement>('[data-decode]').forEach((h) => !h.children.length && io.observe(h));
}

function prepare(h: HTMLElement) {
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
}

function run(h: HTMLElement) {
  if (prefersReducedMotion()) return;
  const real = h.querySelector<HTMLElement>('.dh__real')!;
  const fx = h.querySelector<HTMLElement>('.dh__fx')!;
  const text = real.textContent ?? '';
  h.dataset.decoding = '';
  const ms = decodeStaggered(fx, text);
  setTimeout(() => {
    delete h.dataset.decoding;
    fx.textContent = '';
  }, ms + 60);
}
