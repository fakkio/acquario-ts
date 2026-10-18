import {
  AQUARIUM_HEIGHT,
  BRIGHT_BAND_DEPTH,
  DEFAULT_ROSTER,
  createWorld,
  getPopulation,
  getWorstPenetration,
  lightAt,
  restingDepth,
  turn,
  type OrganelleType,
  type OrganismView,
} from "../../src/world";
import {DENSITY_SPAN, R_NEW} from "../../src/world/constants";
import {OPERATOR_WEIGHTS} from "../../src/world/genome";
import {worstPairHoldsNewborn} from "./buoyancy";
import {breakEvenRadius, measureEarningsBands} from "./chloroplast";
import {
  heading,
  integer,
  meanAndSigma,
  note,
  num,
  percent,
  row,
  table,
} from "./report";
import {seeds, WORLD_SAMPLE_EVERY, WORLD_TICKS} from "./settings";
import {runTicksWatching} from "./worlds";

/**
 * The chloroplast on the Reference World (#88): the default roster, seeds
 * 7–11, mortal and fertile as the app runs it, sampled as `npm run buoyancy`'s
 * Reference World is, the second half pooled. Every number is reported, never
 * gated (ADR-0024).
 */

/** A float carrier older than this has had time to right itself (the righting
 * time, about 20k ticks, twice over). */
const OLD_CARRIER_TICKS = 40_000;

/** The timescales `vision.md`'s M9 paragraph predicts, in ticks. Fixed before
 * the runs; the interior relaxation is `npm run chloroplast`'s own first
 * composition check. */
const FLOAT_RISE_TICKS = 36_000;
const INTERIOR_RELAXATION_TICKS = 71_000;
const RIGHTING_TICKS = 20_000;

const COMPOSITIONS = ["none", "float", "chloroplast", "both"] as const;
type Composition = (typeof COMPOSITIONS)[number];

const TYPES: readonly OrganelleType[] = ["neuron", "float", "chloroplast"];

function compositionOf(floats: number, chloroplasts: number): Composition {
  if (floats > 0 && chloroplasts > 0) {
    return "both";
  }
  if (floats > 0) {
    return "float";
  }

  return chloroplasts > 0 ? "chloroplast" : "none";
}

function countOf(organism: OrganismView, type: OrganelleType): number {
  return organism.organelles.filter((gene) => gene.type === type).length;
}

/** A body with an interior Resting Depth, accumulated over the samples it
 * appeared in. */
interface InteriorBody {
  readonly seed: number;
  readonly label: string;
  readonly predictedSigma: number;
  readonly restingDepth: number;
  samples: number;
  offsetSum: number;
}

interface Pool {
  size: number;
  bodies: Record<OrganelleType, {carriers: number; pieces: number}>;
  depth: Record<Composition, {count: number; sum: number}>;
  /** Per depth band of `measureEarningsBands`: chloroplast pieces by their
   * own depth with their radii, and chloroplast-carrying bodies by centre
   * depth with their summed radii. */
  pieces: {count: number; radiusSum: number}[];
  carriersByBand: {count: number; radiusSum: number; pieceSum: number}[];
  lightRatio: {
    count: number;
    sum: number;
    uprightCount: number;
    uprightSum: number;
  };
  /** Float carriers with an off-centre float: how many, and summed lever
   * angle in degrees, for every age and for those past OLD_CARRIER_TICKS. */
  lever: {count: number; sum: number; oldCount: number; oldSum: number};
}

interface Run {
  readonly seed: number;
  readonly pool: Pool;
  readonly interior: readonly InteriorBody[];
  readonly worstOverlap: number;
  readonly worstBirthOverlap: number;
  readonly worstRestOverlap: number;
  /** The mean Generation of the last population, and the ticks per
   * Generation it implies. */
  readonly meanGeneration: number;
}

function emptyPool(bands: number): Pool {
  const carriers = () => ({carriers: 0, pieces: 0});

  return {
    size: 0,
    bodies: {
      neuron: carriers(),
      float: carriers(),
      chloroplast: carriers(),
      thruster: carriers(),
    },
    depth: {
      none: {count: 0, sum: 0},
      float: {count: 0, sum: 0},
      chloroplast: {count: 0, sum: 0},
      both: {count: 0, sum: 0},
    },
    pieces: Array.from({length: bands}, () => ({count: 0, radiusSum: 0})),
    carriersByBand: Array.from({length: bands}, () => ({
      count: 0,
      radiusSum: 0,
      pieceSum: 0,
    })),
    lightRatio: {count: 0, sum: 0, uprightCount: 0, uprightSum: 0},
    lever: {count: 0, sum: 0, oldCount: 0, oldSum: 0},
  };
}

function bandOf(edges: readonly number[], depth: number): number {
  return edges.findIndex(
    (edge, index) =>
      index < edges.length - 1 && depth >= edge && depth < edges[index + 1],
  );
}

/** The float's lever angle from straight up, in degrees, or null for a body
 * whose weighing area sits on its centre. */
function leverAngle(organism: OrganismView): number | null {
  const {cos, sin} = organism.axis;
  const {px, py} = organism.moments;
  const lever = Math.hypot(px, py);
  if (lever <= 1e-9) {
    return null;
  }
  const up = Math.min(1, Math.max(-1, -(sin * px + cos * py) / lever));

  return (Math.acos(up) * 180) / Math.PI;
}

function runWorld(seed: number, edges: readonly number[]): Run {
  const pool = emptyPool(edges.length - 1);
  const interior = new Map<OrganismView, InteriorBody>();
  const firstSeen = new WeakMap<OrganismView, number>();
  const seen = new WeakSet<OrganismView>();
  let hasSeen = false;
  let worstOverlap = 0;
  let worstBirthOverlap = 0;
  let worstRestOverlap = 0;
  let meanGeneration = 0;

  runTicksWatching(createWorld(seed), WORLD_TICKS, (world, tick) => {
    const population = getPopulation(world);
    const overlap = getWorstPenetration(world);
    worstOverlap = Math.max(worstOverlap, overlap);
    if (hasSeen && overlap > Math.min(worstBirthOverlap, worstRestOverlap)) {
      if (worstPairHoldsNewborn(population, seen)) {
        worstBirthOverlap = Math.max(worstBirthOverlap, overlap);
      } else {
        worstRestOverlap = Math.max(worstRestOverlap, overlap);
      }
    }
    for (const organism of population) {
      seen.add(organism);
      if (!firstSeen.has(organism)) {
        firstSeen.set(organism, tick);
      }
    }
    hasSeen = true;

    if (tick % WORLD_SAMPLE_EVERY !== 0) {
      return;
    }
    meanGeneration =
      population.reduce((total, organism) => total + organism.generation, 0) /
      Math.max(1, population.length);
    if (tick <= WORLD_TICKS / 2) {
      return;
    }

    pool.size += population.length;
    for (const organism of population) {
      const floats = countOf(organism, "float");
      const chloroplasts = countOf(organism, "chloroplast");
      for (const type of TYPES) {
        const count = countOf(organism, type);
        pool.bodies[type].carriers += count > 0 ? 1 : 0;
        pool.bodies[type].pieces += count;
      }
      const composition = compositionOf(floats, chloroplasts);
      pool.depth[composition].count++;
      pool.depth[composition].sum += organism.y;

      if (floats > 0) {
        const angle = leverAngle(organism);
        if (angle !== null) {
          pool.lever.count++;
          pool.lever.sum += angle;
          if (tick - (firstSeen.get(organism) ?? tick) > OLD_CARRIER_TICKS) {
            pool.lever.oldCount++;
            pool.lever.oldSum += angle;
          }
        }
      }

      const resting = restingDepth(organism.moments);
      if (resting.kind === "interior") {
        let body = interior.get(organism);
        if (body === undefined) {
          const a = DENSITY_SPAN * organism.moments.area;
          body = {
            seed,
            label: `${String(countOf(organism, "float"))}F+${String(chloroplasts)}C`,
            predictedSigma: Math.sqrt(
              (BRIGHT_BAND_DEPTH * AQUARIUM_HEIGHT * Math.PI * R_NEW * R_NEW) /
                a,
            ),
            restingDepth: resting.depth,
            samples: 0,
            offsetSum: 0,
          };
          interior.set(organism, body);
        }
        body.samples++;
        body.offsetSum += organism.y - resting.depth;
      }

      if (chloroplasts === 0) {
        continue;
      }
      const centreLight = lightAt(organism.y);
      const upright = organism.axis.cos > Math.cos(Math.PI / 6);
      let radiusSum = 0;
      for (const gene of organism.organelles) {
        if (gene.type !== "chloroplast") {
          continue;
        }
        radiusSum += gene.radius;
        const turned = turn(organism.axis, gene.x, gene.y);
        const pieceDepth = organism.y + turned.y;
        const band = bandOf(edges, pieceDepth);
        if (band >= 0) {
          pool.pieces[band].count++;
          pool.pieces[band].radiusSum += gene.radius;
        }
        if (centreLight > 1e-3) {
          const ratio = lightAt(pieceDepth) / centreLight;
          pool.lightRatio.count++;
          pool.lightRatio.sum += ratio;
          if (upright) {
            pool.lightRatio.uprightCount++;
            pool.lightRatio.uprightSum += ratio;
          }
        }
      }
      const carrierBand = bandOf(edges, organism.y);
      if (carrierBand >= 0) {
        pool.carriersByBand[carrierBand].count++;
        pool.carriersByBand[carrierBand].radiusSum += radiusSum;
        pool.carriersByBand[carrierBand].pieceSum += chloroplasts;
      }
    }
  });

  return {
    seed,
    pool,
    interior: [...interior.values()],
    worstOverlap,
    worstBirthOverlap,
    worstRestOverlap,
    meanGeneration,
  };
}

function mean(sum: number, count: number, digits = 4): string {
  return count > 0 ? num(sum / count, digits) : "—";
}

function across(values: readonly number[]): string {
  const {mean: m, sigma} = meanAndSigma(values);

  return `${percent(m)} ± ${percent(sigma)}`;
}

export function reportChloroplastOnReferenceWorld(): void {
  const {edges} = measureEarningsBands();
  const runs = seeds().map((seed) => runWorld(seed, edges));
  const total = runs.reduce((sum, run) => sum + run.pool.size, 0);

  heading("The chloroplast on the Reference World");
  note(
    `  Default roster (${DEFAULT_ROSTER.join(", ")}), seeds ${seeds().join(", ")}, ${integer(WORLD_TICKS)} ticks, sampled every ${integer(WORLD_SAMPLE_EVERY)}; second half pooled (${integer(total)} body readings).`,
  );

  // Carriers.
  const eventShare =
    OPERATOR_WEIGHTS.insertion /
    Object.values(OPERATOR_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
  const insertionRate = eventShare / DEFAULT_ROSTER.length;
  note(
    `  Insertion rate: ${percent(insertionRate)} of structural events per type (an insertion is ${percent(eventShare)} of events, drawn uniformly among ${String(DEFAULT_ROSTER.length)} types).`,
  );
  table(
    ["type", "carrier fraction", "per run", "per carrier", "insertion rate"],
    TYPES.map((type) => {
      const fractions = runs.map(
        (run) => run.pool.bodies[type].carriers / Math.max(1, run.pool.size),
      );
      const carriers = runs.reduce(
        (sum, run) => sum + run.pool.bodies[type].carriers,
        0,
      );
      const pieces = runs.reduce(
        (sum, run) => sum + run.pool.bodies[type].pieces,
        0,
      );

      return [
        type,
        across(fractions),
        fractions.map((fraction) => percent(fraction)).join(" "),
        mean(pieces, carriers, 3),
        percent(insertionRate),
      ];
    }),
  );

  // Depth by composition.
  note("");
  note("  Mean depth by composition (bodies pooled across seeds).");
  table(
    ["composition", "bodies", "share", "mean depth"],
    COMPOSITIONS.map((composition) => {
      const count = runs.reduce(
        (sum, run) => sum + run.pool.depth[composition].count,
        0,
      );
      const depth = runs.reduce(
        (sum, run) => sum + run.pool.depth[composition].sum,
        0,
      );

      return [
        composition,
        integer(count),
        percent(count / Math.max(1, total)),
        mean(depth, count),
      ];
    }),
  );

  // Interior Resting Depths.
  const interior = runs.flatMap((run) => run.interior);
  note("");
  note(
    `  Bodies with an interior Resting Depth: ${String(interior.length)}. y − y* is the mean over the samples a body was read in; σ² = L·H·a_new/A.`,
  );
  if (interior.length > 0) {
    table(
      ["seed", "composition", "y*", "samples", "mean y − y*", "predicted σ"],
      interior
        .slice()
        .sort((a, b) => b.samples - a.samples)
        .slice(0, 40)
        .map((body) => [
          String(body.seed),
          body.label,
          num(body.restingDepth),
          String(body.samples),
          num(body.offsetSum / body.samples),
          num(body.predictedSigma),
        ]),
    );
  }

  // ADR-0029's observables.
  note("");
  note(
    "  Chloroplast radius against r*(y), by depth band (ADR-0029). Pieces are binned by their own depth, carriers by their centre's;",
  );
  note(
    "  count × radius is the carrier's summed chloroplast radius, i.e. its chloroplast count times their mean radius.",
  );
  table(
    [
      "band",
      "chloroplasts",
      "mean radius",
      "r*(y)",
      "radius / r*",
      "carriers",
      "mean count",
      "count × radius",
    ],
    edges.slice(0, -1).map((from, band) => {
      const piece = runs.reduce(
        (sum, run) => sum + run.pool.pieces[band].count,
        0,
      );
      const radius = runs.reduce(
        (sum, run) => sum + run.pool.pieces[band].radiusSum,
        0,
      );
      const carriers = runs.reduce(
        (sum, run) => sum + run.pool.carriersByBand[band].count,
        0,
      );
      const carrierRadius = runs.reduce(
        (sum, run) => sum + run.pool.carriersByBand[band].radiusSum,
        0,
      );
      const carrierPieces = runs.reduce(
        (sum, run) => sum + run.pool.carriersByBand[band].pieceSum,
        0,
      );
      const rStar = breakEvenRadius((from + edges[band + 1]) / 2);

      return [
        `${num(from, 3)}–${num(edges[band + 1], 3)}`,
        integer(piece),
        mean(radius, piece),
        rStar === null ? "—" : num(rStar),
        rStar === null || piece === 0 ? "—" : num(radius / piece / rStar),
        integer(carriers),
        mean(carrierPieces, carriers, 3),
        mean(carrierRadius, carriers),
      ];
    }),
  );
  note(
    `  r_new = ${num(R_NEW)}, so r* = 2·r_new = ${num(2 * R_NEW)} over the Bright Band; r*(y) is read at each band's middle.`,
  );

  // Position.
  const light = runs.reduce(
    (acc, run) => {
      const ratio = run.pool.lightRatio;

      return {
        count: acc.count + ratio.count,
        sum: acc.sum + ratio.sum,
        uprightCount: acc.uprightCount + ratio.uprightCount,
        uprightSum: acc.uprightSum + ratio.uprightSum,
      };
    },
    {count: 0, sum: 0, uprightCount: 0, uprightSum: 0},
  );
  note("");
  row(
    "light ratio, all",
    `${mean(light.sum, light.count)} (${integer(light.count)} chloroplasts)`,
  );
  row(
    "light ratio, upright",
    `${mean(light.uprightSum, light.uprightCount)} (${integer(light.uprightCount)} chloroplasts)`,
  );

  note(
    "  Light ratio: a chloroplast's light over its body centre's (upright: Body Axis within 30° of the world's).",
  );
  note(
    "  Lever angle: the float's lever from straight up, carriers with an off-centre float; 'all ages' is M8's half-run mean.",
  );

  // Gravitaxis.
  const lever = runs.reduce(
    (acc, run) => ({
      count: acc.count + run.pool.lever.count,
      sum: acc.sum + run.pool.lever.sum,
      oldCount: acc.oldCount + run.pool.lever.oldCount,
      oldSum: acc.oldSum + run.pool.lever.oldSum,
    }),
    {count: 0, sum: 0, oldCount: 0, oldSum: 0},
  );
  row(
    `lever angle, older than ${integer(OLD_CARRIER_TICKS / 1000)}k`,
    `${mean(lever.oldSum, lever.oldCount, 3)}° (${integer(lever.oldCount)} readings)`,
  );
  row(
    "lever angle, all ages",
    `${mean(lever.sum, lever.count, 3)}° (${integer(lever.count)} readings)`,
  );

  // Overlap.
  note("");
  table(
    ["seed", "worst overlap", "at births", "otherwise"],
    runs.map((run) => [
      String(run.seed),
      num(run.worstOverlap),
      num(run.worstBirthOverlap),
      num(run.worstRestOverlap),
    ]),
  );
  row(
    "worst, no birth",
    num(Math.max(...runs.map((run) => run.worstRestOverlap))),
  );

  // Timescales.
  const generationTimes = runs.map((run) =>
    run.meanGeneration > 0 ? WORLD_TICKS / run.meanGeneration : Number.NaN,
  );
  const generation = meanAndSigma(generationTimes.filter(Number.isFinite));
  note("");
  note(
    "  Timescales, predicted (vision.md, M9) beside the measured mean time between generations (ticks / the last population's mean Generation).",
  );
  row("float rise time", `${integer(FLOAT_RISE_TICKS)} ticks`);
  row("interior relaxation", `${integer(INTERIOR_RELAXATION_TICKS)} ticks`);
  row("righting time", `${integer(RIGHTING_TICKS)} ticks`);
  row(
    "generation time",
    `${integer(Math.round(generation.mean))} ± ${integer(Math.round(generation.sigma))} ticks (per run ${generationTimes.map((time) => integer(Math.round(time))).join(", ")})`,
  );
}
