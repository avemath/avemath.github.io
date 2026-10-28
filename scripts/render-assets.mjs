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
  { file: 'default', eyebrow: 'Baton Rouge, LA · M.S. ECE @ LSU', title: 'Avery Matherne', sub: 'I research communication systems at LSU and build websites for small businesses and nonprofits.' },
  ...projects.map((p) => ({ file: p.id, eyebrow: p.type, title: p.title, sub: p.summary })),
];

// The card is the site in miniature: the descent's dark-theme bands stepping down with wave edges,
// soft light rays from the surface, and a slim depth scale on the right.
const BANDS = ['#0f4955', '#0a424f', '#083a48', '#083442', '#062f3d', '#062938', '#062432', '#06202d', '#061c29', '#061824', '#061420', '#05111c'];
const wave = (y, k) => `M0 ${y + 10} C 180 ${y - 4 + (k % 3) * 3} 360 ${y - 6} 560 ${y + 6} S 920 ${y + 22} 1200 ${y + 4} V 630 H 0 Z`;
const bands = BANDS.map((c, k) => (k === 0 ? `<rect width="1200" height="630" fill="${c}"/>` : `<path d="${wave(k * 52 - 8, k)}" fill="${c}"/>`)).join('');
const depths = [0, 50, 200, 400, 600, 800, 1000, 1500, 2000, 3000, 4000, 4500];
const scale = depths
  .map((d, k) => {
    const y = 96 + k * 40;
    return `<path d="M1112 ${y} H1124" stroke="#adc6d2" stroke-opacity=".55"/><text x="1104" y="${y + 5}" text-anchor="end">${d.toLocaleString('en-US')}</text>`;
  })
  .join('');

const html = (c) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:SG;src:url(${font('space-grotesk-latin-wght')}) format('woff2');font-weight:300 700}
@font-face{font-family:IN;src:url(${font('inter-latin-wght')}) format('woff2');font-weight:100 900}
@font-face{font-family:JB;src:url(${font('jetbrains-mono-latin-wght')}) format('woff2');font-weight:100 800}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#05111c;color:#e4f0f5;font-family:IN;position:relative;overflow:hidden}
.w{position:absolute;inset:0}
.rays{position:absolute;inset:0 -20% auto;height:420px;background:conic-gradient(from 0deg at 50% -40%,transparent 0 151deg,rgb(160 225 240/.13) 152.5deg,transparent 154.5deg 159deg,rgb(160 225 240/.1) 160.5deg,transparent 163deg 168deg,rgb(160 225 240/.12) 169.5deg,transparent 172deg 177deg,rgb(160 225 240/.09) 178.5deg,transparent 181deg 186deg,rgb(160 225 240/.12) 188deg,transparent 190.5deg 196deg,rgb(160 225 240/.09) 197.5deg,transparent 200deg 360deg);-webkit-mask-image:linear-gradient(#000,transparent 85%)}
.g{position:absolute;inset:0;font-family:JB;font-size:14px;fill:#adc6d2;letter-spacing:.04em}
.c{position:absolute;left:80px;top:80px;bottom:72px;width:820px;display:flex;flex-direction:column}
.e{font-family:JB;font-size:22px;letter-spacing:.14em;text-transform:uppercase;color:#93d5ec;display:flex;align-items:center;gap:16px}
.e:before{content:'';width:40px;height:2px;background:#7ccbe6}
h1{font-family:SG;font-weight:600;font-size:${c.title.length > 40 ? 56 : c.title.length > 24 ? 66 : 84}px;line-height:1.02;letter-spacing:-.035em;margin-top:28px}
p{margin-top:24px;font-size:26px;line-height:1.4;color:#c3d6df;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.f{margin-top:auto;display:flex;justify-content:space-between;align-items:center;font-family:JB;font-size:20px;color:#adc6d2}
.dot{width:14px;height:14px;border-radius:50%;background:#f0a940;display:inline-block;margin-right:12px}
</style></head><body>
<svg class="w" viewBox="0 0 1200 630" preserveAspectRatio="none">${bands}</svg>
<div class="rays"></div>
<svg class="g" viewBox="0 0 1200 630"><path d="M1124 96 V536" stroke="#adc6d2" stroke-opacity=".35"/>${scale}<circle cx="1124" cy="96" r="5" fill="#f0a940"/></svg>
<div class="c"><div class="e">${c.eyebrow}</div><h1>${c.title}</h1><p>${c.sub}</p>
<div class="f"><span><span class="dot"></span>avemath.github.io</span></div></div></body></html>`;

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
await page.setContent(`<body style="margin:0;background:#061c2b"><img src="${base}/favicon.svg" style="width:180px;height:180px;display:block"></body>`);
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
