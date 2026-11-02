// The hero's signal panel: the FH-BFSK preamble from src/lib/preamble.ts drawn as tone bars
// across time, read with two scope cursors. Nothing moves on its own: with a mouse the cursors
// follow the pointer, snapping to chip and tone boundaries, and the tones near them brighten; by
// keyboard the arrow keys step the same cursors. Touch screens get one slow drift in, then rest.
// "Hear it" plays the same chips through Web Audio, only when pressed.
import { CHIPS, CHIP_MS, DURATION_MS, LISTEN_STRETCH, preamble, synthesize, tones } from '../lib/preamble';
import { prefersReducedMotion } from './preferences';

const F_MIN = 8000;
const F_MAX = 14000;
const GRID_HZ = [8000, 10000, 12000, 14000];
const ACCENT = '#de6a41';

const fmtHz = (hz: number) => `${Math.round(hz).toLocaleString('en-US').replace(/,/g, ' ')} Hz`;
const fmtMs = (ms: number) => `${ms.toFixed(2)} ms`;

export function mountSignalPanel(fig: HTMLElement) {
  const screen = fig.querySelector<HTMLElement>('[data-sig-screen]')!;
  const canvas = screen.querySelector('canvas')!;
  const scope = fig.querySelector<HTMLElement>('[data-sig-scope]')!;
  const ctx = canvas.getContext('2d')!;
  const vCur = fig.querySelector<HTMLElement>('[data-sig-v]')!;
  const hCur = fig.querySelector<HTMLElement>('[data-sig-h]')!;
  const read = fig.querySelector<HTMLElement>('[data-sig-read]')!;
  const live = fig.querySelector<HTMLElement>('[data-sig-live]')!;
  const play = fig.querySelector<HTMLButtonElement>('[data-sig-play]')!;
  const playLabel = fig.querySelector<HTMLElement>('[data-sig-play-label]')!;
  const chips = preamble();

  let W = 0;
  let H = 0;
  // The plot sits between the caption at the top and the hint and button at the bottom.
  const box = () => {
    const pad = Math.max(12, W * 0.03);
    return { x0: pad, x1: W - pad, y0: 40, y1: H - 62 };
  };
  const xOf = (ms: number) => {
    const b = box();
    return b.x0 + (ms / DURATION_MS) * (b.x1 - b.x0);
  };
  const yOf = (hz: number) => {
    const b = box();
    return b.y1 - ((hz - F_MIN) / (F_MAX - F_MIN)) * (b.y1 - b.y0);
  };

  // Cursor state: which chip and which tone, or none.
  let cur: { chip: number; tone: number } | null = null;
  let playing = -1;
  let drift = 0;

  function draw() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const b = box();

    // Grid: 2 kHz per division up the side, 50 ms (8 chips) across.
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(244,246,250,0.14)';
    ctx.beginPath();
    for (const f of GRID_HZ) {
      const y = Math.round(yOf(f)) + 0.5;
      ctx.moveTo(b.x0, y);
      ctx.lineTo(b.x1, y);
    }
    for (let ms = 0; ms <= DURATION_MS; ms += 50) {
      const x = Math.round(xOf(ms)) + 0.5;
      ctx.moveTo(x, b.y0);
      ctx.lineTo(x, b.y1);
    }
    ctx.stroke();

    ctx.fillStyle = 'rgba(169,182,204,0.9)';
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    for (const f of GRID_HZ.slice(1, -1)) ctx.fillText(`${f / 1000} kHz`, b.x1 - 4, yOf(f) - 8);
    ctx.textAlign = 'left';

    // The tones: one bar per chip, at its hop frequency.
    const shift = drift * (b.x1 - b.x0);
    for (const c of chips) {
      const x = xOf(c.startMs) + shift;
      const w = xOf(c.startMs + CHIP_MS) - xOf(c.startMs) - 2;
      if (x > b.x1) continue;
      const near = cur ? Math.abs(cur.chip - c.index) <= 2 : false;
      const hot = playing === c.index || (cur?.chip === c.index && Math.abs(tones[cur.tone] - c.hz) < 1);
      ctx.globalAlpha = hot ? 1 : near ? 0.95 : 0.72;
      ctx.fillStyle = hot ? '#ff9a72' : ACCENT;
      ctx.fillRect(x, yOf(c.hz) - (near || hot ? 2 : 1.5), Math.min(w, b.x1 - x), near || hot ? 4 : 3);
    }
    ctx.globalAlpha = 1;
  }

  function resize() {
    const r = screen.getBoundingClientRect();
    W = r.width;
    H = r.height;
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    draw();
    if (cur) place();
  }

  // ---- Cursors ----
  function place() {
    if (!cur) {
      delete screen.dataset.reading;
      return;
    }
    const c = chips[cur.chip];
    const x = xOf(c.startMs);
    const y = yOf(tones[cur.tone]);
    screen.dataset.reading = '';
    vCur.style.transform = `translateX(${Math.round(x)}px)`;
    hCur.style.transform = `translateY(${Math.round(y)}px)`;
    read.textContent = `t = ${fmtMs(c.startMs)}\nf = ${fmtHz(tones[cur.tone])}`;
    // The readout sits up and right of the crossing, flipped when it would leave the screen.
    const rw = read.offsetWidth;
    const rh = read.offsetHeight;
    const left = x + 10 + rw > W - 6 ? x - 10 - rw : x + 10;
    const top = y - 10 - rh < 30 ? y + 10 : y - 10 - rh;
    read.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    draw();
  }

  const nearestTone = (hz: number) => {
    let best = 0;
    tones.forEach((t, k) => Math.abs(t - hz) < Math.abs(tones[best] - hz) && (best = k));
    return best;
  };

  function fromPointer(e: PointerEvent) {
    const r = screen.getBoundingClientRect();
    const b = box();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    if (px < b.x0 || px > b.x1 || py < b.y0 - 8 || py > b.y1 + 8) {
      if (cur) (cur = null), place(), draw();
      return;
    }
    const ms = ((px - b.x0) / (b.x1 - b.x0)) * DURATION_MS;
    const hz = F_MIN + ((b.y1 - py) / (b.y1 - b.y0)) * (F_MAX - F_MIN);
    const next = { chip: Math.min(CHIPS - 1, Math.max(0, Math.floor(ms / CHIP_MS))), tone: nearestTone(hz) };
    if (cur && next.chip === cur.chip && next.tone === cur.tone) return;
    cur = next;
    place();
  }

  // Only a real mouse moves the cursors; a finger scrolling past should not.
  screen.addEventListener('pointermove', (e) => e.pointerType === 'mouse' && fromPointer(e));
  screen.addEventListener('pointerleave', () => {
    cur = null;
    place();
    draw();
  });

  const announce = () => {
    if (!cur) return;
    const c = chips[cur.chip];
    const onTone = Math.abs(tones[cur.tone] - c.hz) < 1;
    live.textContent = `Chip ${c.index + 1} of ${CHIPS}, ${fmtMs(c.startMs)}. Cursor at ${fmtHz(tones[cur.tone])}${onTone ? ', on this chip’s tone' : `; this chip is at ${fmtHz(c.hz)}`}.`;
  };

  scope.addEventListener('focus', () => {
    if (cur) return;
    cur = { chip: 0, tone: nearestTone(chips[0].hz) };
    place();
    announce();
  });
  scope.addEventListener('blur', () => {
    cur = null;
    place();
    draw();
  });
  scope.addEventListener('keydown', (e) => {
    if (!cur) return;
    const k = e.key;
    if (k === 'ArrowRight' || k === 'ArrowLeft') {
      const chip = Math.min(CHIPS - 1, Math.max(0, cur.chip + (k === 'ArrowRight' ? 1 : -1)));
      cur = { chip, tone: nearestTone(chips[chip].hz) };
    } else if (k === 'ArrowUp' || k === 'ArrowDown') {
      cur = { ...cur, tone: Math.min(tones.length - 1, Math.max(0, cur.tone + (k === 'ArrowUp' ? 1 : -1))) };
    } else if (k === 'Home' || k === 'End') {
      const chip = k === 'Home' ? 0 : CHIPS - 1;
      cur = { chip, tone: nearestTone(chips[chip].hz) };
    } else return;
    e.preventDefault();
    place();
    announce();
  });

  // ---- Sound: the preamble, ten times slower, from chip 0. Nothing plays until pressed. ----
  let audio: AudioContext | null = null;
  let src: AudioBufferSourceNode | null = null;
  let raf = 0;
  const stop = () => {
    try {
      src?.stop();
    } catch {
      // Already finished.
    }
    src = null;
    cancelAnimationFrame(raf);
    playing = -1;
    play.style.setProperty('--p', '0');
    play.setAttribute('aria-pressed', 'false');
    playLabel.textContent = 'Hear it, 2 s';
    draw();
  };
  play.addEventListener('click', async () => {
    if (src) return stop();
    audio ??= new AudioContext();
    if (audio.state === 'suspended') await audio.resume();
    const data = synthesize(chips, audio.sampleRate);
    const buf = audio.createBuffer(1, data.length, audio.sampleRate);
    buf.copyToChannel(data, 0);
    src = audio.createBufferSource();
    src.buffer = buf;
    src.connect(audio.destination);
    const t0 = audio.currentTime + 0.05;
    src.start(t0);
    src.onended = stop;
    play.setAttribute('aria-pressed', 'true');
    playLabel.textContent = 'Stop';
    const chipS = (CHIP_MS * LISTEN_STRETCH) / 1000;
    const ac = audio;
    const tick = () => {
      play.style.setProperty('--p', String(Math.min(1, Math.max(0, (ac.currentTime - t0) / (chipS * CHIPS)))));
      const k = Math.floor((ac.currentTime - t0) / chipS);
      if (k !== playing && k < CHIPS) {
        playing = k;
        draw();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
  document.addEventListener('visibilitychange', () => document.hidden && src && stop());

  new ResizeObserver(resize).observe(screen);
  resize();

  // Touch screens: the preamble drifts in from the right once, slowly, and stops.
  if (matchMedia('(hover: none)').matches && !prefersReducedMotion()) {
    const start = performance.now();
    const T = 3200;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / T);
      drift = 0.35 * (1 - t) ** 3;
      draw();
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}
