// Design tokens for canvases, read at run time from the computed CSS (src/styles/tokens.css), so a
// drawing never drifts from the palette and follows the theme. Read once per draw setup, not per frame.
export const token = (name: string, el: Element = document.documentElement) =>
  getComputedStyle(el).getPropertyValue(name).trim();

const parse = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** a mixed with b, p of the way toward a (like CSS color-mix in srgb). Hex in, hex out. */
export function mixHex(a: string, p: number, b: string) {
  const [x, y] = [parse(a), parse(b)];
  return '#' + x.map((v, i) => Math.round(v * p + y[i] * (1 - p)).toString(16).padStart(2, '0')).join('');
}

/** A hex color with an alpha channel, for canvas fills. */
export const withAlpha = (hex: string, alpha: number) => hex + Math.round(alpha * 255).toString(16).padStart(2, '0');
