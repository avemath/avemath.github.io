// The name as a bitmap, for the hero transmission: drawn in the heading font into a canvas as
// wide as the subcarriers that carry it, so each pixel's coverage becomes one subcarrier's level
// in one symbol. Browser only, since it draws with a canvas.
import { LINES, STRETCH, TEXT_BINS } from './tx-signal';

/** The name as a coverage raster TEXT_BINS wide: two lines, each fitted to the width of the longer. */
export function rasterName() {
  const family = getComputedStyle(document.documentElement).getPropertyValue('--font-display').trim() || 'sans-serif';
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.font = `600 100px ${family}`;
  const wide = Math.max(...LINES.map((l) => probe.measureText(l).width));
  const capH = probe.measureText('M').actualBoundingBoxAscent || 70;
  const size = (100 * (TEXT_BINS - 2)) / wide;
  const cap = (capH * size) / 100;
  const gap = size * 0.32;
  const rows = Math.ceil((cap * LINES.length + gap * (LINES.length - 1)) * STRETCH) + 2;
  const c = document.createElement('canvas');
  // #region how:raster
  c.width = TEXT_BINS;
  c.height = rows;
  const x = c.getContext('2d', { willReadFrequently: true })!;
  x.font = `600 ${size}px ${family}`;
  x.fillStyle = '#fff';
  x.textAlign = 'center';
  x.textBaseline = 'alphabetic';
  x.setTransform(1, 0, 0, STRETCH, 0, 0);
  LINES.forEach((line, i) => x.fillText(line, TEXT_BINS / 2, 1 + cap + i * (cap + gap)));
  const px = x.getImageData(0, 0, TEXT_BINS, rows).data;
  const mask = new Float32Array(TEXT_BINS * rows);
  for (let i = 0; i < mask.length; i++) mask[i] = px[i * 4 + 3] / 255;
  // #endregion
  return { mask, rows, font: size, cap, gap };
}
