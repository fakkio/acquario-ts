import {describe, expect, it} from "vitest";

import {MITOSIS_ENERGY_COST, RHO} from "./constants";
import {evaluateDeaths} from "./death";
import {BASELINE_GENOME, mutateGenome, type Genome} from "./genome";
import {totalCarbon, totalOxygen, type Pools} from "./ledger";
import {applyMaintenance} from "./metabolism";
import {appendBirths, evaluateMitosis, type PendingBirth} from "./mitosis";
import {Organism, bodyAreaOfRadius, capFor, capForRadius} from "./organism";
import {createRngStream, deriveChildStream} from "./rng";
import {organismAt} from "./testing";

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
function eagerGenome(bodyRadius = 1): Genome {
  return {
    ...BASELINE_GENOME,
    bodyRadius,
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
  it("returns null and consumes no draws when energy is below the threshold", () => {
    const organism = organismAt(5, 5, 1, 42);
    const cap = capFor(organism, "energy");
    organism.energy = organism.genome.mitosisEnergyThreshold * cap - 1e-6;
    const streamBefore = organism.rng;

    const birth = evaluateMitosis(organism);

    expect(birth).toBeNull();
    // The world where mitosis does not exist: an organism below threshold
    // draws exactly the numbers it drew before this function existed.
    expect(organism.rng).toEqual(streamBefore);
  });

  it("clears the gate at exactly the threshold", () => {
    const genome = {...BASELINE_GENOME, bodyRadius: 1};
    const organism = organismWith(5, 5, genome, 42);
    const cap = capFor(organism, "energy");
    organism.energy = genome.mitosisEnergyThreshold * cap;
    organism.food = 1000;

    expect(evaluateMitosis(organism)).not.toBeNull();
  });

  it("derives the child's stream from the parent's rng before mutating the genome, so mutation can never affect it", () => {
    const organism = organismWith(5, 5, eagerGenome(), 77);
    organism.energy = capFor(organism, "energy");
    organism.food = 1000;
    const expectedChildStream = deriveChildStream(organism.rng).childStream;

    const birth = evaluateMitosis(organism);

    expect(birth).not.toBeNull();
    expect(birth?.rng).toEqual(expectedChildStream);
  });

  it("gives two births from the same starting stream the same child stream, even when their genomes mutate completely differently", () => {
    // Same seed, same starting `rng` — but a wildly different `bodyRadius`
    // changes what `mutateGenome`'s radius law computes (a different
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

    const birthSmall = evaluateMitosis(small);
    const birthLarge = evaluateMitosis(large);

    expect(birthSmall).not.toBeNull();
    expect(birthLarge).not.toBeNull();
    expect(birthSmall?.genome.bodyRadius).not.toBe(
      birthLarge?.genome.bodyRadius,
    );
    expect(birthSmall?.rng).toEqual(birthLarge?.rng);
  });

  it("spends the derivation and mutation draws but never the tangent-angle draw when a physical requirement fails", () => {
    const seed = 321;
    const genome = eagerGenome();
    const organism = organismWith(1, 1, genome, seed);
    organism.energy = capFor(organism, "energy");
    // No food at all: the mass-cost requirement fails unconditionally,
    // whatever the mutated child's area turns out to be.
    organism.food = 0;

    const derivation = deriveChildStream(createRngStream(seed));
    const mutation = mutateGenome(genome, derivation.parentStream);

    const birth = evaluateMitosis(organism);

    expect(birth).toBeNull();
    expect(organism.rng).toEqual(mutation.stream);
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
    const childArea = bodyAreaOfRadius(childGenome.bodyRadius);
    const massCost = RHO * childArea;
    const energyCost = MITOSIS_ENERGY_COST * childArea;
    const ratio = organism.genome.childAllocationRatio;

    const parentFoodAfterCost = startFood - massCost;
    const parentEnergyAfterCost = startEnergy - energyCost;

    const expectedChildFood = Math.min(
      ratio * parentFoodAfterCost,
      capForRadius(childGenome.bodyRadius, "food"),
    );
    const expectedChildEnergy = Math.min(
      ratio * parentEnergyAfterCost,
      capForRadius(childGenome.bodyRadius, "energy"),
    );
    const expectedChildOxygen = Math.min(
      ratio * startOxygen,
      capForRadius(childGenome.bodyRadius, "oxygen"),
    );
    const expectedChildCo2 = Math.min(
      ratio * startCo2,
      capForRadius(childGenome.bodyRadius, "carbonDioxide"),
    );

    const birth = evaluateMitosis(organism);

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

    const birth = evaluateMitosis(organism);
    expect(birth).not.toBeNull();
    if (!birth) {
      return;
    }

    const childFoodCap = capForRadius(birth.genome.bodyRadius, "food");
    const childEnergyCap = capForRadius(birth.genome.bodyRadius, "energy");
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

    const birth = evaluateMitosis(organism);
    expect(birth).not.toBeNull();

    const population = appendBirths([organism], birth ? [birth] : []);

    expect(totalCarbon(population, EMPTY_POOLS)).toBeCloseTo(carbonBefore, 12);
    expect(totalOxygen(population, EMPTY_POOLS)).toBeCloseTo(oxygenBefore, 12);
  });

  it("lets a parent starve itself on its own birth tick, its remains deposited and its child alive, with carbon conserved", () => {
    const seed = 654;
    const bodyRadius = 1;
    const genome = eagerGenome(bodyRadius);

    // Predict the child's mutated area deterministically, from the same
    // stream state `evaluateMitosis` will consume, so the exact energy cost
    // it will charge is known up front.
    const derivation = deriveChildStream(createRngStream(seed));
    const mutation = mutateGenome(genome, derivation.parentStream);
    const childArea = bodyAreaOfRadius(mutation.genome.bodyRadius);
    const energyCost = MITOSIS_ENERGY_COST * childArea;

    const organism = new Organism({
      x: 5,
      y: 5,
      genome,
      rng: createRngStream(seed),
    });
    organism.energy = 1000;
    organism.food = 1000;

    const carbonBefore = totalCarbon([organism], EMPTY_POOLS);
    const oxygenBefore = totalOxygen([organism], EMPTY_POOLS);

    // Step 5, then step 7, then step 8 — the tick's own order. Maintenance
    // runs for real, for coverage and realism, but the scenario this test is
    // about — a parent with *exactly* enough energy to afford mitosis, so
    // paying for it lands at precisely zero — is set up by assignment rather
    // than by predicting maintenance's exact float output and hoping an
    // addition and a subtraction round-trip back to it: `(a + b) - a` is not
    // guaranteed bit-identical to `b` in IEEE 754, and this landed off by
    // about `1e-15` the last time a constant moved. Assigning `energyCost`
    // directly is exact by construction, for any constants.
    applyMaintenance(organism);
    organism.energy = energyCost;
    const birth = evaluateMitosis(organism);
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

describe("appendBirths", () => {
  it("returns the same population reference when there are no pending births", () => {
    const population = [organismAt(0, 0)];

    expect(appendBirths(population, [])).toBe(population);
  });

  it("constructs a child carrying the pending birth's genome, position and stores", () => {
    const birth: PendingBirth = {
      genome: {...BASELINE_GENOME, bodyRadius: 0.8, lineageHue: 0.2},
      x: 5,
      y: 5,
      rng: createRngStream(99),
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
      energy: i,
      oxygen: 0,
      carbonDioxide: 0,
      food: 0,
    }));

    const result = appendBirths([], births);

    expect(result.map((o) => o.energy)).toEqual([1, 2, 3]);
  });
});
