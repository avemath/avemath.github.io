// The RAMpage weapon and safety firmware (pico_direct.py), ported line for line to run in the
// browser on a virtual clock. The case study's simulator and the home page tile both run this
// module, so they behave exactly alike. No DOM here: the caller reads the state and draws it.

// ---- Constants from pico_direct.py ----
export const SWITCH_ON_THRESHOLD = 1700;
export const SIGNAL_TIMEOUT = 1000;
export const STARTUP_DELAY = 3000;
export const KILL_SWITCH_DEBOUNCE = 300;
export const MAX_WEAPON_ACTIVATIONS = 17;
export const WEAPON_COOLDOWN = 500;
export const SOLENOID_ACTIVATION_TIME = 400;
export const SOLENOID_SEQUENCE_DELAY = 50;
export const LOOP_MS = 20;

export type LogKind = 'info' | 'warn' | 'bad' | 'ok';
type Cause = 'none' | 'kill_switch' | 'signal_loss' | 'startup';

export function createFirmware(log: (text: string, kind: LogKind, t: number) => void = () => {}) {
  // Transmitter inputs.
  const tx = { kill: false, trigger: false, power: true };

  // Firmware globals.
  let t = 0; // virtual ms since boot
  let ch5 = 0, ch6 = 0, ch5Last = -1e9, ch6Last = -1e9;
  let startupTime = 0;
  let estop = false;
  let cause: Cause = 'none';
  let killLastChange = 0;
  let signalLossTime = 0;
  let activations = 0;
  let cooldownEnd = 0;
  let depleted = false;
  let plowActive = false;
  let triggerLast = false;
  let mainOpen = true;
  let pistonOpen = false;
  let led = false;
  let phase: 'boot' | 'startup' | 'run' = 'boot';
  let busyUntil = 0; // the firmware blocks in sleep_ms while firing or blinking
  let queue: { at: number; fn: () => void }[] = [];

  const say = (text: string, kind: LogKind = 'info') => log(text, kind, t);

  // The receiver sends a pulse every ~20 ms while the transmitter is on.
  function receive() {
    if (!tx.power) return;
    ch5 = tx.kill ? 2000 : 1000;
    ch6 = tx.trigger ? 2000 : 1000;
    ch5Last = ch6Last = t;
  }

  function readSwitch(width: number, last: number): [boolean, boolean] {
    if (t - last > SIGNAL_TIMEOUT) {
      if (t - startupTime < STARTUP_DELAY) return [false, false];
      return [false, true];
    }
    return [width > SWITCH_ON_THRESHOLD, false];
  }

  function schedule(after: number, fn: () => void) {
    queue.push({ at: t + after, fn });
  }

  function activateWeapon() {
    if (estop || t < cooldownEnd || depleted) return;
    activations++;
    say(`Activating weapon (${activations}/${MAX_WEAPON_ACTIVATIONS})`, 'warn');
    cooldownEnd = t + WEAPON_COOLDOWN;
    if (activations >= MAX_WEAPON_ACTIVATIONS) {
      depleted = true;
      say('WARNING: Weapon system depleted', 'bad');
    }
    plowActive = true;
    led = true;
    // Same blocking sequence as the firmware, replayed on the virtual clock.
    mainOpen = true;
    schedule(SOLENOID_SEQUENCE_DELAY, () => (mainOpen = false));
    schedule(SOLENOID_SEQUENCE_DELAY * 2, () => (pistonOpen = true));
    schedule(SOLENOID_SEQUENCE_DELAY * 2 + SOLENOID_ACTIVATION_TIME, () => {
      pistonOpen = false;
      mainOpen = true;
      plowActive = false;
      led = false;
    });
    busyUntil = t + SOLENOID_SEQUENCE_DELAY * 2 + SOLENOID_ACTIVATION_TIME;
  }

  function triggerEstop(c: Cause) {
    if (estop) return;
    say(`EMERGENCY STOP ACTIVATED: ${c}`, 'bad');
    estop = true;
    cause = c;
    killLastChange = t;
    mainOpen = true;
    pistonOpen = false;
    busyUntil = t + 1000; // ten 100 ms blinks
  }

  function canReset() {
    const [killOn, killLost] = readSwitch(ch5, ch5Last);
    if (cause === 'signal_loss') {
      const [, trigLost] = readSwitch(ch6, ch6Last);
      return !(killLost || trigLost) && t - signalLossTime > 1000;
    }
    return !killOn && !killLost && t - killLastChange > KILL_SWITCH_DEBOUNCE;
  }

  function reboot() {
    t = 0;
    ch5 = ch6 = 0;
    ch5Last = ch6Last = -1e9;
    estop = false;
    cause = 'none';
    activations = 0;
    cooldownEnd = 0;
    depleted = false;
    plowActive = false;
    triggerLast = false;
    mainOpen = true;
    pistonOpen = false;
    queue = [];
    phase = 'boot';
    startupTime = 0;
    killLastChange = 0;
    signalLossTime = 0;
    say('===== RAMpage Combat Robot - Main Pico Code =====');
    say('Solenoids initialized on pins 14 and 15');
    say('RC receiver interrupts configured for kill switch (GP18) and weapon trigger (GP19)');
    say('===== STARTING WEAPON CONTROL SYSTEM =====');
    say('Waiting for RC signals to stabilize...');
    busyUntil = 1200; // three 400 ms blinks
  }

  function tick() {
    receive();
    // Run anything the blocking sequence scheduled.
    queue = queue.filter((q) => (q.at <= t ? (q.fn(), false) : true));
    if (t < busyUntil) {
      if (phase === 'boot') led = Math.floor(t / 200) % 2 === 0;
      else if (estop && cause !== 'none' && !plowActive) led = Math.floor(t / 50) % 2 === 0;
      return;
    }

    if (phase === 'boot') {
      phase = 'startup';
      startupTime = t;
      killLastChange = t;
      signalLossTime = t;
    }

    if (phase === 'startup') {
      led = t % 500 < 250;
      const [killOn] = readSwitch(ch5, ch5Last);
      if (killOn) {
        say('Kill switch is ON during startup - must turn OFF to operate', 'bad');
        triggerEstop('startup');
        finishStartup();
        return;
      }
      if (t - startupTime >= STARTUP_DELAY) finishStartup();
      return;
    }

    const [killOn, killLost] = readSwitch(ch5, ch5Last);
    const [trigOn, trigLost] = readSwitch(ch6, ch6Last);

    if (killOn && !estop) {
      say('Kill switch activated', 'bad');
      triggerEstop('kill_switch');
      return;
    }
    if ((killLost || trigLost) && !estop) {
      say('Signal lost - emergency stop', 'bad');
      signalLossTime = t;
      triggerEstop('signal_loss');
      return;
    }
    if (estop && canReset()) {
      say(`Emergency stop reset (${cause === 'signal_loss' ? 'signal restored' : cause === 'kill_switch' ? 'kill switch now OFF' : 'generic'})`, 'ok');
      estop = false;
      cause = 'none';
      busyUntil = t + 800; // two 400 ms blinks
      say('Emergency stop reset - system ready', 'ok');
      return;
    }
    if (estop) {
      led = t % 500 < 250;
      return;
    }

    if (trigOn && !triggerLast && !plowActive && !depleted) activateWeapon();
    triggerLast = trigOn;

    if (!plowActive) {
      const m = t % 1000;
      if (depleted) led = m < 100 || (m > 200 && m < 300);
      else led = t % 2000 < 500;
    }
  }

  function finishStartup() {
    phase = 'run';
    say('System initialized');
    say(`Maximum weapon activations: ${MAX_WEAPON_ACTIVATIONS}`);
    say('To RESET emergency stop: Simply turn the kill switch OFF');
  }

  /** Advance the firmware loop by one 20 ms step of the virtual clock. */
  function step() {
    t += LOOP_MS;
    tick();
  }

  /** What the status display reads, and its tone. */
  function stateLabel(): [string, string] {
    if (phase !== 'run') return ['Starting up', ''];
    if (estop) {
      const why = { kill_switch: 'kill switch', signal_loss: 'signal lost', startup: 'startup interlock', none: '' }[cause];
      return [`E-stop: ${why}`, 'bad'];
    }
    if (plowActive) return ['Firing', 'warn'];
    if (depleted) return ['Out of air', 'bad'];
    if (t < cooldownEnd) return ['Cooling down', 'warn'];
    if (t < busyUntil) return ['Resetting', 'warn'];
    return ['Armed', ''];
  }

  return {
    tx,
    reboot,
    step,
    stateLabel,
    get t() {
      return t;
    },
    get led() {
      return led;
    },
    get mainOpen() {
      return mainOpen;
    },
    get pistonOpen() {
      return pistonOpen;
    },
    get activations() {
      return activations;
    },
    get estop() {
      return estop;
    },
    get ready() {
      return phase === 'run';
    },
  };
}
