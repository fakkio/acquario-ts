import {
  BASELINE_GENOME,
  bodyArea,
  createWorld,
  DEFAULT_ROSTER,
  getCumulativeBirths,
  getPopulation,
  type OrganismView,
} from "../../src/world";
import {C_NEURON, EXISTENCE_COST} from "../../src/world/constants";
import {birthCostCeilingTerms} from "../../src/world/genome";
import {reach} from "../../src/world/layout";
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
import {NEURON_SAMPLE_EVERY, NEURON_TICKS, seeds} from "./settings";
import {runTicksWatching} from "./worlds";

/**
 * M7's neuron and the Birth Cost Ceiling, measured (#66).
 *
 * A neuron without synapses does nothing, so it is its own knockout world
 * (ADR-0033's logic, a milestone early): its carrier fraction settling below
 * what drift alone gives is the check that the cost law bites. "What drift
 * alone gives" is the same Reference World, on the same seeds, with
 * `c_neuron = 0`. The constant is read once at import (`tunable`), so the
 * baseline cannot be a second world in this process: it is this same
 * measurement run again in a child process with `ACQUARIO_C_NEURON=0`, and
 * its readings come back as JSON.
 *
 * The second reading is ADR-0028's risk to watch: what the ceiling costs. It
 * stands in for the per-birth ratio of ceiling to child area, since a child
 * is an unbiased sample centred on its parent, and this way the world needs
 * no birth-level reader.
 *
 * Report only: nothing here asserts (ADR-0024).
 */

interface Sample {
  readonly tick: number;
  readonly size: number;
  readonly carriers: number;
  readonly neurons: number;
  /** Sums of ceiling over own body area, split by carrying; divided by
   * `carriers` and `size - carriers` to read a mean. */
  readonly carrierRatioSum: number;
  readonly plainRatioSum: number;
  /** Carriers whose Reach exceeds `R_area` (ADR-0036: the cytoplasm gene is
   * inert for them), and the sum of how far, in length units. */
  readonly reachDominated: number;
  readonly reachExcessSum: number;
  /** Ceilings set by the reach term rather than the area term, split by
   * carrying. */
  readonly carrierReachSet: number;
  readonly plainReachSet: number;
}

export interface NeuronRun {
  readonly seed: number;
  readonly samples: readonly Sample[];
  readonly minSize: number;
  readonly finalSize: number;
  readonly births: number;
}

export interface NeuronRuns {
  readonly cNeuron: number;
  readonly runs: readonly NeuronRun[];
}

/** The two terms of the ceiling the world would price this body at, each
 * over its own area. The view carries the genome's parts the ceiling reads;
 * the two reproduction genes and the hue never enter it. */
function ceilingOverArea(organism: OrganismView): {
  readonly ratio: number;
  readonly reachSets: boolean;
} {
  const terms = birthCostCeilingTerms(
    {
      ...BASELINE_GENOME,
      cytoplasmRadius: organism.cytoplasmRadius,
      genes: organism.organelles,
    },
    DEFAULT_ROSTER,
  );

  return {
    ratio: Math.max(terms.area, terms.reach) / bodyArea(organism),
    reachSets: terms.reach > terms.area,
  };
}

/** `R_area` less the Reach, as ADR-0036 defines them: how far the farthest
 * organelle edge sticks out past the circle of cytoplasm plus organelle area.
 * Positive when the cytoplasm gene is inert. */
function reachExcess(organism: OrganismView): number {
  const organelleRadiiSquared = organism.organelles.reduce(
    (sum, gene) => sum + gene.radius * gene.radius,
    0,
  );
  const areaRadius = Math.sqrt(
    organism.cytoplasmRadius ** 2 + organelleRadiiSquared,
  );

  return reach(organism.organelles) - areaRadius;
}

function runNeuron(seed: number): NeuronRun {
  const samples: Sample[] = [];
  let minSize = Infinity;

  const finished = runTicksWatching(
    createWorld(seed),
    NEURON_TICKS,
    (world, tick) => {
      if (tick % NEURON_SAMPLE_EVERY !== 0) {
        return;
      }
      const population = getPopulation(world);
      let carriers = 0;
      let neurons = 0;
      let carrierRatioSum = 0;
      let plainRatioSum = 0;
      let reachDominated = 0;
      let reachExcessSum = 0;
      let carrierReachSet = 0;
      let plainReachSet = 0;
      for (const organism of population) {
        // M7's roster is the neuron alone, so every organelle is one.
        const count = organism.organelles.length;
        const {ratio, reachSets} = ceilingOverArea(organism);
        if (count > 0) {
          carriers++;
          neurons += count;
          carrierRatioSum += ratio;
          carrierReachSet += reachSets ? 1 : 0;
          const excess = reachExcess(organism);
          if (excess > 0) {
            reachDominated++;
            reachExcessSum += excess;
          }
        } else {
          plainRatioSum += ratio;
          plainReachSet += reachSets ? 1 : 0;
        }
      }
      minSize = Math.min(minSize, population.length);
      samples.push({
        tick,
        size: population.length,
        carriers,
        neurons,
        carrierRatioSum,
        plainRatioSum,
        reachDominated,
        reachExcessSum,
        carrierReachSet,
        plainReachSet,
      });
    },
  );

  return {
    seed,
    samples,
    minSize: Number.isFinite(minSize) ? minSize : 0,
    finalSize: getPopulation(finished).length,
    births: getCumulativeBirths(finished),
  };
}

export function measureNeuron(): NeuronRuns {
  return {cNeuron: C_NEURON, runs: seeds().map(runNeuron)};
}

/** What the harness uses of Node. Read through `globalThis`, as
 * `settings.ts` reads the environment, because the project carries no Node
 * typings and the simulation must stay runnable under any runtime. */
interface NodeProcess {
  readonly execPath: string;
  readonly env: Record<string, string | undefined>;
  readonly argv: readonly string[];
  getBuiltinModule(name: "node:child_process"): {
    execFile(
      file: string,
      args: readonly string[],
      options: {env: Record<string, string | undefined>; maxBuffer: number},
      callback: (error: Error | null, stdout: string) => void,
    ): void;
  };
}

export function nodeProcess(): NodeProcess {
  return (globalThis as unknown as {process: NodeProcess}).process;
}

/** The same measurement in a child process with `c_neuron` forced to 0. */
export function measureNeuronWithoutCost(): Promise<NeuronRuns> {
  const node = nodeProcess();

  return new Promise((resolve, reject) => {
    node.getBuiltinModule("node:child_process").execFile(
      node.execPath,
      [
        "--import",
        "./scripts/ts-esm-resolver.mjs",
        "scripts/neuron.ts",
        "--json",
      ],
      {
        env: {...node.env, ACQUARIO_C_NEURON: "0"},
        maxBuffer: 256 * 1024 * 1024,
      },
      (error, stdout) => {
        if (error) {
          reject(error);
        } else {
          resolve(JSON.parse(stdout) as NeuronRuns);
        }
      },
    );
  });
}

/** Mean over the seeds of `pick`, at each sample index. */
function overSeeds(
  runs: readonly NeuronRun[],
  pick: (sample: Sample) => number,
): readonly number[] {
  const length = Math.min(...runs.map((run) => run.samples.length));

  return Array.from(
    {length},
    (_unused, index) =>
      meanAndSigma(runs.map((run) => pick(run.samples[index]))).mean,
  );
}

function fraction(sample: Sample): number {
  return sample.size > 0 ? sample.carriers / sample.size : 0;
}

/** Neurons per carrier, pooled over the given samples rather than averaged
 * per sample: a sample with no carrier has no count to average, and a zero
 * in its place would drag the mean towards a carrier that is not there. */
function pooledPerCarrier(samples: readonly Sample[]): string {
  const carriers = samples.reduce((sum, sample) => sum + sample.carriers, 0);
  const neurons = samples.reduce((sum, sample) => sum + sample.neurons, 0);

  return carriers > 0 ? num(neurons / carriers, 3) : "—";
}

function secondHalf(run: NeuronRun): readonly Sample[] {
  return run.samples.slice(Math.floor(run.samples.length / 2));
}

/** Time-average over the run's second half, per seed: the first half's
 * drift away from the founders does not pollute it. */
function settled(run: NeuronRun, pick: (sample: Sample) => number): number {
  const half = secondHalf(run);

  return half.reduce((sum, sample) => sum + pick(sample), 0) / half.length;
}

function ceilingRatio(runs: readonly NeuronRun[], carriers: boolean): number {
  let sum = 0;
  let count = 0;
  for (const run of runs) {
    for (const sample of run.samples) {
      sum += carriers ? sample.carrierRatioSum : sample.plainRatioSum;
      count += carriers ? sample.carriers : sample.size - sample.carriers;
    }
  }

  return count > 0 ? sum / count : Number.NaN;
}

export function reportNeuron(costed: NeuronRuns, free: NeuronRuns): void {
  heading("The neuron, against a world where it costs nothing");
  note(
    `  Reference World, seeds ${seeds().join(", ")}, ${integer(NEURON_TICKS)} ticks, sampled every ${integer(NEURON_SAMPLE_EVERY)}.`,
  );
  note(
    `  c_neuron = ${num(costed.cNeuron)} (${num(costed.cNeuron / EXISTENCE_COST)}·c₀) against ${num(free.cNeuron)}, same seeds.`,
  );

  const costedFraction = overSeeds(costed.runs, fraction);
  const freeFraction = overSeeds(free.runs, fraction);

  const size = overSeeds(costed.runs, (sample) => sample.size);
  const freeSize = overSeeds(free.runs, (sample) => sample.size);
  const step = Math.max(1, Math.ceil(costedFraction.length / 12));
  const indices = costedFraction
    .map((_unused, index) => index)
    .filter(
      (index) => index % step === 0 || index === costedFraction.length - 1,
    );

  table(
    [
      "tick",
      "carriers",
      "no cost",
      "per carrier",
      "no cost",
      "size",
      "no cost",
    ],
    indices.map((index) => [
      integer(costed.runs[0].samples[index].tick),
      percent(costedFraction[index]),
      percent(freeFraction[index]),
      pooledPerCarrier(costed.runs.map((run) => run.samples[index])),
      pooledPerCarrier(free.runs.map((run) => run.samples[index])),
      num(size[index], 3),
      num(freeSize[index], 3),
    ]),
  );
  note("  (means over the seeds)");

  heading("Per seed, second-half average");
  table(
    [
      "seed",
      "carriers",
      "no cost",
      "per carrier",
      "no cost",
      "min size",
      "no cost",
      "births",
      "no cost",
    ],
    costed.runs.map((run, index) => [
      String(run.seed),
      percent(settled(run, fraction)),
      percent(settled(free.runs[index], fraction)),
      pooledPerCarrier(secondHalf(run)),
      pooledPerCarrier(secondHalf(free.runs[index])),
      integer(run.minSize),
      integer(free.runs[index].minSize),
      integer(run.births),
      integer(free.runs[index].births),
    ]),
  );
  const costedSettled = meanAndSigma(
    costed.runs.map((run) => settled(run, fraction)),
  );
  const freeSettled = meanAndSigma(
    free.runs.map((run) => settled(run, fraction)),
  );
  row(
    "carrier fraction, with cost",
    `${percent(costedSettled.mean)} ± ${percent(costedSettled.sigma)}`,
  );
  row(
    "carrier fraction, c_neuron = 0",
    `${percent(freeSettled.mean)} ± ${percent(freeSettled.sigma)}`,
  );
  row(
    "below the drift baseline by",
    `${(100 * (freeSettled.mean - costedSettled.mean)).toFixed(1)} points (σ of the pair ${(100 * Math.hypot(freeSettled.sigma, costedSettled.sigma)).toFixed(1)})`,
  );

  heading("What the ceiling costs: Birth Cost Ceiling over own body area");
  note(
    "  Over every living organism at every sample. M6's was (1+δ)² = 1.166.",
  );
  row("carriers", num(ceilingRatio(costed.runs, true)));
  row("non-carriers", num(ceilingRatio(costed.runs, false)));
  row("carriers, c_neuron = 0", num(ceilingRatio(free.runs, true)));
  row("non-carriers, c_neuron = 0", num(ceilingRatio(free.runs, false)));
}

function pooled(
  runs: readonly NeuronRun[],
  pick: (sample: Sample) => number,
): number {
  return runs.reduce(
    (sum, run) =>
      sum + run.samples.reduce((inner, sample) => inner + pick(sample), 0),
    0,
  );
}

function share(part: number, whole: number): string {
  return whole > 0 ? percent(part / whole) : "—";
}

/** What ADR-0036's body costs (#74): how often the Reach dominates, and which
 * term of the ceiling sets it. Over the costed world only. */
export function reportBody(costed: NeuronRuns): void {
  heading("What the body costs (ADR-0036)");
  note(
    "  Carriers only for the Reach; the ceiling's term split is over every organism. Excess is Reach − R_area, in length units.",
  );
  table(
    [
      "seed",
      "Reach > R_area",
      "mean excess",
      "carriers: reach term",
      "others: reach term",
    ],
    costed.runs.map((run) => {
      const carriers = pooled([run], (sample) => sample.carriers);
      const dominated = pooled([run], (sample) => sample.reachDominated);
      const plain = pooled([run], (sample) => sample.size - sample.carriers);

      return [
        String(run.seed),
        share(dominated, carriers),
        dominated > 0
          ? num(pooled([run], (sample) => sample.reachExcessSum) / dominated, 4)
          : "—",
        share(
          pooled([run], (sample) => sample.carrierReachSet),
          carriers,
        ),
        share(
          pooled([run], (sample) => sample.plainReachSet),
          plain,
        ),
      ];
    }),
  );

  const carriers = pooled(costed.runs, (sample) => sample.carriers);
  const dominated = pooled(costed.runs, (sample) => sample.reachDominated);
  const plain = pooled(costed.runs, (sample) => sample.size - sample.carriers);
  row("carriers with Reach > R_area", share(dominated, carriers));
  row(
    "mean excess over those",
    dominated > 0
      ? num(
          pooled(costed.runs, (sample) => sample.reachExcessSum) / dominated,
          4,
        )
      : "—",
  );
  row(
    "reach-set ceilings, carriers",
    share(
      pooled(costed.runs, (sample) => sample.carrierReachSet),
      carriers,
    ),
  );
  row(
    "reach-set ceilings, others",
    share(
      pooled(costed.runs, (sample) => sample.plainReachSet),
      plain,
    ),
  );
  row(
    "ceiling/area, carriers / others",
    `${num(ceilingRatio(costed.runs, true))} / ${num(ceilingRatio(costed.runs, false))}`,
  );
  row(
    "neuron carrier fraction, second half",
    percent(
      meanAndSigma(costed.runs.map((run) => settled(run, fraction))).mean,
    ),
  );
}
