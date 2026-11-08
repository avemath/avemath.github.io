// "Hear it": plays the FH-BFSK preamble from src/lib/preamble.ts, ten times slower, through Web
// Audio, only when pressed. The AudioContext is made on the first press and resumed before anything
// is scheduled. Some systems report "running" before the output device has started and then jump
// the clock forward, which used to skip the first chips, so playback waits until the clock is
// visibly ticking, then schedules every chip from one start time. A press while it plays starts
// over from chip 0. The button's --p custom property tracks progress for the bar under it.
import { CHIPS, CHIP_MS, LISTEN_STRETCH, preamble, synthesize } from '../lib/preamble';

export function mountHearIt(btn: HTMLButtonElement) {
  const label = btn.querySelector<HTMLElement>('[data-hear-label]');
  const idleText = label?.textContent ?? 'Hear it';
  const live = document.querySelector<HTMLElement>('[data-hear-live]');
  const chips = preamble();
  const chipS = (CHIP_MS * LISTEN_STRETCH) / 1000;
  let audio: AudioContext | null = null;
  let sources: AudioBufferSourceNode[] = [];
  let raf = 0;
  let run = 0;
  const setLabel = (t: string) => label && (label.textContent = t);

  const stop = () => {
    run++;
    for (const s of sources) {
      try {
        s.stop();
      } catch {
        // Not started yet, or already finished.
      }
    }
    sources = [];
    cancelAnimationFrame(raf);
    btn.style.setProperty('--p', '0');
    btn.setAttribute('aria-pressed', 'false');
    btn.disabled = false;
    setLabel(idleText);
  };

  // Resolves once currentTime has advanced on two polls in a row, or after 3 s regardless.
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

  btn.addEventListener('click', async () => {
    if (sources.length) stop();
    const mine = ++run;
    btn.disabled = true;
    setLabel('Starting');
    audio ??= new AudioContext();
    const ctx = audio;
    // A browser with no audio output may never finish resuming; give it 3 s, then say so.
    const resumed = await Promise.race([ctx.resume().then(() => true), new Promise<false>((r) => setTimeout(() => r(false), 3000))]);
    if (mine !== run) return;
    if (!resumed) {
      btn.disabled = false;
      setLabel('No sound output');
      setTimeout(() => mine === run && setLabel(idleText), 2500);
      return;
    }
    await clockRunning(ctx);
    if (mine !== run) return;

    const t0 = ctx.currentTime + 0.05;
    sources = chips.map((chip, i) => {
      const data = synthesize([chip], ctx.sampleRate);
      const buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
      buf.copyToChannel(data, 0);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(t0 + i * chipS);
      return src;
    });
    sources[sources.length - 1].onended = () => mine === run && stop();
    btn.disabled = false;
    btn.setAttribute('aria-pressed', 'true');
    setLabel('Restart');
    if (live) live.textContent = 'Playing the preamble.';
    const tick = () => {
      const t = ctx.currentTime - t0;
      btn.style.setProperty('--p', String(Math.min(1, Math.max(0, t / (chipS * CHIPS)))));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
  document.addEventListener('visibilitychange', () => document.hidden && sources.length && stop());
}
