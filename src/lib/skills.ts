// The skills constellation: every skill in src/data/skills.json, placed in an area, with the
// exact entries in project `stack` fields that count as using it. A skill links to a project
// only when one of these terms is in that project's stack, so the links never claim more than
// the case studies list. A skill with no terms has no linked project, and the page says so.

export type Area = 'comms' | 'embedded' | 'web' | 'tools' | 'professional';

export const areas: { id: Area; label: string }[] = [
  { id: 'comms', label: 'Comms and DSP' },
  { id: 'embedded', label: 'Embedded' },
  { id: 'web', label: 'Web' },
  { id: 'tools', label: 'Tools' },
  { id: 'professional', label: 'Professional' },
];

export const skillMap: Record<string, { area: Area; terms: string[] }> = {
  'Digital communications (BPSK, OFDM, synchronization)': { area: 'comms', terms: ['Digital communications', 'OFDM'] },
  'Software-defined radio (ADALM-PLUTO)': { area: 'comms', terms: ['ADALM-PLUTO SDR'] },
  MATLAB: { area: 'tools', terms: ['MATLAB'] },
  ESP32: { area: 'embedded', terms: ['ESP32'] },
  'Raspberry Pi': { area: 'embedded', terms: ['Raspberry Pi Pico W', 'Raspberry Pi 4B'] },
  'Embedded wiring and soldering': { area: 'embedded', terms: [] },
  'Public records and title research': { area: 'professional', terms: [] },
  'Excel runsheets': { area: 'professional', terms: [] },
  'Client communication': { area: 'professional', terms: [] },
  'Project management': { area: 'professional', terms: [] },
  'Fundraising and outreach': { area: 'professional', terms: [] },
  Python: { area: 'tools', terms: ['Python'] },
  JavaScript: { area: 'web', terms: ['JavaScript'] },
  TypeScript: { area: 'web', terms: ['TypeScript'] },
  MicroPython: { area: 'embedded', terms: ['MicroPython'] },
  'C and C++': { area: 'embedded', terms: ['C++'] },
  Astro: { area: 'web', terms: ['Astro'] },
  React: { area: 'web', terms: ['React'] },
  'Next.js': { area: 'web', terms: ['Next.js'] },
  'Tailwind CSS': { area: 'web', terms: ['Tailwind CSS'] },
  'Git and GitHub': { area: 'tools', terms: ['GitHub Actions', 'GitHub Pages'] },
  'GitHub Actions': { area: 'tools', terms: ['GitHub Actions'] },
  Linux: { area: 'tools', terms: [] },
  Playwright: { area: 'tools', terms: ['Playwright'] },
  Cloudflare: { area: 'web', terms: ['Cloudflare Pages', 'Cloudflare Workers', 'Cloudflare Access'] },
  Vercel: { area: 'web', terms: ['Vercel'] },
  Supabase: { area: 'web', terms: ['Supabase'] },
  Leaflet: { area: 'web', terms: ['Leaflet'] },
  OpenCV: { area: 'tools', terms: ['OpenCV'] },
  'Accessibility (WCAG)': { area: 'web', terms: [] },
  'SEO and structured data': { area: 'web', terms: [] },
  'Headless CMS setup': { area: 'web', terms: ['Pages CMS', 'Sanity', 'Sveltia CMS'] },
  'Signal processing (FFT, filtering, AGC)': { area: 'comms', terms: ['Signal processing', 'arduinoFFT'] },
  'Channel coding (convolutional, Viterbi)': { area: 'comms', terms: ['Viterbi decoding'] },
  'Equalization (MMSE)': { area: 'comms', terms: [] },
  'HTML and CSS': { area: 'web', terms: ['HTML', 'CSS'] },
  'Performance and Core Web Vitals': { area: 'web', terms: [] },
  'Google Apps Script': { area: 'tools', terms: ['Google Apps Script'] },
  'Embedded control and safety logic': { area: 'embedded', terms: [] },
  'System-level testing and latency debugging': { area: 'embedded', terms: [] },
  'WS2812B LED matrices': { area: 'embedded', terms: ['WS2812B'] },
  'RC PWM and interrupts': { area: 'embedded', terms: [] },
  'Solenoid and relay control': { area: 'embedded', terms: [] },
};

/** Seeded uniform generator in [0, 1), so the constellation is the same on every build. */
function rng(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Point {
  skill: string;
  known: boolean;
  area: Area;
  x: number;
  y: number;
}

/**
 * Places every skill in a 1000 by 560 field. Each area has an ideal point. "Know well" skills sit
 * close to it, "Have built with" skills scatter further out, the way a confident symbol lands
 * near its ideal point and a noisy one does not. Points keep at least MIN_GAP apart so each one
 * stays a clear target.
 */
export const FIELD = { w: 1000, h: 560 };
export const centers: Record<Area, [number, number]> = {
  comms: [165, 175],
  embedded: [470, 150],
  web: [800, 215],
  tools: [330, 420],
  professional: [665, 445],
};
const MIN_GAP = 34;

export function place(skills: { skill: string; known: boolean }[]): Point[] {
  const rand = rng(2026);
  const placed: Point[] = [];
  // Known skills first, so they claim the spots nearest their ideal point.
  const order = [...skills].sort((a, b) => Number(b.known) - Number(a.known));
  for (const s of order) {
    const area = skillMap[s.skill]?.area ?? 'tools';
    const [cx, cy] = centers[area];
    const spread = s.known ? 38 : 92;
    let best: [number, number] = [cx, cy];
    for (let tries = 0; tries < 400; tries++) {
      const grow = 1 + Math.floor(tries / 80) * 0.35;
      const a = rand() * 2 * Math.PI;
      const r = (s.known ? 0.45 + 0.55 * Math.sqrt(rand()) : 0.55 + 0.45 * Math.sqrt(rand())) * spread * grow;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r * 0.8;
      if (x < 30 || x > FIELD.w - 30 || y < 40 || y > FIELD.h - 30) continue;
      if (Math.hypot(x - cx, y - cy) < 22) continue;
      if (placed.every((p) => Math.hypot(p.x - x, p.y - y) >= MIN_GAP)) {
        best = [x, y];
        break;
      }
    }
    placed.push({ skill: s.skill, known: s.known, area, x: Math.round(best[0]), y: Math.round(best[1]) });
  }
  return placed;
}
