import {describe, expect, it} from "vitest";

import {AQUARIUM_AREA} from "./aquarium";
import {ExchangeSettlement} from "./environment";
import type {Pools} from "./ledger";

/**
 * Level 2 of the milestone's three testing levels: the pools alone, no
 * organisms involved. Proportional scaling under demand that exceeds the
 * pool is the partial-fulfilment path ADR-0005 exists to establish, tested
 * here directly against `ExchangeSettlement` rather than through whichever
 * metabolic routine happens to call it.
 */

const POOLS: Pools = {oxygen: 10, carbonDioxide: 10, food: 10};
const ORIGIN = {x: 0, y: 0};

describe("ExchangeSettlement", () => {
  describe("concentration and light", () => {
    it("reads a pool's concentration as amount over the aquarium's area, in both sub-passes", () => {
      const settlement = new ExchangeSettlement(POOLS);

      expect(settlement.requestPass().concentration("food", ORIGIN)).toBe(
        POOLS.food / AQUARIUM_AREA,
      );
      expect(settlement.grantPass().concentration("food", ORIGIN)).toBe(
        POOLS.food / AQUARIUM_AREA,
      );
    });
  });

  describe("the request sub-pass", () => {
    it("always answers 0, whatever is requested", () => {
      const settlement = new ExchangeSettlement(POOLS);
      const request = settlement.requestPass();

      expect(request.exchange("food", ORIGIN, 7)).toBe(0);
      expect(request.exchange("food", ORIGIN, -7)).toBe(0);
    });
  });

  describe("proportional scaling", () => {
    it("grants a draw in full when total demand is within the pool", () => {
      const settlement = new ExchangeSettlement(POOLS);
      const request = settlement.requestPass();
      request.exchange("food", ORIGIN, 3);
      request.exchange("food", ORIGIN, 4);

      settlement.settle();
      const grant = settlement.grantPass();

      expect(grant.exchange("food", ORIGIN, 3)).toBeCloseTo(3, 12);
      expect(grant.exchange("food", ORIGIN, 4)).toBeCloseTo(4, 12);
    });

    it("scales every draw on a pool down by the same factor when total demand exceeds it", () => {
      const settlement = new ExchangeSettlement(POOLS);
      const request = settlement.requestPass();
      // Total demand 20 against a pool of 10: every draw is halved.
      request.exchange("food", ORIGIN, 8);
      request.exchange("food", ORIGIN, 12);

      settlement.settle();
      const grant = settlement.grantPass();

      expect(grant.exchange("food", ORIGIN, 8)).toBeCloseTo(4, 12);
      expect(grant.exchange("food", ORIGIN, 12)).toBeCloseTo(6, 12);
    });

    it("never grants more than the pool holds, across every draw on it", () => {
      const settlement = new ExchangeSettlement({
        oxygen: 0,
        carbonDioxide: 0,
        food: 5,
      });
      const request = settlement.requestPass();
      const draws = [3, 3, 3, 3];
      for (const amount of draws) {
        request.exchange("food", ORIGIN, amount);
      }

      settlement.settle();
      const grant = settlement.grantPass();
      const totalGranted = draws.reduce(
        (sum, amount) => sum + grant.exchange("food", ORIGIN, amount),
        0,
      );

      expect(totalGranted).toBeLessThanOrEqual(5);
      expect(totalGranted).toBeCloseTo(5, 9);
    });

    it("never scales a vent down, even against an empty pool", () => {
      const settlement = new ExchangeSettlement({
        oxygen: 0,
        carbonDioxide: 0,
        food: 0,
      });
      const request = settlement.requestPass();
      request.exchange("food", ORIGIN, 6);

      settlement.settle();
      const grant = settlement.grantPass();

      expect(grant.exchange("food", ORIGIN, -9)).toBe(-9);
    });

    it("scales each pool independently, one resource's shortage leaving another untouched", () => {
      const settlement = new ExchangeSettlement(POOLS);
      const request = settlement.requestPass();
      request.exchange("food", ORIGIN, 20); // exceeds the pool
      request.exchange("oxygen", ORIGIN, 4); // within the pool

      settlement.settle();
      const grant = settlement.grantPass();

      expect(grant.exchange("food", ORIGIN, 20)).toBeCloseTo(10, 12);
      expect(grant.exchange("oxygen", ORIGIN, 4)).toBeCloseTo(4, 12);
    });
  });

  describe("commit", () => {
    it("applies no grant as no change to the pools", () => {
      const settlement = new ExchangeSettlement(POOLS);
      settlement.settle();

      expect(settlement.commit()).toEqual(POOLS);
    });

    it("subtracts a draw from its pool exactly once", () => {
      const settlement = new ExchangeSettlement(POOLS);
      const request = settlement.requestPass();
      request.exchange("food", ORIGIN, 3);

      settlement.settle();
      const grant = settlement.grantPass();
      grant.exchange("food", ORIGIN, 3);

      expect(settlement.commit()).toEqual({
        oxygen: 10,
        carbonDioxide: 10,
        food: 7,
      });
    });

    it("adds a vent to its pool", () => {
      const settlement = new ExchangeSettlement(POOLS);
      const grant = settlement.grantPass();
      grant.exchange("oxygen", ORIGIN, -4);

      expect(settlement.commit().oxygen).toBeCloseTo(14, 12);
    });

    it("accumulates every grant made across the whole pass before committing", () => {
      const settlement = new ExchangeSettlement(POOLS);
      const request = settlement.requestPass();
      request.exchange("food", ORIGIN, 2);
      request.exchange("food", ORIGIN, 2);
      request.exchange("food", ORIGIN, 2);

      settlement.settle();
      const grant = settlement.grantPass();
      grant.exchange("food", ORIGIN, 2);
      grant.exchange("food", ORIGIN, 2);
      grant.exchange("food", ORIGIN, 2);

      expect(settlement.commit().food).toBeCloseTo(4, 12);
    });
  });
});
