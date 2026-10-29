/**
 * The drawings behind the bustle explorer: the gown from the back and from
 * the side, for one value t (0 = train down for the ceremony, 1 = bustled).
 *
 * Every style is drawn the way the fabric actually moves:
 *   American   loops under the train are lifted up the outside of the skirt
 *              and hooked at the hip; the train folds over itself in poufs.
 *   French     ribbons under the train are tucked up underneath the skirt
 *              and tied inside; the fold shows as a cascade at the bottom.
 *   Austrian   a cord through rings up the centre back gathers the train
 *              straight up into ruched swags.
 *   Ballroom   ties all round the underside fold the train under, so the
 *              hem sits level with the floor.
 *   Detachable the train hooks on at the waist and comes off.
 *
 * Gold arrows show the path each pickup point travels. Solid gold dots are
 * hooks on the outside; dashed rings are ties hidden underneath.
 */

import type { Text } from "@/lib/text";
import type { BustleStyleId, TrainId } from "./BustleExplorer";

type Pt = { x: number; y: number };

export const GOLD = "#C9A84C";
export const SHADE = "rgba(28,28,28,0.22)";
export const FOLD_FILL = "#EFE7DD";
/** Where a tucked-under layer is hidden inside the skirt. */
const HIDDEN = "rgba(122,95,30,0.55)";

export const f = (n: number) => Math.round(n * 10) / 10;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lp = (a: Pt, b: Pt, t: number): Pt => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** Part of the timeline: 0 before `a`, 1 after `b`, smooth in between. */
const phase = (t: number, a: number, b: number) => {
  const p = clamp01((t - a) / (b - a));
  return p * p * (3 - 2 * p);
};
const quad = (p0: Pt, c: Pt, p1: Pt, t: number): Pt => ({
  x: (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * c.x + t * t * p1.x,
  y: (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * c.y + t * t * p1.y,
});
const cubic = (p0: Pt, c1: Pt, c2: Pt, p3: Pt, t: number): Pt => {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p3.y,
  };
};
const P = (p: Pt) => `${f(p.x)},${f(p.y)}`;

/** Splits one cubic (base → loop) in two, giving the fold point and both halves' controls. */
function splitAt(p0: Pt, c1: Pt, c2: Pt, p3: Pt, t = 0.5) {
  const p01 = lp(p0, c1, t);
  const p12 = lp(c1, c2, t);
  const p23 = lp(c2, p3, t);
  const p012 = lp(p01, p12, t);
  const p123 = lp(p12, p23, t);
  return { f1: p01, f2: p012, fold: lp(p012, p123, t), a1: p123, a2: p23 };
}

/** The paths show before and during the move, then fade once everything is in place. */
function pathOpacity(t: number) {
  return 0.9 * (1 - phase(t, 0.9, 1));
}

// ── Captions: what is happening, step by step ───────────────────────────────

/** The fifteen step captions, as written in the Studio (Guides & tools). */
export type BustleStepText = Pick<
  Text<"tools">,
  | "bustleStepAmerican1"
  | "bustleStepAmerican2"
  | "bustleStepAmerican3"
  | "bustleStepFrench1"
  | "bustleStepFrench2"
  | "bustleStepFrench3"
  | "bustleStepAustrian1"
  | "bustleStepAustrian2"
  | "bustleStepAustrian3"
  | "bustleStepBallroom1"
  | "bustleStepBallroom2"
  | "bustleStepBallroom3"
  | "bustleStepDetachable1"
  | "bustleStepDetachable2"
  | "bustleStepDetachable3"
>;

/** Three captions per style: train down, on its way up, bustled. */
export function bustleSteps(text: BustleStepText): Record<BustleStyleId, [string, string, string]> {
  return {
    american: [text.bustleStepAmerican1, text.bustleStepAmerican2, text.bustleStepAmerican3],
    french: [text.bustleStepFrench1, text.bustleStepFrench2, text.bustleStepFrench3],
    austrian: [text.bustleStepAustrian1, text.bustleStepAustrian2, text.bustleStepAustrian3],
    ballroom: [text.bustleStepBallroom1, text.bustleStepBallroom2, text.bustleStepBallroom3],
    "detachable-train": [text.bustleStepDetachable1, text.bustleStepDetachable2, text.bustleStepDetachable3],
  };
}

export function stepFor(t: number) {
  return t < 0.12 ? 0 : t < 0.9 ? 1 : 2;
}

// ═════════════════════════════════════════════════════════════════════════════
// BACK VIEW  (viewBox units 0–360 wide, 0–520 tall)
// ═════════════════════════════════════════════════════════════════════════════

const CX = 180;
const WAIST_Y = 150;
const WAIST_HALF = 34;
const FLOOR = 400;
const HEM_HALF = 112;
const HEM_CURVE = 12;
export const TRAIN_LEN: Record<TrainId, number> = { sweep: 26, chapel: 60, cathedral: 96 };

function halfAt(y: number, hemHalf: number) {
  const k = Math.min(1, Math.max(0, (y - WAIST_Y) / (FLOOR - WAIST_Y)));
  return WAIST_HALF + (hemHalf - WAIST_HALF) * Math.pow(k, 0.85);
}

function gownPath(depth: number, hemHalf: number) {
  const L = CX - hemHalf;
  const R = CX + hemHalf;
  return [
    `M${CX - WAIST_HALF},${WAIST_Y}`,
    `C${CX - WAIST_HALF - 18},232 ${L + 8},330 ${L},${FLOOR}`,
    `C${L - 2},${f(FLOOR + depth * 0.35)} ${f(CX - hemHalf * 0.62)},${f(FLOOR + depth)} ${CX},${f(FLOOR + depth)}`,
    `C${f(CX + hemHalf * 0.62)},${f(FLOOR + depth)} ${R + 2},${f(FLOOR + depth * 0.35)} ${R},${FLOOR}`,
    `C${R - 8},330 ${CX + WAIST_HALF + 18},232 ${CX + WAIST_HALF},${WAIST_Y}`,
    "Z",
  ].join(" ");
}

/** The lowest point of the gown at x, including the train lying on the floor. */
function trainY(x: number, depth: number, hemHalf: number) {
  const k = Math.min(1, Math.abs(x - CX) / hemHalf);
  return FLOOR + depth * (1 - k * k);
}

function drapeLines(depth: number, hemHalf: number) {
  return [-0.62, -0.3, 0, 0.3, 0.62].map((o) => {
    const xTop = CX + o * WAIST_HALF * 0.8;
    const xBottom = CX + o * hemHalf * 0.92;
    const yBottom = FLOOR + depth * (1 - o * o) * 0.92;
    return `M${f(xTop)},${WAIST_Y + 6} C${f(xTop + o * 8)},240 ${f(xBottom - o * 10)},330 ${f(xBottom)},${f(yBottom)}`;
  });
}

function spread(n: number, width: number, cx = CX) {
  if (n <= 1) return [cx];
  return Array.from({ length: n }, (_, i) => cx - width / 2 + (i * width) / (n - 1));
}

/**
 * Real bustles are done one point at a time, from the center out, so each
 * point gets its own slice of the timeline: the center is in place about
 * halfway through and the outermost pair finishes last.
 */
function staggered(t: number, i: number, n: number) {
  const mid = (n - 1) / 2;
  const R = Math.floor(mid);
  if (R === 0) return { move: phase(t, 0, 0.92), lift: phase(t, 0.08, 1) };
  const r = Math.floor(Math.abs(i - mid));
  const a = (0.45 * r) / R;
  return { move: phase(t, a, a + 0.47), lift: phase(t, a + 0.08, a + 0.55) };
}

/**
 * A travelling pickup point: the marker where it is now, and a dashed arrow
 * for the part of its path still ahead, so it always reads as "going this way".
 */
function Mover({
  id,
  from,
  via,
  to,
  u,
  t,
  hidden,
  uid,
}: {
  id: string;
  from: Pt;
  via?: Pt;
  to: Pt;
  u: number;
  t: number;
  hidden: boolean;
  uid: string;
}) {
  const at = via ? quad(from, via, to, u) : lp(from, to, u);
  const d = via ? `M${P(at)} Q${P(lp(via, to, u))} ${P(to)}` : `M${P(at)} L${P(to)}`;
  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={GOLD}
        strokeWidth={1.3}
        strokeDasharray={hidden ? "2 3" : "5 4"}
        opacity={pathOpacity(t)}
        markerEnd={`url(#${uid}-arrow)`}
        data-testid={`path-${id}`}
      />
      {t < 0.999 &&
        (hidden ? (
          <circle cx={f(at.x)} cy={f(at.y)} r={4.4} fill="#1f1b1b" stroke={GOLD} strokeWidth={1.6} strokeDasharray="2.2 2" />
        ) : (
          <circle cx={f(at.x)} cy={f(at.y)} r={4} fill={GOLD} stroke="#1f1b1b" strokeWidth={1} />
        ))}
    </g>
  );
}

export function BackView({
  style,
  train,
  t,
  n,
  uid,
}: {
  style: BustleStyleId;
  train: TrainId;
  t: number;
  n: number;
  uid: string;
}) {
  const L = TRAIN_LEN[train];
  const detachable = style === "detachable-train";
  // The loops travel first; the train follows them up.
  const lift = detachable ? 1 : phase(t, 0.08, 1);
  const depth = HEM_CURVE + L * (1 - lift);
  const depth0 = HEM_CURVE + L;
  const fullness = style === "american" || style === "french" ? 6 * lift : 0;
  const hemHalf = HEM_HALF + fullness;
  const move = phase(t, 0, 0.92);

  const overlay: React.ReactNode[] = [];
  const movers: React.ReactNode[] = [];

  if (style === "american") {
    const top = 238;
    const gap = n === 1 ? 60 : Math.min(30, 96 / (n - 1));
    const xs = spread(n, n === 1 ? 0 : gap * (n - 1));
    const w = gap * 0.7 + 10;
    const anchors = [
      { x: CX - halfAt(top + 40, hemHalf) + 6, y: top + 40 },
      ...xs.map((x) => ({ x, y: top })),
      { x: CX + halfAt(top + 40, hemHalf) - 6, y: top + 40 },
    ];
    for (let i = 0; i < anchors.length - 1; i++) {
      const a = anchors[i];
      const b = anchors[i + 1];
      const sag = (22 + L * 0.35) * lift;
      for (const extra of [0, 10]) {
        overlay.push(
          <path
            key={`swag-${i}-${extra}`}
            d={`M${P(a)} Q${f((a.x + b.x) / 2)},${f(Math.max(a.y, b.y) + sag + extra * lift)} ${P(b)}`}
            fill="none"
            stroke={SHADE}
            strokeWidth={1.1}
            opacity={Math.min(1, lift * 2)}
          />
        );
      }
    }
    // Outer poufs first so the centre ones sit on top, like real fabric.
    xs.map((_, i) => i)
      .sort((a, b) => Math.abs(b - (n - 1) / 2) - Math.abs(a - (n - 1) / 2))
      .forEach((i) => {
        const x = xs[i];
        const pl = staggered(t, i, n).lift;
        const h = (34 + L * 0.5) * pl;
        overlay.push(
          <path
            key={`pouf-${i}`}
            d={`M${f(x - 3)},${top} C${f(x - w * 1.15)},${f(top + h * 0.3)} ${f(x - w * 0.95)},${f(top + h)} ${f(x)},${f(top + h)} C${f(x + w * 0.95)},${f(top + h)} ${f(x + w * 1.15)},${f(top + h * 0.3)} ${f(x + 3)},${top} Z`}
            fill={`url(#${uid}-pouf)`}
            stroke={SHADE}
            strokeWidth={1}
            opacity={Math.min(1, pl * 2)}
          />,
          // Tension folds radiate from the hook down into the pouf.
          <path
            key={`pouf-fold-${i}`}
            d={`M${f(x)},${top + 2} Q${f(x - w * 0.35)},${f(top + h * 0.55)} ${f(x - w * 0.5)},${f(top + h * 0.9)} M${f(x)},${top + 2} Q${f(x - w * 0.05)},${f(top + h * 0.6)} ${f(x)},${f(top + h * 0.97)} M${f(x)},${top + 2} Q${f(x + w * 0.35)},${f(top + h * 0.55)} ${f(x + w * 0.5)},${f(top + h * 0.9)}`}
            fill="none"
            stroke={SHADE}
            strokeWidth={0.8}
            opacity={Math.min(1, pl * 2) * 0.5}
          />
        );
      });
    xs.forEach((x, i) => {
      const start = { x, y: trainY(x, depth0, HEM_HALF) - 8 };
      const end = { x, y: top };
      const s = staggered(t, i, n);
      overlay.push(<circle key={`hook-${i}`} cx={f(x)} cy={top} r={3.4} fill={GOLD} opacity={0.5 + 0.5 * s.lift} />);
      movers.push(
        <Mover key={`m-${i}`} id={`back-${i}`} uid={uid} t={t} hidden={false} from={start} to={end} u={s.move} />
      );
    });
  }

  if (style === "french") {
    const rows = n <= 2 ? 2 : 3;
    const top = 292;
    const rh = ((FLOOR - top - 6) / rows) * lift;
    for (let r = 0; r < rows; r++) {
      const y = top + r * rh * 0.8;
      const half = halfAt(y + rh, hemHalf) * (0.52 + r * 0.1);
      const k = 3 + (r % 2);
      const xs = spread(k + 1, half * 2);
      let d = `M${f(xs[0])},${f(y + rh * 0.3)} Q${CX},${f(y - rh * 0.25)} ${f(xs[k])},${f(y + rh * 0.3)}`;
      for (let j = k; j > 0; j--) {
        d += ` C${f(xs[j] + 2)},${f(y + rh * 1.1)} ${f(xs[j - 1] - 2)},${f(y + rh * 1.1)} ${f(xs[j - 1])},${f(y + rh * 0.3)}`;
      }
      overlay.push(
        <path key={`tier-${r}`} d={`${d} Z`} fill={`url(#${uid}-pouf)`} stroke={SHADE} strokeWidth={1} opacity={Math.min(1, lift * 1.6)} />
      );
    }
    spread(n, Math.min(120, 34 * (n - 1))).forEach((x, i) => {
      const end = { x, y: top - 4 };
      const start = { x, y: trainY(x, depth0, HEM_HALF) - 8 };
      const s = staggered(t, i, n);
      overlay.push(
        <circle key={`tie-${i}`} cx={f(x)} cy={top - 4} r={4.2} fill="none" stroke={GOLD} strokeWidth={1.4} strokeDasharray="2.2 2" opacity={0.5 + 0.5 * s.lift} />,
        <TieNumber key={`num-${i}`} x={x} y={top - 13} n={tieNumber(i, n)} />
      );
      movers.push(
        <Mover key={`m-${i}`} id={`back-${i}`} uid={uid} t={t} hidden from={start} to={end} u={s.move} />
      );
    });
  }

  if (style === "austrian") {
    const top = 250;
    const bottom = FLOOR + depth * 0.95;
    const count = 8;
    for (let i = 0; i < count; i++) {
      const y = top + ((bottom - top) * (i + 0.5)) / count;
      const hw = 30 + (i / count) * 10;
      overlay.push(
        <path
          key={`ruche-${i}`}
          d={`M${f(CX - hw)},${f(y)} Q${CX},${f(y + 11 * lift)} ${f(CX + hw)},${f(y)}`}
          fill="none"
          stroke={SHADE}
          strokeWidth={1.2}
          opacity={Math.min(1, lift * 1.4)}
        />
      );
    }
    // Rings on the cord, spread down to the train tip, bunching up as it's pulled.
    const rings = 5;
    const rs = Array.from({ length: rings }, (_, i) => {
      const start = { x: CX, y: lerp(290, FLOOR + depth0 - 10, i / (rings - 1)) };
      const end = { x: CX, y: top + 6 + i * 9 };
      return { start, end, at: lp(start, end, move) };
    });
    overlay.push(
      <line key="cord" x1={CX} y1={top} x2={CX} y2={f(rs[rings - 1].at.y)} stroke={GOLD} strokeWidth={1.2} strokeDasharray="3 3" opacity={0.7} />,
      <circle key="ring" cx={CX} cy={top} r={3.4} fill={GOLD} />
    );
    rs.forEach((r, i) =>
      overlay.push(<circle key={`r-${i}`} cx={CX} cy={f(r.at.y)} r={2.6} fill="none" stroke={GOLD} strokeWidth={1.3} />)
    );
    movers.push(
      <Mover
        key="m-cord"
        id="back-cord"
        uid={uid}
        t={t}
        hidden={false}
        from={{ x: CX + 16, y: FLOOR + depth0 - 16 }}
        to={{ x: CX + 16, y: top + 4 }}
        u={move}
      />
    );
  }

  if (style === "ballroom") {
    const y = 364;
    const half = halfAt(y, hemHalf) * 0.86;
    spread(n, half * 2).forEach((x, i) => {
      const s = staggered(t, i, n);
      const yi = y + 6 * (1 - Math.pow((x - CX) / half, 2));
      const start = { x, y: Math.max(yi + 16, trainY(x, depth0, HEM_HALF) - 6) };
      const end = { x, y: yi };
      overlay.push(
        <path key={`fold-${i}`} d={`M${f(x)},${f(yi + 4)} q3,${f(14 * s.lift)} 0,${f(28 * s.lift)}`} fill="none" stroke={SHADE} strokeWidth={1.1} opacity={s.lift} />,
        <circle key={`tie-${i}`} cx={f(x)} cy={f(yi)} r={3.8} fill="none" stroke={GOLD} strokeWidth={1.4} strokeDasharray="2.2 2" opacity={0.5 + 0.5 * s.lift} />,
        <TieNumber key={`num-${i}`} x={x} y={yi - 9} n={tieNumber(i, n)} />
      );
      movers.push(
        <Mover key={`m-${i}`} id={`back-${i}`} uid={uid} t={t} hidden from={start} to={end} u={s.move} />
      );
    });
  }

  let trainPanel: React.ReactNode = null;
  if (detachable) {
    const hw = HEM_HALF * 0.76;
    const tip = FLOOR + L + HEM_CURVE;
    const off = phase(t, 0.15, 1);
    const gone = phase(t, 0.15, 0.7);
    const d = [
      `M${CX - 26},${WAIST_Y + 3}`,
      `C${CX - 46},250 ${CX - hw - 4},352 ${CX - hw},${FLOOR}`,
      `C${CX - hw + 2},${f(FLOOR + (tip - FLOOR) * 0.7)} ${CX - 52},${tip} ${CX},${tip}`,
      `C${CX + 52},${tip} ${CX + hw - 2},${f(FLOOR + (tip - FLOOR) * 0.7)} ${CX + hw},${FLOOR}`,
      `C${CX + hw + 4},352 ${CX + 46},250 ${CX + 26},${WAIST_Y + 3}`,
      "Z",
    ].join(" ");
    trainPanel = (
      <g transform={`translate(0 ${f(14 * off)})`} opacity={f(1 - gone)}>
        <path d={d} fill="#FFFDF9" stroke={SHADE} strokeWidth={1} />
        <path d={`M${CX},${WAIST_Y + 8} L${CX},${tip - 6}`} stroke={SHADE} strokeWidth={0.8} strokeDasharray="1 5" />
      </g>
    );
    [-18, 0, 18].forEach((dx) => overlay.push(<circle key={`hook-${dx}`} cx={CX + dx} cy={WAIST_Y + 4} r={3.2} fill={GOLD} />));
    movers.push(
      <Mover
        key="m-off"
        id="back-off"
        uid={uid}
        t={t}
        hidden={false}
        from={{ x: CX + 40, y: WAIST_Y + 30 }}
        to={{ x: CX + 40, y: WAIST_Y + 110 }}
        u={move}
      />
    );
  }

  return (
    <g>
      <ellipse cx={CX} cy={f(FLOOR + depth * 0.55)} rx={f(hemHalf + 10)} ry={f(10 + depth * 0.35)} fill="#000" opacity={0.28} />
      <DressFormBack />
      <path d={gownPath(depth, hemHalf)} fill={`url(#${uid}-silk)`} stroke={SHADE} strokeWidth={1} />
      {!detachable && (
        <path
          d={`M${CX - hemHalf},${FLOOR} Q${CX},${FLOOR + HEM_CURVE * 2} ${CX + hemHalf},${FLOOR}`}
          fill="none"
          stroke={SHADE}
          strokeWidth={1}
          strokeDasharray="3 4"
          opacity={f(Math.max(0, 1 - lift * 1.4))}
        />
      )}
      {drapeLines(depth, hemHalf).map((d, i) => (
        <path key={i} d={d} fill="none" stroke={SHADE} strokeWidth={0.8} opacity={0.7} />
      ))}
      {trainPanel}
      <BodiceBack />
      {overlay}
      {movers}
    </g>
  );
}

/** Ties are numbered from the center out, the order they're done in, like the labels sewn into real gowns. */
function tieNumber(i: number, n: number) {
  const mid = (n - 1) / 2;
  const order = Array.from({ length: n }, (_, j) => j).sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid) || a - b);
  return order.indexOf(i) + 1;
}

function TieNumber({ x, y, n }: { x: number; y: number; n: number }) {
  return (
    <text x={f(x)} y={f(y)} textAnchor="middle" fontSize={8} fontFamily="Georgia, serif" fill={GOLD} opacity={0.9}>
      {n}
    </text>
  );
}

function DressFormBack() {
  return (
    <>
      <path d="M168,22 L192,22 L192,52 L168,52 Z" fill="#3d3533" />
      <ellipse cx={CX} cy={22} rx={14} ry={4} fill={GOLD} opacity={0.9} />
      <path d="M168,50 C150,52 128,60 124,76 C122,86 128,98 136,104 L224,104 C232,98 238,86 236,76 C232,60 210,52 192,50 Z" fill="#3d3533" />
    </>
  );
}

function BodiceBack() {
  return (
    <>
      <path
        d="M146,150 C142,128 136,108 138,92 L150,56 L156,56 L162,86 Q180,100 198,86 L204,56 L210,56 L222,92 C224,108 218,128 214,150 Z"
        fill="#FFFDF9"
        stroke={SHADE}
        strokeWidth={1}
      />
      {[106, 116, 126, 136, 146].map((y) => (
        <circle key={y} cx={CX} cy={y} r={1.6} fill="#E4DBCF" stroke={SHADE} strokeWidth={0.5} />
      ))}
      <path d={`M${CX - WAIST_HALF},${WAIST_Y} Q${CX},${WAIST_Y + 5} ${CX + WAIST_HALF},${WAIST_Y}`} fill="none" stroke={SHADE} strokeWidth={1} />
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SIDE VIEW  (local units 0–320 wide; the gown faces left, the train trails right)
// ═════════════════════════════════════════════════════════════════════════════

const S_TRAIN: Record<TrainId, number> = { sweep: 50, chapel: 96, cathedral: 140 };
/** Back of the skirt, from the waist down to where it meets the floor. */
const BACK: [Pt, Pt, Pt, Pt] = [
  { x: 96, y: 150 },
  { x: 110, y: 205 },
  { x: 150, y: 300 },
  { x: 154, y: 400 },
];
const HIP = cubic(...BACK, 0.32);
const BASE: Pt = { x: 154, y: 400 };

/**
 * The train's outline from the side: from where it leaves the skirt (base),
 * through a fold point, up to the loop or tie, then on to the tip; `close`
 * rounds the underside back to the base.
 */
interface Pose {
  base: Pt;
  f1: Pt;
  f2: Pt;
  fold: Pt;
  a1: Pt;
  a2: Pt;
  loop: Pt;
  b1: Pt;
  b2: Pt;
  tip: Pt;
  close: Pt;
}

/** The train lying flat on the floor behind the gown, with its loop point. */
function flatPose(Ls: number, loopAt: number): Pose {
  const loop = { x: BASE.x + Ls * loopAt, y: 396 };
  const tip = { x: BASE.x + Ls, y: 397 };
  const base = { x: BASE.x, y: 396 };
  return {
    base,
    ...splitAt(base, { x: lerp(BASE.x, loop.x, 0.33), y: 396 }, { x: lerp(BASE.x, loop.x, 0.66), y: 396 }, loop),
    loop,
    b1: { x: lerp(loop.x, tip.x, 0.33), y: 396 },
    b2: { x: lerp(loop.x, tip.x, 0.66), y: 396 },
    tip,
    close: { x: lerp(BASE.x, tip.x, 0.5), y: 402 },
  };
}

/** Where everything ends up, per style, and the path the loop takes to get there. */
function bustledPose(style: BustleStyleId, Ls: number): { pose: Pose; via: Pt; inside: boolean } {
  switch (style) {
    case "american": {
      // Lifted up the outside and hooked at the hip; the tip hangs back down.
      const hook = HIP;
      // The folded train makes a rounded pouf that stands off the back.
      return {
        inside: false,
        via: { x: BASE.x + Ls * 0.55 + 8, y: hook.y - 18 },
        pose: {
          base: { x: 160, y: 392 },
          ...splitAt({ x: 160, y: 392 }, { x: 176, y: 356 }, { x: hook.x + 30, y: hook.y + 62 }, hook),
          loop: hook,
          b1: { x: hook.x + 78, y: hook.y + 4 },
          b2: { x: 222, y: 352 },
          tip: { x: 186, y: Math.min(394, 364 + Ls * 0.2) },
          close: { x: 178, y: 406 },
        },
      };
    }
    case "french": {
      // Folded under at the bottom and tied up inside the skirt.
      const tie = { x: 124, y: 312 };
      return {
        inside: true,
        via: { x: 146, y: 414 },
        // The fold stands out as a soft roll at the bottom of the back.
        pose: {
          base: { x: 150, y: 318 },
          f1: { x: 192, y: 322 },
          f2: { x: 204, y: 398 },
          fold: { x: 168, y: 403 },
          a1: { x: 148, y: 407 },
          a2: { x: 132, y: 352 },
          loop: tie,
          b1: { x: 112, y: 330 },
          b2: { x: 112, y: 356 },
          tip: { x: 120, y: 372 },
          close: { x: 140, y: 336 },
        },
      };
    }
    case "ballroom": {
      // Folded under right at the hem, so the outside stays smooth and level.
      const tie = { x: 132, y: 354 };
      return {
        inside: true,
        via: { x: 150, y: 410 },
        pose: {
          base: { x: 154, y: 398 },
          f1: { x: 158, y: 400 },
          f2: { x: 158, y: 404 },
          fold: { x: 150, y: 404 },
          a1: { x: 140, y: 404 },
          a2: { x: 132, y: 372 },
          loop: tie,
          b1: { x: 124, y: 366 },
          b2: { x: 124, y: 384 },
          tip: { x: 128, y: 394 },
          close: { x: 142, y: 398 },
        },
      };
    }
    default: {
      // Austrian: the whole train is gathered up the back by the cord.
      const top = cubic(...BACK, 0.72);
      return {
        inside: false,
        via: { x: 170, y: 400 },
        pose: {
          base: { x: 156, y: 386 },
          ...splitAt({ x: 156, y: 386 }, { x: 162, y: 384 }, { x: 164, y: 380 }, { x: top.x + 10, y: top.y + 30 }),
          loop: { x: top.x + 10, y: top.y + 30 },
          b1: { x: 166, y: 378 },
          b2: { x: 164, y: 382 },
          tip: { x: 158, y: 388 },
          close: { x: 158, y: 390 },
        },
      };
    }
  }
}

function posePath(p: Pose) {
  return `M${P(p.base)} C${P(p.f1)} ${P(p.f2)} ${P(p.fold)} C${P(p.a1)} ${P(p.a2)} ${P(p.loop)} C${P(p.b1)} ${P(p.b2)} ${P(p.tip)} Q${P(p.close)} ${P(p.base)} Z`;
}

function sideSkirt() {
  return [
    "M48,150",
    "C42,230 22,330 16,400",
    `Q84,407 ${P(BASE)}`,
    `C${P(BACK[2])} ${P(BACK[1])} ${P(BACK[0])}`,
    "Z",
  ].join(" ");
}

export function SideView({
  style,
  train,
  t,
  uid,
}: {
  style: BustleStyleId;
  train: TrainId;
  t: number;
  uid: string;
}) {
  const Ls = S_TRAIN[train];
  const move = phase(t, 0, 0.92);
  const settle = phase(t, 0.1, 1);

  const nodes: React.ReactNode[] = [];

  if (style === "detachable-train") {
    const off = phase(t, 0.15, 1);
    const gone = phase(t, 0.15, 0.75);
    // An overskirt layer from the waist, standing a little off the back.
    const panel = [
      `M${BACK[0].x + 2},${BACK[0].y + 2}`,
      `C${BACK[1].x + 18},${BACK[1].y} ${BACK[2].x + 18},${BACK[2].y} ${BASE.x + 16},396`,
      `L${BASE.x + Ls},396 Q${BASE.x + Ls + 5},399 ${BASE.x + Ls - 4},402`,
      `L${BASE.x},402`,
      `C${BACK[2].x},${BACK[2].y} ${BACK[1].x},${BACK[1].y} ${BACK[0].x},${BACK[0].y}`,
      "Z",
    ].join(" ");
    return (
      <g>
        <SideBase uid={uid} />
        <g transform={`translate(${f(46 * off)} ${f(18 * off)})`} opacity={f(1 - gone)}>
          <path d={panel} fill="#FFFDF9" stroke={SHADE} strokeWidth={1} />
        </g>
        <SideBodice />
        <circle cx={BACK[0].x + 2} cy={BACK[0].y + 4} r={3.2} fill={GOLD} />
        <Mover
          id="side-off"
          uid={uid}
          t={t}
          hidden={false}
          from={{ x: BACK[0].x + 20, y: BACK[0].y + 40 }}
          via={{ x: BACK[0].x + 70, y: BACK[0].y + 50 }}
          to={{ x: BACK[0].x + 96, y: BACK[0].y + 96 }}
          u={move}
        />
      </g>
    );
  }

  const loopAt = style === "ballroom" ? 0.5 : 0.55;
  const flat = flatPose(Ls, loopAt);
  const { pose: end, via, inside } = bustledPose(style, Ls);

  // The loop travels along its real path; the rest of the fabric follows it.
  const loopNow = quad(flat.loop, via, end.loop, move);
  const tipNow = quad(flat.tip, { x: end.tip.x + 18, y: 402 }, end.tip, settle);
  const now: Pose = {
    base: lp(flat.base, end.base, settle),
    f1: lp(flat.f1, end.f1, settle),
    f2: lp(flat.f2, end.f2, settle),
    fold: lp(flat.fold, end.fold, settle),
    a1: lp(flat.a1, end.a1, settle),
    a2: lp(flat.a2, end.a2, settle),
    loop: loopNow,
    b1: lp(flat.b1, end.b1, settle),
    b2: lp(flat.b2, end.b2, settle),
    tip: tipNow,
    close: lp(flat.close, end.close, settle),
  };
  const fabric = posePath(now);

  if (style === "austrian") {
    // Ruched swags build up the back as the cord gathers the train.
    const count = 6;
    for (let i = 0; i < count; i++) {
      const a = cubic(...BACK, 0.5 + (i / count) * 0.5);
      const b = cubic(...BACK, 0.5 + ((i + 1) / count) * 0.5);
      const bulge = 9 * settle;
      nodes.push(
        <path
          key={`ruche-${i}`}
          d={`M${P(a)} Q${f((a.x + b.x) / 2 + bulge + 2)},${f((a.y + b.y) / 2)} ${P(b)}`}
          fill={`url(#${uid}-pouf)`}
          stroke={SHADE}
          strokeWidth={1}
          opacity={Math.min(1, settle * 1.5)}
        />
      );
    }
    const ringTop = cubic(...BACK, 0.5);
    const rings = 4;
    for (let i = 0; i < rings; i++) {
      const start = { x: BASE.x + (Ls * (i + 1)) / rings, y: 394 };
      const stop = cubic(...BACK, 0.5 + i * 0.08);
      const at = quad(start, { x: BASE.x + 10, y: 400 }, stop, move);
      nodes.push(<circle key={`ring-${i}`} cx={f(at.x + 2)} cy={f(at.y)} r={2.6} fill="none" stroke={GOLD} strokeWidth={1.3} />);
    }
    nodes.push(<circle key="ring-top" cx={f(ringTop.x + 2)} cy={f(ringTop.y)} r={3.4} fill={GOLD} />);
    return (
      <g>
        <SideBase uid={uid} />
        <path d={fabric} fill={`url(#${uid}-silk-side)`} stroke={SHADE} strokeWidth={1} />
        {nodes}
        <SideBodice />
        <Mover
          id="side-loop"
          uid={uid}
          t={t}
          hidden={false}
          from={{ x: BASE.x + Ls, y: 390 }}
          via={{ x: BASE.x + 14, y: 398 }}
          to={{ x: ringTop.x + 12, y: ringTop.y + 4 }}
          u={move}
        />
      </g>
    );
  }

  return (
    <g>
      <SideBase uid={uid} under={inside ? fabric : undefined} />
      {!inside && style === "american" && (
        // A soft shadow where the pouf stands off the skirt.
        <path d={fabric} transform="translate(3 5)" fill="#000" opacity={f(0.14 * settle)} />
      )}
      {!inside && (
        <path d={fabric} fill={`url(#${uid}-${style === "american" ? "pouf" : "silk-side"})`} stroke={SHADE} strokeWidth={1} />
      )}
      {!inside && style === "american" && settle > 0.05 && (
        // Tension folds from the hook into the pouf.
        <path
          d={[0.25, 0.45, 0.65, 0.82]
            .map((k) => {
              const bottom = { x: lerp(now.base.x, now.tip.x + 26, k), y: lerp(now.base.y, now.tip.y, k) - 6 };
              return `M${P(loopNow)} Q${f(lerp(loopNow.x, bottom.x, 0.5) + 14)},${f(lerp(loopNow.y, bottom.y, 0.45))} ${P(bottom)}`;
            })
            .join(" ")}
          fill="none"
          stroke="rgba(28,28,28,0.18)"
          strokeWidth={0.9}
          opacity={settle}
        />
      )}
      {inside && (
        // The part tucked inside the skirt, drawn as a see-through outline.
        <path d={fabric} fill="none" stroke={HIDDEN} strokeWidth={1.1} strokeDasharray="2 3" opacity={0.9} />
      )}
      <SideBodice />
      {style === "american" && <circle cx={f(HIP.x)} cy={f(HIP.y)} r={3.4} fill={GOLD} />}
      {inside && (
        <circle cx={f(end.loop.x)} cy={f(end.loop.y)} r={4.2} fill="none" stroke={GOLD} strokeWidth={1.4} strokeDasharray="2.2 2" />
      )}
      <Mover id="side-loop" uid={uid} t={t} hidden={inside} from={flat.loop} via={via} to={end.loop} u={move} />
    </g>
  );
}

/** Floor, dress form and skirt; `under` is fabric drawn before the skirt, so the skirt hides it. */
function SideBase({ uid, under }: { uid: string; under?: string }) {
  return (
    <>
      <ellipse cx={120} cy={404} rx={120} ry={9} fill="#000" opacity={0.28} />
      <path d="M78,22 L98,22 L98,52 L78,52 Z" fill="#3d3533" />
      <ellipse cx={88} cy={22} rx={11} ry={3.4} fill={GOLD} opacity={0.9} />
      <path d="M76,50 C60,56 50,70 50,90 L50,104 L112,104 L112,90 C112,70 104,56 98,50 Z" fill="#3d3533" />
      {under && <path d={under} fill={`url(#${uid}-silk-side)`} stroke={SHADE} strokeWidth={1} />}
      <path d={sideSkirt()} fill={`url(#${uid}-silk-side)`} stroke={SHADE} strokeWidth={1} />
      {[0.25, 0.5, 0.75].map((k) => {
        const top = { x: lerp(48, 96, k), y: 152 };
        const bottom = { x: lerp(16, 154, k), y: 402 };
        return <path key={k} d={`M${P(top)} Q${f(lerp(top.x, bottom.x, 0.6) - 6)},300 ${P(bottom)}`} fill="none" stroke={SHADE} strokeWidth={0.8} opacity={0.6} />;
      })}
    </>
  );
}

function SideBodice() {
  return (
    <>
      <path d="M48,150 C44,130 40,112 46,96 L58,86 L102,86 C106,104 108,126 96,150 Z" fill="#FFFDF9" stroke={SHADE} strokeWidth={1} />
      <path d="M62,87 L80,54 L96,87" fill="none" stroke="#FFFDF9" strokeWidth={4} />
      <path d="M48,150 Q72,154 96,150" fill="none" stroke={SHADE} strokeWidth={1} />
    </>
  );
}
