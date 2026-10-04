// The hero's sonar scope: range rings, a rotating sweep with afterglow,
// contacts that light up as the beam passes, and pings that ripple out
// from wherever you point or tap. Plain 2D canvas, no libraries.
//
// It pauses when off-screen or in a background tab, draws one still frame
// under reduced motion, and skips animation on low-power devices.
import { prefersReducedMotion } from './preferences';

type Ping = { x: number; y: number; t0: number; strength: number };
type Contact = { r: number; a: number; size: number; lit: number };

const TAU = Math.PI * 2;
const SWEEP_PERIOD = 7000; // ms per revolution
const PING_LIFE = 2600; // ms

export function mountSonar(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  const host = canvas.parentElement ?? canvas;
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  const lowPower =
    (navigator.hardwareConcurrency ?? 8) <= 2 || nav.connection?.saveData === true || (nav.deviceMemory ?? 8) < 2;

  let w = 0;
  let h = 0;
  let dpr = 1;
  let cx = 0;
  let cy = 0;
  let radius = 0;
  let colors = readColors();
  // The rings, ticks and labels never move, so they're drawn once to an offscreen layer.
  const layer = document.createElement('canvas');
  const lctx = layer.getContext('2d')!;
  const FRAME_MIN = 1000 / 30; // 30 fps is plenty for a sweep and saves battery
  let running = false;
  let visible = true;
  let raf = 0;
  let last = performance.now();
  let angle = -Math.PI / 2.6;
  let nextAutoPing = 1200;
  const pings: Ping[] = [];

  // Deterministic contacts so the scope looks the same on every visit.
  const contacts: Contact[] = [];
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 9; i++) contacts.push({ r: 0.28 + rand() * 0.66, a: rand() * TAU, size: 1.2 + rand() * 1.6, lit: 0 });

  function readColors() {
    const s = getComputedStyle(document.documentElement);
    const v = (name: string) => s.getPropertyValue(name).trim();
    const dark = document.documentElement.dataset.theme === 'dark';
    return { accent: v('--accent') || '#3ddcff', amber: v('--amber') || '#ffb547', line: v('--line-strong'), dark };
  }

  function resize() {
    const rect = host.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = rect.width;
    h = rect.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    layer.width = canvas.width;
    layer.height = canvas.height;
    lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Scope sits to the right on wide screens and behind the top on phones.
    const wide = w >= 900;
    cx = wide ? w * 0.74 : w * 0.62;
    cy = wide ? h * 0.48 : h * 0.3;
    radius = wide ? Math.min(h * 0.52, w * 0.36) : Math.min(w * 0.72, h * 0.42);
    // The center glow is a CSS gradient on the host (cheap), positioned to match.
    host.style.setProperty('--scope-x', `${cx}px`);
    host.style.setProperty('--scope-y', `${cy}px`);
    host.style.setProperty('--scope-r', `${radius * 1.1}px`);
    paintLayer();
    if (!running) draw(performance.now(), 0);
  }

  function paintLayer() {
    lctx.clearRect(0, 0, w, h);
    drawScope(lctx);
  }

  function withAlpha(color: string, alpha: number) {
    return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;
  }

  // color-mix in canvas fillStyle is not supported everywhere, so convert hex once.
  function rgba(hex: string, alpha: number) {
    const m = hex.replace('#', '');
    if (m.length !== 6) return withAlpha(hex, alpha);
    const n = parseInt(m, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }

  function drawScope(c: CanvasRenderingContext2D) {
    const { accent, dark } = colors;
    const ringAlpha = dark ? 0.16 : 0.2;

    // Range rings.
    c.lineWidth = 1;
    for (let i = 1; i <= 5; i++) {
      c.strokeStyle = rgba(accent, ringAlpha * (i === 5 ? 1.6 : 1));
      c.beginPath();
      c.arc(cx, cy, (radius * i) / 5, 0, TAU);
      c.stroke();
    }

    // Crosshair and bearing ticks.
    c.strokeStyle = rgba(accent, ringAlpha * 0.8);
    c.beginPath();
    c.moveTo(cx - radius, cy);
    c.lineTo(cx + radius, cy);
    c.moveTo(cx, cy - radius);
    c.lineTo(cx, cy + radius);
    c.stroke();

    for (let deg = 0; deg < 360; deg += 5) {
      const a = (deg * Math.PI) / 180 - Math.PI / 2;
      const long = deg % 30 === 0;
      const r1 = radius * (long ? 1.0 : 1.0);
      const r2 = radius * (long ? 1.045 : 1.02);
      c.strokeStyle = rgba(accent, long ? ringAlpha * 2.2 : ringAlpha * 1.2);
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      c.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      c.stroke();
      if (long && w >= 640) {
        c.fillStyle = rgba(accent, dark ? 0.45 : 0.6);
        c.font = '500 10px "JetBrains Mono Variable", ui-monospace, monospace';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        const rl = radius * 1.1;
        c.fillText(String(deg).padStart(3, '0'), cx + Math.cos(a) * rl, cy + Math.sin(a) * rl);
      }
    }
  }

  function drawSweep() {
    const c = ctx!;
    const { accent, dark } = colors;
    const trail = 0.9; // radians of afterglow
    const peak = dark ? 0.2 : 0.16;
    if (typeof c.createConicGradient === 'function') {
      // One conic fill for the whole afterglow.
      const g = c.createConicGradient(angle - trail, cx, cy);
      g.addColorStop(0, rgba(accent, 0));
      g.addColorStop(trail / TAU, rgba(accent, peak));
      g.addColorStop(Math.min(1, trail / TAU + 0.0001), rgba(accent, 0));
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(cx, cy);
      c.arc(cx, cy, radius, angle - trail, angle);
      c.closePath();
      c.fill();
    } else {
      const steps = 18;
      for (let i = 0; i < steps; i++) {
        c.fillStyle = rgba(accent, (1 - i / steps) ** 2 * peak);
        c.beginPath();
        c.moveTo(cx, cy);
        c.arc(cx, cy, radius, angle - (trail * (i + 1)) / steps, angle - (trail * i) / steps);
        c.closePath();
        c.fill();
      }
    }
    c.strokeStyle = rgba(accent, dark ? 0.85 : 0.75);
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    c.stroke();
  }

  function drawContacts(dt: number) {
    const c = ctx!;
    const { accent, amber, dark } = colors;
    for (const k of contacts) {
      // Light a contact when the beam crosses its bearing.
      const diff = (((angle - k.a) % TAU) + TAU) % TAU;
      if (diff < 0.08) k.lit = 1;
      k.lit = Math.max(0, k.lit - dt / 3800);
      const x = cx + Math.cos(k.a) * k.r * radius;
      const y = cy + Math.sin(k.a) * k.r * radius;
      const base = dark ? 0.18 : 0.22;
      const alpha = base + k.lit * 0.8;
      const color = k.size > 2.4 ? amber : accent;
      c.fillStyle = rgba(color, alpha);
      c.beginPath();
      c.arc(x, y, k.size + k.lit * 1.5, 0, TAU);
      c.fill();
      if (k.lit > 0.05) {
        c.strokeStyle = rgba(color, k.lit * 0.5);
        c.lineWidth = 1;
        c.beginPath();
        c.arc(x, y, k.size + 5 + (1 - k.lit) * 10, 0, TAU);
        c.stroke();
      }
    }
  }

  function drawPings(now: number) {
    const c = ctx!;
    const { accent, dark } = colors;
    for (let i = pings.length - 1; i >= 0; i--) {
      const p = pings[i];
      const t = (now - p.t0) / PING_LIFE;
      if (t >= 1) {
        pings.splice(i, 1);
        continue;
      }
      for (let ring = 0; ring < 3; ring++) {
        const tr = t - ring * 0.12;
        if (tr <= 0) continue;
        const ease = 1 - (1 - tr) ** 3;
        const r = 6 + ease * 150 * p.strength;
        c.strokeStyle = rgba(accent, (1 - tr) * (dark ? 0.55 : 0.5) * p.strength);
        c.lineWidth = 1.25;
        c.beginPath();
        c.arc(p.x, p.y, r, 0, TAU);
        c.stroke();
      }
    }
  }

  function draw(now: number, dt: number) {
    ctx!.clearRect(0, 0, w, h);
    ctx!.drawImage(layer, 0, 0, w, h);
    drawSweep();
    drawContacts(dt);
    drawPings(now);
  }

  function frame(now: number) {
    if (now - last < FRAME_MIN) {
      raf = requestAnimationFrame(frame);
      return;
    }
    const dt = Math.min(64, now - last);
    last = now;
    angle = (angle + (TAU * dt) / SWEEP_PERIOD) % TAU;
    nextAutoPing -= dt;
    if (nextAutoPing <= 0) {
      pings.push({ x: cx, y: cy, t0: now, strength: 1.1 });
      nextAutoPing = 4200;
    }
    draw(now, dt);
    raf = requestAnimationFrame(frame);
  }

  let allowed = true;
  const animated = () => allowed && !prefersReducedMotion() && !lowPower;

  function start() {
    if (running || !visible || document.hidden || !animated()) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  function refresh() {
    stop();
    if (animated()) start();
    else {
      pings.length = 0;
      contacts.forEach((k, i) => (k.lit = i % 3 === 0 ? 0.7 : 0));
      draw(performance.now(), 0);
    }
  }

  // Pings follow the pointer (lightly) and fire on click or tap.
  let lastMovePing = 0;
  host.addEventListener('pointermove', (e) => {
    if (!running || e.pointerType === 'touch') return;
    const now = performance.now();
    if (now - lastMovePing < 380) return;
    lastMovePing = now;
    const r = canvas.getBoundingClientRect();
    pings.push({ x: e.clientX - r.left, y: e.clientY - r.top, t0: now, strength: 0.45 });
  });
  host.addEventListener('pointerdown', (e) => {
    if (!running) return;
    if ((e.target as HTMLElement).closest('a, button, input, label')) return;
    const r = canvas.getBoundingClientRect();
    pings.push({ x: e.clientX - r.left, y: e.clientY - r.top, t0: performance.now(), strength: 1 });
  });

  new ResizeObserver(resize).observe(host);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    visible ? start() : stop();
  }).observe(host);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  window.addEventListener('themechange', () => {
    colors = readColors();
    paintLayer();
    if (!running) draw(performance.now(), 0);
  });
  window.addEventListener('motionchange', refresh);

  // Paint a still frame right away, and start moving once the page is idle.
  resize();
  allowed = false;
  refresh();
  const go = () => {
    allowed = true;
    refresh();
  };
  setTimeout(go, 600);
  canvas.dataset.ready = '';
}
