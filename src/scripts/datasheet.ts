// The About page's datasheet: one pin is selected at a time, and its description and its
// characteristics row follow it. Hover, click, Enter or Space selects a pin; the arrow keys move
// to the next pin and select it, and Home and End jump to pins 1 and 10. Tab only moves focus, so
// a keyboard user can tab on past the pins into the selected pin's links. On a phone, a tap
// scrolls the description into view only when it is off screen.
export function initDatasheet() {
  const root = document.querySelector<HTMLElement>('[data-ds]');
  if (!root) return;
  const pins = [...root.querySelectorAll<HTMLButtonElement>('[data-pin]')].sort((a, b) => Number(a.dataset.pin) - Number(b.dataset.pin));
  const descs = [...root.querySelectorAll<HTMLElement>('[data-desc]')];
  const rows = [...root.querySelectorAll<HTMLElement>('[data-row]')];
  const rowOf: number[] = JSON.parse(document.querySelector('[data-ds-rows]')?.textContent || '[]');
  const panel = root.querySelector<HTMLElement>('#ds-desc');
  const stacked = window.matchMedia('(max-width: 959px)');
  const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduce';
  let current = 0;

  const select = (i: number) => {
    if (i === current) return;
    current = i;
    pins.forEach((p, k) => p.setAttribute('aria-pressed', String(k === i)));
    descs.forEach((d) => (d.hidden = Number(d.dataset.desc) !== i));
    rows.forEach((r) => r.classList.toggle('is-on', Number(r.dataset.row) === rowOf[i]));
  };

  const reveal = () => {
    if (!panel || !stacked.matches) return;
    const r = panel.getBoundingClientRect();
    if (r.top >= 0 && r.top < window.innerHeight - 120) return;
    panel.scrollIntoView({ block: 'start', behavior: reduce() ? 'auto' : 'smooth' });
  };

  pins.forEach((pin, i) => {
    pin.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse') select(i);
    });
    pin.addEventListener('click', () => {
      select(i);
      reveal();
    });
    pin.addEventListener('keydown', (e) => {
      const to = { ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1, ArrowLeft: i - 1, Home: 0, End: pins.length - 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      const k = (to + pins.length) % pins.length;
      pins[k].focus();
      select(k);
    });
  });
}
