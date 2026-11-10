// The /work/ thread map (src/components/work/ThreadMap.astro).
//   - Pointing at or focusing a station shows its preview card (a bigger picture, name, kind and
//     dates); leaving or blurring hides it.
//   - Choosing a station (click, tap, Enter, Space) selects that project on the bench above and
//     brings the bench's detail into view; arrow keys move between stations in order.
//   - Legend buttons highlight one thread and dim the rest (press again to clear).
//   - The tracks draw in once, the first time the map is on screen; not with reduced motion.
// No animation loop of its own: the draw-in is a CSS transition.
import { prefersReducedMotion } from './preferences';

export function mountThreadMap() {
  const root = document.querySelector<HTMLElement>('[data-tmap]');
  if (!root) return;
  const keys = [...root.querySelectorAll<HTMLButtonElement>('[data-line]')];
  const cards = [...root.querySelectorAll<HTMLElement>('[data-card]')];
  let focusLine: string | null = null;

  // ---- Highlighting a thread ----
  const applyFocus = () => {
    if (focusLine) root.dataset.focus = focusLine;
    else delete root.dataset.focus;
    root.querySelectorAll<SVGElement>('[data-lines]').forEach((el) => el.classList.toggle('is-on', !!focusLine && (el.dataset.lines ?? '').split(' ').includes(focusLine)));
    keys.forEach((k) => k.setAttribute('aria-pressed', String(k.dataset.line === focusLine)));
  };
  keys.forEach((k) =>
    k.addEventListener('click', () => {
      focusLine = focusLine === k.dataset.line ? null : k.dataset.line!;
      applyFocus();
    }),
  );

  // ---- The preview card ----
  const show = (stn: SVGGElement) => {
    const card = cards.find((c) => c.dataset.card === stn.dataset.stn);
    cards.forEach((c) => (c.hidden = c !== card));
    if (!card) return;
    const box = root.getBoundingClientRect();
    const r = stn.getBoundingClientRect();
    const w = 240;
    let left = r.left - box.left + r.width / 2 - w / 2;
    left = Math.max(6, Math.min(box.width - w - 6, left));
    card.style.left = `${left}px`;
    // Above the station if it fits, else below.
    const above = r.top - box.top - 14 - card.offsetHeight;
    card.style.top = `${above >= 0 ? above : r.bottom - box.top + 14}px`;
  };
  const hide = () => cards.forEach((c) => (c.hidden = true));

  // ---- Stations ----
  const svgs = [...root.querySelectorAll<SVGSVGElement>('[data-tmap-svg]')];
  const mark = (slug: string) => root.querySelectorAll<SVGGElement>('[data-stn]').forEach((s) => s.classList.toggle('is-sel', s.dataset.stn === slug));
  svgs.forEach((svg) => {
    const stns = [...svg.querySelectorAll<SVGGElement>('[data-stn]')];
    stns.forEach((stn, i) => {
      const pick = () => {
        hide();
        mark(stn.dataset.stn!);
        dispatchEvent(new CustomEvent('bench:select', { detail: stn.dataset.stn }));
      };
      stn.addEventListener('pointerenter', () => show(stn));
      stn.addEventListener('pointerleave', hide);
      stn.addEventListener('focus', () => show(stn));
      stn.addEventListener('blur', hide);
      stn.addEventListener('click', pick);
      stn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          pick();
          return;
        }
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (step === undefined) return;
        e.preventDefault();
        stns[Math.max(0, Math.min(stns.length - 1, i + step))].focus();
      });
    });
  });
  addEventListener('bench:select', ((e: CustomEvent<string>) => mark(e.detail)) as EventListener);

  // ---- The draw-in, once ----
  if (!prefersReducedMotion() && 'IntersectionObserver' in window) {
    root.dataset.willDraw = '';
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        requestAnimationFrame(() => (root.dataset.drawn = ''));
      },
      { threshold: 0.05 },
    );
    io.observe(root);
  }
}
