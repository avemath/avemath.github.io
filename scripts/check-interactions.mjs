// One test per interaction, so none can quietly disappear again. Each test drives the real built
// page the way a visitor would and checks the result:
//   nav            every nav item (desktop and the phone menu) lands on the right page or section
//   signal-panel   the hero scope reads out where the mouse is; Hear it is a toggle button
//   marquee        hovering the strip pauses it
//   tabs           every figure card's tabs show their own view (home and the RAMpage case study)
//   chain          hovering a V2V receiver stage selects it; Step through always starts at stage 1,
//                  then moves on, and only shows on the Live view
//   figure-viewer  the V2V figures: Next and Previous, arrow keys, thumbnails, swipe, full screen,
//                  captions, and the buttons in the text that jump to a figure
//   crate          the Toolbox crate: the pointer, the arrow keys and a swipe flip through it; a press
//                  or Enter pins a sleeve; reduced motion lays it out as a plain list
//   surface        Back to the surface scrolls to the top of /research/; Home goes home
//   matrix         the LED card's sources are toggle buttons; the name field takes a name
//   hop-tabs       the hop pattern card's Live and Drawing tabs
//   decode         headings below the first screen decode to their full text when scrolled to
//   draw-in        figures below the first screen draw in when scrolled to
//   live-tiles     website showcase Try it opens the live panel and Close closes it
//   rampage-hover  the RAMpage photo plate plays its match clip on hover, never with reduced motion
//   toolbox        a chip is a toggle filter: lights matching plates, fades the rest, says where it is used
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
  await p.goto(`${base}${path}`, { waitUntil: 'networkidle' });
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
    fail(name, e.message.split('\n')[0]);
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

await test('hop-tabs', async () => {
  const tabs = home.locator('[data-live-host] [data-tabs] [role="tab"]');
  const n = await tabs.count();
  if (n < 2) fail('hop-tabs', `${n} tabs on the hop pattern card`);
  for (let i = 0; i < n; i++) {
    await tabs.nth(i).click();
    const id = await tabs.nth(i).getAttribute('aria-controls');
    if (await home.locator(`#${id}`).isHidden()) fail('hop-tabs', `tab ${i + 1} does not show its view`);
  }
  await tabs.first().click();
});

await test('decode', async () => {
  const p = await page('/');
  const heads = await p.locator('.dh').count();
  if (!heads) fail('decode', 'no headings below the first screen decode');
  const h = p.locator('.dh').first();
  const want = (await h.locator('.dh__real').textContent()).trim();
  await h.scrollIntoViewIfNeeded();
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

await test('toolbox', async () => {
  const url = home.url();
  // Python: used on plates on the home page. Sleeves overlap, so press its uncovered left edge.
  const chip = home.locator('[data-tool]').first();
  await settleOn(home, '[data-crate]');
  // (The crate test covers pressing with the pointer; this one presses with the keyboard.)
  await chip.focus();
  await home.keyboard.press('Space');
  if (home.url() !== url) fail('toolbox', 'pressing a chip navigated');
  if ((await chip.getAttribute('aria-pressed')) !== 'true') fail('toolbox', 'the chip is not pressed');
  const name = (await chip.locator('.sleeve__name').textContent()).trim();
  const line = (await home.locator('[data-tb-line]').textContent()).trim();
  if (!line.startsWith(`${name}: used in `) || !line.endsWith('.')) fail('toolbox', `the line says "${line}"`);
  if ((await home.locator('[data-tb-line]').getAttribute('aria-live')) !== 'polite') fail('toolbox', 'the line is not a polite live region');
  const dim = await home.locator('[data-proj][data-dim]').count();
  const lit = await home.locator('[data-proj]:not([data-dim])').count();
  if (!dim || !lit) fail('toolbox', `${lit} plates lit and ${dim} faded; both should be some`);
  const op = await home.locator('[data-proj][data-dim]').first().evaluate((e) => getComputedStyle(e).opacity);
  await home.waitForTimeout(400);
  const op2 = await home.locator('[data-proj][data-dim]').first().evaluate((e) => getComputedStyle(e).opacity);
  if (Math.abs(Number(op2) - 0.35) > 0.01) fail('toolbox', `faded plates are at ${op2} (${op}), not 0.35`);
  await home.keyboard.press('Space');
  if ((await chip.getAttribute('aria-pressed')) !== 'false' || (await home.locator('[data-proj][data-dim]').count())) fail('toolbox', 'pressing the chip again does not clear the filter');
  await home.keyboard.press('Enter');
  if ((await chip.getAttribute('aria-pressed')) !== 'true') fail('toolbox', 'Enter does not press a chip');
  await home.keyboard.press('Escape');
  if ((await chip.getAttribute('aria-pressed')) !== 'false' || (await home.locator('[data-tb-line]').textContent()).trim()) fail('toolbox', 'Escape does not clear the filter');
});
await test('crate', async () => {
  const sleeves = home.locator('[data-tool]');
  const n = await sleeves.count();
  const openAt = () => sleeves.evaluateAll((b) => b.findIndex((x) => x.hasAttribute('data-open')));
  const shownUse = () => home.locator('[data-use]:not([hidden])').getAttribute('data-use');
  await settleOn(home, '[data-crate]');
  // The pointer flips: over each sleeve's visible edge, that sleeve opens and its card shows.
  const first = await home.locator('.crate__slot').first().boundingBox();
  const last = await home.locator('.crate__slot').last().boundingBox();
  const span = last.x + last.width - first.x;
  for (const i of [1, 4, n - 2]) {
    await home.mouse.move(first.x + ((i + 0.5) / n) * span, first.y + first.height * 0.6, { steps: 4 });
    await home.waitForTimeout(80);
    if ((await openAt()) !== i) fail('crate', `the pointer over sleeve ${i + 1} opened sleeve ${(await openAt()) + 1}`);
    if ((await shownUse()) !== (await sleeves.nth(i).getAttribute('data-tool'))) fail('crate', `sleeve ${i + 1}'s card does not show`);
  }
  // The card names the skill, its level and its projects with thumbnails.
  const card = home.locator('[data-use]:not([hidden])');
  if (!(await card.locator('.tb__lvl').textContent()).match(/Know well|Have built with/)) fail('crate', 'the card does not say Know well or Have built with');
  if (!(await card.locator('a.tb__proj').count())) fail('crate', 'the card has no project links');
  // Keyboard: arrows flip and move focus, Enter pins, Escape clears.
  await sleeves.first().focus();
  for (let k = 0; k < 3; k++) await home.keyboard.press('ArrowRight');
  if ((await openAt()) !== 3) fail('crate', `three ArrowRight presses open sleeve ${(await openAt()) + 1}, not 4`);
  if (!(await sleeves.nth(3).evaluate((e) => e === document.activeElement))) fail('crate', 'the arrow keys do not move focus with the open sleeve');
  await home.keyboard.press('Enter');
  if ((await sleeves.nth(3).getAttribute('aria-pressed')) !== 'true') fail('crate', 'Enter does not pin the sleeve');
  if (!(await home.locator('[data-proj][data-dim]').count())) fail('crate', 'pinning does not apply the project filter');
  await home.keyboard.press('Escape');
  if ((await sleeves.nth(3).getAttribute('aria-pressed')) !== 'false') fail('crate', 'Escape does not clear the pin');
  // Touch: a sideways swipe flips, a tap pins.
  const t = await page('/', { w: 390, h: 844, touch: true });
  await settleOn(t, '[data-crate]');
  const row = await t.locator('[data-crate-row]').boundingBox();
  const cdp = await t.context().newCDPSession(t);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const y = row.y + row.height * 0.5;
  await touch('touchStart', row.x + row.width - 30, y);
  for (let k = 1; k <= 10; k++) await touch('touchMove', row.x + row.width - 30 - k * 22, y + 1);
  await touch('touchEnd');
  // The swipe began on the last sleeve and moved 220px left, so the open sleeve moved left with it.
  const swiped = await t.locator('[data-tool]').evaluateAll((b) => b.findIndex((x) => x.hasAttribute('data-open')));
  const nT = await t.locator('[data-tool]').count();
  if (!(swiped >= 0 && swiped <= nT - 4)) fail('crate', `a swipe left from the last sleeve opened sleeve ${swiped + 1}`);
  // A second touch right after the swipe, on the same spot, reads as a double tap; wait as a person would.
  await t.waitForTimeout(700);
  const lastBox = await t.locator('[data-tool]').last().boundingBox();
  await t.touchscreen.tap(lastBox.x + lastBox.width - 10, lastBox.y + 24);
  await t.waitForTimeout(200);
  if ((await t.locator('[data-tool]').last().getAttribute('aria-pressed')) !== 'true') {
    const st = await t.locator('[data-tool]').evaluateAll((b) => b.map((x) => (x.hasAttribute('data-open') ? 'O' : '') + (x.getAttribute('aria-pressed') === 'true' ? 'P' : '-')).join(','));
    fail('crate', `a tap does not pin a sleeve (${st})`);
  }
  await t.close();
  // Reduced motion: a plain list, no sleeve covering another.
  const rm = await page('/', { reduce: true });
  const boxes = await rm.locator('[data-tool]').evaluateAll((b) => b.map((x) => x.getBoundingClientRect().toJSON()));
  const overlap = boxes.some((a, i) => boxes.some((b, j) => i < j && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1));
  if (overlap) fail('crate', 'with reduced motion the sleeves still overlap');
  await rm.close();
});
await home.close();

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
  await pg.locator('[data-pg-msg]').press('Enter');
  await p.waitForFunction(() => document.querySelector('[data-pg]')?.dataset.state === 'done', null, { timeout: 20000 });
  const got = await pg.locator('[data-pg-rx-text]').getAttribute('data-text');
  if (got !== msg) fail('playground', `at 30 dB SNR "${msg}" decoded as "${got}"`);
  const errsHigh = Number(await pg.getAttribute('data-errors'));
  if (errsHigh !== 0) fail('playground', `${errsHigh} bit errors at 30 dB SNR`);
  const min = await pg.locator('[data-pg-snr]').getAttribute('min');
  await pg.locator('[data-pg-snr]').fill(min);
  await pg.locator('[data-pg-send]').click();
  await p.waitForFunction(() => document.querySelector('[data-pg]')?.dataset.state === 'done', null, { timeout: 20000 });
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
