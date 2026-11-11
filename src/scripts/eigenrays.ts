// Plate I: eigenrays in 3D. A ray tracer on the Munk sound speed profile (c0 1500 m/s, channel axis
// at 1300 m, B 1300 m, epsilon 0.00737, as in bellhopSim) fans 21 rays out from a source at 1000 m
// over 100 km and 5000 m of water (traced by src/lib/raytrace.ts), and the fan is drawn as seven slices around the source, like a
// wedge of ocean. The gold curve is sound speed against depth. There is no committed BELLHOP .ray
// output for this case, so the rays are traced here (see docs/SOURCES.md).
//
// The long note ("sound bends toward the slow water") is HTML pinned to the plate's top right
// corner, out of the 3D scene, with a thin leader line to the ray turning point nearest it, redrawn
// as the view turns. The projected labels (depth and range ticks, the source, c(z), the axis) go
// through a layout pass every frame: by priority, a label that would overlap a higher one, either
// note, or the canvas edge fades out over about 120 ms, and back in once it is clear.
//
// Drag or use the arrow keys to rotate. It turns slowly on its own while it is on screen; with
// reduced motion it draws one still frame and only moves when you move it. In dark mode the rays
// add up like light. Nothing is traced or drawn until the browser is idle after first paint.
import { token } from '../lib/tokens-client';
import { MUNK, traceRay } from '../lib/raytrace';
import { prefersReducedMotion } from './preferences';

const MAXR = 100_000;
const MAXZ = MUNK.zmax;
const ZS = 1000;
const AXIS = MUNK.axis!;
const c = MUNK.c;

/** One ray from the source at a launch angle (radians), as [range / MAXR, depth / MAXZ] points, with
 *  its turning points inside the water. Traced by the site's one ray tracer (src/lib/raytrace.ts). */
function trace(theta: number) {
  const ray = traceRay(MUNK, ZS, theta, { rmax: MAXR, ds: 100, every: 6 });
  const pts = ray.r.map((r, i) => [r / MAXR, ray.z[i] / MAXZ] as [number, number]);
  const turns = ray.turns.map((t) => [t.r / MAXR, t.z / MAXZ] as [number, number]);
  return { pts, turns };
}

type Pt = [number, number];

export function mountEigenrays(cv: HTMLCanvasElement) {
  const ctx = cv.getContext('2d')!;
  const wrap = cv.parentElement!;
  const pinned = wrap.querySelector<HTMLElement>('[data-er-pinned]');
  const notes = [...wrap.querySelectorAll<HTMLElement>('[data-er-note]')];
  const rays: { a: number; pts: Pt[]; turns: Pt[] }[] = [];
  const ssp: Pt[] = [];
  let ready = false;

  // Camera: yaw around the vertical, pitch up and down, a gentle perspective.
  const cam = { yaw: -0.62, pitch: 0.32, scale: 0.7, cx: 0.53, cy: 0.5, dist: 2.6 };
  const SLICES = 7;
  const SPREAD = 0.95;
  const D = 0.42;
  let W = 0;
  let H = 0;
  let k = 1; // canvas units per mockup unit (it was drawn at 1200 wide)
  let dpr = 1;
  const project = (x: number, y: number, z: number): Pt => {
    const cy = Math.cos(cam.yaw);
    const sy = Math.sin(cam.yaw);
    const cp = Math.cos(cam.pitch);
    const sp = Math.sin(cam.pitch);
    const X = x * cy - z * sy;
    let Z = x * sy + z * cy;
    const Y = y * cp - Z * sp;
    Z = y * sp + Z * cp;
    const f = (cam.dist - 0.3) / (Z + cam.dist);
    const s = W * cam.scale;
    return [W * cam.cx + X * f * s, H * cam.cy + Y * f * s];
  };
  const world = (R: number, depth: number, phi: number) => project(R * Math.cos(phi) - 0.5, depth * D * 2 - D, R * Math.sin(phi));

  let ink: Record<string, string> = {};
  const readInks = () => {
    ink = Object.fromEntries(['--surface', '--muted', '--rule', '--gold', '--teal', '--lilac', '--rose'].map((n) => [n, token(n)]));
    ink.dark = token('--bit-glow') === '1' ? '1' : '';
  };

  const line = (pts: Pt[], color: string, w: number, alpha: number) => {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.stroke();
  };
  const rayColor = (a: number) => {
    const t = Math.abs(a) / 13;
    return t < 0.34 ? ink['--teal'] : t < 0.67 ? ink['--lilac'] : ink['--rose'];
  };

  function draw() {
    if (!ready || !W) return;
    const dark = !!ink.dark;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = ink['--surface'];
    ctx.fillRect(0, 0, W, H);
    const mu = ink['--muted'];
    const ru = ink['--rule'];
    // Surface, bottom and the channel axis as arcs, with the wedge's edges.
    for (const [depth, col, al] of [
      [0, mu, 0.55],
      [1, mu, 0.4],
      [AXIS / MAXZ, ink['--gold'], 0.5],
    ] as const) {
      const arc: Pt[] = [];
      for (let i = 0; i <= 40; i++) arc.push(world(1, depth, -SPREAD / 2 + (SPREAD * i) / 40));
      line(arc, col, 1.2 * k, al);
      line([world(0, depth, 0), world(1, depth, -SPREAD / 2)], ru, k, 0.9);
      line([world(0, depth, 0), world(1, depth, SPREAD / 2)], ru, k, 0.9);
    }
    line([world(0, 0, 0), world(0, 1, 0)], mu, 1.2 * k, 0.6);
    for (const s of [-SPREAD / 2, SPREAD / 2]) line([world(1, 0, s), world(1, 1, s)], ru, k, 0.9);

    // The rays, one path per color (teal, lilac, rose) across every slice, so a frame is three strokes.
    if (dark) ctx.globalCompositeOperation = 'lighter';
    const byColor = new Map<string, Path2D>();
    for (let i = 0; i < SLICES; i++) {
      const phi = -SPREAD / 2 + (SPREAD * i) / (SLICES - 1);
      for (const r of rays) {
        const col = rayColor(r.a);
        let path = byColor.get(col);
        if (!path) byColor.set(col, (path = new Path2D()));
        r.pts.forEach((p, j) => {
          const q = world(p[0], p[1], phi);
          if (j) path!.lineTo(q[0], q[1]);
          else path!.moveTo(q[0], q[1]);
        });
      }
    }
    ctx.globalAlpha = dark ? 0.42 : 0.5;
    ctx.lineWidth = (dark ? 1.1 : 1) * k;
    for (const [col, path] of byColor) {
      ctx.strokeStyle = col;
      ctx.stroke(path);
    }
    ctx.globalCompositeOperation = 'source-over';

    // Sound speed against depth, beside the source's vertical.
    line(
      ssp.map((p) => {
        const q = world(0, p[1], 0);
        return [q[0] - p[0] * W * 0.12, q[1]];
      }),
      ink['--gold'],
      2.2 * k,
      0.95,
    );
    const s = world(0, ZS / MAXZ, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = ink['--gold'];
    ctx.beginPath();
    ctx.arc(s[0], s[1], 7 * k, 0, Math.PI * 2);
    ctx.fill();

    // The leader from the pinned note to the turning point nearest it, then the labels.
    const anchor = noteAnchor();
    if (anchor) {
      let best: Pt | null = null;
      let bd = Infinity;
      for (let i = 0; i < SLICES; i++) {
        const phi = -SPREAD / 2 + (SPREAD * i) / (SLICES - 1);
        for (const r of rays)
          for (const t of r.turns) {
            const q = world(t[0], t[1], phi);
            if (q[0] < 0 || q[1] < 0 || q[0] > W || q[1] > H) continue;
            const d = Math.hypot(q[0] - anchor[0], q[1] - anchor[1]);
            if (d < bd) {
              bd = d;
              best = q;
            }
          }
      }
      if (best) {
        leader = best;
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = ink['--rose'];
        ctx.lineWidth = Math.max(1, 1.4 * k);
        ctx.beginPath();
        ctx.moveTo(anchor[0], anchor[1]);
        ctx.lineTo(best[0], best[1]);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = ink['--rose'];
        ctx.beginPath();
        ctx.arc(best[0], best[1], Math.max(3, 5 * k), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    drawLabels();
  }

  // ---- Labels: a layout pass every frame ----
  type Label = { key: string; text: string; at: Pt; dx: number; dy: number; align: CanvasTextAlign; color: string; pri: number };
  const alpha = new Map<string, number>();
  const target = new Map<string, number>();
  let boxes: { key: string; box: number[]; on: boolean }[] = [];
  let leader: Pt | null = null;
  let lastLabelT = 0;
  let fading = 0;
  // The notes' boxes and the leader's start, in canvas pixels. They only move when the plate
  // resizes (or the notes' font arrives), so they are measured then and kept, never read per frame:
  // a layout read every frame would force the whole page to lay out on every frame.
  let noteBoxes: number[][] = [];
  let anchorPt: Pt | null = null;
  const measureNotes = () => {
    const cr = cv.getBoundingClientRect();
    noteBoxes = notes.map((n) => {
      const r = n.getBoundingClientRect();
      return [(r.left - cr.left) * dpr, (r.top - cr.top) * dpr, (r.right - cr.left) * dpr, (r.bottom - cr.top) * dpr];
    });
    if (!pinned || !pinned.offsetParent) anchorPt = null;
    else {
      // The leader starts under the pinned note's text, at its left end.
      const r = pinned.getBoundingClientRect();
      anchorPt = [(r.left + r.width * 0.25 - cr.left) * dpr, (r.bottom + 2 - cr.top) * dpr];
    }
  };
  const avoidBoxes = () => noteBoxes.map((b) => [...b]);
  const noteAnchor = () => anchorPt;
  function drawLabels() {
    const px = Math.round(Math.max(26 * k, 11 * dpr));
    ctx.font = `500 ${px}px "JetBrains Mono Variable", "JetBrains Fallback", monospace`;
    const mu = ink['--muted'];
    const sp = world(0, ZS / MAXZ, 0);
    const cz = ssp.length ? world(0, ssp[0][1], 0) : sp;
    const czx = ssp.length ? cz[0] - ssp[0][0] * W * 0.12 : cz[0];
    const labels: Label[] = [
      { key: 'source', text: 'source 1000 m', at: sp, dx: 14 * k, dy: 9 * k, align: 'left', color: ink['--gold'], pri: 6 },
      { key: 'cz', text: 'c(z)', at: [czx, cz[1]], dx: -8 * k, dy: -12 * k, align: 'right', color: ink['--gold'], pri: 5 },
      { key: 'axis', text: 'axis 1300 m', at: world(0, AXIS / MAXZ, 0), dx: -48 * k, dy: -14 * k, align: 'right', color: ink['--gold'], pri: 4 },
      { key: '0m', text: '0 m', at: world(0, 0, 0), dx: -12 * k, dy: 6 * k, align: 'right', color: mu, pri: 3 },
      { key: '5000m', text: '5000 m', at: world(0, 1, 0), dx: -12 * k, dy: 6 * k, align: 'right', color: mu, pri: 3 },
      { key: '100km', text: '100 km', at: world(1, 0, -SPREAD / 2), dx: 10 * k, dy: 0, align: 'left', color: mu, pri: 2 },
      { key: '50km', text: '50 km', at: world(0.5, 0, -SPREAD / 2), dx: 0, dy: -10 * k, align: 'center', color: mu, pri: 1 },
    ];
    const placed = avoidBoxes();
    const gap = 4 * dpr;
    const edge = 2 * dpr;
    boxes = [];
    for (const l of labels.sort((a, b) => b.pri - a.pri)) {
      const w = ctx.measureText(l.text).width;
      const x = l.at[0] + l.dx;
      const y = l.at[1] + l.dy;
      const x0 = l.align === 'right' ? x - w : l.align === 'center' ? x - w / 2 : x;
      const box = [x0, y - px * 0.78, x0 + w, y + px * 0.22];
      const inside = box[0] >= edge && box[1] >= edge && box[2] <= W - edge && box[3] <= H - edge;
      const clear = placed.every((p) => box[2] + gap <= p[0] || box[0] >= p[2] + gap || box[3] + gap <= p[1] || box[1] >= p[3] + gap);
      const on = inside && clear;
      if (on) placed.push(box);
      target.set(l.key, on ? 1 : 0);
      boxes.push({ key: l.key, box, on });
    }
    // Fade toward the targets: about 120 ms, or at once with reduced motion.
    const now = performance.now();
    const dt = lastLabelT ? Math.min(100, now - lastLabelT) : 1000;
    lastLabelT = now;
    const snap = prefersReducedMotion() || snapNext;
    snapNext = false;
    let moving = false;
    for (const l of labels) {
      const want = target.get(l.key)!;
      let a = alpha.get(l.key) ?? want;
      a = snap ? want : a + Math.sign(want - a) * Math.min(Math.abs(want - a), dt / 120);
      alpha.set(l.key, a);
      if (a !== want) moving = true;
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      ctx.textAlign = l.align;
      // A halo in the plate's color keeps a label legible where it crosses the rays.
      ctx.lineJoin = 'round';
      ctx.lineWidth = 4 * dpr;
      ctx.strokeStyle = ink['--surface'];
      ctx.strokeText(l.text, l.at[0] + l.dx, l.at[1] + l.dy);
      ctx.fillStyle = l.color;
      ctx.fillText(l.text, l.at[0] + l.dx, l.at[1] + l.dy);
    }
    ctx.globalAlpha = 1;
    if (moving && !fading) fading = requestAnimationFrame(() => ((fading = 0), draw()));
  }
  let snapNext = false;

  function resize() {
    const r = cv.getBoundingClientRect();
    if (!r.width) return;
    dpr = Math.min(2, devicePixelRatio || 1);
    W = Math.round(r.width * dpr);
    H = Math.round(r.height * dpr);
    if (cv.width !== W || cv.height !== H) {
      cv.width = W;
      cv.height = H;
    }
    k = W / 1200;
    measureNotes();
    draw();
  }

  // Drag and keys.
  let dragging = false;
  let lx = 0;
  let ly = 0;
  let idle = 0;
  const clampPitch = (p: number) => Math.max(-0.1, Math.min(1.1, p));
  cv.addEventListener('pointerdown', (e) => {
    dragging = true;
    lx = e.clientX;
    ly = e.clientY;
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    cam.yaw += (e.clientX - lx) * 0.008;
    cam.pitch = clampPitch(cam.pitch + (e.clientY - ly) * 0.006);
    lx = e.clientX;
    ly = e.clientY;
    idle = 0;
    draw();
  });
  const up = () => (dragging = false);
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('keydown', (e) => {
    const step = ({ ArrowLeft: [-0.08, 0], ArrowRight: [0.08, 0], ArrowUp: [0, -0.06], ArrowDown: [0, 0.06] } as Record<string, number[]>)[e.key];
    if (!step) return;
    e.preventDefault();
    cam.yaw += step[0];
    cam.pitch = clampPitch(cam.pitch + step[1]);
    idle = 0;
    draw();
  });

  // The slow idle turn runs only while the plate is on screen, the tab is visible and motion is
  // welcome, and only once the visitor has moved, scrolled or touched: a page nobody is using stays
  // still, so loading costs no animation work.
  let onScreen = false;
  let raf = 0;
  let engaged = false;
  const loop = () => {
    raf = 0;
    if (!engaged || !onScreen || document.hidden || prefersReducedMotion()) return;
    if (!dragging && ++idle > 90) {
      cam.yaw += 0.0016;
      draw();
    }
    raf = requestAnimationFrame(loop);
  };
  const kick = () => {
    if (!raf && ready) raf = requestAnimationFrame(loop);
  };
  const engage = () => {
    engaged = true;
    kick();
  };
  for (const ev of ['pointermove', 'pointerdown', 'scroll', 'keydown']) addEventListener(ev, engage, { once: true, passive: true });
  new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    if (onScreen) kick();
  }).observe(cv);
  document.addEventListener('visibilitychange', kick);
  new ResizeObserver(resize).observe(cv);
  window.addEventListener('themechange', () => {
    readInks();
    draw();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    readInks();
    draw();
  });

  // For the layout tests: set a view and read back every label's box and whether it shows.
  (cv as HTMLCanvasElement & { __er?: unknown }).__er = {
    setView(yaw: number, pitch: number) {
      cam.yaw = yaw;
      cam.pitch = clampPitch(pitch);
      snapNext = true;
      draw();
    },
    labels: () => boxes.map((b) => ({ ...b })),
    avoid: () => avoidBoxes(),
    leader: () => leader,
    size: () => [W, H],
    ready: () => ready,
  };

  // Trace and draw once the page has painted and the browser is idle.
  // The rays are traced a few at a time in idle slices, so no single task runs long; the drawing
  // appears once all of them are done, exactly as before.
  const angles: number[] = [];
  for (let a = -13; a <= 13.01; a += 1.3) angles.push(a);
  const start = (deadline?: IdleDeadline) => {
    const until = performance.now() + Math.max(8, Math.min(30, deadline?.timeRemaining() ?? 12));
    while (rays.length < angles.length && performance.now() < until) {
      const a = angles[rays.length];
      rays.push({ a, ...trace((a * Math.PI) / 180) });
    }
    if (rays.length < angles.length) {
      if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 300 });
      else setTimeout(start, 0);
      return;
    }
    for (let z = 0; z <= MAXZ; z += 100) ssp.push([(c(z) - 1480) / 90, z / MAXZ]);
    ready = true;
    readInks();
    resize();
    kick();
    document.fonts?.ready.then(() => {
      measureNotes();
      draw();
    });
  };
  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 1200 });
  else setTimeout(start, 200);
}
