import {describe, expect, it} from "vitest";

import {K_DIFFUSION} from "./constants";
import type {Environment, Vec2} from "./environment";
import {applyPassiveExchange} from "./metabolism";
import {bodyArea, type Diffusible} from "./organism";
import {organismAt} from "./testing";

/**
 * Level 1 of the milestone's three testing levels: one reaction, one
 * organism, a stub `Environment` — no world, no pools, no other organism
 * involved. ADR-0006 promises the metabolic core is unit-testable at this
 * boundary, and this file is where that promise is collected for passive
 * exchange.
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
