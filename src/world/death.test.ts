import {describe, expect, it} from "vitest";

import {AQUARIUM_HEIGHT} from "./aquarium";
import {CARBON_BUDGET_BASELINE_ORGANISMS} from "./constants";
import {depositRemains, evaluateDeaths} from "./death";
import {buildUniformGrid} from "./grid";
import {
  initializeMetabolism,
  totalCarbon,
  totalOxygen,
  type Pools,
} from "./ledger";
import {applyBrownianMotion, constrainToAquarium} from "./motion";
import {bodyMass, createPopulation, type Organism} from "./organism";
import {createRngStream} from "./rng";
import {separateOverlaps} from "./separation";
import {organismAt, randomPopulation, runMetabolism, shuffle} from "./testing";

/**
 * Level 1: `evaluateDeaths` and `depositRemains` as the pure functions
 * ADR-0017 designs them to be — no world, no tick, just organisms and
 * pools. `world.test.ts`'s "mortality mode (M3)" block covers the same
 * behaviour wired into `runTick`; this file is where the deposit's own
 * promises — order independence above all — are collected.
 */

const EMPTY_POOLS: Pools = {food: 0, carbonDioxide: 0, oxygen: 0};

describe("evaluateDeaths", () => {
  it("condemns an organism at exactly zero energy", () => {
    const organism = organismAt(0, 0);
    organism.energy = 0;

    const {survivors, remains} = evaluateDeaths([organism]);

    expect(survivors).toHaveLength(0);
    expect(remains).toHaveLength(1);
  });

  it("condemns an organism with negative energy", () => {
    const organism = organismAt(0, 0);
    organism.energy = -0.5;

    const {survivors, remains} = evaluateDeaths([organism]);

    expect(survivors).toHaveLength(0);
    expect(remains).toHaveLength(1);
  });

  it("keeps an organism with positive energy among the survivors", () => {
    const organism = organismAt(0, 0);
    organism.energy = 1e-9;

    const {survivors, remains} = evaluateDeaths([organism]);

    expect(survivors).toEqual([organism]);
    expect(remains).toHaveLength(0);
  });

  it("freezes remains at the organism's current position, its three diffusible stores and its derived body mass", () => {
    const organism = organismAt(3, 7, 1.5);
    organism.energy = 0;
    organism.food = 0.4;
    organism.carbonDioxide = 0.2;
    organism.oxygen = 0.1;

    const {remains} = evaluateDeaths([organism]);

    expect(remains[0]).toEqual({
      x: 3,
      y: 7,
      food: 0.4,
      carbonDioxide: 0.2,
      oxygen: 0.1,
      bodyMass: bodyMass(organism),
    });
  });

  it("splits a mixed population into survivors and remains without reordering either", () => {
    const alive = organismAt(0, 0, 1, 1);
    const dead = organismAt(1, 1, 1, 2);
    alive.energy = 5;
    dead.energy = 0;

    const {survivors, remains} = evaluateDeaths([dead, alive]);

    expect(survivors).toEqual([alive]);
    expect(remains).toHaveLength(1);
    expect(remains[0].x).toBe(1);
  });
});

describe("depositRemains", () => {
  it("gains the pools exactly food + CO2 + O2 + body mass, leaving both ledger totals unchanged", () => {
    const organism = organismAt(0, 0, 1.2);
    organism.food = 0.4;
    organism.carbonDioxide = 0.25;
    organism.oxygen = 0.1;
    organism.energy = 0;
    const initialCarbon = totalCarbon([organism], EMPTY_POOLS);
    const initialOxygen = totalOxygen([organism], EMPTY_POOLS);

    const {remains} = evaluateDeaths([organism]);
    const pools = depositRemains(EMPTY_POOLS, remains);

    expect(pools.food).toBeCloseTo(organism.food + bodyMass(organism), 12);
    expect(pools.carbonDioxide).toBeCloseTo(organism.carbonDioxide, 12);
    expect(pools.oxygen).toBeCloseTo(organism.oxygen, 12);
    expect(totalCarbon([], pools)).toBeCloseTo(initialCarbon, 12);
    expect(totalOxygen([], pools)).toBeCloseTo(initialOxygen, 12);
  });

  it("leaves the pools untouched when nothing died", () => {
    const pools = depositRemains(EMPTY_POOLS, []);

    expect(pools).toEqual(EMPTY_POOLS);
  });

  it("sums several remains into the pools", () => {
    const a = organismAt(0, 0, 1);
    const b = organismAt(0, 0, 1);
    a.food = 0.1;
    a.carbonDioxide = 0.2;
    a.oxygen = 0.3;
    b.food = 0.4;
    b.carbonDioxide = 0.5;
    b.oxygen = 0.6;
    a.energy = 0;
    b.energy = 0;

    const {remains} = evaluateDeaths([a, b]);
    const pools = depositRemains(EMPTY_POOLS, remains);

    expect(pools.food).toBeCloseTo(
      a.food + b.food + bodyMass(a) + bodyMass(b),
      12,
    );
    expect(pools.carbonDioxide).toBeCloseTo(
      a.carbonDioxide + b.carbonDioxide,
      12,
    );
    expect(pools.oxygen).toBeCloseTo(a.oxygen + b.oxygen, 12);
  });

  // ADR-0017's order-independence guarantee, exercised head-on: a
  // population in which at least two organisms die on the same tick,
  // shuffled, has to deposit bit-identical pools either way — the one
  // thing left to `runTick` alone would only start failing the tick a run
  // happens to bury two organisms together.
  it("leaves the pools bit-identical whatever order the dying population is held in", () => {
    // Every organism dies, each with its own distinct, deterministic stores
    // — irregular enough that summing them in a different order would move
    // the last bit if the deposit were not sorted first.
    const seedDead = () => {
      const population = randomPopulation(17, 12);
      population.forEach((organism, i) => {
        organism.energy = 0;
        organism.food = Math.sin(i + 1) ** 2;
        organism.carbonDioxide = Math.sin(i + 2) ** 2;
        organism.oxygen = Math.sin(i + 3) ** 2;
      });
      return population;
    };

    const inOrder = seedDead();
    const reference = seedDead();
    const shuffled = shuffle([...reference], createRngStream(99));

    const remainsInOrder = evaluateDeaths(inOrder).remains;
    const remainsShuffled = evaluateDeaths(shuffled).remains;

    expect(shuffled).not.toEqual(reference);
    const poolsInOrder = depositRemains(EMPTY_POOLS, remainsInOrder);
    const poolsShuffled = depositRemains(EMPTY_POOLS, remainsShuffled);

    expect(poolsShuffled).toEqual(poolsInOrder);
  });
});

/**
 * Level 3: the milestone's acceptance run. A population placed deep enough
 * that light is negligible — `docs/vision.md`'s "at y ≈ 40, I(y) is about
 * 1e-4, so maintenance wins every time" — ticked with the world's own parts
 * (`runMetabolism` from `testing.ts`, motion, separation, the death step)
 * until every organism is gone, exactly the house pattern `world.test.ts`
 * already uses to exercise a full tick without `createWorld`. No light
 * override: depth alone is what starves this population.
 *
 * Measured at 269 ticks to extinction, well under a couple of seconds
 * (single-digit milliseconds on its own), so it stays in the default
 * suite rather than `*.long.test.ts` — see `docs/agents/quality-gates.md`
 * for the suite-placement rule this measurement feeds.
 */
describe("death: extinction acceptance run", () => {
  const SEED = 71;
  // Comfortably inside the walls for every radius the population can draw,
  // and deep enough that `docs/vision.md`'s claim about y ≈ 40 holds.
  const DEEP_Y = AQUARIUM_HEIGHT - 2;
  const MAX_TICKS = 20_000;

  function tickOnce(
    population: readonly Organism[],
    pools: Pools,
  ): {population: readonly Organism[]; pools: Pools} {
    const afterMetabolism = runMetabolism(population, pools);
    for (const organism of population) {
      applyBrownianMotion(organism);
    }
    const {survivors, remains} = evaluateDeaths(population);
    // Step 10 runs over the *whole* tick's population, condemned included
    // (ADR-0017): a dying organism still gets separated and moves on its
    // final tick.
    separateOverlaps(population, buildUniformGrid(population));
    for (const organism of population) {
      constrainToAquarium(organism);
    }
    const afterDeaths = depositRemains(afterMetabolism, remains);

    return {population: survivors, pools: afterDeaths};
  }

  // Built from `createPopulation`, the way `referencePopulationFor` in
  // `world.test.ts` builds generation 0 for its own tests — every organism
  // placed at `DEEP_Y` instead of scattered by depth, so light is
  // negligible for the whole population rather than only for some of it.
  function buildDeepPopulation(): Organism[] {
    const {population} = createPopulation(createRngStream(SEED));
    for (const organism of population) {
      organism.y = DEEP_Y;
    }
    return population;
  }

  it("ticks a deep, dark population to extinction and returns exactly the carbon budget to the pools", () => {
    let population: readonly Organism[] = buildDeepPopulation();
    let pools = initializeMetabolism(population);
    const initialOxygen = totalOxygen(population, pools);

    let ticksToExtinction = 0;
    while (population.length > 0 && ticksToExtinction < MAX_TICKS) {
      ({population, pools} = tickOnce(population, pools));
      ticksToExtinction++;
    }

    expect(population).toHaveLength(0);
    expect(ticksToExtinction).toBeLessThan(MAX_TICKS);

    const expectedCarbon = CARBON_BUDGET_BASELINE_ORGANISMS * Math.PI;
    const carbonDrift =
      Math.abs(totalCarbon(population, pools) - expectedCarbon) /
      expectedCarbon;
    expect(carbonDrift).toBeLessThan(1e-9);

    const oxygenDrift =
      Math.abs(totalOxygen(population, pools) - initialOxygen) / initialOxygen;
    expect(oxygenDrift).toBeLessThan(1e-9);

    // After extinction, 1000 further ticks move nothing: an empty
    // population has nothing left to exchange, photosynthesise, respire,
    // maintain or condemn.
    const poolsAtExtinction = pools;
    for (let tick = 0; tick < 1000; tick++) {
      ({population, pools} = tickOnce(population, pools));
    }
    expect(pools).toEqual(poolsAtExtinction);
  });
});
