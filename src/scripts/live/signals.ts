// Runs the Signals live tile: eight chips of the FH-BFSK visualizer, from src/lib/fhbfsk.ts with
// the full demo's defaults (seed 87, the first 8 of its example bits, 260 ms chips, the
// exaggerated pitch mapping). Nothing makes a sound until Play is pressed.
import { audioHz, hopSequence, toneHz, DF, F_HIGH, F_LOW, PAIRS } from '../../lib/fhbfsk';

const N = 8;
const CHIP_S = 0.26;
const GAIN = 0.35;

export function mount(panel: HTMLElement) {
  const $ = <T extends Element>(s: string) => panel.querySelector<T>(s)!;
  const svg = $<SVGSVGElement>('[data-sl-plot]');
  const read = $<HTMLElement>('[data-sl-read]');
  let seed = 87;
  let bits = '10110011'.split('').map(Number);
  let hops = hopSequence(N, seed);
  let head = -1;

  const L = 30, T = 14, plotH = 150, colW = (320 - L - 26) / N;
  const y = (f: number) => T + ((F_HIGH - f) / (F_HIGH - F_LOW)) * plotH;
  const say = (i: number) =>
    (read.textContent = `Chip ${i}: pair P${hops[i]}, bit ${bits[i]}, ${toneHz(hops[i], bits[i]).toFixed(0)} Hz (${bits[i] ? 'high' : 'low'} tone)`);

  function render() {
    let h = '';
    for (let p = 0; p < PAIRS; p++) {
      const yt = y(F_LOW + (2 * p + 2) * DF), yb = y(F_LOW + 2 * p * DF);
      h += `<rect x="${L}" y="${yt}" width="${N * colW}" height="${yb - yt}" fill="${p % 2 ? 'var(--surface-2)' : 'var(--bg)'}"/>`;
    }
    for (const f of [10000, 11000, 12000, 13000]) h += `<text x="${L - 4}" y="${y(f) + 3}" text-anchor="end">${(f / 1000).toFixed(0)}k</text>`;
    const pts = hops.map((p, i) => `${L + i * colW + colW / 2},${y(toneHz(p, bits[i]))}`).join(' ');
    h += `<polyline points="${pts}" fill="none" stroke="var(--muted)" stroke-width="1" stroke-dasharray="3 3"/>`;
    for (let i = 0; i < N; i++) {
      const p = hops[i], b = bits[i], x = L + i * colW;
      const yTop = y(F_LOW + (2 * p + 2) * DF), yBot = y(F_LOW + 2 * p * DF);
      const on = y(toneHz(p, b)), off = y(toneHz(p, b ^ 1));
      const col = b ? 'var(--amber-ink)' : 'var(--accent)';
      h += `<g class="sl-col" data-i="${i}" tabindex="0" role="button" aria-label="Chip ${i}, pair ${p}, bit ${b}. Press to flip.">`;
      h += `<rect class="sl-bg" x="${x}" y="${T}" width="${colW}" height="${plotH + 40}" fill="transparent" rx="3"/>`;
      h += `<rect x="${x + 3}" y="${yTop}" width="${colW - 6}" height="${yBot - yTop}" fill="var(--accent-wash-strong)" rx="2"/>`;
      h += `<rect x="${x + colW / 2 - 3}" y="${off - 3}" width="6" height="6" fill="var(--surface)" stroke="var(--muted)"/>`;
      h += `<rect x="${x + colW / 2 - 6}" y="${on - 6}" width="12" height="12" fill="${col}" stroke="var(--text)"/>`;
      h += `<rect x="${x + 6}" y="${T + plotH + 10}" width="${colW - 12}" height="18" rx="4" fill="${col}"/>`;
      h += `<text x="${x + colW / 2}" y="${T + plotH + 22}" text-anchor="middle" style="fill:var(--surface);font-weight:600;font-size:10px">${b}</text>`;
      h += `</g>`;
    }
    h += `<rect x="${L}" y="${T}" width="${N * colW}" height="${plotH}" fill="none" stroke="var(--line-strong)"/>`;
    h += `<text x="${L - 4}" y="${T + plotH + 22}" text-anchor="end">bit</text>`;
    const hx = L + head * colW + colW / 2;
    h += `<line x1="${hx}" x2="${hx}" y1="${T}" y2="${T + plotH}" stroke="var(--text)" stroke-width="2" opacity="${head < 0 ? 0 : 0.85}"/>`;
    svg.innerHTML = h;
  }

  function flip(target: Element) {
    const g = target.closest<SVGGElement>('[data-i]');
    if (!g) return;
    const i = Number(g.dataset.i);
    bits[i] ^= 1;
    render();
    say(i);
    svg.querySelector<SVGGElement>(`[data-i="${i}"]`)?.focus();
  }
  svg.addEventListener('click', (e) => flip(e.target as Element));
  svg.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      flip(e.target as Element);
    }
  });
  svg.addEventListener('focusin', (e) => {
    const g = (e.target as Element).closest<SVGGElement>('[data-i]');
    if (g) say(Number(g.dataset.i));
  });

  // ---- Audio, the demo's tone envelope. Nothing is created until Play. ----
  let ctx: AudioContext | null = null;
  let live: OscillatorNode[] = [];
  let raf = 0;
  function stop() {
    live.forEach((o) => {
      try {
        o.stop();
      } catch {
        // Already stopped.
      }
    });
    live = [];
    cancelAnimationFrame(raf);
    head = -1;
    render();
  }
  function play() {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    stop();
    const ac = ctx;
    const master = ac.createGain();
    master.gain.value = GAIN;
    master.connect(ac.destination);
    const t0 = ac.currentTime + 0.05;
    for (let i = 0; i < N; i++) {
      const o = ac.createOscillator();
      const g = ac.createGain();
      const start = t0 + i * CHIP_S;
      o.frequency.value = audioHz('exag', hops[i], bits[i]);
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(1, start + 0.012);
      g.gain.setValueAtTime(1, start + CHIP_S - 0.03);
      g.gain.linearRampToValueAtTime(0, start + CHIP_S);
      o.connect(g).connect(master);
      o.start(start);
      o.stop(start + CHIP_S + 0.02);
      live.push(o);
    }
    let last = -1;
    const tick = () => {
      const k = Math.floor((ac.currentTime - t0) / CHIP_S);
      if (k >= N) {
        head = -1;
        render();
        read.textContent = 'Done.';
        return;
      }
      if (k >= 0 && k !== last) {
        last = head = k;
        render();
        say(k);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  $('[data-sl-play]').addEventListener('click', play);
  $('[data-sl-stop]').addEventListener('click', () => {
    stop();
    read.textContent = 'Stopped.';
  });
  $('[data-sl-hop]').addEventListener('click', () => {
    hops = hopSequence(N, ++seed);
    render();
    read.textContent = `New hop pattern, seed ${seed}.`;
  });
  const hidden = () => document.hidden && stop();
  document.addEventListener('visibilitychange', hidden);

  render();
  say(0);
  return () => {
    stop();
    document.removeEventListener('visibilitychange', hidden);
    ctx?.close();
  };
}
