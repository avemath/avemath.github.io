// Fails unless the RAMpage figure's Fire button and the plow are on screen together (on the case study). At each size
// below it scrolls the figure into view (the way a reader gets there), then checks that the Fire,
// Slow-mo and Reset controls, the whole pneumatics drawing and the plow all sit inside the
// viewport, that the toolbar's buttons are at least 44px tall, and that pressing Fire leaves the
// plow on screen and moves it out. Space on the focused drawing must fire too. The drawing must fit
// without scrolling sideways, with its labels at 13px or more on screen.
// Then, at 320, 390, 768, 1440, 1920 and 2560 in both themes: the About chip and tray (12 pins, 01 to
// 06 down the left and 07 to 12 up the right, all beside the chip body; every pin a 44px
// button inside the page, each press bringing out its own print, no sideways scroll); the Research
// seafloor water covering the whole page edge to edge (the live scene fixed to the viewport) with no sideways scroll; and the bit girl on home, About
// and Research: her canvas never takes a click, every perch she may use keeps her clear of text,
// and each page leaves her at least two places to go.
// Run after a build: `npm run build && npm run test:layout`.
// Needs Playwright's Chromium (`npx playwright install chromium`), or set CHROMIUM_PATH to a Chromium binary.
import { chromium } from 'playwright';
import { serveDist, localOnly } from './lib/serve-dist.mjs';

const SIZES = [
  [1366, 768],
  [1440, 900],
  [1920, 1080],
  [2560, 1440],
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
    await page.goto(`${base}/work/rampage/`, { waitUntil: 'networkidle' });
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

// ---- Specimen: the About chip, the Research seafloor and the bit girl ----
const WIDTHS = [320, 390, 768, 1440, 1920, 2560];
// Every line of text on the page, in page coordinates (the bit girl's own canvas has none).
const textBoxes = () => {
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  while (walker.nextNode()) {
    const n = walker.currentNode;
    if (!n.textContent.trim()) continue;
    const el = n.parentElement;
    if (!el || el.closest('script, style, noscript, canvas, [hidden], .sr-only')) continue;
    if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    range.selectNodeContents(n);
    for (const q of range.getClientRects()) if (q.width > 1 && q.height > 1) out.push({ l: q.left + scrollX, t: q.top + scrollY, r: q.right + scrollX, b: q.bottom + scrollY, s: n.textContent.trim().slice(0, 30) });
  }
  return out;
};

for (const scheme of ['light', 'dark']) {
  for (const w of WIDTHS) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' });
    await page.route(...localOnly(base));
    const label = `${w} ${scheme}`;
    const sideways = () => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);

    // The chip and the tray.
    await page.goto(`${base}/about/`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    if (await sideways()) fail(`${label} /about/: the page scrolls sideways`);
    const pins = await page.locator('[data-pin]').count();
    if (pins !== 12) fail(`${label} /about/: ${pins} pins, not 12`);
    // 01 to 06 down the left, 07 to 12 up the right, every pin beside the chip body, none overlapping.
    const geo = await page.evaluate(() => {
      const body = document.querySelector('.dip__body').getBoundingClientRect();
      const ps = [...document.querySelectorAll('[data-pin]')].map((b) => ({ i: Number(b.dataset.pin), n: b.querySelector('.pin__num').textContent.replace(/\D/g, ''), r: b.getBoundingClientRect().toJSON() }));
      return { body: body.toJSON(), ps };
    });
    const half = pins / 2;
    for (const p of geo.ps) {
      const left = p.r.right <= geo.body.left + 1;
      const right = p.r.left >= geo.body.right - 1;
      if (Number(p.n) !== p.i + 1) fail(`${label} /about/: pin ${p.i + 1} is numbered ${p.n}`);
      if (p.i < half ? !left : !right) fail(`${label} /about/: pin ${p.i + 1} is on the wrong side of the chip`);
      if (p.r.top < geo.body.top - 1 || p.r.bottom > geo.body.bottom + 1) fail(`${label} /about/: pin ${p.i + 1} hangs past the chip's ends`);
    }
    const byI = (i) => geo.ps.find((p) => p.i === i).r;
    for (let i = 1; i < pins; i++) {
      if (i === half) continue;
      const a = byI(i - 1);
      const b = byI(i);
      // Left side runs down (each pin below the last); right side runs up.
      const ok = i < half ? b.top >= a.bottom - 0.5 : b.bottom <= a.top + 0.5;
      if (!ok) fail(`${label} /about/: pins ${i} and ${i + 1} are out of order or overlap`);
    }
    const start = await page.locator('[data-pin][aria-pressed="true"]').getAttribute('data-pin');
    if (start !== '7') fail(`${label} /about/: pin ${Number(start) + 1} is out at the start, not 08 FILM`);
    for (let i = 0; i < pins; i++) {
      const pin = page.locator(`[data-pin="${i}"]`);
      const b = await pin.boundingBox();
      if (!b || b.height < 44) fail(`${label} /about/: pin ${i + 1} is under 44px tall`);
      if (!b || b.x < 0 || b.x + b.width > w + 0.5) fail(`${label} /about/: pin ${i + 1} runs off the page (${fmt(b)})`);
      await pin.click();
      const shown = await page.evaluate(() => [...document.querySelectorAll('[data-slip]')].filter((s) => !s.hidden).map((s) => s.dataset.slip));
      if (shown.join() !== String(i)) fail(`${label} /about/: pressing pin ${i + 1} shows print(s) ${shown.join() || 'none'}`);
      if ((await pin.getAttribute('aria-pressed')) !== 'true') fail(`${label} /about/: pin ${i + 1} is not marked pressed`);
      const slip = await page.locator(`[data-slip="${i}"]`).boundingBox();
      if (!slip || slip.x < -0.5 || slip.x + slip.width > w + 0.5) fail(`${label} /about/: print ${i + 1} runs off the page (${fmt(slip)})`);
      if (await sideways()) fail(`${label} /about/: pin ${i + 1}'s print makes the page scroll sideways`);
    }

    // The seafloor: the still layer covers the whole page behind the panels, edge to edge, and
    // the live layer is fixed to the viewport.
    await page.goto(`${base}/research/`, { waitUntil: 'networkidle' });
    const sea = await page.evaluate(() => {
      const a = document.querySelector('.abyss').getBoundingClientRect();
      const rs = document.querySelector('.rs').getBoundingClientRect();
      const live = getComputedStyle(document.querySelector('.abyss__live'));
      return { ax: a.x, aw: a.width, ah: a.height, rh: rs.height, cw: document.documentElement.clientWidth, pos: live.position, inset: [live.top, live.left, live.right, live.bottom].join(' ') };
    });
    if (Math.abs(sea.ax) > 0.5 || Math.abs(sea.aw - sea.cw) > 0.5) fail(`${label} /research/: the water is ${Math.round(sea.aw)}px wide at ${Math.round(sea.ax)}, not the full ${sea.cw}px`);
    if (Math.abs(sea.ah - sea.rh) > 1) fail(`${label} /research/: the water covers ${Math.round(sea.ah)} of the page's ${Math.round(sea.rh)}px`);
    if (sea.pos !== 'fixed' || sea.inset !== '0px 0px 0px 0px') fail(`${label} /research/: the live scene is not fixed to the whole viewport (${sea.pos}, ${sea.inset})`);
    if (await sideways()) fail(`${label} /research/: the page scrolls sideways`);

    // The bit girl.
    for (const path of ['/', '/about/', '/research/']) {
      await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      // She arrives on the visitor's first move.
      await page.mouse.move(4, 4);
      await page.waitForFunction(() => window.__bitGirl, null, { timeout: 5000 });
      const girl = await page.evaluate((src) => {
        const textsAt = new Function(`return (${src})()`);
        const cv = document.querySelector('[data-bit-girl]');
        const boxes = window.__bitGirl.boxes();
        const texts = textsAt();
        const bad = [];
        for (const { i, ledge, usable, box } of boxes) {
          if (!usable) continue;
          const hit = texts.find((t) => t.l < box.right && t.r > box.left && t.t < box.bottom && t.b > box.top);
          if (hit) bad.push(`perch ${i} (${ledge}) covers "${hit.s}"`);
        }
        // Click-through: what is under her middle is the page, never her canvas.
        const cur = boxes[window.__bitGirl.cur].box;
        scrollTo({ top: Math.max(0, cur.top - 200), behavior: 'instant' });
        const x = (cur.left + cur.right) / 2 - scrollX;
        const y = (cur.top + cur.bottom) / 2 - scrollY;
        const under = document.elementFromPoint(x, y);
        return {
          bad,
          usable: boxes.filter((b) => b.usable).length,
          pe: getComputedStyle(cv).pointerEvents,
          hidden: cv.getAttribute('aria-hidden'),
          fixed: getComputedStyle(cv).position,
          takesClick: under === cv,
        };
      }, textBoxes.toString());
      for (const b of girl.bad) fail(`${label} ${path}: ${b}`);
      if (girl.usable < 2) fail(`${label} ${path}: the bit girl has ${girl.usable} usable perch(es), needs at least 2`);
      if (girl.pe !== 'none' || girl.takesClick) fail(`${label} ${path}: the bit girl's canvas can take a click`);
      if (girl.hidden !== 'true' || girl.fixed !== 'fixed') fail(`${label} ${path}: the bit girl's canvas must be fixed and aria-hidden`);
    }
    // A real click through her canvas lands on what is under it.
    await page.goto(`${base}/about/`, { waitUntil: 'networkidle' });
    const pin = page.locator('[data-pin="2"]');
    await pin.scrollIntoViewIfNeeded();
    const pb = await pin.boundingBox();
    await page.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2);
    if ((await pin.getAttribute('aria-pressed')) !== 'true') fail(`${label}: a click through the bit girl's canvas did not reach the pin under it`);
    console.log(`${label}: chip, seafloor and bit girl checked`);
    await page.close();
  }
}

// ---- About: the datasheet is one page, and the Recommendations band reads in both themes ----
{
  const lum = (rgb) => {
    const c = rgb.map((v) => v / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  // Landed on #datasheet at a laptop size, the chip, the pressed pin's print and the first table
  // row are all on screen below the header.
  for (const [w, h] of [[1440, 900], [1280, 800]]) {
    for (const scheme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width: w, height: h }, colorScheme: scheme });
      await page.route(...localOnly(base));
      await page.goto(`${base}/about/#datasheet`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1500);
      const v = await page.evaluate(() => {
        const r = (e) => e.getBoundingClientRect();
        const slip = [...document.querySelectorAll('[data-slip]')].find((x) => !x.hidden);
        return {
          head: r(document.querySelector('.site-header')).bottom,
          chip: r(document.querySelector('.dip')),
          print: r(slip.querySelector('.pol, .pol-bare')),
          row: r(document.querySelector('.ch tbody tr')),
          sheet: r(document.querySelector('.ds__sheet')),
          table: r(document.querySelector('.ch')),
        };
      });
      for (const [k, b] of [['chip', v.chip], ['print', v.print], ['first table row', v.row]]) {
        if (b.top < v.head - 1 || b.bottom > h + 1) fail(`${w}x${h} ${scheme} /about/#datasheet: the ${k} is not on screen (${Math.round(b.top)} to ${Math.round(b.bottom)})`);
      }
      if (v.table.top < v.sheet.top || v.table.bottom > v.sheet.bottom) fail(`${w}x${h} /about/: the table is not on the datasheet sheet`);
      await page.close();
    }
  }
  // Phones and tablets: the sheet fits the page and the table sits on it, under the tray.
  for (const w of [320, 390, 768]) {
    const page = await browser.newPage({ viewport: { width: w, height: 844 } });
    await page.route(...localOnly(base));
    await page.goto(`${base}/about/`, { waitUntil: 'networkidle' });
    const v = await page.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect();
      return { sw: document.documentElement.scrollWidth - document.documentElement.clientWidth, sheet: r('.ds__sheet'), table: r('.ch'), tray: r('#ds-tray') };
    });
    if (v.sw > 0) fail(`${w} /about/: the page scrolls sideways by ${v.sw}px`);
    if (v.sheet.left < 0 || v.sheet.right > w) fail(`${w} /about/: the datasheet runs off the page`);
    if (v.table.top < v.tray.bottom - 1 || v.table.bottom > v.sheet.bottom) fail(`${w} /about/: the table is not under the tray on the sheet`);
    await page.close();
  }
  // The Recommendations band: every text on it is AA against what is behind it, in both themes,
  // and the band differs from the page around it.
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.route(...localOnly(base));
    await page.goto(`${base}/about/`, { waitUntil: 'networkidle' });
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    const pairs = await page.evaluate(() => {
      const rgb = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number);
      const bgOf = (e) => {
        for (let n = e; n; n = n.parentElement) {
          const c = getComputedStyle(n).backgroundColor;
          if (!/rgba\(.*, 0\)$/.test(c) && c !== 'transparent') return rgb(c);
        }
        return [255, 255, 255];
      };
      const band = document.querySelector('#recommendations');
      const out = [...band.querySelectorAll('h2, p, span')].filter((e) => e.textContent.trim() && !e.children.length).map((e) => ({ t: e.textContent.trim().slice(0, 30), fg: rgb(getComputedStyle(e).color), bg: bgOf(e) }));
      return { out, band: bgOf(band), next: bgOf(band.nextElementSibling) };
    });
    for (const p of pairs.out) {
      const r = ratio(p.fg, p.bg);
      if (r < 4.5) fail(`/about/ ${theme}: "${p.t}" on the Recommendations band is ${r.toFixed(2)}:1, under AA`);
    }
    if (ratio(pairs.band, pairs.next) < 1.15) fail(`/about/ ${theme}: the Recommendations band does not stand apart from the section after it`);
    await page.close();
  }
  console.log('About: the datasheet fits a laptop screen, stacks on phones, and the Recommendations band passes AA in both themes.');
}

// ---- Research: every panel is a full two-column plate at 1440, nothing scrolls sideways on phones ----
{
  for (const w of [1440, 390, 320]) {
    for (const theme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width: w, height: 900 } });
      await page.route(...localOnly(base));
      await page.goto(`${base}/research/`, { waitUntil: 'networkidle' });
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      // The tags are filled by the page's script; wait for it rather than for a fixed time.
      await page.waitForFunction(() => [...document.querySelectorAll('[data-depth-tag]')].every((t) => !t.hidden), null, { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(400);
      const v = await page.evaluate(() => {
        const panels = [...document.querySelectorAll('[data-depth-panel]')].map((p) => {
          const fig = p.querySelector('.rp__fig')?.getBoundingClientRect();
          const text = p.querySelector('.rp__text')?.getBoundingClientRect();
          const tag = p.querySelector('[data-depth-tag]');
          return { id: p.id, fig: fig && fig.toJSON(), text: text && text.toJSON(), figCap: !!p.querySelector('.rp__fig figcaption b'), tag: tag && !tag.hidden ? tag.textContent : null };
        });
        return { panels, sw: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      if (v.sw > 0) fail(`${w} ${theme} /research/: the page scrolls sideways by ${v.sw}px`);
      if (v.panels.length < 5) fail(`${w} /research/: ${v.panels.length} panels, expected 5`);
      for (const p of v.panels) {
        if (!p.fig || !p.text || p.fig.height < 120 || p.text.height < 120) fail(`${w} /research/ #${p.id}: a column is empty (figure ${p.fig?.height | 0}px, text ${p.text?.height | 0}px)`);
        if (!p.figCap) fail(`${w} /research/ #${p.id}: the figure has no "Fig." caption`);
        if (!p.tag || !/^(0|-\d+) m$/.test(p.tag)) fail(`${w} /research/ #${p.id}: no depth tag (${p.tag})`);
        if (w >= 1024) {
          // Side by side: figure on the left, text on the right, the figure the wider of the two.
          if (!(p.fig.right <= p.text.left + 1 && p.fig.width > p.text.width)) fail(`${w} /research/ #${p.id}: the figure is not the wide left column`);
        } else if (p.fig.bottom > p.text.top + 1) fail(`${w} /research/ #${p.id}: the figure does not stack above the text`);
      }
      await page.close();
    }
  }
  // The depth tags agree with the gauge: centered on a panel, the gauge reads its tag.
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.route(...localOnly(base));
  await page.goto(`${base}/research/`, { waitUntil: 'networkidle' });
  for (const id of ['onr', 'bellhop']) {
    // Center it twice: what scrolls into view can still settle (a field note decodes) and move it.
    let got;
    for (let k = 0; k < 3; k++) {
      got = await page.evaluate((id) => {
        const p = document.getElementById(id);
        const r = p.getBoundingClientRect();
        scrollTo({ top: scrollY + r.top + r.height / 2 - innerHeight / 2, behavior: 'instant' });
        return { tag: p.querySelector('[data-depth-tag]').dataset.depth };
      }, id);
      await page.waitForTimeout(700);
    }
    got = await page.evaluate((id) => ({ tag: document.getElementById(id).querySelector('[data-depth-tag]').dataset.depth }), id);
    const gauge = await page.evaluate(() => document.querySelector('[data-depth-gauge]').dataset.depth);
    if (Math.abs(Number(gauge) - Number(got.tag)) > 10) fail(`/research/ #${id}: the tag says ${got.tag} m but the gauge reads ${gauge} m when it is centered`);
  }
  await page.close();
  console.log('Research: five two-column plates at 1440, stacked on phones, no sideways scroll, tags match the gauge.');
}

// ---- /work/: never scrolls sideways; the bench shelf scrolls on phones and keeps 44px targets ----
{
  for (const w of [320, 390, 768, 1440]) {
    for (const theme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width: w, height: 900 } });
      await page.route(...localOnly(base));
      await page.goto(`${base}/work/`, { waitUntil: 'networkidle' });
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      await page.waitForTimeout(300);
      const v = await page.evaluate(() => {
        const objs = [...document.querySelectorAll('[data-bench-svg] .obj[data-bench] .obj__hit')].map((r) => r.getBoundingClientRect());
        return {
          sw: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          small: objs.filter((r) => r.width < 44 || r.height < 44).length,
          n: objs.length,
        };
      });
      if (v.sw > 0) fail(`${w} ${theme} /work/: the page scrolls sideways by ${v.sw}px`);
      if (v.small) fail(`${w} /work/: ${v.small} of ${v.n} bench objects are under 44px`);
      await page.close();
    }
  }
  console.log('Work: no sideways scroll at 320, 390, 768 and 1440 in both themes; every bench object is a 44px target.');
}

// ---- The contour texture is anchored to the page: every band's mask sits at minus its page offset ----
{
  let checked = 0;
  for (const path of ['/', '/about/', '/work/', '/research/', '/contact/']) {
    for (const w of [390, 1440]) {
      for (const theme of ['light', 'dark']) {
        const page = await browser.newPage({ viewport: { width: w, height: 900 }, colorScheme: theme });
        await page.route(...localOnly(base));
        await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(300);
        const bad = await page.evaluate(() => {
          const out = [];
          for (const b of document.querySelectorAll('.topo, .band-paper, .band-sheet')) {
            const r = b.getBoundingClientRect();
            if (!r.height) continue;
            for (const pseudo of ['::before', '::after']) {
              const pos = getComputedStyle(b, pseudo).maskPosition || getComputedStyle(b, pseudo).webkitMaskPosition || '';
              const [mx, my] = pos.split(',')[0].trim().split(/\s+/).map(parseFloat);
              const wantX = -(r.left + scrollX);
              const wantY = -(r.top + scrollY);
              if (!(Math.abs(mx - wantX) <= 1 && Math.abs(my - wantY) <= 1)) out.push(`${b.className.split(' ')[0]}${pseudo} at ${pos} for offset ${Math.round(-wantX)},${Math.round(-wantY)}`);
            }
          }
          return { out, n: document.querySelectorAll('.topo, .band-paper, .band-sheet').length };
        });
        checked += bad.n;
        for (const m of bad.out.slice(0, 4)) fail(`${w} ${theme} ${path}: texture not anchored to the page: ${m}`);
        await page.close();
      }
    }
  }
  console.log(`Texture: every band's contour mask (${checked} bands checked) sits at its page offset on /, /about/, /work/, /research/ and /contact/.`);
}

await browser.close();
server.close();
if (problems) {
  console.log(`\n${problems} layout problem(s).`);
  process.exit(1);
}
console.log('\nRAMpage layout: Fire and the plow are on screen together at every size.');
console.log('Specimen layout: the chip, the seafloor and the bit girl hold at 320, 390, 768, 1440, 1920 and 2560.');
