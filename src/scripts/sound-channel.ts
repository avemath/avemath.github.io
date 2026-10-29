// Makes the sound channel figure interactive: the source on the depth axis becomes a slider you
// can drag or move with the arrow keys, and the rays are traced again from its new depth. Nothing
// animates on its own, so it behaves the same with reduced motion.
import { AXIS, FLOOR, PLOT, depthY, rays, describe, speed } from '../lib/sound-channel';

const MIN = 50;
const MAX = FLOOR - 50;

export function mountSoundChannel(fig: HTMLElement) {
  const svg = fig.querySelector<SVGSVGElement>('[data-ssp-svg]');
  const handle = fig.querySelector<SVGGElement>('[data-ssp-handle]');
  const set = fig.querySelector<SVGGElement>('[data-ssp-rays]');
  const mark = fig.querySelector<SVGGElement>('[data-ssp-mark]');
  const dot = fig.querySelector<SVGCircleElement>('[data-ssp-dot]');
  const readout = fig.querySelector<HTMLElement>('[data-ssp-readout]');
  const title = fig.querySelector<SVGTitleElement>('[data-ssp-rays-title]');
  if (!svg || !handle || !set) return;

  let z0 = Number(fig.dataset.z0) || AXIS;
  const paths = [...set.querySelectorAll<SVGPathElement>('path')];
  // The profile panel's speed scale, matching SoundSpeed.astro.
  const sx = (c: number) => 54 + ((c - 1490) / 60) * 190;

  let queued = false;
  function draw() {
    queued = false;
    const { paths: next, held } = rays(z0);
    next.forEach((p, i) => {
      paths[i]?.setAttribute('d', p.d);
      paths[i]?.classList.toggle('ssp__ray--out', p.bounced);
    });
    handle!.style.transform = `translateY(${depthY(z0)}px)`;
    mark?.style.setProperty('transform', `translateY(${depthY(z0) - depthY(AXIS)}px)`);
    dot?.setAttribute('cx', sx(speed(z0)).toFixed(1));
    const text = describe(z0, held);
    if (readout) readout.textContent = text;
    if (title) title.textContent = `Ten rays traced from the source. ${text}`;
    handle!.setAttribute('aria-valuenow', String(Math.round(z0)));
    handle!.setAttribute('aria-valuetext', text);
  }

  const setDepth = (z: number) => {
    z0 = Math.max(MIN, Math.min(MAX, z));
    if (!queued) {
      queued = true;
      requestAnimationFrame(draw);
    }
  };

  // A slider on the depth axis.
  handle.setAttribute('role', 'slider');
  handle.setAttribute('tabindex', '0');
  handle.setAttribute('aria-label', 'Source depth');
  handle.setAttribute('aria-orientation', 'vertical');
  handle.setAttribute('aria-valuemin', String(MIN));
  handle.setAttribute('aria-valuemax', String(MAX));
  fig.querySelector<HTMLElement>('[data-ssp-how]')?.removeAttribute('hidden');

  handle.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 250 : 50;
    const moves: Record<string, number> = { ArrowDown: step, ArrowRight: step, ArrowUp: -step, ArrowLeft: -step, PageDown: 500, PageUp: -500 };
    if (e.key === 'Home') setDepth(MIN);
    else if (e.key === 'End') setDepth(MAX);
    else if (e.key in moves) setDepth(z0 + moves[e.key]);
    else return;
    e.preventDefault();
  });

  // Pointer drag: the pointer's height on the ray panel is the source depth.
  const depthAt = (clientY: number) => {
    const r = svg.getBoundingClientRect();
    const y = ((clientY - r.top) / r.height) * 300;
    return ((y - PLOT.y0) / (PLOT.y1 - PLOT.y0)) * FLOOR;
  };
  handle.addEventListener('pointerdown', (e) => {
    handle.setPointerCapture(e.pointerId);
    handle.focus({ preventScroll: true });
    setDepth(depthAt(e.clientY));
  });
  handle.addEventListener('pointermove', (e) => {
    if (handle.hasPointerCapture(e.pointerId)) setDepth(depthAt(e.clientY));
  });

  draw();
}
