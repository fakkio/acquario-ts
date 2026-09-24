import {describe, expect, it} from "vitest";

import type {OrganismView} from "../world";
import {foldGeneStatistics} from "./geneStatistics";

/** Only the four genes matter to this fold; the rest of `OrganismView` is
 * filled with placeholders no test here reads. */
function organismView(overrides: Partial<OrganismView>): OrganismView {
  return {
    x: 0,
    y: 0,
    bodyRadius: 1,
    lineageHue: 0,
    mitosisEnergyThreshold: 0.75,
    childAllocationRatio: 0.5,
    energy: 0,
    oxygen: 0,
    carbonDioxide: 0,
    food: 0,
    ...overrides,
  };
}

describe("foldGeneStatistics", () => {
  it("reads mean 0 and σ 0 for every gene in an empty population", () => {
    const stats = foldGeneStatistics([]);

    expect(stats.bodyRadius).toEqual({mean: 0, sigma: 0});
    expect(stats.mitosisEnergyThreshold).toEqual({mean: 0, sigma: 0});
    expect(stats.childAllocationRatio).toEqual({mean: 0, sigma: 0});
    expect(stats.lineageHue).toEqual({mean: 0, sigma: 0});
  });

  it("reads σ 0 and mean equal to the value for a population of one", () => {
    const stats = foldGeneStatistics([organismView({bodyRadius: 2})]);

    expect(stats.bodyRadius).toEqual({mean: 2, sigma: 0});
  });

  it("computes the population mean and standard deviation per gene", () => {
    const population = [
      organismView({bodyRadius: 1, lineageHue: 0}),
      organismView({bodyRadius: 2, lineageHue: 0.5}),
      organismView({bodyRadius: 3, lineageHue: 1}),
    ];

    const stats = foldGeneStatistics(population);

    expect(stats.bodyRadius.mean).toBeCloseTo(2);
    expect(stats.bodyRadius.sigma).toBeCloseTo(Math.sqrt(2 / 3));
    expect(stats.lineageHue.mean).toBeCloseTo(0.5);
    expect(stats.lineageHue.sigma).toBeCloseTo(Math.sqrt(1 / 6));
  });

  it("reads each gene independently of the others", () => {
    const population = [
      organismView({mitosisEnergyThreshold: 0.2, childAllocationRatio: 0.9}),
      organismView({mitosisEnergyThreshold: 0.8, childAllocationRatio: 0.1}),
    ];

    const stats = foldGeneStatistics(population);

    expect(stats.mitosisEnergyThreshold.mean).toBeCloseTo(0.5);
    expect(stats.childAllocationRatio.mean).toBeCloseTo(0.5);
  });
});
