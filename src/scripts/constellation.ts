// The skills constellation's interactive layer: one button per skill over its point, moved
// between with the arrow keys (a single tab stop). Picking a skill names it, says how well I know
// it, and lights up the projects whose stack lists it, or says plainly that none does.

interface Point {
  skill: string;
  known: boolean;
  x: number;
  y: number;
  projects: string[];
}

export function mountConstellation(root: HTMLElement) {
  const hits = root.querySelector<HTMLElement>('[data-cst-hits]');
  const panel = root.querySelector<HTMLElement>('[data-cst-panel]');
  const list = root.parentElement?.querySelector<HTMLDetailsElement>('[data-cst-list]');
  if (!hits || !panel) return;
  const points: Point[] = JSON.parse(root.dataset.points ?? '[]');
  const dots = [...root.querySelectorAll<SVGGElement>('[data-pt]')];
  const chips = [...root.querySelectorAll<HTMLAnchorElement>('[data-proj]')];
  const titleOf = (id: string) => chips.find((c) => c.dataset.proj === id)?.textContent?.trim() ?? id;

  // On wide screens the constellation is the main view, so the list folds away (one click to open).
  if (list && matchMedia('(min-width: 1024px)').matches) list.open = false;

  const tip = document.createElement('span');
  tip.className = 'cst__tip';
  tip.hidden = true;
  tip.setAttribute('aria-hidden', 'true');

  const buttons = points.map((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cst__hit';
    b.style.left = `${p.x / 10}%`;
    b.style.top = `${(p.y / 560) * 100}%`;
    b.tabIndex = i === 0 ? 0 : -1;
    b.setAttribute('aria-label', `${p.skill}, ${p.known ? 'know well' : 'have built with'}`);
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => pick(i));
    b.addEventListener('focus', () => pick(i));
    b.addEventListener('pointerenter', () => showTip(i));
    b.addEventListener('pointerleave', () => (current >= 0 ? showTip(current) : (tip.hidden = true)));
    return b;
  });
  hits.append(...buttons, tip);

  let current = -1;

  function showTip(i: number) {
    tip.textContent = points[i].skill;
    tip.style.left = `${points[i].x / 10}%`;
    tip.style.top = `${(points[i].y / 560) * 100}%`;
    tip.hidden = false;
  }

  function pick(i: number) {
    current = i;
    const p = points[i];
    buttons.forEach((b, j) => {
      b.tabIndex = j === i ? 0 : -1;
      b.setAttribute('aria-pressed', String(j === i));
    });
    const on = new Set(p.projects);
    root.toggleAttribute('data-active', true);
    // The picked skill, and every skill that shares one of its projects.
    dots.forEach((d, j) => {
      d.toggleAttribute('data-current', j === i);
      d.toggleAttribute('data-on', j === i || points[j].projects.some((id) => on.has(id)));
    });
    chips.forEach((c) => c.toggleAttribute('data-on', on.has(c.dataset.proj ?? '')));
    showTip(i);

    const how = p.known ? 'Know well' : 'Have built with';
    const names = p.projects.map(titleOf);
    const used = names.length
      ? `Used in ${names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0]}.`
      : 'No project on this site lists it in its stack.';
    panel!.replaceChildren();
    const strong = document.createElement('strong');
    strong.textContent = p.skill;
    panel!.append(strong, ` · ${how}. ${used}`);
  }

  // Arrow keys walk the points in reading order: left to right, top to bottom.
  const order = points.map((_, i) => i).sort((a, b) => points[a].x - points[b].x || points[a].y - points[b].y);
  hits.addEventListener('keydown', (e) => {
    const at = order.indexOf(current < 0 ? 0 : current);
    const step: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let next: number | undefined;
    if (e.key in step) next = order[(at + step[e.key] + order.length) % order.length];
    else if (e.key === 'Home') next = order[0];
    else if (e.key === 'End') next = order[order.length - 1];
    else if (e.key === 'Escape') {
      current = -1;
      root.removeAttribute('data-active');
      dots.forEach((d) => (d.removeAttribute('data-current'), d.removeAttribute('data-on')));
      chips.forEach((c) => c.removeAttribute('data-on'));
      tip.hidden = true;
      panel!.textContent = 'Pick a skill to see the projects that list it.';
      return;
    }
    if (next === undefined) return;
    e.preventDefault();
    buttons[next].focus();
  });
}
