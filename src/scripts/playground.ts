// The Signals playground (src/components/playground/MeshPlayground.astro). Pressing Send (or Enter in
// the message box) runs the whole link once in src/lib/fhbfsk.ts: text to bits, the 48 kHz
// waveform, the channel at the sliders' settings, the detector and the spectrogram. Then the drawing
// plays it out: the packet crosses the mesh as ripples (close for a 1, wide for a 0), a surface echo
// follows as a weaker copy, Doppler stretches or squeezes the ripples, noise roughens the water, the
// spectrogram fills in under the mesh in step, and the receiver reveals each decoded bit as its chip
// reaches the far side. Wrong bits and characters are marked. Clicking or tapping the mesh drops a
// ping. Hear it plays the exact transmitted waveform. One rAF loop, only while something moves and
// the mesh is on screen; with reduced motion nothing animates and the result shows at once.
import { bitsToText, CHIP_S, C_WATER, channel, demodulate, FS, modulate, spectrogram, textToBits } from '../lib/fhbfsk';
import { NU, NV, projector, rippleFreq, swell } from '../lib/mesh';
import { token } from '../lib/tokens-client';
import { prefersReducedMotion } from './preferences';

/** The drawing's pace: one chip per 0.09 s on screen, 7 chips visible across the pane at a time. */
const VIS_CHIP = 0.09;
const SPAN = 7;
/** Doppler is a fraction of a percent; the drawing exaggerates the stretch 40 times. */
const DOPPLER_DRAW = 40;

export function mountPlayground(root: HTMLElement) {
  // The compact version on the home page has only the mesh, a Send a packet button and a line for
  // the result. Anything it leaves out is a detached stand-in here (the default message, a clean
  // channel), so the same link runs either way.
  const $ = <T extends Element>(s: string, make?: () => T) => (root.querySelector<T>(s) ?? make?.())!;
  const input = (value: string) => () => Object.assign(document.createElement('input'), { value }) as HTMLInputElement;
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K) => () => document.createElement(tag);
  const compact = root.hasAttribute('data-compact');
  const form = $<HTMLFormElement>('[data-pg-form]', el('form'));
  const msgIn = $<HTMLInputElement>('[data-pg-msg]', input('hi from Ave'));
  const snrIn = $<HTMLInputElement>('[data-pg-snr]', input('30'));
  const echoIn = $<HTMLInputElement>('[data-pg-echo]', input('0'));
  const dopIn = $<HTMLInputElement>('[data-pg-doppler]', input('0'));
  const txBits = $<HTMLElement>('[data-pg-tx-bits]', el('p'));
  const rxText = $<HTMLElement>('[data-pg-rx-text]', el('p'));
  const rxBits = $<HTMLElement>('[data-pg-rx-bits]', el('p'));
  const sum = $<HTMLElement>('[data-pg-sum]', el('p'));
  const live = $<HTMLElement>('[data-pg-live]', el('p'));
  const mesh = $<HTMLCanvasElement>('[data-pg-mesh]');
  const spec = $<HTMLCanvasElement>('[data-pg-spec]', el('canvas'));
  const hear = $<HTMLButtonElement>('[data-pg-hear]', el('button'));
  const hearLabel = $<HTMLElement>('[data-pg-hear-label]', el('span'));
  const mctx = mesh.getContext('2d')!;
  const sctx = spec.getContext('2d')!;

  // ---- Settings in real units ----
  const echoOf = (v: number) => ({ ms: v === 0 ? 0 : 0.6 * v, gain: v === 0 ? 0 : 0.09 * v });
  const settings = () => {
    const e = echoOf(Number(echoIn.value));
    return { snrDb: Number(snrIn.value), echoMs: e.ms, echoGain: e.gain, speed: Number(dopIn.value) };
  };
  const showOutputs = () => {
    const s = settings();
    const out = (k: string) => root.querySelector(`[data-pg-out="${k}"]`) ?? { textContent: '' };
    out('snr').textContent = `${s.snrDb} dB SNR`;
    out('echo').textContent = s.echoGain ? `${s.echoMs.toFixed(1)} ms, ${Math.round(s.echoGain * 100)}%` : 'off';
    const shift = ((s.speed / C_WATER) * 11520).toFixed(0);
    out('doppler').textContent = `${s.speed > 0 ? '+' : ''}${s.speed} m/s (${Number(shift) > 0 ? '+' : ''}${shift} Hz)`;
  };

  // ---- One run of the link ----
  type Run = { text: string; bits: number[]; rx: number[]; rxText: string; errors: number; spec: ReturnType<typeof spectrogram>; x: Float32Array; t0: number; s: ReturnType<typeof settings> };
  let run: Run | null = null;
  let runs = 0;
  const pings: { u: number; v: number; t: number }[] = [];

  const chunks = (bits: number[]) => {
    const out: string[] = [];
    for (let i = 0; i < bits.length; i += 8) out.push(bits.slice(i, i + 8).join(''));
    return out;
  };

  const send = () => {
    const text = msgIn.value.slice(0, 24) || ' ';
    const bits = textToBits(text);
    const { x } = modulate(bits);
    const s = settings();
    const y = channel(x, { ...s, seed: 1000 + ++runs });
    const rx = demodulate(y, bits.length).bits;
    const errors = rx.reduce((n, b, i) => n + (b !== bits[i] ? 1 : 0), 0);
    run = { text, bits, rx, rxText: bitsToText(rx), errors, spec: spectrogram(y), x, t0: performance.now() / 1000, s };
    txBits.textContent = chunks(bits).join(' ');
    // The final answer is known now; the receiver reveals it as the chips arrive.
    root.dataset.errors = String(errors);
    rxText.dataset.text = run.rxText;
    root.dataset.state = 'sending';
    live.textContent = '';
    drawSpec(prefersReducedMotion() ? Infinity : 0);
    renderRx(prefersReducedMotion() ? bits.length : 0);
    if (prefersReducedMotion()) finish();
    else kick();
  };

  const finish = () => {
    if (!run) return;
    renderRx(run.bits.length);
    drawSpec(Infinity);
    root.dataset.state = 'done';
    const msg = `Decoded "${run.rxText}" with ${run.errors} bit error${run.errors === 1 ? '' : 's'} out of ${run.bits.length}.`;
    sum.textContent = msg;
    live.textContent = msg;
    if (prefersReducedMotion()) drawMesh(0);
  };

  /** The receiver's bits and text, the first n chips decoded; wrong ones marked. */
  let shown = -1;
  const renderRx = (n: number) => {
    if (!run || n === shown) return;
    shown = n;
    const { bits, rx } = run;
    const parts: string[] = [];
    for (let i = 0; i < n; i++) {
      if (i && i % 8 === 0) parts.push(' ');
      parts.push(rx[i] !== bits[i] ? `<span class="is-wrong">${rx[i]}</span>` : String(rx[i]));
    }
    rxBits.innerHTML = parts.join('');
    const chars = Math.floor(n / 8);
    let html = '';
    for (let c = 0; c < chars; c++) {
      const got = run.rxText[c];
      const want = run.text[c] && run.text.charCodeAt(c) >= 32 && run.text.charCodeAt(c) <= 126 ? run.text[c] : '?';
      const esc = got.replace(/&/g, '&amp;').replace(/</g, '&lt;');
      html += got !== want ? `<span class="is-wrong">${esc}</span>` : esc;
    }
    rxText.innerHTML = html;
    if (n < run.bits.length) sum.textContent = `${n} of ${run.bits.length} bits in`;
  };

  // ---- The spectrogram, filled in up to a time (s of signal) ----
  let specW = 0;
  let specH = 0;
  const drawSpec = (upTo: number) => {
    if (!run || !specW) return;
    const { db, cols, rows, hop } = run.spec;
    const shownCols = Math.min(cols, Math.ceil((upTo * FS) / hop));
    const img = sctx.createImageData(cols, rows);
    const ink = hexRgb(token('--screen-accent'));
    const bg = hexRgb(token('--screen'));
    let max = -1e9;
    for (let i = 0; i < db.length; i++) max = Math.max(max, db[i]);
    for (let c = 0; c < cols; c++)
      for (let r = 0; r < rows; r++) {
        const k = (r * cols + c) * 4;
        const t = c < shownCols ? Math.min(1, Math.max(0, (db[c * rows + r] - (max - 42)) / 42)) ** 1.6 : 0;
        img.data[k] = bg[0] + (ink[0] - bg[0]) * t;
        img.data[k + 1] = bg[1] + (ink[1] - bg[1]) * t;
        img.data[k + 2] = bg[2] + (ink[2] - bg[2]) * t;
        img.data[k + 3] = 255;
      }
    const off = new OffscreenCanvas(cols, rows);
    off.getContext('2d')!.putImageData(img, 0, 0);
    sctx.imageSmoothingEnabled = false;
    sctx.fillStyle = token('--screen');
    sctx.fillRect(0, 0, specW, specH);
    sctx.drawImage(off, 0, 0, specW, specH);
  };
  const hexRgb = (h: string) => {
    const m = h.trim().replace('#', '');
    return [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16));
  };

  // ---- The mesh ----
  let W = 0;
  let H = 0;
  let dpr = 1;
  let project = projector(1, 1);
  const size = () => {
    dpr = Math.min(2, devicePixelRatio || 1);
    const r = mesh.getBoundingClientRect();
    W = Math.round(r.width * dpr);
    H = Math.round(r.height * dpr);
    mesh.width = W;
    mesh.height = H;
    project = projector(W, H);
    const sr = spec.getBoundingClientRect();
    specW = spec.width = Math.round(sr.width * dpr);
    specH = spec.height = Math.round(sr.height * dpr);
  };

  // Rough water: a fixed field of random offsets, re-drawn each frame at the noise level.
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const grain = Float32Array.from({ length: (NU + 1) * (NV + 1) }, () => rnd() * 2 - 1);

  /** The packet's ripple height at u, at time T into the run, for the copy delayed by `lag` s with gain g. */
  const packetAt = (u: number, T: number, lag: number, g: number, stretch: number) => {
    if (!run) return 0;
    const bw = 1 / SPAN;
    const head = -0.05 + ((T - lag) / VIS_CHIP) * bw;
    const x = head - u;
    if (x < 0) return 0;
    const i = Math.floor(x / bw);
    if (i >= run.bits.length) return 0;
    const within = (x % bw) / bw;
    const env = Math.sin(Math.PI * within) ** 0.6;
    const f = rippleFreq(run.bits[i]) * stretch;
    return g * 0.034 * env * Math.sin(2 * Math.PI * f * x - T * 9);
  };

  const drawMesh = (T: number) => {
    if (!W) return;
    const dark = token('--bit-glow') === '1';
    const t = performance.now() / 1000;
    const s = run?.s ?? settings();
    const rough = 0.016 * Math.min(1, 10 ** (-(s.snrDb + 10) / 25));
    // Moving toward the receiver squeezes the ripples (higher spatial frequency).
    const stretch = 1 + (s.speed / C_WATER) * DOPPLER_DRAW;
    const echoLag = run ? (s.echoMs / 1000 / CHIP_S) * VIS_CHIP : 0;
    const still = prefersReducedMotion();
    // Packet height per column (it only varies along u), then per point.
    const col = new Float32Array(NU + 1);
    for (let i = 0; i <= NU; i++) {
      const u = i / NU;
      col[i] = still || !run ? 0 : packetAt(u, T, 0, 1, stretch) + (s.echoGain ? packetAt(u, T, echoLag, s.echoGain, stretch) : 0);
    }
    const pts: [number, number][][] = [];
    const hs: number[][] = [];
    for (let j = 0; j <= NV; j++) {
      const row: [number, number][] = [];
      const hr: number[] = [];
      const v = j / NV;
      for (let i = 0; i <= NU; i++) {
        const u = i / NU;
        let h = col[i] * (0.75 + 0.25 * Math.cos(v * 6));
        h += still ? 0 : swell(u, v, t);
        h += rough * grain[j * (NU + 1) + i] * (still ? 1 : Math.sin(t * 6 + grain[(j * (NU + 1) + i + 17) % grain.length] * 9));
        for (const p of pings) {
          const pt = t - p.t;
          const d = Math.hypot(u - p.u, (v - p.v) * 0.6);
          const k = d - pt * 0.38;
          if (k < 0.02 && k > -0.25) h += 0.045 * Math.exp(-pt * 0.9) * Math.cos(k * 60) * Math.exp(-((k + 0.05) ** 2) / 0.004);
        }
        hr.push(h);
        row.push(project(u, v, h));
      }
      pts.push(row);
      hs.push(hr);
    }
    mctx.setTransform(1, 0, 0, 1, 0, 0);
    mctx.globalCompositeOperation = 'source-over';
    mctx.globalAlpha = 1;
    mctx.fillStyle = token('--paper');
    mctx.fillRect(0, 0, W, H);
    const line = token('--accent');
    if (dark) {
      mctx.globalCompositeOperation = 'lighter';
      mctx.shadowColor = line;
      mctx.shadowBlur = 4 * dpr;
    }
    const stroke = (path: Path2D, color: string, w: number, a: number) => {
      mctx.strokeStyle = color;
      mctx.lineWidth = w * dpr;
      mctx.globalAlpha = a;
      mctx.stroke(path);
    };
    const across = new Path2D();
    for (let j = 0; j <= NV; j++) pts[j].forEach((p, i) => (i ? across.lineTo(p[0], p[1]) : across.moveTo(p[0], p[1])));
    const into = new Path2D();
    for (let i = 0; i <= NU; i += 1) pts.forEach((r, j) => (j ? into.lineTo(r[i][0], r[i][1]) : into.moveTo(r[i][0], r[i][1])));
    stroke(across, line, 0.8, dark ? 0.55 : 0.55);
    stroke(into, line, 0.6, dark ? 0.35 : 0.38);
    // Ridges: where the water is lifted, a heavier stroke in the tone's color.
    const hi = new Path2D();
    const lo = new Path2D();
    if (run && !still) {
      const bw = 1 / SPAN;
      const head = -0.05 + (T / VIS_CHIP) * bw;
      for (let j = 0; j <= NV; j += 2)
        for (let i = 0; i < NU; i++) {
          const hm = Math.abs(hs[j][i] + hs[j][i + 1]) / 2;
          if (hm < 0.012) continue;
          const chip = Math.floor((head - i / NU) / bw);
          const bit = run.bits[chip];
          const path = bit ? hi : lo;
          path.moveTo(pts[j][i][0], pts[j][i][1]);
          path.lineTo(pts[j][i + 1][0], pts[j][i + 1][1]);
        }
      stroke(hi, token('--accent-strong'), 2, 0.9);
      stroke(lo, token('--teal'), 2, 0.9);
    }
    mctx.shadowBlur = 0;
    mctx.globalAlpha = 1;
    mctx.globalCompositeOperation = 'source-over';
    for (let k = pings.length - 1; k >= 0; k--) if (t - pings[k].t > 6) pings.splice(k, 1);
  };

  // ---- The loop ----
  let raf = 0;
  let onScreen = false;
  const frame = () => {
    raf = 0;
    const now = performance.now() / 1000;
    let busy = pings.length > 0;
    if (run && root.dataset.state === 'sending') {
      const T = now - run.t0;
      const bw = 1 / SPAN;
      // A chip has arrived when its trailing edge has crossed u = 1.
      const arrived = Math.max(0, Math.min(run.bits.length, Math.floor((-0.05 + (T / VIS_CHIP) * bw - 1) / bw)));
      renderRx(arrived);
      drawSpec((arrived * CHIP_S));
      drawMesh(T);
      if (arrived >= run.bits.length) finish();
      else busy = true;
    } else drawMesh(run ? now - run.t0 : 0);
    if ((busy || !prefersReducedMotion()) && onScreen && !document.hidden) raf = requestAnimationFrame(frame);
  };
  const kick = () => {
    if (!raf && onScreen && !document.hidden) raf = requestAnimationFrame(frame);
  };
  new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    if (onScreen) kick();
    else if (run && root.dataset.state === 'sending' && document.hidden) finish();
  }).observe(mesh);
  document.addEventListener('visibilitychange', kick);
  new ResizeObserver(() => {
    size();
    drawMesh(run ? performance.now() / 1000 - run.t0 : 0);
    drawSpec(root.dataset.state === 'done' ? Infinity : 0);
  }).observe(mesh);
  addEventListener('themechange', () => {
    drawMesh(0);
    drawSpec(Infinity);
  });

  // ---- Controls ----
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    send();
  });
  // The compact version's Send a packet is a plain button.
  if (compact) root.querySelector('[data-pg-send]')?.addEventListener('click', send);
  for (const el of [snrIn, echoIn, dopIn]) el.addEventListener('input', showOutputs);
  const ping = (clientX: number, clientY: number) => {
    const r = mesh.getBoundingClientRect();
    const x = ((clientX - r.left) * W) / r.width;
    const y = ((clientY - r.top) * H) / r.height;
    let best: [number, number] | null = null;
    let bd = 1e18;
    for (let j = 0; j <= NV; j++)
      for (let i = 0; i <= NU; i += 2) {
        const q = project(i / NU, j / NV, 0);
        const d = (q[0] - x) ** 2 + (q[1] - y) ** 2;
        if (d < bd) {
          bd = d;
          best = [i / NU, j / NV];
        }
      }
    if (best && !prefersReducedMotion()) {
      pings.push({ u: best[0], v: best[1], t: performance.now() / 1000 });
      kick();
    }
  };
  mesh.addEventListener('pointerdown', (e) => ping(e.clientX, e.clientY));
  mesh.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    const r = mesh.getBoundingClientRect();
    ping(r.left + r.width * (0.3 + Math.random() * 0.4), r.top + r.height * (0.4 + Math.random() * 0.3));
  });

  // ---- Hear it: the exact transmitted waveform, at its real pitch ----
  let audio: AudioContext | null = null;
  let src: AudioBufferSourceNode | null = null;
  let playId = 0;
  const stopAudio = () => {
    playId++;
    try {
      src?.stop();
    } catch {
      // Already finished.
    }
    src = null;
    hear.setAttribute('aria-pressed', 'false');
    hear.disabled = false;
    hearLabel.textContent = 'Hear it';
  };
  // Resolves once currentTime has advanced on two polls in a row, or after 3 s regardless (some
  // systems say "running" before the output has started, which used to clip the start).
  const clockRunning = (ctx: AudioContext) =>
    new Promise<void>((done) => {
      let last = ctx.currentTime;
      let ticks = 0;
      const until = performance.now() + 3000;
      const poll = () => {
        const now = ctx.currentTime;
        ticks = now > last ? ticks + 1 : 0;
        last = now;
        if (ticks >= 2 || performance.now() > until) done();
        else setTimeout(poll, 15);
      };
      setTimeout(poll, 15);
    });
  hear.addEventListener('click', async () => {
    if (src) return stopAudio();
    if (!run) send();
    const mine = ++playId;
    hear.disabled = true;
    hearLabel.textContent = 'Starting';
    audio ??= new AudioContext();
    const ctx = audio;
    const resumed = await Promise.race([ctx.resume().then(() => true), new Promise<false>((r) => setTimeout(() => r(false), 3000))]);
    if (mine !== playId) return;
    if (!resumed) {
      hear.disabled = false;
      hearLabel.textContent = 'No sound output';
      setTimeout(() => mine === playId && (hearLabel.textContent = 'Hear it'), 2500);
      return;
    }
    await clockRunning(ctx);
    if (mine !== playId || !run) return;
    const buf = ctx.createBuffer(1, run.x.length, FS);
    const data = Float32Array.from(run.x, (v) => v * 0.35);
    buf.copyToChannel(data, 0);
    src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.onended = () => mine === playId && stopAudio();
    src.start(ctx.currentTime + 0.05);
    hear.disabled = false;
    hear.setAttribute('aria-pressed', 'true');
    hearLabel.textContent = 'Stop';
    live.textContent = `Playing the packet: ${run.bits.length} chips, ${(run.bits.length * CHIP_S).toFixed(2)} s.`;
  });
  document.addEventListener('visibilitychange', () => document.hidden && src && stopAudio());

  // First paint: the settings, the default message's bits, and a still mesh.
  showOutputs();
  txBits.textContent = chunks(textToBits(msgIn.value)).join(' ');
  requestAnimationFrame(() => {
    size();
    drawMesh(0);
    root.dataset.ready = '';
  });
}
