// The Research page's ray tracer (src/components/research/RayTracer.astro). See that file for what
// it shows. The rays come from src/lib/raytrace.ts, the same tracer as the home hero.
import { token } from '../lib/tokens-client';
import { PROFILES, fan, traceRay, eigenrays, type Profile, type Ray, type Eigenray } from '../lib/raytrace';
import { prefersReducedMotion } from './preferences';

const DEG = Math.PI / 180;
/** Rays drawn in the fan, and in the dense fan that finds the eigenrays. */
const DRAWN = 31;
const DENSE = 361;

const fmtM = (m: number) => (m >= 1000 ? `${Number((m / 1000).toPrecision(3))} km` : `${Math.round(m)} m`);
const fmtS = (s: number) => (s >= 10 ? `${s.toFixed(1)} s` : s >= 1 ? `${s.toFixed(2)} s` : `${(s * 1000).toFixed(0)} ms`);

export function mountRayTracer(root: HTMLElement) {
  const $ = <T extends Element>(s: string) => root.querySelector<T>(s)!;
  const env = $<HTMLSelectElement>('[data-rt-env]');
  const zsIn = $<HTMLInputElement>('[data-rt-zs]');
  const fanIn = $<HTMLInputElement>('[data-rt-fan]');
  const rrIn = $<HTMLInputElement>('[data-rt-rr]');
  const rzIn = $<HTMLInputElement>('[data-rt-rz]');
  const out = (k: string) => $<HTMLOutputElement>(`[data-rt-${k}-out]`);
  const clock = $<HTMLElement>('[data-rt-clock]');
  const sum = $<HTMLElement>('[data-rt-sum]');
  const main = $<HTMLCanvasElement>('[data-rt-main]');
  const stem = $<HTMLCanvasElement>('[data-rt-stem]');
  const mctx = main.getContext('2d')!;
  const sctx = stem.getContext('2d')!;

  // ---- State ----
  let prof: Profile = PROFILES[0];
  const zs = () => (Number(zsIn.value) / 1000) * prof.zmax;
  const half = () => Number(fanIn.value) * DEG;
  const rr = () => Math.max(prof.rmax * 0.01, (Number(rrIn.value) / 1000) * prof.rmax);
  const rz = () => (Number(rzIn.value) / 1000) * prof.zmax;
  let rays: Ray[] = [];
  let eig: (Eigenray & { ray: Ray })[] = [];
  let ping = -1; // seconds since the ping, or -1 for none
  let pingEnd = 0;

  // ---- Colors ----
  let ink: Record<string, string> = {};
  const readInk = () => {
    ink = Object.fromEntries(['--surface', '--text', '--muted', '--line', '--line-strong', '--gold', '--accent', '--teal', '--lilac', '--rose'].map((n) => [n, token(n)]));
  };
  const bounceColor = (s: number, b: number) => (s === 0 && b === 0 ? ink['--accent'] : b === 0 ? ink['--teal'] : s === 0 ? ink['--lilac'] : ink['--rose']);

  // ---- Geometry ----
  let W = 0;
  let H = 0;
  let SW = 0;
  let SH = 0;
  let dpr = 1;
  const font = (px: number) => `500 ${Math.round(px * dpr)}px "JetBrains Mono Variable", "JetBrains Fallback", monospace`;
  // The plot areas inside the main canvas: c(z) on the left, depth by range on the right.
  const box = () => {
    const pad = 10 * dpr;
    const top = 22 * dpr;
    const bottom = H - 26 * dpr;
    const sspL = 46 * dpr;
    const sspR = sspL + Math.max(60 * dpr, W * 0.16);
    const plotL = sspR + 14 * dpr;
    const plotR = W - pad;
    return { top, bottom, sspL, sspR, plotL, plotR };
  };
  const cRange = () => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i <= 100; i++) {
      const c = prof.c((prof.zmax * i) / 100);
      lo = Math.min(lo, c);
      hi = Math.max(hi, c);
    }
    if (hi - lo < 1) (lo -= 5), (hi += 5);
    return [lo, hi];
  };
  const X = (r: number) => {
    const b = box();
    return b.plotL + (r / prof.rmax) * (b.plotR - b.plotL);
  };
  const Y = (z: number) => {
    const b = box();
    return b.top + (z / prof.zmax) * (b.bottom - b.top);
  };

  // ---- Tracing ----
  const traceDrawn = () => {
    rays = fan(prof, zs(), -half(), half(), DRAWN);
  };
  let eigTimer = 0;
  const traceEig = () => {
    const dense = fan(prof, zs(), -half(), half(), DENSE, { every: 2 });
    eig = eigenrays(dense, rr(), rz()).map((e) => ({ ...e, ray: traceRay(prof, zs(), e.theta, { rmax: rr(), every: 2 }) }));
    const n = eig.length;
    sum.textContent = n
      ? `${n} eigenray${n === 1 ? '' : 's'}, first arrival ${fmtS(eig[0].t)}, last ${fmtS(eig[n - 1].t)}, at ${fmtM(rr())} and ${fmtM(rz())} deep (${prof.name}).`
      : `No eigenrays reach ${fmtM(rr())} at ${fmtM(rz())} in this fan (${prof.name}). Widen the fan or move the receiver.`;
    root.dataset.eig = String(n);
    drawAll();
  };
  const scheduleEig = () => {
    clearTimeout(eigTimer);
    eigTimer = window.setTimeout(traceEig, 140);
  };

  // ---- Drawing ----
  const path = (ctx: CanvasRenderingContext2D, ray: Ray, until = Infinity) => {
    ctx.beginPath();
    for (let i = 0; i < ray.r.length; i++) {
      if (ray.t[i] > until) {
        // Stop at the pulse, interpolated.
        const a = (until - ray.t[i - 1]) / (ray.t[i] - ray.t[i - 1]);
        ctx.lineTo(X(ray.r[i - 1] + a * (ray.r[i] - ray.r[i - 1])), Y(ray.z[i - 1] + a * (ray.z[i] - ray.z[i - 1])));
        break;
      }
      if (i) ctx.lineTo(X(ray.r[i]), Y(ray.z[i]));
      else ctx.moveTo(X(ray.r[i]), Y(ray.z[i]));
    }
    ctx.stroke();
  };
  const pulseAt = (ray: Ray, t: number) => {
    for (let i = 1; i < ray.r.length; i++) {
      if (ray.t[i] >= t) {
        const a = (t - ray.t[i - 1]) / (ray.t[i] - ray.t[i - 1]);
        return [X(ray.r[i - 1] + a * (ray.r[i] - ray.r[i - 1])), Y(ray.z[i - 1] + a * (ray.z[i] - ray.z[i - 1]))];
      }
    }
    return null;
  };

  const drawMain = () => {
    if (!W) return;
    const c = mctx;
    const b = box();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.fillStyle = ink['--surface'];
    c.fillRect(0, 0, W, H);
    // Water: surface and bottom.
    c.strokeStyle = ink['--line-strong'];
    c.lineWidth = 1 * dpr;
    c.beginPath();
    c.moveTo(b.plotL, b.top);
    c.lineTo(b.plotR, b.top);
    c.moveTo(b.plotL, b.bottom);
    c.lineTo(b.plotR, b.bottom);
    c.moveTo(b.sspL, b.top);
    c.lineTo(b.sspL, b.bottom);
    c.stroke();
    // c(z), gold, and the channel axis.
    const [lo, hi] = cRange();
    const cx = (v: number) => b.sspL + ((v - lo) / (hi - lo)) * (b.sspR - b.sspL);
    c.strokeStyle = ink['--gold'];
    c.lineWidth = 2.2 * dpr;
    c.beginPath();
    for (let i = 0; i <= 120; i++) {
      const z = (prof.zmax * i) / 120;
      const p = [cx(prof.c(z)), Y(z)];
      if (i) c.lineTo(p[0], p[1]);
      else c.moveTo(p[0], p[1]);
    }
    c.stroke();
    if (prof.axis) {
      c.setLineDash([5 * dpr, 5 * dpr]);
      c.strokeStyle = ink['--gold'];
      c.lineWidth = 1 * dpr;
      c.globalAlpha = 0.7;
      c.beginPath();
      c.moveTo(b.sspL, Y(prof.axis));
      c.lineTo(b.plotR, Y(prof.axis));
      c.stroke();
      c.setLineDash([]);
      c.globalAlpha = 1;
    }
    // The fan.
    const until = ping >= 0 ? ping : Infinity;
    c.strokeStyle = ink['--muted'];
    c.lineWidth = 1 * dpr;
    c.globalAlpha = 0.35;
    for (const r of rays) path(c, r, until);
    // The eigenrays, bold, by bounce color.
    c.globalAlpha = 0.95;
    c.lineWidth = 2.2 * dpr;
    for (const e of eig) {
      c.strokeStyle = bounceColor(e.surf, e.bot);
      path(c, e.ray, until);
    }
    c.globalAlpha = 1;
    // The pulse: a dot on every ray at the clock's time.
    if (ping >= 0) {
      c.fillStyle = ink['--text'];
      for (const r of rays) {
        const p = pulseAt(r, ping);
        if (p) c.fillRect(p[0] - 1.5 * dpr, p[1] - 1.5 * dpr, 3 * dpr, 3 * dpr);
      }
    }
    // Source and receiver.
    c.fillStyle = ink['--gold'];
    c.beginPath();
    c.arc(X(0), Y(zs()), 5 * dpr, 0, Math.PI * 2);
    c.fill();
    const rx = [X(rr()), Y(rz())];
    c.strokeStyle = ink['--text'];
    c.lineWidth = 2 * dpr;
    c.strokeRect(rx[0] - 6 * dpr, rx[1] - 6 * dpr, 12 * dpr, 12 * dpr);
    // Labels, with a halo in the plate's color where they cross the rays.
    c.font = font(11);
    c.lineJoin = 'round';
    c.lineWidth = 3.5 * dpr;
    c.strokeStyle = ink['--surface'];
    const text = (t: string, x: number, y: number, align: CanvasTextAlign, color: string) => {
      c.textAlign = align;
      c.strokeText(t, x, y);
      c.fillStyle = color;
      c.fillText(t, x, y);
    };
    const mu = ink['--muted'];
    text('0', b.sspL - 6 * dpr, b.top + 4 * dpr, 'right', mu);
    text(`${prof.zmax}`, b.sspL - 6 * dpr, b.bottom + 4 * dpr, 'right', mu);
    text('m', b.sspL - 6 * dpr, (b.top + b.bottom) / 2, 'right', mu);
    text(`${Math.round(lo)}`, b.sspL, b.bottom + 16 * dpr, 'left', mu);
    text(`${Math.round(hi)}`, b.sspR, b.bottom + 16 * dpr, 'right', mu);
    text('c(z), m/s', b.sspL, b.top - 8 * dpr, 'left', ink['--gold']);
    if (prof.axis) text(`axis ${prof.axis} m`, b.plotR - 4 * dpr, Y(prof.axis) - 6 * dpr, 'right', ink['--gold']);
    const kmMax = prof.rmax / 1000;
    const narrow = (b.plotR - b.plotL) / dpr < 260;
    const step = (kmMax > 50 ? 20 : kmMax > 20 ? 10 : 2) * (narrow ? 2.5 : 1);
    for (let k = 0; k <= kmMax + 1e-9; k += step) text(`${k}`, X(k * 1000), b.bottom + 16 * dpr, k === 0 ? 'left' : k + step > kmMax + 1e-9 ? 'right' : 'center', mu);
    text('range, km', b.plotR, b.top - 8 * dpr, 'right', mu);
  };

  const drawStem = () => {
    if (!SW) return;
    const c = sctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = ink['--surface'];
    c.fillRect(0, 0, SW, SH);
    const L = 46 * dpr;
    const R = SW - 12 * dpr;
    const base = SH - 24 * dpr;
    const top = 14 * dpr;
    c.strokeStyle = ink['--line-strong'];
    c.lineWidth = 1 * dpr;
    c.beginPath();
    c.moveTo(L, base);
    c.lineTo(R, base);
    c.stroke();
    c.font = font(11);
    c.fillStyle = ink['--muted'];
    c.textAlign = 'left';
    c.fillText('arrivals at the receiver', L, top - 2 * dpr);
    if (!eig.length) return;
    const t0 = eig[0].t;
    const t1 = eig[eig.length - 1].t;
    const span = Math.max(0.05, t1 - t0);
    const lo = t0 - span * 0.15;
    const hi = t1 + span * 0.15;
    const tx = (t: number) => L + ((t - lo) / (hi - lo)) * (R - L);
    for (const e of eig) {
      const x = tx(e.t);
      const arrived = ping < 0 || ping >= e.t;
      c.globalAlpha = arrived ? 1 : 0.18;
      c.strokeStyle = bounceColor(e.surf, e.bot);
      c.lineWidth = 2.5 * dpr;
      c.beginPath();
      c.moveTo(x, base);
      c.lineTo(x, top + 8 * dpr);
      c.stroke();
      c.fillStyle = c.strokeStyle;
      c.beginPath();
      c.arc(x, top + 8 * dpr, 3.5 * dpr, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
    c.fillStyle = ink['--muted'];
    c.textAlign = 'left';
    c.fillText(fmtS(t0), L, base + 16 * dpr);
    c.textAlign = 'right';
    c.fillText(fmtS(t1), R, base + 16 * dpr);
    c.textAlign = 'center';
    c.fillText('travel time', (L + R) / 2, base + 16 * dpr);
  };
  const drawAll = () => {
    drawMain();
    drawStem();
  };

  // ---- Controls ----
  const labels = () => {
    out('zs').textContent = fmtM(zs());
    out('fan').textContent = `±${fanIn.value}°`;
    out('rr').textContent = fmtM(rr());
    out('rz').textContent = fmtM(rz());
    zsIn.setAttribute('aria-valuetext', fmtM(zs()));
    fanIn.setAttribute('aria-valuetext', `plus or minus ${fanIn.value} degrees`);
    rrIn.setAttribute('aria-valuetext', fmtM(rr()));
    rzIn.setAttribute('aria-valuetext', fmtM(rz()));
  };
  const changed = (retrace: boolean) => {
    stopPing();
    labels();
    if (retrace) traceDrawn();
    eig = [];
    drawAll();
    scheduleEig();
  };
  env.addEventListener('change', () => {
    prof = PROFILES.find((p) => p.id === env.value) ?? PROFILES[0];
    // bellhopSim's default source depth for the profile, and a receiver partway out.
    zsIn.value = String(Math.round((prof.zs / prof.zmax) * 1000));
    rzIn.value = zsIn.value;
    rrIn.value = '650';
    changed(true);
  });
  zsIn.addEventListener('input', () => changed(true));
  fanIn.addEventListener('input', () => changed(true));
  rrIn.addEventListener('input', () => changed(false));
  rzIn.addEventListener('input', () => changed(false));

  // Drag the receiver on the plot.
  let dragging = false;
  const placeReceiver = (e: PointerEvent) => {
    const r = main.getBoundingClientRect();
    const b = box();
    const px = (e.clientX - r.left) * dpr;
    const py = (e.clientY - r.top) * dpr;
    const fr = Math.min(1, Math.max(0.01, (px - b.plotL) / (b.plotR - b.plotL)));
    const fz = Math.min(1, Math.max(0, (py - b.top) / (b.bottom - b.top)));
    rrIn.value = String(Math.round(fr * 1000));
    rzIn.value = String(Math.round(fz * 1000));
    changed(false);
  };
  main.addEventListener('pointerdown', (e) => {
    const r = main.getBoundingClientRect();
    if ((e.clientX - r.left) * dpr < box().plotL) return;
    dragging = true;
    main.setPointerCapture(e.pointerId);
    placeReceiver(e);
  });
  main.addEventListener('pointermove', (e) => dragging && placeReceiver(e));
  const up = () => (dragging = false);
  main.addEventListener('pointerup', up);
  main.addEventListener('pointercancel', up);

  // ---- Ping ----
  let raf = 0;
  let onScreen = false;
  let started = 0;
  let speed = 1;
  const stopPing = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    ping = -1;
    clock.textContent = '0.00';
  };
  const tick = (now: number) => {
    raf = 0;
    if (!onScreen || document.hidden) return;
    ping = Math.min(pingEnd, ((now - started) / 1000) * speed);
    clock.textContent = ping.toFixed(2);
    drawAll();
    if (ping < pingEnd) raf = requestAnimationFrame(tick);
    else root.dataset.pinged = '';
  };
  $<HTMLButtonElement>('[data-rt-ping]').addEventListener('click', () => {
    if (eigTimer) {
      clearTimeout(eigTimer);
      traceEig();
    }
    stopPing();
    delete root.dataset.pinged;
    // The pulse runs until the last ray reaches the edge of the plot (or the last arrival).
    pingEnd = Math.max(...rays.map((r) => r.t[r.t.length - 1]), eig.length ? eig[eig.length - 1].t : 0);
    if (prefersReducedMotion()) {
      ping = pingEnd;
      clock.textContent = ping.toFixed(2);
      drawAll();
      root.dataset.pinged = '';
      return;
    }
    // About 6 s of animation whatever the scale, and the clock shows the real seconds.
    speed = pingEnd / 6;
    started = performance.now();
    ping = 0;
    raf = requestAnimationFrame(tick);
  });

  // ---- Sizing, visibility, theme ----
  const size = () => {
    dpr = Math.min(2, devicePixelRatio || 1);
    const r = main.getBoundingClientRect();
    W = main.width = Math.round(r.width * dpr);
    H = main.height = Math.round(r.height * dpr);
    const s = stem.getBoundingClientRect();
    SW = stem.width = Math.round(s.width * dpr);
    SH = stem.height = Math.round(s.height * dpr);
    drawAll();
  };
  new ResizeObserver(size).observe(main);
  new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    if (onScreen && ping >= 0 && ping < pingEnd && !raf) {
      started = performance.now() - (ping / speed) * 1000;
      raf = requestAnimationFrame(tick);
    }
  }).observe(main);
  addEventListener('themechange', () => {
    readInk();
    drawAll();
  });

  // For tests: the eigenrays as found.
  (root as HTMLElement & { __rt?: unknown }).__rt = { eig: () => eig.map(({ ray: _r, ...e }) => e), profile: () => prof.id };

  readInk();
  labels();
  traceDrawn();
  size();
  traceEig();
  document.fonts?.ready.then(drawAll);
}
