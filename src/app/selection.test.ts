import {describe, expect, it} from "vitest";

import type {OrganismView} from "../world";
import {
  DEATH_NOTICE_MS,
  NO_SELECTION,
  pickOrganism,
  updateSelection,
} from "./selection";

const disc = (x: number, y: number, bodyRadius: number): OrganismView =>
  ({x, y, bodyRadius}) as OrganismView;

describe("pickOrganism", () => {
  it("returns null on empty water", () => {
    expect(pickOrganism([disc(0, 0, 1)], 5, 5)).toBeNull();
    expect(pickOrganism([], 0, 0)).toBeNull();
  });

  it("picks the body whose disc contains the point, edge included", () => {
    const body = disc(2, 2, 1);

    expect(pickOrganism([body], 2.5, 2)).toBe(body);
    expect(pickOrganism([body], 3, 2)).toBe(body);
    expect(pickOrganism([body], 3.01, 2)).toBeNull();
  });

  it("picks the nearest centre when discs overlap", () => {
    const big = disc(0, 0, 3);
    const small = disc(2, 0, 1);

    expect(pickOrganism([big, small], 1.8, 0)).toBe(small);
    expect(pickOrganism([big, small], 0.5, 0)).toBe(big);
  });
});

describe("updateSelection", () => {
  const organism = disc(0, 0, 1);

  it("keeps an alive selection while its organism is in the population", () => {
    const selection = {kind: "alive", organism} as const;

    expect(updateSelection(selection, [organism], 10, 0)).toBe(selection);
  });

  it("turns into a death notice carrying the tick once the organism is gone", () => {
    const next = updateSelection({kind: "alive", organism}, [], 42, 1000);

    expect(next).toEqual({kind: "dead", tick: 42, sinceMs: 1000});
  });

  it("clears the death notice after its time, and not before", () => {
    const notice = {kind: "dead", tick: 42, sinceMs: 1000} as const;

    expect(updateSelection(notice, [], 50, 1000 + DEATH_NOTICE_MS - 1)).toBe(
      notice,
    );
    expect(updateSelection(notice, [], 50, 1000 + DEATH_NOTICE_MS)).toBe(
      NO_SELECTION,
    );
  });

  it("leaves no selection alone", () => {
    expect(updateSelection(NO_SELECTION, [organism], 0, 0)).toBe(NO_SELECTION);
  });
});
