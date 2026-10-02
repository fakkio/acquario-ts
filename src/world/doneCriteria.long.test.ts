import {beforeAll, describe, expect, it} from "vitest";

import {BASELINE_GENOME, type Genome} from "./genome";
import {type OrganismView} from "./organism";
import {
  FIXED_DT_MS,
  advance,
  createWorld,
  getCumulativeBirths,
  getCumulativeDeaths,
  getPopulation,
  type World,
} from "./world";

/**
 * Ticket #38, M5's own acceptance gate and the milestone's verdict: does
 * `bodyRadius` converge on the predicted `r_opt = 2·c₀/α` (ADR-0025), from
 * different seeds **and** different baseline genomes, or does it not?
 *
 * Fifteen worlds — five seeds across three baseline genomes straddling the
 * target (`r = 1.0`, today's `BASELINE_GENOME`; `1.5`, the target itself;
 * `2.5`, above it) — each run 100k ticks, unprimed, exactly as the app would
 * construct one via `WorldOptions.generation0.baselineGenome`. Two gates:
 * **accuracy** (every run within ±15% of `r_opt`) and **convergence** (the
 * spread of the fifteen run means smaller than the spread of the three
 * starting points) — the second is the one drift cannot fake, because
 * fifteen runs that never moved satisfy accuracy and fail it.
 *
 * **#36's own finding governs the expected outcome here, not just the
 * mechanism.** `r_max` and `tenancy` did not clear their gates under the
 * constants this branch commits (`AMBIENT_CO2_SHARE`'s comment in
 * `constants.ts`): `r_max = 2.59 ± 0.63` against a `≥ 3` floor, `tenancy =
 * 3.06` against a `≥ 5` floor. #36 declined ADR-0025's pre-authorised
 * fallback on a design-principle objection rather than force the gates
 * open. This suite runs anyway, as #38's own body asks for regardless of
 * how #36 landed — "if the population does not converge, that is a
 * publishable result" — and it is this suite, not #36's own gates, that
 * gets to say whether it did.
 *
 * **The measured verdict: it did not converge, because nothing survived
 * long enough to measure.** All fifteen runs — every seed, every baseline
 * — went extinct before tick 100k; none ever entered the last-10k-tick
 * window with a living population to sample. This is the sharper and
 * simpler failure #36's own `tenancy`/`r_max` shortfall predicted rather
 * than a surprise: an *unprimed* world (generation 0 at diffusive
 * equilibrium, exactly as the app constructs one, per this file's own
 * `runDoneCriteria`) is the harder case `reproduction.long.test.ts`'s own
 * primed gate exists to route around, and #36's own comment on
 * `AMBIENT_CO2_SHARE` names this file by number as "the ones to actually
 * check". Every one of these eighteen assertions is therefore expected to
 * fail on this branch's constants, and that failure **is** the recorded
 * verdict — see the comment on #32. This file is not left red by
 * accident and is not a target to make pass by loosening a gate (the
 * milestone's own instruction): the fix, if one is wanted, is a further
 * milestone re-opening `K_PHOTO`/`AMBIENT_CO2_SHARE`/priming policy, not a
 * wider band here.
 *
 * Measured wall-clock cost for the whole file: 888s (~14.8 minutes) for
 * all fifteen 100k-tick runs plus the four reporting tests, on this
 * ticket's own machine — the one place that number is written down, the
 * same convention `conservation.long.test.ts`'s #20 and
 * `reproduction.long.test.ts`'s #29 already use. Cheaper than either of
 * those per tick: every run here collapses to an empty, computationally
 * free population well before tick 100k, so most of each run's ticks cost
 * almost nothing.
 */
const TICKS = 100_000;
const WINDOW_TICKS = 10_000;
const SAMPLE_EVERY = 100;
const RUN_TIMEOUT_MS = 180_000;

// ADR-0025's target, fixed before any fertile world is run to judge it
// against (`constants.ts`'s own `EXISTENCE_COST` comment) — not
// recomputed from a freshly measured `α` here, because the prediction has
// to be the one number fixed in advance, not one re-derived from the very
// runs it is judged against.
const R_OPT = 1.5;
const ACCURACY_BAND = 0.15;

interface Baseline {
  readonly label: string;
  readonly genome: Genome;
}

// The three starting points ADR-0025 asks for: below the target (today's
// `BASELINE_GENOME`, unchanged), at it, and above it — the one above is the
// sharpest of the three, since drift has no reason to walk downhill.
const BASELINES: readonly Baseline[] = [
  {label: "r=1.0 (BASELINE_GENOME)", genome: BASELINE_GENOME},
  {label: "r=1.5 (target)", genome: {...BASELINE_GENOME, bodyRadius: 1.5}},
  {
    label: "r=2.5 (above target)",
    genome: {...BASELINE_GENOME, bodyRadius: 2.5},
  },
];

const SEEDS: readonly number[] = [7, 8, 9, 10, 11];

function meanOf(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Population standard deviation — the same shape `geneStatistics.ts` uses
 * for the HUD, reimplemented here rather than imported: the App layer reads
 * `src/world/`, never the other way round. */
function populationStdev(values: readonly number[]): number {
  const mean = meanOf(values);
  return Math.sqrt(
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length,
  );
}

function meanBodyRadius(population: readonly OrganismView[]): number {
  return meanOf(population.map((organism) => organism.bodyRadius));
}

interface DoneCriteriaRun {
  readonly seed: number;
  readonly baseline: Baseline;
  /** `null` when the window never sampled a living population — the
   * strongest form of "did not converge", not a value to paper over. */
  readonly radiusMean: number | null;
  readonly extinct: boolean;
  readonly finalPopulation: readonly OrganismView[];
  readonly cumulativeBirths: number;
  readonly cumulativeDeaths: number;
}

/**
 * One done-criteria run: `TICKS` ticks from an unprimed world seeded with
 * `baseline.genome`, sampling the population's mean `bodyRadius` every
 * `SAMPLE_EVERY` ticks inside the last `WINDOW_TICKS` — time-averaged
 * rather than read at tick 100k alone, so whoever happened to be born last
 * does not move the statistic (ADR-0025).
 */
function runDoneCriteria(seed: number, baseline: Baseline): DoneCriteriaRun {
  let world: World = createWorld(seed, {
    generation0: {baselineGenome: baseline.genome},
  });
  const windowStart = TICKS - WINDOW_TICKS;
  let sampleSum = 0;
  let sampleCount = 0;

  for (let tick = 1; tick <= TICKS; tick++) {
    ({world} = advance(world, FIXED_DT_MS));
    if (tick > windowStart && tick % SAMPLE_EVERY === 0) {
      const population = getPopulation(world);
      if (population.length > 0) {
        sampleSum += meanBodyRadius(population);
        sampleCount++;
      }
    }
  }

  const finalPopulation = getPopulation(world);

  return {
    seed,
    baseline,
    radiusMean: sampleCount > 0 ? sampleSum / sampleCount : null,
    extinct: finalPopulation.length === 0,
    finalPopulation,
    cumulativeBirths: getCumulativeBirths(world),
    cumulativeDeaths: getCumulativeDeaths(world),
  };
}

describe("the done-criteria runs, and the verdict on v0.1 (#38)", () => {
  let runs: DoneCriteriaRun[];

  beforeAll(
    () => {
      runs = [];
      for (const baseline of BASELINES) {
        for (const seed of SEEDS) {
          runs.push(runDoneCriteria(seed, baseline));
        }
      }
    },
    RUN_TIMEOUT_MS * BASELINES.length * SEEDS.length,
  );

  // Accuracy, per run — and an extinct run is asserted here, never
  // excluded: it fails the same test a run that converged to the wrong
  // radius would fail, exactly as ADR-0025's own instruction asks for.
  it.each(
    BASELINES.flatMap((baseline) =>
      SEEDS.map((seed) => ({label: baseline.label, seed})),
    ),
  )(
    "seed $seed, $label: bodyRadius converges within ±15% of r_opt=1.5",
    ({label, seed}) => {
      const run = runs.find(
        (candidate) =>
          candidate.seed === seed && candidate.baseline.label === label,
      );
      if (run === undefined) {
        throw new Error(
          "run missing from beforeAll — this is a bug in the test itself",
        );
      }

      expect(
        run.extinct,
        `seed ${String(seed)}, ${label}: population went extinct — an extinct run is a failed run, not an excluded one (ADR-0025)`,
      ).toBe(false);

      if (run.radiusMean === null) {
        throw new Error(
          `seed ${String(seed)}, ${label}: no living population was ever sampled inside the last ${String(WINDOW_TICKS)} ticks`,
        );
      }

      const relativeError = Math.abs(run.radiusMean - R_OPT) / R_OPT;
      expect(relativeError).toBeLessThanOrEqual(ACCURACY_BAND);
    },
  );

  // Every run's own outcome, printed unconditionally — the numbers a
  // reader needs to see regardless of how the gates above land, the same
  // standing `docs/agents/quality-gates.md` grants `scripts/calibrate.ts`'s
  // own printed output: "constructs worlds, runs them and prints what they
  // did". The gates carry the pass/fail signal; this carries the numbers.
  // Vitest hides a passing test's stdout under the default reporter — run
  // with `--reporter=verbose` to see these lines and the other two report
  // blocks below.
  it("prints every run's outcome", () => {
    for (const run of runs) {
      const radius =
        run.radiusMean === null ? "n/a" : run.radiusMean.toFixed(3);
      console.log(
        `seed=${String(run.seed)} ${run.baseline.label}: ${run.extinct ? "EXTINCT" : "survived"}, radiusMean=${radius}, births=${String(run.cumulativeBirths)}, deaths=${String(run.cumulativeDeaths)}, finalPopulation=${String(run.finalPopulation.length)}`,
      );
    }
  });

  // Convergence: the gate drift cannot fake. Computed over whichever runs
  // produced a mean at all — the accuracy assertions above already fail
  // individually for any run that did not, so this gate adds no exclusion
  // of its own. Guarded explicitly rather than left to fall out of
  // `NaN < x` being `false`: a run of runs with nothing to compare should
  // say so, not rely on floating-point comparison semantics to fail loudly
  // enough.
  it("the spread of the run means is smaller than the spread of the baselines they started from", () => {
    const means = runs
      .map((run) => run.radiusMean)
      .filter((mean): mean is number => mean !== null);
    const baselineRadii = BASELINES.map(
      (baseline) => baseline.genome.bodyRadius,
    );

    expect(
      means.length,
      "no run produced a bodyRadius mean at all — every run went extinct before the last-10k-tick window, so there is nothing to compare a spread against",
    ).toBeGreaterThan(0);
    expect(populationStdev(means)).toBeLessThan(populationStdev(baselineRadii));
  });

  // The other three genes: reported, not gated (ADR-0025) — printed
  // unconditionally, and asserted only for being real numbers whenever
  // there is a surviving run to compute them from. No survivors is not a
  // failure of *this* test — the accuracy tests above already carry that
  // verdict — so this one reports the fact and stops, exactly as
  // "reported, not gated" asks: nothing here can make the suite fail on
  // the strength of what the values *are*.
  it("reports mean and σ of mitosisEnergyThreshold and childAllocationRatio across the surviving runs, ungated", () => {
    const survivors = runs.filter((run) => !run.extinct);
    if (survivors.length === 0) {
      console.log(
        "mitosisEnergyThreshold / childAllocationRatio: no surviving run to report",
      );
      return;
    }

    const thresholds = survivors.flatMap((run) =>
      run.finalPopulation.map((organism) => organism.mitosisEnergyThreshold),
    );
    const allocations = survivors.flatMap((run) =>
      run.finalPopulation.map((organism) => organism.childAllocationRatio),
    );
    console.log(
      `mitosisEnergyThreshold: mean=${meanOf(thresholds).toFixed(3)} σ=${populationStdev(thresholds).toFixed(3)}`,
    );
    console.log(
      `childAllocationRatio: mean=${meanOf(allocations).toFixed(3)} σ=${populationStdev(allocations).toFixed(3)}`,
    );

    expect(Number.isFinite(meanOf(thresholds))).toBe(true);
    expect(Number.isFinite(populationStdev(thresholds))).toBe(true);
    expect(Number.isFinite(meanOf(allocations))).toBe(true);
    expect(Number.isFinite(populationStdev(allocations))).toBe(true);
  });

  // `lineageHue` is a neutral marker (GLOSSARY.md): it had better *not*
  // converge. A collapse toward one hue across independently seeded runs
  // would mean something is wrong with the mutation operator, not right
  // with selection — so this checks the opposite direction from every
  // other gate in this file. Same "report, don't gate on absence" shape as
  // the test above: no survivors means nothing to check, not a failure.
  it("does not converge lineageHue across the surviving runs", () => {
    const survivors = runs.filter((run) => !run.extinct);
    if (survivors.length === 0) {
      console.log("lineageHue: no surviving run to report");
      return;
    }

    const hues = survivors.flatMap((run) =>
      run.finalPopulation.map((organism) => organism.lineageHue),
    );
    console.log(`lineageHue: σ=${populationStdev(hues).toFixed(3)}`);

    // A genuinely uniform [0, 1) spread has σ ≈ 0.29; a collapsed one sits
    // near 0. 0.05 is comfortably below the former and comfortably above
    // sampling noise from a small population, so it separates "spread" from
    // "collapsed" without pretending to be a tight bound.
    expect(populationStdev(hues)).toBeGreaterThan(0.05);
  });
});
