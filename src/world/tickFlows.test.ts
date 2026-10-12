import {describe, expect, it} from "vitest";

import {
  FIXED_DT_MS,
  advance,
  createWorld,
  getPopulation,
  hashState,
} from "./world";
import {BASELINE_GENOME} from "./genome";
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
          (flows?.photosynthesisBody[resource] ?? 0) +
          (flows?.photosynthesisChloroplasts[resource] ?? 0) +
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

describe("photosynthesis flows split between body and chloroplasts (#84)", () => {
  const founder = (chloroplasts: number) => ({
    x: 20,
    y: 3,
    genome: {
      ...BASELINE_GENOME,
      genes: Array.from({length: chloroplasts}, (_, k) => ({
        type: "chloroplast" as const,
        x: 0.03 * k,
        y: 0,
        radius: 0.05,
      })),
    },
  });

  const tracedFlows = (chloroplasts: number) => {
    const world = createWorld(7, {
      generation0: {founders: [founder(chloroplasts)]},
      roster: [],
    });
    const organism = getPopulation(world)[0];
    return advance(world, TICK, {trace: organism}).flows;
  };

  it("gives a body with chloroplasts a chloroplast share that adds to the body's", () => {
    const flows = tracedFlows(2);

    expect(flows?.photosynthesisChloroplasts.food).toBeGreaterThan(0);
    expect(flows?.photosynthesisBody.food).toBeGreaterThan(0);
    for (const resource of RESOURCES) {
      const total =
        (flows?.photosynthesisBody[resource] ?? 0) +
        (flows?.photosynthesisChloroplasts[resource] ?? 0);
      // CO₂ falls by what food and O₂ gain.
      expect(total).toBeCloseTo(
        resource === "carbonDioxide"
          ? -(flows?.photosynthesisBody.food ?? 0) -
              (flows?.photosynthesisChloroplasts.food ?? 0)
          : resource === "energy"
            ? 0
            : (flows?.photosynthesisBody.food ?? 0) +
              (flows?.photosynthesisChloroplasts.food ?? 0),
        12,
      );
    }
    expect(flows?.discs).toHaveLength(2);
    const discSum = (flows?.discs ?? []).reduce(
      (sum, disc) => sum + disc.fixation,
      0,
    );
    expect(discSum).toBeCloseTo(
      flows?.photosynthesisChloroplasts.food ?? 0,
      12,
    );
  });

  it("gives a body with no chloroplast a chloroplast share of zero", () => {
    const flows = tracedFlows(0);

    expect(flows?.photosynthesisChloroplasts.food).toBe(0);
    expect(flows?.photosynthesisBody.food).toBeGreaterThan(0);
    expect(flows?.discs).toHaveLength(0);
  });

  it("reads less light for a chloroplast below the centre of an upright body", () => {
    const world = createWorld(7, {
      generation0: {
        founders: [
          {
            x: 20,
            y: 3,
            genome: {
              ...BASELINE_GENOME,
              genes: [
                {type: "chloroplast" as const, x: 0, y: -0.1, radius: 0.05},
                {type: "chloroplast" as const, x: 0, y: 0.1, radius: 0.05},
              ],
            },
          },
        ],
      },
      roster: [],
    });
    const organism = getPopulation(world)[0];
    const discs = advance(world, TICK, {trace: organism}).flows?.discs ?? [];

    expect(discs).toHaveLength(2);
    expect(discs[1].light).toBeLessThan(discs[0].light);
    expect(discs[1].fixation).toBeLessThan(discs[0].fixation);
  });
});
