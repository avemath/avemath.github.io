// Fails if any figure label runs out of its box. Loads every built page at 320, 390, 768, 1366, 1440, 1920 and 2560,
// light and dark, opens every figure view (Live, Drawing, How it works, Code), every V2V stage,
// every About pin and every RAMpage plow status, and measures:
//   - SVG text against the shape it sits in (rect, circle, ellipse, polygon or closed path): any
//     label that crosses the shape's edge or comes within 4px of it across (1px up and down, since
//     the measured box already includes the font's ascent and descent),
//   - SVG text against other SVG text: any two labels that overlap,
//   - SVG text against straight lines it is not part of (in another group),
//   - SVG text clipped by its viewBox,
//   - HTML text (chips, legends, tooltips, buttons) that runs out of its own box.
// Writes what it finds to audit/label-overflow.md and exits 1 if the list is not empty.
// Run after a build: `npm run build && node scripts/check-labels.mjs`. test:a11y runs it too.
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { chromium } from 'playwright';
import { serveDist, localOnly } from './lib/serve-dist.mjs';

const DIST = 'dist';
const WIDTHS = (process.env.LABEL_WIDTHS || '320,390,768,1366,1440,1920,2560').split(',').map(Number);
const THEMES = (process.env.LABEL_THEMES || 'light,dark').split(',');
const ONLY = process.env.LABEL_PAGES ? process.env.LABEL_PAGES.split(',') : null;
const PLOW = ['Ready', 'Filling', 'Plow out', 'Venting', 'Settling', 'Out of air'];

async function pages(dir = DIST, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await pages(p, out);
    else if (e.name.endsWith('.html')) out.push('/' + relative(DIST, p).replaceAll('\\', '/').replace(/index\.html$/, ''));
  }
  return out.sort();
}

// Runs in the page: every problem visible right now.
function measure() {
  const EDGE_X = 4;
  const EDGE_Y = 1;
  const out = [];
  const visible = (el, thin = false) => {
    const r = el.getBoundingClientRect();
    if (thin ? r.width + r.height < 1 : r.width < 1 || r.height < 1) return null;
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return null;
      if (e.hidden) return null;
    }
    return r;
  };
  const figName = (el) => {
    const h = el.closest('[data-hscroll]')?.getAttribute('data-hscroll');
    if (h) return h;
    const t = el.closest('svg')?.querySelector(':scope > title')?.textContent;
    if (t) return t.trim();
    const host = el.closest('[data-fc], figure, section, aside');
    const lab = host?.querySelector('.fig__label, h2, h3, [aria-label]');
    return (lab?.textContent || lab?.getAttribute('aria-label') || host?.id || 'page').trim().replace(/\s+/g, ' ').slice(0, 60);
  };
  const label = (el) => el.textContent.trim().replace(/\s+/g, ' ').slice(0, 70);
  const add = (el, kind, px, fig) => out.push({ fig: fig ?? figName(el), label: label(el), kind, px: Math.round(px * 10) / 10 });

  // Convex quads (four screen points, in order) for rotated labels.
  const quadOf = (r) => [{ x: r.left, y: r.top }, { x: r.right, y: r.top }, { x: r.right, y: r.bottom }, { x: r.left, y: r.bottom }];
  // How far two convex quads overlap along their least-overlapping axis (separating axis test);
  // 0 or less means apart.
  const overlapDepth = (A, B) => {
    let depth = Infinity;
    for (const P of [A, B]) {
      for (let i = 0; i < P.length; i++) {
        const p = P[i];
        const q = P[(i + 1) % P.length];
        const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
        const n = { x: -(q.y - p.y) / len, y: (q.x - p.x) / len };
        const proj = (Q) => Q.map((v) => v.x * n.x + v.y * n.y);
        const a = proj(A);
        const b = proj(B);
        const o = Math.min(Math.max(...a), Math.max(...b)) - Math.max(Math.min(...a), Math.min(...b));
        if (o <= 0) return 0;
        depth = Math.min(depth, o);
      }
    }
    return depth;
  };
  // Does a segment touch a convex quad (shrunk 1px)?
  const polyHit = (a, b, Q) => {
    const cx = Q.reduce((s, v) => s + v.x, 0) / 4;
    const cy = Q.reduce((s, v) => s + v.y, 0) / 4;
    const S = Q.map((v) => {
      const d = Math.hypot(v.x - cx, v.y - cy) || 1;
      return { x: v.x - ((v.x - cx) / d) * 1.4, y: v.y - ((v.y - cy) / d) * 1.4 };
    });
    const side = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    const inside = (pt) => {
      const s0 = Math.sign(side(S[0], S[1], pt));
      return S.every((v, i) => Math.sign(side(v, S[(i + 1) % 4], pt)) === s0);
    };
    if (inside(a) || inside(b)) return true;
    const cross = (p, q, r, s2) => {
      const d1 = side(p, q, r), d2 = side(p, q, s2), d3 = side(r, s2, p), d4 = side(r, s2, q);
      return d1 * d2 < 0 && d3 * d4 < 0;
    };
    return S.some((v, i) => cross(a, b, v, S[(i + 1) % 4]));
  };

  for (const svg of document.querySelectorAll('main svg')) {
    const sr = visible(svg);
    if (!sr) continue;
    // A rotated label is tested as what it is, a rotated rectangle (its own box turned by its
    // transform), not as the larger upright box around it.
    const outline = (t) => {
      const m = t.getScreenCTM();
      if (!m || (Math.abs(m.b) < 1e-3 && Math.abs(m.c) < 1e-3)) return null;
      const bb = t.getBBox();
      const top = bb.y + bb.height * 0.15;
      const bot = bb.y + bb.height * 0.85;
      return [[bb.x, top], [bb.x + bb.width, top], [bb.x + bb.width, bot], [bb.x, bot]].map(([x, y]) => new DOMPoint(x, y).matrixTransform(m));
    };
    const texts = [...svg.querySelectorAll('text')]
      .filter((t) => t.textContent.trim())
      .map((t) => ({ t, r: visible(t) }))
      .filter((x) => x.r)
      .map((x) => ({ ...x, q: outline(x.t) }));
    if (!texts.length) continue;
    const fig = figName(svg);
    const svgArea = sr.width * sr.height;
    const shapes = [...svg.querySelectorAll('rect, circle, ellipse, polygon, path')]
      .filter((s) => s.tagName !== 'path' || /z\s*$/i.test(s.getAttribute('d') || ''))
      .filter((s) => !s.closest('clipPath, mask, defs, marker, pattern'))
      .filter((s) => {
        // A box is something you can see: invisible hover targets do not count.
        const cs = getComputedStyle(s);
        const paint = (v, o) => v && v !== 'none' && !/rgba\([^)]*,\s*0\)$/.test(v) && v !== 'transparent' && Number(o) > 0;
        return paint(cs.fill, cs.fillOpacity) || (paint(cs.stroke, cs.strokeOpacity) && parseFloat(cs.strokeWidth) > 0);
      })
      .map((s) => ({ s, r: visible(s) }))
      .filter((x) => x.r && x.r.width > 6 && x.r.height > 6 && x.r.width * x.r.height < svgArea * 0.4);
    const lines = [...svg.querySelectorAll('line, path')]
      .filter((l) => !l.closest('clipPath, mask, defs, marker, pattern'))
      // A backdrop (the workbench's cutting mat grid) is texture behind everything, not a line a label can cross.
      .filter((l) => !l.closest('[data-label-bg]'))
      .filter((l) => visible(l, true))
      .map((l) => {
        if (l.tagName === 'line') {
          const ctm = l.getScreenCTM();
          const p = (x, y) => new DOMPoint(x, y).matrixTransform(ctm);
          return { l, a: p(l.x1.baseVal.value, l.y1.baseVal.value), b: p(l.x2.baseVal.value, l.y2.baseVal.value) };
        }
        // A path that is one straight segment: M x y L x y, or M x y H x, or M x y V y.
        const d = (l.getAttribute('d') || '').trim();
        const m = d.match(/^M\s*([-\d.]+)[ ,]+([-\d.]+)\s*([LHV])\s*([-\d.]+)(?:[ ,]+([-\d.]+))?\s*$/i);
        if (!m) return null;
        const ctm = l.getScreenCTM();
        const p = (x, y) => new DOMPoint(x, y).matrixTransform(ctm);
        const x1 = +m[1], y1 = +m[2], v = +m[4];
        const rel = m[3] === m[3].toLowerCase();
        const c = m[3].toUpperCase();
        const [x2, y2] = c === 'L' ? (rel ? [x1 + v, y1 + +m[5]] : [v, +m[5]]) : c === 'H' ? [rel ? x1 + v : v, y1] : [x1, rel ? y1 + v : v];
        return { l, a: p(x1, y1), b: p(x2, y2) };
      })
      .filter(Boolean);

    const clips = getComputedStyle(svg).overflow !== 'visible';
    // Callout circles belong with their numerals: a clipped circle is a clipped label.
    if (clips) {
      for (const c of svg.querySelectorAll('.co circle')) {
        const r = visible(c);
        if (!r) continue;
        const over = Math.max(sr.left - r.left, r.right - sr.right, sr.top - r.top, r.bottom - sr.bottom);
        if (over > 0.5) add(c.parentElement, 'callout clipped by the viewBox', over, fig);
      }
    }
    for (const { t, r } of texts) {
      if (clips) {
        const over = Math.max(sr.left - r.left, r.right - sr.right, sr.top - r.top - 2, r.bottom - sr.bottom - 2);
        if (over > 0.5) add(t, 'clipped by the viewBox', over, fig);
      }
      // The box it sits in: the smallest shape holding the label's center that is big enough to be a box for it.
      const cx = (r.left + r.right) / 2;
      const cy = (r.top + r.bottom) / 2;
      const box = shapes
        .filter(({ s, r: b }) => !s.contains(t) && cx > b.left && cx < b.right && cy > b.top && cy < b.bottom && b.width * b.height > r.width * r.height * 0.6 && b.height > r.height * 0.7)
        .sort((a, b) => a.r.width * a.r.height - b.r.width * b.r.height)[0];
      if (box) {
        const b = box.r;
        const over = Math.max(b.left + EDGE_X - r.left, r.right - (b.right - EDGE_X), b.top + EDGE_Y - r.top, r.bottom - (b.bottom - EDGE_Y));
        if (over > 0.5) add(t, r.left < b.left || r.right > b.right ? 'crosses its box' : 'within 4px of its box edge', over, fig);
      }
    }
    // Label on label. The measured boxes include line spacing, so they are trimmed 15% top and bottom.
    const ink = (r) => ({ left: r.left, right: r.right, top: r.top + r.height * 0.15, bottom: r.bottom - r.height * 0.15 });
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        if (texts[i].q || texts[j].q) {
          const qa = texts[i].q ?? quadOf(ink(texts[i].r));
          const qb = texts[j].q ?? quadOf(ink(texts[j].r));
          const d = overlapDepth(qa, qb);
          if (d > 1) add(texts[i].t, `overlaps "${label(texts[j].t)}"`, d, fig);
          continue;
        }
        const a = ink(texts[i].r);
        const b = ink(texts[j].r);
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w > 1 && h > 1) add(texts[i].t, `overlaps "${label(texts[j].t)}"`, Math.min(w, h), fig);
      }
    }
    // Label on a line from another group.
    for (const { t, r, q } of texts) {
      const k = ink(r);
      const box = { left: k.left + 1, right: k.right - 1, top: k.top + 1, bottom: k.bottom - 1 };
      for (const { l, a, b } of lines) {
        // Lines in the label's own group (a callout and its leader, a chip and its border) are part of it.
        const g = l.parentElement;
        if (g.tagName === 'g' && g.contains(t)) continue;
        if (q ? polyHit(a, b, q) : hits(a, b, box)) {
          add(t, 'crosses a line', 1, fig);
          break;
        }
      }
    }
  }

  // HTML text that runs out of its own box.
  for (const el of document.querySelectorAll('main *')) {
    if (el.closest('svg, script, style, pre, code, [data-marquee], .sr-only')) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const cs = getComputedStyle(el);
    if (cs.display.startsWith('inline') && cs.display !== 'inline-block' && cs.display !== 'inline-flex') continue;
    if (/(auto|scroll)/.test(cs.overflowX)) continue;
    if (!visible(el)) continue;
    const over = el.scrollWidth - el.clientWidth;
    if (over > 1) add(el, 'text runs out of its box', over);
  }
  return out;

  // Does segment a-b cross rectangle box?
  function hits(a, b, box) {
    const inside = (p) => p.x > box.left && p.x < box.right && p.y > box.top && p.y < box.bottom;
    if (inside(a) || inside(b)) return true;
    const edges = [
      [{ x: box.left, y: box.top }, { x: box.right, y: box.top }],
      [{ x: box.right, y: box.top }, { x: box.right, y: box.bottom }],
      [{ x: box.right, y: box.bottom }, { x: box.left, y: box.bottom }],
      [{ x: box.left, y: box.bottom }, { x: box.left, y: box.top }],
    ];
    const cross = (p, q, r, s) => {
      const d = (q.x - p.x) * (s.y - r.y) - (q.y - p.y) * (s.x - r.x);
      if (!d) return false;
      const u = ((r.x - p.x) * (s.y - r.y) - (r.y - p.y) * (s.x - r.x)) / d;
      const v = ((r.x - p.x) * (q.y - p.y) - (r.y - p.y) * (q.x - p.x)) / d;
      return u > 0 && u < 1 && v > 0 && v < 1;
    };
    return edges.some(([r, s]) => cross(a, b, r, s));
  }
}

const { server, base } = serveDist(DIST);
const list = (await pages()).filter((p) => !ONLY || ONLY.includes(p));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const found = new Map();

const record = (path, width, theme, state, items) => {
  for (const it of items) {
    const key = [path, width, theme, it.fig, it.label, it.kind].join('|');
    const prev = found.get(key);
    if (!prev || prev.px < it.px) found.set(key, { path, width, theme, state, ...it });
  }
};

for (const theme of THEMES) {
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ colorScheme: theme, viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    await ctx.route(...localOnly(base));
    const page = await ctx.newPage();
    for (const path of list) {
      await page.goto(base + path, { waitUntil: 'networkidle' });
      await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme);
      await page.evaluate(() => document.fonts.ready);
      const run = async (state) => record(path, width, theme, state, await page.evaluate(measure));
      await run('page');

      for (const view of ['drawing', 'how', 'code', 'live']) {
        const n = await page.evaluate((v) => {
          const tabs = document.querySelectorAll(`[data-fc] [role="tab"][data-view="${v}"]`);
          tabs.forEach((t) => t.click());
          return tabs.length;
        }, view);
        if (n) await run(`${view} view`);
      }
      const small = await page.evaluate(() => {
        const tabs = document.querySelectorAll('[data-tabs] [role="tab"]:last-child');
        tabs.forEach((t) => t.click());
        return tabs.length;
      });
      if (small) await run('second tabs');

      const stages = await page.locator('.cf__stage').count();
      for (let i = 0; i < stages; i++) {
        await page.locator('.cf__stage').nth(i).click();
        await run(`V2V stage ${i + 1}`);
      }
      const pins = await page.locator('[data-pin]').count();
      for (let i = 0; i < pins; i++) {
        await page.evaluate((k) => document.querySelector(`[data-pin="${k}"]`).click(), i);
        await run(`pin ${i + 1}`);
      }
      if (await page.locator('[data-tf-state]').count()) {
        for (const word of PLOW) {
          await page.evaluate((w) => {
            document.querySelectorAll('[data-tf-state], [data-pn-status]').forEach((e) => (e.textContent = w));
            document.querySelectorAll('[data-pn-exhaust], [data-pn-inlets]').forEach((e) => (e.textContent = 'closed'));
          }, word);
          await run(`plow ${word}`);
        }
      }
    }
    await ctx.close();
  }
}
await browser.close();
server.close();

const rows = [...found.values()].sort((a, b) => b.px - a.px);
await mkdir('audit', { recursive: true });
const md = [
  '# Label overflow',
  '',
  `Measured ${new Date().toISOString().slice(0, 10)}: ${list.length} pages at ${WIDTHS.join(', ')}, ${THEMES.join(' and ')}, every figure view, V2V stage, About pin and plow status. Rule: no label crosses its box or comes within 4px of it across (1px up and down), overlaps another label or a line it is not part of, or is clipped; no HTML text runs out of its box.`,
  '',
  rows.length ? '| Page | Width | Theme | Figure | Label | Problem | px over | Seen in |' : 'Nothing found.',
  ...(rows.length ? ['|---|---|---|---|---|---|---|---|'] : []),
  ...rows.map((r) => `| ${r.path} | ${r.width} | ${r.theme} | ${r.fig.replaceAll('|', '/')} | ${r.label.replaceAll('|', '/')} | ${r.kind.replaceAll('|', '/')} | ${r.px} | ${r.state} |`),
  '',
].join('\n');
await writeFile('audit/label-overflow.md', md);

if (rows.length) {
  console.error(`check-labels: ${rows.length} label problem(s); see audit/label-overflow.md.`);
  process.exit(1);
}
console.log(`check-labels clean (${list.length} pages, ${WIDTHS.length} widths, ${THEMES.length} themes).`);
