// Renders the files that come from the site itself:
//   public/resume/Avery-Matherne-Resume.pdf  printed from /resume/ (tagged, one page)
//   public/og/*.png                           1200x630 social cards (green, light theme)
//   public/apple-touch-icon.png
//   public/favicon.ico                        16 and 32 px, for browsers and tools that skip SVG icons
//   src/assets/research/seafloor-*.jpg        the Research seafloor: the shallows and the deep
//
// Run after a build: `npm run build && npm run assets`. Commit the output. The seafloor still is an
// input to the build, so build once more after it changes.
// Needs Playwright's Chromium (`npx playwright install chromium`), or set CHROMIUM_PATH to a Chromium binary.
import { readFile, writeFile, readdir, mkdir, rm } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';
import { serveDist, localOnly } from './lib/serve-dist.mjs';

const DIST = 'dist';
const site = JSON.parse(await readFile('src/data/site.json', 'utf8'));
// The palette comes from src/styles/tokens.css (the light theme), so the cards and the icons follow
// it. The cards use the green accent only: --green for lines and large marks, --green-strong for
// small text.
const tokensCss = await readFile('src/styles/tokens.css', 'utf8');
const lightBlock = tokensCss.slice(0, tokensCss.search(/^\[data-theme='dark'\] \{/m));
const T = Object.fromEntries(['paper', 'sheet', 'ink', 'muted', 'rule', 'lilac', 'teal', 'rose', 'gold', 'green', 'green-strong'].map((k) => [k, new RegExp(`--${k}:\\s*(#[0-9a-fA-F]{6})`).exec(lightBlock)[1]]));

// The favicon: three sound rays bending through the channel and a gold source, on ink. Paths only,
// so it never depends on a font.
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="${T.ink}"/>
  <path d="M6 13 C 12 4, 18 22, 27 9" fill="none" stroke="${T.rose}" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M6 13 C 12 8, 18 18, 27 13" fill="none" stroke="#c6b0ea" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M6 13 C 12 12, 18 14, 27 17" fill="none" stroke="#7ccac3" stroke-width="2.2" stroke-linecap="round"/>
  <circle cx="6" cy="13" r="3" fill="#e2c17e"/>
</svg>
`;
for (const f of ['public/favicon.svg', join(DIST, 'favicon.svg')]) await writeFile(f, favicon);
const { server, base } = serveDist(DIST);

const fonts = await readdir(join(DIST, '_astro'));
const font = (prefix) => `/_astro/${fonts.find((f) => f.startsWith(prefix) && f.endsWith('.woff2'))}`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

// ---- Résumé PDF ----
{
  const page = await browser.newPage({ colorScheme: 'light' });
  await page.route(...localOnly(base));
  await page.goto(`${base}/resume/`, { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => document.fonts.ready);
  await mkdir('public/resume', { recursive: true });
  const pdf = await page.pdf({ format: 'Letter', printBackground: false, preferCSSPageSize: true, tagged: true });
  await writeFile('public/resume/Avery-Matherne-Resume.pdf', pdf);
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  console.log(`résumé PDF: ${(pdf.length / 1024).toFixed(0)} KB, ${pages} page(s)`);
  await page.close();
}

// ---- The seafloor stills ----
// The live scene renders one fixed frame (`/research/?still&depth=...`) in a WebGL-capable Chromium.
// The shallows (depth 0) sit at the top of /research/ before the scene loads, and instead of it with
// reduced motion or no WebGL; the deep (depth 0.6, no light shafts) is the home page's Research teaser.
{
  const gl = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  await mkdir('src/assets/research', { recursive: true });
  // The deep still leaves the light shafts and the jellyfish out, so no outlines cross the home
  // page's band: only the terraces, their glowing contours and the formations.
  for (const [query, file] of [
    ['depth=0', 'seafloor-shallow.jpg'],
    ['depth=0.6&pitch=-0.12&noshafts&nojellies', 'seafloor-still.jpg'],
  ]) {
    const page = await gl.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
    await page.route(...localOnly(base));
    await page.goto(`${base}/research/?still&${query}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-seafloor][data-ready="still"]', { timeout: 60000 });
    await page.waitForTimeout(1000);
    // Read the frame from the canvas itself: an element screenshot can miss a WebGL layer.
    const jpeg = await page.evaluate(() => document.querySelector('[data-seafloor] canvas').toDataURL('image/jpeg', 0.86));
    await writeFile(`src/assets/research/${file}`, Buffer.from(jpeg.split(',')[1], 'base64'));
    console.log(`seafloor still: src/assets/research/${file}`);
    await page.close();
  }
  await gl.close();
}

// ---- Social cards ----
const LABELS = { research: 'Research', engineering: 'Engineering', 'client-site': 'Client site', software: 'Software', nonprofit: 'Nonprofit' };
const projects = [];
for (const f of (await readdir('src/content/projects')).filter((f) => f.endsWith('.md'))) {
  const front = (await readFile(join('src/content/projects', f), 'utf8')).split('---')[1];
  // YAML quotes are syntax, not text: strip them, with '' inside single quotes and \" inside double quotes.
  const unquote = (v) =>
    /^'.*'$/.test(v) ? v.slice(1, -1).replaceAll("''", "'") : /^".*"$/.test(v) ? v.slice(1, -1).replace(/\\(["\\])/g, '$1') : v;
  const field = (k) => {
    const v = front.match(new RegExp(`^${k}:\\s*(.+)$`, 'm'))?.[1].trim();
    return v === undefined ? v : unquote(v);
  };
  if (field('draft') === 'true') continue;
  projects.push({ id: f.replace(/\.md$/, ''), title: field('title'), type: LABELS[field('type')] ?? '', summary: field('summary'), cover: field('cover') });
}
// Each project card shows the project's own picture: its cover, or where it has none, its line
// drawing as the case study shows it (svg.art, captured from the built page in the light theme).
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const artPage = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2, colorScheme: 'light', reducedMotion: 'reduce' });
async function picture(p) {
  if (p.cover) {
    const file = join('src/content/projects', p.cover);
    return `data:${MIME[extname(file).toLowerCase()]};base64,${(await readFile(file)).toString('base64')}`;
  }
  await artPage.goto(`${base}/work/${p.id}/`, { waitUntil: 'networkidle' });
  const art = artPage.locator('svg.art').first();
  if (!(await art.count())) return undefined;
  // The drawing's 1.5px lines vanish at card size, and more so in a small preview: draw them heavier.
  await art.evaluate((svg) => {
    for (const el of svg.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      if (cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 0) el.style.strokeWidth = `${parseFloat(cs.strokeWidth) * 2.4}px`;
    }
  });
  return `data:image/png;base64,${(await art.screenshot({ animations: 'disabled' })).toString('base64')}`;
}
const cards = [
  { file: 'default', eyebrow: site.title.split('|')[1].trim(), title: site.name, sub: 'I research communication systems at LSU and build websites for small businesses and nonprofits.' },
  { file: 'research', eyebrow: 'Research', title: 'Research, below the surface.', sub: 'Underwater acoustic channels, the ONR data management work, bellhopSim, and the acoustic pool alarm.' },
];
for (const p of projects) cards.push({ file: p.id, eyebrow: p.type, title: p.title, sub: p.summary, pic: await picture(p) });
await artPage.close();

// The card is the home hero in miniature: paper, the title in Bodoni Moda, the one-line description,
// and on the right the project's picture in a double-hairline frame. The home and Research cards show
// Plate I's eigenrays there instead (Munk profile, source at 1000 m, 100 km), drawn in greens, with
// the sound speed curve in gold as on the site.
const munk = (z) => { const e = (2 * (z - 1300)) / 1300; return 1500 * (1 + 0.00737 * (e - 1 + Math.exp(-e))); };
const dmunk = (z) => { const e = (2 * (z - 1300)) / 1300; return ((1500 * 0.00737 * (1 - Math.exp(-e))) * 2) / 1300; };
function trace(theta) {
  let r = 0, z = 1000, th = theta;
  const pts = [];
  for (let i = 0; r < 100000; i++) {
    th += (-dmunk(z) / munk(z)) * Math.cos(th) * 100;
    r += Math.cos(th) * 100;
    z += Math.sin(th) * 100;
    if (z < 0) { z = -z; th = -th; }
    if (z > 5000) { z = 10000 - z; th = -th; }
    if (i % 8 === 0) pts.push([r / 100000, z / 5000]);
  }
  return pts;
}
const PX = 724, PY = 112, PW = 400, PH = 360;
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, p, b) => '#' + hex(a).map((v, i) => Math.round(v * p + hex(b)[i] * (1 - p)).toString(16).padStart(2, '0')).join('');
const rays = [];
for (let a = -13; a <= 13.01; a += 1.3) {
  const t = Math.abs(a) / 13;
  const col = t < 0.34 ? T['green-strong'] : t < 0.67 ? T.green : mix(T.green, 0.55, T.sheet);
  const d = trace((a * Math.PI) / 180).map(([u, v], i) => `${i ? 'L' : 'M'}${(PX + 24 + u * (PW - 48)).toFixed(1)} ${(PY + 24 + v * (PH - 48)).toFixed(1)}`).join(' ');
  rays.push(`<path d="${d}" fill="none" stroke="${col}" stroke-width="1.4" stroke-opacity=".6"/>`);
}
const ssp = [];
for (let z = 0; z <= 5000; z += 100) ssp.push(`${ssp.length ? 'L' : 'M'}${(PX + 24 + ((munk(z) - 1480) / 90) * 60).toFixed(1)} ${(PY + 24 + (z / 5000) * (PH - 48)).toFixed(1)}`);
const plate = `<rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" fill="${T.sheet}" stroke="${T.rule}"/>
<rect x="${PX + 8}" y="${PY + 8}" width="${PW - 16}" height="${PH - 16}" fill="none" stroke="${T.rule}"/>
${rays.join('')}<path d="${ssp.join(' ')}" fill="none" stroke="${T.gold}" stroke-width="2.6"/>
<circle cx="${PX + 24}" cy="${(PY + 24 + (1000 / 5000) * (PH - 48)).toFixed(1)}" r="6" fill="${T.gold}"/>
<text x="${PX}" y="${PY + PH + 34}" font-family="BO" font-style="italic" font-size="22" fill="${T.muted}">Plate I, eigenrays</text>`;

// A project's picture, framed like the plate: sheet, two hairlines, the picture at 16:10.
const figure = (src) => `<div class="pic"><img src="${src}" alt=""></div>`;

const html = (c) => `<!doctype html><html><head><meta charset="utf-8"><title>${c.file}</title><style>
@font-face{font-family:BO;src:url(${font('bodoni-moda-latin-wght-normal')}) format('woff2');font-weight:400 900}
@font-face{font-family:BO;font-style:italic;src:url(${font('bodoni-moda-latin-wght-italic')}) format('woff2');font-weight:400 900}
@font-face{font-family:HK;src:url(${font('hanken-grotesk-latin-wght-normal')}) format('woff2');font-weight:100 900}
@font-face{font-family:JM;src:url(${font('jetbrains-mono-latin-wght-normal')}) format('woff2');font-weight:100 800}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:${T.paper};color:${T.ink};font-family:HK;position:relative;overflow:hidden}
.g{position:absolute;inset:0}
.c{position:absolute;left:72px;top:68px;bottom:56px;width:640px;display:flex;flex-direction:column}
.e{font-family:BO;font-style:italic;font-size:32px;color:${T['green-strong']}}
.pic{position:absolute;left:752px;top:170px;width:390px;padding:9px;background:${T.sheet};border:1px solid ${T.rule};outline:1px solid ${T.rule};outline-offset:-6px}
.pic img{display:block;width:100%;aspect-ratio:16/10;object-fit:cover;object-position:center top}
h1{font-family:BO;font-weight:400;font-size:${c.title.length > 40 ? 58 : c.title.length > 24 ? 70 : 92}px;line-height:.98;letter-spacing:-.015em;margin-top:18px}
p{margin-top:20px;font-size:32px;line-height:1.28;color:${T.muted}}
.f{margin-top:auto;display:flex;align-items:center;gap:14px;font-family:JM;font-size:26px;color:${T['green-strong']}}
.f:before{content:'';width:40px;height:3px;background:${T.green}}
</style></head><body>
${c.pic ? figure(c.pic) : `<svg class="g" viewBox="0 0 1200 630">${plate}</svg>`}
<div class="c"><div class="e">${c.eyebrow}</div><h1>${c.title}</h1><p>${c.sub}</p>
<div class="f">avemath.github.io</div></div></body></html>`;

await mkdir('public/og', { recursive: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const c of cards) {
  await writeFile(join(DIST, '__og.html'), html(c));
  await page.goto(`${base}/__og.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  // A long title plus a long summary can crowd the footer line: step the title down until the
  // column fits, with room to spare above the footer, then the description if it still crowds.
  await page.evaluate(() => {
    const col = document.querySelector('.c');
    const h1 = document.querySelector('h1');
    const foot = document.querySelector('.f');
    const p = document.querySelector('p');
    let size = parseFloat(getComputedStyle(h1).fontSize);
    const crowded = () => p.getBoundingClientRect().bottom > foot.getBoundingClientRect().top - 20;
    while (size > 48 && crowded()) {
      size -= 2;
      h1.style.fontSize = `${size}px`;
    }
    let sub = parseFloat(getComputedStyle(p).fontSize);
    while (sub > 26 && crowded()) {
      sub -= 1;
      p.style.fontSize = `${sub}px`;
    }
    if (crowded()) throw new Error(`social card ${document.title}: the text does not fit`);
    return col.scrollHeight;
  });
  await page.screenshot({ path: `public/og/${c.file}.png` });
}
console.log(`social cards: ${cards.length}`);

// ---- Apple touch icon ----
await page.setViewportSize({ width: 180, height: 180 });
await page.setContent(`<body style="margin:0;background:${T.ink}"><img src="${base}/favicon.svg" style="width:180px;height:180px;display:block"></body>`);
await page.waitForTimeout(200);
await page.screenshot({ path: 'public/apple-touch-icon.png' });

// ---- favicon.ico: 16 and 32 px PNGs in one container ----
const icons = [];
for (const size of [16, 32]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0;background:transparent"><img src="${base}/favicon.svg" style="width:${size}px;height:${size}px;display:block"></body>`);
  await page.waitForTimeout(100);
  icons.push({ size, png: await page.screenshot({ omitBackground: true }) });
}
await writeFile('public/favicon.ico', ico(icons));

function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, png }) => {
    const e = Buffer.alloc(16);
    e[0] = size % 256; // width (0 means 256)
    e[1] = size % 256; // height
    e.writeUInt16LE(1, 4); // color planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

await rm(join(DIST, '__og.html'), { force: true });
await browser.close();
server.close();
console.log('done');
