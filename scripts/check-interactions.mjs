// One test per interaction, so none can quietly disappear again. Each test drives the real built
// page the way a visitor would and checks the result:
//   nav            every nav item (desktop and the phone menu) lands on the right page or section
//   signal-panel   the hero scope reads out where the mouse is; Hear it is a toggle button
//   marquee        hovering the strip pauses it
//   tabs           every figure card's tabs show their own view (home and the RAMpage case study)
//   chain          hovering a V2V receiver stage selects it; Step through moves to the next stage
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
  await home.locator('#v2v [data-step]').click();
  if ((await stages.nth(4).getAttribute('aria-pressed')) !== 'true') fail('chain', 'Step through does not move to the next stage');
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
  const chip = home.locator('[data-tool]').first();
  await chip.scrollIntoViewIfNeeded();
  await chip.click();
  if (home.url() !== url) fail('toolbox', 'pressing a chip navigated');
  if ((await chip.getAttribute('aria-pressed')) !== 'true') fail('toolbox', 'the chip is not pressed');
  const name = (await chip.textContent()).trim();
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
  await chip.click();
  if ((await chip.getAttribute('aria-pressed')) !== 'false' || (await home.locator('[data-proj][data-dim]').count())) fail('toolbox', 'pressing the chip again does not clear the filter');
  await chip.focus();
  await home.keyboard.press('Enter');
  if ((await chip.getAttribute('aria-pressed')) !== 'true') fail('toolbox', 'Enter does not press a chip');
  await home.keyboard.press('Escape');
  if ((await chip.getAttribute('aria-pressed')) !== 'false' || (await home.locator('[data-tb-line]').textContent()).trim()) fail('toolbox', 'Escape does not clear the filter');
});
await home.close();

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
    await p.waitForTimeout(150);
    const d1 = await p.evaluate(() => window.__seafloor.cam.depth);
    if (!(d1 > d0 && d1 > 0.95)) fail('seafloor-drag', `${w}: scrolling to the bottom leaves the camera at depth ${d1}`);
    await p.close();
  }
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
