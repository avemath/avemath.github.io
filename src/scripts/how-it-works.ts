// The hero's "How it works" tab: the five steps of the real pipeline, each with an excerpt of the
// code that runs on the page and a small live view of its output, plus controls that break a step
// on purpose. The excerpts are cut from the source files at build time (Vite's ?raw imports, between
// `#region how:` markers), so they are always the code that runs. Loaded only when the tab opens.
// The styles come in as text and are added on first open, so the page itself carries none of them.
import styles from './how-it-works.css?inline';
import signalSource from '../lib/tx-signal.ts?raw';
import rasterSource from '../lib/tx-raster.ts?raw';
import { CHIRP, CP, FIRST_BIN, FS, LEAD, N, NAME_START, SHOW_BINS, TEXT_BINS, VIEW_ROWS, addNoise, holdFrame, makeFft, receive, synthesize, type Channel } from '../lib/tx-signal';
import { rasterName } from '../lib/tx-raster';
import { waterfallLut } from './spectrogram';

const SOURCE = 'https://github.com/avemath/avemath.github.io/blob/main/src/scripts/spectrogram.ts';
const DB_LO = -84;
const DB_HI = -27;
// In this walkthrough the water also adds a second path, 1 ms late, so the prefix has a job to do.
const ECHO = { delay: 20, gain: 0.6 };

// ---- Excerpts: cut from the source between markers, with their real line numbers ----
function excerpt(source: string, name: string) {
  const lines = source.split('\n');
  const start = lines.findIndex((l) => l.includes(`#region how:${name}`));
  const end = lines.findIndex((l, i) => i > start && l.includes('#endregion'));
  const body = lines.slice(start + 1, end);
  const indent = Math.min(...body.filter((l) => l.trim()).map((l) => l.match(/^ */)![0].length));
  return { code: body.map((l) => l.slice(indent)).join('\n'), from: start + 2, to: end };
}

const KEYWORDS = /^(const|let|for|if|else|return|new|while|continue|of|await|function|true|false|null)$/;
/** A small TypeScript highlighter: comments, strings, numbers and keywords. */
function highlight(code: string) {
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const token = /(\/\/[^\n]*)|('(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)/g;
  let out = '';
  let last = 0;
  for (const m of code.matchAll(token)) {
    out += esc(code.slice(last, m.index));
    const [t, com, str, num, word] = m;
    if (com) out += `<span class="hl-c">${esc(t)}</span>`;
    else if (str) out += `<span class="hl-s">${esc(t)}</span>`;
    else if (num) out += `<span class="hl-n">${esc(t)}</span>`;
    else if (word && KEYWORDS.test(word)) out += `<span class="hl-k">${esc(t)}</span>`;
    else out += esc(t);
    last = m.index! + t.length;
  }
  return out + esc(code.slice(last));
}

const steps = [
  {
    id: 'raster',
    tab: 'Bitmap',
    title: 'Draw the name as a bitmap',
    text: 'I draw the name in the heading font into a canvas 80 pixels wide, one pixel for each subcarrier. Each pixel’s coverage, from 0 to 1, becomes that subcarrier’s level.',
    file: 'src/lib/tx-raster.ts',
    source: rasterSource,
    view: 'The bitmap, one row per symbol.',
  },
  {
    id: 'symbol',
    tab: 'Symbols',
    title: 'Each row becomes one OFDM symbol',
    text: 'Every row of the bitmap is one symbol. Lit pixels switch on their subcarriers, and an inverse FFT turns them into 512 time samples.',
    file: 'src/lib/tx-signal.ts',
    source: signalSource,
    view: 'One symbol: its subcarriers on top, its 512 time samples below.',
  },
  {
    id: 'prefix',
    tab: 'Prefix',
    title: 'A cyclic prefix and a soft join',
    text: 'Each symbol starts with a copy of its own last 96 samples. The next symbol fades in across that prefix with a raised cosine, so nothing switches in one sample and the receiver never reads the join.',
    file: 'src/lib/tx-signal.ts',
    source: signalSource,
    view: 'The fade across the prefix, and the spectrum right at a join between two symbols.',
  },
  {
    id: 'chirp',
    tab: 'Sync',
    title: 'A chirp to sync on',
    text: 'Before the name, one sweep from 400 Hz to 3.2 kHz tells the receiver a transmission is starting.',
    file: 'src/lib/tx-signal.ts',
    source: signalSource,
    view: 'The sweep: frequency rising over its 24 symbols, and the start of its waveform.',
  },
  {
    id: 'receive',
    tab: 'Receiver',
    title: 'One FFT per symbol draws the waterfall',
    text: 'The receiver skips each prefix and runs a 512 point FFT over the rest. Each FFT is one row of the waterfall, newest at the top.',
    file: 'src/lib/tx-signal.ts',
    source: signalSource,
    view: 'One received row: level at each frequency, 0 to 4 kHz.',
  },
];

export async function mountHowItWorks(root: HTMLElement) {
  const sheet = document.createElement('style');
  sheet.textContent = styles;
  document.head.append(sheet);
  await document.fonts?.ready;
  const { mask, rows } = rasterName();
  const lut = waterfallLut();
  const fft = makeFft(N);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const HOLD = holdFrame(rows);
  // The busiest row of the name, for the one-symbol views.
  let busy = 0;
  let most = -1;
  for (let r = 0; r < rows; r++) {
    let on = 0;
    for (let c = 0; c < TEXT_BINS; c++) on += mask[r * TEXT_BINS + c] > 0.5 ? 1 : 0;
    if (on > most) [most, busy] = [on, r];
  }
  const busyFrame = NAME_START + (rows - 1 - busy);

  const opts = { prefix: true, ramp: true, noise: 1 };
  // The signal with every step working, kept to compare against when a step is broken.
  const intact = await synthesize(mask, rows, undefined, { echo: ECHO });
  let signal: Float32Array = intact;
  const quiet = new Float32Array(16 * (N + CP));
  addNoise(quiet);
  const cpNow = () => (opts.prefix ? CP : 0);

  // ---- Markup ----
  root.innerHTML = `
    <div class="how">
      <div class="how__steps" role="tablist" aria-label="Steps">
        ${steps.map((s, i) => `<button type="button" role="tab" id="how-tab-${s.id}" aria-controls="how-step" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}"><span class="mono">${i + 1}</span> ${s.tab}</button>`).join('')}
      </div>
      <div class="how__step" id="how-step" role="tabpanel" aria-labelledby="how-tab-${steps[0].id}" data-how-step></div>
      <div class="how__lab">
        <fieldset class="how__break">
          <legend>Break it on purpose</legend>
          <label><input type="checkbox" data-opt="prefix" checked /> Cyclic prefix</label>
          <label><input type="checkbox" data-opt="ramp" checked /> Fade</label>
          <label class="how__noise">Noise <input type="range" min="1" max="200" step="1" value="1" data-opt="noise" aria-valuetext="1 times the usual level" /></label>
          <div class="how__buttons">
            <button type="button" class="btn btn--small" data-how-reset>Reset</button>
            <button type="button" class="btn btn--small" data-how-play aria-pressed="false">Hear it</button>
          </div>
        </fieldset>
        <figure class="how__result">
          <canvas width="${SHOW_BINS}" height="${VIEW_ROWS}" aria-hidden="true" data-how-result></canvas>
          <figcaption aria-live="polite" data-how-status></figcaption>
        </figure>
      </div>
      <p class="how__note">This walkthrough also gives the water a second path, 1 ms late, the kind of echo the prefix is there to absorb. The display tab sends the signal without it.</p>
      <a class="link how__source" href="${SOURCE}">Source on GitHub</a>
    </div>`;

  const stepEl = root.querySelector<HTMLElement>('[data-how-step]')!;
  const stepTabs = [...root.querySelectorAll<HTMLButtonElement>('.how__steps [role="tab"]')];
  const result = root.querySelector<HTMLCanvasElement>('[data-how-result]')!;
  const status = root.querySelector<HTMLElement>('[data-how-status]')!;
  let current = 0;

  // ---- Drawing helpers ----
  const css = (name: string) => getComputedStyle(root).getPropertyValue(name).trim();
  function plot(canvas: HTMLCanvasElement) {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = canvas.clientWidth || 240;
    const h = canvas.clientHeight || 150;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const c = canvas.getContext('2d')!;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#061523';
    c.fillRect(0, 0, w, h);
    return { c, w, h };
  }
  const line = (c: CanvasRenderingContext2D, ys: ArrayLike<number>, x0: number, x1: number, y0: number, y1: number, lo: number, hi: number, color: string) => {
    c.strokeStyle = color;
    c.lineWidth = 1.2;
    c.beginPath();
    for (let i = 0; i < ys.length; i++) {
      const x = x0 + ((x1 - x0) * i) / (ys.length - 1);
      const y = y1 - ((Math.max(lo, Math.min(hi, ys[i])) - lo) / (hi - lo)) * (y1 - y0);
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.stroke();
  };
  const label = (c: CanvasRenderingContext2D, text: string, x: number, y: number) => {
    c.fillStyle = '#9fb9c6';
    c.font = '10px ' + (css('--font-mono') || 'monospace');
    c.fillText(text, x, y);
  };
  const TEAL = '#4fb3c9';
  const AMBER = '#f0a940';

  /** The body or the whole symbol of one frame, from the current signal. */
  const symbolAt = (frame: number, withPrefix = false) => {
    const cp = cpNow();
    const start = frame * (N + cp) + (withPrefix ? 0 : cp);
    return signal.subarray(start, start + N + (withPrefix ? cp : 0));
  };

  const views: Record<string, (canvas: HTMLCanvasElement) => void> = {
    raster(canvas) {
      const { c, w, h } = plot(canvas);
      const s = Math.min((w - 16) / TEXT_BINS, (h - 16) / rows);
      const ox = (w - s * TEXT_BINS) / 2;
      const oy = (h - s * rows) / 2;
      for (let r = 0; r < rows; r++)
        for (let k = 0; k < TEXT_BINS; k++) {
          const a = mask[r * TEXT_BINS + k];
          if (a < 0.02) continue;
          c.fillStyle = `rgba(240, 169, 64, ${a.toFixed(2)})`;
          c.fillRect(ox + k * s, oy + r * s, s - 0.3, s - 0.3);
        }
      c.strokeStyle = 'rgba(79, 179, 201, 0.6)';
      c.strokeRect(ox + 0.5, oy + busy * s + 0.5, s * TEXT_BINS - 1, s);
    },
    symbol(canvas) {
      const { c, w, h } = plot(canvas);
      const mid = h * 0.52;
      // Subcarrier levels this row asks for, from the bitmap.
      for (let k = 0; k < SHOW_BINS; k++) {
        const col = k - FIRST_BIN;
        const a = col >= 0 && col < TEXT_BINS ? mask[busy * TEXT_BINS + col] : 0;
        if (a < 0.02) continue;
        const x = 8 + ((w - 16) * k) / SHOW_BINS;
        c.strokeStyle = AMBER;
        c.beginPath();
        c.moveTo(x, mid - 10);
        c.lineTo(x, mid - 10 - a * (mid - 30));
        c.stroke();
      }
      label(c, 'subcarriers, 0 to 4 kHz', 8, 14);
      line(c, symbolAt(busyFrame), 8, w - 8, mid + 6, h - 18, -0.5, 0.5, TEAL);
      label(c, '512 time samples', 8, h - 5);
    },
    prefix(canvas) {
      const { c, w, h } = plot(canvas);
      const top = h * 0.42;
      const g = Array.from({ length: CP }, (_, j) => (opts.ramp ? 0.5 - 0.5 * Math.cos((Math.PI * (j + 0.5)) / CP) : 1));
      if (opts.prefix) {
        line(c, g, 8, w * 0.45, 20, top, 0, 1, AMBER);
        line(c, g.map((v) => 1 - v), 8, w * 0.45, 20, top, 0, 1, TEAL);
        label(c, opts.ramp ? 'fade in, fade out' : 'fade off: one-sample switch', 8, 13);
      } else label(c, 'prefix off: no room for a fade', 8, 13);
      // Spectrum of 128 samples centered on a join between two symbols in the name: the intact
      // signal faintly, the current one on top, so a hard switch shows as the floor jumping up.
      const joinSpectrum = (sig: Float32Array, cp: number) => {
        const join = (busyFrame + 1) * (N + cp);
        const W = 128;
        const x = new Float64Array(512);
        const y = new Float64Array(512);
        for (let n = 0; n < W; n++) x[n] = (sig[join - W / 2 + n] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (W - 1)));
        fft(x, y, -1);
        return Array.from({ length: SHOW_BINS }, (_, k) => 20 * Math.log10(Math.hypot(x[k], y[k]) * (8 / W) + 1e-9));
      };
      line(c, joinSpectrum(intact, CP), 8, w - 8, top + 22, h - 16, -110, -20, 'rgba(159, 185, 198, 0.45)');
      line(c, joinSpectrum(signal, cpNow()), 8, w - 8, top + 22, h - 16, -110, -20, opts.ramp && opts.prefix ? TEAL : AMBER);
      label(c, 'at a join · gray: with fade', 8, top + 16);
    },
    chirp(canvas) {
      const { c, w, h } = plot(canvas);
      const mid = h * 0.5;
      // Its frequency over time, from the same constants the code uses.
      c.strokeStyle = AMBER;
      c.beginPath();
      c.moveTo(8, mid - 10);
      c.lineTo(w - 8, mid - 10 - ((CHIRP.f1 - CHIRP.f0) / 4000) * (mid - 28));
      c.stroke();
      label(c, `${CHIRP.f0} Hz to ${(CHIRP.f1 / 1000).toFixed(1)} kHz`, 8, 14);
      const start = LEAD * (N + cpNow());
      line(c, signal.subarray(start, start + 1600), 8, w - 8, mid + 6, h - 18, -0.3, 0.3, TEAL);
      label(c, 'first 100 ms of the waveform', 8, h - 5);
    },
    receive(canvas) {
      const { c, w, h } = plot(canvas);
      const out = new Float32Array(SHOW_BINS);
      receive(signal, busyFrame, out, fft, re, im, cpNow());
      line(c, out, 8, w - 8, 22, h - 18, -100, -20, AMBER);
      label(c, 'dBFS', 8, 14);
      label(c, '0', 8, h - 5);
      label(c, '4 kHz', w - 40, h - 5);
    },
  };

  function showStep(i: number, focus = false) {
    current = i;
    const s = steps[i];
    const ex = excerpt(s.source, s.id);
    stepTabs.forEach((t, j) => {
      t.setAttribute('aria-selected', String(i === j));
      t.tabIndex = i === j ? 0 : -1;
    });
    if (focus) stepTabs[i].focus();
    stepEl.setAttribute('aria-labelledby', `how-tab-${s.id}`);
    stepEl.innerHTML = `
      <div class="how__text">
        <h2 class="how__title"><span class="mono">${i + 1} / ${steps.length}</span> ${s.title}</h2>
        <p>${s.text}</p>
        <pre class="how__code" tabindex="0" aria-label="Code from ${s.file}, lines ${ex.from} to ${ex.to}"><code>${highlight(ex.code)}</code></pre>
        <p class="how__file mono">${s.file} · lines ${ex.from} to ${ex.to}</p>
      </div>
      <figure class="how__view">
        <canvas aria-hidden="true" data-how-view></canvas>
        <figcaption>${s.view}</figcaption>
      </figure>`;
    redrawView();
  }

  const redrawView = () => {
    const canvas = stepEl.querySelector<HTMLCanvasElement>('[data-how-view]');
    if (canvas) views[steps[current].id](canvas);
  };

  // ---- The received waterfall, held with the name centered, for the current settings ----
  function drawResult() {
    const ctx = result.getContext('2d', { alpha: false })!;
    const img = ctx.createImageData(SHOW_BINS, VIEW_ROWS);
    const row = new Float32Array(SHOW_BINS);
    for (let r = 0; r < VIEW_ROWS; r++) {
      const f = HOLD - r;
      if (f < 0) receive(quiet, ((f % 16) + 16) % 16, row, fft, re, im);
      else receive(signal, f, row, fft, re, im, cpNow());
      for (let k = 0; k < SHOW_BINS; k++) {
        const t = Math.max(0, Math.min(255, Math.round(((row[k] - DB_LO) / (DB_HI - DB_LO)) * 255)));
        img.data.set(lut.subarray(t * 4, t * 4 + 4), (r * SHOW_BINS + k) * 4);
      }
    }
    ctx.putImageData(img, 0, 0);
    const broken = [!opts.prefix && 'no cyclic prefix, so the echo smears each row into the next', !opts.ramp && 'no fade, so every join is a hard switch', opts.noise > 1 && `noise ${opts.noise} times the usual level`].filter(Boolean);
    status.textContent = `Received, with the name held mid-screen. ${broken.length ? 'Broken: ' + broken.join('; ') + '.' : 'Everything on.'}`;
  }

  // Changing a control builds the signal again; one build at a time, then the latest settings.
  let building = false;
  let again = false;
  async function rebuild() {
    if (building) return void (again = true);
    building = true;
    signal = await synthesize(mask, rows, undefined, { ...opts, echo: ECHO } satisfies Channel);
    quiet.fill(0);
    addNoise(quiet, undefined, 0, quiet.length, opts.noise);
    building = false;
    drawResult();
    redrawView();
    if (again) {
      again = false;
      rebuild();
    }
  }

  root.querySelectorAll<HTMLInputElement>('[data-opt]').forEach((input) =>
    input.addEventListener('input', () => {
      if (input.type === 'checkbox') (opts as Record<string, unknown>)[input.dataset.opt!] = input.checked;
      else {
        opts.noise = Number(input.value);
        input.setAttribute('aria-valuetext', `${opts.noise} times the usual level`);
      }
      stopSound();
      rebuild();
    }),
  );
  root.querySelector('[data-how-reset]')!.addEventListener('click', () => {
    Object.assign(opts, { prefix: true, ramp: true, noise: 1 });
    root.querySelectorAll<HTMLInputElement>('[data-opt]').forEach((i) => (i.type === 'checkbox' ? (i.checked = true) : (i.value = '1')));
    stopSound();
    rebuild();
  });

  // ---- Hear this version, once, only when asked ----
  const play = root.querySelector<HTMLButtonElement>('[data-how-play]')!;
  let audioCtx: AudioContext | null = null;
  let source: AudioBufferSourceNode | null = null;
  function stopSound() {
    source?.stop();
    source = null;
    play.setAttribute('aria-pressed', 'false');
    play.textContent = 'Hear it';
  }
  play.addEventListener('click', async () => {
    if (source) return stopSound();
    audioCtx ??= new AudioContext();
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    const buf = audioCtx.createBuffer(1, signal.length, FS);
    buf.copyToChannel(Float32Array.from(signal), 0);
    source = audioCtx.createBufferSource();
    source.buffer = buf;
    const gain = audioCtx.createGain();
    gain.gain.value = 0.12;
    source.connect(gain).connect(audioCtx.destination);
    source.addEventListener('ended', () => source && stopSound());
    source.start();
    play.setAttribute('aria-pressed', 'true');
    play.textContent = 'Stop';
  });

  // Step tabs: arrow keys, Home and End.
  stepTabs.forEach((t, i) => t.addEventListener('click', () => showStep(i)));
  root.querySelector('.how__steps')!.addEventListener('keydown', (e) => {
    const k = (e as KeyboardEvent).key;
    const to = { ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: steps.length - 1 }[k];
    if (to === undefined) return;
    e.preventDefault();
    showStep((to + steps.length) % steps.length, true);
  });

  // Views redraw at their new size if the panel changes width. Nothing here animates, so reduced
  // motion needs nothing extra: every control just redraws a still frame.
  let width = 0;
  new ResizeObserver(([e]) => {
    if (Math.round(e.contentRect.width) === width) return;
    width = Math.round(e.contentRect.width);
    redrawView();
  }).observe(root);
  showStep(0);
  drawResult();
}
