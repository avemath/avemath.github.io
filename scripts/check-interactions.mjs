// One test per interaction, so none can quietly disappear again. Each test drives the real built
// page the way a visitor would and checks the result:
//   nav            every nav item (desktop and the phone menu) lands on the right page or section
//   hero-labels    the eigenray plate: at 24 yaws by 5 pitches (1440 and 390), no two visible labels
//                  overlap, none leaves the canvas or sits under a note; a drag turns it and keeps that true
//   signal-panel   the hero scope reads out where the mouse is; Hear it is a toggle button
//   marquee        hovering the strip pauses it
//   tabs           every figure card's tabs show their own view (home and the RAMpage case study)
//   chain          hovering a V2V receiver stage selects it; Step through always starts at stage 1,
//                  then moves on, and only shows on the Live view; at 390, 1440 and 2560 every
//                  stage's caption sits below the drawing, never over it
//   figure-viewer  the V2V figures: Next and Previous, arrow keys, thumbnails, swipe, full screen,
//                  captions, and the buttons in the text that jump to a figure
//   surface        Back to the surface scrolls to the top of /research/; Home goes home
//   matrix         the LED card's sources are toggle buttons; the name field takes a name
//   signals-card   the Signals card: the hop pattern is its own view, and Send a packet runs the mesh
//   decode         headings below the first screen decode to their full text when scrolled to
//   draw-in        figures below the first screen draw in when scrolled to
//   live-tiles     website showcase Try it opens the live panel and Close closes it
//   rampage-hover  the RAMpage photo plate plays its match clip on hover, never with reduced motion
//   tune           the Toolbox radio: dragging searches then snaps to a station, the keys and buttons
//                  step, locking filters the plates and Escape clears, phones swipe with no sideways
//                  scroll, and reduced motion jumps the needle
//   race           Why sound: Send runs the race and the clock stops at 2.00 s
//   arrivals       Fig. R2: hovering or arrowing through the arrivals names each one's path
//   field-notes    notes start as bits, decode into text when scrolled to, and a tap replays them
//   tool-panel     the client tool panels play their flow when scrolled to and keep the end state
//   seafloor-drag  dragging open water on /research/ turns the camera; panels never start a drag
//   seafloor-still with reduced motion, /research/ never loads three.js and shows the still gradient
//   playground     the mesh playground decodes a typed message exactly at high SNR and makes errors at low
// Run after a build: part of `npm run test:layout`.
import { chromium } from 'playwright';
import { serveDist, localOnly } from './lib/serve-dist.mjs';

const { server, base } = serveDist('dist');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
let problems = 0;
const passed = [];
const fail = (test, msg) => {
  problems++;
  console.log(`  FAIL ${test}: ${msg}`);
};
const page = async (path, opts = {}) => {
  const p = await browser.newPage({ viewport: { width: opts.w ?? 1440, height: opts.h ?? 900 }, reducedMotion: opts.reduce ? 'reduce' : 'no-preference', hasTouch: !!opts.touch, isMobile: !!opts.touch });
  await p.route(...localOnly(base));
  // Loaded, then quiet on the network if it gets there soon (a busy machine can hold it off).
  await p.goto(`${base}${path}`, { waitUntil: 'load', timeout: 60000 });
  await p.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await p.evaluate(() => document.fonts.ready);
  return p;
};
const only = process.env.ONLY?.split(',');
/** Scroll an element to the middle of the screen and wait until lazily laid-out sections above it
 *  have settled, so its box stops moving. */
const settleOn = async (p, sel) => {
  let y = null;
  for (let k = 0; k < 8; k++) {
    await p.locator(sel).evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await p.waitForTimeout(250);
    const b = await p.locator(sel).boundingBox();
    if (y !== null && Math.abs(b.y - y) < 1) return;
    y = b.y;
  }
};
const test = async (name, fn) => {
  if (only && !only.includes(name)) return;
  const before = problems;
  try {
    await fn();
  } catch (e) {
    fail(name, process.env.VERBOSE ? e.message.split('\n').slice(0, 25).join('\n') : e.message.split('\n')[0]);
  }
  if (problems === before) passed.push(name);
};

// ---- nav ----
await test('nav', async () => {
  const want = [
    ['Projects', '/work/', '#engineering'],
    ['Websites', '/work/', '#websites'],
    ['Research', '/research/', '#research-title'],
    ['About', '/about/', 'h1'],
    ['Contact', '/contact/', 'h1'],
  ];
  for (const from of ['/', '/about/', '/work/nicholas-domke/', '/research/']) {
    for (const [label, path, target] of want) {
      const p = await page(from);
      try {
        await p.locator('.site-header nav').getByRole('link', { name: label, exact: true }).first().click({ timeout: 8000 });
      } catch (e) {
        fail('nav', `${label} from ${from} could not be clicked: ${e.message.split('\n').slice(0, 6).join(' / ')}`);
        await p.close();
        continue;
      }
      await p.waitForLoadState('networkidle');
      await p.waitForTimeout(300);
      const at = new URL(p.url()).pathname;
      if (at !== path) fail('nav', `${label} from ${from} went to ${at}, not ${path}`);
      const top = await p.evaluate((s) => document.querySelector(s)?.getBoundingClientRect().top ?? null, target);
      if (top === null || top < -2 || top > 450) fail('nav', `${label} from ${from}: ${target} is not at the top of the screen (top ${top})`);
      await p.close();
    }
  }
  // The phone menu.
  for (const [label, path] of want.map(([l, p]) => [l, p])) {
    const p = await page('/work/nicholas-domke/', { w: 390, h: 844 });
    await p.locator('.mnav__button').click();
    await p.locator('.mnav__panel').getByRole('link', { name: label, exact: true }).click();
    await p.waitForLoadState('networkidle');
    if (new URL(p.url()).pathname !== path) fail('nav', `phone menu ${label} went to ${new URL(p.url()).pathname}`);
    await p.close();
  }
});

await test('hero-labels', async () => {
  for (const w of [1440, 390]) {
    const p = await page('/', { w, h: w < 600 ? 844 : 900 });
    const cv = p.locator('[data-eigenrays]');
    await cv.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await p.waitForFunction(() => document.querySelector('[data-eigenrays]').__er?.ready(), null, { timeout: 15000 });
    const bad = await cv.evaluate((el) => {
      const er = el.__er;
      const [W, H] = er.size();
      const hit = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
      const out = [];
      let views = 0;
      for (let i = 0; i < 24; i++) {
        for (let j = 0; j < 5; j++) {
          const yaw = -Math.PI + (2 * Math.PI * i) / 24;
          const pitch = -0.1 + (1.2 * j) / 4;
          er.setView(yaw, pitch);
          views++;
          const on = er.labels().filter((l) => l.on);
          const avoid = er.avoid();
          for (const l of on) {
            if (l.box[0] < 0 || l.box[1] < 0 || l.box[2] > W || l.box[3] > H) out.push(`${l.key} leaves the canvas at yaw ${yaw.toFixed(2)} pitch ${pitch.toFixed(2)}`);
            for (const n of avoid) if (hit(l.box, n)) out.push(`${l.key} sits under a note at yaw ${yaw.toFixed(2)} pitch ${pitch.toFixed(2)}`);
          }
          for (let a = 0; a < on.length; a++) for (let b = a + 1; b < on.length; b++) if (hit(on[a].box, on[b].box)) out.push(`${on[a].key} overlaps ${on[b].key} at yaw ${yaw.toFixed(2)} pitch ${pitch.toFixed(2)}`);
          if (!on.length) out.push(`no label shows at yaw ${yaw.toFixed(2)} pitch ${pitch.toFixed(2)}`);
        }
      }
      return { out, views };
    });
    if (bad.views < 120) fail('hero-labels', `only ${bad.views} views sampled`);
    for (const m of bad.out.slice(0, 6)) fail('hero-labels', `${w}px: ${m}`);
    // A real drag: the view turns, the leader still points at a turning point, and the rule holds.
    const before = await cv.evaluate((el) => el.__er.labels().map((l) => l.box.join()).join('|'));
    const b = await cv.boundingBox();
    await p.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.5);
    await p.mouse.down();
    for (let k = 1; k <= 12; k++) await p.mouse.move(b.x + b.width * (0.5 - k * 0.03), b.y + b.height * (0.5 + k * 0.01));
    await p.mouse.up();
    await p.waitForTimeout(300);
    const after = await cv.evaluate((el) => {
      const er = el.__er;
      const on = er.labels().filter((l) => l.on);
      const hit = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
      let overlaps = 0;
      for (let a = 0; a < on.length; a++) for (let c = a + 1; c < on.length; c++) if (hit(on[a].box, on[c].box)) overlaps++;
      return { sig: er.labels().map((l) => l.box.join()).join('|'), overlaps, leader: er.leader() };
    });
    if (after.sig === before) fail('hero-labels', `${w}px: dragging the plate does not turn it`);
    if (after.overlaps) fail('hero-labels', `${w}px: after a drag ${after.overlaps} labels overlap`);
    if (!after.leader) fail('hero-labels', `${w}px: no leader line from the pinned note`);
    await p.close();
  }
});

// ---- the home page ----
const home = await page('/');

await test('signal-panel', async () => {
  const screen = home.locator('[data-sig-screen]');
  await screen.scrollIntoViewIfNeeded();
  const b = await screen.boundingBox();
  await home.mouse.move(b.x + b.width * 0.4, b.y + b.height * 0.5);
  await home.mouse.move(b.x + b.width * 0.45, b.y + b.height * 0.5);
  await home.waitForTimeout(200);
  const read = (await home.locator('[data-sig-read]').textContent()).trim();
  if (!read) fail('signal-panel', 'moving the mouse over the scope reads out nothing');
  if ((await home.locator('[data-sig-play]').getAttribute('aria-pressed')) !== 'false') fail('signal-panel', 'Hear it is not a toggle button');
});

await test('marquee', async () => {
  const mq = home.locator('.mq');
  await mq.hover();
  const state = await home.evaluate(() => getComputedStyle(document.querySelector('.mq__track')).animationPlayState);
  if (state !== 'paused') fail('marquee', `hovering the strip leaves it ${state}`);
});

const tabsOn = async (p, where) => {
  const cards = await p.locator('[data-fc]').count();
  if (!cards) fail('tabs', `no figure cards on ${where}`);
  for (let c = 0; c < cards; c++) {
    const card = p.locator('[data-fc]').nth(c);
    const tabs = card.locator('[role="tab"]');
    const n = await tabs.count();
    for (let i = 0; i < n; i++) {
      await tabs.nth(i).click();
      const panelId = await tabs.nth(i).getAttribute('aria-controls');
      const shown = await p.evaluate((id) => [...document.querySelectorAll('[role="tabpanel"]')].filter((x) => x.id.split('-')[0] === id.split('-')[0] && !x.hidden).map((x) => x.id), panelId);
      if (shown.join() !== panelId) fail('tabs', `${where} card ${c + 1}: tab ${i + 1} shows ${shown.join() || 'nothing'}`);
    }
    await tabs.first().click();
  }
};
await test('tabs', async () => {
  await tabsOn(home, '/');
  const rp = await page('/work/rampage/');
  await tabsOn(rp, '/work/rampage/');
  await rp.close();
});

await test('chain', async () => {
  const stages = home.locator('#v2v [data-stage]');
  const n = await stages.count();
  if (n < 9) fail('chain', `only ${n} receiver stages`);
  await stages.nth(3).hover();
  if ((await stages.nth(3).getAttribute('aria-pressed')) !== 'true') fail('chain', 'hovering stage 4 does not select it');
  const step = home.locator('#v2v [data-step]');
  const pressedAt = () => stages.evaluateAll((b) => b.findIndex((x) => x.getAttribute('aria-pressed') === 'true'));
  await step.click();
  if ((await pressedAt()) !== 0) fail('chain', `the first Step through goes to stage ${(await pressedAt()) + 1}, not stage 1`);
  await step.click();
  if ((await pressedAt()) !== 1) fail('chain', 'the second Step through does not go to stage 2');
  // On a view where it cannot work, the button is hidden; back on Live it starts at stage 1 again.
  await home.locator('#v2v [role="tab"][data-view="drawing"]').click();
  if (await step.isVisible()) fail('chain', 'Step through shows on the Drawing view');
  await home.locator('#v2v [role="tab"][data-view="live"]').click();
  if (!(await step.isVisible())) fail('chain', 'Step through is hidden on the Live view');
  await stages.nth(6).click();
  await step.click();
  if ((await pressedAt()) !== 0) fail('chain', 'after picking a stage by hand, Step through does not start at stage 1');
  // Every stage has a caption saying what it did.
  for (let i = 0; i < n; i++) {
    await stages.nth(i).click();
    const cap = (await home.locator('#v2v [data-cf-cap]').textContent()).trim();
    if (cap.length < 30) fail('chain', `stage ${i + 1} has no caption ("${cap}")`);
  }
  if (await home.locator('#v2v [role="tab"][data-view="plate"]').count()) fail('chain', 'the V2V card still has a Plate tab');
  // Every stage's caption sits below the drawing, at a phone, a laptop and a big screen.
  for (const w of [390, 1440, 2560]) {
    const p = await page('/', { w, h: w < 600 ? 844 : 1100 });
    await settleOn(p, '#v2v [data-step]');
    const st = p.locator('#v2v [data-stage]');
    for (let i = 0; i < n; i++) {
      await st.nth(i).click();
      const r = await p.evaluate(() => {
        const box = document.querySelector('#v2v .cf__box');
        const cap = document.querySelector('#v2v [data-cf-cap]').getBoundingClientRect();
        const b = box && !box.hidden && box.getBoundingClientRect().height ? box.getBoundingClientRect() : null;
        return { capTop: cap.top, boxBottom: b ? b.bottom : null, capH: cap.height };
      });
      if (!r.capH) fail('chain', `at ${w}px stage ${i + 1}'s caption is empty`);
      if (r.boxBottom !== null && r.capTop < r.boxBottom - 1) fail('chain', `at ${w}px stage ${i + 1}'s caption overlaps the drawing (${r.capTop} < ${r.boxBottom})`);
    }
    await p.close();
  }
});

await test('matrix', async () => {
  const demo = home.locator('#led [data-mf-src="clip"]');
  await demo.click();
  if ((await demo.getAttribute('aria-pressed')) !== 'true') fail('matrix', 'Play a demo is not pressed after a click');
  const idle = home.locator('#led [data-mf-src="idle"]');
  await idle.click();
  if ((await idle.getAttribute('aria-pressed')) !== 'true' || (await demo.getAttribute('aria-pressed')) !== 'false') fail('matrix', 'Idle glow does not take over from the demo');
  await home.locator('#led [data-mf-name]').fill('LEA');
  if ((await home.locator('#led [data-mf-name]').inputValue()) !== 'LEA') fail('matrix', 'the name field does not take a name');
});

await test('signals-card', async () => {
  // Its own page, closed after, so the live mesh is not left animating behind the later tests.
  const sp = await page('/');
  const card = sp.locator('#signals');
  await settleOn(sp, '#signals');
  // The hop pattern lives on as the card's own view.
  await card.locator('[role="tab"][data-view="plate"]').click();
  if (!(await card.locator('[data-live-host]').isVisible())) fail('signals-card', 'the Hop pattern view does not show the hop tile');
  await card.locator('[role="tab"][data-view="live"]').click();
  const pg = card.locator('[data-pg]');
  if (!(await pg.isVisible())) return fail('signals-card', 'the Live view does not show the mesh');
  await sp.waitForFunction(() => document.querySelector('#signals [data-pg]')?.hasAttribute('data-ready'), null, { timeout: 10000 }).catch(() => fail('signals-card', 'the live mesh never drew (the still stays up)'));
  await pg.locator('[data-pg-send]').click();
  await sp.waitForFunction(() => document.querySelector('#signals [data-pg]')?.dataset.state === 'done', null, { timeout: 20000 }).catch(() => fail('signals-card', 'Send a packet does not finish a send'));
  if (!(await card.locator('a[href="/work/signals-playground/"]').count())) fail('signals-card', 'no link to the full playground');
  await sp.close();
});

await test('decode', async () => {
  const p = await page('/');
  const heads = await p.locator('.dh').count();
  if (!heads) fail('decode', 'no headings below the first screen decode');
  const h = p.locator('.dh').first();
  const want = (await h.locator('.dh__real').textContent()).trim();
  await h.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await p.waitForTimeout(2500);
  // Decoded: the real text shows and the scrambling layer is gone or says the same.
  const done = await h.evaluate((el) => ({ decoding: el.hasAttribute('data-decoding'), real: el.querySelector('.dh__real').textContent.trim(), fx: el.querySelector('.dh__fx').textContent.trim(), realVis: getComputedStyle(el.querySelector('.dh__real')).visibility }));
  if (done.decoding || done.real !== want || (done.fx && done.fx !== want) || done.realVis === 'hidden') fail('decode', `"${want}" has not decoded (${JSON.stringify(done)})`);
  await p.close();
});

await test('draw-in', async () => {
  const p = await page('/');
  // A figure below the first screen, in a view that is showing, waits; scrolled to, it draws in.
  const target = await p.evaluate(() => {
    const el = [...document.querySelectorAll('.draw-pending')].find((e) => !e.closest('[hidden]'));
    if (!el) return null;
    el.setAttribute('data-test-draw', '');
    return true;
  });
  if (!target) fail('draw-in', 'no figure waits to draw in below the first screen');
  else {
    await p.locator('[data-test-draw]').evaluate((el) => el.parentElement.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await p.waitForTimeout(500);
    if (await p.locator('[data-test-draw].draw-pending').count()) fail('draw-in', 'scrolling to a figure does not draw it in');
  }
  await p.close();
});

await test('live-tiles', async () => {
  const tries = home.locator('#websites [data-live-try]');
  const n = await tries.count();
  if (!n) fail('live-tiles', 'no Try it buttons on the website showcase');
  for (let i = 0; i < n; i++) {
    const t = tries.nth(i);
    await t.scrollIntoViewIfNeeded();
    await t.click();
    await home.waitForTimeout(400);
    const host = t.locator('xpath=ancestor::*[@data-live-host][1]');
    if (!(await host.locator('[data-live-panel]').count())) fail('live-tiles', `Try it ${i + 1} does not open the live panel`);
    await host.locator('[data-live-close]').click();
  }
});

await test('rampage-hover', async () => {
  const media = home.locator('[data-rp-media]');
  await media.scrollIntoViewIfNeeded();
  await media.hover();
  await home.waitForTimeout(300);
  if (!(await home.locator('[data-rp]').getAttribute('data-previewing'))?.length === undefined) fail('rampage-hover', 'hovering the plate does not start the preview');
  if ((await home.locator('[data-rp][data-previewing]').count()) !== 1) fail('rampage-hover', 'hovering the plate does not start the preview');
  await home.mouse.move(5, 5);
  if (await home.locator('[data-rp][data-previewing]').count()) fail('rampage-hover', 'the preview keeps playing after the pointer leaves');
  const still = await page('/', { reduce: true });
  await still.locator('[data-rp-media]').hover();
  if (await still.locator('[data-rp][data-previewing]').count()) fail('rampage-hover', 'the preview plays with reduced motion');
  await still.close();
});

await test('tune', async () => {
  const p = await page('/', { w: 1440, h: 1000 });
  await settleOn(p, '[data-radio]');
  const dial = p.locator('[data-dial]');
  const sig = () => p.locator('[data-tune-sig]').textContent();
  const now = async () => Number(await dial.getAttribute('aria-valuenow'));
  const N = Number(await dial.getAttribute('aria-valuemax'));
  if ((await dial.getAttribute('role')) !== 'slider') fail('tune', 'the dial is not a slider');
  const cardName = () => p.locator('[data-use]:not([hidden]) .tb__name').textContent();
  // Drag: held down and moved slowly across, the needle passes between stations (searching);
  // let go anywhere and it snaps onto one (locked).
  const b = await dial.boundingBox();
  const y = b.y + b.height * 0.5;
  await p.mouse.move(b.x + b.width * 0.08, y);
  await p.mouse.down();
  let searched = false;
  for (let k = 0; k <= 30; k++) {
    await p.mouse.move(b.x + b.width * (0.08 + k * 0.012), y);
    await p.waitForTimeout(40);
    if ((await sig()).startsWith('searching')) searched = true;
  }
  if (!searched) fail('tune', 'dragging between stations never reads "searching"');
  await p.mouse.move(b.x + b.width * 0.445, y);
  await p.mouse.up();
  await p.waitForTimeout(800);
  const s1 = await sig();
  if (!/^locked: .+, \d+ projects?$/.test(s1)) fail('tune', `after letting go the dial says "${s1}", not locked`);
  const vt = await dial.getAttribute('aria-valuetext');
  if (!vt.startsWith((await cardName()).trim())) fail('tune', `the slider says "${vt}" but the card shows ${await cardName()}`);
  if (!s1.includes((await cardName()).trim())) fail('tune', 'the scope line and the card disagree');
  if (!(await p.locator('[data-proj][data-dim]').count())) fail('tune', 'letting go on a station does not apply the project filter');
  // Keys: Home, three steps right, End.
  await dial.focus();
  await p.keyboard.press('Home');
  if ((await now()) !== 1) fail('tune', `Home lands on station ${await now()}`);
  for (let k = 0; k < 3; k++) await p.keyboard.press('ArrowRight');
  if ((await now()) !== 4) fail('tune', `three ArrowRight presses land on station ${await now()}, not 4`);
  await p.keyboard.press('ArrowLeft');
  if ((await now()) !== 3) fail('tune', 'ArrowLeft does not step back');
  await p.keyboard.press('End');
  if ((await now()) !== N) fail('tune', 'End does not reach the last station');
  // Buttons.
  await p.locator('[data-dial-prev]').click();
  if ((await now()) !== N - 1) fail('tune', 'Previous station does not step back');
  await p.locator('[data-dial-next]').click();
  if ((await now()) !== N) fail('tune', 'Next station does not step on');
  // The filter: Python lights some plates and fades the rest, says where it is used, and Escape clears.
  await dial.focus();
  await p.keyboard.press('Home');
  const name = (await cardName()).trim();
  const line = (await p.locator('[data-tb-line]').textContent()).trim();
  if (!line.startsWith(`${name}: used in `)) fail('tune', `the live line says "${line}"`);
  if ((await p.locator('[data-tb-line]').getAttribute('aria-live')) !== 'polite') fail('tune', 'the line is not a polite live region');
  const dim = await p.locator('[data-proj][data-dim]').count();
  const lit = await p.locator('[data-proj]:not([data-dim])').count();
  if (!dim || !lit) fail('tune', `${lit} plates lit and ${dim} faded; both should be some`);
  await p.keyboard.press('Escape');
  if ((await p.locator('[data-proj][data-dim]').count()) || (await p.locator('[data-tb-line]').textContent()).trim()) fail('tune', 'Escape does not clear the filter');
  await p.waitForTimeout(600);
  if (!(await sig()).startsWith('locked')) fail('tune', 'the keys leave the needle between stations');
  await p.close();

  // Phone: no sideways page scroll, the dial fits, and a sideways swipe tunes and snaps.
  const t = await page('/', { w: 390, h: 844, touch: true });
  await settleOn(t, '[data-radio]');
  const over = await t.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (over > 0) fail('tune', `the phone page scrolls sideways by ${over}px`);
  const tb = await t.locator('[data-dial]').boundingBox();
  if (tb.x < 0 || tb.x + tb.width > 390) fail('tune', 'the dial does not fit the phone screen');
  const tnow = async () => Number(await t.locator('[data-dial]').getAttribute('aria-valuenow'));
  const before = await tnow();
  const cdp = await t.context().newCDPSession(t);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const ty = tb.y + tb.height * 0.5;
  await touch('touchStart', tb.x + 30, ty);
  for (let k = 1; k <= 12; k++) await touch('touchMove', tb.x + 30 + k * 20, ty + 1);
  await touch('touchEnd');
  await t.waitForTimeout(800);
  if ((await tnow()) === before) fail('tune', 'a sideways swipe on the phone dial does not tune');
  if (!(await t.locator('[data-tune-sig]').textContent()).startsWith('locked')) fail('tune', 'a swipe does not snap onto a station');
  await t.locator('[data-dial-next]').click();
  if ((await tnow()) !== Math.min(N, (await tnow()))) fail('tune', 'Next station is missing on the phone');
  await t.close();

  // Reduced motion: Next jumps the needle straight onto the station.
  const rm = await page('/', { reduce: true });
  await settleOn(rm, '[data-radio]');
  await rm.locator('[data-dial-next]').click();
  await rm.waitForTimeout(50);
  if (!(await rm.locator('[data-tune-sig]').textContent()).startsWith('locked')) fail('tune', 'with reduced motion the needle slides instead of jumping');
  await rm.close();
});
await home.close();

await test('race', async () => {
  const p = await page('/research/');
  await settleOn(p, '[data-race]');
  await p.locator('[data-race-send]').click();
  await p.waitForFunction(() => { const v = Number(document.querySelector('[data-race-clock]').textContent); return v > 0.05 && v < 2; }, null, { timeout: 4000 }).catch(() => fail('race', 'the clock never runs'));
  await p.waitForFunction(() => document.querySelector('[data-race-clock]').textContent === '2.00', null, { timeout: 8000 }).catch(async () => fail('race', `the clock stops at ${await p.locator('[data-race-clock]').textContent()}, not 2.00`));
  await p.waitForTimeout(200);
  if (!(await p.locator('[data-race-live]').textContent()).includes('2.00')) fail('race', 'the live line does not give the round trip');
  await p.close();
});

await test('arrivals', async () => {
  const p = await page('/research/');
  await settleOn(p, '[data-arr-plot]');
  const read = () => p.locator('[data-arr-read]').textContent();
  const bars = p.locator('[data-arr]');
  const n = await bars.count();
  if (n < 3) return fail('arrivals', `only ${n} arrivals to hover`);
  await bars.nth(1).dispatchEvent('pointerenter');
  if (!/^Arrival 2 of \d+: .*(direct|surface|bottom|both)/.test(await read())) fail('arrivals', `hovering arrival 2 reads "${await read()}"`);
  if (!(await p.locator('[data-arr-path]').getAttribute('d'))?.startsWith('M')) fail('arrivals', 'no path drawn on the sketch');
  await p.locator('[data-arr-plot]').focus();
  await p.keyboard.press('End');
  if (!(await read()).startsWith(`Arrival ${n} of ${n}`)) fail('arrivals', `End reads "${await read()}"`);
  await p.keyboard.press('ArrowLeft');
  if (!(await read()).startsWith(`Arrival ${n - 1} of`)) fail('arrivals', 'ArrowLeft does not step back');
  await p.close();
});

await test('field-notes', async () => {
  const p = await page('/research/');
  const note = p.locator('[data-note]').last();
  const val = note.locator('[data-note-value]');
  const want = await val.getAttribute('data-text');
  const shown0 = (await val.textContent()).trim();
  if (!/^[01\s]+$/.test(shown0)) fail('field-notes', `before it is on screen the note shows "${shown0}", not bits`);
  await settleOn(p, '[data-note] >> nth=-1');
  await p.waitForTimeout(2200);
  if ((await val.textContent()).trim() !== want) fail('field-notes', `scrolled to, the note reads "${await val.textContent()}", not "${want}"`);
  await note.click();
  await p.waitForTimeout(80);
  if ((await val.textContent()) === want) fail('field-notes', 'a tap does not replay the decode');
  await p.waitForTimeout(1800);
  if ((await val.textContent()).trim() !== want) fail('field-notes', 'the replay does not end on the text');
  const rm = await page('/research/', { reduce: true });
  const v2 = rm.locator('[data-note] [data-note-value]').last();
  if ((await v2.textContent()).trim() !== (await v2.getAttribute('data-text'))) fail('field-notes', 'with reduced motion the note is not simply shown');
  await rm.close();
  await p.close();
});

await test('tool-panel', async () => {
  const p = await page('/work/');
  const panels = p.locator('[data-tool-panel]');
  const n = await panels.count();
  if (n < 2) fail('tool-panel', `${n} client tool panels on /work/`);
  for (let i = 0; i < n; i++) {
    await settleOn(p, `[data-tool-panel] >> nth=${i}`);
    await p.waitForTimeout(300);
    if (!(await panels.nth(i).evaluate((e) => e.hasAttribute('data-play')))) fail('tool-panel', `panel ${i + 1} does not play when scrolled to`);
  }
  await p.waitForTimeout(4800);
  if (!(await panels.first().evaluate((e) => e.hasAttribute('data-played')))) fail('tool-panel', 'the flow does not keep its end state');
  await p.close();
});

await test('figure-viewer', async () => {
  const p = await page('/work/v2v-bsm-ofdm/');
  const fv = p.locator('[data-fv]');
  if (!(await fv.count())) return fail('figure-viewer', 'no figure viewer on the V2V case study');
  const thumbs = fv.locator('.fv__thumb');
  const n = await thumbs.count();
  if (n < 10) fail('figure-viewer', `only ${n} figures in the viewer`);
  if (await p.locator('.case__prose > p > img').count()) fail('figure-viewer', 'figures are still inline in the text');
  const at = async () => Number(await fv.getAttribute('data-index'));
  const cap = () => fv.locator('[data-fv-cap]').innerText();
  await fv.scrollIntoViewIfNeeded();
  const cap0 = await cap();
  await fv.locator('[data-fv-next]').click();
  if ((await at()) !== 1 || (await cap()) === cap0) fail('figure-viewer', 'Next does not show the second figure and its caption');
  await fv.locator('[data-fv-prev]').click();
  await fv.locator('[data-fv-prev]').click();
  if ((await at()) !== n - 1) fail('figure-viewer', 'Previous from the first figure does not wrap to the last');
  await fv.locator('[data-fv-next]').focus();
  await p.keyboard.press('ArrowRight');
  await p.keyboard.press('ArrowRight');
  if ((await at()) !== 1) fail('figure-viewer', `the arrow keys land on figure ${(await at()) + 1}, not 2`);
  await thumbs.nth(5).click();
  if ((await at()) !== 5 || !(await thumbs.nth(5).getAttribute('aria-current') !== null)) fail('figure-viewer', 'a thumbnail does not select its figure');
  // Full screen: the same figure, its caption, Next works there too, and Escape closes it.
  const src = await fv.locator('[data-fv-img]').getAttribute('src');
  await fv.locator('[data-fv-open]').click();
  const dlg = fv.locator('[data-fv-dialog]');
  if (!(await dlg.evaluate((d) => d.open))) fail('figure-viewer', 'clicking the figure does not open it full screen');
  if ((await dlg.locator('[data-fv-full-img]').getAttribute('src')) !== src) fail('figure-viewer', 'full screen shows a different figure');
  if (!(await dlg.locator('[data-fv-full-cap]').innerText()).trim()) fail('figure-viewer', 'full screen drops the caption');
  await p.keyboard.press('Escape');
  if (await dlg.evaluate((d) => d.open)) fail('figure-viewer', 'Escape does not close full screen');
  // A button in the text jumps to its figure.
  const jump = p.locator('.fv-jump button').nth(2);
  await jump.click();
  if ((await at()) !== 3) fail('figure-viewer', `the third jump button shows figure ${(await at()) + 1}, not 4`);
  await p.close();
  // Touch: a swipe moves to the next figure.
  const t = await page('/work/v2v-bsm-ofdm/', { w: 390, h: 844, touch: true });
  const stage = await t.locator('[data-fv] .fv__stage').boundingBox();
  await t.locator('[data-fv]').scrollIntoViewIfNeeded();
  const s2 = await t.locator('[data-fv] .fv__stage').boundingBox();
  const cdp = await t.context().newCDPSession(t);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const y = s2.y + s2.height / 2;
  await touch('touchStart', s2.x + s2.width * 0.8, y);
  for (let k = 1; k <= 6; k++) await touch('touchMove', s2.x + s2.width * 0.8 - k * 30, y + 2);
  await touch('touchEnd');
  if (Number(await t.locator('[data-fv]').getAttribute('data-index')) !== 1) fail('figure-viewer', `a swipe left lands on figure ${Number(await t.locator('[data-fv]').getAttribute('data-index')) + 1}, not 2 (${Math.round(stage?.width ?? 0)})`);
  await t.close();
});

// ---- the Research scene ----
await test('seafloor-drag', async () => {
  for (const [w, h, touch] of [
    [1440, 900, false],
    [390, 844, true],
  ]) {
    const p = await page('/research/', { w, h, touch });
    await p.mouse.move(10, 300);
    await p.mouse.move(12, 310);
    if (touch) await p.evaluate(() => dispatchEvent(new Event('touchstart')));
    await p.waitForSelector('[data-seafloor][data-live]', { timeout: 30000 });
    // Find open water: a point between two panels, on screen.
    const spot = await p.evaluate(() => {
      const panels = [...document.querySelectorAll('[data-rpanel]')];
      const a = panels[1].getBoundingClientRect();
      scrollTo({ top: scrollY + a.bottom - 120, behavior: 'instant' });
      const r = panels[1].getBoundingClientRect();
      const n = panels[2].getBoundingClientRect();
      return { x: innerWidth / 2, y: (r.bottom + Math.min(n.top, innerHeight)) / 2 };
    });
    const under = await p.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return { inPanel: !!el?.closest('[data-rpanel]'), tag: el?.tagName, cls: el?.className?.toString() };
    }, spot);
    if (under.inPanel) fail('seafloor-drag', `${w}: the open-water point is inside a panel`);
    const before = await p.evaluate(() => ({ ...window.__seafloor.cam }));
    if (touch) {
      const c = await p.context().newCDPSession(p);
      const t = (type, x, y) => c.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
      await t('touchStart', spot.x, spot.y);
      for (let k = 1; k <= 8; k++) await t('touchMove', spot.x - k * 20, spot.y + 2);
      await t('touchEnd');
    } else {
      await p.mouse.move(spot.x, spot.y);
      await p.mouse.down();
      await p.mouse.move(spot.x + 160, spot.y + 90, { steps: 10 });
      await p.mouse.up();
    }
    await p.waitForTimeout(150);
    const after = await p.evaluate(() => ({ ...window.__seafloor.cam }));
    if (Math.abs(after.yaw - before.yaw) < 0.2) fail('seafloor-drag', `${w}: dragging open water turned the camera by only ${(after.yaw - before.yaw).toFixed(3)} rad`);
    if (!touch && Math.abs(after.pitch - before.pitch) < 0.1) fail('seafloor-drag', `${w}: dragging up and down did not change the pitch`);
    // A drag that starts on a panel does not turn the view.
    const pb = await p.locator('[data-rpanel]').nth(1).boundingBox();
    const yaw0 = after.yaw;
    if (!touch) {
      await p.mouse.move(pb.x + 30, pb.y + pb.height - 30);
      await p.mouse.down();
      await p.mouse.move(pb.x + 200, pb.y + pb.height - 30, { steps: 6 });
      await p.mouse.up();
      const yaw1 = await p.evaluate(() => window.__seafloor.cam.yaw);
      if (Math.abs(yaw1 - yaw0) > 0.02) fail('seafloor-drag', `${w}: a drag on a panel turned the view`);
    }
    // Scrolling moves the camera down.
    const d0 = await p.evaluate(() => window.__seafloor.cam.depth);
    await p.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    // The scroll reaches the scene on its next frame; under load that can take a while.
    await p.waitForFunction(() => window.__seafloor.cam.depth > 0.95, null, { timeout: 5000 }).catch(() => {});
    const d1 = await p.evaluate(() => window.__seafloor.cam.depth);
    if (!(d1 > d0 && d1 > 0.95)) fail('seafloor-drag', `${w}: scrolling to the bottom leaves the camera at depth ${d1}`);
    await p.close();
  }
});

await test('surface', async () => {
  const p = await page('/research/', { reduce: true });
  await p.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  const home = p.locator('footer').getByRole('link', { name: 'Home', exact: true });
  if ((await home.getAttribute('href')) !== '/') fail('surface', 'there is no Home link beside Back to the surface');
  await p.locator('[data-surface]').click();
  await p.waitForTimeout(400);
  if ((await p.evaluate(() => scrollY)) > 2) fail('surface', 'Back to the surface does not return to the top of the page');
  if (new URL(p.url()).pathname !== '/research/') fail('surface', 'Back to the surface left the Research page');
  if (!(await p.evaluate(() => document.activeElement?.id === 'research-title'))) fail('surface', 'the title does not take focus at the top');
  await p.close();
});

await test('seafloor-still', async () => {
  const p = await page('/research/', { reduce: true });
  await p.mouse.move(10, 300);
  await p.mouse.move(40, 320);
  await p.evaluate(() => scrollBy(0, 400));
  await p.waitForTimeout(800);
  const three = await p.evaluate(() => performance.getEntriesByType('resource').some((r) => r.name.includes('seafloor-scene')));
  if (three) fail('seafloor-still', 'three.js loaded with reduced motion');
  const bg = await p.evaluate(() => getComputedStyle(document.querySelector('.abyss')).backgroundImage);
  if (!bg.includes('gradient')) fail('seafloor-still', 'no still gradient behind the page');
  if (!(await p.locator('.abyss__still').count())) fail('seafloor-still', 'no still render at the top');
  await p.close();
});

// ---- the Signals playground ----
await test('playground', async () => {
  const p = await page('/work/signals-playground/');
  const pg = p.locator('[data-pg]');
  await pg.scrollIntoViewIfNeeded();
  const msg = 'hi from Ave';
  await pg.locator('[data-pg-msg]').fill(msg);
  await pg.locator('[data-pg-snr]').fill('30');
  await pg.locator('[data-pg-echo]').fill('0');
  await pg.locator('[data-pg-doppler]').fill('0');
  // The mesh only animates on screen (and a send finishes as its chips arrive), so center it first.
  const sendFromView = async (how) => {
    await pg.locator('[data-pg-mesh]').evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await how();
    await p.waitForFunction(() => document.querySelector('[data-pg]')?.dataset.state === 'done', null, { timeout: 30000 });
  };
  await sendFromView(() => pg.locator('[data-pg-form]').evaluate((f) => f.requestSubmit()));
  const got = await pg.locator('[data-pg-rx-text]').getAttribute('data-text');
  if (got !== msg) fail('playground', `at 30 dB SNR "${msg}" decoded as "${got}"`);
  const errsHigh = Number(await pg.getAttribute('data-errors'));
  if (errsHigh !== 0) fail('playground', `${errsHigh} bit errors at 30 dB SNR`);
  const min = await pg.locator('[data-pg-snr]').getAttribute('min');
  await pg.locator('[data-pg-snr]').fill(min);
  await sendFromView(() => pg.locator('[data-pg-send]').evaluate((b) => b.click()));
  const errsLow = Number(await pg.getAttribute('data-errors'));
  if (!(errsLow >= 1)) fail('playground', `no bit errors at the lowest SNR (${min} dB)`);
  const roseBits = await pg.locator('[data-pg-rx-bits] .is-wrong').count();
  if (errsLow >= 1 && !roseBits) fail('playground', 'wrong bits are not marked');
  await p.close();
});

await browser.close();
server.close();
console.log(`\ninteractions: ${passed.length} passed (${passed.join(', ')})`);
if (problems) {
  console.log(`${problems} interaction problem(s).`);
  process.exit(1);
}
