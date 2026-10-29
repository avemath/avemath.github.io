// Skills by area: every skill in src/data/skills.json, placed in an area, with the
// exact entries in project `stack` fields that count as using it. A skill links to a project
// only when one of these terms is in that project's stack, so the links never claim more than
// the case studies list. A skill with no terms has no linked project, and the page says so.

export type Area = 'comms' | 'embedded' | 'web' | 'tools' | 'professional';

export const areas: { id: Area; label: string }[] = [
  { id: 'comms', label: 'Comms and DSP' },
  { id: 'embedded', label: 'Embedded and hardware' },
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
