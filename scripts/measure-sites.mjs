// Measures the client sites with Google's PageSpeed Insights API (mobile) and writes the results to
// src/data/sites.json: the median of three runs each for performance, accessibility and "Loads in"
// (Largest Contentful Paint, in seconds), with the date. Every site metric on the site comes from here.
//
// The keyless quota is shared and often used up, so pass an API key in the environment (it is never
// written anywhere):
//   PSI_KEY=... node scripts/measure-sites.mjs
// Then rebuild. docs/SOURCES.md says where the numbers come from.
import { readFile, writeFile } from 'node:fs/promises';

const RUNS = 3;
const key = process.env.PSI_KEY;
const sites = JSON.parse(await readFile('src/data/sites.json', 'utf8'));
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

async function run(url) {
  const q = new URLSearchParams({ url, strategy: 'mobile' });
  for (const c of ['performance', 'accessibility', 'best-practices', 'seo']) q.append('category', c);
  if (key) q.set('key', key);
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`);
    const body = await res.json();
    if (res.ok) {
      const l = body.lighthouseResult;
      const score = (c) => Math.round(l.categories[c].score * 100);
      return { performance: score('performance'), accessibility: score('accessibility'), bestPractices: score('best-practices'), seo: score('seo'), lcp: l.audits['largest-contentful-paint'].numericValue / 1000, at: l.fetchTime };
    }
    const msg = body.error?.message ?? res.statusText;
    if (res.status === 429 && !key) throw new Error(`PageSpeed Insights refused a keyless call (429: ${msg.slice(0, 80)}). Set PSI_KEY.`);
    if (attempt === 3) throw new Error(`${url}: ${res.status} ${msg}`);
    await new Promise((r) => setTimeout(r, 5000 * attempt));
  }
}

const day = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
for (const s of sites) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    const r = await run(s.url);
    runs.push(r);
    console.log(`${s.slug} run ${i + 1}: performance ${r.performance}, accessibility ${r.accessibility}, best practices ${r.bestPractices}, SEO ${r.seo}, LCP ${r.lcp.toFixed(2)} s`);
  }
  s.performance = median(runs.map((r) => r.performance));
  s.accessibility = median(runs.map((r) => r.accessibility));
  s.bestPractices = median(runs.map((r) => r.bestPractices));
  s.seo = median(runs.map((r) => r.seo));
  s.loadsInS = Math.round(median(runs.map((r) => r.lcp)) * 10) / 10;
  s.measuredOn = day;
  s.source = 'PageSpeed Insights, mobile, median of 3';
  console.log(`  ${s.slug} median: ${s.performance} / ${s.accessibility} / ${s.loadsInS} s`);
}
await writeFile('src/data/sites.json', JSON.stringify(sites, null, 2) + '\n');
console.log(`\nsrc/data/sites.json updated, measured ${day}.`);
