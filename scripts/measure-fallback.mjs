// Measures the fallback overrides in src/styles/fonts.css: how much Arial (Arial Black for headings,
// Courier New for mono) has to be scaled so a sample of site text takes the same width as the web
// font at the width and weight the site uses, and the web font's ascent and descent at that scale.
// Canvas takes widths as keywords only, so headings are measured at semi-expanded (112.5%).
// Pass the folder that holds arial.ttf, arialbd.ttf, ariblk.ttf and cour.ttf (on Windows, C:\Windows\Fonts):
//   node scripts/measure-fallback.mjs /mnt/c/Windows/Fonts
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const dir = process.argv[2];
if (!dir) throw new Error('Pass the folder that holds arial.ttf, arialbd.ttf, ariblk.ttf and cour.ttf');
const b64 = async (p) => (await readFile(p)).toString('base64');
const fonts = {
  archivo: await b64('node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2'),
  plex: await b64('node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2'),
  arial: await b64(join(dir, 'arial.ttf')),
  bold: await b64(join(dir, 'arialbd.ttf')),
  black: await b64(join(dir, 'ariblk.ttf')),
  cour: await b64(join(dir, 'cour.ttf')),
};
const SAMPLE = 'I research communication systems at LSU and build websites for small businesses and nonprofits. M.S. student in Electrical and Computer Engineering, 2027.';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
await page.setContent(`<style>
@font-face{font-family:A;src:url(data:font/woff2;base64,${fonts.archivo});font-weight:100 900;font-stretch:62% 125%}
@font-face{font-family:P;src:url(data:font/woff2;base64,${fonts.plex})}
@font-face{font-family:R;src:url(data:font/ttf;base64,${fonts.arial})}
@font-face{font-family:B;src:url(data:font/ttf;base64,${fonts.bold})}
@font-face{font-family:K;src:url(data:font/ttf;base64,${fonts.black})}
@font-face{font-family:C;src:url(data:font/ttf;base64,${fonts.cour})}
</style><p style="font-family:A">a</p><p style="font-family:P">a</p><p style="font-family:R">a</p><p style="font-family:B">a</p><p style="font-family:K">a</p><p style="font-family:C">a</p>`);
await page.evaluate(() => document.fonts.ready);
const rows = await page.evaluate((sample) => {
  const ctx = document.createElement('canvas').getContext('2d');
  const m = (font, stretch = 'normal') => {
    ctx.font = font;
    ctx.fontStretch = stretch;
    const t = ctx.measureText(sample);
    return { w: t.width / 100, asc: t.fontBoundingBoxAscent / 100, desc: t.fontBoundingBoxDescent / 100 };
  };
  const row = (name, web, fb) => {
    const k = web.w / fb.w;
    return `${name}: size-adjust ${(k * 100).toFixed(1)}%; ascent-override ${((web.asc / k) * 100).toFixed(1)}%; descent-override ${((web.desc / k) * 100).toFixed(1)}%;`;
  };
  return [
    row('Archivo Fallback (body)', m('400 100px A'), m('400 100px R')),
    row('Archivo Fallback, bold (600 to 900)', m('700 100px A'), m('400 100px B')),
    row('Archivo Wide Fallback (headings)', m('800 100px A', 'semi-expanded'), m('400 100px K')),
    row('IBM Plex Mono Fallback', m('400 100px P'), m('400 100px C')),
  ];
}, SAMPLE);
console.log(rows.join('\n'));
await browser.close();
