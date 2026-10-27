// Constellation with noise. The symbols and the noise are drawn once from a seed, then only
// scaled by the slider, so the cloud grows and shrinks instead of flickering.
import { constellation, dbToLin, gaussian, mulberry32, nearest, schemes, sigmaFor, type Scheme } from '../../../lib/comms';
import { q, token } from './util';

const N = 800;

export function init(panel: HTMLElement) {
  const canvas = q<HTMLCanvasElement>(panel, '[data-const-canvas]');
  const ctx = canvas.getContext('2d')!;
  const inSnr = q<HTMLInputElement>(panel, '[data-const-in="snr"]');
  const outSnr = q<HTMLOutputElement>(panel, '[data-const-out="snr"]');
  const radios = [...panel.querySelectorAll<HTMLInputElement>('[data-const-scheme]')];
  const s = (k: string) => q<HTMLElement>(panel, `[data-const-s="${k}"]`);
  const status = q<HTMLElement>(panel, '[data-const-status]');

  let seed = 2026;
  let u: Float64Array;
  let noise: Float64Array;

  function draw() {
    const rand = mulberry32(seed);
    const g = gaussian(rand);
    u = Float64Array.from({ length: N }, rand);
    noise = Float64Array.from({ length: 2 * N }, g);
  }

  function run() {
    const scheme = (radios.find((r) => r.checked)?.value ?? 'qpsk') as Scheme;
    const pts = constellation(scheme);
    const db = Number(inSnr.value);
    const sigma = sigmaFor(dbToLin(db));
    outSnr.value = `${db.toFixed(1)} dB`;

    const w = canvas.width, h = canvas.height;
    const sc = w / 4.2;
    const cx = w / 2, cy = h / 2;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = token('--line-strong');
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, h);
    ctx.stroke();
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.arc(cx, cy, sc, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    const ok = token('--accent');
    const bad = token('--danger');
    let errors = 0;
    ctx.globalAlpha = 0.7;
    for (let n = 0; n < N; n++) {
      const sent = Math.floor(u[n] * pts.length);
      const x = pts[sent][0] + sigma * noise[2 * n];
      const y = pts[sent][1] + sigma * noise[2 * n + 1];
      const wrong = nearest(pts, x, y) !== sent;
      if (wrong) errors++;
      ctx.fillStyle = wrong ? bad : ok;
      ctx.beginPath();
      ctx.arc(cx + x * sc, cy - y * sc, wrong ? 3.2 : 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Ideal points with their bit labels.
    const k = schemes[scheme].bits;
    ctx.strokeStyle = token('--text');
    ctx.fillStyle = token('--text');
    ctx.lineWidth = 1.5;
    ctx.font = `12px ${token('--font-mono')}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const halo = token('--bg');
    pts.forEach(([x, y], label) => {
      ctx.beginPath();
      ctx.arc(cx + x * sc, cy - y * sc, 6, 0, Math.PI * 2);
      ctx.stroke();
      if (k === 1) return;
      // PSK labels sit outside the ring along the radius. QAM points are packed too tight for
      // that, so their labels sit just above each point. Either way a halo keeps them readable.
      const r = Math.hypot(x, y);
      const push = scheme === '16qam' ? 1 : (r + 0.42) / r;
      const tx = cx + x * push * sc, ty = cy - y * push * sc - (scheme === '16qam' ? 16 : 0);
      const text = label.toString(2).padStart(k, '0');
      ctx.strokeStyle = halo;
      ctx.lineWidth = 4;
      ctx.strokeText(text, tx, ty);
      ctx.fillText(text, tx, ty);
      ctx.strokeStyle = token('--text');
      ctx.lineWidth = 1.5;
    });

    s('sigma').textContent = sigma.toFixed(3);
    s('bits').textContent = String(k);
    s('ser').textContent = `${errors} of ${N} (${((errors / N) * 100).toFixed(1)}%)`;
    status.textContent = `${schemes[scheme].label} at ${db.toFixed(1)} dB: ${errors} of ${N} symbols decided wrong.`;
  }

  const rerun = () => requestAnimationFrame(run);
  inSnr.addEventListener('input', rerun);
  radios.forEach((r) => r.addEventListener('change', rerun));
  q(panel, '[data-const="new"]').addEventListener('click', () => {
    seed = (seed * 48271) % 2147483647;
    draw();
    run();
  });
  window.addEventListener('themechange', () => !panel.hidden && run());

  draw();
  return { show: run };
}
