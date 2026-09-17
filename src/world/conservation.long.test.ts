import {beforeAll, describe, expect, it} from "vitest";

import {capFor} from "./organism";
import {
  FIXED_DT_MS,
  advance,
  createWorld,
  getCarbonDrift,
  getMeasuredAlpha,
  getOxygenDrift,
  getPoolLevels,
  getPopulation,
  hashState,
  type World,
} from "./world";

/**
 * Ticket #20, M2's acceptance gate: the full tick pipeline — motion, grid,
 * separation, every metabolic step — run for the length `docs/vision.md`
 * names as the done-criterion. A run this long is the point: every earlier
 * M2 ticket asserts conservation over a run of its own (`world.test.ts`'s
 * "carbon ledger (M2)" 2000-tick check is the short one that still runs at
 * every commit), and this is where that invariant meets the actual length
 * the milestone promises it for.
 *
 * Lives in its own long suite (`vitest.long.config.ts`, `npm run
 * test:long`) rather than the suite that runs at every commit: one 100k-tick
 * run measured at roughly 6-9s on its own during this ticket (this file's
 * whole suite runs the pipeline twice, for the determinism check below, at
 * roughly 18s total), well past the "a few seconds" line the ticket draws.
 * This is the one place that number is written down — see
 * `docs/agents/quality-gates.md` for the suite-placement decision it fed.
 */
const TICKS = 100_000;
const SEED = 7;

// Sampled every 1000 ticks, past a 5000-tick startup transient, so the
// settling assertion below reads the run's steady behaviour rather than
// its opening climb away from tick 0's diffusive equilibrium.
const SAMPLE_EVERY = 1000;
const WARMUP_TICKS = 5000;

interface AlphaSample {
  readonly tick: number;
  readonly alpha: number;
}

interface LongRun {
  readonly hash: string;
  readonly carbonDrift: number;
  readonly oxygenDrift: number;
  readonly pools: ReturnType<typeof getPoolLevels>;
  readonly population: ReturnType<typeof getPopulation>;
  readonly alphaSamples: readonly AlphaSample[];
}

// Run in the immortal world explicitly (ADR-0017): this gate is M2's, and
// it keeps running in a world with no death code in it at all, regardless
// of what M3 makes the default elsewhere.
function runLong(seed: number): LongRun {
  let world: World = createWorld(seed, {mortality: "off"});
  const alphaSamples: AlphaSample[] = [];

  for (let tick = 1; tick <= TICKS; tick++) {
    ({world} = advance(world, FIXED_DT_MS));
    if (tick >= WARMUP_TICKS && tick % SAMPLE_EVERY === 0) {
      alphaSamples.push({tick, alpha: getMeasuredAlpha(world)});
    }
  }

  return {
    hash: hashState(world),
    carbonDrift: getCarbonDrift(world),
    oxygenDrift: getOxygenDrift(world),
    pools: getPoolLevels(world),
    population: getPopulation(world),
    alphaSamples,
  };
}

function meanAlpha(samples: readonly AlphaSample[]): number {
  return samples.reduce((sum, s) => sum + s.alpha, 0) / samples.length;
}

describe("conservation over 100k ticks (#20)", () => {
  let run: LongRun;

  beforeAll(() => {
    run = runLong(SEED);
  });

  // The measured tolerance: every shorter M2 conservation run (2000 ticks
  // in `world.test.ts`, 3000 in the passive-exchange and starvation-recovery
  // tests) already holds drift under 1e-9, and this run's drift comes out
  // at the same order — see this ticket's recorded numbers — so the same
  // bound is used here rather than a looser one chosen for a longer run.
  it("conserves total carbon within 1e-9 relative drift", () => {
    expect(Math.abs(run.carbonDrift)).toBeLessThan(1e-9);
  });

  it("conserves total oxygen within 1e-9 relative drift", () => {
    expect(Math.abs(run.oxygenDrift)).toBeLessThan(1e-9);
  });

  it("drains no pool to zero", () => {
    expect(run.pools.food).toBeGreaterThan(0);
    expect(run.pools.carbonDioxide).toBeGreaterThan(0);
    expect(run.pools.oxygen).toBeGreaterThan(0);
  });

  // The legibility half of the done-criterion (see the ticket): a world
  // that conserves perfectly while pegged at an extreme passes the
  // invariant and fails the milestone.
  it("leaves the population neither uniformly at zero energy nor uniformly at cap", () => {
    const zeroEnergyCount = run.population.filter(
      (organism) => organism.energy === 0,
    ).length;
    const atCapCount = run.population.filter(
      (organism) => organism.energy >= capFor(organism, "energy"),
    ).length;

    expect(zeroEnergyCount).toBeGreaterThan(0);
    expect(zeroEnergyCount).toBeLessThan(run.population.length);
    expect(atCapCount).toBeLessThan(run.population.length);
  });

  // "Settles rather than trends": the population mean of ADR-0015's
  // measured `α`, averaged over the run's later half against its earlier
  // half (both past the startup transient), stays close rather than
  // climbing or sliding — a trend would mean the world was still moving
  // toward some other state at tick 100k, not sitting in one.
  it("settles the measured alpha rather than trending it", () => {
    const mid = Math.floor(run.alphaSamples.length / 2);
    const firstHalf = meanAlpha(run.alphaSamples.slice(0, mid));
    const secondHalf = meanAlpha(run.alphaSamples.slice(mid));

    expect(Math.abs(secondHalf - firstHalf) / firstHalf).toBeLessThan(0.3);
  });

  it("reaches the same hash at tick 100k for the same seed", () => {
    const repeat = runLong(SEED);
    expect(repeat.hash).toBe(run.hash);
  }, 30_000);
});
