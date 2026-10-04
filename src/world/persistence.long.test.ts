import {describe, expect, it} from "vitest";

import {
  FIXED_DT_MS,
  advance,
  createWorld,
  getPopulation,
  type World,
} from "./world";

/**
 * Ticket #56, M6's invariant: **Persistence** (ADR-0027), the standing gate
 * every milestone from v0.2's first on holds, like conservation.
 *
 * It runs the milestone's **Reference World**: `createWorld` with its
 * defaults — the Baseline Genome, the committed constants, mortality and
 * fertility on — and **unprimed**, so it judges the world the app actually
 * constructs rather than one topped up by hand the way
 * `reproduction.long.test.ts` primes its own. Seeds 7–11, the same five as
 * #40's experiment and the done-criteria runs (`npm run done-criteria`).
 *
 * It asserts one thing only: a living population at tick 100k in every
 * seed. There is no floor on the population's size on purpose. Abundance
 * is M12's business, and a floor here would be a number with no target
 * behind it. Each seed's minimum and final population size are printed
 * instead, ungated, so a world that barely persisted is visible even
 * though it passes. Printing alongside the assertion, never instead of it
 * (`docs/agents/quality-gates.md`).
 *
 * This is one of persistence's two levels. The other, the absence of a
 * cost bias over committed births, is the unbiased-sample test under
 * `mitosis.test.ts`'s "the Worst-Case Birth Gate". A living population
 * alone is a weak gate, since a world can persist inside the Birth Sieve
 * at a shrunken radius (ADR-0027).
 */
// Roughly 83s for this file's five runs, 11–37s each, measured on #56's
// own machine and written down here as the other long tests record their
// own cost. A second run sharing the machine with other work took 108s,
// hence a per-seed timeout well above the slowest seed. When it was
// measured every seed persisted, but none comfortably: minimum population
// sizes of 4–9 out of 40 founders, final sizes of 37–62.
// M7 (#63) runs it on the neuron roster, with `M_max = 1` and `r_new = 0.02`
// (`constants.ts`): minimum sizes of 4–9, final sizes of 19–24. At the
// ceiling #58 started from, `M_max = 2` and `r_new = 0.05`, no seed bred
// once and all five went extinct.
const TICKS = 100_000;
const SEEDS: readonly number[] = [7, 8, 9, 10, 11];
const RUN_TIMEOUT_MS = 120_000;

interface PersistenceRun {
  readonly minPopulationSize: number;
  readonly finalPopulationSize: number;
}

function runReferenceWorld(seed: number): PersistenceRun {
  let world: World = createWorld(seed);
  let minPopulationSize = getPopulation(world).length;

  for (let tick = 1; tick <= TICKS; tick++) {
    ({world} = advance(world, FIXED_DT_MS));
    minPopulationSize = Math.min(
      minPopulationSize,
      getPopulation(world).length,
    );
  }

  return {minPopulationSize, finalPopulationSize: getPopulation(world).length};
}

describe("persistence on the Reference World over 100k ticks (#56)", () => {
  it.each(SEEDS)(
    "seed %i ends with a living population",
    (seed) => {
      const run = runReferenceWorld(seed);
      console.log(
        `persistence seed ${String(seed)}: min population size ${String(run.minPopulationSize)}, final population size ${String(run.finalPopulationSize)}`,
      );

      expect(run.finalPopulationSize).toBeGreaterThan(0);
    },
    RUN_TIMEOUT_MS,
  );
});
