// "Tune in": the Toolbox radio (src/components/Toolbox.astro).
//   - The dial: stations across a frequency scale, the rose needle, angled station names (none on
//     phones, where the locked name shows large in the card). Names are measured so none is clipped.
//   - Tuning: drag anywhere on the dial (or swipe it on a phone) and the needle follows; on release
//     it snaps to the nearest station. Arrow keys, Home and End, and Previous and Next step station
//     to station. The dial is a role="slider" whose value is the station's number and name.
//   - The scope: static between stations, cleaner as the needle nears one, a clean signal when
//     locked (a sine whose frequency rises with the project count for Know well, a two-tone FSK
//     pattern for Have built with). It animates only while on screen; with reduced motion it draws
//     a still wave and the needle jumps instead of sliding.
//   - Locking a station shows its card, writes the polite live line, and applies the project
//     filter on the page ([data-proj] plates that use it stay lit, the rest fade). Escape clears it.
// One rAF loop, only while the radio is on screen, motion is welcome, and something changes.
import { prefersReducedMotion } from './preferences';

type Station = { name: string; know: boolean; count: number; tool: number; line: string; hrefs: string[] };

const GREEN = '#7fd6a8';
const LILAC = '#c6b0ea';
const ROSE = '#eba8c4';
const INK = 'rgba(230,239,234,';

export function initToolbox() {
  const root = document.querySelector<HTMLElement>('[data-radio]');
  if (!root) return;
  const stations: Station[] = JSON.parse(root.querySelector('[data-stations]')!.textContent!);
  const N = stations.length;
  const dial = root.querySelector<HTMLElement>('[data-dial]')!;
  const dcv = root.querySelector<HTMLCanvasElement>('[data-dial-canvas]')!;
  const scv = root.querySelector<HTMLCanvasElement>('[data-scope]')!;
  const sig = root.querySelector<HTMLElement>('[data-tune-sig]')!;
  const uses = [...document.querySelectorAll<HTMLElement>('[data-use]')];
  const line = document.querySelector<HTMLElement>('[data-tb-line]')!;
  const plates = [...document.querySelectorAll<HTMLElement>('[data-proj]')];
  const dctx = dcv.getContext('2d')!;
  const sctx = scv.getContext('2d')!;

  // ---- Geometry: station positions along the dial, as fractions of its width. ----
  let W = 0;
  let H = 0;
  let dpr = 1;
  let phone = false;
  let left = 0.05;
  let right = 0.95;
  let fs = 1; // the root font scale: the dial's words grow with the page on big screens
  const posOf = (i: number) => left + ((right - left) * i) / (N - 1);
  const markerH = (s: Station) => (phone ? 18 : 30) + Math.min(s.count, 4) * (phone ? 9 : 16);
  const ANGLE = -0.62; // the names lean up and to the right
  const labelFont = () => `500 ${Math.round(13 * fs * dpr)}px "JetBrains Mono Variable", "JetBrains Fallback", monospace`;
  const size = () => {
    dpr = Math.min(2, devicePixelRatio || 1);
    fs = parseFloat(getComputedStyle(document.documentElement).fontSize) / 16 || 1;
    const r = dial.getBoundingClientRect();
    W = Math.round(r.width * dpr);
    H = Math.round(r.height * dpr);
    dcv.width = W;
    dcv.height = H;
    phone = r.width < 600;
    // Leave room on the right for the last name's slant, so no name is ever cut off.
    left = 0.05;
    right = 0.95;
    if (!phone) {
      dctx.font = labelFont();
      const slant = Math.max(...stations.map((s) => dctx.measureText(s.name).width)) * Math.cos(ANGLE);
      right = Math.min(0.95, 1 - (slant + 16 * dpr) / W);
    }
    const sr = scv.getBoundingClientRect();
    scv.width = Math.round(sr.width * dpr);
    scv.height = Math.round(sr.height * dpr);
  };

  // ---- State ----
  let needle = posOf(0);
  let target = needle;
  let locked = -1; // the station whose filter is on, -1 for none
  let shown = 0; // the station whose card shows
  let cur = 0; // the station the needle is on, or headed for
  const nearest = () => {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < N; i++) {
      const d = Math.abs(posOf(i) - needle);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return { i: best, lock: Math.max(0, 1 - bd / (((right - left) / (N - 1)) * 0.42)) };
  };

  // ---- Drawing ----
  const drawDial = () => {
    if (!W) return;
    const c = dctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, W, H);
    const base = H - 30 * dpr;
    // The frequency scale: ticks, and numbers every tenth tick.
    c.strokeStyle = `${INK}0.35)`;
    c.lineWidth = 1 * dpr;
    for (let k = 0; k <= 100; k++) {
      const x = W * (left + ((right - left) * k) / 100);
      const big = k % 10 === 0;
      c.beginPath();
      c.moveTo(x, base);
      c.lineTo(x, base - (big ? 16 : 7) * dpr);
      c.stroke();
    }
    c.fillStyle = `${INK}0.6)`;
    c.font = `500 ${Math.round(11 * fs * dpr)}px "JetBrains Mono Variable", "JetBrains Fallback", monospace`;
    c.textAlign = 'center';
    for (let k = 0; k <= 10; k += phone ? 2 : 1) c.fillText(String(88 + k * 2), W * (left + ((right - left) * k) / 10), H - 10 * dpr);
    // The stations: markers, and on wider screens their names, leaning.
    stations.forEach((s, i) => {
      const x = W * posOf(i);
      const h = markerH(s) * dpr;
      c.fillStyle = s.know ? GREEN : LILAC;
      c.globalAlpha = i === shown ? 1 : 0.8;
      c.fillRect(x - 3 * dpr, base - 20 * dpr - h, 6 * dpr, h);
      c.globalAlpha = 1;
      if (!phone) {
        c.save();
        c.translate(x + 4 * dpr, base - 26 * dpr - h);
        c.rotate(ANGLE);
        c.textAlign = 'left';
        c.font = labelFont();
        c.fillStyle = i === shown ? '#ffffff' : `${INK}0.82)`;
        c.fillText(s.name, 0, 0);
        c.restore();
      }
    });
    // The needle.
    const nx = W * needle;
    c.strokeStyle = ROSE;
    c.lineWidth = 3 * dpr;
    c.beginPath();
    c.moveTo(nx, 6 * dpr);
    c.lineTo(nx, base + 4 * dpr);
    c.stroke();
    c.fillStyle = ROSE;
    c.beginPath();
    c.arc(nx, base + 6 * dpr, 5 * dpr, 0, Math.PI * 2);
    c.fill();
  };

  let t0 = performance.now();
  const drawScope = (now: number) => {
    const SW = scv.width;
    const SH = scv.height;
    if (!SW) return;
    const c = sctx;
    const { i, lock } = nearest();
    const s = stations[i];
    const still = prefersReducedMotion();
    c.fillStyle = still ? '#0b221b' : 'rgba(11,34,27,0.55)';
    c.fillRect(0, 0, SW, SH);
    c.strokeStyle = 'rgba(127,214,168,0.12)';
    c.lineWidth = 1;
    for (let k = 1; k < 10; k++) {
      c.beginPath();
      c.moveTo((SW * k) / 10, 0);
      c.lineTo((SW * k) / 10, SH);
      c.stroke();
    }
    for (let k = 1; k < 4; k++) {
      c.beginPath();
      c.moveTo(0, (SH * k) / 4);
      c.lineTo(SW, (SH * k) / 4);
      c.stroke();
    }
    c.strokeStyle = lock > 0.6 ? (s.know ? GREEN : LILAC) : '#9db0a6';
    c.lineWidth = 2.5 * dpr;
    c.beginPath();
    const t = still ? 0 : (now - t0) / 1000;
    // Still frames use a fixed pseudo-noise so a reduced-motion scope never flickers.
    let seed = 7;
    const rnd = () => (still ? (((seed = (seed * 16807) % 2147483647) - 1) / 2147483646) * 2 - 1 : Math.random() * 2 - 1);
    for (let px = 0; px <= SW; px += 3) {
      const u = px / SW;
      const f = s.know ? 2 + s.count * 1.5 : Math.floor(u * 8) % 2 ? 9 : 5;
      const clean = Math.sin(u * Math.PI * 2 * f - t * 4);
      const y = SH / 2 + (clean * lock + rnd() * (1 - lock) * 0.9) * SH * 0.34;
      if (px) c.lineTo(px, y);
      else c.moveTo(px, y);
    }
    c.stroke();
    sig.textContent = lock > 0.6 ? `locked: ${s.name}, ${s.count} project${s.count === 1 ? '' : 's'}` : `searching… signal ${Math.round(lock * 100)}%`;
    // While dragging, the card follows whichever station the needle is locked on.
    if (drag && lock > 0.6 && shown !== i) show(i);
  };

  // ---- The card, the slider value, the filter ----
  const show = (i: number) => {
    shown = i;
    const s = stations[i];
    uses.forEach((u) => (u.hidden = Number(u.dataset.use) !== s.tool));
    dial.setAttribute('aria-valuenow', String(i + 1));
    dial.setAttribute('aria-valuetext', `${s.name}, ${s.know ? 'Know well' : 'Have built with'}`);
    drawDial();
  };
  const lockOn = (i: number) => {
    locked = i;
    const s = stations[i];
    const hrefs = new Set(s.hrefs);
    plates.forEach((p) => p.toggleAttribute('data-dim', !(p.dataset.proj || '').split(' ').some((h) => hrefs.has(h))));
    line.textContent = s.line;
    show(i);
  };
  const clear = () => {
    locked = -1;
    plates.forEach((p) => p.removeAttribute('data-dim'));
    line.textContent = '';
  };

  // ---- The loop: runs while the needle slides or, on screen and with motion, for the static. ----
  let raf = 0;
  let onScreen = false;
  const frame = (now: number) => {
    raf = 0;
    const moving = Math.abs(target - needle) > 0.0005;
    if (moving) needle += (target - needle) * 0.25;
    else needle = target;
    drawDial();
    drawScope(now);
    if (moving || (onScreen && !document.hidden && !prefersReducedMotion())) raf = requestAnimationFrame(frame);
  };
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  /** Move to station i (snapped), lock it and apply the filter. */
  const tuneTo = (i: number) => {
    const k = Math.max(0, Math.min(N - 1, i));
    cur = k;
    target = posOf(k);
    if (prefersReducedMotion()) needle = target;
    lockOn(k);
    kick();
  };

  // ---- Dragging (mouse) and swiping (touch) ----
  let drag: { id: number; touch: boolean; x0: number; y0: number; decided: boolean } | null = null;
  const toFrac = (clientX: number) => {
    const r = dial.getBoundingClientRect();
    return Math.min(right, Math.max(left, (clientX - r.left) / r.width));
  };
  dial.addEventListener('pointerdown', (e) => {
    const touch = e.pointerType !== 'mouse';
    drag = { id: e.pointerId, touch, x0: e.clientX, y0: e.clientY, decided: !touch };
    if (!touch) {
      dial.setPointerCapture(e.pointerId);
      target = needle = toFrac(e.clientX);
      kick();
    }
  });
  dial.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.decided) {
      // A touch decides once it moves: sideways tunes, up or down scrolls the page.
      const dx = e.clientX - drag.x0;
      const dy = e.clientY - drag.y0;
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        drag = null;
        return;
      }
      drag.decided = true;
    }
    target = needle = toFrac(e.clientX);
    kick();
  });
  const release = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const wasDecided = drag.decided;
    const touchTap = drag.touch && !wasDecided;
    drag = null;
    if (touchTap) {
      // A tap on the dial tunes to the station nearest the tap.
      needle = toFrac(e.clientX);
    } else if (!wasDecided) return;
    tuneTo(nearest().i);
  };
  dial.addEventListener('pointerup', release);
  dial.addEventListener('pointercancel', (e) => {
    if (drag && e.pointerId === drag.id && drag.decided) tuneTo(nearest().i);
    drag = null;
  });

  // ---- Keys and buttons ----
  dial.addEventListener('keydown', (e) => {
    const to = { ArrowRight: cur + 1, ArrowUp: cur + 1, ArrowLeft: cur - 1, ArrowDown: cur - 1, Home: 0, End: N - 1, PageUp: cur + 3, PageDown: cur - 3 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    tuneTo(to);
  });
  root.querySelector('[data-dial-prev]')!.addEventListener('click', () => tuneTo(cur - 1));
  root.querySelector('[data-dial-next]')!.addEventListener('click', () => tuneTo(cur + 1));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && locked >= 0) clear();
  });

  // ---- Start ----
  new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    if (onScreen) kick();
  }).observe(root);
  document.addEventListener('visibilitychange', kick);
  new ResizeObserver(() => {
    size();
    target = needle = posOf(cur);
    drawDial();
    drawScope(performance.now());
  }).observe(dial);
  addEventListener('motionchange', kick);
  size();
  drawDial();
  drawScope(performance.now());
  document.fonts?.ready.then(() => {
    size();
    drawDial();
  });
}
