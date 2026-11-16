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

// Runs in the page; returns one line per problem.
async function check(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const vw = document.documentElement.clientWidth;
    const name = (el: Element) => {
      const id = el.id ? `#${el.id}` : '';
      const cls = typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/)[0]}` : '';
      return `${el.tagName.toLowerCase()}${id}${cls}`;
    };
    const shown = (el: Element) => {
      if (el.closest('[hidden], template, .sr-only, [inert]')) return false;
      // Inside a closed <details> (its summary aside) nothing is drawn, whatever box Chrome reports.
      const shut = el.closest('details:not([open])');
      if (shut && !el.closest('summary')) return false;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      for (let n: Element | null = el; n; n = n.parentElement) {
        const s = getComputedStyle(n);
        if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.05) return false;
      }
      return true;
    };
    const scrollsOrBleeds = (el: Element) => {
      for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
        if (n.matches('[data-hscroll], [data-clip-ok], [aria-hidden="true"]')) return true;
        const s = getComputedStyle(n);
        if (/(auto|scroll)/.test(s.overflowX)) return true;
        if (s.position === 'fixed') return true;
      }
      return el.closest('[aria-hidden="true"], [data-clip-ok]') !== null;
    };

    // ---- Unit split ----
    const UNIT = /(\d[\d.,]*)[  ](kg\/m³|g\/cm³|m\/s|km\/h|kHz|MHz|GHz|Hz|dB|km|cm|mm|ms|µs|kg|lbf|psi|KB|MB|GB|fps|ac|°C|m|s|g)(?![\p{L}\p{N}])/gu;
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode() as Text | null; n; n = tw.nextNode() as Text | null) {
      const p = n.parentElement;
      if (!p || !n.data.trim() || p.closest('script, style, code, pre, textarea') || !shown(p)) continue;
      for (const m of n.data.matchAll(UNIT)) {
        const r = document.createRange();
        r.setStart(n, m.index!);
        r.setEnd(n, m.index! + m[0].length);
        const tops = [...r.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top));
        if (tops.length > 1 && Math.max(...tops) - Math.min(...tops) > 4) out.push(`unit split: "${m[0]}" breaks across lines in ${name(p)}`);
      }
    }

    // ---- Truncation ----
    const ctx = document.createElement('canvas').getContext('2d')!;
    for (const el of document.querySelectorAll<HTMLElement>('select, button, [role="tab"], .chip, .filter, label, summary, .btn, .tabset > *')) {
      if (!shown(el)) continue;
      if (el instanceof HTMLSelectElement) {
        const s = getComputedStyle(el);
        ctx.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
        const text = el.selectedOptions[0]?.text ?? '';
        const need = ctx.measureText(text).width;
        // Room for the text: the box less its padding and the arrow (about 20px).
        const room = el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight) - 20;
        if (need > room + 1) out.push(`truncated: ${name(el)} shows "${text}" in ${Math.round(room)}px, needs ${Math.round(need)}px`);
        continue;
      }
      const s = getComputedStyle(el);
      if (el.scrollWidth > el.clientWidth + 1 && (s.overflowX !== 'visible' || s.textOverflow === 'ellipsis')) {
        out.push(`truncated: ${name(el)} "${(el.textContent || '').trim().slice(0, 30)}" (${el.scrollWidth} in ${el.clientWidth}px)`);
        continue;
      }
      // Visible text that spills out of its own box (overflow left visible) also counts. Text for
      // screen readers only (.sr-only) sits outside on purpose and is skipped.
      const box = el.getBoundingClientRect();
      const inner = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let spill = false;
      for (let t = inner.nextNode() as Text | null; t && !spill; t = inner.nextNode() as Text | null) {
        if (!t.data.trim() || !t.parentElement || !shown(t.parentElement)) continue;
        const range = document.createRange();
        range.selectNodeContents(t);
        for (const r of range.getClientRects()) if (r.width > 0 && (r.right > box.right + 1.5 || r.left < box.left - 1.5)) spill = true;
      }
      if (spill) out.push(`truncated: ${name(el)} "${(el.textContent || '').trim().slice(0, 30)}" runs out of its box`);
    }

    // ---- Clipping ----
    const clippers = (el: Element) => {
      const list: Element[] = [];
      for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
        const s = getComputedStyle(n);
        if (/(hidden|clip)/.test(s.overflowX) || /(hidden|clip)/.test(s.overflowY)) list.push(n);
      }
      return list;
    };
    const past = (r: DOMRect, el: Element, what: string) => {
      if (r.right > vw + 1 || r.left < -1) return `clipped: ${what} in ${name(el)} runs past the screen (${Math.round(r.left)} to ${Math.round(r.right)} of ${vw})`;
      for (const c of clippers(el)) {
        const b = c.getBoundingClientRect();
        if (r.right > b.right + 1.5 || r.left < b.left - 1.5) return `clipped: ${what} in ${name(el)} is cut by ${name(c)}`;
      }
      return null;
    };
    const seen = new Set<string>();
    const tw2 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = tw2.nextNode() as Text | null; n; n = tw2.nextNode() as Text | null) {
      const p = n.parentElement;
      if (!p || !n.data.trim() || p.closest('script, style, svg, code, pre, textarea, option') || !shown(p) || scrollsOrBleeds(p)) continue;
      const r = document.createRange();
      r.selectNodeContents(n);
      for (const rr of r.getClientRects()) {
        if (!rr.width) continue;
        const msg = past(rr, p, `"${n.data.trim().slice(0, 24)}"`);
        if (msg && !seen.has(msg)) (seen.add(msg), out.push(msg));
        break;
      }
    }
    for (const el of document.querySelectorAll('img, canvas, video, svg:not(svg svg), .pol, .pol-bare, a, button, figcaption')) {
      if (!shown(el) || scrollsOrBleeds(el)) continue;
      // An image filling a cropped window (object-fit) is cropped on purpose: judge its window instead.
      const target = el.matches('img') && el.parentElement && /(hidden|clip)/.test(getComputedStyle(el.parentElement).overflow) ? el.parentElement : el;
      const msg = past(target.getBoundingClientRect(), target, name(el));
      if (msg && !seen.has(msg)) (seen.add(msg), out.push(msg));
    }

    // ---- Readouts ----
    for (const el of document.querySelectorAll('output, [data-readout]')) {
      if (!shown(el)) continue;
      const box = el.closest('figure, .plate, .rfig, [data-fc], .card, .paper, [data-readout-box]');
      if (!box) continue;
      const a = el.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      if (a.left < b.left - 1 || a.right > b.right + 1 || a.top < b.top - 1 || a.bottom > b.bottom + 1) out.push(`readout: ${name(el)} "${(el.textContent || '').trim()}" sits outside ${name(box)}`);
    }
    return out;
  });
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
