// The signal mesh: a wavy crosshatch pane of "water", seen at an angle, that a packet ripples across.
// Pure math, shared by the live playground (src/scripts/playground.ts) and the still drawing on the
// home page (src/components/plates/MeshStill.astro). u runs across the pane (0 at the sender, 1 at
// the receiver), v runs into it.

export const NU = 110;
export const NV = 24;

/** The view: a slight yaw, looking down at the pane. Returns canvas units for a W x H canvas. */
export function projector(W: number, H: number) {
  const yaw = -0.16;
  const pitch = 0.62;
  const dist = 2.4;
  const scale = 0.6;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  return (u: number, v: number, h: number): [number, number] => {
    const x = (u - 0.5) * 1.6;
    const y = -h;
    const z = (v - 0.5) * 0.75;
    const X = x * cy - z * sy;
    let Z = x * sy + z * cy;
    const Y = y * cp - Z * sp;
    Z = y * sp + Z * cp;
    const f = (dist - 0.3) / (Z + dist);
    const s = W * scale;
    return [W * 0.5 + X * f * s, H * 0.5 + Y * f * s];
  };
}

/** The resting water: a slow swell, so the pane is never flat. */
export const swell = (u: number, v: number, t: number) => 0.006 * Math.sin(u * 9 + t / 0.9) * Math.sin(v * 7 - t / 1.3);

/** Spatial ripple frequency (cycles across the pane) for a chip: the high tone's ripples sit closer
 *  together than the low tone's. */
export const rippleFreq = (bit: number) => (bit ? 30 : 16);
