// Runs the LED spectrum live version. Power on plays setup(): the boot scroll at the firmware's
// 80 ms per column, three passes, then the blank pause. After that loop() runs on the generated
// demo track, or on the microphone if asked. Everything is src/lib/led-firmware.ts, the same port
// the case study's demo uses.
import {
  createDemoTrack,
  createMatrix,
  createSpectrum,
  openMic,
  scrollSteps,
  FRAME_MS,
  FS,
  N,
  SCROLL_END_MS,
  SCROLL_LOOPS,
  SCROLL_STEP_MS,
  W,
} from '../../lib/led-firmware';
import { prefersReducedMotion } from '../preferences';

type Phase = 'off' | 'boot' | 'run';

export function mount(panel: HTMLElement) {
  const $ = <T extends Element>(s: string) => panel.querySelector<T>(s)!;
  const canvas = $<HTMLCanvasElement>('[data-ll-canvas]');
  const modeEl = $<HTMLElement>('[data-ll-mode]');
  const power = $<HTMLButtonElement>('[data-ll-power]');
  const play = $<HTMLButtonElement>('[data-ll-play]');
  const playLabel = $<HTMLElement>('[data-ll-play-label]');
  const micBtn = $<HTMLButtonElement>('[data-ll-mic]');
  const micLabel = $<HTMLElement>('[data-ll-mic-label]');
  const msg = $<HTMLElement>('[data-ll-msg]');
  const read = $<HTMLElement>('[data-ll-read]');

  const matrix = createMatrix(canvas);
  let sp = createSpectrum();
  let demoSample = createDemoTrack();
  let mic: Awaited<ReturnType<typeof openMic>> | null = null;

  let phase: Phase = 'off';
  let source: 'demo' | 'mic' | 'none' = 'none';
  let paused = false;
  let bootMs = 0; // time into setup()
  const bootTotal = scrollSteps() * SCROLL_LOOPS * SCROLL_STEP_MS + SCROLL_END_MS;
  let raf = 0;
  let last = 0;
  let acc = 0;
  let visible = true;
  let shownMode = '';

  const say = (t: string) => (msg.textContent = t);

  function setMode(mode: 'OFF' | 'BOOT' | 'IDLE' | 'SPECTRUM') {
    if (mode === shownMode) return;
    shownMode = mode;
    modeEl.textContent = mode;
    const what = { OFF: 'off', BOOT: 'showing its boot message', IDLE: 'showing the idle glow', SPECTRUM: 'showing the spectrum' }[mode];
    canvas.setAttribute('aria-label', `16 by 16 LED matrix, ${what}`);
  }

  function setUi() {
    const on = phase !== 'off';
    power.textContent = on ? 'Power off' : 'Power on';
    power.setAttribute('aria-pressed', String(on));
    play.disabled = !on;
    micBtn.disabled = !on;
    const playing = phase === 'run' && source === 'demo' && !paused;
    play.setAttribute('aria-pressed', String(playing));
    playLabel.textContent = playing ? 'Pause' : 'Play demo track';
    micBtn.setAttribute('aria-pressed', String(source === 'mic'));
    micLabel.textContent = source === 'mic' ? 'Stop mic' : 'Try my mic';
  }

  function readout() {
    const s = sp.s;
    read.textContent = `Level ${s.ampSmoothed.toFixed(1)} · enter above ${s.enterThreshold.toFixed(1)} · exit below ${s.exitThreshold.toFixed(1)}`;
  }

  function paint(now: number) {
    if (phase === 'off') {
      matrix.dark();
      setMode('OFF');
    } else if (phase === 'boot') {
      const step = Math.floor(bootMs / SCROLL_STEP_MS);
      if (step < scrollSteps() * SCROLL_LOOPS) matrix.scroll(step);
      else matrix.dark(); // the blank 150 ms at the end of scrollMessage()
      setMode('BOOT');
    } else {
      matrix.render(sp, now, !paused);
      setMode(sp.s.spectrumMode ? 'SPECTRUM' : 'IDLE');
      readout();
    }
  }

  function frame(now: number) {
    const dt = Math.min(200, now - last);
    last = now;
    if (phase === 'boot') {
      bootMs += dt;
      if (bootMs >= bootTotal) startRun();
    } else if (phase === 'run' && !paused) {
      acc += dt;
      while (acc >= FRAME_MS) {
        sp.s.clock += FRAME_MS;
        if (source === 'mic' && mic) mic.read(sp.s.re, sp.s.im);
        else
          for (let i = 0; i < N; i++) {
            sp.s.re[i] = demoSample(sp.s.clock + (i * 1000) / FS);
            sp.s.im[i] = 0;
          }
        sp.step();
        acc -= FRAME_MS;
      }
    }
    paint(now);
    raf = requestAnimationFrame(frame);
  }

  // Animate only while something is happening and the panel is on screen. With reduced motion the
  // boot scroll never animates and the track starts paused, so the matrix moves only after Play.
  function run() {
    cancelAnimationFrame(raf);
    const going = phase === 'boot' ? !prefersReducedMotion() : phase === 'run' && !paused;
    if (going && visible && !document.hidden) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    } else paint(performance.now());
  }

  // What setup() does once the scroll ends: restart the baseline timing, then loop() on the track.
  function startRun() {
    phase = 'run';
    sp.reset();
    acc = 0;
    if (source === 'none') source = 'demo';
    paused = prefersReducedMotion();
    say(
      paused
        ? 'Booted. Reduced motion is on, so the matrix holds still. Press Play demo track to run it.'
        : 'Booted. Playing the generated demo track. It opens with 3 seconds of quiet while the board learns the room.',
    );
    setUi();
  }

  function stopMic() {
    mic?.close();
    mic = null;
  }

  function powerOff() {
    stopMic();
    phase = 'off';
    source = 'none';
    paused = false;
    sp = createSpectrum();
    demoSample = createDemoTrack();
    say('The board is off.');
    setUi();
    run();
  }

  power.addEventListener('click', () => {
    if (phase !== 'off') return powerOff();
    phase = 'boot';
    bootMs = 0;
    if (prefersReducedMotion()) {
      // One still frame of the scroll, with the whole first letter on the matrix, then straight on.
      bootMs = W * SCROLL_STEP_MS;
      paint(performance.now());
      say('Powered on. With reduced motion the boot scroll shows as one still frame.');
      setUi();
      window.setTimeout(() => phase === 'boot' && (startRun(), run()), 1500);
      return;
    }
    say('Powered on. The boot scroll runs three times, then the spectrum starts.');
    setUi();
    run();
  });

  play.addEventListener('click', () => {
    if (phase === 'boot') {
      startRun(); // skip the rest of the scroll
      paused = false;
    } else if (source === 'mic') {
      stopMic();
      source = 'demo';
      sp.reset();
      paused = false;
    } else paused = !paused;
    say(paused ? 'Paused.' : 'Playing the generated demo track.');
    setUi();
    run();
  });

  micBtn.addEventListener('click', async () => {
    if (source === 'mic') {
      stopMic();
      source = 'demo';
      paused = true;
      say('Microphone off. Press Play demo track to go back to the track.');
      setUi();
      run();
      return;
    }
    try {
      mic = await openMic();
      if (phase === 'boot') startRun();
      source = 'mic';
      paused = false;
      sp.reset();
      say('Listening. Stay quiet for a couple of seconds so it learns the room, then play some music.');
      setUi();
      run();
    } catch {
      say("I couldn't get microphone access. The demo track works without it.");
    }
  });

  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    run();
  });
  io.observe(panel);
  document.addEventListener('visibilitychange', run);
  addEventListener('motionchange', run);
  setUi();
  run();

  return () => {
    cancelAnimationFrame(raf);
    stopMic();
    io.disconnect();
    document.removeEventListener('visibilitychange', run);
    removeEventListener('motionchange', run);
  };
}
