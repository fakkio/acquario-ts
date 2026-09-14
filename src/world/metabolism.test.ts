import {describe, expect, it} from "vitest";

import {K_DIFFUSION, K_PHOTO} from "./constants";
import type {Environment, Vec2} from "./environment";
import {applyPassiveExchange, applyPhotosynthesis} from "./metabolism";
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
