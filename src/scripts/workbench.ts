// The /work/ workbench (src/components/work/Workbench.astro).
//   - Selecting an object (click, tap, Enter, Space) shows its detail under the bench, marks it
//     pressed, says so politely, and puts its slug in the address; /work/#<slug> opens it on load.
//   - Arrow keys move focus between objects in reading order (the order they are in the drawing).
//   - Pointing at, focusing or choosing a client-site print shows that site on the laptop.
//   - Other parts of the page (the thread map) select through a "bench:select" event.
//   - One requestAnimationFrame loop for all of the bench's motion, running only while the bench is
//     on screen, the tab is visible and motion is welcome. With reduced motion the bench stays the
//     still drawing it was built as: the LED panel at its frame, every box ticked.
import { prefersReducedMotion } from './preferences';
import { createSpectrum, createDemoTrack, N, FS, FRAME_MS, W, H } from '../lib/led-firmware';

export function mountWorkbench() {
  const svg = document.querySelector<SVGSVGElement>('[data-bench]');
  if (!svg) return;
  const objs = [...svg.querySelectorAll<SVGGElement>('.obj[data-bench]')];
  const details = [...document.querySelectorAll<HTMLElement>('[data-detail]')];
  const detailBox = document.querySelector<HTMLElement>('[data-bench-detail]')!;
  const live = document.querySelector<HTMLElement>('[data-bench-live]')!;
  const shelf = document.querySelector<HTMLElement>('[data-bench-shelf]')!;
  const slugs = new Set(objs.map((o) => o.dataset.bench!));
  const titleOf = (slug: string) => document.getElementById(`bd-${slug}`)?.textContent?.trim() ?? slug;

  // ---- The laptop's screen ----
  const screens = [...svg.querySelectorAll<SVGImageElement>('[data-screen]')];
  const showSite = (slug: string) => {
    if (!screens.some((s) => s.dataset.screen === slug)) return;
    screens.forEach((s) => s.classList.toggle('is-on', s.dataset.screen === slug));
  };

  // ---- Selection ----
  let current = objs.find((o) => o.classList.contains('is-sel'))?.dataset.bench ?? objs[0]?.dataset.bench;
  const select = (slug: string, opts: { hash?: boolean; scroll?: boolean; say?: boolean } = {}) => {
    if (!slugs.has(slug)) return;
    current = slug;
    objs.forEach((o) => {
      const on = o.dataset.bench === slug;
      o.classList.toggle('is-sel', on);
      o.setAttribute('aria-pressed', String(on));
    });
    details.forEach((d) => (d.hidden = d.dataset.detail !== slug));
    showSite(slug);
    if (opts.say !== false) live.textContent = `Showing ${titleOf(slug)} below the bench.`;
    if (opts.hash) history.replaceState(null, '', `#${slug}`);
    if (opts.scroll) detailBox.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };

  objs.forEach((o, i) => {
    const slug = o.dataset.bench!;
    o.addEventListener('click', () => select(slug, { hash: true }));
    o.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        select(slug, { hash: true });
        return;
      }
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (step === undefined && e.key !== 'Home' && e.key !== 'End') return;
      e.preventDefault();
      const to = e.key === 'Home' ? 0 : e.key === 'End' ? objs.length - 1 : (i + step! + objs.length) % objs.length;
      objs[to].focus();
      // On a phone the shelf follows focus.
      objs[to].scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    o.addEventListener('pointerenter', () => showSite(slug));
    o.addEventListener('focus', () => showSite(slug));
  });

  // The thread map (and anything else) can ask for a project.
  addEventListener('bench:select', ((e: CustomEvent<string>) => select(e.detail, { hash: true, scroll: true })) as EventListener);

  // /work/#<slug> opens that project and brings its detail into view.
  const fromHash = () => {
    const slug = decodeURIComponent(location.hash.slice(1));
    if (slugs.has(slug)) {
      select(slug, { say: false });
      requestAnimationFrame(() => detailBox.scrollIntoView({ block: 'start' }));
    }
  };
  fromHash();
  addEventListener('hashchange', fromHash);

  // ---- Motion ----
  const led = [...svg.querySelectorAll<SVGCircleElement>('[data-led] circle')];
  const chips = [...svg.querySelectorAll<SVGRectElement>('[data-chips] rect')];
  const arcs = [...svg.querySelectorAll<SVGPathElement>('[data-arcs] path')];
  const tank = [...svg.querySelectorAll<SVGCircleElement>('[data-tank] circle')];
  const pool = [...svg.querySelectorAll<SVGCircleElement>('[data-pool] circle')];
  const ticks = [...svg.querySelectorAll<SVGPathElement>('[data-ticks] path')];
  const rays = [...svg.querySelectorAll<SVGPathElement>('[data-rays] path')];
  const pk = svg.querySelector<SVGCircleElement>('[data-pk]');
  const pts: number[][] = pk ? JSON.parse(pk.dataset.pts!) : [];

  // The LED panel runs the firmware model on its demo track, as the site's LED demo does.
  const sp = createSpectrum();
  const track = createDemoTrack();
  const ledCell = (c: number, r: number) => led[c * H + r];
  const ledClass = led.map((l) => l.getAttribute('class') ?? '');
  const litClass = (r: number) => {
    const t = (r + 1) / H;
    return t < 0.35 ? 'led-t' : t < 0.6 ? 'led-l' : 'led-r';
  };
  let acc = 0;
  const stepLed = (dt: number) => {
    acc += dt;
    let fed = false;
    while (acc >= FRAME_MS) {
      const s = sp.s;
      s.clock += FRAME_MS;
      for (let i = 0; i < N; i++) {
        s.re[i] = track(s.clock + (i * 1000) / FS);
        s.im[i] = 0;
      }
      sp.step();
      acc -= FRAME_MS;
      fed = true;
    }
    if (!fed) return;
    const s = sp.s;
    for (let c = 0; c < W; c++) {
      for (let r = 0; r < H; r++) {
        const want = s.spectrumMode && r < s.bandValues[c] ? litClass(r) : s.spectrumMode && s.peakValues[c] > 0 && r === Math.min(H - 1, s.peakValues[c]) ? 'led-pk' : 'led-off';
        const k = c * H + r;
        if (ledClass[k] !== want) {
          ledClass[k] = want;
          ledCell(c, r)?.setAttribute('class', want);
        }
      }
    }
  };

  // Start where the still frame was drawn (the build picked its moment in the demo track).
  const startMs = Number(svg.querySelector<SVGGElement>('[data-led]')?.dataset.startMs ?? 4000);
  if (led.length) stepLed(startMs);

  let raf = 0;
  let last = 0;
  let onScreen = false;
  let frames = 0;
  const pos = (k: number) => {
    const n = pts.length;
    const path = [0, 1, 2, 3, 6, 5, 4, 0].filter((i) => i < n);
    const f = k * (path.length - 1);
    const i = Math.min(path.length - 2, Math.floor(f));
    const a = pts[path[i]];
    const b = pts[path[i + 1]];
    const t = f - i;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  };
  const frame = (now: number) => {
    raf = 0;
    if (!onScreen || document.hidden || prefersReducedMotion()) return;
    const dt = last ? Math.min(100, now - last) : 16;
    last = now;
    const s = now / 1000;
    frames++;
    stepLed(dt);
    // The scope: the hop pattern's chips light one at a time, left to right, then start over.
    const col = Math.floor(s * 3) % (chips.length + 2);
    chips.forEach((c, i) => {
      c.classList.toggle('is-on', i <= col);
      c.classList.toggle('is-now', i === col);
    });
    arcs.forEach((p, i) => p.setAttribute('stroke-dashoffset', (-s * 30 + i * 4).toFixed(1)));
    tank.forEach((c, i) => {
      const k = (s * 0.6 + i / 3) % 1;
      c.setAttribute('r', (10 + k * 70).toFixed(1));
      c.style.opacity = (1 - k).toFixed(2);
    });
    pool.forEach((c, i) => {
      const k = (s * 0.5 + i / 2) % 1;
      c.setAttribute('r', (4 + k * 26).toFixed(1));
      c.style.opacity = (1 - k).toFixed(2);
    });
    const n = Math.floor(s * 1.2) % (ticks.length + 2);
    ticks.forEach((p, i) => p.classList.toggle('is-on', i < n));
    rays.forEach((p, i) => {
      p.style.strokeDasharray = '100';
      p.style.strokeDashoffset = (100 - ((s * 30 + i * 8) % 160)).toFixed(0);
    });
    if (pk && pts.length > 1) {
      const [x, y] = pos((s * 0.5) % 1);
      pk.setAttribute('cx', x.toFixed(1));
      pk.setAttribute('cy', y.toFixed(1));
    }
    raf = requestAnimationFrame(frame);
  };
  const still = () => {
    // Back to the drawing as built: every chip and box on, rays whole, ripples at rest.
    chips.forEach((c) => (c.classList.add('is-on'), c.classList.remove('is-now')));
    ticks.forEach((p) => p.classList.add('is-on'));
    rays.forEach((p) => (p.style.strokeDasharray = '', p.style.strokeDashoffset = ''));
    tank.forEach((c, i) => (c.setAttribute('r', String(20 + i * 18)), (c.style.opacity = String(0.6 - i * 0.18))));
    pool.forEach((c, i) => (c.setAttribute('r', String(10 + i * 10)), (c.style.opacity = String(0.6 - i * 0.25))));
  };
  const kick = () => {
    if (raf || !onScreen || document.hidden || prefersReducedMotion()) return;
    last = 0;
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };
  new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    if (onScreen) kick();
    else stop();
  }).observe(svg);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : kick()));
  addEventListener('motionchange', () => {
    if (prefersReducedMotion()) {
      stop();
      still();
    } else kick();
  });
  still();

  // For the tests: whether the loop is running, and how many frames it has drawn.
  (window as Window & { __bench?: unknown }).__bench = { running: () => raf !== 0, frames: () => frames, current: () => current, shelf };
}
