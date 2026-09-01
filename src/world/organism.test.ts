import {describe, expect, it} from "vitest";

import {
  AQUARIUM_HEIGHT,
  AQUARIUM_WIDTH,
  BASELINE_BODY_RADIUS,
} from "./aquarium";
import {EMPTY_HASH} from "./hash";
import {
  MAX_RADIUS_FACTOR,
  MIN_RADIUS_FACTOR,
  Organism,
  type OrganismInit,
  STARTING_POPULATION,
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

  // Not a tautology: the baseline radius is the length unit every other world
  // constant is written in, so a spread that drifts off-centre quietly makes
  // the unit smaller than the median body it is supposed to describe.
  it("keeps the baseline radius at the centre of the spread", () => {
    expect(MIN_RADIUS_FACTOR + MAX_RADIUS_FACTOR).toBeCloseTo(2);
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
  ])("changes when %s changes", (_field, change) => {
    expect(foldOne(organismWith(change))).not.toBe(foldOne(organismWith({})));
  });
});
