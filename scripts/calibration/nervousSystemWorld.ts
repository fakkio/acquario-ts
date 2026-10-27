import {
  BODY_ID,
  DEFAULT_ROSTER,
  ORGANELLE_TYPES,
  createWorld,
  getPopulation,
  getWorstPenetration,
  isSynapseGene,
  maintenanceBreakdown,
  type OrganelleType,
  type OrganismView,
} from "../../src/world";
import {C_SYNAPSE, R_MIN} from "../../src/world/constants";
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
import {seeds, WORLD_SAMPLE_EVERY, WORLD_TICKS} from "./settings";
import {runTicksWatching} from "./worlds";

/**
 * The Reference World read by wiring (#103): the default roster, seeds 7–11,
 * mortal and fertile as the app runs it, sampled as `npm run thrusters`'
 * Reference World is, the second half pooled. Every number is reported,
 * never gated (ADR-0024), and each prediction (`vision.md`, M11) is printed
 * beside the number that tests it.
 */

const TYPES = Object.keys(ORGANELLE_TYPES) as OrganelleType[];

/** What a body's wiring holds: synapses, and the two shapes the prediction
 * names. A **Reflex** is a synapse from a body sense straight to a
 * thruster's `power`. A **chain** is a sense → a neuron's `in`, that
 * neuron's `out` → a thruster's `power`, the two synapses sharing the
 * neuron; a chain counts once per such pair of synapses. */
interface Wiring {
  readonly synapses: number;
  readonly reflexes: number;
  readonly chains: number;
}

function wiringOf(organism: OrganismView): Wiring {
  const typeOf = new Map(
    organism.organelles.map((gene) => [gene.innovationId, gene.type]),
  );
  const synapses = organism.genome.genes.filter(isSynapseGene);
  const fromSense = (id: number) => id === BODY_ID;
  const isPower = (synapse: (typeof synapses)[number]) =>
    typeOf.get(synapse.destination.id) === "thruster" &&
    synapse.destination.port === "power";

  const reflexes = synapses.filter(
    (synapse) => fromSense(synapse.source.id) && isPower(synapse),
  ).length;

  let chains = 0;
  for (const into of synapses) {
    if (
      !fromSense(into.source.id) ||
      typeOf.get(into.destination.id) !== "neuron" ||
      into.destination.port !== "in"
    ) {
      continue;
    }
    for (const out of synapses) {
      if (
        out.source.id === into.destination.id &&
        out.source.port === "out" &&
        isPower(out)
      ) {
        chains++;
      }
    }
  }

  return {synapses: synapses.length, reflexes, chains};
}

interface Pool {
  size: number;
  bodies: Record<OrganelleType, {carriers: number; pieces: number}>;
  synapses: {carriers: number; count: number};
  reflexes: number;
  chains: number;
  neurons: {count: number; radiusSum: number; atFloor: number};
  /** Synapse carriers: the share of spending the synapses take, summed so
   * the report averages it over carriers. */
  share: {carriers: number; sum: number; synapseCost: number; spending: number};
}

interface Run {
  readonly seed: number;
  readonly pool: Pool;
  readonly minPopulation: number;
  readonly finalPopulation: number;
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
    synapses: {carriers: 0, count: 0},
    reflexes: 0,
    chains: 0,
    neurons: {count: 0, radiusSum: 0, atFloor: 0},
    share: {carriers: 0, sum: 0, synapseCost: 0, spending: 0},
  };
}

/** A neuron within a hair of `r_min` counts as at the floor: relaxation and
 * the clamp leave it exactly there, a step above it is a step of 5%. */
const FLOOR_TOLERANCE = 1.001;

/** The Thrust Cost an organism pays this tick, from the signals the network
 * step set (`thrustCost × |signal × maxForce|`, as the thrusters report). */
function thrustCostOf(organism: OrganismView): number {
  let cost = 0;
  for (const [i, thruster] of organism.thrusters.entries()) {
    cost +=
      thruster.thrustCost *
      Math.abs(organism.thrusterSignals[i] * thruster.maxForce);
  }

  return cost;
}

function runWorld(seed: number): Run {
  const pool = emptyPool();
  const seen = new WeakSet<OrganismView>();
  let hasSeen = false;
  let minPopulation = Number.POSITIVE_INFINITY;
  let finalPopulation = 0;
  let worstOverlap = 0;
  let worstBirthOverlap = 0;
  let worstRestOverlap = 0;
  let meanGeneration = 0;

  runTicksWatching(createWorld(seed), WORLD_TICKS, (world, tick) => {
    const population = getPopulation(world);
    minPopulation = Math.min(minPopulation, population.length);
    finalPopulation = population.length;
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
      for (const gene of organism.organelles) {
        if (gene.type === "neuron") {
          pool.neurons.count++;
          pool.neurons.radiusSum += gene.radius;
          pool.neurons.atFloor +=
            gene.radius <= R_MIN * FLOOR_TOLERANCE ? 1 : 0;
        }
      }

      const wiring = wiringOf(organism);
      if (wiring.synapses === 0) {
        continue;
      }
      pool.synapses.carriers++;
      pool.synapses.count += wiring.synapses;
      pool.reflexes += wiring.reflexes;
      pool.chains += wiring.chains;
      const synapseCost = C_SYNAPSE * wiring.synapses;
      const spending =
        maintenanceBreakdown(organism).total + thrustCostOf(organism);
      pool.share.carriers++;
      pool.share.sum += synapseCost / spending;
      pool.share.synapseCost += synapseCost;
      pool.share.spending += spending;
    }
  });

  return {
    seed,
    pool,
    minPopulation,
    finalPopulation,
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

function sum(runs: readonly Run[], pick: (pool: Pool) => number): number {
  return runs.reduce((total, run) => total + pick(run.pool), 0);
}

export function reportNervousSystemOnReferenceWorld(): void {
  const runs = seeds().map((seed) => runWorld(seed));
  const total = sum(runs, (pool) => pool.size);

  heading("The Reference World, by wiring");
  note(
    `  Default roster (${DEFAULT_ROSTER.join(", ")}), seeds ${seeds().join(", ")}, ${integer(WORLD_TICKS)} ticks, sampled every ${integer(WORLD_SAMPLE_EVERY)}; second half pooled (${integer(total)} body readings).`,
  );

  // Carriers and insertion rates.
  const weights = Object.values(OPERATOR_WEIGHTS).reduce(
    (acc, weight) => acc + weight,
    0,
  );
  const insertionShare = OPERATOR_WEIGHTS.insertion / weights;
  const synapseShare = OPERATOR_WEIGHTS.synapseInsertion / weights;
  const typeRate = insertionShare / DEFAULT_ROSTER.length;
  note(
    `  Organelle insertion is ${percent(insertionShare)} of structural events, down from a fifth (${percent(0.2)}) now that synapse insertion takes ${percent(synapseShare)}; ${percent(typeRate)} per type among ${String(DEFAULT_ROSTER.length)}.`,
  );
  const typeRows = TYPES.map((type) => {
    const fractions = runs.map(
      (run) => run.pool.bodies[type].carriers / Math.max(1, run.pool.size),
    );
    const carriers = sum(runs, (pool) => pool.bodies[type].carriers);
    const pieces = sum(runs, (pool) => pool.bodies[type].pieces);

    return [
      type,
      across(fractions),
      fractions.map((fraction) => percent(fraction)).join(" "),
      mean(pieces, carriers, 3),
      percent(typeRate),
    ];
  });
  const synapseFractions = runs.map(
    (run) => run.pool.synapses.carriers / Math.max(1, run.pool.size),
  );
  const synapseCarriers = sum(runs, (pool) => pool.synapses.carriers);
  typeRows.push([
    "synapse",
    across(synapseFractions),
    synapseFractions.map((fraction) => percent(fraction)).join(" "),
    mean(
      sum(runs, (pool) => pool.synapses.count),
      synapseCarriers,
      3,
    ),
    percent(synapseShare),
  ]);
  table(
    ["type", "carrier fraction", "per run", "per carrier", "insertion rate"],
    typeRows,
  );

  // Wiring.
  const reflexes = sum(runs, (pool) => pool.reflexes);
  const chains = sum(runs, (pool) => pool.chains);
  note("");
  note(
    "  Wiring, pooled. A Reflex is a synapse from a body sense to a thruster's power. A chain is a body sense → a neuron's in, that neuron's out → a thruster's power, counted once per pair of synapses.",
  );
  row(
    "Reflexes",
    `${integer(reflexes)} in ${integer(total)} readings (${num((1000 * reflexes) / Math.max(1, total), 3)} per 1000 bodies)`,
  );
  row(
    "sense → neuron → thruster chains",
    `${integer(chains)} in ${integer(total)} readings (${num((1000 * chains) / Math.max(1, total), 3)} per 1000 bodies)`,
  );

  // Neurons.
  const neurons = sum(runs, (pool) => pool.neurons.count);
  note("");
  row(
    "neuron radius / r_min",
    `${mean(sum(runs, (pool) => pool.neurons.radiusSum) / R_MIN, neurons, 3)} (r_min ${num(R_MIN)}, ${integer(neurons)} neurons; 1 is the floor)`,
  );
  row(
    "neurons at the floor",
    percent(sum(runs, (pool) => pool.neurons.atFloor) / Math.max(1, neurons)),
  );

  // Cost.
  const shares = runs.map((run) =>
    run.pool.share.carriers > 0
      ? run.pool.share.sum / run.pool.share.carriers
      : Number.NaN,
  );
  const share = meanAndSigma(shares.filter(Number.isFinite));
  note("");
  row(
    "synapses' share of a carrier's spending",
    Number.isFinite(share.mean)
      ? `${percent(share.mean)} ± ${percent(share.sigma)} (per run ${shares.map((value) => (Number.isFinite(value) ? percent(value) : "—")).join(" ")})`
      : "— (no body carried a synapse)",
  );
  row(
    "  pooled",
    `${percent(
      sum(runs, (pool) => pool.share.synapseCost) /
        Math.max(
          1e-12,
          sum(runs, (pool) => pool.share.spending),
        ),
    )}, c_synapse ${num(C_SYNAPSE)} per synapse`,
  );
  note(
    "  Spending is maintenance plus the Thrust Cost, per carrier per tick; the share is c_synapse × count over it, averaged over carriers.",
  );

  // Persistence and overlap.
  note("");
  table(
    ["seed", "min pop", "final pop", "worst overlap", "at births", "otherwise"],
    runs.map((run) => [
      String(run.seed),
      integer(run.minPopulation),
      integer(run.finalPopulation),
      num(run.worstOverlap),
      num(run.worstBirthOverlap),
      num(run.worstRestOverlap),
    ]),
  );
  row(
    "worst, no birth (M1's ceiling 0.5)",
    num(Math.max(...runs.map((run) => run.worstRestOverlap))),
  );
  const generations = runs.map((run) => run.meanGeneration);
  row(
    "mean Generation at the end",
    `${num(meanAndSigma(generations).mean, 3)} (per run ${generations.map((value) => num(value, 3)).join(" ")})`,
  );

  // Predictions.
  note("");
  note("  Predictions (vision.md, M11), beside the numbers that test them:");
  note(
    `   - wired thrusters are almost absent: synapse carriers ${across(synapseFractions)}, Reflexes ${integer(reflexes)}`,
  );
  note(
    `   - Reflexes sit at drift and no behaviour is selected: ${num((1000 * reflexes) / Math.max(1, total), 3)} per 1000 bodies, chains ${num((1000 * chains) / Math.max(1, total), 3)}`,
  );
  note(`   - neurons fall towards r_min: neuron radius / r_min above`);
  note(
    `   - organelle insertion falls from a fifth of events to a sixth: ${percent(insertionShare)} of events, ${percent(typeRate)} per type`,
  );
  note(
    `   - persistence holds: min pop ${String(Math.min(...runs.map((run) => run.minPopulation)))}, every seed ${runs.every((run) => run.finalPopulation > 0) ? "survived" : "DID NOT survive"}`,
  );
  note("   A surprise would be a working chain spreading through a lineage.");
}
