// The descent: every home page section is a depth zone. Depth belongs to the position on the
// page (the slot), not to a section, because the audience switcher reorders the sections with
// CSS. The orders below mirror the `order` rules in pages/index.astro; if those change, change
// these too. This file is the one source for depth: the band shades, the depth in each section's
// label, the effects and the depth gauge all come from here, so they always agree.

export type Audience = 'hire' | 'research' | 'website';
export const audiences: Audience[] = ['hire', 'research', 'website'];

export interface Slot {
  depth: number;
  zone: string;
}

export const slots: Slot[] = [
  { depth: 0, zone: 'Surface' },
  { depth: 50, zone: 'Sunlight zone' },
  { depth: 200, zone: 'Twilight zone' },
  { depth: 400, zone: 'Twilight zone' },
  { depth: 600, zone: 'Twilight zone' },
  { depth: 800, zone: 'Twilight zone' },
  { depth: 1000, zone: 'Sound channel' },
  { depth: 1500, zone: 'Midnight zone' },
  { depth: 2000, zone: 'Midnight zone' },
  { depth: 3000, zone: 'Midnight zone' },
  { depth: 4000, zone: 'Abyss' },
  { depth: 4500, zone: 'Seafloor' },
];

// Section names for the gauge's link text, keyed by the id each section already has.
export const sectionNames: Record<string, string> = {
  top: 'Intro',
  now: 'Now',
  featured: 'Featured work',
  experience: 'Experience',
  skills: 'Skills',
  recommendations: 'Recommendations',
  research: 'Research',
  websites: 'Client work',
  'field-notes': 'Field notes',
  services: 'For clients',
  contact: 'Contact',
  footer: 'Footer',
};

// Slot by slot, top to bottom, for each audience.
export const orders: Record<Audience, string[]> = {
  hire: ['top', 'now', 'featured', 'experience', 'skills', 'recommendations', 'research', 'websites', 'field-notes', 'services', 'contact', 'footer'],
  research: ['top', 'now', 'research', 'featured', 'recommendations', 'experience', 'skills', 'field-notes', 'websites', 'services', 'contact', 'footer'],
  website: ['top', 'now', 'websites', 'services', 'featured', 'field-notes', 'recommendations', 'experience', 'skills', 'research', 'contact', 'footer'],
};

/** From this slot down, the light theme's water is dark too, and text switches to light on dark. */
export const DEEP_FROM = 6;
/** Marine snow drifts through the deepest two section bands. */
export const SNOW_SLOTS = [9, 10];

export const formatDepth = (m: number) => `${m.toLocaleString('en-US')} m`;

/** Everything a zone needs from its slot, as CSS custom properties. `label` adds the depth that
 *  leads the section's eyebrow, which only the home page shows. */
export function slotVars(i: number, label = true) {
  const vars = [`--slot:${i}`, `--band:var(--band-${i})`, `--deep:${i >= DEEP_FROM ? 1 : 0}`];
  if (label) vars.push(`--depth:${css(`${formatDepth(slots[i].depth)} · `)}`);
  if (SNOW_SLOTS.includes(i)) vars.push('--snow:block');
  return vars.join(';');
}

/** Where each kind of case study starts its descent: client and website work near the surface,
 *  software and engineering mid-water, research deepest. Kept above the light theme's drop into
 *  dark water, so long write-ups stay on light water in the light theme. */
export const caseStart: Record<string, number> = { 'client-site': 0, nonprofit: 0, software: 1, engineering: 2, research: 3 };

const css = (text: string) => `"${text.replace(/"/g, '\\"')}"`;

/** Each section's slot variables for every audience order, as one stylesheet. Hire is the default. */
export function zoneStyles() {
  const ids = Object.keys(sectionNames).filter((id) => id !== 'top' && id !== 'now' && id !== 'footer');
  return audiences
    .flatMap((a) =>
      ids.map((id) => {
        const scope = a === 'hire' ? '' : `.home:has(#aud-${a}:checked) `;
        return `${scope}.home-flow>[data-section='${id}']{${slotVars(orders[a].indexOf(id))}}`;
      }),
    )
    .join('\n');
}
