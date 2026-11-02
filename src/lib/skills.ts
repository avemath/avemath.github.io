// Skills by area: every skill in src/data/skills.json, placed in an area, with the
// exact entries in project `stack` fields that count as using it. A skill links to a project
// only when one of these terms is in that project's stack, so the links never claim more than
// the case studies list. A skill with no terms has no linked project, and the page says so.
//
// `usedIn` feeds the home page's skills matrix (Fig. 06): one entry per project where the skill
// was used, each pointing at one real file in that project's repo, so every dot opens a file.
// Add a dot only when there is a tracked file to point at; never from a description alone.

export type Area = 'comms' | 'embedded' | 'web' | 'tools' | 'professional';

export const areas: { id: Area; label: string }[] = [
  { id: 'comms', label: 'Comms and DSP' },
  { id: 'embedded', label: 'Embedded and hardware' },
  { id: 'web', label: 'Web' },
  { id: 'tools', label: 'Tools' },
  { id: 'professional', label: 'Professional' },
];

export type MatrixProject = 'rampage' | 'v2v' | 'bellhop' | 'signals' | 'led' | 'landspace' | 'sites';
export type ClientRepo = 'gracemaealterations' | 'plvinc' | 'BcofADAM' | 'ND-Site';
export interface Use {
  project: MatrixProject;
  /** What the file does and its name, as the dot's tooltip reads. */
  detail: string;
  /** The file's path in the project's repo. */
  file: string;
  /** For client sites: which site's repo. */
  repo?: ClientRepo;
}

/** The matrix's columns, in order, and where each project's code lives on GitHub. */
export const matrixProjects: { id: MatrixProject; label: string; href: string; repo?: string; public: boolean }[] = [
  { id: 'rampage', label: 'RAMpage', href: '/work/rampage/', repo: 'https://github.com/avemath/RAMpage', public: true },
  { id: 'v2v', label: 'V2V', href: '/work/v2v-bsm-ofdm/', repo: 'https://github.com/avemath/v2v-bsm-ofdm', public: true },
  { id: 'bellhop', label: 'bellhopSim', href: '/work/bellhop-sim/', repo: 'https://github.com/avemath/bellhopSim', public: true },
  { id: 'signals', label: 'Signals', href: '/work/signals-playground/', repo: 'https://github.com/avemath/avemath.github.io', public: true },
  { id: 'led', label: 'LED', href: '/work/led-audio-spectrum/', repo: 'https://github.com/avemath/led-audio-spectrum', public: true },
  // TODO(ave): the Landspace repo is private, so its column stays off the matrix (its dots would
  // not open). Make github.com/avemath/landspace public and set this to true to show it.
  { id: 'landspace', label: 'Landspace', href: '/work/landspace/', repo: 'https://github.com/avemath/landspace', public: false },
  { id: 'sites', label: 'Client sites', href: '/#websites', public: true },
];

export const clientRepos: Record<ClientRepo, string> = {
  gracemaealterations: 'https://github.com/avemath/gracemaealterations',
  plvinc: 'https://github.com/avemath/plvinc',
  BcofADAM: 'https://github.com/avemath/BcofADAM',
  'ND-Site': 'https://github.com/nmdomke/nmdomke.github.io',
};

/** The GitHub link for a dot. Every repo here serves its main branch. */
export function fileUrl(use: Use) {
  const base = use.project === 'sites' ? clientRepos[use.repo!] : matrixProjects.find((p) => p.id === use.project)!.repo!;
  return `${base}/blob/main/${use.file.split('/').map(encodeURIComponent).join('/')}`;
}

export const skillMap: Record<string, { area: Area; terms: string[]; usedIn: Use[] }> = {
  'Digital communications (BPSK, OFDM, synchronization)': { area: 'comms', terms: ['Digital communications', 'OFDM'], usedIn: [{ project: 'v2v', detail: 'OFDM link, Costas PLL, V2V_TXRXf.m', file: 'V2V_TXRXf.m' }, { project: 'bellhop', detail: 'BPSK link over multipath, utils.py', file: 'src/utils.py' }, { project: 'signals', detail: 'BPSK to 16QAM BER, comms.ts', file: 'src/lib/comms.ts' }] },
  'Software-defined radio (ADALM-PLUTO)': { area: 'comms', terms: ['ADALM-PLUTO SDR'], usedIn: [{ project: 'v2v', detail: 'Pluto sdrtx and sdrrx, V2V_TXRXf.m', file: 'V2V_TXRXf.m' }] },
  MATLAB: { area: 'tools', terms: ['MATLAB'], usedIn: [{ project: 'v2v', detail: 'full TX and RX chain, V2V_TXRXf.m', file: 'V2V_TXRXf.m' }] },
  ESP32: { area: 'embedded', terms: ['ESP32'], usedIn: [{ project: 'led', detail: 'ESP32 ADC sampling, LEA firmware', file: 'Spectrum Analyzer Code (LEA).txt' }] },
  'Raspberry Pi': { area: 'embedded', terms: ['Raspberry Pi Pico W', 'Raspberry Pi 4B'], usedIn: [{ project: 'rampage', detail: 'Picamera2 stream, pi4_direct.py', file: 'pi4_direct.py' }] },
  // TODO(ave): no file shows this skill in a public repo, so it is left off the skills matrix.
  'Embedded wiring and soldering': { area: 'embedded', terms: [], usedIn: [] },
  // TODO(ave): only Landspace shows this, and its repo is private, so it is off the matrix until it is public.
  'Public records and title research': { area: 'professional', terms: [], usedIn: [{ project: 'landspace', detail: 'chain of title checks, chainAnalysis.js', file: 'apps/web/src/utils/chainAnalysis.js' }] },
  // TODO(ave): only Landspace shows this, and its repo is private, so it is off the matrix until it is public.
  'Excel runsheets': { area: 'professional', terms: [], usedIn: [{ project: 'landspace', detail: 'runsheet export, exportRunsheet.js', file: 'apps/web/src/utils/exportRunsheet.js' }] },
  // TODO(ave): no file shows this skill in a public repo, so it is left off the skills matrix.
  'Client communication': { area: 'professional', terms: [], usedIn: [] },
  // TODO(ave): no file shows this skill in a public repo, so it is left off the skills matrix.
  'Project management': { area: 'professional', terms: [], usedIn: [] },
  // TODO(ave): no file shows this skill in a public repo, so it is left off the skills matrix.
  'Fundraising and outreach': { area: 'professional', terms: [], usedIn: [] },
  Python: { area: 'tools', terms: ['Python'], usedIn: [{ project: 'rampage', detail: 'UDP video client, video_direct.py', file: 'video_direct.py' }, { project: 'bellhop', detail: 'channel and BER model, utils.py', file: 'src/utils.py' }] },
  JavaScript: { area: 'web', terms: ['JavaScript'], usedIn: [{ project: 'landspace', detail: 'metes and bounds, metesAndBounds.js', file: 'apps/web/src/utils/metesAndBounds.js' }, { project: 'sites', detail: 'page renderer, render.js', file: 'assets/js/render.js', repo: 'ND-Site' }] },
  TypeScript: { area: 'web', terms: ['TypeScript'], usedIn: [{ project: 'signals', detail: 'BER simulation, comms.ts', file: 'src/lib/comms.ts' }, { project: 'sites', detail: 'contact API route, route.ts', file: 'src/app/api/contact/route.ts', repo: 'gracemaealterations' }] },
  MicroPython: { area: 'embedded', terms: ['MicroPython'], usedIn: [{ project: 'rampage', detail: 'Pico weapon control, pico_direct.py', file: 'pico_direct.py' }] },
  'C and C++': { area: 'embedded', terms: ['C++'], usedIn: [{ project: 'led', detail: 'C++ FFT firmware, LEA .txt sketch', file: 'Spectrum Analyzer Code (LEA).txt' }] },
  Astro: { area: 'web', terms: ['Astro'], usedIn: [{ project: 'signals', detail: 'playground UI, SignalsDemo.astro', file: 'src/components/demos/SignalsDemo.astro' }, { project: 'sites', detail: 'site layout, Base.astro', file: 'src/layouts/Base.astro', repo: 'plvinc' }] },
  React: { area: 'web', terms: ['React'], usedIn: [{ project: 'landspace', detail: 'map pane, MapPane.jsx', file: 'apps/web/src/map/MapPane.jsx' }, { project: 'sites', detail: 'carousel, TestimonialCarousel.tsx', file: 'src/components/ui/TestimonialCarousel.tsx', repo: 'gracemaealterations' }] },
  'Next.js': { area: 'web', terms: ['Next.js'], usedIn: [{ project: 'sites', detail: 'App Router layout, layout.tsx', file: 'src/app/layout.tsx', repo: 'gracemaealterations' }] },
  'Tailwind CSS': { area: 'web', terms: ['Tailwind CSS'], usedIn: [{ project: 'sites', detail: 'theme config, tailwind.config.ts', file: 'tailwind.config.ts', repo: 'gracemaealterations' }] },
  'Git and GitHub': { area: 'tools', terms: ['GitHub Actions', 'GitHub Pages'], usedIn: [{ project: 'sites', detail: 'PR template, pull_request_template.md', file: '.github/pull_request_template.md', repo: 'BcofADAM' }] },
  'GitHub Actions': { area: 'tools', terms: ['GitHub Actions'], usedIn: [{ project: 'landspace', detail: 'lint and checks CI, ci.yml', file: '.github/workflows/ci.yml' }, { project: 'sites', detail: 'Cloudflare deploy, deploy.yml', file: '.github/workflows/deploy.yml', repo: 'plvinc' }] },
  // TODO(ave): no file shows this skill in a public repo, so it is left off the skills matrix.
  Linux: { area: 'tools', terms: [], usedIn: [] },
  Playwright: { area: 'tools', terms: ['Playwright'], usedIn: [{ project: 'sites', detail: 'keyboard tests, keyboard.spec.ts', file: 'tests/keyboard.spec.ts', repo: 'gracemaealterations' }] },
  Cloudflare: { area: 'web', terms: ['Cloudflare Pages', 'Cloudflare Workers', 'Cloudflare Access'], usedIn: [{ project: 'sites', detail: 'Pages config, wrangler.jsonc', file: 'wrangler.jsonc', repo: 'plvinc' }] },
  Vercel: { area: 'web', terms: ['Vercel'], usedIn: [{ project: 'landspace', detail: 'functions and cron, vercel.json', file: 'apps/web/vercel.json' }, { project: 'sites', detail: 'Vercel Analytics, analytics.ts', file: 'src/lib/analytics.ts', repo: 'gracemaealterations' }] },
  // TODO(ave): only Landspace shows this, and its repo is private, so it is off the matrix until it is public.
  Supabase: { area: 'web', terms: ['Supabase'], usedIn: [{ project: 'landspace', detail: 'database schema, schema.sql', file: 'supabase/schema.sql' }] },
  // TODO(ave): only Landspace shows this, and its repo is private, so it is off the matrix until it is public.
  Leaflet: { area: 'web', terms: ['Leaflet'], usedIn: [{ project: 'landspace', detail: 'parcel map, MapPane.jsx', file: 'apps/web/src/map/MapPane.jsx' }] },
  OpenCV: { area: 'tools', terms: ['OpenCV'], usedIn: [{ project: 'rampage', detail: 'JPEG encode and overlay, pi4_direct.py', file: 'pi4_direct.py' }] },
  'Accessibility (WCAG)': { area: 'web', terms: [], usedIn: [{ project: 'sites', detail: 'axe WCAG scan, a11y.spec.ts', file: 'tests/a11y.spec.ts', repo: 'gracemaealterations' }] },
  'SEO and structured data': { area: 'web', terms: [], usedIn: [{ project: 'sites', detail: 'JSON-LD and meta, SEO.astro', file: 'src/components/SEO.astro', repo: 'plvinc' }] },
  'Headless CMS setup': { area: 'web', terms: ['Pages CMS', 'Sanity', 'Sveltia CMS'], usedIn: [{ project: 'sites', detail: 'Sanity Studio, sanity.config.ts', file: 'sanity.config.ts', repo: 'gracemaealterations' }] },
  'Signal processing (FFT, filtering, AGC)': { area: 'comms', terms: ['Signal processing', 'arduinoFFT'], usedIn: [{ project: 'v2v', detail: 'RRC matched filter, V2V_TXRXf.m', file: 'V2V_TXRXf.m' }, { project: 'signals', detail: 'matched filter, matched.ts', file: 'src/components/demos/signals/matched.ts' }, { project: 'led', detail: 'FFT and AGC, LEA firmware', file: 'Spectrum Analyzer Code (LEA).txt' }] },
  'Channel coding (convolutional, Viterbi)': { area: 'comms', terms: ['Viterbi decoding'], usedIn: [{ project: 'v2v', detail: 'convenc and vitdec, V2V_TXRXf.m', file: 'V2V_TXRXf.m' }] },
  'Equalization (MMSE)': { area: 'comms', terms: [], usedIn: [{ project: 'v2v', detail: 'MMSE equalizer, V2V_TXRXf.m', file: 'V2V_TXRXf.m' }] },
  'HTML and CSS': { area: 'web', terms: ['HTML', 'CSS'], usedIn: [{ project: 'sites', detail: 'hand-written CSS, style.css', file: 'assets/css/style.css', repo: 'ND-Site' }] },
  'Performance and Core Web Vitals': { area: 'web', terms: [], usedIn: [{ project: 'sites', detail: 'Lighthouse runner, run-lighthouse.mjs', file: 'scripts/run-lighthouse.mjs', repo: 'gracemaealterations' }] },
  // TODO(ave): no file shows this skill in a public repo, so it is left off the skills matrix.
  'Google Apps Script': { area: 'tools', terms: ['Google Apps Script'], usedIn: [] },
  'Embedded control and safety logic': { area: 'embedded', terms: [], usedIn: [{ project: 'rampage', detail: 'failsafe and cooldown, pico_direct.py', file: 'pico_direct.py' }] },
  'System-level testing and latency debugging': { area: 'embedded', terms: [], usedIn: [{ project: 'rampage', detail: 'latency test, weapon_latency_test.py', file: 'weapon_latency_test.py' }] },
  'WS2812B LED matrices': { area: 'embedded', terms: ['WS2812B'], usedIn: [{ project: 'led', detail: '16x16 FastLED matrix, LEA firmware', file: 'Spectrum Analyzer Code (LEA).txt' }] },
  'RC PWM and interrupts': { area: 'embedded', terms: [], usedIn: [{ project: 'rampage', detail: 'pin IRQ pulse timing, pico_direct.py', file: 'pico_direct.py' }] },
  'Solenoid and relay control': { area: 'embedded', terms: [], usedIn: [{ project: 'rampage', detail: 'valve sequence, pico_direct.py', file: 'pico_direct.py' }] },
};
