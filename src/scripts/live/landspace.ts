// Runs the Landspace live tile: draw a parcel on a made-up section grid and it computes the
// acreage and perimeter with the app's own code (vendor/landspace: polygonAreaMeters2 and
// ringPerimeterMeters from geo.js, fmtAcres and fmtPerimeter from format.js). The grid and its
// coordinates are invented; only the math is real.
import { polygonAreaMeters2, ringPerimeterMeters } from '../../../vendor/landspace/geo.js';
import { fmtAcres, fmtPerimeter } from '../../../vendor/landspace/format.js';

const MILE = 1609.344;
const W = MILE; // m, the grid is one mile wide
const H = MILE * 0.75; // and three quarters of a mile tall
const SNAP = MILE / 8; // an eighth of a mile: 10 acre squares
const VB = { w: 320, h: 240 };
// Made-up coordinates for the grid's top-left corner, so the app's spherical math has a latitude.
const LAT0 = 31.5;
const LNG0 = -97.25;
const R = 6371008.8;
const toLatLng = (x: number, y: number) => ({
  lat: LAT0 - ((y / R) * 180) / Math.PI,
  lng: LNG0 + ((x / (R * Math.cos((LAT0 * Math.PI) / 180))) * 180) / Math.PI,
});
// A made-up L-shaped tract, ten of the 10 acre squares: 100 acres.
const SAMPLE: [number, number][] = [
  [2, 1],
  [5, 1],
  [5, 3],
  [4, 3],
  [4, 5],
  [2, 5],
].map(([i, j]) => [i * SNAP, j * SNAP]);

export function mount(panel: HTMLElement) {
  const $ = <T extends Element>(s: string) => panel.querySelector<T>(s)!;
  const map = $<SVGSVGElement>('[data-ls-map]');
  const shape = $<SVGPolygonElement>('[data-ls-shape]');
  const dots = $<SVGGElement>('[data-ls-dots]');
  const cursor = $<SVGCircleElement>('[data-ls-cursor]');
  const area = $<HTMLElement>('[data-ls-area]');
  const perim = $<HTMLElement>('[data-ls-perim]');
  const count = $<HTMLElement>('[data-ls-count]');
  const live = $<HTMLElement>('[data-ls-live]');
  const snapBox = $<HTMLInputElement>('[data-ls-snap]');

  let pts: [number, number][] = [];
  let cur: [number, number] = [W / 2, H / 2];
  const sx = (m: number) => (m / W) * VB.w;
  const sy = (m: number) => (m / H) * VB.h;
  const snap = (v: number) => (snapBox.checked ? Math.round(v / SNAP) * SNAP : v);

  function render(announce = true) {
    shape.setAttribute('points', pts.map(([x, y]) => `${sx(x)},${sy(y)}`).join(' '));
    dots.replaceChildren(
      ...pts.map(([x, y]) => {
        const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c.setAttribute('cx', String(sx(x)));
        c.setAttribute('cy', String(sy(y)));
        c.setAttribute('r', '3.2');
        return c;
      }),
    );
    cursor.setAttribute('cx', String(sx(cur[0])));
    cursor.setAttribute('cy', String(sy(cur[1])));
    const ring = pts.map(([x, y]) => toLatLng(x, y));
    const a = pts.length >= 3 ? fmtAcres(polygonAreaMeters2(ring)) : null;
    const p = pts.length >= 2 ? fmtPerimeter(ringPerimeterMeters(ring)) : null;
    area.textContent = a ?? 'Add 3 corners';
    perim.textContent = p ?? '0 ft';
    count.textContent = `${pts.length} ${pts.length === 1 ? 'corner' : 'corners'}`;
    if (announce) live.textContent = a ? `${pts.length} corners, ${a.replace(' ac', ' acres')}, perimeter ${p}` : `${pts.length} ${pts.length === 1 ? 'corner' : 'corners'}`;
  }

  function add(x: number, y: number) {
    pts.push([snap(Math.min(W, Math.max(0, x))), snap(Math.min(H, Math.max(0, y)))]);
    render();
  }

  map.addEventListener('click', (e) => {
    const r = map.getBoundingClientRect();
    cur = [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
    add(cur[0], cur[1]);
  });

  // Keyboard: arrows move the crosshair a grid step (Shift for a finer step), Enter or Space
  // drops a corner there, Backspace takes the last one back.
  map.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? SNAP / 4 : SNAP;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      e.preventDefault();
      cur = [Math.min(W, Math.max(0, cur[0] + moves[e.key][0])), Math.min(H, Math.max(0, cur[1] + moves[e.key][1]))];
      render(false);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      add(cur[0], cur[1]);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      pts.pop();
      render();
    }
  });

  $('[data-ls-undo]').addEventListener('click', () => (pts.pop(), render()));
  $('[data-ls-clear]').addEventListener('click', () => ((pts = []), render()));
  $('[data-ls-sample]').addEventListener('click', () => ((pts = SAMPLE.map((p) => [...p] as [number, number])), render()));

  render(false);
  return () => {};
}
