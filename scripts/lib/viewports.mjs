// The viewports every layout test and screenshot pass runs at, in one place.
//
// LAPTOP holds the sizes Ave's laptop actually produces with Windows display scaling: a CSS viewport
// between about 960 and 1280 wide and often only 640 to 800 tall, plus a 1440x900 window at 125% and
// 150% browser zoom. Zoom is a smaller CSS viewport at a higher pixel density (1440 / 1.25 = 1152 by
// 720 at 1.25x; 1440 / 1.5 = 960 by 600 at 1.5x), which is how they are emulated here.
export const LAPTOP = [
  { label: '960x640', width: 960, height: 640, dpr: 1 },
  { label: '1100x700', width: 1100, height: 700, dpr: 1 },
  { label: '1280x720', width: 1280, height: 720, dpr: 1 },
  { label: '1536x864', width: 1536, height: 864, dpr: 1 },
  { label: '1440x900 at 125%', width: 1152, height: 720, dpr: 1.25 },
  { label: '1440x900 at 150%', width: 960, height: 600, dpr: 1.5 },
];

/** The sizes the tests always covered: phones, a tablet, laptops and big screens. */
export const STANDARD = [
  { label: '320', width: 320, height: 640, dpr: 2 },
  { label: '390', width: 390, height: 844, dpr: 3 },
  { label: '768', width: 768, height: 1024, dpr: 2 },
  { label: '1024', width: 1024, height: 768, dpr: 1 },
  { label: '1280x800', width: 1280, height: 800, dpr: 1 },
  { label: '1440x900', width: 1440, height: 900, dpr: 1 },
  { label: '1920', width: 1920, height: 1080, dpr: 1 },
];

export const ALL = [...STANDARD, ...LAPTOP];

/** Playwright newPage/newContext options for a viewport. */
export const pageOpts = (v, extra = {}) => ({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: v.dpr, ...extra });
