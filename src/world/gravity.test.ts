import {describe, expect, it} from "vitest";

import {AQUARIUM_HEIGHT} from "./aquarium";
import {G} from "./constants";
import type {OrganelleGene} from "./genome";
import {
  buoyantTorque,
  buoyantWeight,
  layoutMoments,
  NO_MOMENTS,
  type BodyAxis,
} from "./gravity";
import {ORGANELLE_TYPES, type OrganelleType} from "./organelles";
import {createRngStream, nextRng, type RngStream} from "./rng";

/**
 * Force and torque on random layouts and axes, against the per-organelle
 * definition restated here: each organelle weighs `aᵢ·(cᵢ − ρ_w(yᵢ))` at its
 * own depth, downwards, and pulls its arm's turned x. The closed forms in
 * `gravity.ts` are what a tick uses; this is what they must equal.
 */
const declarations = {
  ...ORGANELLE_TYPES,
  heavy: {...ORGANELLE_TYPES.float, density: 1.5},
};

const randomCase = (seed: number) => {
  let stream: RngStream = createRngStream(seed);
  const unit = (): number => {
    const draw = nextRng(stream);
    stream = draw.stream;
    return draw.value;
  };
  const count = 1 + Math.floor(unit() * 5);
  const organelles: OrganelleGene[] = [];
  for (let i = 0; i < count; i++) {
    organelles.push({
      type: (unit() < 0.5 ? "float" : "heavy") as unknown as OrganelleType,
      innovationId: i + 1,
      radius: 0.05 + 0.4 * unit(),
      x: 2 * unit() - 1,
      y: 2 * unit() - 1,
    });
  }
  const angle = 2 * Math.PI * unit();
  const axis: BodyAxis = {cos: Math.cos(angle), sin: Math.sin(angle)};
  const depth = unit() * AQUARIUM_HEIGHT;

  return {organelles, axis, depth};
};

describe("the Buoyant Weight and its torque", () => {
  it.each(Array.from({length: 50}, (_, seed) => seed + 1))(
    "equal the per-organelle definition on a random layout and axis (seed %d)",
    (seed) => {
      const {organelles, axis, depth} = randomCase(seed);
      const moments = layoutMoments(organelles, declarations);

      let weight = 0;
      let torque = 0;
      for (const organelle of organelles) {
        const {density} = declarations[organelle.type];
        if (density === "weightless") {
          continue;
        }
        const area = Math.PI * organelle.radius ** 2;
        const armX = axis.cos * organelle.x - axis.sin * organelle.y;
        const armY = axis.sin * organelle.x + axis.cos * organelle.y;
        const water = (depth + armY) / AQUARIUM_HEIGHT;
        const pull = G * area * (density - water);
        weight += pull;
        torque += armX * pull;
      }

      expect(buoyantWeight(moments, depth, axis)).toBeCloseTo(weight, 10);
      expect(buoyantTorque(moments, depth, axis)).toBeCloseTo(torque, 10);
    },
  );

  it("are zero for a body with nothing that weighs", () => {
    const axis = {cos: 0.6, sin: 0.8};

    expect(buoyantWeight(NO_MOMENTS, 10, axis)).toBe(0);
    expect(buoyantTorque(NO_MOMENTS, 10, axis)).toBe(0);
  });
});
