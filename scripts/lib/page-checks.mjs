// The page checks shared by the layout tests and the sweep, run in the page with page.evaluate:
//   fitInPage(rootSel)     units split from their values, truncated controls, clipped elements and
//                          stray readouts (tests/fit.spec.ts);
//   coverInPage(rootSel)   anything painted over a photo or a line of text (tests/no-cover.spec.ts);
//   labelsInPage(rootSel)  figure labels that cross their box, overlap or are clipped (check-labels).
// Each takes an optional selector to check one component instead of the whole page.
export function fitInPage(rootSel) {
  const ROOT = (rootSel && document.querySelector(rootSel)) || document.body;
  const out = [];
  const vw = document.documentElement.clientWidth;
  const name = (el) => {
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" && el.className.trim() ? `.${el.className.trim().split(/\s+/)[0]}` : "";
    return `${el.tagName.toLowerCase()}${id}${cls}`;
  };
  const shown = (el) => {
    if (el.closest("[hidden], template, .sr-only, [inert]")) return false;
    const shut = el.closest("details:not([open])");
    if (shut && !el.closest("summary")) return false;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    for (let n = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) < 0.05) return false;
    }
    return true;
  };
  const scrollsOrBleeds = (el) => {
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      if (n.matches('[data-hscroll], [data-clip-ok], [aria-hidden="true"]')) return true;
      const s = getComputedStyle(n);
      if (/(auto|scroll)/.test(s.overflowX)) return true;
      if (s.position === "fixed") return true;
    }
    return el.closest('[aria-hidden="true"], [data-clip-ok]') !== null;
  };
  const UNIT = /(\d[\d.,]*)[  ](kg\/m³|g\/cm³|m\/s|km\/h|kHz|MHz|GHz|Hz|dB|km|cm|mm|ms|µs|kg|lbf|psi|KB|MB|GB|fps|ac|°C|m|s|g)(?![\p{L}\p{N}])/gu;
  const tw = document.createTreeWalker(ROOT, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const p = n.parentElement;
    if (!p || !n.data.trim() || p.closest("script, style, code, pre, textarea") || !shown(p)) continue;
    for (const m of n.data.matchAll(UNIT)) {
      const r = document.createRange();
      r.setStart(n, m.index);
      r.setEnd(n, m.index + m[0].length);
      const tops = [...r.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top));
      if (tops.length > 1 && Math.max(...tops) - Math.min(...tops) > 4) out.push(`unit split: "${m[0]}" breaks across lines in ${name(p)}`);
    }
  }
  const ctx = document.createElement("canvas").getContext("2d");
  for (const el of ROOT.querySelectorAll('select, button, [role="tab"], .chip, .filter, label, summary, .btn, .tabset > *')) {
    if (!shown(el)) continue;
    if (el instanceof HTMLSelectElement) {
      const s2 = getComputedStyle(el);
      ctx.font = `${s2.fontStyle} ${s2.fontWeight} ${s2.fontSize} ${s2.fontFamily}`;
      const text = el.selectedOptions[0]?.text ?? "";
      const need = ctx.measureText(text).width;
      const room = el.clientWidth - parseFloat(s2.paddingLeft) - parseFloat(s2.paddingRight) - 20;
      if (need > room + 1) out.push(`truncated: ${name(el)} shows "${text}" in ${Math.round(room)}px, needs ${Math.round(need)}px`);
      continue;
    }
    const s = getComputedStyle(el);
    if (el.scrollWidth > el.clientWidth + 1 && (s.overflowX !== "visible" || s.textOverflow === "ellipsis")) {
      out.push(`truncated: ${name(el)} "${(el.textContent || "").trim().slice(0, 30)}" (${el.scrollWidth} in ${el.clientWidth}px)`);
      continue;
    }
    const box = el.getBoundingClientRect();
    const inner = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let spill = false;
    for (let t = inner.nextNode(); t && !spill; t = inner.nextNode()) {
      if (!t.data.trim() || !t.parentElement || !shown(t.parentElement)) continue;
      const range = document.createRange();
      range.selectNodeContents(t);
      for (const r of range.getClientRects()) if (r.width > 0 && (r.right > box.right + 1.5 || r.left < box.left - 1.5)) spill = true;
    }
    if (spill) out.push(`truncated: ${name(el)} "${(el.textContent || "").trim().slice(0, 30)}" runs out of its box`);
  }
  const clippers = (el) => {
    const list = [];
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (/(hidden|clip)/.test(s.overflowX) || /(hidden|clip)/.test(s.overflowY)) list.push(n);
    }
    return list;
  };
  const past = (r, el, what) => {
    if (r.right > vw + 1 || r.left < -1) return `clipped: ${what} in ${name(el)} runs past the screen (${Math.round(r.left)} to ${Math.round(r.right)} of ${vw})`;
    for (const c of clippers(el)) {
      const b = c.getBoundingClientRect();
      if (r.right > b.right + 1.5 || r.left < b.left - 1.5) return `clipped: ${what} in ${name(el)} is cut by ${name(c)}`;
    }
    return null;
  };
  const seen = /* @__PURE__ */ new Set();
  const tw2 = document.createTreeWalker(ROOT, NodeFilter.SHOW_TEXT);
  for (let n = tw2.nextNode(); n; n = tw2.nextNode()) {
    const p = n.parentElement;
    if (!p || !n.data.trim() || p.closest("script, style, svg, code, pre, textarea, option") || !shown(p) || scrollsOrBleeds(p)) continue;
    const r = document.createRange();
    r.selectNodeContents(n);
    for (const rr of r.getClientRects()) {
      if (!rr.width) continue;
      const msg = past(rr, p, `"${n.data.trim().slice(0, 24)}"`);
      if (msg && !seen.has(msg)) seen.add(msg), out.push(msg);
      break;
    }
  }
  for (const el of ROOT.querySelectorAll("img, canvas, video, svg:not(svg svg), .pol, .pol-bare, a, button, figcaption")) {
    if (!shown(el) || scrollsOrBleeds(el)) continue;
    const target = el.matches("img") && el.parentElement && /(hidden|clip)/.test(getComputedStyle(el.parentElement).overflow) ? el.parentElement : el;
    const msg = past(target.getBoundingClientRect(), target, name(el));
    if (msg && !seen.has(msg)) seen.add(msg), out.push(msg);
  }
  for (const el of ROOT.querySelectorAll("output, [data-readout]")) {
    if (!shown(el)) continue;
    const box = el.closest("figure, .plate, .rfig, [data-fc], .card, .paper, [data-readout-box]");
    if (!box) continue;
    const a = el.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    if (a.left < b.left - 1 || a.right > b.right + 1 || a.top < b.top - 1 || a.bottom > b.bottom + 1) out.push(`readout: ${name(el)} "${(el.textContent || "").trim()}" sits outside ${name(box)}`);
  }
  return out;
}

export async function coverInPage(rootSel) {
  const ROOT = (rootSel && document.querySelector(rootSel)) || document.body;
  const hits = [];
  const force = document.createElement("style");
  force.textContent = "*, *::before, *::after { pointer-events: auto !important; }";
  document.head.append(force);
  const transparent = (c) => c === "transparent" || /rgba\([^)]*,\s*0\)$/.test(c);
  const paints = (el) => {
    if (/^(IMG|VIDEO)$/.test(el.tagName)) return true;
    const s = getComputedStyle(el);
    if (!transparent(s.backgroundColor) || s.backgroundImage !== "none") return true;
    return ["Top", "Right", "Bottom", "Left"].some(
      (side) => parseFloat(s.getPropertyValue(`border-${side.toLowerCase()}-width`)) > 0 && s.getPropertyValue(`border-${side.toLowerCase()}-style`) !== "none" && !transparent(s.getPropertyValue(`border-${side.toLowerCase()}-color`))
    );
  };
  const shown = (el) => {
    for (let n = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.visibility === "hidden" || Number(s.opacity) < 0.05) return false;
    }
    return true;
  };
  const floating = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const p = getComputedStyle(n).position;
      if (p === "fixed" || p === "sticky") return true;
    }
    return false;
  };
  const layered = (el) => !!el.closest('[data-overlap="layered"]');
  const name = (el) => {
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}` : "";
    return `${el.tagName.toLowerCase()}${id}${cls}`;
  };
  const head = document.querySelector(".site-header");
  const topEdge = () => Math.max(0, head ? head.getBoundingClientRect().bottom : 0);
  const seen = /* @__PURE__ */ new Set();
  // A point that a scrolling or clipping box around the target already hides (a console scrolled to
  // its newest lines, say) is not on screen, so nothing can cover it there.
  const clippedAt = (el, x, y) => {
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      const s2 = getComputedStyle(n);
      if (s2.overflowX === 'visible' && s2.overflowY === 'visible') continue;
      const b = n.getBoundingClientRect();
      if (x < b.left || x > b.right || y < b.top || y > b.bottom) return true;
    }
    return false;
  };
  const coverAt = (x, y, target, isPhoto, inside) => {
    if (clippedAt(target, x, y)) return null;
    const stack = document.elementsFromPoint(x, y);
    const at = stack.findIndex((e) => e === target || inside && inside(e));
    if (at < 0) return null;
    for (const e of stack.slice(0, at)) {
      if (target.contains(e) || e.contains(target)) continue;
      if (floating(e) || !shown(e) || !paints(e)) continue;
      if (!isPhoto && e.closest('[data-overlap="ok"]')) continue;
      return e;
    }
    return null;
  };
  const photos = () => [...ROOT.querySelectorAll("img, video, canvas[data-photo]")].filter((el) => {
    if (el instanceof HTMLImageElement && /\.svg($|\?)/.test(el.currentSrc || el.src)) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 24 && r.height >= 24 && shown(el) && !floating(el) && !layered(el);
  });
  const texts = () => {
    const out = [];
    const tw = document.createTreeWalker(ROOT, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => {
        const p = n.parentElement;
        if (!p || !n.textContent?.trim()) return NodeFilter.FILTER_REJECT;
        if (p.closest("svg, script, style, noscript, template, .sr-only, [hidden]")) return NodeFilter.FILTER_REJECT;
        const shut = p.closest("details:not([open])");
        if (shut && !p.closest("summary")) return NodeFilter.FILTER_REJECT;
        if (floating(p) || layered(p) || !shown(p)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    for (let n = tw.nextNode(); n; n = tw.nextNode()) out.push(n);
    return out;
  };
  const vh = window.innerHeight;
  // The whole page, or just the stretch the component covers.
  const rr = ROOT.getBoundingClientRect();
  const from = ROOT === document.body ? 0 : Math.max(0, rr.top + scrollY - 200);
  const total = ROOT === document.body ? document.documentElement.scrollHeight : rr.bottom + scrollY;
  for (let y = from; y < total; y += Math.max(200, vh - 160)) {
    window.scrollTo({ top: y, behavior: "instant" });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const top = topEdge() + 2;
    const bottom = vh - 2;
    const sy = window.scrollY;
    for (const el of photos()) {
      const r = el.getBoundingClientRect();
      if (r.bottom < top || r.top > bottom) continue;
      const s = getComputedStyle(el);
      const pad = (k) => parseFloat(s.getPropertyValue(k)) || 0;
      const L = r.left + pad("border-left-width") + pad("padding-left");
      const R = r.right - pad("border-right-width") - pad("padding-right");
      const T = r.top + pad("border-top-width") + pad("padding-top");
      const B = r.bottom - pad("border-bottom-width") - pad("padding-bottom");
      for (let i = 0; i <= 8; i++) {
        for (let j = 0; j <= 8; j++) {
          const x = L + 1 + (R - L - 2) * i / 8;
          const yy = T + 1 + (B - T - 2) * j / 8;
          if (yy < top || yy > bottom || x < 0 || x > window.innerWidth) continue;
          const key = `p${Math.round(x)},${Math.round(yy + sy)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const by = coverAt(x, yy, el, true);
          if (by) hits.push({ kind: "photo", what: `${name(el)} ${(el.getAttribute("alt") || "").slice(0, 40)}`, by: name(by), x: Math.round(x), y: Math.round(yy + sy) });
        }
      }
    }
    for (const t of texts()) {
      const range = document.createRange();
      range.selectNodeContents(t);
      const owner = t.parentElement;
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
          if (by) hits.push({ kind: "text", what: `${name(owner)} "${(t.textContent || "").trim().slice(0, 40)}"`, by: name(by), x: Math.round(x), y: Math.round(yy + sy) });
        }
      }
    }
  }
  force.remove();
  window.scrollTo({ top: 0, behavior: "instant" });
  return hits;
}

// The label overflow check (check-labels.mjs), run in the page: every problem visible right now.
// rootSel limits it to one component (the sweep), otherwise the whole page.
export function labelsInPage(rootSel) {
  const ROOT = (rootSel && document.querySelector(rootSel)) || document;
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

  for (const svg of ROOT.querySelectorAll('main svg')) {
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
  for (const el of ROOT.querySelectorAll('main *')) {
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
