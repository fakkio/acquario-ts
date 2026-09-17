import {describe, expect, it} from "vitest";

import {
  BODY_COST_COEFFICIENT,
  EXISTENCE_COST,
  K_DIFFUSION,
  K_PHOTO,
  RESPIRATION_ENERGY_YIELD,
} from "./constants";
import type {Environment, Vec2} from "./environment";
import {
  applyMaintenance,
  applyPassiveExchange,
  applyPhotosynthesis,
  applyRespiration,
} from "./metabolism";
import {bodyArea, capFor, type Diffusible} from "./organism";
import {organismAt} from "./testing";

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

  it("fixes carbon measurably faster in the photic zone than near the floor, all else equal", () => {
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

  it("never pushes food past its cap when food headroom is the binding limit", () => {
    const organism = organismAt(0, 0, 1);
    organism.carbonDioxide = bodyArea(organism); // plenty of substrate
    organism.food = capFor(organism, "food") - 1e-9; // almost full

    applyPhotosynthesis(organism, stubLightEnvironment(1));

    expect(organism.food).toBeLessThanOrEqual(capFor(organism, "food"));
  });

  it("never pushes oxygen past its cap when oxygen headroom is the binding limit", () => {
    const organism = organismAt(0, 0, 1);
    organism.carbonDioxide = bodyArea(organism);
    organism.oxygen = capFor(organism, "oxygen") - 1e-9;

    applyPhotosynthesis(organism, stubLightEnvironment(1));

    expect(organism.oxygen).toBeLessThanOrEqual(capFor(organism, "oxygen"));
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

  it("never pushes CO2 past its cap when CO2 headroom is the binding limit", () => {
    const organism = organismAt(0, 0, 1);
    organism.food = bodyArea(organism);
    organism.oxygen = bodyArea(organism);
    organism.carbonDioxide = capFor(organism, "carbonDioxide") - 1e-9;
    organism.energy = 0;

    applyRespiration(organism);

    expect(organism.carbonDioxide).toBeLessThanOrEqual(
      capFor(organism, "carbonDioxide"),
    );
  });

  it("throttles by a full energy store, never spilling energy past its cap, and reports the throttle", () => {
    const organism = organismAt(0, 0, 1);
    organism.food = bodyArea(organism);
    organism.oxygen = bodyArea(organism);
    organism.energy = capFor(organism, "energy") - 1e-9;

    const outcome = applyRespiration(organism);

    expect(organism.energy).toBeLessThanOrEqual(capFor(organism, "energy"));
    expect(outcome.throttledByFullEnergyStore).toBe(true);
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

describe("applyMaintenance", () => {
  it("charges the flat existence cost plus the area-scaled body cost", () => {
    const organism = organismAt(0, 0, 1.3);
    organism.energy = 10_000; // comfortably above the cost

    const before = organism.energy;
    applyMaintenance(organism);

    const expectedCost =
      EXISTENCE_COST + BODY_COST_COEFFICIENT * bodyArea(organism);
    expect(before - organism.energy).toBeCloseTo(expectedCost, 12);
  });

  it("clamps energy at zero rather than driving it negative", () => {
    const organism = organismAt(0, 0, 1);
    organism.energy = 0.1; // far less than the cost

    applyMaintenance(organism);

    expect(organism.energy).toBe(0);
  });

  it("leaves an already-zero-energy organism at zero", () => {
    const organism = organismAt(0, 0, 1);
    organism.energy = 0;

    applyMaintenance(organism);

    expect(organism.energy).toBe(0);
  });
});
