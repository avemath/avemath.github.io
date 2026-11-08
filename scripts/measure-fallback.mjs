// Measures the fallback overrides in src/styles/fonts.css: how much a local font has to be scaled so
// a sample of site text takes the same width as the web font, and the web font's ascent and descent
// at that scale. Bodoni Moda is matched against Georgia (roman and italic), Hanken Grotesk against
// Arial and JetBrains Mono against Courier New.
// Pass the folder that holds georgia.ttf, georgiai.ttf, arial.ttf, arialbd.ttf and cour.ttf
// (on Windows, C:\Windows\Fonts):
//   node scripts/measure-fallback.mjs /mnt/c/Windows/Fonts
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const dir = process.argv[2];
if (!dir) throw new Error('Pass the folder that holds georgia.ttf, georgiai.ttf, arial.ttf, arialbd.ttf and cour.ttf');
const b64 = async (p) => (await readFile(p)).toString('base64');
const fs = 'node_modules/@fontsource-variable';
const fonts = {
  bodoni: await b64(`${fs}/bodoni-moda/files/bodoni-moda-latin-wght-normal.woff2`),
  bodoniI: await b64(`${fs}/bodoni-moda/files/bodoni-moda-latin-wght-italic.woff2`),
  hanken: await b64(`${fs}/hanken-grotesk/files/hanken-grotesk-latin-wght-normal.woff2`),
  jet: await b64(`${fs}/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2`),
  georgia: await b64(join(dir, 'georgia.ttf')),
  georgiaI: await b64(join(dir, 'georgiai.ttf')),
  arial: await b64(join(dir, 'arial.ttf')),
  arialB: await b64(join(dir, 'arialbd.ttf')),
  cour: await b64(join(dir, 'cour.ttf')),
};
const SAMPLE = 'Avery Matherne. I study how sound travels through water. M.S. student in electrical and computer engineering at LSU, 2027.';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
const faces = Object.entries(fonts)
  .map(([k, v]) => `@font-face{font-family:${k};src:url(data:font/${/^(georgia|arial|cour)/.test(k) ? 'ttf' : 'woff2'};base64,${v});font-weight:100 900}`)
  .join('');
await page.setContent(`<style>${faces}</style>${Object.keys(fonts).map((k) => `<p style="font-family:${k}">a</p>`).join('')}`);
await page.evaluate(() => document.fonts.ready);
const rows = await page.evaluate((sample) => {
  const ctx = document.createElement('canvas').getContext('2d');
  const m = (font) => {
    ctx.font = font;
    const t = ctx.measureText(sample);
    return { w: t.width / 100, asc: t.fontBoundingBoxAscent / 100, desc: t.fontBoundingBoxDescent / 100};
  };
  const row = (name, web, fb) => {
    const k = web.w / fb.w;
    return `${name}: size-adjust ${(k * 100).toFixed(1)}%; ascent-override ${((web.asc / k) * 100).toFixed(1)}%; descent-override ${((web.desc / k) * 100).toFixed(1)}%;`;
  };
  return [
    row('Bodoni Fallback (400, roman)', m('400 100px bodoni'), m('400 100px georgia')),
    row('Bodoni Fallback (400, italic)', m('400 100px bodoniI'), m('400 100px georgiaI')),
    row('Hanken Fallback (400)', m('400 100px hanken'), m('400 100px arial')),
    row('Hanken Fallback (600 bold)', m('600 100px hanken'), m('400 100px arialB')),
    row('JetBrains Fallback (400)', m('400 100px jet'), m('400 100px cour')),
  ];
}, SAMPLE);
console.log(rows.join('\n'));
await browser.close();
