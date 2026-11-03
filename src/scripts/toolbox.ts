// The home page Toolbox: hovering or focusing a chip shows where that tool was used in the panel
// under the rows. On touch, the first tap on a chip shows its panel instead of following the link;
// a second tap on the same chip follows it, and the panel's project link works on the first.
export function initToolbox() {
  const root = document.querySelector<HTMLElement>('[data-tb]');
  if (!root) return;
  const chips = [...root.querySelectorAll<HTMLAnchorElement>('[data-tool]')];
  const uses = [...root.querySelectorAll<HTMLElement>('[data-use]')];
  let current = -1;
  let touch = false;

  const show = (i: number) => {
    current = i;
    uses.forEach((u) => (u.hidden = Number(u.dataset.use) !== i));
    chips.forEach((c) => c.toggleAttribute('data-on', Number(c.dataset.tool) === i));
  };

  for (const chip of chips) {
    const i = Number(chip.dataset.tool);
    chip.addEventListener('pointerdown', (e) => (touch = e.pointerType !== 'mouse'));
    chip.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse') show(i);
    });
    chip.addEventListener('focus', () => {
      if (!touch) show(i);
    });
    chip.addEventListener('click', (e) => {
      if (touch && current !== i) {
        e.preventDefault();
        show(i);
      }
      touch = false;
    });
  }
}
