// The /work/ workbench's layout (src/data/bench.json) and the threads that tie projects together.
import bench from '@/data/bench.json';

export type BenchSpot = { x: number; y: number; w: number; h: number; tag: string; tagAt: [number, number] };

const spots = bench as unknown as Record<string, BenchSpot | string>;

/** A project's place on the bench, or undefined if it has none yet. */
export const benchSpot = (slug: string): BenchSpot | undefined => {
  const s = spots[slug];
  return s && typeof s === 'object' ? s : undefined;
};

/** Translate a drawing made at its native position to the project's spot on the bench. */
export const moveTo = (spot: BenchSpot | undefined, ox: number, oy: number) => (spot ? `translate(${spot.x - ox} ${spot.y - oy})` : undefined);

// ---- Threads: the lines of the thread map ----
export const threadIds = ['hardware', 'signals', 'family', 'web', 'land'] as const;
export type Thread = (typeof threadIds)[number];
// TODO(ave): check wording of the thread names.
export const threads: { id: Thread; name: string; color: string }[] = [
  { id: 'hardware', name: 'Hardware', color: '--gold' },
  { id: 'signals', name: 'Signals and sound', color: '--accent' },
  { id: 'family', name: 'For my family', color: '--rose' },
  { id: 'web', name: 'Websites and tools', color: '--lilac' },
  { id: 'land', name: 'Land', color: '--teal' },
];
