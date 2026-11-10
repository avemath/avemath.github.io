// The About page's datasheet: one pin is pressed at a time. Pressing a pin (click, Enter or Space)
// slides its print out of the chip into the tray and lights its row in the characteristics table.
// The arrow keys move focus the way the chip looks: up and down along a side (pins 01 to 06 run
// down the left, 07 to 12 up the right), left and right to the pin across; Home and End jump to
// pins 01 and 12. Moving focus does not press. On a phone, a press
// scrolls the tray into view only when it is off screen.
import { prefersReducedMotion } from './preferences';

export function initDatasheet() {
  const root = document.querySelector<HTMLElement>('[data-ds]');
  if (!root) return;
  const pins = [...root.querySelectorAll<HTMLButtonElement>('[data-pin]')].sort((a, b) => Number(a.dataset.pin) - Number(b.dataset.pin));
  const slips = [...root.querySelectorAll<HTMLElement>('[data-slip]')];
  const rows = [...document.querySelectorAll<HTMLElement>('#datasheet [data-row]')];
  const rowOf: number[] = JSON.parse(document.querySelector('[data-ds-rows]')?.textContent || '[]');
  const tray = root.querySelector<HTMLElement>('#ds-tray');
  const stacked = window.matchMedia('(max-width: 859px)');
  let current = pins.findIndex((p) => p.getAttribute('aria-pressed') === 'true');

  const press = (i: number) => {
    if (i === current) return;
    current = i;
    pins.forEach((p, k) => p.setAttribute('aria-pressed', String(k === i)));
    slips.forEach((s) => {
      const on = Number(s.dataset.slip) === i;
      s.hidden = !on;
      s.classList.remove('is-in');
      if (on && !prefersReducedMotion()) {
        void s.offsetWidth; // restart the slide
        s.classList.add('is-in');
      }
    });
    rows.forEach((r) => r.classList.toggle('is-on', Number(r.dataset.row) === rowOf[i]));
  };

  const reveal = () => {
    if (!tray || !stacked.matches) return;
    const r = tray.getBoundingClientRect();
    if (r.top >= 0 && r.top < window.innerHeight - 160) return;
    tray.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };

  pins.forEach((pin, i) => {
    pin.addEventListener('click', () => {
      press(i);
      reveal();
    });
    pin.addEventListener('keydown', (e) => {
      const n = pins.length;
      const half = n / 2;
      const onLeft = i < half;
      const down = onLeft ? i + 1 : i - 1;
      const up = onLeft ? i - 1 : i + 1;
      const across = n - 1 - i;
      const to = { ArrowDown: down, ArrowUp: up, ArrowLeft: across, ArrowRight: across, Home: 0, End: n - 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      pins[(to + n) % n].focus();
    });
  });
}
