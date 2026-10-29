// The hero waterfall. It draws my name into a raster in the heading font, builds the
// transmission from it (src/lib/tx-signal.ts), and runs a 512 point FFT over that signal one
// symbol at a time, newest at the top. Like an OFDM receiver, the FFT is aligned to each symbol
// with no window, so every subcarrier reads its own level with no leakage from its neighbors.
// Level maps through a navy, teal, amber colormap. Each cycle sends the name once, holds with the name centered, fades, and starts
// again. "Hear it" plays the same buffer, and while it plays the display follows the audio clock.
//
// It pauses off-screen and in background tabs, and shows the held frame under reduced motion or
// on low-power devices. Sound only ever starts from a click.
import { FS, N, CP, SYMBOL, SHOW_BINS, STRETCH, BIN_HZ, FRAME_HZ, VIEW_ROWS, TEXT_BINS, LINES, holdFrame, makeFft, synthesize, addNoise } from '../lib/tx-signal';
import { prefersReducedMotion } from './preferences';

const DB_LO = -84;

/** Hand the main thread back to the page between batches of work, so setup never blocks it. */
const pause = () => {
  const sched = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  return sched?.yield ? sched.yield() : new Promise<void>((r) => setTimeout(r, 0));
};
const DB_HI = -27;
const HOLD_MS = 4200;
const FADE_MS = 700;

// Colormap stops, low to high level, mixed in OKLab so the ramp is perceptually even.
const STOPS: [number, string][] = [
  [0, '#061523'],
  [0.3, '#0b3550'],
  [0.55, '#14708c'],
  [0.75, '#4fb3c9'],
  [0.88, '#c9c48a'],
  [1, '#f0a940'],
];

/** The name as a coverage raster TEXT_BINS wide: two lines, each fitted to the width of the longer. */
function rasterName() {
  const family = getComputedStyle(document.documentElement).getPropertyValue('--font-display').trim() || 'sans-serif';
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.font = `600 100px ${family}`;
  const wide = Math.max(...LINES.map((l) => probe.measureText(l).width));
  const capH = probe.measureText('M').actualBoundingBoxAscent || 70;
  const size = (100 * (TEXT_BINS - 2)) / wide;
  const cap = (capH * size) / 100;
  const gap = size * 0.32;
  const rows = Math.ceil((cap * LINES.length + gap * (LINES.length - 1)) * STRETCH) + 2;
  const c = document.createElement('canvas');
  c.width = TEXT_BINS;
  c.height = rows;
  const x = c.getContext('2d', { willReadFrequently: true })!;
  x.font = `600 ${size}px ${family}`;
  x.fillStyle = '#fff';
  x.textAlign = 'center';
  x.textBaseline = 'alphabetic';
  x.setTransform(1, 0, 0, STRETCH, 0, 0);
  LINES.forEach((line, i) => x.fillText(line, TEXT_BINS / 2, 1 + cap + i * (cap + gap)));
  const px = x.getImageData(0, 0, TEXT_BINS, rows).data;
  const mask = new Float32Array(TEXT_BINS * rows);
  for (let i = 0; i < mask.length; i++) mask[i] = px[i * 4 + 3] / 255;
  return { mask, rows, font: size, cap, gap };
}

export async function mountSpectrogram(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('canvas');
  const screen = root.querySelector<HTMLElement>('[data-tx-screen]');
  const ctx = canvas?.getContext('2d', { alpha: false });
  if (!canvas || !screen || !ctx) return;

  // Draw the name in the heading font once it is ready (it is preloaded, so this is quick).
  await Promise.race([document.fonts?.load(`600 40px ${getComputedStyle(document.documentElement).getPropertyValue('--font-display')}`), new Promise((r) => setTimeout(r, 1500))]).catch(() => {});
  // Setup is split into small batches that yield in between (see pause), so it never makes one
  // long task. The results are the same as doing it in one go.
  const { mask, rows } = rasterName();
  await pause();
  const signal = await synthesize(mask, rows, pause);
  const HOLD = holdFrame(rows);
  const quiet = new Float32Array(16 * SYMBOL);
  addNoise(quiet);
  await pause();

  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  const lowPower = (navigator.hardwareConcurrency ?? 8) <= 2 || nav.connection?.saveData === true || (nav.deviceMemory ?? 8) < 2;

  const fft = makeFft(N);
  const re = new Float64Array(N);
  const im = new Float64Array(N);

  // Levels in dBFS, screen order: row 0 is the newest frame.
  const levels = new Float32Array(VIEW_ROWS * SHOW_BINS).fill(DB_LO);
  const image = ctx.createImageData(SHOW_BINS, VIEW_ROWS);
  const px = image.data;
  const lut = buildLut();

  /** Analyze one symbol into row 0: a frame of the transmission, or quiet water before it starts. */
  function analyze(frame: number) {
    const src = frame >= 0 && frame <= HOLD ? signal : quiet;
    const base = (frame >= 0 && frame <= HOLD ? frame : ((frame % 16) + 16) % 16) * SYMBOL + CP;
    for (let n = 0; n < N; n++) {
      re[n] = src[base + n];
      im[n] = 0;
    }
    fft(re, im, -1);
    levels.copyWithin(SHOW_BINS, 0, levels.length - SHOW_BINS);
    px.copyWithin(SHOW_BINS * 4, 0, px.length - SHOW_BINS * 4);
    const scale = 2 / N;
    for (let k = 0; k < SHOW_BINS; k++) {
      const db = 20 * Math.log10(Math.hypot(re[k], im[k]) * scale + 1e-9);
      levels[k] = db;
      paint(k, db);
    }
  }

  function paint(i: number, db: number) {
    const t = Math.max(0, Math.min(255, Math.round(((db - DB_LO) / (DB_HI - DB_LO)) * 255)));
    px.set(lut.subarray(t * 4, t * 4 + 4), i * 4);
  }

  function buildLut() {
    const lab = STOPS.map(([t, hex]) => [t, toLab(hex)] as const);
    const out = new Uint8ClampedArray(256 * 4);
    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      let j = 0;
      while (j < lab.length - 2 && t > lab[j + 1][0]) j++;
      const [t0, a] = lab[j];
      const [t1, b] = lab[j + 1];
      const u = Math.max(0, Math.min(1, (t - t0) / (t1 - t0)));
      const rgb = fromLab(a.map((v, c) => v + (b[c] - v) * u) as [number, number, number]);
      out.set([...rgb, 255], i * 4);
    }
    return out;
  }

  // ---- The cycle: send, hold with the name centered, fade, start again ----
  let frame = -1; // newest frame analyzed
  let clock = 0; // frames, fractional
  let last = 0;
  let raf = 0;
  let running = false;
  let visible = true;
  let phase: 'send' | 'hold' | 'fade' = 'send';
  let phaseEnd = 0;

  /** Fill the screen up to `top` (quiet water before the transmission, then the signal) in
   *  batches, and keep a copy, since the screens a cycle starts from never change. */
  async function compute(top: number) {
    for (let f = top - VIEW_ROWS + 1; f <= top; f++) {
      analyze(f);
      if ((f - top) % 24 === 0) await pause();
    }
    return { levels: levels.slice(), px: px.slice() };
  }

  /** Show a computed screen: copying it is instant, so a cycle restarts with no work to do. */
  function show(snap: { levels: Float32Array; px: Uint8ClampedArray }, top: number) {
    levels.set(snap.levels);
    px.set(snap.px);
    frame = top;
    clock = top;
    ctx!.putImageData(image, 0, 0);
  }

  const held = await compute(HOLD);
  const calm = await compute(-1);

  function restart(now: number) {
    // Hear it, and every new cycle while it plays, starts from quiet water: the sweep, then the
    // name, with the picture and the sound starting on the same sample.
    if (audio) stopAudio();
    root.dataset.live = '';
    screen!.removeAttribute('data-fade');
    phase = 'send';
    show(calm, -1);
    last = now;
    if (playing) startAudio();
  }

  const animated = () => !prefersReducedMotion() && !lowPower;

  function tick(now: number) {
    if (phase === 'send') {
      clock = audio ? audioFrame() : clock + ((now - last) / 1000) * FRAME_HZ;
      const due = Math.min(HOLD, Math.floor(clock));
      if (due > frame) {
        while (frame < due) analyze(++frame);
        ctx!.putImageData(image, 0, 0);
        if (cursor) showReadout();
      }
      if (frame >= HOLD) {
        phase = 'hold';
        phaseEnd = now + HOLD_MS;
      }
    } else if (phase === 'hold' && now >= phaseEnd) {
      phase = 'fade';
      phaseEnd = now + FADE_MS;
      screen!.setAttribute('data-fade', '');
    } else if (phase === 'fade' && now >= phaseEnd) {
      restart(now);
    }
    last = now;
    raf = requestAnimationFrame(tick);
  }

  function start() {
    if (running || !visible || document.hidden || !animated()) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  // ---- Readout under the pointer, or moved with the arrow keys ----
  const readout = root.querySelector<HTMLElement>('[data-tx-readout]');
  const live = root.querySelector<HTMLElement>('[data-tx-live]');
  const cross = root.querySelector<HTMLElement>('[data-tx-cross]');
  const idleText = readout?.textContent ?? '';
  let cursor: { bin: number; row: number } | null = null;

  const fmtHz = (hz: number) => (hz >= 1000 ? `${(hz / 1000).toFixed(2)} kHz` : `${Math.round(hz)} Hz`);
  const level = () => (cursor ? levels[cursor.row * SHOW_BINS + cursor.bin] : DB_LO);
  const fmtDb = (db: number) => (db <= -99 ? 'below -99 dBFS' : `${Math.round(db)} dBFS`.replace('-', '−'));
  const fmtT = (row: number) => `${(row / FRAME_HZ).toFixed(1)} s ago`;

  function showReadout() {
    if (!cursor || !readout) return;
    readout.textContent = `${fmtHz((cursor.bin + 0.5) * BIN_HZ)}  ${fmtDb(level())}  ${fmtT(cursor.row)}`;
    if (cross) {
      cross.hidden = false;
      cross.style.setProperty('--x', `${((cursor.bin + 0.5) / SHOW_BINS) * 100}%`);
      cross.style.setProperty('--y', `${((cursor.row + 0.5) / VIEW_ROWS) * 100}%`);
    }
  }

  function clearReadout() {
    cursor = null;
    if (readout) readout.textContent = idleText;
    if (cross) cross.hidden = true;
  }

  function pointAt(e: PointerEvent) {
    const r = screen!.getBoundingClientRect();
    const bin = Math.floor(((e.clientX - r.left) / r.width) * SHOW_BINS);
    const row = Math.floor(((e.clientY - r.top) / r.height) * VIEW_ROWS);
    if (bin < 0 || bin >= SHOW_BINS || row < 0 || row >= VIEW_ROWS) return clearReadout();
    cursor = { bin, row };
    showReadout();
  }

  screen.addEventListener('pointermove', pointAt);
  screen.addEventListener('pointerdown', pointAt);
  screen.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && clearReadout());

  screen.tabIndex = 0;
  screen.setAttribute('role', 'group');
  screen.setAttribute('aria-roledescription', 'spectrogram');
  screen.setAttribute('aria-label', 'Spectrogram. Use the arrow keys to read frequency and level.');
  screen.addEventListener('focus', () => {
    cursor ??= { bin: Math.floor(SHOW_BINS / 2), row: Math.floor(VIEW_ROWS / 2) };
    showReadout();
  });
  screen.addEventListener('blur', clearReadout);
  screen.addEventListener('keydown', (e) => {
    if (!cursor) return;
    const step = e.shiftKey ? 10 : 1;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    cursor = {
      bin: Math.max(0, Math.min(SHOW_BINS - 1, cursor.bin + move[0])),
      row: Math.max(0, Math.min(VIEW_ROWS - 1, cursor.row + move[1])),
    };
    showReadout();
    if (live) live.textContent = `${fmtHz((cursor.bin + 0.5) * BIN_HZ)}, ${fmtDb(level())}, ${fmtT(cursor.row)}`;
  });

  // ---- Hear it: one transmission per cycle, in step with the display ----
  const play = root.querySelector<HTMLButtonElement>('[data-tx-play]');
  const playLabel = root.querySelector<HTMLElement>('[data-tx-play-label]');
  let audioCtx: AudioContext | null = null;
  let buffer: AudioBuffer | null = null;
  let audio: { source: AudioBufferSourceNode; gain: GainNode; t0: number } | null = null;
  let playing = false;

  const audioFrame = () => (audio && audioCtx ? (audioCtx.currentTime - audio.t0) * FRAME_HZ : clock);

  function makeBuffer(ac: AudioContext) {
    try {
      const buf = ac.createBuffer(1, signal.length, FS);
      buf.copyToChannel(signal, 0);
      return buf;
    } catch {
      // Some browsers only take buffers near the device rate: upsample by 3 to 48 kHz.
      const up = new Float32Array(signal.length * 3);
      for (let i = 0; i < up.length; i++) {
        const x = i / 3;
        const a = Math.floor(x);
        const b = Math.min(a + 1, signal.length - 1);
        up[i] = signal[a] + (signal[b] - signal[a]) * (x - a);
      }
      const buf = ac.createBuffer(1, up.length, FS * 3);
      buf.copyToChannel(up, 0);
      return buf;
    }
  }

  function startAudio() {
    if (!audioCtx) return;
    buffer ??= makeBuffer(audioCtx);
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    const gain = audioCtx.createGain();
    const t0 = audioCtx.currentTime + 0.03;
    gain.gain.setValueAtTime(0.12, t0);
    source.connect(gain).connect(audioCtx.destination);
    source.start(t0);
    source.addEventListener('ended', () => audio?.source === source && (audio = null));
    audio = { source, gain, t0 };
  }

  function stopAudio() {
    if (audio && audioCtx) {
      clock = audioFrame();
      const t = audioCtx.currentTime;
      audio.gain.gain.setValueAtTime(audio.gain.gain.value, t);
      audio.gain.gain.linearRampToValueAtTime(0, t + 0.06);
      audio.source.stop(t + 0.08);
    }
    audio = null;
  }

  function setPlaying(on: boolean) {
    playing = on;
    play?.setAttribute('aria-pressed', String(on));
    if (playLabel) playLabel.textContent = on ? 'Stop' : 'Hear it';
  }

  if (play && 'AudioContext' in window) {
    play.hidden = false;
    play.addEventListener('click', async () => {
      if (playing) {
        stopAudio();
        setPlaying(false);
        return;
      }
      try {
        audioCtx ??= new AudioContext();
        if (audioCtx.state === 'suspended') await audioCtx.resume();
        setPlaying(true);
        // Send the name again from the start, so the sound and the picture arrive together.
        if (animated()) restart(performance.now());
        else startAudio();
      } catch {
        setPlaying(false);
      }
    });
  }

  // ---- Lifecycle ----
  function refresh() {
    stop();
    if (animated()) {
      if (phase === 'hold') phaseEnd = performance.now() + HOLD_MS;
      start();
    } else {
      screen!.removeAttribute('data-fade');
      phase = 'hold';
      show(held, HOLD);
      root.dataset.live = '';
    }
  }

  /** Whenever the display comes back into view, it opens on the held frame with the full name
   *  centered and goes on from there, so nobody lands on a screen of empty water. While the
   *  sound is playing, the picture keeps following the sound instead. */
  function resumeHeld() {
    if (!animated() || audio) return;
    screen!.removeAttribute('data-fade');
    phase = 'hold';
    show(held, HOLD);
    phaseEnd = performance.now() + HOLD_MS;
  }

  new IntersectionObserver(([entry]) => {
    const was = visible;
    visible = entry.isIntersecting;
    if (visible && !was) resumeHeld();
    visible ? start() : stop();
  }).observe(root);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return stop();
    if (visible) resumeHeld();
    start();
  });
  window.addEventListener('motionchange', refresh);

  // The still frame from the build is already on screen, showing the held name. With motion, it
  // stays through the first hold and then fades into the first live transmission, so loading this
  // code changes nothing on screen. Without motion the computed held frame replaces it at once.
  phase = 'hold';
  show(held, HOLD);
  phaseEnd = performance.now() + HOLD_MS;
  if (animated()) start();
  else root.dataset.live = '';
}

function toLab(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

function fromLab([L, a, b]: [number, number, number]): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map((c) => {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
    return Math.round(Math.max(0, Math.min(1, v)) * 255);
  }) as [number, number, number];
}
