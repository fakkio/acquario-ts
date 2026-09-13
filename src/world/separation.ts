import type {UniformGrid} from "./grid";
import type {Organism} from "./organism";

/**
 * Volume exclusion, per ADR-0008: overlapping bodies are displaced apart
 * along the normal joining their centres, split in proportion to `1/area`.
 *
 * Positional separation, not a collision response. There are no impulses, no
 * restitution and no momentum, because there is nowhere to put them: motion
 * is overdamped, so a body carries no velocity between ticks and there is no
 * state a collision could write to except position. Moving the bodies is the
 * whole of it.
 *
 * This is what makes one organism's existence cost another anything. Light is
 * the only spatially localised resource in v0.1, so a body standing where
 * another wanted to stand is the only interaction the milestone has.
 */

/**
 * The pass runs **once per tick**, exactly as ADR-0008 reads. That is a cost
 * decision and it has a visible consequence: a single pass does not drive a
 * crowded cluster to zero overlap, because each body is pushed out of all its
 * neighbours at once and can land inside a different one. Overlap therefore
 * *decays across ticks* rather than vanishing within one, which is why the
 * milestone's invariant is stated as a ceiling on a live run rather than as
 * "no overlaps".
 *
 * The alternatives both cost more for less: K passes multiply the pair-finding
 * work by K, and iterating to a tolerance makes the per-tick cost vary with
 * how crowded the world happens to be — the one thing an unattended 100k-tick
 * run cannot budget for. The buffered shape below supports a fixed K without
 * redesign if a dense run ever turns out to hold an overlap floor rather than
 * settling.
 *
 * Corrections accumulate in a buffer and are applied after every pair has been
 * looked at, so no body is ever measured against a neighbour that has already
 * moved this tick. Order-independence is structural rather than argued: a body
 * reads its neighbours and writes only its own slot in the buffer, so the
 * population can be visited in any order — the same restriction that makes
 * ADR-0006's resolve phase order-independent, applied to a commit-phase pass.
 * It is also why each pair is measured twice, once from each end, rather than
 * once with the two corrections written together: half the arithmetic, at the
 * price of the bookkeeping that decides which end of a pair owns it, and that
 * bookkeeping is exactly where visit order would get back in.
 *
 * Pairs come from `grid`, the tick's uniform grid, so finding them costs a
 * bounded number of cells per body rather than a scan of the population. The
 * grid is passed in rather than built here: it belongs to the tick that built
 * it (ADR-0012) and must not outlive it, and a pass that built its own would
 * be one more place a stale grid could be kept.
 */
export function separateOverlaps(
  population: readonly Organism[],
  grid: UniformGrid,
): void {
  const correctionX = new Float64Array(population.length);
  const correctionY = new Float64Array(population.length);

  forEachNeighbour(population, grid, (index, organism, other) => {
    const penetration = penetrationBetween(organism, other);
    if (penetration <= 0) {
      return;
    }

    // Recovered rather than measured again: it is the same subtraction the
    // penetration came from, read the other way round.
    const distance = organism.bodyRadius + other.bodyRadius - penetration;
    if (distance === 0) {
      // Two centres in exactly the same place have no normal to separate
      // along, and any direction invented here would have to be invented
      // identically by the other body to stay symmetric. Left alone instead:
      // brownian motion moves them apart on the next tick, and the pass
      // after that separates them.
      return;
    }

    const displacement = (penetration * shareOf(organism, other)) / distance;
    correctionX[index] += (organism.x - other.x) * displacement;
    correctionY[index] += (organism.y - other.y) * displacement;
  });

  for (let i = 0; i < population.length; i++) {
    population[i].x += correctionX[i];
    population[i].y += correctionY[i];
  }
}

/**
 * The deepest any two bodies currently overlap, and zero when none do.
 *
 * M1's invariant, in the one form that can be read live: the HUD shows this
 * every frame the way total carbon will from M2, so a run that starts holding
 * a persistent overlap floor is visible while it happens rather than only in
 * a test that happened to be written for it.
 */
export function worstPenetration(
  population: readonly Organism[],
  grid: UniformGrid,
): number {
  let worst = 0;

  forEachNeighbour(population, grid, (_index, organism, other) => {
    worst = Math.max(worst, penetrationBetween(organism, other));
  });

  return worst;
}

/**
 * Every body paired with every other body that could be touching it, once
 * each way round. The pass and the readout both want that sweep and want
 * nothing else from the grid, so it is written once: a second copy is a
 * second place the query's radius could be got wrong, and getting it wrong
 * fails silently — the pairs that go missing are the near-touching ones
 * nobody notices until a body walks through another.
 *
 * The radius handed to `query` is the body's own, not a diameter: the grid
 * answers with every body that could touch a circle of that size, and two
 * bodies overlap exactly when their centres are closer than the sum of their
 * radii. The candidates it returns are a superset, so `visit` still owes the
 * precise distance test — that division of labour is what makes the grid
 * cheap (ADR-0012).
 *
 * One query per body, and a body is never handed itself. `visit` gets the
 * body's index as well as the body, because the one caller that writes
 * anything writes to a buffer rather than to the organism.
 */
function forEachNeighbour(
  population: readonly Organism[],
  grid: UniformGrid,
  visit: (index: number, organism: Organism, other: Organism) => void,
): void {
  for (let i = 0; i < population.length; i++) {
    const organism = population[i];

    for (const other of grid.query(
      organism.x,
      organism.y,
      organism.bodyRadius,
    )) {
      if (other !== organism) {
        visit(i, organism, other);
      }
    }
  }
}

/**
 * How deep two bodies stand inside one another: positive when their circles
 * intersect, zero when they merely touch, negative when they stand clear.
 *
 * The one place the contact rule is written, so the pass and the readout
 * cannot come to disagree about what an overlap is.
 */
function penetrationBetween(a: Organism, b: Organism): number {
  return a.bodyRadius + b.bodyRadius - Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * The fraction of a pair's overlap that `organism` gives up, in proportion to
 * `1/area` — so a body twice as wide as its neighbour moves a quarter as far,
 * and a pair of equals splits the overlap down the middle.
 *
 * Area is `πr²` and the π cancels between the two bodies, so it never appears.
 * The two shares of a pair sum to exactly 1, which is what makes a single
 * isolated pair end the pass touching rather than still overlapping or blown
 * apart.
 *
 * `1/area` rather than `1/radius` is the mass reading: bodies are uniform
 * discs, so area is what a body would have to be, and the heavier body of a
 * pair should be the one that yields less.
 */
function shareOf(organism: Organism, other: Organism): number {
  const own = organism.bodyRadius * organism.bodyRadius;
  const theirs = other.bodyRadius * other.bodyRadius;

  return theirs / (own + theirs);
}
