// Where each skill shows up in real code: for every skill in src/data/skills.json, one entry per
// project where a tracked file shows it, each pointing at that file in the project's repo. Add an
// entry only when there is a file to point at; never from a description alone.
//
// The home page Toolbox reads `toolbox` below, which picks its rows from these entries, so every
// chip names a file that exists.

export type Project = 'rampage' | 'v2v' | 'bellhop' | 'signals' | 'led' | 'landspace' | 'sites';
export type ClientRepo = 'gracemaealterations' | 'plvinc' | 'BcofADAM' | 'ND-Site';
export interface Use {
  project: Project;
  /** What the file does and its name. */
  detail: string;
  /** The file's path in the project's repo. */
  file: string;
  /** For client sites: which site's repo. */
  repo?: ClientRepo;
}

/** Each project's case study and, when it is public, its code on GitHub. */
export const projects: Record<Project, { label: string; href: string; repo?: string; public: boolean }> = {
  rampage: { label: 'RAMpage', href: '/work/rampage/', repo: 'https://github.com/avemath/RAMpage', public: true },
  v2v: { label: 'V2V collision warning', href: '/work/v2v-bsm-ofdm/', repo: 'https://github.com/avemath/v2v-bsm-ofdm', public: true },
  bellhop: { label: 'bellhopSim', href: '/work/bellhop-sim/', repo: 'https://github.com/avemath/bellhopSim', public: true },
  signals: { label: 'Signals playground', href: '/work/signals-playground/', repo: 'https://github.com/avemath/avemath.github.io', public: true },
  led: { label: 'LED audio spectrum', href: '/work/led-audio-spectrum/', repo: 'https://github.com/avemath/led-audio-spectrum', public: true },
  // TODO(ave): the Landspace repo is private, so its files are not linked. Make
  // github.com/avemath/landspace public and set this to true to link them.
  landspace: { label: 'Landspace', href: '/work/landspace/', repo: 'https://github.com/avemath/landspace', public: false },
  sites: { label: 'Client sites', href: '/#websites', public: true },
};

export const clientRepos: Record<ClientRepo, { repo: string; label: string; href: string }> = {
  gracemaealterations: { repo: 'https://github.com/avemath/gracemaealterations', label: 'Grace Mae Alterations', href: '/work/grace-mae-alterations/' },
  plvinc: { repo: 'https://github.com/avemath/plvinc', label: 'Petro Land Ventures', href: '/work/petro-land-ventures/' },
  BcofADAM: { repo: 'https://github.com/avemath/BcofADAM', label: 'Because of ADAM', href: '/work/because-of-adam/' },
  'ND-Site': { repo: 'https://github.com/nmdomke/nmdomke.github.io', label: 'Nicholas Domke', href: '/work/nicholas-domke/' },
};

/** The GitHub link for a file. Every repo here serves its main branch. */
export function fileUrl(use: Use) {
  const base = use.project === 'sites' ? clientRepos[use.repo!].repo : projects[use.project].repo!;
  return `${base}/blob/main/${use.file.split('/').map(encodeURIComponent).join('/')}`;
}

export const skillMap: Record<string, { usedIn: Use[] }> = {
  'Digital communications (BPSK, OFDM, synchronization)': { usedIn: [{ project: 'v2v', detail: 'OFDM link, decision-directed PLL, V2V_TXRXf.m', file: 'V2V_TXRXf.m' }, { project: 'bellhop', detail: 'BPSK link over multipath, utils.py', file: 'src/utils.py' }, { project: 'signals', detail: 'BPSK to 16QAM BER, comms.ts', file: 'src/lib/comms.ts' }] },
  'Software-defined radio (ADALM-PLUTO)': { usedIn: [{ project: 'v2v', detail: 'Pluto sdrtx and sdrrx, V2V_TXRXf.m', file: 'V2V_TXRXf.m' }] },
  MATLAB: { usedIn: [{ project: 'v2v', detail: 'full TX and RX chain, V2V_TXRXf.m', file: 'V2V_TXRXf.m' }] },
  ESP32: { usedIn: [{ project: 'led', detail: 'ESP32 ADC sampling, LEA firmware', file: 'Spectrum Analyzer Code (LEA).txt' }] },
  'Raspberry Pi': { usedIn: [{ project: 'rampage', detail: 'Picamera2 stream, pi4_direct.py', file: 'pi4_direct.py' }] },
  'Embedded wiring and soldering': { usedIn: [] },
  'Public records and title research': { usedIn: [{ project: 'landspace', detail: 'chain of title checks, chainAnalysis.js', file: 'apps/web/src/utils/chainAnalysis.js' }] },
  'Excel runsheets': { usedIn: [{ project: 'landspace', detail: 'runsheet export, exportRunsheet.js', file: 'apps/web/src/utils/exportRunsheet.js' }] },
  'Client communication': { usedIn: [] },
  'Project management': { usedIn: [] },
  'Fundraising and outreach': { usedIn: [] },
  Python: { usedIn: [{ project: 'rampage', detail: 'UDP video client, video_direct.py', file: 'video_direct.py' }, { project: 'bellhop', detail: 'channel and BER model, utils.py', file: 'src/utils.py' }] },
  JavaScript: { usedIn: [{ project: 'landspace', detail: 'metes and bounds, metesAndBounds.js', file: 'apps/web/src/utils/metesAndBounds.js' }, { project: 'sites', detail: 'page renderer, render.js', file: 'assets/js/render.js', repo: 'ND-Site' }] },
  TypeScript: { usedIn: [{ project: 'signals', detail: 'BER simulation, comms.ts', file: 'src/lib/comms.ts' }, { project: 'sites', detail: 'contact API route, route.ts', file: 'src/app/api/contact/route.ts', repo: 'gracemaealterations' }] },
  MicroPython: { usedIn: [{ project: 'rampage', detail: 'Pico weapon control, pico_direct.py', file: 'pico_direct.py' }] },
  C: { usedIn: [{ project: 'led', detail: 'C++ FFT firmware, LEA .txt sketch', file: 'Spectrum Analyzer Code (LEA).txt' }] },
  'C++': { usedIn: [{ project: 'led', detail: 'C++ FFT firmware, LEA .txt sketch', file: 'Spectrum Analyzer Code (LEA).txt' }] },
  BELLHOP: { usedIn: [{ project: 'bellhop', detail: 'BELLHOP environment files, environment_builder.py', file: 'src/environment_builder.py' }] },
  'Web Audio': { usedIn: [{ project: 'signals', detail: 'the Hear it tones, fhbfsk.ts', file: 'src/components/demos/signals/fhbfsk.ts' }] },
  Astro: { usedIn: [{ project: 'signals', detail: 'playground UI, SignalsDemo.astro', file: 'src/components/demos/SignalsDemo.astro' }, { project: 'sites', detail: 'site layout, Base.astro', file: 'src/layouts/Base.astro', repo: 'plvinc' }] },
  React: { usedIn: [{ project: 'landspace', detail: 'map pane, MapPane.jsx', file: 'apps/web/src/map/MapPane.jsx' }, { project: 'sites', detail: 'carousel, TestimonialCarousel.tsx', file: 'src/components/ui/TestimonialCarousel.tsx', repo: 'gracemaealterations' }] },
  'Next.js': { usedIn: [{ project: 'sites', detail: 'App Router layout, layout.tsx', file: 'src/app/layout.tsx', repo: 'gracemaealterations' }] },
  'Tailwind CSS': { usedIn: [{ project: 'sites', detail: 'theme config, tailwind.config.ts', file: 'tailwind.config.ts', repo: 'gracemaealterations' }] },
  'Git and GitHub': { usedIn: [{ project: 'sites', detail: 'PR template, pull_request_template.md', file: '.github/pull_request_template.md', repo: 'BcofADAM' }] },
  'GitHub Actions': { usedIn: [{ project: 'landspace', detail: 'lint and checks CI, ci.yml', file: '.github/workflows/ci.yml' }, { project: 'sites', detail: 'Cloudflare deploy, deploy.yml', file: '.github/workflows/deploy.yml', repo: 'plvinc' }] },
  Linux: { usedIn: [] },
  Playwright: { usedIn: [{ project: 'sites', detail: 'keyboard tests, keyboard.spec.ts', file: 'tests/keyboard.spec.ts', repo: 'gracemaealterations' }] },
  Cloudflare: { usedIn: [{ project: 'sites', detail: 'Pages config, wrangler.jsonc', file: 'wrangler.jsonc', repo: 'plvinc' }] },
  Vercel: { usedIn: [{ project: 'landspace', detail: 'functions and cron, vercel.json', file: 'apps/web/vercel.json' }, { project: 'sites', detail: 'Vercel Analytics, analytics.ts', file: 'src/lib/analytics.ts', repo: 'gracemaealterations' }] },
  Supabase: { usedIn: [{ project: 'landspace', detail: 'database schema, schema.sql', file: 'supabase/schema.sql' }] },
  Leaflet: { usedIn: [{ project: 'landspace', detail: 'parcel map, MapPane.jsx', file: 'apps/web/src/map/MapPane.jsx' }] },
  OpenCV: { usedIn: [{ project: 'rampage', detail: 'JPEG encode and overlay, pi4_direct.py', file: 'pi4_direct.py' }] },
  'Accessibility (WCAG)': { usedIn: [{ project: 'sites', detail: 'axe WCAG scan, a11y.spec.ts', file: 'tests/a11y.spec.ts', repo: 'gracemaealterations' }] },
  'SEO and structured data': { usedIn: [{ project: 'sites', detail: 'JSON-LD and meta, SEO.astro', file: 'src/components/SEO.astro', repo: 'plvinc' }] },
  'Headless CMS setup': { usedIn: [{ project: 'sites', detail: 'Sanity Studio, sanity.config.ts', file: 'sanity.config.ts', repo: 'gracemaealterations' }] },
  'Signal processing (FFT, filtering, AGC)': { usedIn: [{ project: 'v2v', detail: 'RRC matched filter, V2V_TXRXf.m', file: 'V2V_TXRXf.m' }, { project: 'signals', detail: 'matched filter, matched.ts', file: 'src/components/demos/signals/matched.ts' }, { project: 'led', detail: 'FFT and AGC, LEA firmware', file: 'Spectrum Analyzer Code (LEA).txt' }] },
  'Channel coding (convolutional, Viterbi)': { usedIn: [{ project: 'v2v', detail: 'convenc and vitdec, V2V_TXRXf.m', file: 'V2V_TXRXf.m' }] },
  'Equalization (MMSE)': { usedIn: [{ project: 'v2v', detail: 'MMSE equalizer, V2V_TXRXf.m', file: 'V2V_TXRXf.m' }] },
  'HTML and CSS': { usedIn: [{ project: 'sites', detail: 'hand-written CSS, style.css', file: 'assets/css/style.css', repo: 'ND-Site' }] },
  'Performance and Core Web Vitals': { usedIn: [{ project: 'sites', detail: 'Lighthouse runner, run-lighthouse.mjs', file: 'scripts/run-lighthouse.mjs', repo: 'gracemaealterations' }] },
  'Google Apps Script': { usedIn: [] },
  'Embedded control and safety logic': { usedIn: [{ project: 'rampage', detail: 'failsafe and cooldown, pico_direct.py', file: 'pico_direct.py' }] },
  'System-level testing and latency debugging': { usedIn: [{ project: 'rampage', detail: 'latency test, weapon_latency_test.py', file: 'weapon_latency_test.py' }] },
  'WS2812B LED matrices': { usedIn: [{ project: 'led', detail: '16x16 FastLED matrix, LEA firmware', file: 'Spectrum Analyzer Code (LEA).txt' }] },
  'RC PWM and interrupts': { usedIn: [{ project: 'rampage', detail: 'pin IRQ pulse timing, pico_direct.py', file: 'pico_direct.py' }] },
  'Solenoid and relay control': { usedIn: [{ project: 'rampage', detail: 'valve sequence, pico_direct.py', file: 'pico_direct.py' }] },
};

/** The project a use belongs to: its name and case study, and its file's link when the repo is public. */
function where(use: Use) {
  const site = use.repo ? clientRepos[use.repo] : undefined;
  const pub = use.project === 'sites' || projects[use.project].public;
  return {
    project: site?.label ?? projects[use.project].label,
    href: site?.href ?? projects[use.project].href,
    /** The file as "repo/path", shown in the Toolbox panel. */
    file: pub ? `${(site?.repo ?? projects[use.project].repo)!.split('/').pop()}/${use.file}` : undefined,
    url: pub ? fileUrl(use) : undefined,
  };
}

const use = (skill: string, project: Project, repo?: ClientRepo) => {
  const u = skillMap[skill].usedIn.find((x) => x.project === project && x.repo === repo);
  if (!u) throw new Error(`skills.ts: no ${project} entry for ${skill}`);
  return u;
};

// Two tools the skills list does not name on their own, each with its file.
const bellhopRuns: Use = { project: 'bellhop', detail: 'BELLHOP environment files, environment_builder.py', file: 'src/environment_builder.py' };
const webAudio: Use = { project: 'signals', detail: 'the Hear it tones, fhbfsk.ts', file: 'src/components/demos/signals/fhbfsk.ts' };

export interface Tool {
  name: string;
  /** "know": can explain at a whiteboard without notes. "built": have built with. */
  level: 'know' | 'built';
  uses: ReturnType<typeof where>[];
}

/** The home page Toolbox. Each chip links to its first use's case study. */
export const toolbox: Tool[] = [
  { name: 'Python', level: 'know', uses: [use('Python', 'bellhop'), use('Python', 'rampage')].map(where) },
  { name: 'MATLAB', level: 'know', uses: [use('MATLAB', 'v2v')].map(where) },
  { name: 'MicroPython and C', level: 'know', uses: [use('MicroPython', 'rampage'), use('C', 'led')].map(where) },
  {
    name: 'Digital communications',
    level: 'know',
    uses: [use('Digital communications (BPSK, OFDM, synchronization)', 'v2v'), use('Digital communications (BPSK, OFDM, synchronization)', 'bellhop'), use('Digital communications (BPSK, OFDM, synchronization)', 'signals')].map(where),
  },
  { name: 'Git and Linux', level: 'know', uses: [use('GitHub Actions', 'sites', 'plvinc'), use('Git and GitHub', 'sites', 'BcofADAM')].map(where) },
  { name: 'Astro and TypeScript', level: 'built', uses: [use('Astro', 'signals'), use('Astro', 'sites', 'plvinc'), use('TypeScript', 'signals')].map(where) },
  { name: 'BELLHOP', level: 'built', uses: [bellhopRuns].map(where) },
  // The intake tool's repo is private, so this one names the case study only.
  { name: 'Apps Script', level: 'built', uses: [{ project: 'Little Explorer Swim', href: '/work/little-explorer-swim/', file: undefined, url: undefined }] },
  { name: 'Web Audio', level: 'built', uses: [webAudio].map(where) },
  { name: 'React', level: 'built', uses: [use('React', 'landspace')].map(where) },
  { name: 'Supabase', level: 'built', uses: [use('Supabase', 'landspace')].map(where) },
];
