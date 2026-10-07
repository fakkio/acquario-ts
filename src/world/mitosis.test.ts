import {describe, expect, it} from "vitest";

import {MITOSIS_ENERGY_COST, RHO} from "./constants";
import {evaluateDeaths} from "./death";
import {
  BASELINE_GENOME,
  birthCostCeiling,
  deriveBody,
  mutateGenome,
  type Genome,
} from "./genome";
import {totalCarbon, totalOxygen, type Pools} from "./ledger";
import {applyMaintenance} from "./metabolism";
import {
  appendBirths,
  birthCosts,
  evaluateMitosis,
  mintBirths,
  type PendingBirth,
} from "./mitosis";
import {
  Organism,
  bodyArea,
  bodyAreaOfRadius,
  capFor,
  capForArea,
} from "./organism";
import {createRngStream, deriveChildStream} from "./rng";
import {carrierAt, openDraws, organismAt} from "./testing";

/**
 * `evaluateMitosis` (step 7) and `appendBirths` (step 12) as the pure
 * functions ADR-0019 designs them to be — no world, no tick. `world.test.ts`'s
 * "fertility mode (M4)" block covers the same behaviour wired into
 * `runTick`; this file is where mitosis's own promises — the draw order
 * above all — are collected, the same split `death.test.ts` already draws
 * for step 8 and step 11.
 */

const EMPTY_POOLS: Pools = {food: 0, carbonDioxide: 0, oxygen: 0};

/** A genome that always clears the threshold gate and always splits its
 * remainder evenly, so a test can focus on whichever draw or cost it is
 * actually about. */
function eagerGenome(cytoplasmRadius = 1): Genome {
  return {
    ...BASELINE_GENOME,
    cytoplasmRadius,
    mitosisEnergyThreshold: 0,
    childAllocationRatio: 0.5,
  };
}

/** An organism carrying `genome` (fixed for life, unlike the mutable
 * fields `organismAt` lets a test override afterwards). */
function organismWith(
  x: number,
  y: number,
  genome: Genome,
  seed: number,
): Organism {
  return new Organism({x, y, genome, rng: createRngStream(seed)});
}

describe("evaluateMitosis", () => {
  it("never throws on a parent paying exactly its ceiling, whatever its body and the events it draws", () => {
    const parents = [
      carrierAt(5, 5, [0.3, 0.2, 0.1], 0.3).genome,
      carrierAt(5, 5, [0.05], 2.5).genome,
      {
        ...BASELINE_GENOME,
        cytoplasmRadius: 0.3,
        genes: [
          {
            type: "neuron" as const,
            innovationId: 1,
            radius: 0.1,
            x: 2,
            y: 0,
          },
        ],
      },
    ];
    for (const parentGenome of parents) {
      const genome = {...parentGenome, mitosisEnergyThreshold: 0};
      const costs = birthCosts(genome, ["neuron"]);
      for (let seed = 0; seed < 300; seed++) {
        const organism = organismWith(5, 5, genome, seed);
        organism.energy = costs.energy;
        organism.food = costs.food;

        expect(() => evaluateMitosis(organism, ["neuron"])).not.toThrow();
      }
    }
  });

  it("returns null and consumes no draws when energy is below the threshold", () => {
    const organism = organismAt(5, 5, 1, 42);
    const cap = capFor(organism, "energy");
    organism.energy = organism.genome.mitosisEnergyThreshold * cap - 1e-6;
    const streamBefore = organism.rng;

    const birth = evaluateMitosis(organism, []);

    expect(birth).toBeNull();
    // The world where mitosis does not exist: an organism below threshold
    // draws exactly the numbers it drew before this function existed.
    expect(organism.rng).toEqual(streamBefore);
  });

  it("clears the gate at exactly the threshold", () => {
    const genome = {...BASELINE_GENOME, cytoplasmRadius: 1};
    const organism = organismWith(5, 5, genome, 42);
    const cap = capFor(organism, "energy");
    organism.energy = genome.mitosisEnergyThreshold * cap;
    organism.food = 1000;

    expect(evaluateMitosis(organism, [])).not.toBeNull();
  });

  it("derives the child's stream from the parent's rng before mutating the genome, so mutation can never affect it", () => {
    const organism = organismWith(5, 5, eagerGenome(), 77);
    organism.energy = capFor(organism, "energy");
    organism.food = 1000;
    const expectedChildStream = deriveChildStream(organism.rng).childStream;

    const birth = evaluateMitosis(organism, []);

    expect(birth).not.toBeNull();
    expect(birth?.rng).toEqual(expectedChildStream);
  });

  it("gives two births from the same starting stream the same child stream, even when their genomes mutate completely differently", () => {
    // Same seed, same starting `rng` — but a wildly different thickness
    // changes what `mutateGenome`'s multiplicative law computes (a different
    // magnitude, and its own coin flip for × vs ÷). If derivation ran
    // *after* mutation, or read anything mutation touched, these two
    // children's streams would diverge along with their genomes; pinned
    // beforehand, they cannot.
    const seed = 909;
    const small = organismWith(5, 5, eagerGenome(0.6), seed);
    small.energy = capFor(small, "energy");
    small.food = 1000;
    const large = organismWith(5, 5, eagerGenome(1.4), seed);
    large.energy = capFor(large, "energy");
    large.food = 1000;

    const birthSmall = evaluateMitosis(small, []);
    const birthLarge = evaluateMitosis(large, []);

    expect(birthSmall).not.toBeNull();
    expect(birthLarge).not.toBeNull();
    expect(birthSmall?.genome.cytoplasmRadius).not.toBe(
      birthLarge?.genome.cytoplasmRadius,
    );
    expect(birthSmall?.rng).toEqual(birthLarge?.rng);
  });

  it("prices, debits the parent and allocates the child's stores, matching a hand-computed replica of the same draw sequence", () => {
    const organism = organismWith(5, 5, eagerGenome(), 55);
    organism.energy = capFor(organism, "energy");
    organism.food = capFor(organism, "food");
    organism.oxygen = capFor(organism, "oxygen") * 0.5;
    organism.carbonDioxide = capFor(organism, "carbonDioxide") * 0.5;

    const startEnergy = organism.energy;
    const startFood = organism.food;
    const startOxygen = organism.oxygen;
    const startCo2 = organism.carbonDioxide;
    const startStream = organism.rng;

    const derivation = deriveChildStream(startStream);
    const mutation = mutateGenome(organism.genome, derivation.parentStream);
    const childGenome = mutation.genome;
    const childBody = deriveBody(childGenome);
    const childArea = bodyAreaOfRadius(childBody.radius);
    const massCost = RHO * childArea;
    const energyCost = MITOSIS_ENERGY_COST * childArea;
    const ratio = organism.genome.childAllocationRatio;

    const parentFoodAfterCost = startFood - massCost;
    const parentEnergyAfterCost = startEnergy - energyCost;

    const expectedChildFood = Math.min(
      ratio * parentFoodAfterCost,
      capForArea(childBody.cytoplasmArea, "food"),
    );
    const expectedChildEnergy = Math.min(
      ratio * parentEnergyAfterCost,
      capForArea(childBody.cytoplasmArea, "energy"),
    );
    const expectedChildOxygen = Math.min(
      ratio * startOxygen,
      capForArea(childBody.cytoplasmArea, "oxygen"),
    );
    const expectedChildCo2 = Math.min(
      ratio * startCo2,
      capForArea(childBody.cytoplasmArea, "carbonDioxide"),
    );

    const birth = evaluateMitosis(organism, []);

    expect(birth).not.toBeNull();
    expect(birth?.genome).toEqual(childGenome);
    expect(birth?.food).toBeCloseTo(expectedChildFood, 12);
    expect(birth?.energy).toBeCloseTo(expectedChildEnergy, 12);
    expect(birth?.oxygen).toBeCloseTo(expectedChildOxygen, 12);
    expect(birth?.carbonDioxide).toBeCloseTo(expectedChildCo2, 12);

    expect(organism.food).toBeCloseTo(
      parentFoodAfterCost - expectedChildFood,
      12,
    );
    expect(organism.energy).toBeCloseTo(
      parentEnergyAfterCost - expectedChildEnergy,
      12,
    );
    expect(organism.oxygen).toBeCloseTo(startOxygen - expectedChildOxygen, 12);
    expect(organism.carbonDioxide).toBeCloseTo(startCo2 - expectedChildCo2, 12);
  });

  it("caps the child's share at its own caps, leaving the excess with the parent", () => {
    // A ratio of 1 with a mutated child that can end up smaller than the
    // parent forces the cap, rather than the ratio itself, to bind.
    const genome = {...eagerGenome(), childAllocationRatio: 1};
    const organism = organismWith(5, 5, genome, 9);
    organism.energy = capFor(organism, "energy");
    organism.food = capFor(organism, "food");

    const birth = evaluateMitosis(organism, []);
    expect(birth).not.toBeNull();
    if (!birth) {
      return;
    }

    const {cytoplasmArea} = deriveBody(birth.genome);
    const childFoodCap = capForArea(cytoplasmArea, "food");
    const childEnergyCap = capForArea(cytoplasmArea, "energy");
    expect(birth.food).toBeLessThanOrEqual(childFoodCap + 1e-9);
    expect(birth.energy).toBeLessThanOrEqual(childEnergyCap + 1e-9);
    // Nothing lost: whatever the child could not hold is still sitting with
    // the parent, not vanished — checked precisely by the conservation test
    // below rather than restated here.
  });

  it("conserves total carbon and total oxygen across one committed birth", () => {
    const organism = organismWith(5, 5, eagerGenome(), 8);
    organism.energy = capFor(organism, "energy");
    organism.food = capFor(organism, "food");
    organism.oxygen = capFor(organism, "oxygen");
    organism.carbonDioxide = capFor(organism, "carbonDioxide");

    const carbonBefore = totalCarbon([organism], EMPTY_POOLS);
    const oxygenBefore = totalOxygen([organism], EMPTY_POOLS);

    const birth = evaluateMitosis(organism, []);
    expect(birth).not.toBeNull();

    const population = appendBirths([organism], birth ? [birth] : []);

    expect(totalCarbon(population, EMPTY_POOLS)).toBeCloseTo(carbonBefore, 12);
    expect(totalOxygen(population, EMPTY_POOLS)).toBeCloseTo(oxygenBefore, 12);
  });

  it("lets a parent starve itself on its own birth tick, its remains deposited and its child alive, with carbon conserved", () => {
    // A parent holding exactly the worst-case energy cost, which hands its
    // child everything left after paying: whatever child the draw makes,
    // the parent ends the birth at exactly zero energy. Paying alone can
    // no longer land it there, since no drawn child reaches the ceiling.
    const genome = {...eagerGenome(1), childAllocationRatio: 1};
    const organism = new Organism({
      x: 5,
      y: 5,
      genome,
      rng: createRngStream(654),
    });
    organism.energy = 1000;
    organism.food = 1000;

    const carbonBefore = totalCarbon([organism], EMPTY_POOLS);
    const oxygenBefore = totalOxygen([organism], EMPTY_POOLS);

    // Step 5, then step 7, then step 8 — the tick's own order. Maintenance
    // runs for real, for coverage and realism, but the scenario this test is
    // about — a parent with *exactly* enough energy to clear the gate — is
    // set up by assignment rather than by predicting maintenance's exact
    // float output and hoping an addition and a subtraction round-trip back
    // to it: `(a + b) - a` is not guaranteed bit-identical to `b` in IEEE
    // 754, and this landed off by about `1e-15` the last time a constant
    // moved. Assigning the cost directly is exact by construction, for any
    // constants.
    applyMaintenance(organism);
    organism.energy = MITOSIS_ENERGY_COST * birthCostCeiling(genome, []);
    const birth = evaluateMitosis(organism, []);
    const {survivors, remains} = evaluateDeaths([organism]);

    expect(birth).not.toBeNull();
    expect(organism.energy).toBeCloseTo(0, 9);
    expect(survivors).toHaveLength(0);
    expect(remains).toHaveLength(1);

    const population = appendBirths([], birth ? [birth] : []);
    const pools = depositRemainsForTest(remains);

    expect(population).toHaveLength(1);
    expect(totalCarbon(population, pools)).toBeCloseTo(carbonBefore, 9);
    expect(totalOxygen(population, pools)).toBeCloseTo(oxygenBefore, 9);
  });
});

describe("the Worst-Case Birth Gate (ADR-0027)", () => {
  it("commits children that are an unbiased sample of the mutation law, even from marginal parents", () => {
    // The Birth Sieve's own situation (#40): a parent whose stores sit
    // around what a child costs, tried again tick after tick as diffusion
    // tops it up. Under the sieve every failed attempt redraws the child,
    // so the cheap draws commit first and the committed children shrink by
    // mechanism. Under the gate no attempt draws until the worst case is
    // affordable, so whichever child is then drawn is born.
    const PARENTS = 2000;
    const MAX_ATTEMPTS = 400;
    // 0.2% of the worst-case cost per attempt: slow enough that a marginal
    // parent is tried many times before it can afford a same-sized child.
    const CLIMB = 0.002;
    const draw = openDraws(2027);
    const logRatios: number[] = [];

    for (let i = 0; i < PARENTS; i++) {
      const parentRadius = 0.6 + draw() * 1.0;
      const organism = organismWith(5, 5, eagerGenome(parentRadius), i + 1);
      const parentArea = bodyAreaOfRadius(parentRadius);
      const marginal = i % 2 === 0 ? "food" : "energy";
      const unitCost = marginal === "food" ? RHO : MITOSIS_ENERGY_COST;
      const worstCost = unitCost * birthCostCeiling(organism.genome, []);
      // Both caps sit above the worst case's cost, so whichever store is
      // not the marginal one never binds.
      organism.energy = capFor(organism, "energy");
      organism.food = capFor(organism, "food");
      // Spread from well below a same-sized child to above the worst case.
      organism[marginal] = worstCost * (0.75 + draw() * 0.4);

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const birth = evaluateMitosis(organism, []);
        if (birth) {
          logRatios.push(
            Math.log(
              bodyAreaOfRadius(deriveBody(birth.genome).radius) / parentArea,
            ),
          );
          break;
        }
        organism[marginal] += CLIMB * worstCost;
      }
    }

    const n = logRatios.length;
    const mean = logRatios.reduce((sum, value) => sum + value, 0) / n;
    const variance =
      logRatios.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1);
    const standardError = Math.sqrt(variance / n);

    expect(n).toBe(PARENTS);
    expect(Math.abs(mean)).toBeLessThanOrEqual(4 * standardError);
  });

  it.each(["food", "energy"] as const)(
    "returns no birth and draws nothing when %s pays for a same-sized child but not the worst case",
    (resource) => {
      const organism = organismWith(5, 5, eagerGenome(), 42);
      organism.energy = capFor(organism, "energy");
      organism.food = capFor(organism, "food");
      const unitCost = resource === "food" ? RHO : MITOSIS_ENERGY_COST;
      // Halfway between a same-sized child's cost and the ceiling's.
      organism[resource] =
        unitCost *
        ((bodyAreaOfRadius(1) + birthCostCeiling(organism.genome, [])) / 2);
      const streamBefore = organism.rng;

      // Every stream tried, so no lucky clone or shrink can sneak through.
      for (let attempt = 0; attempt < 50; attempt++) {
        expect(evaluateMitosis(organism, [])).toBeNull();
      }
      expect(organism.rng).toEqual(streamBefore);
    },
  );

  it("always commits a parent holding exactly the worst-case costs, whatever the mutation draws", () => {
    for (let seed = 0; seed < 2000; seed++) {
      const organism = organismWith(
        5,
        5,
        eagerGenome(0.6 + (seed % 50) * 0.02),
        seed,
      );
      const ceiling = birthCostCeiling(organism.genome, []);
      organism.energy = MITOSIS_ENERGY_COST * ceiling;
      organism.food = RHO * ceiling;

      expect(evaluateMitosis(organism, [])).not.toBeNull();
    }
  });
});

// Local, so this file does not need to import `death.ts`'s deposit just to
// exercise it once in the scenario above — kept trivial on purpose.
function depositRemainsForTest(
  remains: readonly {
    readonly food: number;
    readonly carbonDioxide: number;
    readonly oxygen: number;
    readonly bodyMass: number;
  }[],
): Pools {
  return remains.reduce<Pools>(
    (pools, r) => ({
      food: pools.food + r.food + r.bodyMass,
      carbonDioxide: pools.carbonDioxide + r.carbonDioxide,
      oxygen: pools.oxygen + r.oxygen,
    }),
    EMPTY_POOLS,
  );
}

describe("evaluateMitosis over a roster (M7)", () => {
  const ROSTER = ["neuron"] as const;

  /** A carrier that clears both gates with room to spare. Its neurons are
   * too small to split, so the roster's insertion is the worst event it
   * prices and the structural ceiling sits above the header-only one. */
  function richCarrier(seed: number): Organism {
    const base = carrierAt(30, 20, [0.03, 0.03], 1);
    const genome = {
      ...base.genome,
      mitosisEnergyThreshold: 0,
      childAllocationRatio: 0.5,
    };
    const organism = new Organism({
      x: 30,
      y: 20,
      genome,
      rng: createRngStream(seed),
    });
    const ceiling = birthCostCeiling(genome, ROSTER);
    organism.energy = 2 * MITOSIS_ENERGY_COST * ceiling;
    organism.food = 2 * RHO * ceiling;
    organism.oxygen = capFor(organism, "oxygen");
    organism.carbonDioxide = capFor(organism, "carbonDioxide");
    return organism;
  }

  it("prices the gate on the structural ceiling: a parent holding a same-sized child's cost but not the ceiling's draws nothing", () => {
    const organism = richCarrier(5);
    const ceiling = birthCostCeiling(organism.genome, ROSTER);
    expect(ceiling).toBeGreaterThan(birthCostCeiling(organism.genome, []));
    organism.food = RHO * ((bodyArea(organism) + ceiling) / 2);
    const streamBefore = organism.rng;

    expect(evaluateMitosis(organism, ROSTER)).toBeNull();
    expect(organism.rng).toEqual(streamBefore);
  });

  it("commits a parent holding exactly the ceiling's costs without ever throwing, whatever the structural events draw", () => {
    for (let seed = 0; seed < 1500; seed++) {
      const organism = richCarrier(seed);
      const ceiling = birthCostCeiling(organism.genome, ROSTER);
      organism.energy = MITOSIS_ENERGY_COST * ceiling;
      organism.food = RHO * ceiling;

      expect(evaluateMitosis(organism, ROSTER)).not.toBeNull();
    }
  });

  it("prices and caps the child from its derived body, matching a hand-computed replica", () => {
    // A seed whose child differs in structure from its parent, so the
    // replica is not trivially the parent's own body.
    for (let seed = 0; seed < 200; seed++) {
      const organism = richCarrier(seed);
      const startFood = organism.food;
      const startEnergy = organism.energy;
      const derivation = deriveChildStream(organism.rng);
      const mutation = mutateGenome(organism.genome, derivation.parentStream, {
        roster: ROSTER,
      });
      const childBody = deriveBody(mutation.genome);
      if (childBody.organelles.length === organism.organelles.length) {
        continue;
      }
      const childArea = bodyAreaOfRadius(childBody.radius);

      const birth = evaluateMitosis(organism, ROSTER);

      expect(birth).not.toBeNull();
      expect(birth?.genome).toEqual(mutation.genome);
      expect(startFood - organism.food).toBeCloseTo(
        RHO * childArea + (birth?.food ?? 0),
        9,
      );
      expect(startEnergy - organism.energy).toBeCloseTo(
        MITOSIS_ENERGY_COST * childArea + (birth?.energy ?? 0),
        9,
      );
      // Capped from the child's Cytoplasm Area, which organelles shrink.
      for (const resource of [
        "energy",
        "oxygen",
        "carbonDioxide",
        "food",
      ] as const) {
        expect(birth?.[resource]).toBeLessThanOrEqual(
          capForArea(childBody.cytoplasmArea, resource) + 1e-12,
        );
      }
      return;
    }
    throw new Error("no seed produced a child with a different structure");
  });

  it("places the child tangent to its parent using both derived radii", () => {
    let checked = 0;
    for (let seed = 0; seed < 200; seed++) {
      const organism = richCarrier(seed);
      const parentRadius = organism.bodyRadius;
      const birth = evaluateMitosis(organism, ROSTER);
      if (!birth) {
        continue;
      }

      expect(
        Math.hypot(birth.x - organism.x, birth.y - organism.y),
      ).toBeCloseTo(parentRadius + deriveBody(birth.genome).radius, 9);
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
  });

  it("stays an unbiased sample under the neuron roster: a marginal parent's committed child is the child its first draw would have been", () => {
    // The Birth Sieve redraws a child it cannot afford; the gate must not.
    // A parent that only reaches the worst-case cost after many attempts
    // still gets the child its untouched stream gives.
    let compared = 0;
    for (let seed = 0; seed < 300; seed++) {
      const organism = richCarrier(seed);
      const ceiling = birthCostCeiling(organism.genome, ROSTER);
      organism.food = RHO * ceiling * 0.8;
      const derivation = deriveChildStream(organism.rng);
      const expected = mutateGenome(organism.genome, derivation.parentStream, {
        roster: ROSTER,
      }).genome;

      let birth = null;
      for (let attempt = 0; attempt < 100 && birth === null; attempt++) {
        birth = evaluateMitosis(organism, ROSTER);
        if (birth === null) {
          organism.food += 0.005 * RHO * ceiling;
        }
      }

      expect(birth?.genome).toEqual(expected);
      compared++;
    }
    expect(compared).toBe(300);
  });

  it("leaves the child's new genes with provisional ids, which only the commit mints", () => {
    let inserted = 0;
    for (let seed = 0; seed < 400; seed++) {
      const birth = evaluateMitosis(richCarrier(seed), ROSTER);
      for (const gene of birth?.genome.genes ?? []) {
        if (gene.innovationId < 0) {
          inserted++;
        }
      }
    }
    expect(inserted).toBeGreaterThan(0);
  });
});

describe("mintBirths", () => {
  const birthWith = (ids: readonly number[]): PendingBirth => ({
    genome: {
      ...BASELINE_GENOME,
      genes: ids.map((innovationId, i) => ({
        type: "neuron" as const,
        innovationId,
        radius: 0.1,
        x: 0.3 * i,
        y: 0,
      })),
    },
    x: 5,
    y: 5,
    rng: createRngStream(1),
    generation: 0,
    energy: 0,
    oxygen: 0,
    carbonDioxide: 0,
    food: 0,
  });

  it("mints provisional ids from the counter in birth order and genome order, and leaves minted ones alone", () => {
    const result = mintBirths([birthWith([7, -1]), birthWith([-1, -2, 3])], 10);

    expect(result.births[0].genome.genes.map((g) => g.innovationId)).toEqual([
      7, 10,
    ]);
    expect(result.births[1].genome.genes.map((g) => g.innovationId)).toEqual([
      11, 12, 3,
    ]);
    expect(result.nextInnovationId).toBe(13);
  });

  it("hands back the very same births and counter when nothing is provisional", () => {
    const births = [birthWith([]), birthWith([4, 5])];
    const result = mintBirths(births, 20);

    expect(result.births[0]).toBe(births[0]);
    expect(result.births[1]).toBe(births[1]);
    expect(result.nextInnovationId).toBe(20);
  });
});

describe("Generation", () => {
  const readyParent = (generation: number) => {
    const organism = new Organism({
      x: 5,
      y: 5,
      genome: {...BASELINE_GENOME, mitosisEnergyThreshold: 0.1},
      rng: createRngStream(8),
      generation,
    });
    organism.energy = capFor(organism, "energy");
    organism.food = capFor(organism, "food");
    organism.oxygen = capFor(organism, "oxygen");
    organism.carbonDioxide = capFor(organism, "carbonDioxide");
    return organism;
  };

  it("is 0 for an organism built without one, a founder's", () => {
    expect(organismAt(0, 0).generation).toBe(0);
  });

  it("is the parent's plus one on the pending birth and on the child it becomes", () => {
    for (const generation of [0, 3]) {
      const birth = evaluateMitosis(readyParent(generation), []);
      expect(birth?.generation).toBe(generation + 1);

      const [child] = appendBirths([], birth ? [birth] : []);
      expect(child.generation).toBe(generation + 1);
    }
  });
});

describe("appendBirths", () => {
  it("returns the same population reference when there are no pending births", () => {
    const population = [organismAt(0, 0)];

    expect(appendBirths(population, [])).toBe(population);
  });

  it("constructs a child carrying the pending birth's genome, position and stores", () => {
    const birth: PendingBirth = {
      genome: {...BASELINE_GENOME, cytoplasmRadius: 0.8, lineageHue: 0.2},
      x: 5,
      y: 5,
      rng: createRngStream(99),
      generation: 0,
      energy: 10,
      oxygen: 1,
      carbonDioxide: 2,
      food: 3,
    };

    const [child] = appendBirths([], [birth]);

    expect(child.genome).toEqual(birth.genome);
    expect(child.energy).toBe(birth.energy);
    expect(child.oxygen).toBe(birth.oxygen);
    expect(child.carbonDioxide).toBe(birth.carbonDioxide);
    expect(child.food).toBe(birth.food);
    expect(child.rng).toEqual(birth.rng);
  });

  it("constrains a newborn placed outside the aquarium back inside it", () => {
    const birth: PendingBirth = {
      genome: BASELINE_GENOME,
      x: -5,
      y: 5,
      rng: createRngStream(1),
      generation: 0,
      energy: 0,
      oxygen: 0,
      carbonDioxide: 0,
      food: 0,
    };

    const [child] = appendBirths([], [birth]);

    expect(child.x).toBe(child.bodyRadius);
  });

  it("leaves the existing population untouched and appends newborns after it", () => {
    const parent = organismAt(1, 1);
    const birth: PendingBirth = {
      genome: BASELINE_GENOME,
      x: 2,
      y: 2,
      rng: createRngStream(2),
      generation: 0,
      energy: 0,
      oxygen: 0,
      carbonDioxide: 0,
      food: 0,
    };

    const result = appendBirths([parent], [birth]);

    expect(result).toHaveLength(2);
    expect(result[0]).toBe(parent);
  });

  it("appends every pending birth from the tick, in order", () => {
    const births: PendingBirth[] = [1, 2, 3].map((i) => ({
      genome: BASELINE_GENOME,
      x: i,
      y: i,
      rng: createRngStream(i),
      generation: 0,
      energy: i,
      oxygen: 0,
      carbonDioxide: 0,
      food: 0,
    }));

    const result = appendBirths([], births);

    expect(result.map((o) => o.energy)).toEqual([1, 2, 3]);
  });
});
