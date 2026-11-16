// The audit sweep: every built page at 320, 390, 768, 1024, 1280, 1440 and 1920 wide, light and dark,
// with motion on and reduced. Records console errors, page errors, failed or 4xx/5xx requests,
// sideways page scroll, text that touches a screen edge, tap targets under 44px on phones (links
// inside running text excepted), and animation loops still running with the page scrolled to the
// bottom (nothing animated on screen). Takes a full-page screenshot of each page, motion on, into
// the folder given (default docs/audit-nov14/sweep). Writes the findings as JSON next to them.
// Run after a build: `node scripts/audit-sweep.mjs [out-dir]`.
import { mkdir, writeFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { serveDist, localOnly } from './lib/serve-dist.mjs';
import { LAPTOP } from './lib/viewports.mjs';

const out = process.argv[2] || 'docs/audit-nov14/sweep';
await mkdir(out, { recursive: true });

const pages = ['/404.html'];
async function walk(dir, url) {
  for (const name of await readdir(dir)) {
    const p = join(dir, name);
    if ((await stat(p)).isDirectory()) {
      if (!['_astro', 'media', 'og'].includes(name)) await walk(p, `${url}${name}/`);
    } else if (name === 'index.html') pages.push(url);
  }
}
await walk('dist', '/');

// [width, height, pixel density, label]: the standard sizes, then the laptop ones (scripts/lib/viewports.mjs).
const VIEWPORTS = [[320, 640, 1, '320'], [390, 844, 1, '390'], [768, 1024, 1, '768'], [1024, 768, 1, '1024'], [1280, 800, 1, '1280'], [1440, 900, 1, '1440'], [1920, 1080, 1, '1920'], ...LAPTOP.map((v) => [v.width, v.height, v.dpr, v.label])];
const { server, base } = serveDist('dist');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const findings = [];
const add = (f) => findings.push(f);

const slug = (p) => (p === '/' ? 'home' : p.replace(/^\/|\/$/g, '').replace(/[/.]/g, '-'));

try {
  for (const path of pages) {
    for (const [w, h, dpr, vlabel] of VIEWPORTS) {
      for (const theme of ['light', 'dark']) {
        for (const motion of ['on', 'reduce']) {
          const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, colorScheme: theme, reducedMotion: motion === 'reduce' ? 'reduce' : 'no-preference', hasTouch: w <= 768, isMobile: false });
          // Count animation frames so a loop left running off screen shows up.
          await ctx.addInitScript(() => {
            const raf = window.requestAnimationFrame.bind(window);
            window.__frames = 0;
            window.requestAnimationFrame = (cb) => {
              window.__frames++;
              return raf(cb);
            };
          });
          const page = await ctx.newPage();
          await page.route(...localOnly(base));
          const where = { page: path, width: vlabel, theme, motion };
          page.on('console', (m) => m.type() === 'error' && add({ ...where, kind: 'console', msg: m.text().slice(0, 200) }));
          page.on('pageerror', (e) => add({ ...where, kind: 'pageerror', msg: String(e).slice(0, 200) }));
          page.on('requestfailed', (r) => {
            if (!r.url().startsWith(base)) return;
            add({ ...where, kind: 'requestfailed', msg: `${r.url().replace(base, '')} ${r.failure()?.errorText}` });
          });
          page.on('response', (r) => r.url().startsWith(base) && r.status() >= 400 && !(path === '/404.html' && r.url().endsWith('/404.html')) && add({ ...where, kind: 'http', msg: `${r.status()} ${r.url().replace(base, '')}` }));
          await page.goto(`${base}${path}`, { waitUntil: 'networkidle' }).catch((e) => add({ ...where, kind: 'goto', msg: String(e).slice(0, 120) }));
          await page.evaluate(() => document.fonts.ready);
          // Walk down the page so lazy figures start, as a reader would.
          await page.evaluate(async () => {
            for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight * 0.8) {
              window.scrollTo({ top: y, behavior: 'instant' });
              await new Promise((r) => setTimeout(r, 120));
            }
          });
          await page.waitForTimeout(400);
          const v = await page.evaluate(async ([phone, loops]) => {
            const de = document.documentElement;
            const res = { sideways: de.scrollWidth - de.clientWidth, edge: [], taps: [] };
            const vw = de.clientWidth;
            // Text touching an edge (within 4px), scrolled to the top so nothing is mid-animation.
            const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            for (let n = tw.nextNode(); n; n = tw.nextNode()) {
              const p = n.parentElement;
              if (!p || !n.textContent.trim() || p.closest('svg, script, style, .sr-only, [hidden], [aria-hidden="true"]')) continue;
              const r = document.createRange();
              r.selectNodeContents(n);
              for (const b of r.getClientRects()) {
                if (b.width < 1) continue;
                if (b.left < 4 || b.right > vw - 4) {
                  res.edge.push(`"${n.textContent.trim().slice(0, 30)}" (${Math.round(b.left)} to ${Math.round(b.right)}) in ${p.tagName.toLowerCase()}.${String(p.className).split(' ')[0]}`);
                  break;
                }
              }
            }
            if (phone) {
              for (const el of document.querySelectorAll('a[href], button, input, select, textarea, summary, [role="button"], [tabindex="0"]')) {
                const r = el.getBoundingClientRect();
                const s = getComputedStyle(el);
                if (!r.width || !r.height || s.visibility === 'hidden' || el.closest('[hidden], [inert]')) continue;
                // Links inside running text are exempt (WCAG 2.5.8).
                if (el.tagName === 'A' && s.display === 'inline' && el.closest('p, li, dd, td, figcaption, blockquote')) continue;
                if (r.height < 44 || r.width < 44) {
                  // A small control with room around it (24px target spacing) is a P3, not a fail; record the size.
                  res.taps.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${String(el.className).split(' ')[0]} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
                }
              }
            }
            // Animation loops at the bottom of the page, where no figure is on screen (at 390 and 1440).
            res.frames = 0;
            if (loops) {
              window.scrollTo({ top: de.scrollHeight, behavior: 'instant' });
              await new Promise((r) => setTimeout(r, 600));
              const f0 = window.__frames;
              await new Promise((r) => setTimeout(r, 1500));
              res.frames = window.__frames - f0;
              window.scrollTo({ top: 0, behavior: 'instant' });
            }
            return res;
          }, [w <= 390, w === 390 || w === 1440]);
          if (v.sideways > 0) add({ ...where, kind: 'sideways', msg: `${v.sideways}px` });
          for (const e of v.edge.slice(0, 8)) add({ ...where, kind: 'edge', msg: e });
          if (theme === 'light' && motion === 'on') for (const t of v.taps) add({ ...where, kind: 'tap', msg: t });
          if (v.frames > 10) add({ ...where, kind: 'frames', msg: `${v.frames} animation frames in 1.5s at the bottom of the page` });
          if (motion === 'on') {
            await page.waitForTimeout(200);
            await page.screenshot({ path: `${out}/${slug(path)}-${String(vlabel).replace(/[ %]/g, '')}-${theme}.png`, fullPage: true }).catch((e) => add({ ...where, kind: 'screenshot', msg: String(e).slice(0, 120) }));
          }
          await ctx.close();
        }
      }
    }
    console.log(`${path}: ${findings.filter((f) => f.page === path).length} notes`);
  }
} finally {
  await writeFile(`${out}/findings.json`, JSON.stringify(findings, null, 1));
  await browser.close();
  server.close();
}
