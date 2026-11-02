// Field notes: each value starts masked and decodes as it scrolls into view; a tap replays it.
// With reduced motion every value is simply shown. The real value is always in the DOM for
// screen readers (an sr-only copy), and the masked glyphs are hidden from them.
import { decode, mask } from './decode';
import { prefersReducedMotion } from './preferences';

const cards = [...document.querySelectorAll<HTMLButtonElement>('[data-note]')];
const valueOf = (card: HTMLButtonElement) => card.querySelector<HTMLElement>('[data-note-value]')!;
const textOf = (card: HTMLButtonElement) => valueOf(card).dataset.text ?? '';

function reveal(card: HTMLButtonElement) {
  delete card.dataset.masked;
  decode(valueOf(card), textOf(card), 800);
}

function showAll() {
  cards.forEach((card) => {
    delete card.dataset.masked;
    valueOf(card).textContent = textOf(card);
  });
}

// Cards start masked and decode as they scroll into view, staggered left to right across a
// row. With reduced motion every fact is simply shown.
if (!prefersReducedMotion() && 'IntersectionObserver' in window) {
  cards.forEach((card) => {
    card.dataset.masked = '';
    valueOf(card).textContent = mask(textOf(card));
  });
  const io = new IntersectionObserver(
    (entries) => {
      // The entries carry their rectangles, so grouping into rows reads no layout of its own.
      const rows = new Map<number, { card: HTMLButtonElement; left: number }[]>();
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const top = Math.round(e.boundingClientRect.top / 8);
        rows.set(top, [...(rows.get(top) ?? []), { card: e.target as HTMLButtonElement, left: e.boundingClientRect.left }]);
      }
      for (const row of rows.values()) {
        row
          .sort((a, b) => a.left - b.left)
          .map((r) => r.card)
          .forEach((card, i) => {
            io.unobserve(card);
            setTimeout(() => card.dataset.masked !== undefined && reveal(card), i * 160);
          });
      }
    },
    { threshold: 0.5 },
  );
  cards.forEach((card) => io.observe(card));
}

// A tap decodes a card early, or replays the effect.
cards.forEach((card) =>
  card.addEventListener('click', () => {
    if (card.dataset.masked === undefined && !prefersReducedMotion()) valueOf(card).textContent = mask(textOf(card));
    reveal(card);
  }),
);

// Turning motion off mid-visit shows everything at once.
window.addEventListener('motionchange', () => {
  if (prefersReducedMotion()) showAll();
});
