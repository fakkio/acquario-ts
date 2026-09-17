import {describe, expect, it} from "vitest";

import {AQUARIUM_AREA} from "./aquarium";
import {AMBIENT_CO2_SHARE, CARBON_BUDGET_BASELINE_ORGANISMS} from "./constants";
import {
  foldPools,
  initializeMetabolism,
  totalCarbon,
  totalOxygen,
  type Pools,
} from "./ledger";
import {bodyArea, capFor} from "./organism";
import {organismAt} from "./testing";

// A hand-picked crowd rather than `randomPopulation`: the closed-form
// derivation is tested against numbers a reader can check on paper, not
// against generation 0's actual radius spread (that equivalence is
// `world.test.ts`'s job, at the top seam).
const fixturePopulation = () => [
  organismAt(5, 5, 1),
  organismAt(10, 10, 2),
  organismAt(15, 15, 1.5),
];

describe("initializeMetabolism", () => {
  it("lands total carbon exactly on the requested budget", () => {
    const population = fixturePopulation();
    const pools = initializeMetabolism(population);

    expect(totalCarbon(population, pools)).toBeCloseTo(
      CARBON_BUDGET_BASELINE_ORGANISMS * Math.PI,
      9,
    );
  });

  it("needs no iteration: the same population and budget always land on the same pools", () => {
    const pools1 = initializeMetabolism(fixturePopulation());
    const pools2 = initializeMetabolism(fixturePopulation());

    expect(pools1).toEqual(pools2);
  });

  it("starts every organism's diffusible stores at exactly ambient concentration", () => {
    const population = fixturePopulation();
    const pools = initializeMetabolism(population);

    for (const organism of population) {
      const area = bodyArea(organism);
      expect(organism.food / area).toBeCloseTo(pools.food / AQUARIUM_AREA, 12);
      expect(organism.carbonDioxide / area).toBeCloseTo(
        pools.carbonDioxide / AQUARIUM_AREA,
        12,
      );
      expect(organism.oxygen / area).toBeCloseTo(
        pools.oxygen / AQUARIUM_AREA,
        12,
      );
    }
  });

  it("splits ambient carbon in favour of CO2 over food", () => {
    const pools = initializeMetabolism(fixturePopulation());

    expect(pools.carbonDioxide).toBeGreaterThan(pools.food);
    expect(AMBIENT_CO2_SHARE).toBeGreaterThan(0.5);
  });

  it("starts every organism's energy at exactly half its cap", () => {
    const population = fixturePopulation();
    initializeMetabolism(population);

    for (const organism of population) {
      expect(organism.energy).toBeCloseTo(capFor(organism, "energy") / 2, 12);
    }
  });
});

describe("totalCarbon and totalOxygen", () => {
  const emptyPools: Pools = {food: 0, carbonDioxide: 0, oxygen: 0};

  it("are pure readouts that never throw, even against an empty world", () => {
    expect(() => {
      totalCarbon([], emptyPools);
    }).not.toThrow();
    expect(() => {
      totalOxygen([], emptyPools);
    }).not.toThrow();
    expect(totalCarbon([], emptyPools)).toBe(0);
    expect(totalOxygen([], emptyPools)).toBe(0);
  });

  it("counts an organism's body mass as carbon even with empty stores", () => {
    const organism = organismAt(0, 0, 2);

    expect(totalCarbon([organism], emptyPools)).toBeCloseTo(
      bodyArea(organism),
      12,
    );
  });

  it("counts CO2 on both the carbon and the oxygen totals", () => {
    const organism = organismAt(0, 0, 1);
    organism.carbonDioxide = 3;
    const pools: Pools = {food: 0, carbonDioxide: 0, oxygen: 0};

    expect(totalCarbon([organism], pools)).toBeCloseTo(
      bodyArea(organism) + 3,
      12,
    );
    expect(totalOxygen([organism], pools)).toBeCloseTo(3, 12);
  });
});

describe("foldPools", () => {
  it("folds identical pools to the same value", () => {
    const pools: Pools = {food: 1, carbonDioxide: 2, oxygen: 3};

    expect(foldPools(0, pools)).toBe(foldPools(0, {...pools}));
  });

  it.each([
    ["food", {food: 1.0000001}],
    ["carbon dioxide", {carbonDioxide: 2.0000001}],
    ["oxygen", {oxygen: 3.0000001}],
  ])("changes when %s changes", (_field, change) => {
    const base: Pools = {food: 1, carbonDioxide: 2, oxygen: 3};

    expect(foldPools(0, {...base, ...change})).not.toBe(foldPools(0, base));
  });
});
