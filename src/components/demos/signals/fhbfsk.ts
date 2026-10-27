// FH-BFSK chip visualizer, ported from my standalone study tool. Each chip hops to a tone pair
// and sends the low tone for a 0 or the high tone for a 1. Audio only starts from a button press.
import { mulberry32 } from '../../../lib/comms';
import { q } from './util';

// JANUS band plan, from the public papers cited on this page.
const F_LOW = 9440;
const F_HIGH = 13600;
const PAIRS = 13;
const DF = (F_HIGH - F_LOW) / (2 * PAIRS); // 160 Hz
const STORE_KEY = 'fhbfsk-v1';

type Mode = 'exag' | 'prop' | 'true';
type Saved = Partial<Record<'n' | 'seed' | 'hop' | 'pitch' | 'slow' | 'vol' | 'bits', string>>;

const store = {
  get(): Saved | null {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    } catch {
      return null;
    }
  },
  set(v: Saved) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(v));
    } catch {
      // Private mode or blocked storage: settings just won't persist.
    }
  },
};

// Simplified tone grid: 26 equal slots across the band, tone at each slot center, and pair p
// uses tones 2p (bit 0) and 2p + 1 (bit 1). The standard's real pair layout may differ.
const toneHz = (p: number, bit: number) => F_LOW + (2 * p + bit + 0.5) * DF;

function audioHz(mode: Mode, p: number, bit: number) {
  if (mode === 'true') return toneHz(p, bit);
  const base = 165;
  const oct = 3;
  if (mode === 'prop') return base * 2 ** ((oct * (toneHz(p, bit) - F_LOW)) / (F_HIGH - F_LOW));
  const center = base * 2 ** ((oct * (p + 0.5)) / PAIRS);
  return center * 2 ** ((bit ? 2 : -2) / 12);
}

const pitchNotes: Record<Mode, string> = {
  exag: 'The band maps to about 165 to 1320 Hz. Within each pair, 0 sits 2 semitones below the pair center and 1 sits 2 above.',
  prop: 'The band maps to about 165 to 1320 Hz on a log scale. Every tone keeps its spacing in proportion, so 0 against 1 is a small step.',
  true: 'Plays the actual band tone, 9.5 to 13.5 kHz. Many people find that shrill, so keep the volume low.',
};

const fmtHz = (f: number) => (f >= 1000 ? `${(f / 1000).toFixed(3)} kHz` : `${f.toFixed(1)} Hz`);

export function init(panel: HTMLElement) {
  const svg = q<SVGSVGElement>(panel, '[data-fh-plot]');
  const inp = <T extends HTMLElement>(k: string) => q<T>(panel, `[data-fh-in="${k}"]`);
  const inN = inp<HTMLInputElement>('n');
  const inBits = inp<HTMLInputElement>('bits');
  const inSeed = inp<HTMLInputElement>('seed');
  const inHop = inp<HTMLInputElement>('hop');
  const inPitch = inp<HTMLSelectElement>('pitch');
  const inSlow = inp<HTMLInputElement>('slow');
  const inVol = inp<HTMLInputElement>('vol');
  const outSlow = q<HTMLOutputElement>(panel, '[data-fh-out="slow"]');
  const outVol = q<HTMLOutputElement>(panel, '[data-fh-out="vol"]');
  const hopMsg = q<HTMLElement>(panel, '[data-fh-msg="hop"]');
  const pitchMsg = q<HTMLElement>(panel, '[data-fh-msg="pitch"]');
  const status = q<HTMLElement>(panel, '[data-fh-status]');
  const r = (k: string) => q<HTMLElement>(panel, `[data-fh-r="${k}"]`);

  let bits: number[] = [];
  let hops: number[] = [];
  let cursor = -1;
  let raf = 0;
  let geo = { L: 0, colW: 0 };

  const cfg = () => ({
    n: Math.max(2, Math.min(48, Math.round(Number(inN.value) || 16))),
    seed: Math.round(Number(inSeed.value) || 0),
    mode: inPitch.value as Mode,
  });

  function hopPattern(n: number, seed: number) {
    const raw = inHop.value.trim();
    if (raw) {
      const nums = raw.split(/[\s,;]+/).filter(Boolean).map(Number);
      const bad = nums.filter((v) => !Number.isInteger(v) || v < 0 || v >= PAIRS).length;
      hopMsg.textContent = bad
        ? `${bad} ${bad > 1 ? 'entries are' : 'entry is'} not a whole number from 0 to ${PAIRS - 1}, so ${bad > 1 ? 'they were' : 'it was'} wrapped into range.`
        : `Using your order (${nums.length} slots${nums.length < n ? ', repeating' : ''}).`;
      const clean = nums.map((v) => ((((Math.round(v) || 0) % PAIRS) + PAIRS) % PAIRS));
      return Array.from({ length: n }, (_, i) => clean[i % clean.length]);
    }
    hopMsg.textContent = 'Pair numbers separated by commas (0 is the lowest pair). Overrides the seed and repeats if shorter than the chip count.';
    const rand = mulberry32(seed);
    const out: number[] = [];
    let prev = -1;
    for (let i = 0; i < n; i++) {
      let s: number;
      do s = Math.floor(rand() * PAIRS);
      while (s === prev);
      out.push((prev = s));
    }
    return out;
  }

  function syncBits(n: number) {
    while (bits.length < n) bits.push(Math.random() < 0.5 ? 0 : 1);
    bits.length = n;
    inBits.value = bits.join('');
  }

  function render() {
    const c = cfg();
    syncBits(c.n);
    hops = hopPattern(c.n, c.seed);
    pitchMsg.textContent = pitchNotes[c.mode];

    const L = 64, R = 40, T = 26, plotH = 364, colW = 44;
    const W = L + c.n * colW + R;
    const rowY = T + plotH + 30;
    const H = rowY + 62;
    const y = (f: number) => T + ((F_HIGH - f) / (F_HIGH - F_LOW)) * plotH;
    const x1 = L + c.n * colW;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.style.minWidth = `${W}px`;
    let h = '';

    for (let p = 0; p < PAIRS; p++) {
      const yt = y(F_LOW + (2 * p + 2) * DF), yb = y(F_LOW + 2 * p * DF);
      h += `<rect x="${L}" y="${yt}" width="${c.n * colW}" height="${yb - yt}" fill="${p % 2 ? 'var(--surface-2)' : 'var(--bg)'}"/>`;
      h += `<text x="${x1 + 6}" y="${(yt + yb) / 2 + 4}">P${p}</text>`;
    }
    for (let j = 0; j < 2 * PAIRS; j++) {
      const yy = y(F_LOW + (j + 0.5) * DF);
      h += `<line x1="${L}" x2="${x1}" y1="${yy}" y2="${yy}" stroke="var(--line)" stroke-width="0.6"/>`;
    }
    const fc = (F_LOW + F_HIGH) / 2;
    // The band edges get ticks but no labels; the low one would collide with the chip row.
    for (const f of [F_LOW, 10000, 11000, fc, 12000, 13000, F_HIGH]) {
      const yy = y(f);
      h += `<line x1="${L - 5}" x2="${L}" y1="${yy}" y2="${yy}" stroke="var(--muted)"/>`;
      if (f !== F_LOW && f !== F_HIGH) h += `<text x="${L - 8}" y="${yy + 4}" text-anchor="end"${f === fc ? ' class="t-ink"' : ''}>${(f / 1000).toFixed(2)}</text>`;
    }
    h += `<line x1="${L}" x2="${x1}" y1="${y(fc)}" y2="${y(fc)}" stroke="var(--muted)" stroke-dasharray="2 4" stroke-width="0.8"/>`;
    h += `<text x="12" y="${T + plotH / 2}" transform="rotate(-90 12 ${T + plotH / 2})" text-anchor="middle">frequency, kHz</text>`;
    h += `<text x="${L}" y="${T - 10}">center 11520 Hz, dotted</text>`;
    h += `<text x="${x1 + 6}" y="${T - 10}">pair</text>`;

    const pts = hops.map((p, i) => `${L + i * colW + colW / 2},${y(toneHz(p, bits[i]))}`).join(' ');
    h += `<polyline points="${pts}" fill="none" stroke="var(--muted)" stroke-width="1" stroke-dasharray="3 3"/>`;

    for (let i = 0; i < c.n; i++) {
      const p = hops[i], b = bits[i], x = L + i * colW;
      const yTop = y(F_LOW + (2 * p + 2) * DF), yBot = y(F_LOW + 2 * p * DF);
      const y0 = y(toneHz(p, 0)), y1 = y(toneHz(p, 1));
      const on = b ? y1 : y0, off = b ? y0 : y1;
      const col = b ? 'var(--amber-ink)' : 'var(--accent)';
      h += `<g class="fh-col" data-i="${i}" tabindex="0" role="button" aria-label="Chip ${i}, pair ${p}, bit ${b}. Press to flip.">`;
      h += `<rect class="fh-colbg" x="${x}" y="${T}" width="${colW}" height="${plotH}" fill="transparent"/>`;
      h += `<rect x="${x + 3}" y="${yTop}" width="${colW - 6}" height="${yBot - yTop}" fill="var(--accent-wash-strong)" rx="2"/>`;
      h += `<line x1="${x + 5}" x2="${x + colW - 5}" y1="${y0}" y2="${y0}" stroke="var(--accent)" stroke-width="1.4" opacity="${b ? 0.45 : 1}"/>`;
      h += `<line x1="${x + 5}" x2="${x + colW - 5}" y1="${y1}" y2="${y1}" stroke="var(--amber-ink)" stroke-width="1.4" opacity="${b ? 1 : 0.45}"/>`;
      h += `<rect x="${x + colW / 2 - 4}" y="${off - 4}" width="8" height="8" fill="var(--surface)" stroke="var(--muted)"/>`;
      h += `<rect x="${x + colW / 2 - 7}" y="${on - 7}" width="14" height="14" fill="${col}" stroke="var(--text)"/>`;
      h += `<line x1="${x}" x2="${x}" y1="${T}" y2="${T + plotH}" stroke="var(--line)"/>`;
      h += `<text x="${x + colW / 2}" y="${T + plotH + 14}" text-anchor="middle">${i}</text>`;
      h += `<rect x="${x + 7}" y="${rowY - 12}" width="${colW - 14}" height="20" rx="4" fill="${col}"/>`;
      h += `<text x="${x + colW / 2}" y="${rowY + 3}" text-anchor="middle" style="fill:var(--surface);font-weight:600">${b}</text>`;
      h += `</g>`;
      h += `<g class="fh-col" data-p="${i}" tabindex="0" role="button" aria-label="Play chip ${i}">`;
      h += `<rect class="fh-colbg" x="${x + 7}" y="${rowY + 16}" width="${colW - 14}" height="22" rx="4" fill="var(--bg)" stroke="var(--line-strong)"/>`;
      h += `<path d="M${x + colW / 2 - 4} ${rowY + 21} L${x + colW / 2 + 6} ${rowY + 27} L${x + colW / 2 - 4} ${rowY + 33} Z" fill="var(--text)"/>`;
      h += `</g>`;
    }
    h += `<rect x="${L}" y="${T}" width="${c.n * colW}" height="${plotH}" fill="none" stroke="var(--line-strong)"/>`;
    h += `<text x="${L - 8}" y="${T + plotH + 14}" text-anchor="end">chip</text>`;
    h += `<text x="${L - 8}" y="${rowY + 3}" text-anchor="end">bit</text>`;
    h += `<text x="${L - 8}" y="${rowY + 31}" text-anchor="end">play</text>`;
    h += `<line data-fh-head x1="0" x2="0" y1="${T}" y2="${T + plotH}" stroke="var(--text)" stroke-width="2" opacity="0"/>`;
    svg.innerHTML = h;
    geo = { L, colW };
    if (cursor >= c.n) cursor = -1;
    showHead(cursor);
    save();
  }

  function showHead(i: number) {
    const ph = svg.querySelector('[data-fh-head]');
    if (!ph) return;
    const x = String(geo.L + i * geo.colW + geo.colW / 2);
    ph.setAttribute('x1', x);
    ph.setAttribute('x2', x);
    ph.setAttribute('opacity', i < 0 ? '0' : '0.85');
  }

  function readout(i: number) {
    const c = cfg();
    const p = hops[i], b = bits[i];
    r('chip').textContent = `${i} of ${c.n - 1}`;
    r('pair').textContent = `P${p}`;
    r('bit').textContent = `${b} (${b ? 'high' : 'low'} tone)`;
    r('f').textContent = `${toneHz(p, b).toFixed(0)} Hz`;
    r('pairf').textContent = `${toneHz(p, 0).toFixed(0)} / ${toneHz(p, 1).toFixed(0)}`;
    r('audio').textContent = fmtHz(audioHz(c.mode, p, b));
  }

  // ---- Audio. Nothing is created until someone presses a play button. ----
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let live: OscillatorNode[] = [];
  const level = () => Number(inVol.value) * (inPitch.value === 'true' ? 0.4 : 1);

  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) {
        status.textContent = 'This browser has no Web Audio support, so playback is off.';
        return null;
      }
      ctx = new AC();
      master = ctx.createGain();
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    master!.gain.value = level();
    return ctx;
  }

  function tone(ac: AudioContext, freq: number, start: number, dur: number) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    const a = Math.min(0.012, dur / 4), rel = Math.min(0.03, dur / 3);
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(1, start + a);
    g.gain.setValueAtTime(1, start + dur - rel);
    g.gain.linearRampToValueAtTime(0, start + dur);
    o.connect(g).connect(master!);
    o.start(start);
    o.stop(start + dur + 0.02);
    live.push(o);
    o.onended = () => (live = live.filter((x) => x !== o));
  }

  function stopAll() {
    live.forEach((o) => {
      try {
        o.stop();
      } catch {
        // Already stopped.
      }
    });
    live = [];
    cancelAnimationFrame(raf);
    raf = 0;
  }

  function playChip(i: number) {
    const ac = audio();
    if (!ac) return;
    stopAll();
    const c = cfg();
    tone(ac, audioHz(c.mode, hops[i], bits[i]), ac.currentTime + 0.02, Number(inSlow.value) / 1000);
    cursor = i;
    showHead(i);
    readout(i);
  }

  function playAll() {
    const ac = audio();
    if (!ac) return;
    stopAll();
    const c = cfg();
    const d = Number(inSlow.value) / 1000;
    const t0 = ac.currentTime + 0.05;
    for (let i = 0; i < c.n; i++) tone(ac, audioHz(c.mode, hops[i], bits[i]), t0 + i * d, d);
    status.textContent = `Playing ${c.n} chips.`;
    let last = -1;
    const tick = () => {
      const k = Math.floor((ac.currentTime - t0) / d);
      if (k >= c.n) {
        raf = 0;
        cursor = -1;
        showHead(-1);
        status.textContent = 'Done.';
        return;
      }
      if (k >= 0 && k !== last) {
        last = k;
        cursor = k;
        showHead(k);
        readout(k);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  function stop() {
    stopAll();
    cursor = -1;
    showHead(-1);
  }

  // ---- Events ----
  function act(target: Element) {
    const pc = target.closest<SVGGElement>('[data-p]');
    if (pc) return playChip(Number(pc.dataset.p));
    const g = target.closest<SVGGElement>('[data-i]');
    if (!g) return;
    const i = Number(g.dataset.i);
    bits[i] ^= 1;
    render();
    readout(i);
    status.textContent = `Chip ${i} is now ${bits[i]}, the ${bits[i] ? 'high' : 'low'} tone at ${toneHz(hops[i], bits[i]).toFixed(0)} Hz.`;
    svg.querySelector<SVGGElement>(`[data-i="${i}"]`)?.focus();
  }

  svg.addEventListener('click', (e) => act(e.target as Element));
  svg.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      act(e.target as Element);
    }
  });
  const peek = (e: Event) => {
    const g = (e.target as Element).closest<SVGGElement>('[data-i],[data-p]');
    if (g && !raf) readout(Number(g.dataset.i ?? g.dataset.p));
  };
  svg.addEventListener('mouseover', peek);
  svg.addEventListener('focusin', peek);

  const btn = (k: string, fn: () => void) => q<HTMLButtonElement>(panel, `[data-fh="${k}"]`).addEventListener('click', fn);
  btn('play', playAll);
  btn('stop', () => {
    stop();
    status.textContent = 'Stopped.';
  });
  btn('step', () => playChip((cursor + 1) % cfg().n));
  const setAll = (fn: () => number) => () => {
    bits = bits.map(fn);
    render();
    status.textContent = `Bits set to ${bits.join('')}.`;
  };
  btn('rand', setAll(() => (Math.random() < 0.5 ? 0 : 1)));
  btn('zeros', setAll(() => 0));
  btn('ones', setAll(() => 1));

  inSlow.addEventListener('input', () => {
    outSlow.value = `${inSlow.value} ms`;
    save();
  });
  inVol.addEventListener('input', () => {
    outVol.value = `${Math.round(Number(inVol.value) * 100)}%`;
    if (master) master.gain.value = level();
    save();
  });
  inBits.addEventListener('change', () => {
    const s = inBits.value.replace(/[^01]/g, '');
    if (s.length) {
      bits = s.slice(0, 48).split('').map(Number);
      inN.value = String(Math.max(2, bits.length));
    }
    render();
  });
  [inN, inSeed, inHop, inPitch].forEach((el) => el.addEventListener('input', render));
  inPitch.addEventListener('input', () => master && (master.gain.value = level()));
  document.addEventListener('visibilitychange', () => document.hidden && stop());

  function save() {
    store.set({
      n: inN.value,
      seed: inSeed.value,
      hop: inHop.value,
      pitch: inPitch.value,
      slow: inSlow.value,
      vol: inVol.value,
      bits: bits.join(''),
    });
  }

  // Boot with saved settings if there are any, else an example bit string.
  const saved = store.get();
  if (saved) {
    const set = (el: HTMLInputElement | HTMLSelectElement, v?: string) => v != null && (el.value = v);
    set(inN, saved.n);
    set(inSeed, saved.seed);
    set(inHop, saved.hop);
    if (saved.pitch && saved.pitch in pitchNotes) inPitch.value = saved.pitch;
    set(inSlow, saved.slow);
    set(inVol, saved.vol);
    if (saved.bits && /^[01]+$/.test(saved.bits)) bits = saved.bits.split('').map(Number);
  } else {
    bits = '1011001110100101'.split('').map(Number);
  }
  outSlow.value = `${inSlow.value} ms`;
  outVol.value = `${Math.round(Number(inVol.value) * 100)}%`;
  render();
  readout(0);

  return { hide: stop };
}
