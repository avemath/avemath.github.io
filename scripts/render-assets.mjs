// Renders the files that come from the site itself:
//   public/resume/Avery-Matherne-Resume.pdf  printed from /resume/
//   public/og/*.png                           1200x630 social cards
//   public/apple-touch-icon.png
//
// Run after a build: `npm run build && npm run assets`. Commit the output.
// Needs Playwright's Chromium (`npx playwright install chromium`).
import { createServer } from 'node:http';
import { readFile, writeFile, readdir, mkdir, rm } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';

const DIST = 'dist';
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json' };

const server = createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  try {
    const body = await readFile(join(DIST, path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

const fonts = await readdir(join(DIST, '_astro'));
const font = (prefix) => `/_astro/${fonts.find((f) => f.startsWith(prefix) && f.endsWith('.woff2'))}`;

const browser = await chromium.launch();

// ---- Résumé PDF ----
{
  const page = await browser.newPage({ colorScheme: 'light' });
  await page.goto(`${base}/resume/`, { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => document.fonts.ready);
  await mkdir('public/resume', { recursive: true });
  const pdf = await page.pdf({ format: 'Letter', printBackground: false, preferCSSPageSize: true });
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
  const field = (k) => front.match(new RegExp(`^${k}:\\s*(.+)$`, 'm'))?.[1].trim();
  if (field('draft') === 'true') continue;
  projects.push({ id: f.replace(/\.md$/, ''), title: field('title'), type: LABELS[field('type')] ?? '', summary: field('summary') });
}
const cards = [
  { file: 'default', eyebrow: 'Baton Rouge, LA · M.S. ECE @ LSU', title: 'Avery Matherne', sub: 'Communication systems for naval research. Websites people enjoy using.' },
  ...projects.map((p) => ({ file: p.id, eyebrow: p.type, title: p.title, sub: p.summary })),
];

const html = (c) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:SG;src:url(${font('space-grotesk-latin-wght')}) format('woff2');font-weight:300 700}
@font-face{font-family:IN;src:url(${font('inter-latin-wght')}) format('woff2');font-weight:100 900}
@font-face{font-family:JB;src:url(${font('jetbrains-mono-latin-wght')}) format('woff2');font-weight:100 800}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#0b1220;color:#e6edf7;font-family:IN;position:relative;overflow:hidden}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(230,237,247,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(230,237,247,.045) 1px,transparent 1px);background-size:40px 40px}
svg{position:absolute;right:-170px;top:50%;translate:0 -50%;width:760px;height:760px}
.c{position:absolute;left:80px;top:80px;bottom:80px;width:720px;display:flex;flex-direction:column}
.e{font-family:JB;font-size:22px;letter-spacing:.14em;text-transform:uppercase;color:#3ddcff;display:flex;align-items:center;gap:16px}
.e:before{content:'';width:40px;height:2px;background:#3ddcff}
h1{font-family:SG;font-weight:600;font-size:${c.title.length > 40 ? 56 : c.title.length > 24 ? 66 : 84}px;line-height:1.02;letter-spacing:-.035em;margin-top:28px}
p{margin-top:24px;font-size:26px;line-height:1.4;color:#c3cfe2;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.f{margin-top:auto;display:flex;justify-content:space-between;align-items:center;font-family:JB;font-size:20px;color:#8a9bb8}
.dot{width:14px;height:14px;border-radius:50%;background:#ffb547;display:inline-block;margin-right:12px}
</style></head><body><div class="grid"></div>
<svg viewBox="0 0 200 200" fill="none" stroke="#3ddcff">
<circle cx="100" cy="100" r="96" stroke-opacity=".25"/><circle cx="100" cy="100" r="72" stroke-opacity=".2"/>
<circle cx="100" cy="100" r="48" stroke-opacity=".2"/><circle cx="100" cy="100" r="24" stroke-opacity=".2"/>
<path d="M100 100 172 34" stroke-width="1.2" stroke-opacity=".9"/><path d="M100 100 L172 34 A96 96 0 0 0 128 8 Z" fill="#3ddcff" fill-opacity=".08" stroke="none"/>
<circle cx="140" cy="62" r="2.5" fill="#ffb547" stroke="none"/><circle cx="70" cy="132" r="2" fill="#3ddcff" stroke="none"/></svg>
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
await page.setContent(`<body style="margin:0;background:#0b1220"><img src="${base}/favicon.svg" style="width:180px;height:180px;display:block"></body>`);
await page.waitForTimeout(200);
await page.screenshot({ path: 'public/apple-touch-icon.png' });

await rm(join(DIST, '__og.html'), { force: true });
await browser.close();
server.close();
console.log('done');
