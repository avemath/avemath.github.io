// Runs the Because of ADAM live version: the update() from the site's LayersBuilder, unchanged
// in behavior. Each switch draws its layer; the door, gate and cover each put a stop on the path,
// and the gate's stop needs the fence too.
const messages = [
  'Nothing stands between a curious toddler and the water.',
  'A start. One layer can fail, get switched off, or be left open.',
  'Better. Each layer buys you time.',
  'Now a child who slips out has to get past several layers.',
  'Strong protection. Keep every layer working, every day.',
  'Almost there. Layers only work when they’re used, especially when guests are over.',
  'Every layer is in place. No single layer is perfect, but together they save lives.',
];

export function mount(panel: HTMLElement) {
  const root = panel.querySelector<HTMLElement>('[data-builder]')!;
  const inputs = root.querySelectorAll<HTMLInputElement>('input[type=checkbox]');
  const status = root.querySelector<HTMLElement>('[data-ab-status]')!;
  const fill = root.querySelector<HTMLElement>('[data-ab-fill]')!;

  const update = () => {
    const on = new Set([...inputs].filter((i) => i.checked).map((i) => i.value));
    root.querySelectorAll<SVGGElement>('[data-layer]').forEach((g) => g.classList.toggle('is-on', on.has(g.dataset.layer!)));
    root.querySelectorAll<SVGGElement>('[data-stop]').forEach((g) => {
      const key = g.dataset.stop!;
      g.classList.toggle('is-on', key === 'gate' ? on.has('gate') && on.has('fence') : on.has(key));
    });
    const n = on.size;
    fill.style.transform = `scaleX(${n / inputs.length})`;
    status.replaceChildren(Object.assign(document.createElement('strong'), { textContent: `${n} of ${inputs.length} turned on.` }), ` ${messages[n]}`);
    root.classList.toggle('is-complete', n === inputs.length);
  };

  inputs.forEach((i) => i.addEventListener('change', update));
  update();
  return () => inputs.forEach((i) => i.removeEventListener('change', update));
}
