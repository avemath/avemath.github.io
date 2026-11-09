// The home page Toolbox. Each chip is a toggle filter: pressing it (click, Enter or Space) lights
// the project plates on the page that use the tool ([data-proj], matched against the chip's case
// study links), fades the rest to 35%, and writes "<Skill>: used in ..." in the polite live line.
// Pressing the same chip again, or Escape, clears it. Hovering or focusing a chip also fills the
// panel with where it was used and the real file; pressing never navigates.
export function initToolbox() {
  const root = document.querySelector<HTMLElement>('[data-tb]');
  if (!root) return;
  const chips = [...root.querySelectorAll<HTMLButtonElement>('[data-tool]')];
  const uses = [...root.querySelectorAll<HTMLElement>('[data-use]')];
  const line = root.querySelector<HTMLElement>('[data-tb-line]')!;
  const plates = [...document.querySelectorAll<HTMLElement>('[data-proj]')];
  let pressed = -1;

  const show = (i: number) => uses.forEach((u) => (u.hidden = Number(u.dataset.use) !== i));

  const press = (i: number) => {
    pressed = i;
    chips.forEach((c) => c.setAttribute('aria-pressed', String(Number(c.dataset.tool) === i)));
    const chip = chips.find((c) => Number(c.dataset.tool) === i);
    const hrefs = new Set((chip?.dataset.hrefs || '').split(' ').filter(Boolean));
    plates.forEach((p) => {
      const lit = i < 0 || (p.dataset.proj || '').split(' ').some((h) => hrefs.has(h));
      p.toggleAttribute('data-dim', !lit);
    });
    line.textContent = chip ? chip.dataset.line! : '';
    if (i >= 0) show(i);
  };

  for (const chip of chips) {
    const i = Number(chip.dataset.tool);
    let wait = 0;
    chip.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse') wait = window.setTimeout(() => show(i), 120);
    });
    chip.addEventListener('pointerleave', () => {
      clearTimeout(wait);
      if (pressed >= 0) show(pressed);
    });
    chip.addEventListener('focus', () => show(i));
    chip.addEventListener('click', () => press(pressed === i ? -1 : i));
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && pressed >= 0) press(-1);
  });
}
