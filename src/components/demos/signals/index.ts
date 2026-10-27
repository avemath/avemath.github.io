// Tabs for the signals playground. Each panel's module loads on first view, so opening the page
// only runs the hopping demo.
type Panel = { show?: () => void; hide?: () => void };
const loaders: Record<string, () => Promise<{ init: (el: HTMLElement) => Panel }>> = {
  fh: () => import('./fhbfsk'),
  const: () => import('./constellation'),
  ber: () => import('./ber'),
  mf: () => import('./matched'),
  mp: () => import('./multipath'),
};

export function initSignals(root: HTMLElement) {
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const panels = new Map<string, Promise<Panel>>();
  let current = '';

  function panelFor(id: string) {
    let p = panels.get(id);
    if (!p) {
      const el = root.querySelector<HTMLElement>(`[data-panel="${id}"]`)!;
      p = loaders[id]().then((m) => m.init(el));
      panels.set(id, p);
    }
    return p;
  }

  function select(id: string, focus = false) {
    if (id === current) return;
    if (current) panelFor(current).then((p) => p.hide?.());
    current = id;
    for (const t of tabs) {
      const on = t.dataset.tab === id;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
      root.querySelector<HTMLElement>(`#${t.getAttribute('aria-controls')}`)!.hidden = !on;
    }
    panelFor(id).then((p) => p.show?.());
  }

  root.querySelector('[role="tablist"]')!.addEventListener('keydown', (e) => {
    const ev = e as KeyboardEvent;
    const i = tabs.findIndex((t) => t.dataset.tab === current);
    const next = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: tabs.length - 1 }[ev.key];
    if (next === undefined) return;
    ev.preventDefault();
    select(tabs[(next + tabs.length) % tabs.length].dataset.tab!, true);
  });
  for (const t of tabs) t.addEventListener('click', () => select(t.dataset.tab!));

  select('fh');
}

