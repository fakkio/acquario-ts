import {describe, expect, it} from "vitest";

import {
  AQUARIUM_HEIGHT,
  AQUARIUM_WIDTH,
  BASELINE_BODY_RADIUS,
} from "./aquarium";
import {K_CAP, K_CAP_ENERGY} from "./constants";
import {BASELINE_GENOME, type Genome} from "./genome";
import {EMPTY_HASH} from "./hash";
import {
  MAX_RADIUS_FACTOR,
  MIN_RADIUS_FACTOR,
  Organism,
  type OrganismInit,
  type OrganismView,
  STARTING_POPULATION,
  bodyArea,
  bodyMass,
  capFor,
  createPopulation,
  DIFFUSIBLES,
  foldPopulation,
  placeFounders,
  type Founder,
} from "./organism";
import {createRngStream} from "./rng";

const populationFor = (seed: number) =>
  createPopulation(createRngStream(seed)).population;

describe("createPopulation", () => {
  it("places the configured number of organisms", () => {
    expect(populationFor(7)).toHaveLength(STARTING_POPULATION);
  });

  it("places every body entirely inside the aquarium", () => {
    for (const organism of populationFor(7)) {
      expect(organism.x - organism.bodyRadius).toBeGreaterThanOrEqual(0);
      expect(organism.y - organism.bodyRadius).toBeGreaterThanOrEqual(0);
      expect(organism.x + organism.bodyRadius).toBeLessThanOrEqual(
        AQUARIUM_WIDTH,
      );
      expect(organism.y + organism.bodyRadius).toBeLessThanOrEqual(
        AQUARIUM_HEIGHT,
      );
    }
  });

  it("varies body radius around the baseline, within the spread M1 calibrated", () => {
    const radii = populationFor(7).map((organism) => organism.bodyRadius);

    for (const radius of radii) {
      expect(radius).toBeGreaterThanOrEqual(
        MIN_RADIUS_FACTOR * BASELINE_BODY_RADIUS,
      );
      expect(radius).toBeLessThanOrEqual(
        MAX_RADIUS_FACTOR * BASELINE_BODY_RADIUS,
      );
    }

    expect(new Set(radii).size).toBeGreaterThan(1);
  });

  // Founders are independently mutated from one baseline genome, so the
  // three functional genes have to tell them apart pairwise — a marker that
  // cannot distinguish forty founders is not a marker.
  it("gives founders pairwise-distinct values in all three functional genes", () => {
    const population = populationFor(7);
    const bodyRadii = population.map((organism) => organism.genome.bodyRadius);
    const thresholds = population.map(
      (organism) => organism.genome.mitosisEnergyThreshold,
    );
    const ratios = population.map(
      (organism) => organism.genome.childAllocationRatio,
    );

    expect(new Set(bodyRadii).size).toBe(STARTING_POPULATION);
    expect(new Set(thresholds).size).toBe(STARTING_POPULATION);
    expect(new Set(ratios).size).toBe(STARTING_POPULATION);
  });

  it("draws lineageHue uniformly over [0, 1), spread rather than clustered", () => {
    const hues = populationFor(7).map((organism) => organism.lineageHue);

    for (const hue of hues) {
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(1);
    }

    expect(new Set(hues).size).toBeGreaterThan(1);
    // A baseline-inherited hue would sit within one mutation step of a
    // single value; a uniform draw spreads across most of the wheel.
    expect(Math.max(...hues) - Math.min(...hues)).toBeGreaterThan(0.5);
  });

  it("gives every organism its own stream, distinct from every other one's", () => {
    const streams = populationFor(7).map((organism) => organism.rng.state);

    expect(new Set(streams).size).toBe(STARTING_POPULATION);
  });

  it("advances the global stream it was handed rather than reusing its state", () => {
    const globalRng = createRngStream(7);
    const {population, stream} = createPopulation(globalRng);

    expect(stream.state).not.toBe(globalRng.state);
    for (const organism of population) {
      expect(organism.rng.state).not.toBe(stream.state);
    }
  });

  it("produces identical populations for the same seed", () => {
    expect(populationFor(7)).toEqual(populationFor(7));
  });

  it("produces a different population for a different seed", () => {
    expect(populationFor(7)).not.toEqual(populationFor(8));
  });
});

describe("createPopulation from an explicit baseline genome", () => {
  // The done-criteria runs vary the starting point as well as the seed
  // (ADR-0025), so the genome founders are mutated from has to be an
  // argument rather than a module-level constant.
  const LARGE_BASELINE: Genome = {...BASELINE_GENOME, bodyRadius: 2.5};

  it("defaults to BASELINE_GENOME, so an omitted argument changes nothing", () => {
    expect(createPopulation(createRngStream(7)).population).toEqual(
      createPopulation(createRngStream(7), BASELINE_GENOME).population,
    );
  });

  it("spreads founders around the genome it was handed rather than around the default", () => {
    const radii = createPopulation(
      createRngStream(7),
      LARGE_BASELINE,
    ).population.map((organism) => organism.bodyRadius);

    for (const radius of radii) {
      expect(radius).toBeGreaterThan(
        MIN_RADIUS_FACTOR * LARGE_BASELINE.bodyRadius * 0.99,
      );
      expect(radius).toBeLessThan(
        MAX_RADIUS_FACTOR * LARGE_BASELINE.bodyRadius * 1.01,
      );
    }
  });

  // lineageHue is the one gene generation 0 does not inherit, whichever
  // baseline it is mutated from: forty founders a hair apart in hue are
  // forty founders a marker locus cannot tell apart.
  it("still draws lineageHue uniformly rather than from the given baseline", () => {
    const hues = createPopulation(createRngStream(7), {
      ...BASELINE_GENOME,
      lineageHue: 0.25,
    }).population.map((organism) => organism.lineageHue);

    expect(Math.max(...hues) - Math.min(...hues)).toBeGreaterThan(0.5);
  });
});

describe("placeFounders", () => {
  const ladder: readonly Founder[] = [1, 1.5, 2, 2.5].map((bodyRadius, i) => ({
    x: 10 + 5 * i,
    y: 3 + 2 * i,
    genome: {...BASELINE_GENOME, bodyRadius, lineageHue: 0.1 * i},
  }));

  it("places exactly the bodies it was handed, in order", () => {
    const {population} = placeFounders(createRngStream(7), ladder);

    expect(population).toHaveLength(ladder.length);
    for (const [i, organism] of population.entries()) {
      const founder = ladder[i];
      expect(organism.x).toBe(founder.x);
      expect(organism.y).toBe(founder.y);
      expect(organism.genome).toEqual(founder.genome);
    }
  });

  it("gives every founder its own stream, distinct from every other one's", () => {
    const streams = placeFounders(createRngStream(7), ladder).population.map(
      (organism) => organism.rng.state,
    );

    expect(new Set(streams).size).toBe(ladder.length);
  });

  it("advances the global stream it was handed rather than reusing its state", () => {
    const globalRng = createRngStream(7);
    const {stream} = placeFounders(globalRng, ladder);

    expect(stream.state).not.toBe(globalRng.state);
  });

  it("leaves the four internal stores at zero, for initializeMetabolism to fill", () => {
    for (const organism of placeFounders(createRngStream(7), ladder)
      .population) {
      expect(organism.energy).toBe(0);
      expect(organism.oxygen).toBe(0);
      expect(organism.carbonDioxide).toBe(0);
      expect(organism.food).toBe(0);
    }
  });

  it("produces identical populations for the same seed and the same ladder", () => {
    expect(placeFounders(createRngStream(7), ladder).population).toEqual(
      placeFounders(createRngStream(7), ladder).population,
    );
  });

  it("places nothing when handed nothing", () => {
    expect(placeFounders(createRngStream(7), []).population).toHaveLength(0);
  });
});

describe("the reproduction genes on the view", () => {
  const organism = new Organism({
    x: 1,
    y: 2,
    genome: {
      ...BASELINE_GENOME,
      mitosisEnergyThreshold: 0.42,
      childAllocationRatio: 0.17,
    },
    rng: createRngStream(11),
  });

  // Gene statistics live in the App layer and in the harness rather than
  // behind a reader of their own, so all four genes have to be readable
  // off the view — bodyRadius and lineageHue already were.
  it("reads both reproduction genes off the genome, with no field of their own", () => {
    const view: OrganismView = organism;

    expect(view.mitosisEnergyThreshold).toBe(0.42);
    expect(view.childAllocationRatio).toBe(0.17);
  });

  it("exposes all four genes through the view", () => {
    const view: OrganismView = organism;

    expect(view.bodyRadius).toBe(organism.genome.bodyRadius);
    expect(view.lineageHue).toBe(organism.genome.lineageHue);
    expect(view.mitosisEnergyThreshold).toBe(
      organism.genome.mitosisEnergyThreshold,
    );
    expect(view.childAllocationRatio).toBe(
      organism.genome.childAllocationRatio,
    );
  });
});

describe("foldPopulation", () => {
  const BASE_GENOME: Genome = {...BASELINE_GENOME, lineageHue: 0.5};

  const organismWith = (
    genomeChange: Partial<Genome> = {},
    init: Partial<OrganismInit> = {},
  ) =>
    new Organism({
      x: 3,
      y: 4,
      genome: {...BASE_GENOME, ...genomeChange},
      rng: createRngStream(11),
      ...init,
    });

  const foldOne = (organism: Organism) =>
    foldPopulation(EMPTY_HASH, [organism]);

  it("folds an unchanged organism to the same value", () => {
    expect(foldOne(organismWith())).toBe(foldOne(organismWith()));
  });

  // Each of these is one clause of M0's determinism invariant, now that it
  // covers bodies: a field left out of the fold is a field two divergent
  // runs could differ in while still hashing the same.
  it.each([
    ["body radius", {bodyRadius: BASE_GENOME.bodyRadius + 0.0000001}],
    [
      "mitosis energy threshold",
      {mitosisEnergyThreshold: BASE_GENOME.mitosisEnergyThreshold + 0.0000001},
    ],
    [
      "child allocation ratio",
      {childAllocationRatio: BASE_GENOME.childAllocationRatio + 0.0000001},
    ],
    ["lineage hue", {lineageHue: BASE_GENOME.lineageHue + 0.0000001}],
  ])("changes when %s changes", (_field, genomeChange) => {
    expect(foldOne(organismWith(genomeChange))).not.toBe(
      foldOne(organismWith()),
    );
  });

  it.each([
    ["position x", {x: 3.0000001}],
    ["position y", {y: 4.0000001}],
    ["stream state", {rng: createRngStream(12)}],
    ["energy", {energy: 0.0000001}],
    ["oxygen", {oxygen: 0.0000001}],
    ["carbon dioxide", {carbonDioxide: 0.0000001}],
    ["food", {food: 0.0000001}],
  ])("changes when %s changes", (_field, change) => {
    expect(foldOne(organismWith({}, change))).not.toBe(foldOne(organismWith()));
  });
});

describe("internal resource stores", () => {
  const organismWith = (
    genomeChange: Partial<Genome> = {},
    init: Partial<OrganismInit> = {},
  ) =>
    new Organism({
      x: 3,
      y: 4,
      genome: {
        ...BASELINE_GENOME,
        bodyRadius: 2,
        lineageHue: 0.5,
        ...genomeChange,
      },
      rng: createRngStream(11),
      ...init,
    });

  it("default to zero, since only initializeMetabolism fills generation 0", () => {
    const organism = organismWith();

    expect(organism.energy).toBe(0);
    expect(organism.oxygen).toBe(0);
    expect(organism.carbonDioxide).toBe(0);
    expect(organism.food).toBe(0);
  });

  it("derives body area from body radius", () => {
    expect(bodyArea(organismWith())).toBeCloseTo(Math.PI * 4, 12);
  });

  // ρ = 1 by construction, so mass and area coincide, but bodyMass is its
  // own function rather than a stored field: nothing on Organism holds a
  // mass a caller could let drift out of step with bodyRadius.
  it("derives body mass from body area, with no stored field of its own", () => {
    const organism = organismWith();

    expect(bodyMass(organism)).toBeCloseTo(bodyArea(organism), 12);
    expect(
      (organism as unknown as Record<string, unknown>).bodyMass,
    ).toBeUndefined();
  });

  it("caps each diffusible at its own K_CAP entry times body area", () => {
    const organism = organismWith();

    for (const resource of DIFFUSIBLES) {
      expect(capFor(organism, resource)).toBeCloseTo(
        K_CAP[resource] * bodyArea(organism),
        12,
      );
    }
  });

  // The table is per-resource from M5 (ADR-0022), but every entry is still
  // 1 in this ticket: food's headroom above ρ is a later ticket's change,
  // and expanding the shape first is what keeps that change attributable.
  it("holds every diffusible's cap coefficient at 1 for now", () => {
    for (const resource of DIFFUSIBLES) {
      expect(K_CAP[resource]).toBe(1);
    }
  });

  it("caps energy at its own coefficient rather than sharing K_CAP", () => {
    const organism = organismWith();

    expect(capFor(organism, "energy")).toBeCloseTo(
      K_CAP_ENERGY * bodyArea(organism),
      12,
    );
    expect(K_CAP_ENERGY).not.toBe(K_CAP.food);
  });

  it("scales every cap with the organism's own body area", () => {
    const small = organismWith({bodyRadius: 1});
    const large = organismWith({bodyRadius: 2});

    expect(capFor(large, "food")).toBeGreaterThan(capFor(small, "food"));
    expect(capFor(large, "energy")).toBeGreaterThan(capFor(small, "energy"));
  });
});
