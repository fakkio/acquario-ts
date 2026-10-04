import {describe, expect, it} from "vitest";

import {
  FIXED_DT_MS,
  advance,
  createWorld,
  getPopulation,
  hashState,
} from "./world";
import {RESOURCES} from "./organism";

const TICK = FIXED_DT_MS;

describe("advance's flows for a traced organism", () => {
  it("add up to the tick's whole change in the organism's stores", () => {
    let world = createWorld(7);
    for (let t = 0; t < 40; t++) {
      world = advance(world, TICK).world;
    }

    for (let t = 0; t < 30; t++) {
      const organism = getPopulation(world)[0];
      const before = {
        energy: organism.energy,
        oxygen: organism.oxygen,
        carbonDioxide: organism.carbonDioxide,
        food: organism.food,
      };

      const result = advance(world, TICK, {trace: organism});
      world = result.world;
      const flows = result.flows;
      if (!getPopulation(world).includes(organism)) {
        break;
      }

      expect(flows).not.toBeNull();
      for (const resource of RESOURCES) {
        const total =
          (flows?.exchange[resource] ?? 0) +
          (flows?.photosynthesis[resource] ?? 0) +
          (flows?.respiration[resource] ?? 0) +
          (flows?.maintenance[resource] ?? 0) +
          (flows?.mitosis[resource] ?? 0);
        expect(before[resource] + total).toBeCloseTo(organism[resource], 9);
      }
    }
  });

  it("report maintenance as an energy charge and respiration as energy income", () => {
    const world = createWorld(7);
    const organism = getPopulation(world)[0];

    const flows = advance(world, TICK, {trace: organism}).flows;

    expect(flows?.maintenance.energy).toBeLessThan(0);
    expect(flows?.maintenance.food).toBe(0);
    expect(flows?.respiration.energy).toBeGreaterThanOrEqual(0);
  });

  it("are null without a trace, and for an organism that is not in the world", () => {
    const world = createWorld(7);
    const stranger = getPopulation(createWorld(8))[0];

    expect(advance(world, TICK).flows).toBeNull();
    expect(advance(world, TICK, {trace: stranger}).flows).toBeNull();
  });

  it("leave the world exactly as untraced: same hash", () => {
    let plain = createWorld(21);
    let traced = createWorld(21);
    for (let t = 0; t < 60; t++) {
      plain = advance(plain, TICK).world;
      traced = advance(traced, TICK, {trace: getPopulation(traced)[0]}).world;
    }

    expect(hashState(traced)).toBe(hashState(plain));
  });
});
