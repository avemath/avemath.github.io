// The bit girl: a small figure drawn in glowing 0 and 1 glyphs, no face, a ponytail, a projector
// ring under her feet. She lives on one fixed canvas over the page (pointer-events none,
// aria-hidden, under the sticky header) and stands on perches the page declares:
//
//   data-perch="ledge"        on an element: she stands on its top edge (data-perch-edge="bottom":
//                             on its bottom edge, inside it)
//   data-perch-x="0.2 0.85"   where along the edge, as fractions of its width; several numbers make
//                             several perches on the same ledge
//   data-perch-min="760"      only from this viewport width up (phones get perches with room)
//   data-perch-start          where she starts
//   data-perch-inside         she may stand over the element's own picture (the seafloor scene)
//   data-girl-ignore          a background picture she may stand in front of
//
// She turns to face the cursor. Left alone for about 3 s with the cursor on the page, she waves.
// The first time the cursor comes close on a perch she may run once to another perch on the same
// ledge; the next time she scatters into bits that fly to a perch off screen, never straight back
// to the one she just left. With reduced motion she fades out and reappears instead, and holds
// still. One rAF loop, which stops when she is off screen and not moving; each frame reads the
// layout of the current and target perches only. scripts/check-layout.mjs checks that no perch
// puts her over text and that the canvas never takes a click.
import { token } from '../lib/tokens-client';
import { prefersReducedMotion } from './preferences';

type Part = 'head' | 'hair' | 'torso' | 'skirt' | 'armL' | 'armR' | 'legL' | 'legR';
type Sample = { part: Part; t: number; o: number; a: number; g: string; f: number };
type Pose = { armL: number; armR: number; foreL: number; foreR: number; legL: number; legR: number; kneeL: number; kneeR: number; bob: number; lean: number };
type Perch = { el: HTMLElement; x: number; bottom: boolean; ledge: string; min: number; start: boolean; inside: boolean };
type State = 'idle' | 'wave' | 'peek' | 'run' | 'warp' | 'fade';

/** Her body in figure units around her feet (multiply by the scale): the box every perch must keep clear of text. */
export const BODY = { left: -40, right: 40, top: -126, bottom: 6 };
// 0.6 on phones, 0.78 on laptops, then a little bigger on big screens: about 1.2 times at 2560.
export const scaleFor = (vw: number) => (vw < 600 ? 0.6 : 0.78 * (1 + 0.2 * Math.min(1, Math.max(0, (vw - 1440) / 1120))));

const REST: Pose = { armL: 0.25, armR: -0.25, foreL: 0.1, foreR: -0.1, legL: 0.06, legR: -0.06, kneeL: 0, kneeR: 0, bob: 0, lean: 0 };

function samplesFor() {
  let seed = 3;
  const r = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const out: Sample[] = [];
  const add = (part: Part, n: number, thick: number) => {
    for (let i = 0; i < n; i++) out.push({ part, t: r(), o: (r() - 0.5) * thick, a: r() * Math.PI * 2, g: r() < 0.5 ? '0' : '1', f: r() });
  };
  add('head', 46, 1);
  add('hair', 26, 1);
  add('torso', 70, 1);
  add('skirt', 60, 1);
  add('armL', 22, 5);
  add('armR', 22, 5);
  add('legL', 26, 6);
  add('legR', 26, 6);
  return out;
}

const seg = (p: number[], a: number, l: number) => [p[0] + Math.sin(a) * l, p[1] + Math.cos(a) * l];

/** One sample's place in figure units, feet at (0, 0). */
function local(s: Sample, P: Pose, ms: number): number[] {
  const hip = [0, -46 + P.bob];
  const neck = [P.lean * 30, -88 + P.bob];
  switch (s.part) {
    case 'head': {
      const r = 11 * Math.sqrt(s.t);
      return [neck[0] + Math.cos(s.a) * r, neck[1] - 13 + Math.sin(s.a) * r];
    }
    case 'hair': {
      const v = s.t;
      return [neck[0] - 8 - v * 14, neck[1] - 18 + v * 16 + Math.sin(v * 3 + ms / 300) * 2 * v + s.o * 3];
    }
    case 'torso': {
      const v = s.t;
      const w = 9 + v * 2;
      return [neck[0] * (1 - v) + hip[0] * v + s.o * w * 2, neck[1] + 2 + (hip[1] - neck[1] - 2) * v];
    }
    case 'skirt': {
      const v = s.t;
      return [hip[0] + s.o * (10 + v * 9) * 2, hip[1] + v * 14];
    }
    case 'armL':
    case 'armR': {
      const L = s.part === 'armL';
      const sh = [neck[0] + (L ? -9 : 9), neck[1] + 5];
      const el = seg(sh, L ? P.armL : P.armR, 15);
      const hd = seg(el, L ? P.foreL : P.foreR, 14);
      const v = s.t;
      return v < 0.5 ? [sh[0] + (el[0] - sh[0]) * v * 2 + s.o * 0.3, sh[1] + (el[1] - sh[1]) * v * 2] : [el[0] + (hd[0] - el[0]) * (v - 0.5) * 2 + s.o * 0.3, el[1] + (hd[1] - el[1]) * (v - 0.5) * 2];
    }
    default: {
      const L = s.part === 'legL';
      const hp = [hip[0] + (L ? -4 : 4), hip[1] + 10];
      const a = L ? P.legL : P.legR;
      const k = L ? P.kneeL : P.kneeR;
      const kn = seg(hp, a, 18);
      const ft = seg(kn, a - k, 18);
      const v = s.t;
      return v < 0.5 ? [hp[0] + (kn[0] - hp[0]) * v * 2 + s.o * 0.3, hp[1] + (kn[1] - hp[1]) * v * 2] : [kn[0] + (ft[0] - kn[0]) * (v - 0.5) * 2 + s.o * 0.3, kn[1] + (ft[1] - kn[1]) * (v - 0.5) * 2];
    }
  }
}

/** Every perch on the page, read from the markup. */
export function readPerches(): Perch[] {
  return [...document.querySelectorAll<HTMLElement>('[data-perch]')].flatMap((el) =>
    (el.dataset.perchX || '0.5')
      .trim()
      .split(/\s+/)
      .map((x) => ({
        el,
        x: Number(x),
        bottom: el.dataset.perchEdge === 'bottom',
        ledge: el.dataset.perch || '',
        min: Number(el.dataset.perchMin || 0),
        start: el.hasAttribute('data-perch-start'),
        inside: el.hasAttribute('data-perch-inside'),
      })),
  );
}

type Obstacle = { box: number[]; el: Element; text: boolean };

/** What she must not cover, as boxes in page coordinates: every line of text, every image, and
 *  anything marked data-girl-avoid (a card, say). Read only when she picks a perch. */
function obstacles() {
  const out: Obstacle[] = [];
  const add = (q: DOMRect, el: Element, text: boolean) => {
    if (q.width > 1 && q.height > 1) out.push({ box: [q.left + scrollX, q.top + scrollY, q.right + scrollX, q.bottom + scrollY], el, text });
  };
  for (const el of document.querySelectorAll('img, video, iframe, [data-girl-avoid]')) if (!el.closest('[hidden], [data-girl-ignore]')) add(el.getBoundingClientRect(), el, false);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  while (walker.nextNode()) {
    const n = walker.currentNode;
    if (!n.textContent?.trim()) continue;
    const el = n.parentElement;
    if (!el || el.closest('script, style, noscript, canvas, [hidden], .sr-only')) continue;
    if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    range.selectNodeContents(n);
    for (const q of range.getClientRects()) add(q, el, true);
  }
  return out;
}

/** Her body's box on a perch, in page coordinates. Standing on a top edge, the box stops at her
 *  feet: only the projector ring's glow dips into what she stands on. */
export function bodyBox(p: Perch, s = scaleFor(innerWidth)) {
  const [px, py] = perchPoint(p);
  return [px + BODY.left * s, py + BODY.top * s, px + BODY.right * s, p.bottom ? py + BODY.bottom * s : py - 1];
}

/** The perches she may use at this width: wide enough, inside the page, clear of all text, and
 *  clear of images and cards (a perch marked data-perch-inside, the seafloor, may stand on its own picture). */
/** The bottom edge of the sticky header, in viewport pixels: she is never drawn above it. */
export function headerBottom() {
  const h = document.querySelector('[data-header]');
  return h ? Math.max(0, h.getBoundingClientRect().bottom) : 0;
}

/** Room around her body box for what is drawn outside it, in pixels: a little at the top, more
 *  below her feet for the projector ring and its glow (measured: up to 21px at 2560; nothing at the
 *  sides). */
const PAD = 4;
const PAD_FEET = 24;

export function usablePerches(perches: Perch[]) {
  const obs = obstacles();
  const pageW = document.documentElement.clientWidth;
  const hb = headerBottom();
  const maxScroll = Math.max(0, document.documentElement.scrollHeight - innerHeight);
  return perches
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => {
      if (innerWidth < p.min) return false;
      const b = bodyBox(p);
      if (b[0] < 0 || b[2] > pageW) return false;
      // Some scroll position must show all of her below the header and above the bottom edge;
      // a perch that never can (too near the top of the page, say) is not used.
      const lo = Math.max(0, b[3] + PAD_FEET - innerHeight);
      const hi = Math.min(maxScroll, b[1] - PAD - hb);
      if (lo > hi) return false;
      return !obs.some((o) => (o.text || !p.inside || !p.el.contains(o.el)) && o.box[0] < b[2] && o.box[2] > b[0] && o.box[1] < b[3] && o.box[3] > b[1]);
    })
    .map(({ i }) => i);
}

/** A perch's feet point, in page coordinates. */
export function perchPoint(p: Perch) {
  const r = p.el.getBoundingClientRect();
  return [r.left + scrollX + r.width * p.x, (p.bottom ? r.bottom - 2 : r.top) + scrollY];
}

export function mountBitGirl(cv: HTMLCanvasElement) {
  const ctx = cv.getContext('2d')!;
  const perches = readPerches();
  if (!perches.length) return;
  const samples = samplesFor();

  let W = 0;
  let H = 0;
  let dpr = 1;
  let S = 0.78;
  let ink = '#1e8a5a';
  let glow = false;
  const readInk = () => {
    ink = token('--bit');
    glow = token('--bit-glow') === '1';
  };

  // Which perches are usable is worked out only when she picks one (and on resize), never per frame.
  const enabled = () => usablePerches(perches);
  const startAt = () => {
    const ok = enabled();
    return ok.find((i) => perches[i].start) ?? ok[0] ?? -1;
  };

  let cur = 0;
  let prev = -1;
  let dest = cur;
  let ranHere = false; // she already ran once from this ledge
  let state: State = 'idle';
  let stateT = 0;
  let x = 0;
  let y = 0;
  let face = -1;
  let alpha = 1;
  let hidden = false; // no usable perch at this width
  let mx = -1e4;
  let my = -1e4;
  let lastNear = performance.now();
  let lastWave = 0;
  let runTo = 0;
  let runPhase = 0;
  let warp: { t0: number; pts: { a: number[]; b: number[]; d: number }[] } | null = null;
  let trail: { x: number; y: number; g: string; life: number }[] = [];
  const reduce = () => prefersReducedMotion();
  const set = (s: State, now: number) => {
    state = s;
    stateT = now;
  };

  const place = (i: number) => {
    const p = perchPoint(perches[i]);
    x = p[0];
    y = p[1];
  };
  const onScreen = (px: number, py: number) => {
    const vx = px - scrollX;
    const vy = py - scrollY;
    return vx > 30 && vx < W - 30 && vy > 130 * S && vy < H - 10;
  };

  const pose = (ms: number): Pose => {
    const t = ms / 1000;
    const still = reduce();
    const P = { ...REST, bob: still ? 0 : Math.sin(t * 2) * 1.2 };
    if (state === 'run') {
      const ph = runPhase;
      P.legL = Math.sin(ph) * 0.75;
      P.legR = -P.legL;
      P.kneeL = Math.max(0, -Math.sin(ph)) * 0.9;
      P.kneeR = Math.max(0, Math.sin(ph)) * 0.9;
      P.armL = -Math.sin(ph) * 0.8;
      P.armR = -P.armL;
      P.foreL = P.foreR = -0.6;
      P.bob = Math.abs(Math.sin(ph)) * -4;
      P.lean = 0.18;
    }
    if (state === 'wave') {
      P.armR = -2.6;
      P.foreR = -2.6 + (still ? 0 : Math.sin(t * 9) * 0.5);
    }
    if (state === 'peek') {
      P.armL = 0.6;
      P.armR = -0.6;
      P.foreL = 1.6;
      P.foreR = -1.6;
      P.lean = -0.08;
    }
    // The idle sway.
    if (state === 'idle' && !still) P.lean = Math.sin(t * 0.9) * 0.05;
    return P;
  };
  const world = (s: Sample, P: Pose, ms: number, px: number, py: number, f: number) => {
    const l = local(s, P, ms);
    return [px + l[0] * S * f, py + l[1] * S];
  };

  /** Somewhere to hide: off screen if possible, never where she is or where she just was. */
  const pickHide = () => {
    const ok = enabled().filter((i) => i !== cur);
    const fresh = ok.filter((i) => i !== prev);
    const pool = fresh.length ? fresh : ok;
    const off = pool.filter((i) => {
      const p = perchPoint(perches[i]);
      return !onScreen(p[0], p[1]);
    });
    const from = off.length ? off : pool;
    return from.length ? from[Math.floor(Math.random() * from.length)] : -1;
  };
  /** Another perch on the same ledge, on screen, not the one she just left. */
  const pickRun = () => {
    const ok = enabled().filter((i) => i !== cur && i !== prev && perches[i].ledge === perches[cur].ledge && perches[i].el === perches[cur].el);
    return ok.length ? ok[Math.floor(Math.random() * ok.length)] : -1;
  };

  const scatter = (now: number) => {
    const i = pickHide();
    if (i < 0) return;
    const from = [x, y];
    const to = perchPoint(perches[i]);
    prev = cur;
    dest = i;
    ranHere = false;
    if (reduce()) {
      set('fade', now);
      return;
    }
    const P = pose(now);
    const f2 = Math.random() < 0.5 ? 1 : -1;
    warp = { t0: now, pts: samples.map((s) => ({ a: world(s, P, now, from[0], from[1], face), b: world(s, REST, now, to[0], to[1], f2), d: s.f * 0.35 })) };
    face = f2;
    set('warp', now);
  };
  const run = (now: number) => {
    const i = pickRun();
    if (i < 0) return scatter(now);
    prev = cur;
    dest = i;
    ranHere = true;
    if (reduce()) {
      set('fade', now);
      return;
    }
    runTo = perchPoint(perches[i])[0];
    face = runTo > x ? 1 : -1;
    set('run', now);
  };

  const WARP_MS = 1400;
  const FADE_MS = 500;
  const update = (now: number, dt: number) => {
    if (state !== 'warp' && state !== 'run' && state !== 'fade') place(cur);
    // Her middle, on screen.
    const vx = x - scrollX;
    const vy = y - scrollY - 55 * S;
    const near = Math.hypot(mx - vx, my - vy) < 140 * S;
    if (near) lastNear = now;
    if (near && !hidden && (state === 'idle' || state === 'wave' || state === 'peek')) {
      if (!ranHere && Math.random() < 0.7) run(now);
      else scatter(now);
    }
    if (state === 'run') {
      const sp = 340 * S * dt;
      runPhase += dt * 14;
      const d = runTo - x;
      if (Math.abs(d) <= sp) {
        cur = dest;
        place(cur);
        set('peek', now);
      } else x += Math.sign(d) * sp;
      if (Math.random() < 0.6) trail.push({ x: x - face * 8, y: y - 20 - Math.random() * 60 * S, g: Math.random() < 0.5 ? '0' : '1', life: 1 });
    }
    if (state === 'warp' && now - stateT > WARP_MS) {
      cur = dest;
      place(cur);
      warp = null;
      set('peek', now);
    }
    if (state === 'fade') {
      const u = (now - stateT) / FADE_MS;
      if (u >= 1 && cur !== dest) {
        cur = dest;
        place(cur);
      }
      alpha = u < 1 ? 1 - u : Math.min(1, u - 1);
      if (u >= 2) {
        alpha = 1;
        set('idle', now);
      }
    }
    if (state === 'peek' && now - stateT > 900) set('idle', now);
    const cursorHere = mx > -1e3;
    if ((state === 'idle' || state === 'wave') && cursorHere) face = mx > vx ? 1 : -1;
    if (state === 'idle' && cursorHere && !near && !reduce() && now - lastNear > 3000 && now - lastWave > 6000) {
      lastWave = now;
      set('wave', now);
    }
    if (state === 'wave' && now - stateT > 1800) set('idle', now);
    trail.forEach((p) => {
      p.life -= dt * 1.4;
      p.y += dt * 30;
    });
    trail = trail.filter((p) => p.life > 0);
  };

  const moving = () => state === 'run' || state === 'warp' || state === 'fade' || trail.length > 0;
  const visible = () => {
    const vy = y - scrollY;
    return vy > -40 && vy < H + 160 && x - scrollX > -60 && x - scrollX < W + 60;
  };

  // Her whole figure, as drawn (every glyph, the ponytail, the projector ring and the glow), in
  // page coordinates.
  let headB = headerBottom();
  const figureBox = (P: Pose, now: number) => {
    let l = Infinity;
    let t = Infinity;
    let r = -Infinity;
    let b = -Infinity;
    for (const s of samples) {
      const q = world(s, P, now, x, y, face);
      if (q[0] < l) l = q[0];
      if (q[0] > r) r = q[0];
      if (q[1] < t) t = q[1];
      if (q[1] > b) b = q[1];
    }
    l = Math.min(l, x - 22 * S - 1);
    r = Math.max(r, x + 22 * S + 1);
    b = Math.max(b, y + 3 + 5 * S + 1);
    const g = Math.max(6, Math.round(8 * S * 1.15)) * 0.6 + (glow ? 6 : 0);
    return [l - g, t - g, r + g, b + g];
  };
  /** How much of her to show where she stands now: 1 with room to spare, fading to 0 as any part
   *  of her nears the header's bottom edge or an edge of the window, and 0 before anything could
   *  cross one. So she is never cut off: she waits, out of sight, until her perch is in view. */
  const FIT_PX = 24;
  let lastBox: number[] | null = null;
  const fit = (P: Pose, now: number) => {
    const bx = figureBox(P, now);
    const room = Math.min(bx[1] - scrollY - headB, H - (bx[3] - scrollY), bx[0] - scrollX, W - (bx[2] - scrollX));
    lastBox = bx;
    if (room <= 0) return 0;
    return reduce() ? 1 : Math.min(1, room / FIT_PX);
  };

  let drewEmpty = false;
  const draw = (now: number) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const sx = scrollX;
    const sy = scrollY;
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.max(6, Math.round(8 * S * 1.15))}px "JetBrains Mono Variable", "JetBrains Fallback", monospace`;
    if (glow) {
      ctx.shadowColor = ink;
      ctx.shadowBlur = 6;
    }
    if (state === 'warp' && warp) {
      const T = now - warp.t0;
      warp.pts.forEach((p, k) => {
        const u = Math.max(0, Math.min(1, (T / WARP_MS - p.d) / 0.62));
        const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
        const mxp = (p.a[0] + p.b[0]) / 2;
        const myp = Math.min(p.a[1], p.b[1]) - Math.min(260, Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]) * 0.3) + Math.sin(samples[k].a) * 40;
        const qx = (1 - e) * (1 - e) * p.a[0] + 2 * (1 - e) * e * mxp + e * e * p.b[0];
        const qy = (1 - e) * (1 - e) * p.a[1] + 2 * (1 - e) * e * myp + e * e * p.b[1];
        ctx.globalAlpha = 0.35 + 0.6 * Math.abs(Math.sin(u * Math.PI * 0.5 + 0.6));
        ctx.fillText(samples[k].g, qx - sx, qy - sy);
      });
    } else if (!hidden && visible() && fit(pose(now), now) > 0) {
      const P = pose(now);
      const still = reduce();
      const shown = alpha * fit(P, now);
      // The projector ring under her feet.
      ctx.globalAlpha = 0.5 * shown;
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * Math.PI * 2 + (still ? 0 : now / 900);
        ctx.fillRect(x - sx + Math.cos(a) * 22 * S - 1, y - sy + 3 + Math.sin(a) * 5 * S - 1, 2, 2);
      }
      for (const s of samples) {
        const p = world(s, P, now, x, y, face);
        ctx.globalAlpha = shown * (!still && Math.sin(now / 180 + s.f * 40) > 0.92 ? 0.35 : 0.92);
        if (!still && Math.sin(now / 700 + s.f * 90) > 0.995) s.g = s.g === '0' ? '1' : '0';
        ctx.fillText(s.g, p[0] - sx, p[1] - sy);
      }
    }
    for (const p of trail) {
      ctx.globalAlpha = p.life * 0.7;
      ctx.fillText(p.g, p.x - sx, p.y - sy);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  };

  // The loop runs while she is on screen (she breathes and flickers, about 30 frames a second) or
  // moving, and stops otherwise; scrolling, the pointer and resizing wake it.
  let raf = 0;
  let last = performance.now();
  let engaged = false;
  const frame = (now: number) => {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    const busy = moving();
    if (busy || now - last >= 32) {
      last = now;
      update(now, dt);
      if (visible() || moving()) {
        draw(now);
        drewEmpty = false;
      } else if (!drewEmpty) {
        ctx.clearRect(0, 0, cv.width, cv.height);
        drewEmpty = true;
      }
    }
    // With reduced motion she holds still, so the loop runs only while she fades or a pose ends.
    const keepGoing = engaged && !document.hidden && (moving() || (visible() && !reduce()) || state === 'peek');
    if (keepGoing) raf = requestAnimationFrame(frame);
  };
  const wake = () => {
    if (!raf) {
      last = performance.now() - 40;
      raf = requestAnimationFrame(frame);
    }
  };

  const size = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth;
    H = innerHeight;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    S = scaleFor(W);
    headB = headerBottom();
    if (!enabled().includes(cur) && state !== 'warp' && state !== 'run') {
      const i = startAt();
      hidden = i < 0;
      if (i >= 0) cur = i;
      state = 'idle';
    }
    if (state === 'idle') place(cur);
    draw(performance.now());
  };

  addEventListener('pointermove', (e) => {
    mx = e.clientX;
    my = e.clientY;
    wake();
  }, { passive: true });
  addEventListener('pointerdown', (e) => {
    mx = e.clientX;
    my = e.clientY;
    if (e.pointerType !== 'mouse') setTimeout(() => ((mx = -1e4), (my = -1e4)), 700);
    wake();
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => {
    mx = -1e4;
    my = -1e4;
  });
  addEventListener('scroll', wake, { passive: true });
  addEventListener('resize', () => {
    size();
    wake();
  });
  document.addEventListener('visibilitychange', wake);
  addEventListener('themechange', () => {
    readInk();
    draw(performance.now());
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    readInk();
    draw(performance.now());
  });
  addEventListener('motionchange', () => {
    draw(performance.now());
    wake();
  });

  // First frame once the page is idle; the loop starts when the visitor moves, scrolls or types.
  let ready = false;
  const start = () => {
    ready = true;
    readInk();
    const i = startAt();
    hidden = i < 0;
    if (i >= 0) cur = i;
    place(cur);
    size();
    // If no perch was usable yet (the page still settling), look again once it has.
    const recheck = () => {
      if (!hidden) return;
      const j = startAt();
      hidden = j < 0;
      if (j >= 0) {
        cur = j;
        place(cur);
      }
    };
    document.fonts?.ready.then(() => {
      recheck();
      draw(performance.now());
    });
    if (document.readyState !== 'complete') addEventListener('load', recheck, { once: true });
    const engage = () => {
      engaged = true;
      recheck();
      wake();
    };
    for (const ev of ['pointermove', 'pointerdown', 'scroll', 'keydown']) addEventListener(ev, engage, { once: true, passive: true });
  };
  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 1500 });
  else setTimeout(start, 300);

  // For the layout test: where she is and where every perch would put her body.
  (window as unknown as { __bitGirl: unknown }).__bitGirl = {
    get cur() {
      return cur;
    },
    get state() {
      return state;
    },
    /** True once she is set up (sized and placed), a moment after she mounts. */
    get ready() {
      return ready;
    },
    /** Every perch, whether she may use it, and her body's box there (page coordinates). */
    boxes: () => {
      const ok = usablePerches(perches);
      return perches.map((p, i) => {
        const b = bodyBox(p);
        return { i, ledge: p.ledge, usable: ok.includes(i), box: { left: b[0], top: b[1], right: b[2], bottom: b[3] } };
      });
    },
    go: (i: number) => {
      prev = cur;
      cur = i;
      hidden = false;
      state = 'idle';
      alpha = 1;
      place(cur);
      draw(performance.now());
    },
    /** One perch's body box (page coordinates), without checking what it covers. */
    box: (i: number) => {
      const b = bodyBox(perches[i]);
      return { left: b[0], top: b[1], right: b[2], bottom: b[3] };
    },
    /** Draw one frame where the page is scrolled now (for the fit test, which reads the pixels). */
    render: () => draw(performance.now()),
    headerBottom: () => headB,
    figure: () => lastBox,
  };
}
