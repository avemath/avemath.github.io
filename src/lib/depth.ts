// The descent: every home page section is a depth zone. Depth belongs to the position on the
// page (the slot), not to a section, because the audience switcher reorders the sections with
// CSS. This file is the one source for depth: the section order for each audience, the band
// shades, the depth in each section's label, the signal trace, the effects and the depth gauge
// all come from here, so they always agree.

export type Audience = 'hire' | 'research' | 'website';
export const audiences: Audience[] = ['hire', 'research', 'website'];

export interface Slot {
  depth: number;
  zone: string;
  /** Which of the twelve band shades (--band-0 to --band-11) the slot's water is. */
  band: number;
}

export const slots: Slot[] = [
  { depth: 0, zone: 'Surface', band: 0 },
  { depth: 50, zone: 'Sunlight zone', band: 1 },
  { depth: 200, zone: 'Twilight zone', band: 3 },
  { depth: 1000, zone: 'Sound channel', band: 6 },
  { depth: 2000, zone: 'Midnight zone', band: 8 },
  { depth: 3000, zone: 'Midnight zone', band: 9 },
  { depth: 4000, zone: 'Abyss', band: 10 },
  { depth: 4500, zone: 'Seafloor', band: 11 },
];

// Section names for the gauge's link text, keyed by the id each section already has.
export const sectionNames: Record<string, string> = {
  top: 'Intro',
  now: 'Now',
  featured: 'Featured work',
  research: 'Research',
  websites: 'Client work',
  'field-notes': 'Field notes',
  contact: 'Contact',
  footer: 'Footer',
};

// Slot by slot, top to bottom, for each audience.
export const orders: Record<Audience, string[]> = {
  hire: ['top', 'now', 'featured', 'research', 'websites', 'field-notes', 'contact', 'footer'],
  research: ['top', 'now', 'research', 'featured', 'field-notes', 'websites', 'contact', 'footer'],
  website: ['top', 'now', 'websites', 'featured', 'field-notes', 'research', 'contact', 'footer'],
};

/** From this band down, the light theme's water is dark too, and text switches to light on dark. */
export const DEEP_FROM = 6;
/** Marine snow drifts through the deepest two section bands. */
export const SNOW_BANDS = [9, 10];

export const formatDepth = (m: number) => `${m.toLocaleString('en-US')} m`;

const css = (text: string) => `"${text.replace(/"/g, '\\"')}"`;

/** Everything a band needs, as CSS custom properties. Pages other than home use this directly. */
export function bandVars(band: number) {
  const vars = [`--slot:${band}`, `--band:var(--band-${band})`, `--deep:${band >= DEEP_FROM ? 1 : 0}`];
  if (SNOW_BANDS.includes(band)) vars.push('--snow:block');
  return vars.join(';');
}

/**
 * The signal trace for a slot: a vertical waveform 14px wide, repeating every 128px, used as a
 * mask. It is a clean sine at the surface and picks up a little more noise with every slot, so
 * the trace gets rougher with depth. Every term repeats within 128px, so the tiles join with no visible break.
 */
export function traceMask(i: number) {
  const noise = (i / (slots.length - 1)) * 2.2;
  const pts: string[] = [];
  for (let y = 0; y <= 128; y += 2) {
    const x = 7 + 2.6 * Math.sin((2 * Math.PI * y) / 64) + noise * (0.6 * Math.sin((2 * Math.PI * 13 * y) / 128 + i) + 0.4 * Math.sin((2 * Math.PI * 29 * y) / 128 + 2 * i));
    pts.push(`${Math.max(0.8, Math.min(13.2, x)).toFixed(2)},${y}`);
  }
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 128' width='14' height='128'><polyline points='${pts.join(' ')}' fill='none' stroke='#000' stroke-width='1.3' stroke-linejoin='round'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27')}")`;
}

/** Everything a home zone needs from its slot: its band, the depth that leads its eyebrow, and
 *  its node and segment of the signal trace. */
export function slotVars(i: number) {
  const s = slots[i];
  return [bandVars(s.band), `--depth:${css(`${formatDepth(s.depth)} · `)}`, `--node:${css(formatDepth(s.depth))}`, `--trace:${traceMask(i)}`].join(';');
}

/** Where each kind of case study starts its descent, as a band: client and website work near the
 *  surface, software and engineering mid-water, research deepest. Kept above the light theme's
 *  drop into dark water, so long write-ups stay on light water in the light theme. */
export const caseStart: Record<string, number> = { 'client-site': 0, nonprofit: 0, software: 1, engineering: 2, research: 3 };

/** Each home section's order and slot variables for every audience, as one stylesheet. Hire is
 *  the default, so it also applies without :has() support. */
export function zoneStyles() {
  const ids = Object.keys(sectionNames).filter((id) => id !== 'top' && id !== 'now' && id !== 'footer');
  return audiences
    .flatMap((a) =>
      ids.map((id) => {
        const scope = a === 'hire' ? '' : `.home:has(#aud-${a}:checked) `;
        const i = orders[a].indexOf(id);
        return `${scope}.home-flow>[data-section='${id}']{order:${i};${slotVars(i)}}`;
      }),
    )
    .join('\n');
}
