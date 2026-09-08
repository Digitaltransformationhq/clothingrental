/**
 * The strip.
 *
 * A block-print border, drawn and slowly unrolled, that closes the seams where
 * a full-bleed photograph meets warm paper. It runs under the opening and again
 * above the footer, both of which were bare bands of ground.
 *
 * The vocabulary is drawn from textile traditions around the world and weighted
 * to India, which takes fourteen of the twenty-four slots in a run. That
 * weighting is the point rather than an accident: this is an Indian marketplace
 * that also rents dresses and blazers, and the band should say so in that
 * order.
 *
 *   India   rosette · buti · paisley (boteh) · ikat lozenge · temple kumbha ·
 *           jaali · kolam · leheriya · bandhani · warli · phulkari
 *   Abroad  Greek meander · Japanese asanoha · Andean fret · Polynesian
 *           chevron-diamond · West African chevron · Islamic star ·
 *           Nordic cross-diamond · Ottoman tulip
 *
 * The motifs are drawn here rather than imported. Traditional patterns are
 * centuries old and belong to nobody, but the vector files that sell them are
 * somebody's copyright — so these are hand-authored from the structure of each
 * motif, which also lets every one of them sit on the same stroke weight and
 * the same 92-unit band.
 *
 * The diagonal runs through the middle, as asked: leheriya is a diagonal
 * stripe, jaali a slanted trellis, the fret a staircase.
 *
 * The frame holds still and the middle changes. One sawtooth, mirrored top and
 * bottom, holds the band together; inside it forty slots run two Indian motifs
 * to every one from abroad, packed close, in an order that never repeats a
 * pairing across a run.
 *
 * Two tones only, ink on paper, as the printed borders it comes from are.
 * Decorative, so it is hidden from assistive technology, and it stops entirely
 * for anyone who has asked for reduced motion.
 */

/** One run. A multiple of every edge rhythm (20, 12, 16) so runs abut cleanly. */
const RUN = { width: 2400, height: 92 } as const;
const MID = 47;
const SLOTS = 40;
const GAP = RUN.width / SLOTS;

const GROUND = "var(--color-paper-2)";

type Motif = ({ cx }: { cx: number }) => React.JSX.Element;

/* ── India ───────────────────────────────────────────────────────────────── */

/** A serrated medallion: teeth, a ring, a gap struck out of it, a small sun. */
const Rosette: Motif = ({ cx }) => {
  const teeth = 20;
  const spread = Math.PI / teeth;
  const tooth = (i: number, inner: number, outer: number) => {
    const a = (i / teeth) * Math.PI * 2;
    return [
      `M${cx + Math.cos(a - spread) * inner} ${MID + Math.sin(a - spread) * inner}`,
      `L${cx + Math.cos(a) * outer} ${MID + Math.sin(a) * outer}`,
      `L${cx + Math.cos(a + spread) * inner} ${MID + Math.sin(a + spread) * inner}`,
      "Z",
    ].join(" ");
  };
  return (
    <g>
      {Array.from({ length: teeth }, (_, i) => (
        <path key={i} d={tooth(i, 14, 20)} fill="currentColor" />
      ))}
      <circle cx={cx} cy={MID} r="14.5" fill="currentColor" />
      <circle cx={cx} cy={MID} r="10" fill={GROUND} />
      <circle cx={cx} cy={MID} r="7" fill="currentColor" />
      <circle cx={cx} cy={MID} r="2.6" fill={GROUND} />
    </g>
  );
};

/** A buti — the flowering sprig that fills a block-printed ground. */
const Buti: Motif = ({ cx }) => {
  const petal = (i: number) => {
    const a = -Math.PI / 2 + (i - 2) * 0.62;
    const tx = cx + Math.cos(a) * 19;
    const ty = MID - 3 + Math.sin(a) * 19;
    return `M${cx} ${MID - 3} Q${tx - 6} ${ty + 2} ${tx} ${ty} Q${tx + 6} ${ty + 2} ${cx} ${MID - 3} Z`;
  };
  return (
    <g>
      <path
        d={`M${cx} ${MID + 21} V${MID - 3}`}
        stroke="currentColor"
        strokeWidth="2.5"
        fill="none"
      />
      <path d={`M${cx} ${MID + 15} q-10 -1 -12 -9 q10 -1 12 9 Z`} fill="currentColor" />
      <path d={`M${cx} ${MID + 8} q10 -1 12 -9 q-10 -1 -12 9 Z`} fill="currentColor" />
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={i} d={petal(i)} fill="currentColor" />
      ))}
      <circle cx={cx} cy={MID - 4} r="3.2" fill={GROUND} />
    </g>
  );
};

/** The boteh — paisley, the motif this subcontinent gave the rest of them. */
const Paisley: Motif = ({ cx }) => (
  <g>
    <path
      d={`M${cx + 1} ${MID + 20} C${cx - 15} ${MID + 13} ${cx - 17} ${MID - 5} ${cx - 6} ${MID - 14}
          C${cx + 4} ${MID - 22} ${cx + 16} ${MID - 15} ${cx + 13} ${MID - 4}
          C${cx + 11} ${MID + 3} ${cx + 3} ${MID + 4} ${cx + 4} ${MID - 3}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    />
    <path
      d={`M${cx} ${MID + 13} C${cx - 9} ${MID + 8} ${cx - 10} ${MID - 4} ${cx - 3} ${MID - 9}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <circle cx={cx - 4} cy={MID + 2} r="2.6" fill="currentColor" />
  </g>
);

/** Concentric diamonds — the lozenge that carries an ikat border. */
const Lozenge: Motif = ({ cx }) => {
  const ring = (r: number) =>
    `M${cx} ${MID - r} L${cx + r} ${MID} L${cx} ${MID + r} L${cx - r} ${MID} Z`;
  return (
    <g>
      <path d={ring(21)} fill="none" stroke="currentColor" strokeWidth="2.5" />
      <path d={ring(13.5)} fill="none" stroke="currentColor" strokeWidth="2.5" />
      <path d={ring(6)} fill="currentColor" />
    </g>
  );
};

/** The temple triangle — the kumbha that edges a South Indian saree. */
const Temple: Motif = ({ cx }) => (
  <g>
    <path
      d={`M${cx} ${MID - 21} L${cx + 18} ${MID + 18} L${cx - 18} ${MID + 18} Z`}
      fill="currentColor"
    />
    <path d={`M${cx} ${MID - 7} L${cx + 8} ${MID + 12} L${cx - 8} ${MID + 12} Z`} fill={GROUND} />
    <path
      d={`M${cx} ${MID + 1} L${cx + 4} ${MID + 9} L${cx - 4} ${MID + 9} Z`}
      fill="currentColor"
    />
  </g>
);

/** A jaali — the pierced lattice, which is a trellis stood on the diagonal. */
const Jaali: Motif = ({ cx }) => (
  <g fill="none" stroke="currentColor" strokeWidth="2">
    <path d={`M${cx} ${MID - 21} L${cx + 21} ${MID} L${cx} ${MID + 21} L${cx - 21} ${MID} Z`} />
    {[-10, 0, 10].map((d, i) => (
      <path key={i} d={`M${cx - 14 + d} ${MID + 7 + d} L${cx + 7 + d} ${MID - 14 + d}`} />
    ))}
    {[-10, 0, 10].map((d, i) => (
      <path key={`b${i}`} d={`M${cx - 7 + d} ${MID - 14 - d} L${cx + 14 + d} ${MID + 7 - d}`} />
    ))}
  </g>
);

/** A kolam — dots laid on the threshold, and the line drawn around them. */
const Kolam: Motif = ({ cx }) => (
  <g>
    <path
      d={`M${cx} ${MID - 18} q10 8 0 18 q-10 -8 0 -18 Z M${cx} ${MID + 18} q10 -8 0 -18 q-10 8 0 18 Z
          M${cx - 18} ${MID} q8 10 18 0 q-8 -10 -18 0 Z M${cx + 18} ${MID} q-8 10 -18 0 q8 -10 18 0 Z`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />
    {[
      [0, -13],
      [0, 13],
      [-13, 0],
      [13, 0],
    ].map(([dx, dy], i) => (
      <circle key={i} cx={cx + dx} cy={MID + dy} r="2.2" fill="currentColor" />
    ))}
    <circle cx={cx} cy={MID} r="3" fill="currentColor" />
  </g>
);

/** Leheriya — Rajasthan's diagonal wave, tied into the cloth on the bias. */
const Leheriya: Motif = ({ cx }) => (
  <g fill="none" stroke="currentColor" strokeLinecap="round">
    {[-18, -9, 0, 9, 18].map((d, i) => (
      <path
        key={i}
        d={`M${cx - 20 + d} ${MID + 20} Q${cx - 8 + d} ${MID} ${cx + d} ${MID - 20}`}
        strokeWidth={i % 2 === 0 ? 3.2 : 1.8}
      />
    ))}
  </g>
);

/** Bandhani — the tied dot, in the cluster the knots are set in. */
const Bandhani: Motif = ({ cx }) => (
  <g fill="currentColor">
    {[
      [0, 0, 4.5],
      [0, -14, 3.4],
      [0, 14, 3.4],
      [-14, 0, 3.4],
      [14, 0, 3.4],
      [-10, -10, 2.4],
      [10, -10, 2.4],
      [-10, 10, 2.4],
      [10, 10, 2.4],
    ].map(([dx, dy, r], i) => (
      <circle key={i} cx={cx + dx} cy={MID + dy} r={r} />
    ))}
    <circle cx={cx} cy={MID} r="2" fill={GROUND} />
  </g>
);

/** Warli — the tarpa dance, drawn as it is on a Maharashtrian wall. */
const Warli: Motif = ({ cx }) => {
  const figure = (a: number, r: number) => {
    const x = cx + Math.cos(a) * r;
    const y = MID + Math.sin(a) * r;
    return (
      <g key={a} stroke="currentColor" strokeWidth="1.8" fill="none">
        <path d={`M${x} ${y - 5} L${x - 3.5} ${y} L${x + 3.5} ${y} Z`} fill="currentColor" />
        <path d={`M${x} ${y} L${x - 4} ${y + 6} M${x} ${y} L${x + 4} ${y + 6}`} />
        <circle cx={x} cy={y - 7.5} r="2.2" fill="currentColor" stroke="none" />
      </g>
    );
  };
  return (
    <g>
      <circle cx={cx} cy={MID} r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
      {[0, 1, 2, 3, 4, 5].map((i) => figure((i / 6) * Math.PI * 2 - Math.PI / 2, 16))}
    </g>
  );
};

/** Phulkari — the darned florette, counted out on the grid it is stitched to. */
const Phulkari: Motif = ({ cx }) => (
  <g fill="currentColor">
    {[0, 1, 2, 3].map((i) => {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const x = cx + Math.cos(a) * 12;
      const y = MID + Math.sin(a) * 12;
      return <path key={i} d={`M${x} ${y - 8} L${x + 8} ${y} L${x} ${y + 8} L${x - 8} ${y} Z`} />;
    })}
    <path
      d={`M${cx} ${MID - 7} L${cx + 7} ${MID} L${cx} ${MID + 7} L${cx - 7} ${MID} Z`}
      fill={GROUND}
    />
    <path d={`M${cx} ${MID - 3.5} L${cx + 3.5} ${MID} L${cx} ${MID + 3.5} L${cx - 3.5} ${MID} Z`} />
  </g>
);

/* ── Elsewhere ───────────────────────────────────────────────────────────── */

/** Greece: the meander, run as a single stroke. */
const Meander: Motif = ({ cx }) => {
  const x = cx - 20;
  return (
    <path
      d={`M${x} ${MID + 14} V${MID - 14} H${x + 40} V${MID + 14} H${x + 13} V${MID - 2} H${x + 27} V${MID + 6}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="square"
    />
  );
};

/** Japan: asanoha, the hemp leaf — a hexagon starred from its centre. */
const Asanoha: Motif = ({ cx }) => {
  const pt = (i: number, r = 20) => {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    return [cx + Math.cos(a) * r, MID + Math.sin(a) * r] as const;
  };
  return (
    <g fill="none" stroke="currentColor" strokeWidth="2">
      <path d={`M${Array.from({ length: 6 }, (_, i) => pt(i).join(" ")).join(" L")} Z`} />
      {Array.from({ length: 6 }, (_, i) => (
        <path key={i} d={`M${cx} ${MID} L${pt(i).join(" ")}`} />
      ))}
      {[0, 1, 2].map((i) => (
        <path
          key={`c${i}`}
          d={`M${pt(i * 2).join(" ")} L${pt(i * 2 + 3).join(" ")}`}
          strokeWidth="1.4"
        />
      ))}
    </g>
  );
};

/** The Andes: a stepped fret, which is a diagonal cut into stairs. */
const Fret: Motif = ({ cx }) => (
  <path
    d={`M${cx - 20} ${MID + 18} h8 v-9 h8 v-9 h8 v-9 h8 v-9`}
    fill="none"
    stroke="currentColor"
    strokeWidth="3.5"
    strokeLinecap="square"
  />
);

/** Polynesia: the dotted diamond, closed in by nested chevrons. */
const Polynesian: Motif = ({ cx }) => (
  <g>
    <path
      d={`M${cx} ${MID - 19} L${cx + 15} ${MID} L${cx} ${MID + 19} L${cx - 15} ${MID} Z`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    />
    {[
      [0, -8],
      [0, 8],
      [-6, 0],
      [6, 0],
      [0, 0],
    ].map(([dx, dy], i) => (
      <circle key={i} cx={cx + dx} cy={MID + dy} r="2" fill="currentColor" />
    ))}
    {/* One chevron a side, not two: at the tighter rhythm the outer pair
        reached into its neighbours. */}
    <g fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d={`M${cx - 17} ${MID - 13} L${cx - 23} ${MID} L${cx - 17} ${MID + 13}`} />
      <path d={`M${cx + 17} ${MID - 13} L${cx + 23} ${MID} L${cx + 17} ${MID + 13}`} />
    </g>
  </g>
);

/** West Africa: the chevron, stacked as it is woven into kente. */
const Chevrons: Motif = ({ cx }) => (
  <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square">
    {[-14, -3, 8].map((dy, i) => (
      <path
        key={i}
        d={`M${cx - 16} ${MID + dy + 8} L${cx} ${MID + dy - 6} L${cx + 16} ${MID + dy + 8}`}
      />
    ))}
  </g>
);

/** The Islamic world: the eight-point star, as a printed block cuts it. */
const Star: Motif = ({ cx }) => {
  const pts = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 21 : 8.5;
    return `${cx + Math.cos(a) * r} ${MID + Math.sin(a) * r}`;
  });
  return (
    <g>
      <path d={`M${pts.join(" L")} Z`} fill="currentColor" />
      <circle cx={cx} cy={MID} r="4" fill={GROUND} />
    </g>
  );
};

/** The North: the crossed diamond of a Fair Isle round. */
const CrossDiamond: Motif = ({ cx }) => (
  <g stroke="currentColor" strokeWidth="2.2" fill="none">
    <path d={`M${cx} ${MID - 20} L${cx + 20} ${MID} L${cx} ${MID + 20} L${cx - 20} ${MID} Z`} />
    <path d={`M${cx - 11} ${MID - 11} L${cx + 11} ${MID + 11}`} />
    <path d={`M${cx + 11} ${MID - 11} L${cx - 11} ${MID + 11}`} />
    <circle cx={cx} cy={MID} r="3" fill="currentColor" stroke="none" />
  </g>
);

/** The Ottomans: the tulip, stood upright as Iznik draws it. */
const Tulip: Motif = ({ cx }) => (
  <g>
    <path
      d={`M${cx} ${MID + 20} V${MID + 2}`}
      stroke="currentColor"
      strokeWidth="2.4"
      fill="none"
    />
    <path
      d={`M${cx - 10} ${MID - 4} q0 -12 10 -16 q10 4 10 16 q-4 8 -10 8 q-6 0 -10 -8 Z`}
      fill="currentColor"
    />
    <path d={`M${cx} ${MID - 18} v10`} stroke={GROUND} strokeWidth="1.6" fill="none" />
    <path d={`M${cx} ${MID + 12} q-11 -2 -12 -10 q11 0 12 10 Z`} fill="currentColor" />
  </g>
);

/**
 * The order.
 *
 * Built from two pools rather than hand-listed, so it stays correct when the
 * slot count changes. Two Indian motifs to every one from abroad — twenty-seven
 * of the forty slots — and because the pools are eleven and ten long against
 * forty slots, the pairings shift each time round rather than locking into a
 * repeat.
 *
 * No motif can land beside itself: consecutive Indian slots take consecutive
 * entries from the Indian pool, and every third slot comes from the other pool
 * entirely.
 */
const INDIA: readonly Motif[] = [
  Rosette,
  Buti,
  Paisley,
  Lozenge,
  Temple,
  Jaali,
  Kolam,
  Leheriya,
  Bandhani,
  Warli,
  Phulkari,
];

const ABROAD: readonly Motif[] = [
  Meander,
  Asanoha,
  Fret,
  Polynesian,
  Chevrons,
  Star,
  CrossDiamond,
  Tulip,
];

const SEQUENCE: readonly Motif[] = Array.from({ length: SLOTS }, (_, i) =>
  i % 3 === 2
    ? ABROAD[((i - 2) / 3) % ABROAD.length]
    : INDIA[(i - Math.floor(i / 3)) % INDIA.length],
);

/* ── The edges ───────────────────────────────────────────────────────────── */

/**
 * The edge.
 *
 * One treatment, top and bottom, mirrored so the teeth point away from the band
 * on both sides. It was cycling through three treatments along the run, which
 * left the two edges disagreeing with each other at every point: the middle is
 * where the variety belongs, and a border wants a frame that holds still.
 */
function Sawtooth({ y, h, flip }: { y: number; h: number; flip: boolean }) {
  const step = 12;
  return (
    <g fill="currentColor">
      {Array.from({ length: RUN.width / step }, (_, i) => {
        const x = i * step;
        return (
          <path
            key={i}
            d={
              flip
                ? `M${x} ${y} L${x + step / 2} ${y + h} L${x + step} ${y} Z`
                : `M${x} ${y + h} L${x + step / 2} ${y} L${x + step} ${y + h} Z`
            }
          />
        );
      })}
    </g>
  );
}

function Run() {
  return (
    <svg
      viewBox={`0 0 ${RUN.width} ${RUN.height}`}
      className="block h-[var(--strip-h)] w-[2400px] shrink-0"
      aria-hidden="true"
    >
      <rect x="0" y="0" width={RUN.width} height="2" fill="currentColor" />
      <Sawtooth y={4} h={9} flip={false} />
      <rect x="0" y="15" width={RUN.width} height="1" fill="currentColor" />

      {SEQUENCE.map((Draw, i) => (
        <Draw key={i} cx={i * GAP + GAP / 2} />
      ))}

      <rect x="0" y={RUN.height - 16} width={RUN.width} height="1" fill="currentColor" />
      <Sawtooth y={RUN.height - 13} h={9} flip />
      <rect x="0" y={RUN.height - 2} width={RUN.width} height="2" fill="currentColor" />
    </svg>
  );
}

export function EditorialStrip({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`border-rule bg-paper-2 text-ink overflow-hidden border-y select-none ${className ?? ""}`}
    >
      <div className="animate-border-run flex w-max motion-reduce:animate-none">
        <Run />
        <Run />
      </div>
    </div>
  );
}
