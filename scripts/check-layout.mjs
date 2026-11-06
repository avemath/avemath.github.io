// Fails unless the RAMpage figure's Fire button and the plow are on screen together. At each size
// below it scrolls the figure into view (the way a reader gets there), then checks that the Fire,
// Slow-mo and Reset controls, the whole pneumatics drawing and the plow all sit inside the
// viewport, that the toolbar's buttons are at least 44px tall, and that pressing Fire leaves the
// plow on screen and moves it out. Space on the focused drawing must fire too. The drawing must fit
// without scrolling sideways, with its labels at 13px or more on screen.
// Run after a build: `npm run build && npm run test:layout`.
// Needs Playwright's Chromium (`npx playwright install chromium`), or set CHROMIUM_PATH to a Chromium binary.
import { chromium } from 'playwright';
import { serveDist, localOnly } from './lib/serve-dist.mjs';

const SIZES = [
  [1366, 768],
  [1440, 900],
  [1920, 1080],
  [390, 844],
  [375, 667],
  [320, 568],
];

const { server, base } = serveDist('dist');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
let problems = 0;
const fail = (msg) => {
  problems++;
  console.log(`  FAIL ${msg}`);
};

const inside = (b, vw, vh) => b && b.x >= 0 && b.y >= 0 && b.x + b.width <= vw + 0.5 && b.y + b.height <= vh + 0.5;
const fmt = (b) => (b ? `${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}x${Math.round(b.height)}` : 'none');

for (const scheme of ['light', 'dark']) {
  for (const [w, h] of SIZES) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, colorScheme: scheme });
    await page.route(...localOnly(base));
    await page.goto(`${base}/`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const label = `${w}x${h} ${scheme}`;

    const fig = page.locator('#rampage [data-tf]');
    await fig.scrollIntoViewIfNeeded();
    // Land the figure at the top of the screen, under the sticky header, as an anchor link would.
    await page.evaluate(() => document.querySelector('#rampage [data-tf]').scrollIntoView({ block: 'start', behavior: 'instant' }));
    await page.waitForTimeout(150);

    const fire = page.locator('#rampage .tf__bar [data-fire]');
    const reset = page.locator('#rampage .tf__bar [data-reset]');
    const speed = page.locator('#rampage .tf__bar .tf__speed');
    const drawing = page.locator('#rampage .pn__svg');
    const plow = page.locator('#rampage [data-plow]');

    const boxes = {
      fire: await fire.boundingBox(),
      'slow-mo': await speed.boundingBox(),
      reset: await reset.boundingBox(),
      drawing: await drawing.boundingBox(),
      plow: await plow.boundingBox(),
    };
    for (const [name, b] of Object.entries(boxes)) if (!inside(b, w, h)) fail(`${label}: ${name} outside the viewport (${fmt(b)})`);

    // Nothing covers the button or the plow (the header, say).
    const covered = await page.evaluate(() => {
      const hit = (el) => {
        const r = el.getBoundingClientRect();
        const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return t === el || el.contains(t) || (t && t.closest('[data-pn]') === el.closest('[data-pn]') && !!el.closest('[data-pn]'));
      };
      return {
        fire: !hit(document.querySelector('#rampage .tf__bar [data-fire]')),
        plow: !hit(document.querySelector('#rampage [data-plow]')),
      };
    });
    if (covered.fire) fail(`${label}: Fire is covered by another element`);
    if (covered.plow) fail(`${label}: the plow is covered by another element`);

    // The drawing fits its frame (no sideways scroll) with labels at 13px or more on screen.
    const fit = await page.evaluate(() => {
      const frame = document.querySelector('#rampage .pn__frame');
      const svg = document.querySelector('#rampage .pn__svg');
      const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
      const sizes = [...svg.querySelectorAll('text')].map((t) => parseFloat(getComputedStyle(t).fontSize) * scale);
      return { scrolls: frame.scrollWidth > frame.clientWidth + 1, minPx: Math.min(...sizes) };
    });
    if (fit.scrolls) fail(`${label}: the drawing scrolls sideways`);
    if (fit.minPx < 12.95) fail(`${label}: drawing labels render at ${fit.minPx.toFixed(1)}px, under 13px`);

    for (const [name, loc] of [
      ['Fire', fire],
      ['Reset', reset],
    ]) {
      const b = await loc.boundingBox();
      if (!b || b.height < 44) fail(`${label}: ${name} is ${b ? Math.round(b.height) : 0}px tall, under 44px`);
    }

    // Press Fire in real time and check the plow moves out without anything scrolling.
    await page.locator('#rampage .tf__speed input[value="1"]').evaluate((r) => /** @type {HTMLInputElement} */ (r).click());
    const before = await plow.boundingBox();
    const scrollBefore = await page.evaluate(() => scrollY);
    await page.mouse.click(boxes.fire.x + boxes.fire.width / 2, boxes.fire.y + boxes.fire.height / 2);
    await page.waitForTimeout(260);
    const out = await plow.boundingBox();
    const scrollAfter = await page.evaluate(() => scrollY);
    if (scrollAfter !== scrollBefore) fail(`${label}: the page scrolled when Fire was pressed`);
    if (!inside(out, w, h)) fail(`${label}: the plow left the viewport while firing (${fmt(out)})`);
    if (!(out && before && out.x > before.x + 2)) fail(`${label}: the plow did not move out (${fmt(before)} to ${fmt(out)})`);
    if (out && before && Math.abs(out.height - before.height) > 0.5) fail(`${label}: the plow changed shape while firing`);

    // Reset brings it home; Space on the focused drawing fires again.
    await page.waitForTimeout(800);
    await reset.click();
    await page.locator('#rampage [data-tf-pn]').focus();
    await page.keyboard.press('Space');
    await page.waitForTimeout(260);
    const spaced = await plow.boundingBox();
    if (!(spaced && before && spaced.x > before.x + 2)) fail(`${label}: Space on the drawing did not fire`);

    console.log(`${label}: fire ${fmt(boxes.fire)}, plow ${fmt(boxes.plow)}, drawing ${fmt(boxes.drawing)}`);
    await page.close();
  }
}

await browser.close();
server.close();
if (problems) {
  console.log(`\n${problems} layout problem(s).`);
  process.exit(1);
}
console.log('\nRAMpage layout: Fire and the plow are on screen together at every size.');
