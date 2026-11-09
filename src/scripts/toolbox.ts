// The home page Toolbox crate (src/components/Toolbox.astro). One sleeve is open at a time: the one
// the pointer is over (by its position across the row), the one focused, or the one the arrow keys or a swipe flipped to. The open
// sleeve's card shows under the crate. Pressing a sleeve (click, tap, Enter or Space) pins it: it
// lights the project plates on the page that use the tool ([data-proj], matched against the
// sleeve's case study links), fades the rest to 35%, and writes "<Skill>: used in ..." in the
// polite live line. Pressing it again, or Escape, clears the pin. Pressing never navigates.
export function initToolbox() {
  const root = document.querySelector<HTMLElement>('[data-tb]');
  if (!root) return;
  const crate = root.querySelector<HTMLElement>('[data-crate]')!;
  const row = root.querySelector<HTMLElement>('[data-crate-row]')!;
  const chips = [...root.querySelectorAll<HTMLButtonElement>('[data-tool]')];
  const uses = [...root.querySelectorAll<HTMLElement>('[data-use]')];
  const line = root.querySelector<HTMLElement>('[data-tb-line]')!;
  const plates = [...document.querySelectorAll<HTMLElement>('[data-proj]')];
  let pressed = -1;
  let open = -1;

  /** Flip to sleeve i: it slides up, its card shows, and it becomes the one Tab lands on. */
  const flip = (i: number, focus = false) => {
    open = Math.max(0, Math.min(chips.length - 1, i));
    crate.dataset.active = String(open);
    chips.forEach((c, k) => {
      c.toggleAttribute('data-open', k === open);
      c.tabIndex = k === open ? 0 : -1;
    });
    uses.forEach((u) => (u.hidden = Number(u.dataset.use) !== Number(chips[open].dataset.tool)));
    if (focus) chips[open].focus();
  };
  // Back to the pinned sleeve, or closed, when the pointer leaves the crate.
  const settle = () => {
    if (pressed >= 0) flip(chips.findIndex((c) => Number(c.dataset.tool) === pressed));
    else {
      open = -1;
      delete crate.dataset.active;
      chips.forEach((c) => c.removeAttribute('data-open'));
    }
  };

  const press = (tool: number) => {
    pressed = tool;
    chips.forEach((c) => c.setAttribute('aria-pressed', String(Number(c.dataset.tool) === tool)));
    const chip = chips.find((c) => Number(c.dataset.tool) === tool);
    const hrefs = new Set((chip?.dataset.hrefs || '').split(' ').filter(Boolean));
    plates.forEach((p) => {
      const lit = tool < 0 || (p.dataset.proj || '').split(' ').some((h) => hrefs.has(h));
      p.toggleAttribute('data-dim', !lit);
    });
    line.textContent = chip ? chip.dataset.line! : '';
  };

  // The pointer's position across the row picks the sleeve, so moving across flips through them
  // in order, whatever the open one covers. One layout read per move: the row's two ends.
  const slots = [...row.children] as HTMLElement[];
  crate.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const a = slots[0].getBoundingClientRect();
    const b = slots[slots.length - 1].getBoundingClientRect();
    if (b.right <= a.left) return;
    const t = (e.clientX - a.left) / (b.right - a.left);
    const i = Math.floor(Math.min(0.999, Math.max(0, t)) * chips.length);
    if (i !== open) flip(i);
  });

  chips.forEach((chip, i) => {
    const tool = Number(chip.dataset.tool);
    chip.addEventListener('focus', () => flip(i));
    chip.addEventListener('click', () => {
      flip(i);
      press(pressed === tool ? -1 : tool);
    });
    chip.addEventListener('keydown', (e) => {
      const to = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: chips.length - 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      flip(to, true);
    });
  });
  crate.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse' && !crate.contains(document.activeElement)) settle();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && pressed >= 0) press(-1);
  });

  // A sideways swipe flips through the crate, one sleeve per 36px of finger travel, starting from the
  // sleeve it began on; a tap still presses.
  let sx = 0;
  let sy = 0;
  let from = 0;
  let swiping = false;
  row.addEventListener('touchstart', (e) => {
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
    const touched = chips.indexOf((e.target as Element).closest<HTMLButtonElement>('[data-tool]')!);
    from = touched >= 0 ? touched : Math.max(0, open);
    swiping = false;
  }, { passive: true });
  row.addEventListener('touchmove', (e) => {
    const dx = e.touches[0].clientX - sx;
    const dy = e.touches[0].clientY - sy;
    if (!swiping && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) swiping = true;
    // The open sleeve follows the finger along the row, like the pointer does.
    if (swiping) flip(from + Math.round(dx / 36));
  }, { passive: true });
  row.addEventListener('touchend', (e) => {
    if (swiping) e.preventDefault(); // a swipe is not a tap
  });
}
