import {
  BASELINE_GENOME,
  createWorld,
  getCumulativeBirths,
  getCumulativeDeaths,
  getPopulation,
  type Genome,
  type OrganismView,
} from "../../src/world";
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
import {runTicksWatching} from "./worlds";

/**
 * ADR-0025's done-criteria runs, as a report: does `bodyRadius` converge on
 * the predicted `r_opt = 2·c₀/α`, from different seeds **and** different
 * baseline genomes, or does it not?
 *
 * Until ADR-0027 this was a long-suite file, red on purpose, recording
 * v0.1's verdict (ADR-0026: all fifteen runs extinct before the window).
 * ADR-0027 made it a reported measurement instead, because `r_opt` is a
 * closed form the organelles retire, and v0.2 should not be gated on it. So
 * it prints its verdict as text and never fails, like the rest of the
 * harness (ADR-0024).
 *
 * **The protocol is ADR-0025's, unchanged, and not overridable.** No
 * `CALIBRATE_*` setting reaches it: a report that could be shortened to 20k
 * ticks would still print "accuracy: FAIL" under the same heading, and the
 * reader would have to check the header to learn it was a different
 * measurement. `ACQUARIO_*` overrides still apply, because those change the
 * world being judged rather than the judging, and the header says which are
 * in force. (The header is the harness's shared one: its generation-0 area
 * and `s/ρ` are read off `CALIBRATE_SEED`'s world at the default baseline,
 * which is seed 7's `r=1.0` run here unless overridden.)
 *
 * Fifteen worlds, five seeds by three baselines straddling the target, each
 * run 100k ticks unprimed, exactly as the app would construct one through
 * `WorldOptions.generation0.baselineGenome`.
 *
 * Measured wall-clock for all fifteen on v0.1's law: 8m10s on #54's own
 * machine, the first few minutes shared with a stray second run, so an
 * upper bound, with every run extinct by tick 37k. On the gated world: 88s
 * on #57's own machine, with nothing else running, fourteen of fifteen runs
 * alive at 100k and final populations of 12–62.
 */

const TICKS = 100_000;
const WINDOW_TICKS = 10_000;
const WINDOW_SAMPLE_EVERY = 100;
const TRAJECTORY_EVERY = 10_000;

/** ADR-0025's target, fixed before any fertile world was run to judge it
 * against. Not recomputed from a freshly measured `α`: the prediction has
 * to be the one number fixed in advance. */
const R_OPT = 1.5;
const ACCURACY_BAND = 0.15;

const SEEDS: readonly number[] = [7, 8, 9, 10, 11];

interface Baseline {
  readonly label: string;
  readonly genome: Genome;
}

/** Below the target (today's `BASELINE_GENOME`, unchanged), at it, and
 * above it. The one above is the sharpest of the three, since drift has no
 * reason to walk downhill. */
const BASELINES: readonly Baseline[] = [
  {label: "r=1.0", genome: BASELINE_GENOME},
  {label: "r=1.5", genome: {...BASELINE_GENOME, bodyRadius: 1.5}},
  {label: "r=2.5", genome: {...BASELINE_GENOME, bodyRadius: 2.5}},
];

interface DoneCriteriaRun {
  readonly seed: number;
  readonly baseline: Baseline;
  /** The population's mean `bodyRadius`, time-averaged over the last
   * `WINDOW_TICKS`. `null` when the window never sampled a living
   * population: the strongest form of "did not converge", not a value to
   * paper over. */
  readonly windowMean: number | null;
  /** The population's mean `bodyRadius` at every `TRAJECTORY_EVERY`-th
   * tick, `null` where it was empty — so "still rising at 100k" can be told
   * from "stalled away from the target". */
  readonly trajectory: readonly (number | null)[];
  /** The first tick the population was empty, or `null` if it never was. */
  readonly extinctAt: number | null;
  readonly finalPopulation: readonly OrganismView[];
  readonly births: number;
  readonly deaths: number;
}

function meanBodyRadius(population: readonly OrganismView[]): number | null {
  if (population.length === 0) {
    return null;
  }

  return (
    population.reduce((sum, organism) => sum + organism.bodyRadius, 0) /
    population.length
  );
}

function runDoneCriteria(seed: number, baseline: Baseline): DoneCriteriaRun {
  const world = createWorld(seed, {
    generation0: {baselineGenome: baseline.genome},
  });
  const windowStart = TICKS - WINDOW_TICKS;
  const trajectory: (number | null)[] = [];
  let windowSum = 0;
  let windowCount = 0;
  let extinctAt: number | null = null;

  const finished = runTicksWatching(world, TICKS, (current, tick) => {
    const population = getPopulation(current);
    if (extinctAt === null && population.length === 0) {
      extinctAt = tick;
    }
    if (tick % TRAJECTORY_EVERY === 0) {
      trajectory.push(meanBodyRadius(population));
    }
    if (tick > windowStart && tick % WINDOW_SAMPLE_EVERY === 0) {
      const mean = meanBodyRadius(population);
      if (mean !== null) {
        windowSum += mean;
        windowCount++;
      }
    }
  });

  return {
    seed,
    baseline,
    windowMean: windowCount > 0 ? windowSum / windowCount : null,
    trajectory,
    extinctAt,
    finalPopulation: getPopulation(finished),
    births: getCumulativeBirths(finished),
    deaths: getCumulativeDeaths(finished),
  };
}

/** Accurate when the run produced a window mean within the band. An extinct
 * run, or one with no living population in the window, is a failed run,
 * never an excluded one: excluding it would let a calibration pass by
 * killing off the worlds that disagreed (ADR-0025). */
function isAccurate(run: DoneCriteriaRun): boolean {
  return (
    run.extinctAt === null &&
    run.windowMean !== null &&
    Math.abs(run.windowMean - R_OPT) / R_OPT <= ACCURACY_BAND
  );
}

function passFail(pass: boolean): string {
  return pass ? "PASS" : "FAIL";
}

function radiusOrDash(radius: number | null): string {
  return radius === null ? "—" : num(radius, 3);
}

function reportRuns(runs: readonly DoneCriteriaRun[]): void {
  heading("Every run's outcome");
  table(
    [
      "seed",
      "baseline",
      "outcome",
      "births",
      "deaths",
      "final pop",
      "window mean r",
      "accurate",
    ],
    runs.map((run) => [
      String(run.seed),
      run.baseline.label,
      run.extinctAt === null
        ? "survived"
        : `extinct at ${integer(run.extinctAt)}`,
      integer(run.births),
      integer(run.deaths),
      integer(run.finalPopulation.length),
      radiusOrDash(run.windowMean),
      passFail(isAccurate(run)),
    ]),
  );

  heading(
    `Mean bodyRadius every ${integer(TRAJECTORY_EVERY)} ticks (— where extinct)`,
  );
  table(
    [
      "seed",
      "baseline",
      ...Array.from(
        {length: TICKS / TRAJECTORY_EVERY},
        (_unused, index) =>
          `${String(((index + 1) * TRAJECTORY_EVERY) / 1000)}k`,
      ),
    ],
    runs.map((run) => [
      String(run.seed),
      run.baseline.label,
      ...run.trajectory.map(radiusOrDash),
    ]),
  );
}

function reportCriteria(runs: readonly DoneCriteriaRun[]): void {
  heading("The two criteria (ADR-0025), reported, not gated (ADR-0027)");

  const accurate = runs.filter(isAccurate).length;
  row(
    "accuracy",
    `${passFail(accurate === runs.length)}  (${String(accurate)} of ${String(runs.length)} runs within ±${percent(ACCURACY_BAND)} of r_opt = ${num(R_OPT, 2)})`,
  );

  // Convergence is the criterion drift cannot fake: fifteen runs that never
  // moved satisfy accuracy and fail this. Its spread is computed over the
  // runs that produced a window mean, but an extinct run fails the criterion
  // outright rather than dropping out of it, even one that died inside the
  // window with a mean already sampled. The long-suite file this replaces
  // let extinct runs fail through accuracy alone; ADR-0025's "a failed run,
  // not an excluded one" is about the verdict, and a convergence PASS over
  // the survivors would be exactly the exclusion it forbids.
  const means = runs
    .map((run) => run.windowMean)
    .filter((mean): mean is number => mean !== null);
  const runSpread = meanAndSigma(means).sigma;
  const baselineSpread = meanAndSigma(
    BASELINES.map((baseline) => baseline.genome.bodyRadius),
  ).sigma;
  const extinct = runs.filter((run) => run.extinctAt !== null).length;
  const converged =
    extinct === 0 && means.length > 0 && runSpread < baselineSpread;
  row(
    "convergence",
    `${passFail(converged)}  (σ of run means ${means.length > 0 ? num(runSpread, 3) : "n/a"} against σ of baselines ${num(baselineSpread, 3)})`,
  );
  if (extinct > 0) {
    row(
      "extinct runs",
      `${String(extinct)}, each a failed run, not an excluded one`,
    );
  }
}

function reportOtherGenes(runs: readonly DoneCriteriaRun[]): void {
  heading("The other genes, across the surviving runs' final populations");
  note(
    "  Reported, not gated (ADR-0025): no closed-form prediction to judge them against.",
  );

  const survivors = runs
    .filter((run) => run.extinctAt === null)
    .flatMap((run) => run.finalPopulation);
  if (survivors.length === 0) {
    row("surviving runs", "none — nothing to report");

    return;
  }

  const thresholds = meanAndSigma(
    survivors.map((organism) => organism.mitosisEnergyThreshold),
  );
  const allocations = meanAndSigma(
    survivors.map((organism) => organism.childAllocationRatio),
  );
  row(
    "mitosisEnergyThreshold",
    `${num(thresholds.mean, 3)} ± ${num(thresholds.sigma, 2)}`,
  );
  row(
    "childAllocationRatio",
    `${num(allocations.mean, 3)} ± ${num(allocations.sigma, 2)}`,
  );
  // `lineageHue` is a neutral marker and had better *not* converge: a
  // uniform [0, 1) spread has σ ≈ 0.29, a collapsed one sits near 0.
  row(
    "lineageHue σ",
    `${num(meanAndSigma(survivors.map((organism) => organism.lineageHue)).sigma, 3)}  (uniform: ≈ 0.289; collapsed: ≈ 0)`,
  );
}

export function reportDoneCriteria(): void {
  heading("The done-criteria runs (ADR-0025)");
  note(
    `  Seeds ${SEEDS.join(", ")} × baselines ${BASELINES.map((baseline) => baseline.label).join(", ")}, ${integer(TICKS)} ticks each, unprimed.`,
  );
  note(
    `  Window: the last ${integer(WINDOW_TICKS)} ticks, sampled every ${String(WINDOW_SAMPLE_EVERY)}. Target r_opt = ${num(R_OPT, 2)} ± ${percent(ACCURACY_BAND)}.`,
  );

  const runs = BASELINES.flatMap((baseline) =>
    SEEDS.map((seed) => runDoneCriteria(seed, baseline)),
  );

  reportRuns(runs);
  reportCriteria(runs);
  reportOtherGenes(runs);
}
