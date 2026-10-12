import {describe, expect, it} from "vitest";

import {
  BODY_COST_COEFFICIENT,
  C_NEURON,
  EXISTENCE_COST,
  K_CAP_ENERGY,
  K_CHLORO,
  K_DIFFUSION,
  K_PHOTO,
  K_RESP,
  RESPIRATION_ENERGY_YIELD,
} from "./constants";
import type {Environment, Vec2} from "./environment";
import {
  applyMaintenance,
  maintenanceBreakdown,
  applyPassiveExchange,
  applyPhotosynthesis,
  applyRespiration,
  type DiscReading,
} from "./metabolism";
import {BASELINE_GENOME} from "./genome";
import {ORGANELLE_TYPES} from "./organelles";
import {Organism, bodyArea, energyCap, type Diffusible} from "./organism";
import {createRngStream} from "./rng";
import {carrierAt, organismAt} from "./testing";

/**
 * Level 1 of the milestone's three testing levels: one reaction, one
 * organism, a stub `Environment` — no world, no pools, no other organism
 * involved. ADR-0006 promises the metabolic core is unit-testable at this
 * boundary, and this file is where that promise is collected for passive
 * exchange and photosynthesis.
 */

/**
 * A hand-built `Environment` that never scales and echoes back whatever
 * `exchange` is asked for, unless `grant` says otherwise — the "grant
 * pass" shape, since that is the one whose return value a test can see
 * land on the organism. `concentration` answers a fixed value per resource
 * regardless of position, which is honest: v0.1's real environments do the
 * same everywhere except `light`.
 */
function stubEnvironment(
  concentration: Record<Diffusible, number>,
  grant: (resource: Diffusible, amount: number) => number = (
    _resource,
    amount,
  ) => amount,
): Environment {
  return {
    concentration: (resource) => concentration[resource],
    light: () => 0,
    exchange: (resource, _pos: Vec2, amount) => grant(resource, amount),
  };
}

const AMBIENT_ZERO: Record<Diffusible, number> = {
  oxygen: 0,
  carbonDioxide: 0,
  food: 0,
};

describe("applyPassiveExchange", () => {
  it("draws from an environment richer than the organism", () => {
    const organism = organismAt(0, 0, 1);
    const area = bodyArea(organism);
    const perimeter = 2 * Math.PI * organism.bodyRadius;
    const environment = stubEnvironment({
      oxygen: 0,
      carbonDioxide: 0,
      food: 1,
    });

    applyPassiveExchange(organism, environment);

    const expectedFlux = K_DIFFUSION * perimeter * (1 - 0 / area);
    expect(organism.food).toBeCloseTo(expectedFlux, 12);
    expect(organism.food).toBeGreaterThan(0);
  });

  it("vents into an environment poorer than the organism", () => {
    const organism = organismAt(0, 0, 1);
    organism.oxygen = 2;
    const environment = stubEnvironment(AMBIENT_ZERO);

    applyPassiveExchange(organism, environment);

    expect(organism.oxygen).toBeLessThan(2);
  });

  it("moves nothing once internal concentration matches external", () => {
    const organism = organismAt(0, 0, 2);
    const area = bodyArea(organism);
    organism.food = 0.4 * area;
    organism.carbonDioxide = 0.4 * area;
    organism.oxygen = 0.4 * area;
    const environment = stubEnvironment({
      oxygen: 0.4,
      carbonDioxide: 0.4,
      food: 0.4,
    });

    applyPassiveExchange(organism, environment);

    expect(organism.food).toBeCloseTo(0.4 * area, 12);
    expect(organism.carbonDioxide).toBeCloseTo(0.4 * area, 12);
    expect(organism.oxygen).toBeCloseTo(0.4 * area, 12);
  });

  it("follows one signed law for all three diffusibles, drawing some and venting others in the same call", () => {
    const organism = organismAt(0, 0, 1);
    const area = bodyArea(organism);
    // Above ambient in oxygen (vents), below in the other two (draws).
    organism.oxygen = 2 * area;
    organism.carbonDioxide = 0;
    organism.food = 0;
    const environment = stubEnvironment({
      oxygen: 0,
      carbonDioxide: 1,
      food: 1,
    });

    applyPassiveExchange(organism, environment);

    expect(organism.oxygen).toBeLessThan(2 * area);
    expect(organism.carbonDioxide).toBeGreaterThan(0);
    expect(organism.food).toBeGreaterThan(0);
  });

  it("writes nothing when the environment always answers 0, as the request sub-pass does", () => {
    const organism = organismAt(0, 0, 1);
    const before = {
      oxygen: organism.oxygen,
      carbonDioxide: organism.carbonDioxide,
      food: organism.food,
    };
    // Away from ambient, so a real flux is computed and requested — the
    // environment's answer is what determines whether anything is written.
    const environment = stubEnvironment(
      {oxygen: 1, carbonDioxide: 1, food: 1},
      () => 0,
    );

    applyPassiveExchange(organism, environment);

    expect(organism.oxygen).toBe(before.oxygen);
    expect(organism.carbonDioxide).toBe(before.carbonDioxide);
    expect(organism.food).toBe(before.food);
  });

  it("ends up holding exactly what the environment grants, not what it requested", () => {
    const organism = organismAt(0, 0, 1);
    const area = bodyArea(organism);
    const environment = stubEnvironment(
      {oxygen: 0, carbonDioxide: 0, food: 1},
      (_resource, amount) => amount * 0.5,
    );

    applyPassiveExchange(organism, environment);

    const perimeter = 2 * Math.PI * organism.bodyRadius;
    const requested = K_DIFFUSION * perimeter * (1 - 0 / area);
    expect(organism.food).toBeCloseTo(requested * 0.5, 12);
  });

  it("asks the environment once per diffusible and never for energy", () => {
    const organism = organismAt(0, 0, 1);
    const seen: Diffusible[] = [];
    const environment = stubEnvironment(AMBIENT_ZERO, (resource, amount) => {
      seen.push(resource);
      return amount;
    });

    applyPassiveExchange(organism, environment);

    expect(seen.sort()).toEqual(["carbonDioxide", "food", "oxygen"]);
  });
});

/**
 * A stub `Environment` fixing `light` at whatever value the test wants and
 * echoing exchange requests straight back — photosynthesis never calls
 * `exchange`, so its answer never matters, only its shape does.
 */
function stubLightEnvironment(light: number): Environment {
  return {
    concentration: () => 0,
    light: () => light,
    exchange: (_resource, _pos, amount) => amount,
  };
}

describe("applyPhotosynthesis", () => {
  it("converts internal CO2 into food and oxygen at 1:1:1 stoichiometry", () => {
    const organism = organismAt(0, 0, 1);
    const area = bodyArea(organism);
    const diameter = 2 * organism.bodyRadius;
    organism.carbonDioxide = 0.5 * area;
    const co2Before = organism.carbonDioxide;

    applyPhotosynthesis(organism, stubLightEnvironment(1));

    const expectedFixed = K_PHOTO * (co2Before / area) * 1 * diameter;
    const co2Lost = co2Before - organism.carbonDioxide;
    expect(co2Lost).toBeCloseTo(expectedFixed, 12);
    expect(organism.food).toBeCloseTo(expectedFixed, 12);
    expect(organism.oxygen).toBeCloseTo(expectedFixed, 12);
  });

  it("produces no energy", () => {
    const organism = organismAt(0, 0, 1);
    organism.carbonDioxide = 0.5 * bodyArea(organism);
    organism.energy = 10;

    applyPhotosynthesis(organism, stubLightEnvironment(1));

    expect(organism.energy).toBe(10);
  });

  it("fixes nothing in complete darkness", () => {
    const organism = organismAt(0, 0, 1);
    organism.carbonDioxide = 0.5 * bodyArea(organism);
    const before = organism.carbonDioxide;

    applyPhotosynthesis(organism, stubLightEnvironment(0));

    expect(organism.carbonDioxide).toBe(before);
    expect(organism.food).toBe(0);
    expect(organism.oxygen).toBe(0);
  });

  it("fixes carbon measurably faster in the bright zone than near the floor, all else equal", () => {
    const bright = organismAt(0, 0, 1);
    const dim = organismAt(0, 0, 1);
    bright.carbonDioxide = 0.5 * bodyArea(bright);
    dim.carbonDioxide = 0.5 * bodyArea(dim);

    applyPhotosynthesis(bright, stubLightEnvironment(1));
    applyPhotosynthesis(dim, stubLightEnvironment(0.05));

    expect(bright.food).toBeGreaterThan(dim.food);
  });

  it("scales with the width the body projects toward the light", () => {
    const small = organismAt(0, 0, 1);
    const large = organismAt(0, 0, 2);
    // Same internal CO2 *concentration* on both, so only diameter differs.
    small.carbonDioxide = 0.2 * bodyArea(small);
    large.carbonDioxide = 0.2 * bodyArea(large);

    applyPhotosynthesis(small, stubLightEnvironment(1));
    applyPhotosynthesis(large, stubLightEnvironment(1));

    expect(large.food).toBeGreaterThan(small.food);
  });

  it("samples light at the body's centre", () => {
    const organism = organismAt(3, 7, 1);
    organism.carbonDioxide = 0.2 * bodyArea(organism);
    let seenPos: Vec2 | undefined;
    const environment: Environment = {
      concentration: () => 0,
      light: (pos) => {
        seenPos = pos;
        return 1;
      },
      exchange: (_resource, _pos, amount) => amount,
    };

    applyPhotosynthesis(organism, environment);

    expect(seenPos?.x).toBe(3);
    expect(seenPos?.y).toBe(7);
  });

  it("never drives CO2 below zero when substrate is exhausted", () => {
    const organism = organismAt(0, 0, 1);
    // A trickle of CO2 far too small for the rate the full store would
    // otherwise support at full light.
    organism.carbonDioxide = 1e-9;

    applyPhotosynthesis(organism, stubLightEnvironment(1));

    expect(organism.carbonDioxide).toBeGreaterThanOrEqual(0);
    expect(organism.food).toBeLessThanOrEqual(1e-9);
    expect(organism.oxygen).toBeLessThanOrEqual(1e-9);
  });

  // ADR-0035: food and O₂ have no cap, so a full store of either holds more
  // and never stops fixation.
  it("fixes at its rate whatever the food and oxygen stores hold", () => {
    const empty = organismAt(0, 0, 1);
    const stuffed = organismAt(0, 0, 1);
    const area = bodyArea(empty);
    empty.carbonDioxide = 0.2 * area;
    stuffed.carbonDioxide = 0.2 * area;
    stuffed.food = 5 * area;
    stuffed.oxygen = 5 * area;
    const rate = K_PHOTO * 0.2 * 1 * (2 * empty.bodyRadius);

    applyPhotosynthesis(empty, stubLightEnvironment(1));
    applyPhotosynthesis(stuffed, stubLightEnvironment(1));

    expect(empty.food).toBeCloseTo(rate, 12);
    expect(stuffed.food - 5 * area).toBeCloseTo(rate, 12);
    expect(stuffed.oxygen - 5 * area).toBeCloseTo(rate, 12);
  });

  it("is limited by the CO2 it has when that is below its rate", () => {
    const organism = organismAt(0, 0, 1);
    organism.carbonDioxide = 1e-9;

    applyPhotosynthesis(organism, stubLightEnvironment(1));

    expect(organism.carbonDioxide).toBeGreaterThanOrEqual(0);
    expect(organism.food).toBeLessThanOrEqual(1e-9);
  });

  it("discards no product: CO2 lost exactly matches food and oxygen gained", () => {
    const organism = organismAt(0, 0, 1);
    organism.carbonDioxide = 0.3 * bodyArea(organism);
    const before = {
      carbonDioxide: organism.carbonDioxide,
      food: organism.food,
      oxygen: organism.oxygen,
    };

    applyPhotosynthesis(organism, stubLightEnvironment(1));

    const co2Lost = before.carbonDioxide - organism.carbonDioxide;
    expect(co2Lost).toBeGreaterThan(0);
    expect(organism.food - before.food).toBeCloseTo(co2Lost, 12);
    expect(organism.oxygen - before.oxygen).toBeCloseTo(co2Lost, 12);
  });
});

/**
 * `applyRespiration` and `applyMaintenance` take no `Environment`: both are
 * purely internal, reading and writing only the organism they run for, so
 * there is nothing here for a stub to stand in for — the same reason
 * ADR-0006 calls the metabolic core testable "against a single organism
 * and a snapshot, with no world required".
 */
describe("applyRespiration", () => {
  it("converts internal food and oxygen into energy and CO2 at 1:1 stoichiometry on both ledgers", () => {
    const organism = organismAt(0, 0, 1);
    const area = bodyArea(organism);
    organism.food = 0.3 * area;
    organism.oxygen = 0.3 * area;
    organism.energy = 0;
    const before = {
      food: organism.food,
      oxygen: organism.oxygen,
      carbonDioxide: organism.carbonDioxide,
    };

    const outcome = applyRespiration(organism);

    const foodLost = before.food - organism.food;
    const oxygenLost = before.oxygen - organism.oxygen;
    const co2Gained = organism.carbonDioxide - before.carbonDioxide;
    expect(foodLost).toBeGreaterThan(0);
    expect(oxygenLost).toBeCloseTo(foodLost, 12);
    expect(co2Gained).toBeCloseTo(foodLost, 12);
    expect(outcome.energyProduced).toBeCloseTo(
      foodLost * RESPIRATION_ENERGY_YIELD,
      12,
    );
    expect(organism.energy).toBeCloseTo(outcome.energyProduced, 12);
  });

  it("follows mass action on internal food and oxygen, scaling with body area", () => {
    const small = organismAt(0, 0, 1);
    const large = organismAt(0, 0, 2);
    // Same internal *concentrations* on both, and caps generous enough that
    // neither is throttled by substrate or headroom — only area differs.
    small.food = 0.2 * bodyArea(small);
    small.oxygen = 0.2 * bodyArea(small);
    large.food = 0.2 * bodyArea(large);
    large.oxygen = 0.2 * bodyArea(large);

    const smallOutcome = applyRespiration(small);
    const largeOutcome = applyRespiration(large);

    expect(largeOutcome.energyProduced).toBeGreaterThan(
      smallOutcome.energyProduced,
    );
  });

  it("throttles continuously as internal oxygen falls, with no suffocation cliff", () => {
    const organism = organismAt(0, 0, 1);
    const area = bodyArea(organism);
    const outcomes: number[] = [];

    for (const oxygenConcentration of [0.5, 0.3, 0.1, 0.01, 0.001]) {
      organism.food = 0.5 * area;
      organism.oxygen = oxygenConcentration * area;
      organism.carbonDioxide = 0;
      organism.energy = 0;
      outcomes.push(applyRespiration(organism).energyProduced);
    }

    for (let i = 1; i < outcomes.length; i++) {
      expect(outcomes[i]).toBeLessThan(outcomes[i - 1]);
    }
    // No suffocation rule anywhere: even a trickle of oxygen still lets the
    // reaction run, rather than cutting off at some threshold.
    expect(outcomes[outcomes.length - 1]).toBeGreaterThan(0);
  });

  it("reacts to zero when food is exhausted", () => {
    const organism = organismAt(0, 0, 1);
    organism.food = 0;
    organism.oxygen = 0.5 * bodyArea(organism);
    const before = {
      carbonDioxide: organism.carbonDioxide,
      energy: organism.energy,
    };

    const outcome = applyRespiration(organism);

    expect(outcome.energyProduced).toBe(0);
    expect(organism.carbonDioxide).toBe(before.carbonDioxide);
    expect(organism.energy).toBe(before.energy);
  });

  it("never drives food or oxygen below zero when substrate is the limit", () => {
    const organism = organismAt(0, 0, 1);
    organism.food = 1e-9;
    organism.oxygen = bodyArea(organism);

    applyRespiration(organism);

    expect(organism.food).toBeGreaterThanOrEqual(0);
  });

  // ADR-0035, and #65's panel frozen into a test: a CO₂ store that is full,
  // or far over the ambient level, never starves an organism that has fuel.
  it("respires at its mass-action rate whatever its CO2, above ambient and above 1", () => {
    for (const co2Concentration of [0, 0.5, 1, 1.04, 3]) {
      const organism = organismAt(0, 0, 1);
      const area = bodyArea(organism);
      organism.food = 0.5 * area;
      organism.oxygen = 0.4 * area;
      organism.carbonDioxide = co2Concentration * area;
      organism.energy = 0;
      const rate = K_RESP * 0.5 * 0.4 * area;

      const outcome = applyRespiration(organism);

      expect(outcome.energyProduced).toBeCloseTo(
        rate * RESPIRATION_ENERGY_YIELD,
        12,
      );
      expect(outcome.throttledByFullEnergyStore).toBe(false);
      expect(organism.carbonDioxide).toBeCloseTo(
        co2Concentration * area + rate,
        12,
      );
    }
  });

  it("throttles by a full energy store, never spilling energy past its cap, and reports the throttle", () => {
    const organism = organismAt(0, 0, 1);
    organism.food = bodyArea(organism);
    organism.oxygen = bodyArea(organism);
    organism.energy = energyCap(organism) - 1e-9;

    const outcome = applyRespiration(organism);

    expect(organism.energy).toBeLessThanOrEqual(energyCap(organism));
    expect(outcome.throttledByFullEnergyStore).toBe(true);
  });

  it("reports the potential energy a full store would have throttled away (#75)", () => {
    const organism = organismAt(0, 0, 1);
    const area = bodyArea(organism);
    organism.food = 0.5 * area;
    organism.oxygen = 0.4 * area;
    const rate = K_RESP * 0.5 * 0.4 * area;
    organism.energy = energyCap(organism);

    const outcome = applyRespiration(organism);

    expect(outcome.energyProduced).toBe(0);
    expect(outcome.potentialEnergy).toBeCloseTo(
      rate * RESPIRATION_ENERGY_YIELD,
      12,
    );
  });

  it("does not report a full-energy throttle when substrate, not the energy cap, is what binds", () => {
    const organism = organismAt(0, 0, 1);
    organism.food = 1e-9;
    organism.oxygen = bodyArea(organism);
    organism.energy = 0;

    const outcome = applyRespiration(organism);

    expect(outcome.throttledByFullEnergyStore).toBe(false);
  });

  it("discards no product: food and oxygen lost match CO2 gained and the energy produced", () => {
    const organism = organismAt(0, 0, 1);
    const area = bodyArea(organism);
    organism.food = 0.4 * area;
    organism.oxygen = 0.4 * area;
    organism.energy = 0;
    const before = {
      food: organism.food,
      oxygen: organism.oxygen,
      carbonDioxide: organism.carbonDioxide,
    };

    const outcome = applyRespiration(organism);

    const foodLost = before.food - organism.food;
    expect(foodLost).toBeGreaterThan(0);
    expect(before.oxygen - organism.oxygen).toBeCloseTo(foodLost, 12);
    expect(organism.carbonDioxide - before.carbonDioxide).toBeCloseTo(
      foodLost,
      12,
    );
    expect(outcome.energyProduced).toBeCloseTo(
      foodLost * RESPIRATION_ENERGY_YIELD,
      12,
    );
  });

  // The chaining ADR-0006 requires — respiration reading the food
  // photosynthesis just produced, within the same tick — collected here at
  // the unit boundary: nothing but a plain function call orders these two.
  it("closes the cycle: an illuminated organism nets light into energy when photosynthesis runs first", () => {
    const organism = organismAt(0, 0, 1);
    organism.carbonDioxide = 0.5 * bodyArea(organism);
    organism.energy = 0;
    const lightEnvironment: Environment = {
      concentration: () => 0,
      light: () => 1,
      exchange: (_resource, _pos, amount) => amount,
    };

    applyPhotosynthesis(organism, lightEnvironment);
    const foodAfterPhotosynthesis = organism.food;
    const oxygenAfterPhotosynthesis = organism.oxygen;
    const outcome = applyRespiration(organism);

    expect(outcome.energyProduced).toBeGreaterThan(0);
    // Respiration draws down what photosynthesis just made in this same
    // tick, rather than leaving it to sit as a growing food store — the
    // substance of "nets light into energy within a single tick".
    expect(organism.food).toBeLessThan(foodAfterPhotosynthesis);
    expect(organism.oxygen).toBeLessThan(oxygenAfterPhotosynthesis);
  });
});

describe("maintenanceBreakdown", () => {
  it("sums to exactly what the tick charges, with and without neurons", () => {
    for (const organism of [
      organismAt(0, 0, 1.3),
      carrierAt(0, 0, [0.1]),
      carrierAt(0, 0, [0.05, 0.05, 0.3, 0.1]),
    ]) {
      organism.energy = 100;
      const breakdown = maintenanceBreakdown(organism);

      applyMaintenance(organism);

      expect(organism.energy).toBe(100 - breakdown.total);
      expect(breakdown.total).toBeCloseTo(
        breakdown.existence +
          breakdown.cytoplasm +
          breakdown.organelleOverheads +
          breakdown.organelleTissue,
        12,
      );
    }
  });

  it("splits a body with neurons into c₀, the cytoplasm's cost and the neurons' overheads and tissue", () => {
    const organism = carrierAt(0, 0, [0.1, 0.2]);
    const breakdown = maintenanceBreakdown(organism);

    expect(breakdown.existence).toBe(EXISTENCE_COST);
    expect(breakdown.cytoplasm).toBeCloseTo(
      BODY_COST_COEFFICIENT * organism.cytoplasmArea,
      12,
    );
    expect(breakdown.organelleOverheads).toBeCloseTo(2 * C_NEURON, 12);
    expect(breakdown.organelleTissue).toBeCloseTo(
      BODY_COST_COEFFICIENT * Math.PI * (0.1 * 0.1 + 0.2 * 0.2),
      12,
    );
  });

  it("has no organelle terms for a body without organelles", () => {
    const breakdown = maintenanceBreakdown(organismAt(0, 0, 1));

    expect(breakdown.organelleOverheads).toBe(0);
    expect(breakdown.organelleTissue).toBe(0);
  });
});

describe("applyMaintenance", () => {
  it("charges the flat existence cost plus the area-scaled body cost", () => {
    const organism = organismAt(0, 0, 1.3);
    organism.energy = 100; // comfortably above the cost, without swamping it in float cancellation

    const before = organism.energy;
    applyMaintenance(organism);

    const expectedCost =
      EXISTENCE_COST + BODY_COST_COEFFICIENT * bodyArea(organism);
    expect(before - organism.energy).toBeCloseTo(expectedCost, 12);
  });

  // ADR-0017: the floor moved out of this function and into `runTick`,
  // where it applies only to an immortal world. Unconditionally here means
  // a store too small to cover the cost is driven below zero rather than
  // clamped — the state a mortal world's death check reads at step 8.
  it("drives energy negative rather than clamping it at zero", () => {
    const organism = organismAt(0, 0, 1);
    organism.energy = 0.1; // far less than the cost

    const expectedCost =
      EXISTENCE_COST + BODY_COST_COEFFICIENT * bodyArea(organism);
    applyMaintenance(organism);

    expect(organism.energy).toBeCloseTo(0.1 - expectedCost, 12);
    expect(organism.energy).toBeLessThan(0);
  });

  it("drives an already-zero-energy organism further negative", () => {
    const organism = organismAt(0, 0, 1);
    organism.energy = 0;

    applyMaintenance(organism);

    expect(organism.energy).toBeLessThan(0);
  });
});

/**
 * M7's neuron (ADR-0029): an organelle takes space that holds no stores and
 * pays its own way. These run through the same single-organism helpers as
 * every test above, on a body whose Cytoplasm Area is not its whole area.
 */
describe("a body with neurons", () => {
  it("is charged c₀ + β·bodyArea + n·c_neuron in maintenance, the neurons' tissue at the cytoplasm's rate", () => {
    for (const radii of [[0.1], [0.1, 0.2], [0.05, 0.05, 0.3, 0.1]]) {
      const organism = carrierAt(0, 0, radii);
      organism.energy = 100;

      applyMaintenance(organism);

      expect(100 - organism.energy).toBeCloseTo(
        EXISTENCE_COST +
          BODY_COST_COEFFICIENT * bodyArea(organism) +
          radii.length * C_NEURON,
        12,
      );
    }
  });

  it("caps energy over its Cytoplasm Area, the body's area minus the neurons'", () => {
    const organism = carrierAt(0, 0, [0.2, 0.3]);
    const cytoplasmArea =
      bodyArea(organism) - Math.PI * (0.2 * 0.2 + 0.3 * 0.3);

    expect(energyCap(organism)).toBeCloseTo(K_CAP_ENERGY * cytoplasmArea, 9);
  });

  it("exchanges nothing once its stores over the Cytoplasm Area match the water outside", () => {
    // Over the whole body area these stores would read below ambient and
    // draw; over the cytoplasm they read exactly ambient.
    const organism = carrierAt(0, 0, [0.2, 0.3]);
    const cytoplasmArea =
      bodyArea(organism) - Math.PI * (0.2 * 0.2 + 0.3 * 0.3);
    organism.food = 0.4 * cytoplasmArea;
    organism.carbonDioxide = 0.4 * cytoplasmArea;
    organism.oxygen = 0.4 * cytoplasmArea;

    applyPassiveExchange(
      organism,
      stubEnvironment({oxygen: 0.4, carbonDioxide: 0.4, food: 0.4}),
    );

    expect(organism.food).toBeCloseTo(0.4 * cytoplasmArea, 12);
    expect(organism.carbonDioxide).toBeCloseTo(0.4 * cytoplasmArea, 12);
    expect(organism.oxygen).toBeCloseTo(0.4 * cytoplasmArea, 12);
  });

  it("respires at the rate its concentrations over the Cytoplasm Area set", () => {
    // Mass action, K·[food]·[O₂]·volume, with the cytoplasm as both the
    // denominator and the volume: at the same concentrations a carrier
    // reacts in proportion to the cytoplasm it has left, not to its body.
    const carrier = carrierAt(0, 0, [0.3, 0.3], 1);
    const bare = organismAt(0, 0, 1);
    const ratio = carrier.cytoplasmArea / bodyArea(bare);
    carrier.food = 0.01 * carrier.cytoplasmArea;
    carrier.oxygen = 0.01 * carrier.cytoplasmArea;
    bare.food = 0.01 * bodyArea(bare);
    bare.oxygen = 0.01 * bodyArea(bare);

    const carrierOutcome = applyRespiration(carrier);
    const bareOutcome = applyRespiration(bare);

    expect(carrierOutcome.energyProduced).toBeCloseTo(
      bareOutcome.energyProduced * ratio,
      12,
    );
  });
});

describe("applyPhotosynthesis on a chloroplast's disc", () => {
  interface Gene {
    type: "chloroplast" | "neuron";
    radius: number;
    x: number;
    y: number;
  }

  const bearer = (genes: readonly Gene[], x = 10, y = 20) => {
    return new Organism({
      x,
      y,
      genome: {
        ...BASELINE_GENOME,
        lineageHue: 0.5,
        genes: genes.map((gene, i) => ({...gene, innovationId: i + 1})),
      },
      rng: createRngStream(11),
    });
  };

  const lightBy = (light: (pos: Vec2) => number): Environment => ({
    concentration: () => 0,
    light,
    exchange: (_resource, _pos, amount) => amount,
  });

  const passiveOf = (organism: Organism, light: number): number =>
    K_PHOTO *
    (organism.carbonDioxide / organism.cytoplasmArea) *
    light *
    2 *
    organism.bodyRadius;

  const fixedBy = (organism: Organism, environment: Environment): number => {
    const before = organism.carbonDioxide;
    applyPhotosynthesis(organism, environment);
    return before - organism.carbonDioxide;
  };

  it("fixes kChloro x light x 2r x C on the disc, besides the passive term", () => {
    const organism = bearer([{type: "chloroplast", radius: 0.3, x: 0.2, y: 0}]);
    organism.carbonDioxide = 0.1;
    const concentration = organism.carbonDioxide / organism.cytoplasmArea;

    const fixed = fixedBy(
      organism,
      lightBy(() => 0.5),
    );

    expect(fixed).toBeCloseTo(
      K_PHOTO * concentration * 0.5 * 2 * organism.bodyRadius +
        K_CHLORO * concentration * 0.5 * 2 * 0.3,
      12,
    );
  });

  it("asks each disc for its own position, turned through the Body Axis", () => {
    const asked: Vec2[] = [];
    const organism = bearer([{type: "chloroplast", radius: 0.3, x: 0.4, y: 0}]);
    organism.axis.cos = 0;
    organism.axis.sin = 1;
    organism.carbonDioxide = 0.1;

    applyPhotosynthesis(
      organism,
      lightBy((pos) => {
        asked.push({x: pos.x, y: pos.y});
        return 1;
      }),
    );

    expect(asked).toHaveLength(2);
    expect(asked[1]?.x).toBeCloseTo(10, 12);
    expect(asked[1]?.y).toBeCloseTo(20.4, 12);
  });

  it("asks for mirrored depths when the same layout is upside down", () => {
    const depthsAsked = (cos: number): number[] => {
      const asked: number[] = [];
      const organism = bearer([
        {type: "chloroplast", radius: 0.3, x: 0, y: 0.4},
      ]);
      organism.axis.cos = cos;
      organism.axis.sin = 0;
      organism.carbonDioxide = 0.1;
      applyPhotosynthesis(
        organism,
        lightBy((pos) => {
          asked.push(pos.y);
          return 1;
        }),
      );
      return asked;
    };

    const upright = depthsAsked(1)[1];
    const upsideDown = depthsAsked(-1)[1];

    expect(upright - 20).toBeCloseTo(0.4, 12);
    expect(upsideDown - 20).toBeCloseTo(-0.4, 12);
  });

  it("fixes in proportion to the light each chloroplast reads", () => {
    const organism = bearer([
      {type: "chloroplast", radius: 0.3, x: 0, y: -0.4},
      {type: "chloroplast", radius: 0.3, x: 0, y: 0.4},
    ]);
    organism.carbonDioxide = 0.1;
    const concentration = organism.carbonDioxide / organism.cytoplasmArea;
    const disc = (light: number) => K_CHLORO * concentration * light * 0.6;

    const fixed = fixedBy(
      organism,
      lightBy((pos) => (pos.y < 20 ? 0.8 : pos.y > 20 ? 0.2 : 0)),
    );

    expect(fixed).toBeCloseTo(disc(0.8) + disc(0.2), 12);
  });

  it("empties the store exactly and keeps the shares when the demand exceeds it", () => {
    const organism = bearer([{type: "chloroplast", radius: 0.5, x: 0, y: 0}]);
    organism.carbonDioxide = 1e-3;
    const concentration = organism.carbonDioxide / organism.cytoplasmArea;
    const bodyShare = K_PHOTO * concentration * 2 * organism.bodyRadius;
    const discShare = K_CHLORO * concentration * 2 * 0.5;
    // A light that makes the demand twice the store.
    const light = (2 * organism.carbonDioxide) / (bodyShare + discShare);

    const fixed = fixedBy(
      organism,
      lightBy(() => light),
    );

    expect(organism.carbonDioxide).toBe(0);
    expect(fixed).toBeCloseTo(1e-3, 15);
  });

  it("reports the body's and the chloroplasts' shares as granted, summing to the carbon fixed", () => {
    for (const co2 of [0.1, 1e-4]) {
      const organism = bearer([
        {type: "chloroplast", radius: 0.3, x: 0, y: -0.4},
        {type: "chloroplast", radius: 0.2, x: 0, y: 0.4},
      ]);
      organism.carbonDioxide = co2;
      const before = organism.carbonDioxide;
      const readings: DiscReading[] = [];

      const outcome = applyPhotosynthesis(
        organism,
        lightBy((pos) => 1 / (1 + pos.y)),
        undefined,
        readings,
      );
      const fixed = before - organism.carbonDioxide;

      expect(outcome.body + outcome.chloroplasts).toBeCloseTo(fixed, 15);
      expect(readings).toHaveLength(2);
      expect(readings[0].fixation + readings[1].fixation).toBeCloseTo(
        outcome.chloroplasts,
        15,
      );
      expect(readings[1].light).toBeLessThan(readings[0].light);
    }
  });

  it("reports a chloroplast share of zero for a body with none", () => {
    const organism = bearer([]);
    organism.carbonDioxide = 0.1;

    const outcome = applyPhotosynthesis(
      organism,
      lightBy(() => 0.5),
    );

    expect(outcome.chloroplasts).toBe(0);
    expect(outcome.body).toBeGreaterThan(0);
  });

  it("conserves internal carbon and oxygen", () => {
    const organism = bearer([
      {type: "chloroplast", radius: 0.3, x: 0.3, y: 0},
      {type: "chloroplast", radius: 0.2, x: -0.3, y: 0.2},
    ]);
    organism.carbonDioxide = 0.5;
    organism.food = 0.1;
    organism.oxygen = 0.2;
    const carbon = organism.carbonDioxide + organism.food;
    const oxygen = organism.oxygen - organism.food;

    applyPhotosynthesis(
      organism,
      lightBy(() => 0.7),
    );

    expect(organism.carbonDioxide + organism.food).toBeCloseTo(carbon, 12);
    expect(organism.oxygen - organism.food).toBeCloseTo(oxygen, 12);
  });

  it("fixes nothing on the disc of a type with no coefficient or a zero one", () => {
    const withNeuron = bearer([{type: "neuron", radius: 0.3, x: 0, y: 0}]);
    withNeuron.carbonDioxide = 0.1;
    const zeroed = bearer([{type: "chloroplast", radius: 0.3, x: 0, y: 0}]);
    zeroed.carbonDioxide = 0.1;
    const declarations = {
      ...ORGANELLE_TYPES,
      chloroplast: {...ORGANELLE_TYPES.chloroplast, photosynthesis: 0},
    };
    const environment = lightBy(() => 1);

    const neuronPassive = passiveOf(withNeuron, 1);
    const zeroedPassive = passiveOf(zeroed, 1);

    applyPhotosynthesis(withNeuron, environment);
    applyPhotosynthesis(zeroed, environment, declarations);

    // Same concentration; the neuron's body only differs by its area.
    expect(withNeuron.food).toBeCloseTo(neuronPassive, 12);
    expect(zeroed.food).toBeCloseTo(zeroedPassive, 12);
  });

  it("declares the chloroplast as the neuron's laws at density 3/2 with kChloro", () => {
    const {chloroplast, neuron} = ORGANELLE_TYPES;

    expect(chloroplast.parameters).toEqual(neuron.parameters);
    expect(chloroplast.density).toBe(1.5);
    expect(chloroplast.photosynthesis).toBe(K_CHLORO);
    expect(chloroplast.overhead).toBe(ORGANELLE_TYPES.float.overhead);
    expect(chloroplast.tissueCost).toBe(neuron.tissueCost);
  });
});
