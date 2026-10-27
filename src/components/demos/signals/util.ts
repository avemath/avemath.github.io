// Small helpers shared by the signals playground panels.

/** Reads a theme token, for drawing on canvas. */
export const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export const q = <T extends Element>(root: Element, sel: string) => root.querySelector<T>(sel)!;

/** Points for an SVG polyline from samples, mapped into a box. */
export function polyline(ys: ArrayLike<number>, w: number, h: number, min: number, max: number, x0 = 0) {
  const n = ys.length;
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = x0 + (i / Math.max(1, n - 1)) * (w - x0);
    const y = h - ((ys[i] - min) / (max - min)) * h;
    out += `${x.toFixed(1)},${y.toFixed(1)} `;
  }
  return out;
}
