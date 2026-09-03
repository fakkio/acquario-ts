import {
  AQUARIUM_HEIGHT,
  AQUARIUM_WIDTH,
  BASELINE_BODY_RADIUS,
} from "./aquarium";
import {
  MAX_BODY_RADIUS,
  MIN_RADIUS_FACTOR,
  Organism,
  type OrganismView,
} from "./organism";
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

/**
 * The smallest body the world allows, the counterpart of `MAX_BODY_RADIUS`.
 * It lives here rather than beside its opposite in `organism.ts` because
 * nothing the simulation does needs it: the grid derives its cell size from
 * the largest body, and only tests ever ask how small a body can be.
 */
export const MIN_BODY_RADIUS = MIN_RADIUS_FACTOR * BASELINE_BODY_RADIUS;

/** A cursor over a seeded stream of unit draws, so a test that wants a
 * random-looking population wants the same one on every run. */
export function openDraws(seed: number): () => number {
  let current: RngStream = createRngStream(seed);

  return () => {
    const draw = nextRng(current);
    current = draw.stream;
    return draw.value;
  };
}

/**
 * A population scattered over the whole aquarium, every body wholly inside
 * the walls, each with a stream of its own so it can be stepped. Overlaps
 * between them are expected — placement does not look at who is already
 * there, which is exactly what makes it useful as a starting crowd.
 *
 * `size` sets the crowding, and the crowding is what most callers are
 * really choosing: the aquarium is fixed, so forty bodies is the world the
 * app runs and a few hundred is denser than v0.1 will ever get.
 */
export function randomPopulation(
  seed: number,
  size: number,
  minRadius = MIN_BODY_RADIUS,
  maxRadius = MAX_BODY_RADIUS,
): Organism[] {
  const draw = openDraws(seed);
  const population: Organism[] = [];

  for (let i = 0; i < size; i++) {
    const bodyRadius = minRadius + draw() * (maxRadius - minRadius);
    population.push(
      organismAt(
        bodyRadius + draw() * (AQUARIUM_WIDTH - 2 * bodyRadius),
        bodyRadius + draw() * (AQUARIUM_HEIGHT - 2 * bodyRadius),
        bodyRadius,
        i + 1,
      ),
    );
  }

  return population;
}

/**
 * How far the worst-placed body hangs outside the aquarium, negative while
 * every body is clear of every wall.
 *
 * A number rather than four assertions per body, because the tests that
 * check containment check it on every tick of a long run: a million
 * assertions cost more time than the run they are checking, and a single
 * carried worst case says the same thing.
 */
export function worstExcursion(population: readonly OrganismView[]): number {
  return population.reduce(
    (worst, organism) =>
      Math.max(
        worst,
        organism.bodyRadius - organism.x,
        organism.bodyRadius - organism.y,
        organism.x + organism.bodyRadius - AQUARIUM_WIDTH,
        organism.y + organism.bodyRadius - AQUARIUM_HEIGHT,
      ),
    Number.NEGATIVE_INFINITY,
  );
}
