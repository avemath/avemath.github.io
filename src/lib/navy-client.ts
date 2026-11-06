// The site's navy for canvases, read from the --navy token at run time so it never drifts from
// src/styles/tokens.css.
export const navy = () => getComputedStyle(document.documentElement).getPropertyValue('--navy').trim() || '#16325a';

const parse = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** a mixed with b, p of the way toward a (like CSS color-mix in srgb). */
export function mixHex(a: string, p: number, b: string) {
  const [x, y] = [parse(a), parse(b)];
  return '#' + x.map((v, i) => Math.round(v * p + y[i] * (1 - p)).toString(16).padStart(2, '0')).join('');
}

/** The navy with an alpha channel, for canvas fills. */
export const navyAlpha = (alpha: number) => navy() + Math.round(alpha * 255).toString(16).padStart(2, '0');
