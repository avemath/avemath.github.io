// The hero waterfall. It runs a 512 point FFT with a Hann window over the transmitted signal
// (src/lib/tx-signal.ts) one frame at a time, newest at the top, and maps level to color. The
// canvas is one pixel per bin and one per frame; CSS scales it up. "Hear it" plays the same
// buffer, and while it plays the display follows the audio clock.
//
// It pauses off-screen and in background tabs, and shows one still frame under reduced motion
// or on low-power devices. Sound only ever starts from a click.
import { FS, N, BINS, BIN_HZ, LOOP, VIEW_ROWS, STILL_TOP, synthesize } from '../lib/tx-signal';
import { prefersReducedMotion } from './preferences';

const DB_LO = -82;
const DB_HI = -22;
const FRAME_HZ = FS / N;

export function mountSpectrogram(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('canvas');
  const screen = root.querySelector<HTMLElement>('[data-tx-screen]');
  const ctx = canvas?.getContext('2d');
  if (!canvas || !screen || !ctx) return;

  const signal = synthesize();
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  const lowPower = (navigator.hardwareConcurrency ?? 8) <= 2 || nav.connection?.saveData === true || (nav.deviceMemory ?? 8) < 2;

  // ---- Radix-2 FFT, in place, with precomputed tables ----
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const bits = Math.log2(N);
  const bitrev = Uint16Array.from({ length: N }, (_, i) => {
    let y = 0;
    for (let b = 0, x = i; b < bits; b++, x >>= 1) y = (y << 1) | (x & 1);
    return y;
  });
  const cosT = Float64Array.from({ length: N / 2 }, (_, k) => Math.cos((-2 * Math.PI * k) / N));
  const sinT = Float64Array.from({ length: N / 2 }, (_, k) => Math.sin((-2 * Math.PI * k) / N));
  const hann = Float64Array.from({ length: N }, (_, n) => 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / N));

  function fft() {
    for (let i = 0; i < N; i++) {
      const j = bitrev[i];
      if (j > i) {
        [re[i], re[j]] = [re[j], re[i]];
        [im[i], im[j]] = [im[j], im[i]];
      }
    }
    for (let size = 2; size <= N; size <<= 1) {
      const half = size >> 1;
      const stride = N / size;
      for (let start = 0; start < N; start += size) {
        for (let k = 0; k < half; k++) {
          const wr = cosT[k * stride];
          const wi = sinT[k * stride];
          const a = start + k;
          const b = a + half;
          const tr = wr * re[b] - wi * im[b];
          const ti = wr * im[b] + wi * re[b];
          re[b] = re[a] - tr;
          im[b] = im[a] - ti;
          re[a] += tr;
          im[a] += ti;
        }
      }
    }
  }

  // Levels in dBFS, screen order: row 0 is the newest frame.
  const levels = new Float32Array(VIEW_ROWS * BINS).fill(DB_LO);
  const image = ctx.createImageData(BINS, VIEW_ROWS);
  const px = image.data;
  let lut = buildLut();

  /** Analyze one frame of the loop into row 0. A full-scale tone reads 0 dBFS. */
  function analyze(frame: number) {
    const base = (((frame % LOOP) + LOOP) % LOOP) * N;
    for (let n = 0; n < N; n++) {
      re[n] = signal[base + n] * hann[n];
      im[n] = 0;
    }
    fft();
    levels.copyWithin(BINS, 0, levels.length - BINS);
    px.copyWithin(BINS * 4, 0, px.length - BINS * 4);
    const scale = 4 / N;
    for (let k = 0; k < BINS; k++) {
      const db = 20 * Math.log10(Math.hypot(re[k], im[k]) * scale + 1e-9);
      levels[k] = db;
      paint(k, db);
    }
  }

  function paint(i: number, db: number) {
    const t = Math.max(0, Math.min(255, Math.round(((db - DB_LO) / (DB_HI - DB_LO)) * 255)));
    const o = i * 4;
    px[o] = lut[t * 4];
    px[o + 1] = lut[t * 4 + 1];
    px[o + 2] = lut[t * 4 + 2];
    px[o + 3] = lut[t * 4 + 3];
  }

  function repaintAll() {
    for (let i = 0; i < levels.length; i++) paint(i, levels[i]);
    ctx!.putImageData(image, 0, 0);
  }

  // Quiet water is clear, so the screen color shows through. Signal comes up in teal and the
  // strongest bins run to amber.
  function buildLut() {
    const s = getComputedStyle(root);
    const teal = rgb(s.getPropertyValue('--tx-ink').trim() || '#56b6d8');
    const amber = rgb(s.getPropertyValue('--tx-hot').trim() || '#f0a940');
    const out = new Uint8ClampedArray(256 * 4);
    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      const hot = Math.max(0, (t - 0.72) / 0.28);
      const a = t < 0.17 ? 0 : Math.min(1, ((t - 0.17) / 0.55) ** 1.4);
      for (let c = 0; c < 3; c++) out[i * 4 + c] = teal[c] + (amber[c] - teal[c]) * hot;
      out[i * 4 + 3] = a * 255;
    }
    return out;
  }

  function rgb(color: string): [number, number, number] {
    const m = color.replace('#', '');
    const n = parseInt(m.length === 3 ? [...m].map((c) => c + c).join('') : m, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  // ---- Clock ----
  let frame = 0; // newest frame analyzed
  let clock = 0; // frames, fractional
  let last = 0;
  let raf = 0;
  let running = false;
  let visible = true;

  function fill(top: number) {
    for (let f = top - VIEW_ROWS + 1; f <= top; f++) analyze(f);
    frame = top;
    clock = top;
    ctx!.putImageData(image, 0, 0);
  }

  const animated = () => !prefersReducedMotion() && !lowPower;

  function tick(now: number) {
    const target = audio ? audioFrame() : (clock += ((now - last) / 1000) * FRAME_HZ);
    last = now;
    const due = Math.floor(target);
    if (due - frame > VIEW_ROWS) frame = due - VIEW_ROWS;
    if (due > frame) {
      while (frame < due) analyze(++frame);
      ctx!.putImageData(image, 0, 0);
      if (cursor) showReadout();
    }
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
  const level = () => (cursor ? levels[cursor.row * BINS + cursor.bin] : DB_LO);
  const fmtDb = (db: number) => (db <= -99 ? 'below -99 dBFS' : `${Math.round(db)} dBFS`.replace('-', '−'));

  function showReadout() {
    if (!cursor || !readout) return;
    readout.textContent = `${fmtHz((cursor.bin + 0.5) * BIN_HZ)}  ${fmtDb(level())}`;
    if (cross) {
      cross.hidden = false;
      cross.style.setProperty('--x', `${((cursor.bin + 0.5) / BINS) * 100}%`);
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
    const bin = Math.floor(((e.clientX - r.left) / r.width) * BINS);
    const row = Math.floor(((e.clientY - r.top) / r.height) * VIEW_ROWS);
    if (bin < 0 || bin >= BINS || row < 0 || row >= VIEW_ROWS) return clearReadout();
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
    cursor ??= { bin: Math.floor(BINS / 2), row: Math.floor(VIEW_ROWS / 2) };
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
      bin: Math.max(0, Math.min(BINS - 1, cursor.bin + move[0])),
      row: Math.max(0, Math.min(VIEW_ROWS - 1, cursor.row + move[1])),
    };
    showReadout();
    if (live) live.textContent = `${fmtHz((cursor.bin + 0.5) * BIN_HZ)}, ${fmtDb(level())}`;
  });

  // ---- Hear it ----
  const play = root.querySelector<HTMLButtonElement>('[data-tx-play]');
  const playLabel = root.querySelector<HTMLElement>('[data-tx-play-label]');
  let audioCtx: AudioContext | null = null;
  let audio: { source: AudioBufferSourceNode; gain: GainNode; t0: number; f0: number } | null = null;

  const audioFrame = () => (audio ? audio.f0 + (audioCtx!.currentTime - audio.t0) * FRAME_HZ : clock);

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
        const b = (a + 1) % signal.length;
        up[i] = signal[a] + (signal[b] - signal[a]) * (x - a);
      }
      const buf = ac.createBuffer(1, up.length, FS * 3);
      buf.copyToChannel(up, 0);
      return buf;
    }
  }

  let buffer: AudioBuffer | null = null;

  async function startAudio() {
    audioCtx ??= new AudioContext();
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    buffer ??= makeBuffer(audioCtx);
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = audioCtx.createGain();
    const t0 = audioCtx.currentTime + 0.02;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.2, t0 + 0.05);
    source.connect(gain).connect(audioCtx.destination);
    // Start the sound where the display is, so what you hear is the row arriving at the top.
    const f0 = Math.floor(running ? clock : frame) + 1;
    source.start(t0, ((((f0 % LOOP) + LOOP) % LOOP) * N) / FS);
    audio = { source, gain, t0, f0 };
    setPlaying(true);
  }

  function stopAudio() {
    if (!audio || !audioCtx) return;
    const { source, gain } = audio;
    clock = audioFrame();
    const t = audioCtx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.06);
    source.stop(t + 0.08);
    audio = null;
    setPlaying(false);
  }

  function setPlaying(on: boolean) {
    if (!play || !playLabel) return;
    play.setAttribute('aria-pressed', String(on));
    playLabel.textContent = on ? 'Stop' : 'Hear it';
  }

  if (play && 'AudioContext' in window) {
    play.hidden = false;
    play.addEventListener('click', () => (audio ? stopAudio() : startAudio().catch(() => setPlaying(false))));
  }

  // ---- Lifecycle ----
  function refresh() {
    stop();
    if (animated()) start();
    else fill(STILL_TOP);
  }

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    visible ? start() : stop();
  }).observe(root);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  window.addEventListener('themechange', () => {
    lut = buildLut();
    repaintAll();
  });
  window.addEventListener('motionchange', refresh);

  // Open on the still frame, so the name is on screen at once, then let it scroll.
  fill(STILL_TOP);
  root.dataset.live = '';
  start();
}
