// Depth, for the research page only: the one page that goes underwater. Each section is a band
// of water with its depth range, and the gauge, the range labels and the depth in the nav all
// read from this table, so they cannot disagree.

export interface Zone {
  /** The section's id on /research/. */
  id: string;
  from: number;
  to: number;
}

export const zones: Zone[] = [
  { id: 'below', from: 0, to: 20 },
  { id: 'onr', from: 20, to: 50 },
  { id: 'bellhop', from: 50, to: 80 },
  { id: 'pool-alarm', from: 80, to: 100 },
];

export const MAX_DEPTH = zones[zones.length - 1].to;
/** The marks on the gauge, in meters. */
export const gaugeMarks = [0, 25, 50, 75, 100];

export const rangeLabel = (z: Zone) => `${z.from} to ${z.to} m`;
export const zoneById = (id: string) => zones.find((z) => z.id === id)!;
