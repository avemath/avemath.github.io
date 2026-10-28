// The descent: every home page section is a depth zone. Depth belongs to the position on the
// page (the slot), not to a section, because the audience switcher reorders the sections with
// CSS. The orders below mirror the `order` rules in pages/index.astro; if those change, change
// these too. The band colors, the zone tags and the depth gauge are all generated from here.

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
  top: 'Top of the page',
  now: 'Now',
  featured: 'Featured work',
  experience: 'Experience',
  skills: 'Skills',
  recommendations: 'Recommendations',
  research: 'Research',
  websites: 'Websites',
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

export const formatDepth = (m: number) => `${m.toLocaleString('en-US')} m`;
export const zoneTag = (s: Slot) => `${formatDepth(s.depth)} · ${s.zone}`;

const css = (s: string) => `"${s.replace(/"/g, '\\"')}"`;

/** Per-section slot and zone tag variables for every audience, as one stylesheet. */
export function zoneStyles() {
  const ids = Object.keys(sectionNames).filter((id) => id !== 'top' && id !== 'now' && id !== 'footer');
  return ids
    .map((id) => {
      const vars = audiences
        .map((a) => {
          const i = orders[a].indexOf(id);
          return `--slot-${a}:${i};--tag-${a}:${css(zoneTag(slots[i]))}`;
        })
        .join(';');
      return `.home-flow>[data-section='${id}']{${vars}}`;
    })
    .join('\n');
}
