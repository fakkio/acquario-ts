import {describe, expect, it} from "vitest";

import {
  AQUARIUM_HEIGHT,
  AQUARIUM_WIDTH,
  BASELINE_BODY_RADIUS,
} from "./aquarium";
import {K_CAP, K_CAP_ENERGY} from "./constants";
import {EMPTY_HASH} from "./hash";
import {
  MAX_RADIUS_FACTOR,
  MIN_RADIUS_FACTOR,
  Organism,
  type OrganismInit,
  STARTING_POPULATION,
  bodyArea,
  bodyMass,
  capFor,
  createPopulation,
  foldPopulation,
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

  it("varies body radius around the baseline, within the stated factors", () => {
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

  it("gives every organism a distinct hue inside the colour wheel", () => {
    const hues = populationFor(7).map((organism) => organism.lineageHue);

    for (const hue of hues) {
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }

    expect(new Set(hues).size).toBeGreaterThan(1);
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

describe("foldPopulation", () => {
  const organismWith = (init: Partial<OrganismInit>) =>
    new Organism({
      x: 3,
      y: 4,
      bodyRadius: 1,
      lineageHue: 200,
      rng: createRngStream(11),
      ...init,
    });

  const foldOne = (organism: Organism) =>
    foldPopulation(EMPTY_HASH, [organism]);

  it("folds an unchanged organism to the same value", () => {
    expect(foldOne(organismWith({}))).toBe(foldOne(organismWith({})));
  });

  // Each of these is one clause of M0's determinism invariant, now that it
  // covers bodies: a field left out of the fold is a field two divergent
  // runs could differ in while still hashing the same.
  it.each([
    ["position x", {x: 3.0000001}],
    ["position y", {y: 4.0000001}],
    ["body radius", {bodyRadius: 1.0000001}],
    ["lineage hue", {lineageHue: 201}],
    ["stream state", {rng: createRngStream(12)}],
    ["energy", {energy: 0.0000001}],
    ["oxygen", {oxygen: 0.0000001}],
    ["carbon dioxide", {carbonDioxide: 0.0000001}],
    ["food", {food: 0.0000001}],
  ])("changes when %s changes", (_field, change) => {
    expect(foldOne(organismWith(change))).not.toBe(foldOne(organismWith({})));
  });
});

describe("internal resource stores", () => {
  const organismWith = (init: Partial<OrganismInit>) =>
    new Organism({
      x: 3,
      y: 4,
      bodyRadius: 2,
      lineageHue: 200,
      rng: createRngStream(11),
      ...init,
    });

  it("default to zero, since only initializeMetabolism fills generation 0", () => {
    const organism = organismWith({});

    expect(organism.energy).toBe(0);
    expect(organism.oxygen).toBe(0);
    expect(organism.carbonDioxide).toBe(0);
    expect(organism.food).toBe(0);
  });

  it("derives body area from body radius", () => {
    expect(bodyArea(organismWith({bodyRadius: 2}))).toBeCloseTo(
      Math.PI * 4,
      12,
    );
  });

  // ρ = 1 by construction, so mass and area coincide, but bodyMass is its
  // own function rather than a stored field: nothing on Organism holds a
  // mass a caller could let drift out of step with bodyRadius.
  it("derives body mass from body area, with no stored field of its own", () => {
    const organism = organismWith({bodyRadius: 2});

    expect(bodyMass(organism)).toBeCloseTo(bodyArea(organism), 12);
    expect(
      (organism as unknown as Record<string, unknown>).bodyMass,
    ).toBeUndefined();
  });

  it("caps the three diffusibles at K_CAP times body area", () => {
    const organism = organismWith({bodyRadius: 2});
    const expectedCap = K_CAP * bodyArea(organism);

    expect(capFor(organism, "oxygen")).toBeCloseTo(expectedCap, 12);
    expect(capFor(organism, "carbonDioxide")).toBeCloseTo(expectedCap, 12);
    expect(capFor(organism, "food")).toBeCloseTo(expectedCap, 12);
  });

  it("caps energy at its own coefficient rather than sharing K_CAP", () => {
    const organism = organismWith({bodyRadius: 2});

    expect(capFor(organism, "energy")).toBeCloseTo(
      K_CAP_ENERGY * bodyArea(organism),
      12,
    );
    expect(K_CAP_ENERGY).not.toBe(K_CAP);
  });

  it("scales every cap with the organism's own body area", () => {
    const small = organismWith({bodyRadius: 1});
    const large = organismWith({bodyRadius: 2});

    expect(capFor(large, "food")).toBeGreaterThan(capFor(small, "food"));
    expect(capFor(large, "energy")).toBeGreaterThan(capFor(small, "energy"));
  });
});
