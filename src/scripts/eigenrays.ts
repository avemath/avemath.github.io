// Plate I: eigenrays in 3D. A ray tracer on the Munk sound speed profile (c0 1500 m/s, channel axis
// at 1300 m, B 1300 m, epsilon 0.00737, as in bellhopSim) fans 21 rays out from a source at 1000 m
// over 100 km and 5000 m of water, and the fan is drawn as seven slices around the source, like a
// wedge of ocean. The gold curve is sound speed against depth. There is no committed BELLHOP .ray
// output for this case, so the rays are traced here (see docs/SOURCES.md).
//
// Drag or use the arrow keys to rotate. It turns slowly on its own while it is on screen; with
// reduced motion it draws one still frame and only moves when you move it. In dark mode the rays
// add up like light. Nothing is traced or drawn until the browser is idle after first paint.
import { token } from '../lib/tokens-client';
import { prefersReducedMotion } from './preferences';

const MAXR = 100_000;
const MAXZ = 5000;
const ZS = 1000;
const AXIS = 1300;
const c = (z: number) => {
  const e = (2 * (z - AXIS)) / 1300;
  return 1500 * (1 + 0.00737 * (e - 1 + Math.exp(-e)));
};
const dc = (z: number) => {
  const e = (2 * (z - AXIS)) / 1300;
  return (1500 * 0.00737 * (1 - Math.exp(-e)) * 2) / 1300;
};

/** One ray from the source at a launch angle (radians), as [range / MAXR, depth / MAXZ] points. */
function trace(theta: number) {
  let r = 0;
  let z = ZS;
  let th = theta;
  const ds = 100;
  const pts: [number, number][] = [];
  for (let i = 0; r < MAXR; i++) {
    th += (-dc(z) / c(z)) * Math.cos(th) * ds;
    r += Math.cos(th) * ds;
    z += Math.sin(th) * ds;
    if (z < 0) {
      z = -z;
      th = -th;
    }
    if (z > MAXZ) {
      z = 2 * MAXZ - z;
      th = -th;
    }
    if (i % 6 === 0) pts.push([r / MAXR, z / MAXZ]);
  }
  return pts;
}

type Pt = [number, number];

export function mountEigenrays(cv: HTMLCanvasElement) {
  const ctx = cv.getContext('2d')!;
  const rays: { a: number; pts: Pt[] }[] = [];
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

    // Labels scale with the plate but never below 11 CSS pixels.
    ctx.font = `500 ${Math.round(Math.max(26 * k, 11 * dpr))}px "JetBrains Mono Variable", "JetBrains Fallback", monospace`;
    ctx.fillStyle = mu;
    ctx.textAlign = 'right';
    const t0 = world(0, 0, 0);
    const tb = world(0, 1, 0);
    const ta = world(0, AXIS / MAXZ, 0);
    const tr = world(1, 0, -SPREAD / 2);
    ctx.fillText('0 m', t0[0] - 12 * k, t0[1] + 6 * k);
    ctx.fillText('5000 m', tb[0] - 12 * k, tb[1] + 6 * k);
    ctx.fillStyle = ink['--gold'];
    ctx.fillText('axis 1300 m', ta[0] - 48 * k, ta[1] - 14 * k);
    ctx.fillStyle = mu;
    ctx.textAlign = 'left';
    ctx.fillText('100 km', tr[0] + 10 * k, tr[1]);
  }

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

  // Trace and draw once the page has painted and the browser is idle.
  const start = () => {
    for (let a = -13; a <= 13.01; a += 1.3) rays.push({ a, pts: trace((a * Math.PI) / 180) });
    for (let z = 0; z <= MAXZ; z += 100) ssp.push([(c(z) - 1480) / 90, z / MAXZ]);
    ready = true;
    readInks();
    resize();
    kick();
    document.fonts?.ready.then(draw);
  };
  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 1200 });
  else setTimeout(start, 200);
}
