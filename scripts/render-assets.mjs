// Renders the files that come from the site itself:
//   public/resume/Avery-Matherne-Resume.pdf  printed from /resume/ (tagged, one page)
//   public/og/*.png                           1200x630 social cards
//   public/apple-touch-icon.png
//   public/favicon.ico                        16 and 32 px, for browsers and tools that skip SVG icons
//
// Run after a build: `npm run build && npm run assets`. Commit the output.
// Needs Playwright's Chromium (`npx playwright install chromium`), or set CHROMIUM_PATH to a Chromium binary.
import { readFile, writeFile, readdir, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { serveDist, localOnly } from './lib/serve-dist.mjs';

const DIST = 'dist';
const site = JSON.parse(await readFile('src/data/site.json', 'utf8'));
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
  projects.push({ id: f.replace(/\.md$/, ''), title: field('title'), type: LABELS[field('type')] ?? '', summary: field('summary') });
}
const cards = [
  { file: 'default', eyebrow: site.title.split('|')[1].trim(), title: site.name, sub: 'I research communication systems at LSU and build websites for small businesses and nonprofits.' },
  { file: 'research', eyebrow: 'Research', title: 'Research, below the surface.', sub: 'Underwater acoustic channels, the ONR data management work, bellhopSim, and the acoustic pool alarm.' },
  ...projects.map((p) => ({ file: p.id, eyebrow: p.type, title: p.title, sub: p.summary })),
];

// The card is the site's hero in miniature: navy with the faint dot grid, the wide Archivo
// headline, and a short FH-BFSK hop pattern in the accent. No spectrogram.
const hops = [3, 9, 5, 11, 1, 7, 12, 4, 8, 2, 10, 6];
const tones = hops.map((h, i) => `<rect x="${760 + i * 30}" y="${470 - h * 22}" width="22" height="5" fill="${i % 4 === 3 ? '#f4f6fa' : '#de6a41'}"/>`).join('');

const html = (c) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:AR;src:url(${font('archivo-latin-wdth')}) format('woff2');font-weight:100 900;font-stretch:62% 125%}
@font-face{font-family:PM;src:url(${font('ibm-plex-mono-latin-400')}) format('woff2')}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#0b1f3a radial-gradient(rgb(244 246 250/.09) 1.2px,transparent 1.6px) 0 0/24px 24px;color:#f4f6fa;font-family:AR;position:relative;overflow:hidden}
.g{position:absolute;inset:0}
.c{position:absolute;left:80px;top:72px;bottom:64px;width:640px;display:flex;flex-direction:column}
.e{font-size:24px;font-weight:600;color:#ef8d66}
h1{font-weight:800;font-variation-settings:'wdth' 112;font-size:${c.title.length > 40 ? 58 : c.title.length > 24 ? 68 : 88}px;line-height:.96;letter-spacing:-.03em;margin-top:22px}
p{margin-top:24px;font-size:26px;line-height:1.4;color:#a9b6cc;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.f{margin-top:auto;display:flex;align-items:center;gap:14px;font-family:PM;font-size:20px;color:#a9b6cc}
.f:before{content:'';width:40px;height:6px;background:#de6a41}
.bar{position:absolute;left:0;right:0;bottom:0;height:14px;background:#de6a41}
</style></head><body>
<svg class="g" viewBox="0 0 1200 630"><rect x="740" y="180" width="380" height="320" fill="none" stroke="rgb(244 246 250/.22)"/>${tones}<text x="752" y="204" font-family="PM" font-size="15" fill="#a9b6cc">FH-BFSK, JANUS band</text></svg>
<div class="c"><div class="e">${c.eyebrow}</div><h1>${c.title}</h1><p>${c.sub}</p>
<div class="f">avemath.github.io</div></div><div class="bar"></div></body></html>`;

await mkdir('public/og', { recursive: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const c of cards) {
  await writeFile(join(DIST, '__og.html'), html(c));
  await page.goto(`${base}/__og.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `public/og/${c.file}.png` });
}
console.log(`social cards: ${cards.length}`);

// ---- Apple touch icon ----
await page.setViewportSize({ width: 180, height: 180 });
await page.setContent(`<body style="margin:0;background:#0b1f3a"><img src="${base}/favicon.svg" style="width:180px;height:180px;display:block"></body>`);
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
