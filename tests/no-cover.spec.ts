// Nothing covers a photo or a line of text. On every built page at 390, 768, 1280 and 1440 wide (and
// on About once for every datasheet pin), it scrolls the page a screen at a time and samples points
// across each photo (img, video, or a canvas marked data-photo) and each line of text. At every
// point it asks the browser what is painted there, top first; anything painted above the photo or
// the text that has a visible background or border (or is itself an image) is a cover, and fails.
//   - A decoration may sit over text only when it carries data-overlap="ok". Nothing may sit over a
//     photo's image area, data-overlap or not.
//   - A part of the page where layering is the design opts out as a whole with
//     data-overlap="layered" on its container: nothing inside it is checked. Used today on the
//     website mockups (a phone screenshot over the desktop one) and the full-width backdrop stills
//     behind the home page's closing band and the research page. Each is listed in docs/AUDIT-2026-11-14.md for review.
//   - Fixed and sticky layers (the header, the bit girl, the depth gauge) move with the scroll and
//     are left to check-layout.mjs.
// Then the About datasheet's edges: at every width from 320 to 1920 and for every pin, nothing in
// the sheet reaches past the sheet, and the page never scrolls sideways.
// Run after a build: `node tests/no-cover.spec.ts` (Node strips the types). Needs Playwright's Chromium.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright';
import { serveDist, localOnly } from '../scripts/lib/serve-dist.mjs';

type Hit = { kind: 'photo' | 'text'; what: string; by: string; x: number; y: number };

const WIDTHS: [number, number][] = [
  [390, 844],
  [768, 1024],
  [1280, 800],
  [1440, 900],
];

// Every page in the build, plus the 404 page.
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
// NOCOVER_PAGES=/about/,/work/ limits the run to those pages (and skips the datasheet edge sweep unless /about/ is in it).
const only = process.env.NOCOVER_PAGES?.split(',');
if (only) pages.splice(0, pages.length, ...pages.filter((p) => only.includes(p)));

// Runs in the page: scrolls a screen at a time and reports every covered point.
async function scan(page: Page): Promise<Hit[]> {
  return page.evaluate(async () => {
    const hits: Hit[] = [];
    const force = document.createElement('style');
    // Every element must answer elementsFromPoint, decorations that ignore the pointer included.
    force.textContent = '*, *::before, *::after { pointer-events: auto !important; }';
    document.head.append(force);

    const transparent = (c: string) => c === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(c);
    const paints = (el: Element) => {
      if (/^(IMG|VIDEO)$/.test(el.tagName)) return true;
      const s = getComputedStyle(el);
      if (!transparent(s.backgroundColor) || s.backgroundImage !== 'none') return true;
      return (['Top', 'Right', 'Bottom', 'Left'] as const).some(
        (side) => parseFloat(s.getPropertyValue(`border-${side.toLowerCase()}-width`)) > 0 && s.getPropertyValue(`border-${side.toLowerCase()}-style`) !== 'none' && !transparent(s.getPropertyValue(`border-${side.toLowerCase()}-color`)),
      );
    };
    const shown = (el: Element) => {
      for (let n: Element | null = el; n; n = n.parentElement) {
        const s = getComputedStyle(n);
        if (s.visibility === 'hidden' || Number(s.opacity) < 0.05) return false;
      }
      return true;
    };
    const floating = (el: Element) => {
      for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) {
        const p = getComputedStyle(n).position;
        if (p === 'fixed' || p === 'sticky') return true;
      }
      return false;
    };
    const layered = (el: Element) => !!el.closest('[data-overlap="layered"]');
    const name = (el: Element) => {
      const id = el.id ? `#${el.id}` : '';
      const cls = typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : '';
      return `${el.tagName.toLowerCase()}${id}${cls}`;
    };

    const head = document.querySelector('.site-header');
    const topEdge = () => Math.max(0, head ? head.getBoundingClientRect().bottom : 0);
    const seen = new Set<string>();

    // What is painted above `target` at (x, y): the first thing over it that covers it, if any.
    const coverAt = (x: number, y: number, target: Element, isPhoto: boolean, inside?: (e: Element) => boolean) => {
      const stack = document.elementsFromPoint(x, y);
      const at = stack.findIndex((e) => e === target || (inside && inside(e)));
      if (at < 0) return null; // the point is off the target (a tilted print's corner)
      for (const e of stack.slice(0, at)) {
        if (target.contains(e) || e.contains(target)) continue;
        if (floating(e) || !shown(e) || !paints(e)) continue;
        if (!isPhoto && e.closest('[data-overlap="ok"]')) continue;
        return e;
      }
      return null;
    };

    const photos = () =>
      [...document.querySelectorAll<HTMLElement>('img, video, canvas[data-photo]')].filter((el) => {
        if (el instanceof HTMLImageElement && /\.svg($|\?)/.test(el.currentSrc || el.src)) return false;
        const r = el.getBoundingClientRect();
        return r.width >= 24 && r.height >= 24 && shown(el) && !floating(el) && !layered(el);
      });

    const texts = () => {
      const out: Text[] = [];
      const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => {
          const p = n.parentElement;
          if (!p || !n.textContent?.trim()) return NodeFilter.FILTER_REJECT;
          if (p.closest('svg, script, style, noscript, template, .sr-only, [hidden]')) return NodeFilter.FILTER_REJECT;
          // A closed <details> keeps its answer in the DOM but does not draw it.
          const shut = p.closest('details:not([open])');
          if (shut && !p.closest('summary')) return NodeFilter.FILTER_REJECT;
          if (floating(p) || layered(p) || !shown(p)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      for (let n = tw.nextNode(); n; n = tw.nextNode()) out.push(n as Text);
      return out;
    };

    const vh = window.innerHeight;
    const total = document.documentElement.scrollHeight;
    for (let y = 0; y < total; y += Math.max(200, vh - 160)) {
      window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const top = topEdge() + 2;
      const bottom = vh - 2;
      const sy = window.scrollY;

      for (const el of photos()) {
        const r = el.getBoundingClientRect();
        if (r.bottom < top || r.top > bottom) continue;
        const s = getComputedStyle(el);
        const pad = (k: string) => parseFloat(s.getPropertyValue(k)) || 0;
        const L = r.left + pad('border-left-width') + pad('padding-left');
        const R = r.right - pad('border-right-width') - pad('padding-right');
        const T = r.top + pad('border-top-width') + pad('padding-top');
        const B = r.bottom - pad('border-bottom-width') - pad('padding-bottom');
        for (let i = 0; i <= 8; i++) {
          for (let j = 0; j <= 8; j++) {
            const x = L + 1 + ((R - L - 2) * i) / 8;
            const yy = T + 1 + ((B - T - 2) * j) / 8;
            if (yy < top || yy > bottom || x < 0 || x > window.innerWidth) continue;
            const key = `p${Math.round(x)},${Math.round(yy + sy)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const by = coverAt(x, yy, el, true);
            if (by) hits.push({ kind: 'photo', what: `${name(el)} ${(el.getAttribute('alt') || '').slice(0, 40)}`, by: name(by), x: Math.round(x), y: Math.round(yy + sy) });
          }
        }
      }

      for (const t of texts()) {
        const range = document.createRange();
        range.selectNodeContents(t);
        const owner = t.parentElement as Element;
        for (const r of range.getClientRects()) {
          if (r.width < 2 || r.height < 2 || r.bottom < top || r.top > bottom) continue;
          for (const fx of [0.15, 0.5, 0.85]) {
            const x = r.left + r.width * fx;
            const yy = r.top + r.height / 2;
            if (yy < top || yy > bottom || x < 0 || x > window.innerWidth) continue;
            const key = `t${Math.round(x)},${Math.round(yy + sy)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const by = coverAt(x, yy, owner, false, (e) => e.contains(t));
            if (by) hits.push({ kind: 'text', what: `${name(owner)} "${(t.textContent || '').trim().slice(0, 40)}"`, by: name(by), x: Math.round(x), y: Math.round(yy + sy) });
          }
        }
      }
    }
    force.remove();
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    return hits;
  });
}

const { server, base } = serveDist('dist');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
let problems = 0;
const fail = (msg: string) => {
  problems++;
  console.log(`  FAIL ${msg}`);
};
const report = (label: string, hits: Hit[]) => {
  // One line per covered thing, not per sampled point.
  const byThing = new Map<string, Hit>();
  for (const h of hits) if (!byThing.has(`${h.what}|${h.by}`)) byThing.set(`${h.what}|${h.by}`, h);
  for (const h of byThing.values()) fail(`${label}: ${h.kind} ${h.what} is covered by ${h.by} (at ${h.x},${h.y})`);
};

const open = async (w: number, h: number, path: string) => {
  const page = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  const [match, handler] = localOnly(base);
  await page.route(match, handler);
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  return page;
};

try {
  for (const [w, h] of WIDTHS) {
    for (const path of pages) {
      const page = await open(w, h, path);
      report(`${w} ${path}`, await scan(page));
      if (path === '/about/') {
        const n = await page.locator('#datasheet [data-pin]').count();
        for (let i = 0; i < n; i++) {
          await page.locator(`#datasheet [data-pin="${i}"]`).click();
          await page.waitForTimeout(50);
          const label = (await page.locator(`#datasheet [data-pin="${i}"] .pin__nm`).textContent())?.trim();
          // Only the datasheet changes from pin to pin, so only it is scanned again.
          await page.evaluate(() => document.querySelector('#datasheet')?.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior }));
          const hits = (await scan(page)).filter((x) => /slip|note|pol|ds__|dip|pin|ch/.test(x.what + x.by));
          report(`${w} /about/ pin ${label}`, hits);
          // The frames too: the note never sits on a print (frame and caption strip included), and two
          // prints overlap by 12px at most.
          const frames = await page.evaluate(() => {
            const slip = [...document.querySelectorAll<HTMLElement>('[data-slip]')].find((s) => !s.hidden)!;
            const prints = [...slip.querySelectorAll<HTMLElement>('.pol, .pol-bare')];
            const note = slip.querySelector<HTMLElement>('.note')!;
            const out: string[] = [];
            const force = document.createElement('style');
            force.textContent = '*, *::before, *::after { pointer-events: auto !important; }';
            document.head.append(force);
            for (const p of prints) {
              p.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
              const r = p.getBoundingClientRect();
              for (let i = 0; i <= 12; i++)
                for (let j = 0; j <= 12; j++) {
                  const x = r.left + 1 + ((r.width - 2) * i) / 12;
                  const y = r.top + 1 + ((r.height - 2) * j) / 12;
                  const stack = document.elementsFromPoint(x, y);
                  const at = stack.findIndex((e) => p.contains(e));
                  if (at < 0) continue;
                  if (stack.slice(0, at).some((e) => note.contains(e))) out.push(`the note sits on a print (${Math.round(x)},${Math.round(y)})`);
                }
            }
            force.remove();
            if (prints.length === 2) {
              const [a, b] = prints.map((p) => p.getBoundingClientRect());
              const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
              const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
              if (ox > 0 && oy > 0 && Math.min(ox, oy) > 12) out.push(`the two prints overlap by ${Math.round(Math.min(ox, oy))}px`);
            }
            return [...new Set(out.map((m) => m.replace(/ \(.*/, '')))];
          });
          for (const m of frames) fail(`${w} /about/ pin ${label}: ${m}`);
        }
      }
      await page.close();
    }
  }

  // The datasheet's edges, every pin, 320 to 1920.
  if (pages.includes('/about/')) for (const w of [320, 340, 360, 375, 390, 414, 480, 600, 768, 859, 860, 1024, 1199, 1200, 1280, 1366, 1440, 1600, 1920]) {
    const page = await open(w, 900, '/about/');
    const n = await page.locator('#datasheet [data-pin]').count();
    for (let i = 0; i < n; i++) {
      await page.locator(`#datasheet [data-pin="${i}"]`).click();
      const v = await page.evaluate(() => {
        const sheet = document.querySelector('.ds__sheet') as HTMLElement;
        const s = sheet.getBoundingClientRect();
        const out: string[] = [];
        for (const el of sheet.querySelectorAll<HTMLElement>('*')) {
          if (el.closest('[hidden], .sr-only') || !el.getClientRects().length) continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.left < s.left - 0.5 || r.right > s.right + 0.5) out.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} ${Math.round(r.left)} to ${Math.round(r.right)} (sheet ${Math.round(s.left)} to ${Math.round(s.right)})`);
          // Text cut short inside its own box (a pin name, a table cell).
          if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === 'hidden') out.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} clips its content`);
        }
        const pageW = document.documentElement.clientWidth;
        if (s.left < 0 || s.right > pageW + 0.5) out.push(`the sheet runs off the page (${Math.round(s.left)} to ${Math.round(s.right)} of ${pageW})`);
        if (document.documentElement.scrollWidth > pageW) out.push(`the page scrolls sideways by ${document.documentElement.scrollWidth - pageW}px`);
        return out;
      });
      for (const m of [...new Set(v)].slice(0, 6)) fail(`${w} /about/ pin ${i + 1}: ${m}`);
    }
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

if (problems) {
  console.log(`\n${problems} problem(s).`);
  process.exit(1);
}
console.log(`No photo or text is covered on ${pages.length} pages at ${WIDTHS.map(([w]) => w).join(', ')}, and the datasheet stays on its sheet from 320 to 1920.`);
