// Screenshots the About datasheet with each pin pressed, at 1440 by 900 and 390 by 844, in light and
// dark, into docs/audit-nov14/about/ (or the folder given as the first argument). Landed on
// #datasheet the way the hero button lands a reader, with motion reduced so every print is at rest.
// Run after a build: `node scripts/shoot-pins.mjs [out-dir]`.
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { serveDist, localOnly } from './lib/serve-dist.mjs';

const out = process.argv[2] || 'docs/audit-nov14/about';
await mkdir(out, { recursive: true });
const { server, base } = serveDist('dist');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

try {
  for (const scheme of ['light', 'dark']) {
    for (const [w, h] of [
      [1440, 900],
      [390, 844],
    ]) {
      const page = await browser.newPage({ viewport: { width: w, height: h }, colorScheme: scheme, reducedMotion: 'reduce' });
      await page.route(...localOnly(base));
      await page.goto(`${base}/about/#datasheet`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const n = await page.locator('#datasheet [data-pin]').count();
      for (let i = 0; i < n; i++) {
        await page.locator(`#datasheet [data-pin="${i}"]`).click();
        // Wait (briefly) for the shown prints to load; a lazy image that never starts must not stall the run.
        await page.evaluate(() =>
          Promise.race([
            Promise.all([...document.querySelectorAll('#ds-tray .slip:not([hidden]) img')].map((im) => (im.complete ? 0 : new Promise((r) => im.addEventListener('load', r, { once: true }))))),
            new Promise((r) => setTimeout(r, 3000)),
          ]),
        );
        const label = (await page.locator(`#datasheet [data-pin="${i}"] .pin__nm`).textContent()).trim().toLowerCase();
        const file = `${out}/pin${String(i + 1).padStart(2, '0')}-${label}-${w}-${scheme}.png`;
        if (w > 860) {
          await page.evaluate(() => document.querySelector('#datasheet').scrollIntoView({ block: 'start', behavior: 'instant' }));
          await page.waitForTimeout(60);
          await page.screenshot({ path: file });
        } else {
          // Phones: the tray, which sits under the chip, with the sheet's edges around it.
          const box = await page.evaluate(() => {
            const t = document.querySelector('#ds-tray').getBoundingClientRect();
            return { x: 0, y: t.top + window.scrollY - 24, width: document.documentElement.clientWidth, height: t.height + 48 };
          });
          await page.screenshot({ path: file, fullPage: true, clip: box });
        }
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
