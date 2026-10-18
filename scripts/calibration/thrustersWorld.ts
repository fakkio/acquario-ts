import {
  DEFAULT_ROSTER,
  ORGANELLE_TYPES,
  ROTATIONAL_DRAG_PER_CUBE,
  createWorld,
  getPopulation,
  getWorstPenetration,
  maintenanceBreakdown,
  turn,
  type OrganelleType,
  type OrganismView,
} from "../../src/world";
import {OPERATOR_WEIGHTS} from "../../src/world/genome";
import {worstPairHoldsNewborn} from "./buoyancy";
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
import {
  seeds,
  THRUSTER_SPIN_RATE,
  WORLD_SAMPLE_EVERY,
  WORLD_TICKS,
} from "./settings";
import {runTicksWatching} from "./worlds";

/**
 * The thruster on the Reference World (#95): the default roster, seeds 7–11,
 * mortal and fertile as the app runs it, sampled as `npm run chloroplast`'s
 * Reference World is, the second half pooled. Every number is reported,
 * never gated (ADR-0024).
 *
 * "Up" in this report is `−y`, as the world's y grows towards the floor.
 */

const TYPES = Object.keys(ORGANELLE_TYPES) as OrganelleType[];

/** Compositions by the three types that change where a body goes: a float,
 * a chloroplast and a thruster. The neuron weighs nothing and pushes
 * nothing, so a body carrying only neurons is read as having none. */
function compositionOf(organism: OrganismView): string {
  const has = (type: OrganelleType) =>
    organism.organelles.some((gene) => gene.type === type);
  const parts = [
    has("float") ? "float" : "",
    has("chloroplast") ? "chloroplast" : "",
    has("thruster") ? "thruster" : "",
  ].filter((part) => part !== "");

  return parts.length === 0 ? "none" : parts.join(" + ");
}

const COMPOSITIONS = [
  "none",
  "float",
  "chloroplast",
  "thruster",
  "float + chloroplast",
  "float + thruster",
  "chloroplast + thruster",
  "float + chloroplast + thruster",
];

interface Pool {
  size: number;
  bodies: Record<OrganelleType, {carriers: number; pieces: number}>;
  depth: Record<string, {count: number; sum: number}>;
  /** Thruster carriers: the world-frame thrust, the thrusters' drive, the
   * turn the thrust gives, and what the thrust costs against what
   * maintenance does. */
  thrust: {
    carriers: number;
    upSum: number;
    magnitudeSum: number;
    thrusters: number;
    driveSum: number;
    spinning: number;
    costSum: number;
    maintenanceSum: number;
  };
}

interface Run {
  readonly seed: number;
  readonly pool: Pool;
  readonly worstOverlap: number;
  readonly worstBirthOverlap: number;
  readonly worstRestOverlap: number;
  readonly meanGeneration: number;
}

function emptyPool(): Pool {
  const carriers = () => ({carriers: 0, pieces: 0});

  return {
    size: 0,
    bodies: {
      neuron: carriers(),
      float: carriers(),
      chloroplast: carriers(),
      thruster: carriers(),
    },
    depth: Object.fromEntries(
      COMPOSITIONS.map((name) => [name, {count: 0, sum: 0}]),
    ),
    thrust: {
      carriers: 0,
      upSum: 0,
      magnitudeSum: 0,
      thrusters: 0,
      driveSum: 0,
      spinning: 0,
      costSum: 0,
      maintenanceSum: 0,
    },
  };
}

function runWorld(seed: number): Run {
  const pool = emptyPool();
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
      for (const type of TYPES) {
        const count = organism.organelles.filter(
          (gene) => gene.type === type,
        ).length;
        pool.bodies[type].carriers += count > 0 ? 1 : 0;
        pool.bodies[type].pieces += count;
      }
      const composition = pool.depth[compositionOf(organism)];
      composition.count++;
      composition.sum += organism.y;

      if (organism.thrusters.length === 0) {
        continue;
      }
      let fx = 0;
      let fy = 0;
      let torque = 0;
      let cost = 0;
      for (const thruster of organism.thrusters) {
        const magnitude = thruster.signal * thruster.maxForce;
        const bodyX = thruster.dx * magnitude;
        const bodyY = thruster.dy * magnitude;
        const world = turn(organism.axis, bodyX, bodyY);
        fx += world.x;
        fy += world.y;
        torque += thruster.x * bodyY - thruster.y * bodyX;
        cost += thruster.thrustCost * Math.abs(magnitude);
        pool.thrust.thrusters++;
        pool.thrust.driveSum += thruster.signal;
      }
      const omega =
        torque / (ROTATIONAL_DRAG_PER_CUBE * organism.bodyRadius ** 3);
      pool.thrust.carriers++;
      pool.thrust.upSum += -fy;
      pool.thrust.magnitudeSum += Math.hypot(fx, fy);
      pool.thrust.spinning += Math.abs(omega) > THRUSTER_SPIN_RATE ? 1 : 0;
      pool.thrust.costSum += cost;
      pool.thrust.maintenanceSum += maintenanceBreakdown(organism).total;
    }
  });

  return {
    seed,
    pool,
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

export function reportThrusterOnReferenceWorld(): void {
  const runs = seeds().map((seed) => runWorld(seed));
  const total = runs.reduce((sum, run) => sum + run.pool.size, 0);

  heading("The thruster on the Reference World");
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
  note(
    "  Mean depth by composition (bodies pooled across seeds); neurons weigh nothing and are left out of the name.",
  );
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

  // Thrust, resolved in the world.
  note("");
  note(
    "  Thruster carriers' thrust resolved in the world, per carrier: the net force's upward component (−y), against the 0 of no selection.",
  );
  const perRun = runs.map((run) => {
    const {thrust} = run.pool;

    return {
      up: thrust.carriers > 0 ? thrust.upSum / thrust.carriers : Number.NaN,
      magnitude:
        thrust.carriers > 0
          ? thrust.magnitudeSum / thrust.carriers
          : Number.NaN,
      drive:
        thrust.thrusters > 0 ? thrust.driveSum / thrust.thrusters : Number.NaN,
      spinning:
        thrust.carriers > 0 ? thrust.spinning / thrust.carriers : Number.NaN,
    };
  });
  const finite = (values: readonly number[]) => values.filter(Number.isFinite);
  const up = meanAndSigma(finite(perRun.map((run) => run.up)));
  const magnitude = meanAndSigma(finite(perRun.map((run) => run.magnitude)));
  const drive = meanAndSigma(finite(perRun.map((run) => run.drive)));
  const carriers = runs.reduce((sum, run) => sum + run.pool.thrust.carriers, 0);
  const spinning = runs.reduce((sum, run) => sum + run.pool.thrust.spinning, 0);
  const costSum = runs.reduce((sum, run) => sum + run.pool.thrust.costSum, 0);
  const maintenanceSum = runs.reduce(
    (sum, run) => sum + run.pool.thrust.maintenanceSum,
    0,
  );
  row(
    "mean upward thrust",
    `${num(up.mean)} ± ${num(up.sigma)} (per run ${perRun.map((run) => num(run.up)).join(" ")})`,
  );
  row("mean |net thrust|", `${num(magnitude.mean)} ± ${num(magnitude.sigma)}`);
  row(
    "upward / |net thrust|",
    magnitude.mean > 0 ? num(up.mean / magnitude.mean) : "—",
  );
  row("mean drive", `${num(drive.mean)} ± ${num(drive.sigma)}`);
  row(
    `carriers spinning (|ω| > ${num(THRUSTER_SPIN_RATE, 2)} rad/tick)`,
    `${percent(spinning / Math.max(1, carriers))} (${integer(spinning)} of ${integer(carriers)} readings; per run ${perRun.map((run) => percent(run.spinning)).join(" ")})`,
  );
  row(
    "Thrust Cost, share of spending",
    `${percent(costSum / Math.max(1e-12, costSum + maintenanceSum))} (thrust ${mean(costSum, carriers)}, maintenance ${mean(maintenanceSum, carriers)} per carrier per tick)`,
  );
  note(
    "  Spending is maintenance plus the Thrust Cost; ω is the thrust's torque over 8π·R³, the buoyant torque left out.",
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
    "worst, no birth (M1's ceiling 0.5)",
    num(Math.max(...runs.map((run) => run.worstRestOverlap))),
  );

  // Timescales.
  const generationTimes = runs.map((run) =>
    run.meanGeneration > 0 ? WORLD_TICKS / run.meanGeneration : Number.NaN,
  );
  const generation = meanAndSigma(generationTimes.filter(Number.isFinite));
  note("");
  row(
    "generation time",
    `${integer(Math.round(generation.mean))} ± ${integer(Math.round(generation.sigma))} ticks (per run ${generationTimes.map((time) => integer(Math.round(time))).join(", ")})`,
  );
}
