import {BASELINE_BODY_RADIUS} from "./aquarium";
import {Organism} from "./organism";
import {createRngStream, nextRng, type RngStream} from "./rng";

/**
 * Fixtures shared between this module's test files. Not test code itself, so
 * it carries no `describe`: it exists because the alternative is every new
 * test file in `world/` opening with its own copy of the two helpers below,
 * and the copies drifting apart until two files mean different things by the
 * same fixture.
 */

/**
 * An organism placed by hand. `seed` picks its stream, so a test that cares
 * which numbers a body draws can pin one and a test that only needs a body
 * somewhere can ignore it.
 */
export function organismAt(
  x: number,
  y: number,
  bodyRadius = BASELINE_BODY_RADIUS,
  seed = 11,
): Organism {
  return new Organism({
    x,
    y,
    bodyRadius,
    lineageHue: 200,
    rng: createRngStream(seed),
  });
}

/**
 * Seeded Fisher-Yates, so the permutation is a real shuffle and still the
 * same one on every run. Mutates and returns the array it is handed.
 */
export function shuffle(items: Organism[], stream: RngStream): Organism[] {
  let current = stream;

  for (let i = items.length - 1; i > 0; i--) {
    const draw = nextRng(current);
    current = draw.stream;
    const j = Math.floor(draw.value * (i + 1));
    [items[i], items[j]] = [items[j], items[i]] as [Organism, Organism];
  }

  return items;
}
