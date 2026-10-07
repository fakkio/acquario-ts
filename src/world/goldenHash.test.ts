import {describe, expect, it} from "vitest";

import {
  FIXED_DT_MS,
  advance,
  createWorld,
  getCumulativeBirths,
  getCumulativeDeaths,
  getTick,
  hashState,
} from "./world";

/**
 * The minimal world's law, pinned. It began as M6's world (#59): M7 (#58)
 * rebuilt the genome and derived the body from it, and for a body with no
 * organelles every one of those changes had to be numerically nothing, so
 * the hash recorded on `develop` before M7 changed any code proved it.
 *
 * M7.5's law (ADR-0035, #70) changes that world on purpose, so the golden
 * value was re-recorded, and the commit says why: only the energy store has
 * a cap now, so respiration is no longer throttled by a full CO₂ store, and
 * the old value (`d22057a8`) can never come back. Every later law change
 * re-records it deliberately. What the test still guards is the roster's
 * own promise: an empty roster draws nothing and changes nothing, so the
 * hash never moves for any reason but the world's laws.
 *
 * The structural mutation law is wired into the world (#63), so this test
 * builds its world with an empty roster.
 *
 * 8000 ticks reach well past the first death (tick 1,477) and the first
 * birth (tick 6,307) on seed 1, so the hash covers mitosis, death and the
 * ledger moves both make, not only generation 0 drifting. Births came at
 * tick 125 under M6's law; with no CO₂ cap a parent's food store sits
 * lower, and breeding waits. The run costs about half a second, so it lives
 * in the unit suite and guards every commit.
 */
const SEED = 1;
const TICKS = 8000;
const GOLDEN_HASH = "93ab5e6b";

describe("the minimal world's golden hash", () => {
  it("is what the empty-roster Reference World hashes to at a fixed seed and tick", () => {
    // One tick per call: a single long `advance` would be cut short by its
    // catch-up cap.
    let world = createWorld(SEED, {roster: []});
    for (let tick = 0; tick < TICKS; tick++) {
      ({world} = advance(world, FIXED_DT_MS));
    }

    expect(getTick(world)).toBe(TICKS);
    // The pin is only worth something if the run reproduced and died;
    // a shorter run would leave the hash blind to both.
    expect(getCumulativeBirths(world)).toBeGreaterThan(0);
    expect(getCumulativeDeaths(world)).toBeGreaterThan(0);
    expect(hashState(world)).toBe(GOLDEN_HASH);
  });
});
