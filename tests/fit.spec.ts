// Everything fits. On every built page, in every state a reader can open (each tab, each About pin),
// at the standard viewports and the laptop ones from scripts/lib/viewports.mjs, it checks:
//   - unit split: a value and its unit ("1.3 km", "20 dB", "69.00 s") render on one line;
//   - truncation: no select, button, tab, chip, filter or form label cuts its text short (a select's
//     chosen option fits its box; nothing else scrolls or spills past its own box);
//   - clipping: no text, picture, print, link or button runs past the screen's right or left edge, or
//     past a container that clips it, unless it sits in a region made to scroll ([data-hscroll] or a
//     scrolling box) or one marked data-clip-ok (a decoration meant to bleed, like the marquee);
//   - readouts: every live readout (output elements and [data-readout]: clocks, counters, slider
//     values) stays inside its figure box.
// FIT_THEMES=light,dark checks both themes (the default is light; layout does not change with the
// theme); FIT_PAGES=/,/about/ limits the pages; FIT_VIEWPORTS=960x640,... limits the viewports.
// Run after a build: `node tests/fit.spec.ts`. Part of test:layout.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright';
import { serveDist, localOnly } from '../scripts/lib/serve-dist.mjs';
import { fitInPage } from '../scripts/lib/page-checks.mjs';
import { ALL, pageOpts } from '../scripts/lib/viewports.mjs';

const pages: string[] = ['/404.html'];
const walk = (dir: string, url: string) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === '_astro' || name === 'media' || name === 'og') continue;
      walk(p, `${url}${name}/`);
    } else if (name === 'index.html') pages.push(url);
  }
};
walk('dist', '/');
const onlyPages = process.env.FIT_PAGES?.split(',');
const PAGES = onlyPages ? pages.filter((p) => onlyPages.includes(p)) : pages;
const onlyVp = process.env.FIT_VIEWPORTS?.split(',');
const VIEWPORTS = onlyVp ? ALL.filter((v: { label: string }) => onlyVp.includes(v.label)) : ALL;
const THEMES = (process.env.FIT_THEMES || 'light').split(',');

// Runs in the page (scripts/lib/page-checks.mjs, shared with the sweep); one line per problem.
async function check(page: Page): Promise<string[]> {
  return page.evaluate(fitInPage);
}

// Every state a reader can open: each tab of each tablist, and each About pin. Returns after each one.
async function* states(page: Page, path: string): AsyncGenerator<string> {
  yield 'as loaded';
  const tabs = await page.locator('[role="tab"]').all();
  for (const t of tabs) {
    if (!(await t.isVisible()) || (await t.getAttribute('aria-selected')) === 'true') continue;
    const label = ((await t.textContent()) || '').trim();
    await t.click().catch(() => {});
    await page.waitForTimeout(120);
    yield `tab "${label}"`;
  }
  if (path === '/about/') {
    const n = await page.locator('#datasheet [data-pin]').count();
    for (let i = 0; i < n; i++) {
      await page.locator(`#datasheet [data-pin="${i}"]`).click();
      await page.waitForTimeout(80);
      yield `pin ${i + 1}`;
    }
  }
}

const { server, base } = serveDist(process.env.FIT_DIST || 'dist');
// Classic scrollbars, as Windows shows them: they take about 15px from the page's width, which a
// headless browser (scrollbars hidden) never does. FIT_SCROLLBARS=0 hides them again.
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, ignoreDefaultArgs: process.env.FIT_SCROLLBARS === '0' ? [] : ['--hide-scrollbars'] });
const problems = new Map<string, string[]>();
try {
  for (const theme of THEMES) {
    for (const v of VIEWPORTS) {
      for (const path of PAGES) {
        const page = await browser.newPage(pageOpts(v, { colorScheme: theme as 'light' | 'dark', reducedMotion: 'reduce' }));
        const [match, handler] = localOnly(base);
        await page.route(match, handler);
        await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
        await page.evaluate(async () => {
          await document.fonts.ready;
          // Lay the whole page out (sections that skip their layout until near), then back to the top.
          document.documentElement.classList.add('cv-off');
          for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight) {
            scrollTo(0, y);
            await new Promise((r) => requestAnimationFrame(r));
          }
          scrollTo(0, 0);
        });
        for await (const state of states(page, path)) {
          for (const msg of await check(page)) {
            const key = `${path} | ${msg}`;
            const where = `${v.label}${THEMES.length > 1 ? ` ${theme}` : ''}${state === 'as loaded' ? '' : `, ${state}`}`;
            if (!problems.has(key)) problems.set(key, []);
            problems.get(key)!.push(where);
          }
        }
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

if (problems.size) {
  for (const [key, where] of problems) console.log(`  FAIL ${key}  [${[...new Set(where)].slice(0, 6).join('; ')}${where.length > 6 ? `; +${where.length - 6}` : ''}]`);
  console.log(`\n${problems.size} fit problem(s).`);
  process.exit(1);
}
console.log(`Everything fits: ${PAGES.length} pages, every tab and pin, at ${VIEWPORTS.length} viewports (${THEMES.join(', ')}): no unit split, truncated control, clipped element or stray readout.`);
