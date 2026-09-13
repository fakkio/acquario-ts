import {describe, expect, it} from "vitest";

import {
  AQUARIUM_HEIGHT,
  AQUARIUM_WIDTH,
  BASELINE_BODY_RADIUS,
} from "./aquarium";
import {buildUniformGrid, type UniformGrid} from "./grid";
import {applyBrownianMotion, constrainToAquarium} from "./motion";
import {MAX_BODY_RADIUS, type Organism} from "./organism";
import {createRngStream} from "./rng";
import {separateOverlaps, worstPenetration} from "./separation";
import {
  MIN_BODY_RADIUS,
  openDraws,
  organismAt,
  randomPopulation,
  shuffle,
  worstExcursion,
} from "./testing";

const CENTRE_Y = AQUARIUM_HEIGHT / 2;

/**
 * Below this, two bodies are touching rather than overlapping. Wide enough to
 * swallow the rounding of a few thousand displacements, far narrower than any
 * overlap the pass would leave behind on purpose.
 */
const TOUCHING_EPSILON = 1e-9;

/** One tick's worth of the commit phase's step 10, with the resolve phase's
 * motion left out — the form the settling tests need. */
const separate = (population: readonly Organism[]): void => {
  separateOverlaps(population, buildUniformGrid(population));
};

const penetrationOf = (population: readonly Organism[]): number =>
  worstPenetration(population, buildUniformGrid(population));

/**
 * The exact answer `worstPenetration` is a grid-accelerated version of. Every
 * pair, no index, no candidate set — the oracle the readout is checked
 * against, the way the grid itself is checked against a brute-force scan.
 */
const bruteForceWorstPenetration = (
  population: readonly Organism[],
): number => {
  let worst = 0;
  for (let i = 0; i < population.length; i++) {
    for (let j = i + 1; j < population.length; j++) {
      const a = population[i];
      const b = population[j];
      worst = Math.max(
        worst,
        a.bodyRadius + b.bodyRadius - Math.hypot(a.x - b.x, a.y - b.y),
      );
    }
  }

  return worst;
};

const positionsOf = (population: readonly Organism[]) =>
  population.map((organism) => ({x: organism.x, y: organism.y}));

const distanceBetween = (a: Organism, b: Organism): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

/** The commit phase's step 10, whole: separate, then put back inside. */
const commitStep10 = (population: readonly Organism[]): void => {
  separate(population);
  for (const organism of population) {
    constrainToAquarium(organism);
  }
};

/** Runs the crowd until it is merely touching, and says on which tick that
 * happened — or −1 if it never did. */
const settle = (population: readonly Organism[], budget: number): number => {
  for (let tick = 0; tick < budget; tick++) {
    commitStep10(population);
    if (penetrationOf(population) <= TOUCHING_EPSILON) {
      return tick;
    }
  }

  return -1;
};

/** A deliberate pile-up: every body inside one small box, so almost every
 * pair starts overlapping and the pass has to untangle all of it at once. */
function pileUp(seed: number, size: number, span: number): Organism[] {
  const draw = openDraws(seed);
  const population: Organism[] = [];

  for (let i = 0; i < size; i++) {
    population.push(
      organismAt(
        AQUARIUM_WIDTH / 2 + (draw() - 0.5) * span,
        AQUARIUM_HEIGHT / 2 + (draw() - 0.5) * span,
        MIN_BODY_RADIUS + draw() * (MAX_BODY_RADIUS - MIN_BODY_RADIUS),
        i + 1,
      ),
    );
  }

  return population;
}

/** A real grid that counts the questions asked of it, so a test can say where
 * the pass got its pairs from rather than trusting that it used the grid. */
function countingGrid(population: readonly Organism[]): {
  readonly grid: UniformGrid;
  queries: () => number;
} {
  const grid = buildUniformGrid(population);
  let queries = 0;

  return {
    grid: {
      ...grid,
      query(x, y, radius) {
        queries += 1;
        return grid.query(x, y, radius);
      },
    },
    queries: () => queries,
  };
}

describe("separateOverlaps", () => {
  it("leaves a pair standing clear of each other exactly where it is", () => {
    const population = [
      organismAt(10, CENTRE_Y),
      organismAt(10 + 2 * BASELINE_BODY_RADIUS + 0.5, CENTRE_Y),
    ];
    const before = positionsOf(population);

    separate(population);

    expect(positionsOf(population)).toEqual(before);
  });

  // Touching is not overlapping: a body resting against a neighbour has to
  // stay resting against it, or a settled crowd would keep drifting apart
  // forever on nothing.
  it("leaves a pair that is exactly touching exactly where it is", () => {
    const population = [
      organismAt(10, CENTRE_Y),
      organismAt(10 + 2 * BASELINE_BODY_RADIUS, CENTRE_Y),
    ];
    const before = positionsOf(population);

    separate(population);

    expect(positionsOf(population)).toEqual(before);
  });

  it("pushes an overlapping pair apart until it just touches", () => {
    const population = [organismAt(10, CENTRE_Y), organismAt(11.5, CENTRE_Y)];

    separate(population);

    expect(population[0].x).toBeCloseTo(9.75, 12);
    expect(population[1].x).toBeCloseTo(11.75, 12);
    expect(distanceBetween(population[0], population[1])).toBeCloseTo(2, 12);
  });

  // Along the normal and along nothing else: a displacement with a component
  // across the normal would be sliding the pair sideways, which is a force
  // the contact has no reason to exert.
  it("displaces a diagonal pair along the normal joining their centres", () => {
    const population = [organismAt(20, 20), organismAt(21, 21)];
    const before = positionsOf(population);

    separate(population);

    for (const [i, organism] of population.entries()) {
      const moved = {
        x: organism.x - before[i].x,
        y: organism.y - before[i].y,
      };
      // The normal here runs at 45°, so the two components of a displacement
      // along it are equal in size.
      expect(Math.abs(moved.x)).toBeCloseTo(Math.abs(moved.y), 12);
    }
    expect(distanceBetween(population[0], population[1])).toBeCloseTo(2, 12);
  });

  // `1/area`, not `1/radius`: a body twice as wide has four times the area,
  // so it yields a quarter as much. The distinction is the whole reason the
  // rule is written as areas.
  it("splits the displacement in proportion to 1/area, so the larger body moves less", () => {
    const small = organismAt(10, CENTRE_Y, 1);
    const large = organismAt(12, CENTRE_Y, 2);

    separate([small, large]);

    const movedSmall = 10 - small.x;
    const movedLarge = large.x - 12;
    expect(movedLarge / movedSmall).toBeCloseTo(0.25, 12);
    expect(movedSmall + movedLarge).toBeCloseTo(1, 12);
    expect(distanceBetween(small, large)).toBeCloseTo(3, 12);
  });

  // The corrections have to be read before any of them is written, or a body
  // is measured against a neighbour that has already moved this tick. Three
  // in a row is the smallest arrangement where the two answers differ:
  // buffered, the middle body's two pushes cancel and it does not move at
  // all, while resolving A–B before looking at B–C sends it off to one side.
  it("buffers every correction and applies them once, so no body is measured against one that already moved", () => {
    const population = [
      organismAt(10, CENTRE_Y),
      organismAt(11, CENTRE_Y),
      organismAt(12, CENTRE_Y),
    ];

    separate(population);

    expect(population[0].x).toBeCloseTo(9.5, 12);
    expect(population[1].x).toBeCloseTo(11, 12);
    expect(population[2].x).toBeCloseTo(12.5, 12);
  });

  // The test the correction buffer exists to pass. Without it the result
  // depends on which body the loop reached first, and a crowd would separate
  // differently for no reason a run could ever be reasoned about.
  it("reaches the same positions whatever order the population is held in", () => {
    const population = randomPopulation(3, 200);
    const twins = randomPopulation(3, 200);
    const shuffled = shuffle([...twins], createRngStream(4242));

    separate(population);
    separate(shuffled);

    expect(shuffled).not.toEqual(twins);
    expect(positionsOf(twins)).toEqual(positionsOf(population));
  });

  // Where the pairs come from, stated so it can fail: one query per body and
  // no more is a grid sweep, and it is the difference between this pass and
  // the O(n²) scan ADR-0012 exists to avoid.
  it("finds its pairs through the grid, asking it once per body", () => {
    const population = randomPopulation(5, 150);
    const counting = countingGrid(population);

    separateOverlaps(population, counting.grid);

    expect(counting.queries()).toBe(population.length);
  });

  it("moves nothing when there is nobody to overlap with", () => {
    const population = [organismAt(20, 20)];
    const before = positionsOf(population);

    separate(population);

    expect(positionsOf(population)).toEqual(before);
    expect(() => {
      separate([]);
    }).not.toThrow();
  });

  // Degenerate by construction rather than by accident: two centres in the
  // same place have no normal, and inventing one would have to be done
  // identically by both bodies to stay symmetric. Left where they are, for
  // brownian motion to prise apart on the next tick.
  it("leaves two bodies with exactly coincident centres alone", () => {
    const population = [organismAt(20, 20, 1, 1), organismAt(20, 20, 1, 2)];

    separate(population);

    expect(positionsOf(population)).toEqual([
      {x: 20, y: 20},
      {x: 20, y: 20},
    ]);
  });

  // One pass per tick is a cost decision with a visible consequence, so it
  // is asserted as one: the pass returns from a pile-up with overlap still
  // in it, because it does not loop to a tolerance.
  it("runs a single pass, leaving a pile-up still overlapping when it returns", () => {
    const population = pileUp(7, 60, 6);
    const before = penetrationOf(population);

    separate(population);

    expect(penetrationOf(population)).toBeLessThan(before);
    expect(penetrationOf(population)).toBeGreaterThan(TOUCHING_EPSILON);
  });
});

describe("no overlaps after resolution, with motion disabled", () => {
  // The invariant in the form a still world can hold it: left alone, an
  // overlapping crowd settles. Checked tick by tick rather than only at the
  // end, so a pass that overshot and bounced back would fail even though it
  // converged.
  //
  // Ten bodies rather than fifty, and the size is load-bearing: at this
  // crowding each body overlaps two or three neighbours, and one buffered
  // pass moves every one of them somewhere better. The test below says what
  // happens when that stops being true.
  it("drives the worst overlap down every tick until the crowd is merely touching", () => {
    const population = pileUp(11, 10, 6);
    let previous = penetrationOf(population);
    expect(previous).toBeGreaterThan(1);

    let settledAfter = -1;
    for (let tick = 0; tick < 400 && settledAfter < 0; tick++) {
      commitStep10(population);

      const penetration = penetrationOf(population);
      expect(penetration).toBeLessThan(previous);
      previous = penetration;

      if (penetration <= TOUCHING_EPSILON) {
        settledAfter = tick;
      }
    }

    expect(settledAfter).toBeGreaterThanOrEqual(0);
  });

  /**
   * Where the single pass shows its price, and the reason the invariant is
   * written as decay rather than as a step-by-step decrease.
   *
   * Pile fifty bodies into eight radii of space and each one is inside half
   * a dozen others at once. Its correction is the sum of six pushes, which
   * is the right answer for the crowd and can be the wrong one for the body:
   * summed, they can carry it further into a seventh neighbour it was only
   * grazing. So the worst overlap in the aquarium climbs for a tick here and
   * there on the way down — by a few per cent, never far, and always
   * transiently.
   *
   * What survives is what the milestone actually needs: the crowd settles,
   * and it settles in a bounded number of ticks rather than holding an
   * overlap floor. A second pass per tick would buy monotonicity, and
   * ADR-0008 spends that budget elsewhere.
   */
  it("settles a crowd deep enough that a single pass sometimes overshoots", () => {
    const MARGIN = 1.2;

    for (const seed of [11, 21, 31]) {
      const population = pileUp(seed, 50, 8);
      const started = penetrationOf(population);
      let peak = started;

      let settledAfter = -1;
      for (let tick = 0; tick < 600 && settledAfter < 0; tick++) {
        commitStep10(population);

        const penetration = penetrationOf(population);
        peak = Math.max(peak, penetration);
        if (penetration <= TOUCHING_EPSILON) {
          settledAfter = tick;
        }
      }

      expect(settledAfter).toBeGreaterThanOrEqual(0);
      expect(peak).toBeLessThan(started * MARGIN);
    }
  });

  // ADR-0008's reason for positional separation over impulses: there is no
  // velocity for a collision to write to, so a settled crowd is finished
  // moving. A pass that injected energy would keep nudging it, and a pass
  // that overshot would set it oscillating — neither of which can hide
  // under a bound this tight.
  //
  // "At rest" and not "stopped dead": the pass is a contraction, so what is
  // left of the overlap is halved and halved again rather than zeroed, and
  // the crowd goes on shuffling by a fraction of a fraction of a radius
  // forever. Asserted as a bound rather than as an equality for that reason,
  // and the bound is three orders of magnitude under the epsilon the crowd
  // settled through — energy going in would show up as growth, and there is
  // none.
  it("injects no energy: once the crowd has settled it comes to rest", () => {
    const AT_REST = 1e-6;
    const population = pileUp(11, 50, 8);
    expect(settle(population, 600)).toBeGreaterThanOrEqual(0);
    const settled = positionsOf(population);

    let worst = 0;
    for (let tick = 0; tick < 200; tick++) {
      commitStep10(population);
      worst = Math.max(worst, penetrationOf(population));
    }

    const drifted = Math.max(
      ...population.map((organism, i) =>
        Math.hypot(organism.x - settled[i].x, organism.y - settled[i].y),
      ),
    );

    expect(drifted).toBeLessThan(AT_REST);
    expect(worst).toBeLessThan(AT_REST);
  });

  it("leaves every body wholly inside the aquarium, even separating in a corner", () => {
    const population = Array.from({length: 30}, (_unused, i) =>
      organismAt(MAX_BODY_RADIUS, MAX_BODY_RADIUS, BASELINE_BODY_RADIUS, i + 1),
    );
    // Fanned out by a hair each, so the pile has normals to separate along
    // rather than one exactly coincident heap.
    for (const [i, organism] of population.entries()) {
      organism.x += i * 1e-3;
      organism.y += i * 2e-3;
    }

    let worstSoFar = Number.NEGATIVE_INFINITY;
    for (let tick = 0; tick < 200; tick++) {
      commitStep10(population);
      worstSoFar = Math.max(worstSoFar, worstExcursion(population));
    }

    expect(worstSoFar).toBeLessThanOrEqual(0);
  });
});

describe("no overlaps after resolution, with motion on", () => {
  /**
   * The ceiling the invariant is stated against on a live run, in baseline
   * body radii. Brownian motion re-injects overlap every tick, so the honest
   * claim is not that overlap vanishes but that it never accumulates.
   *
   * The number is not a tolerance picked wide enough to feel safe. It is
   * **proportional to the brownian step**, which was checked by scaling
   * `BROWNIAN_FORCE` and measuring: eight times the force moves the worst
   * overlap by about eleven times, so the depth a pair reaches is set by how
   * far one tick of motion can drive two bodies into each other before the
   * pass pulls them back out.
   *
   * The coefficient is not clean. It wanders between roughly 1.5 and 2.5
   * steps depending on how crowded the world is, and the step that bounds it
   * belongs to the *smallest* bodies, which move `1/r` faster than the
   * baseline. At the force this world runs, a crowd at a fifth of the
   * aquarium's area reaches about `0.24` over three thousand ticks.
   *
   * So `0.5` is roughly double what the run actually does: deep enough to
   * allow the grazing a live run does, shallow enough that a pass which
   * stopped separating crosses it within a few ticks, since nothing would
   * then be pulling bodies out at all.
   *
   * The consequence is worth knowing before it bites. Retuning
   * `BROWNIAN_FORCE` upward moves this ceiling, and this test fails in
   * `separation.test.ts` for a reason that lives in `motion.ts`. That is the
   * same bargain the pinned step length makes next door: the constant cannot
   * move quietly.
   */
  const PENETRATION_CEILING = 0.5 * BASELINE_BODY_RADIUS;

  it("holds the worst overlap in a dense crowd under the ceiling for a long run", () => {
    const population = randomPopulation(13, 160);
    // Settled first: a crowd placed at random starts deeply tangled, and
    // that overlap belongs to the placement rather than to the run.
    expect(settle(population, 600)).toBeGreaterThanOrEqual(0);

    let worst = 0;
    for (let tick = 0; tick < 3000; tick++) {
      for (const organism of population) {
        applyBrownianMotion(organism);
      }
      commitStep10(population);

      worst = Math.max(worst, penetrationOf(population));
    }

    // The ceiling has to be a ceiling on something: a run where nothing ever
    // touched would pass the assertion below and prove nothing.
    expect(worst).toBeGreaterThan(0);
    expect(worst).toBeLessThan(PENETRATION_CEILING);
  });

  it("keeps every body wholly inside the aquarium, every tick of a moving run", () => {
    const population = randomPopulation(17, 120);

    let worstSoFar = Number.NEGATIVE_INFINITY;
    for (let tick = 0; tick < 1000; tick++) {
      for (const organism of population) {
        applyBrownianMotion(organism);
      }
      commitStep10(population);

      worstSoFar = Math.max(worstSoFar, worstExcursion(population));
    }

    expect(worstSoFar).toBeLessThanOrEqual(0);
  });
});

describe("worstPenetration", () => {
  it("reports zero for a crowd where nothing overlaps", () => {
    const population = [
      organismAt(10, CENTRE_Y),
      organismAt(20, CENTRE_Y),
      organismAt(30, CENTRE_Y),
    ];

    expect(penetrationOf(population)).toBe(0);
  });

  it("reports zero for an empty aquarium and for a single body", () => {
    expect(penetrationOf([])).toBe(0);
    expect(penetrationOf([organismAt(20, 20)])).toBe(0);
  });

  it("reports the deepest overlap in the crowd, not the first one it meets", () => {
    const population = [
      organismAt(10, CENTRE_Y),
      organismAt(11.5, CENTRE_Y),
      organismAt(30, CENTRE_Y),
      organismAt(30.4, CENTRE_Y),
    ];

    expect(penetrationOf(population)).toBeCloseTo(1.6, 12);
  });

  it("matches a brute-force scan over dense random crowds", () => {
    for (const seed of [19, 23, 29]) {
      const population = randomPopulation(seed, 120);

      expect(penetrationOf(population)).toBeCloseTo(
        bruteForceWorstPenetration(population),
        12,
      );
    }
  });

  it("keeps matching brute force as the crowd separates", () => {
    const population = randomPopulation(31, 120);

    for (let tick = 0; tick < 40; tick++) {
      separate(population);

      expect(penetrationOf(population)).toBeCloseTo(
        bruteForceWorstPenetration(population),
        12,
      );
    }
  });
});
