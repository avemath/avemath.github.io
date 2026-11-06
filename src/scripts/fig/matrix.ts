// Fig. 03: the LED matrix. Three sources, each started by a press: the microphone (asked for
// only on that click, and the audio never leaves the device), the clip, or the idle glow. Typing
// a name scrolls it across the matrix the way setup() scrolls the owner's name on boot. Every
// frame comes from src/lib/led-firmware.ts.
import { navy, mixHex } from '../../lib/navy-client';
import { createDemoTrack, createSpectrum, openMic, scrollFrame, scrollSteps, DEMO_FONT, FRAME_MS, FS, H, N, SCROLL_STEP_MS, W } from '../../lib/led-firmware';
import { prefersReducedMotion } from '../preferences';

// TODO(ave): "Play the clip" plays the firmware demo's generated track (kick, bass, arpeggio,
// pad, hats), rendered to audio here. To use a short clip you recorded instead, add it to
// public/media/ and play it through an AnalyserNode the way openMic() reads the microphone.
const CLIP_SECONDS = 13;
const CLIP_GAIN = 0.5;

const ON = '#de6a41';
const PEAK = '#ffc2a8';

type Source = 'none' | 'mic' | 'clip' | 'idle' | 'name';

export function mountMatrix(root: HTMLElement) {
  // The panel is the site's navy; an unlit LED is a step lighter.
  const NAVY = navy();
  const OFF = mixHex(NAVY, 0.94, '#ffffff');
  const canvas = root.querySelector<HTMLCanvasElement>('[data-mf-canvas]')!;
  const ctx = canvas.getContext('2d')!;
  const read = root.querySelector<HTMLElement>('[data-mf-read]')!;
  const nameIn = root.querySelector<HTMLInputElement>('[data-mf-name]')!;
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-mf-src]')];
  const card = root.closest<HTMLElement>('[data-fc]');
  const cell = canvas.width / W;

  let sp = createSpectrum();
  const track = createDemoTrack();
  let source: Source = 'none';
  let mic: Awaited<ReturnType<typeof openMic>> | null = null;
  let audio: AudioContext | null = null;
  let clip: AudioBufferSourceNode | null = null;
  let clipStart = 0;
  let raf = 0;
  let last = 0;
  let acc = 0;
  let name = '';
  let nameStep = 0;

  const led = (x: number, y: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
  };
  const clear = () => {
    ctx.fillStyle = NAVY;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  function drawSpectrum() {
    clear();
    const s = sp.s;
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < H; y++) led(x, y, H - 1 - y < s.bandValues[x] ? ON : OFF);
      if (s.peakValues[x] > 0) led(x, H - 1 - Math.min(H - 1, s.peakValues[x]), PEAK);
    }
  }

  // displayIdleGlow(): the firmware's breathing glow, brightest in the middle, drawn in the accent.
  function drawIdle(now: number) {
    clear();
    const breath = (Math.sin(((now % 2600) / 2600) * Math.PI * 2 - Math.PI / 2) + 1) / 2;
    const base = 18 + breath * 72;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const d2 = (x - 7) ** 2 + (y - 7) ** 2;
        const v = Math.max(0, (base * (255 - (d2 / 98) * 165)) / 255 / 90);
        ctx.globalAlpha = Math.min(1, 0.12 + v);
        led(x, y, ON);
      }
    ctx.globalAlpha = 1;
  }

  function drawName(step: number) {
    clear();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) led(x, y, OFF);
    scrollFrame(step, (x, y) => led(x, y, ON), name, DEMO_FONT);
  }

  // One loop() pass on the next 128 samples of the source.
  function feed() {
    const s = sp.s;
    s.clock += FRAME_MS;
    if (source === 'mic' && mic) mic.read(s.re, s.im);
    else {
      const t0 = source === 'clip' && audio ? ((audio.currentTime - clipStart) % CLIP_SECONDS) * 1000 : s.clock;
      for (let i = 0; i < N; i++) {
        s.re[i] = track(t0 + (i * 1000) / FS);
        s.im[i] = 0;
      }
    }
    sp.step();
  }

  function frame(now: number) {
    const dt = Math.min(200, now - last);
    last = now;
    if (source === 'idle') drawIdle(now);
    else if (source === 'name') {
      acc += dt;
      while (acc >= SCROLL_STEP_MS) (nameStep++, (acc -= SCROLL_STEP_MS));
      if (nameStep >= scrollSteps(name)) return stopTo('none');
      drawName(nameStep);
    } else {
      acc += dt;
      while (acc >= FRAME_MS) (feed(), (acc -= FRAME_MS));
      // Clip and mic show what the firmware shows, glow included, as the board would.
      if (sp.s.spectrumMode) drawSpectrum();
      else drawIdle(now);
      read.textContent = `${sp.s.spectrumMode ? 'spectrum' : 'idle glow'} · level ${sp.s.ampSmoothed.toFixed(0)}, switches on above ${sp.s.enterThreshold.toFixed(0)}`;
    }
    raf = requestAnimationFrame(frame);
  }

  function start() {
    cancelAnimationFrame(raf);
    last = performance.now();
    acc = 0;
    raf = requestAnimationFrame(frame);
  }

  function stopAudio() {
    try {
      clip?.stop();
    } catch {
      // Already stopped.
    }
    clip = null;
    mic?.close();
    mic = null;
  }

  function stopTo(next: Source) {
    cancelAnimationFrame(raf);
    stopAudio();
    source = next;
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mfSrc === next)));
    if (next === 'none') {
      read.textContent = '';
      still();
    }
  }

  async function choose(kind: 'mic' | 'clip' | 'idle') {
    if (source === kind) return stopTo('none');
    stopTo(kind);
    sp = createSpectrum();
    if (kind === 'idle') {
      if (prefersReducedMotion()) drawIdle(1300);
      else start();
      read.textContent = 'idle glow, as the board shows in a quiet room';
      return;
    }
    if (kind === 'mic') {
      try {
        mic = await openMic();
        read.textContent = 'listening. The audio stays on this device.';
      } catch {
        stopTo('none');
        read.textContent = 'No microphone, so here is the clip.';
        return choose('clip');
      }
    } else {
      audio ??= new AudioContext();
      if (audio.state === 'suspended') await audio.resume();
      const buf = audio.createBuffer(1, CLIP_SECONDS * FS, FS);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = ((track((i * 1000) / FS) - 1850) / 2048) * CLIP_GAIN;
      clip = audio.createBufferSource();
      clip.buffer = buf;
      clip.loop = true;
      clip.connect(audio.destination);
      clipStart = audio.currentTime + 0.05;
      clip.start(clipStart);
    }
    start();
  }

  buttons.forEach((b) => b.addEventListener('click', () => choose(b.dataset.mfSrc as 'mic' | 'clip' | 'idle')));
  card?.querySelector('[data-mic]')?.addEventListener('click', () => {
    root.scrollIntoView({ block: 'nearest' });
    if (source !== 'mic') choose('mic');
  });

  // A typed name scrolls once, letter by letter in the firmware's 80 ms per column.
  let typing = 0;
  nameIn.addEventListener('input', () => {
    clearTimeout(typing);
    typing = window.setTimeout(() => {
      name = nameIn.value.toUpperCase().replace(/[^A-Z]/g, '');
      if (!name) return stopTo('none');
      stopTo('name');
      nameStep = 0;
      if (prefersReducedMotion()) {
        // One still frame with the name as far in as it fits.
        drawName(W - 1);
        return;
      }
      start();
    }, 350);
  });

  // At rest: a real frame of the firmware on the clip, computed now. It runs the first 9 s of
  // the clip and keeps the fullest spectrum frame after the warmup, peak dots included.
  function still() {
    const saved = sp;
    sp = createSpectrum();
    let best = -1;
    let bands = new Int32Array(W);
    let peaks = new Int32Array(W);
    for (let k = 0; k < Math.ceil(9000 / FRAME_MS); k++) {
      const s = sp.s;
      s.clock += FRAME_MS;
      for (let i = 0; i < N; i++) {
        s.re[i] = track(s.clock + (i * 1000) / FS);
        s.im[i] = 0;
      }
      sp.step();
      const sum = s.bandValues.reduce((a, b) => a + b, 0);
      if (s.spectrumMode && sum > best) (best = sum), (bands = s.bandValues.slice()), (peaks = s.peakValues.slice());
    }
    sp.s.bandValues.set(bands);
    sp.s.peakValues.set(peaks);
    drawSpectrum();
    sp = saved;
  }

  document.addEventListener('visibilitychange', () => document.hidden && source !== 'none' && stopTo('none'));
  // The resting frame runs 9 s of the firmware on the clip, so it waits until the figure is near
  // the screen instead of costing the first load.
  const near = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting) return;
      near.disconnect();
      if (source === 'none') still();
    },
    { rootMargin: '600px 0px' },
  );
  near.observe(root);
}
