import {describe, expect, it} from "vitest";

import {
  FIXED_DT_MS,
  advance,
  createWorld,
  getPoolCapacities,
  getPoolLevels,
} from "./world";

describe("getPoolCapacities", () => {
  it("are the world's starting carbon for food and CO₂ and starting oxygen for O₂", () => {
    const world = createWorld(5);
    const capacities = getPoolCapacities(world);

    expect(capacities.food).toBeGreaterThan(0);
    expect(capacities.carbonDioxide).toBe(capacities.food);
    expect(capacities.oxygen).toBeGreaterThan(0);
  });

  it("stay constant while the pools move, and no pool ever exceeds its capacity", () => {
    let world = createWorld(5);
    const start = getPoolCapacities(world);

    for (let t = 0; t < 200; t++) {
      world = advance(world, FIXED_DT_MS).world;
      const levels = getPoolLevels(world);
      const capacities = getPoolCapacities(world);

      expect(capacities).toEqual(start);
      expect(levels.food).toBeLessThanOrEqual(capacities.food);
      expect(levels.carbonDioxide).toBeLessThanOrEqual(
        capacities.carbonDioxide,
      );
      expect(levels.oxygen).toBeLessThanOrEqual(capacities.oxygen);
    }
  });
});
