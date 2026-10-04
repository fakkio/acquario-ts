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
 * M6's world, pinned (#59). M7 (#58) rebuilds the genome, derives the body
 * from it, and moves caps and concentrations onto the Cytoplasm Area. For a
 * body with no organelles every one of those changes must be numerically
 * nothing, and this is the cheapest proof that it is: M6's Reference World,
 * the one the app runs, at a fixed seed and tick, hashing to the value M6's
 * own code produced. The golden value was recorded on `develop` before M7
 * changed any code, in the first commit of `feature/structural-genome`.
 *
 * The structural mutation law is wired into the world (#63), so this test builds
 * its world with an empty roster, and the hash it expects never changes.
 *
 * 2000 ticks reach well past the first death (tick 43) and the first birth
 * (tick 125) on seed 1, so the hash covers mitosis, death and the ledger
 * moves both make, not only generation 0 drifting. The run costs about a
 * tenth of a second, so it lives in the unit suite and guards every commit.
 */
const SEED = 1;
const TICKS = 2000;
const GOLDEN_HASH = "d22057a8";

describe("M6's golden hash", () => {
  it("is what M6's Reference World hashes to at a fixed seed and tick", () => {
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
