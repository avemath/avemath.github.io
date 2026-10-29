// Runs the Grace Mae live version: a vanilla port of BustleExplorer.tsx from
// github.com/avemath/gracemaealterations. The drawing is the site's own code (src/lib/bustle-drawing.js,
// compiled from the vendored bustleDrawing.tsx); one value t, 0 for train down and 1 for bustled,
// drives every shape, and the button and the slider move t. Style notes are copied from the
// explorer's STYLES table and the wording from its Guides & tools defaults.
import { BackView, SideView, bustleSteps, stepFor, GOLD, FOLD_FILL } from '../../lib/bustle-drawing.js';
import { h } from '../../lib/svg-h';
import text from '../../../vendor/gracemae/bustle-text.json';
import { prefersReducedMotion } from '../preferences';

type StyleId = 'american' | 'french' | 'austrian' | 'ballroom' | 'detachable-train';
type TrainId = 'sweep' | 'chapel' | 'cathedral';
type Text = Record<string, string>;
const T = text as Text;

const STYLES: Record<StyleId, { name: string; alsoCalled: string; typicalPoints: string; how: string; points: Record<TrainId, number> }> = {
  american: { name: 'American', alsoCalled: 'Over-bustle, pickup bustle', typicalPoints: '2 to 7 points', how: T.bustleHowAmerican, points: { sweep: 1, chapel: 3, cathedral: 5 } },
  french: { name: 'French', alsoCalled: 'Under-bustle, Victorian bustle', typicalPoints: '2 to 5 points', how: T.bustleHowFrench, points: { sweep: 2, chapel: 3, cathedral: 5 } },
  austrian: { name: 'Austrian', alsoCalled: 'Ruched bustle, gathered bustle', typicalPoints: 'One continuous gather', how: T.bustleHowAustrian, points: { sweep: 1, chapel: 1, cathedral: 1 } },
  ballroom: { name: 'Ballroom', alsoCalled: 'Floor-length bustle', typicalPoints: '3 to 9 points', how: T.bustleHowBallroom, points: { sweep: 3, chapel: 5, cathedral: 7 } },
  'detachable-train': { name: 'Detachable train', alsoCalled: 'Removable train, convertible train', typicalPoints: 'Not applicable', how: T.bustleHowDetachable, points: { sweep: 0, chapel: 0, cathedral: 0 } },
};

const fill = (tpl: string, vars: Record<string, string | number>) => tpl.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
const ease = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const UID = 'gm';

export function mount(panel: HTMLElement) {
  const $ = <T extends Element>(s: string) => panel.querySelector<T>(s)!;
  const svg = $<SVGSVGElement>('[data-gm-svg]');
  const layer = $<SVGGElement>('[data-gm-layer]');
  const titleEl = $<SVGTitleElement>('[data-gm-title]');
  const stageEl = $<HTMLElement>('[data-gm-stage]');
  const stepEl = $<HTMLElement>('[data-gm-step]');
  const btn = $<HTMLButtonElement>('[data-gm-toggle]');
  const slider = $<HTMLInputElement>('[data-gm-slider]');
  const spoken = $<HTMLElement>('[data-gm-spoken]');
  const nameEl = $<HTMLElement>('[data-gm-name]');
  const alsoEl = $<HTMLElement>('[data-gm-also]');
  const howEl = $<HTMLElement>('[data-gm-how]');
  const ptsEl = $<HTMLElement>('[data-gm-points]');
  const viewBtns = [...panel.querySelectorAll<HTMLButtonElement>('[data-gm-view]')];

  let style: StyleId = 'american';
  let train: TrainId = 'chapel';
  let t = 0;
  let raf = 0;
  let view: 'back' | 'side' = 'side';
  let lastSpoken = '';
  const steps = bustleSteps(T) as Record<StyleId, [string, string, string]>;
  const stages = [T.bustleStageCeremony, T.bustleStageBustling, T.bustleStageReception];

  // Narrow panels show one view at a time, big enough to follow, like the site does on phones.
  const narrow = () => panel.clientWidth < 520;

  function draw() {
    const s = STYLES[style];
    const n = s.points[train];
    const bustled = t > 0.5;
    const state = bustled ? T.bustleStateUp : T.bustleStateDown;
    const nar = narrow();
    svg.setAttribute('viewBox', nar ? (view === 'back' ? '0 0 360 520' : '360 0 320 520') : '0 0 680 520');
    layer.replaceChildren(
      h(BackView, { style, train, t, n, uid: UID })!,
      h('g', { transform: 'translate(360 0)' }, h(SideView, { style, train, t, uid: UID }))!,
    );
    panel.querySelectorAll<SVGTextElement>('[data-gm-wide]').forEach((e) => (e.style.display = nar ? 'none' : ''));
    titleEl.textContent = fill(T.bustleDrawingName, { style: s.name, state });
    const k = stepFor(t);
    stageEl.textContent = `${stages[k]} · ${fill(T.bustleStepCount, { step: k + 1, total: stages.length })}`;
    stepEl.textContent = steps[style][k];
    btn.textContent = bustled ? T.bustleButtonDown : T.bustleButtonUp;
    slider.value = String(Math.round(t * 100));
    slider.setAttribute('aria-valuetext', state);
    const say = fill(T.bustleSpokenUpdate, { style: s.name, state });
    if (say !== lastSpoken) spoken.textContent = lastSpoken = say;
    nameEl.textContent = s.name;
    alsoEl.textContent = fill(T.bustleAlsoCalled, { names: s.alsoCalled });
    howEl.textContent = s.how;
    ptsEl.textContent = s.typicalPoints + (n > 1 ? ` ${fill(T.bustlePointsInDrawing, { count: n })}` : '');
    viewBtns.forEach((b) => {
      b.hidden = !nar;
      b.setAttribute('aria-pressed', String(b.dataset.gmView === view));
    });
  }

  function animateTo(target: number, from = t) {
    cancelAnimationFrame(raf);
    if (prefersReducedMotion()) {
      t = target;
      draw();
      return;
    }
    const start = performance.now();
    // Slow enough to follow where each point goes.
    const duration = 400 + 2400 * Math.abs(target - from);
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      t = from + (target - from) * ease(p);
      draw();
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  panel.querySelectorAll<HTMLInputElement>('input[name="gm-style"]').forEach((r) =>
    r.addEventListener('change', () => {
      style = r.value as StyleId;
      t = 0;
      animateTo(1, 0);
    }),
  );
  panel.querySelectorAll<HTMLInputElement>('input[name="gm-train"]').forEach((r) =>
    r.addEventListener('change', () => {
      train = r.value as TrainId;
      t = 0;
      animateTo(1, 0);
    }),
  );
  btn.addEventListener('click', () => animateTo(t > 0.5 ? 0 : 1));
  slider.addEventListener('input', () => {
    cancelAnimationFrame(raf);
    t = Number(slider.value) / 100;
    draw();
  });
  viewBtns.forEach((b) =>
    b.addEventListener('click', () => {
      view = b.dataset.gmView as 'back' | 'side';
      draw();
    }),
  );
  const ro = new ResizeObserver(() => draw());
  ro.observe(panel);

  // The gradients and the arrow head the drawing refers to, from the explorer's <defs>.
  $('[data-gm-defs]').replaceChildren(
    h('radialGradient', { id: `${UID}-glow`, cx: '50%', cy: '40%', r: '65%' }, h('stop', { offset: '0%', stopColor: '#3a3230' }), h('stop', { offset: '100%', stopColor: '#1f1b1b' }))!,
    h('radialGradient', { id: `${UID}-pouf`, cx: '50%', cy: '30%', r: '75%' }, h('stop', { offset: '0%', stopColor: '#FFFDF9' }), h('stop', { offset: '100%', stopColor: FOLD_FILL }))!,
    h('linearGradient', { id: `${UID}-silk`, x1: '0', x2: '1', y1: '0', y2: '0' }, h('stop', { offset: '0%', stopColor: '#E9E1D6' }), h('stop', { offset: '35%', stopColor: '#FFFDF9' }), h('stop', { offset: '65%', stopColor: '#FFFDF9' }), h('stop', { offset: '100%', stopColor: '#E4DBCF' }))!,
    h('linearGradient', { id: `${UID}-silk-side`, x1: '0', x2: '1', y1: '0', y2: '0' }, h('stop', { offset: '0%', stopColor: '#FFFDF9' }), h('stop', { offset: '55%', stopColor: '#F6F0E8' }), h('stop', { offset: '100%', stopColor: '#E2D8CA' }))!,
    h('marker', { id: `${UID}-arrow`, viewBox: '0 0 10 10', refX: '7', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' }, h('path', { d: 'M0,1 L9,5 L0,9 Z', fill: GOLD }))!,
  );

  draw();
  // Like the site, it bustles once on its own to show what happens, unless motion is reduced.
  if (!prefersReducedMotion()) animateTo(1, 0);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
  };
}
