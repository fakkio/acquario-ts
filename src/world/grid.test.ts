import {describe, expect, it} from "vitest";

import {AQUARIUM_HEIGHT, AQUARIUM_WIDTH} from "./aquarium";
import {buildUniformGrid, type UniformGrid} from "./grid";
import {MAX_BODY_RADIUS, type Organism} from "./organism";
import {createRngStream} from "./rng";
import {
  MIN_BODY_RADIUS,
  openDraws,
  organismAt,
  randomPopulation,
  shuffle,
} from "./testing";

/** Cell size and extent, read off a grid built from nobody: the geometry is
 * a property of the aquarium, not of who happens to be in it. */
const GEOMETRY = buildUniformGrid([]);

interface Circle {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

/**
 * The exact answer the grid is an optimisation of, and therefore the oracle
 * every query test below is written against: every organism whose body
 * actually touches the query circle. A grid that misses one of these is
 * wrong; a grid that returns more than these is only doing its job, since it
 * answers in candidates and leaves the precise distance test to the caller.
 */
const bodiesTouching = (
  population: readonly Organism[],
  circle: Circle,
): Organism[] =>
  population.filter(
    (organism) =>
      Math.hypot(organism.x - circle.x, organism.y - circle.y) <=
      circle.radius + organism.bodyRadius,
  );

/**
 * Returns how many bodies the oracle expected, so a caller can prove the
 * check had something to check. A loop over an empty oracle asserts nothing
 * and passes — the exact shape of a test that cannot fail.
 */
const expectFindsEveryBodyTouching = (
  grid: UniformGrid,
  population: readonly Organism[],
  circle: Circle,
): number => {
  const candidates = grid.query(circle.x, circle.y, circle.radius);
  const expected = bodiesTouching(population, circle);

  for (const organism of expected) {
    expect(candidates).toContain(organism);
  }

  return expected.length;
};

const totalBucketed = (grid: UniformGrid): number =>
  grid.occupancy().counts.reduce((sum, count) => sum + count, 0);

/** One body at the centre of every cell, so a query's reach can be read off
 * as a count of cells rather than inferred from a distance. */
function oneBodyPerCell(): Organism[] {
  const population: Organism[] = [];
  for (let row = 0; row < GEOMETRY.rows; row++) {
    for (let column = 0; column < GEOMETRY.columns; column++) {
      population.push(
        organismAt(
          (column + 0.5) * GEOMETRY.cellSize,
          (row + 0.5) * GEOMETRY.cellSize,
          MAX_BODY_RADIUS,
        ),
      );
    }
  }

  return population;
}

describe("buildUniformGrid", () => {
  it("buckets every organism in the population, and none of them twice", () => {
    const population = randomPopulation(1, 200);

    expect(totalBucketed(buildUniformGrid(population))).toBe(population.length);
  });

  it("covers the whole aquarium, so no body can fall outside every cell", () => {
    expect(GEOMETRY.columns * GEOMETRY.cellSize).toBeGreaterThanOrEqual(
      AQUARIUM_WIDTH,
    );
    expect(GEOMETRY.rows * GEOMETRY.cellSize).toBeGreaterThanOrEqual(
      AQUARIUM_HEIGHT,
    );
  });

  // Close to restating `CELL_SIZE = 2 · MAX_BODY_RADIUS`, and kept anyway,
  // because an inequality is not the computation: it pins the constraint the
  // computation has to satisfy rather than recomputing its result. It is
  // also the test that turns itself on later — M4 mutates `bodyRadius`, and
  // the day the largest body the world allows grows past half a cell, every
  // query silently starts missing neighbours. This fails first instead.
  it("keeps a cell wide enough to hold the largest body the world allows", () => {
    expect(GEOMETRY.cellSize).toBeGreaterThanOrEqual(2 * MAX_BODY_RADIUS);
  });

  // Rebuilt from scratch means exactly this: a grid is a function of the
  // population as it stands at build time. A grid that cached anything
  // across builds would hand a tick the positions of the tick before it.
  it("reads the population where it is now, not where it was at the last build", () => {
    const organism = organismAt(5, 5);
    const population = [organism];
    buildUniformGrid(population);

    organism.x = AQUARIUM_WIDTH - 5;
    organism.y = AQUARIUM_HEIGHT - 5;
    const rebuilt = buildUniformGrid(population);

    expect(rebuilt.query(5, 5, 1)).toEqual([]);
    expect(rebuilt.query(organism.x, organism.y, 1)).toContain(organism);
  });

  // The wall constraint means the tick never hands it one of these, so this
  // pins a contract rather than a scenario: `buildUniformGrid` takes any
  // population and buckets all of it. Unclamped, a body outside the aquarium
  // indexes past the buckets and the build throws — a crash, on a body that
  // is merely in the wrong place.
  it("buckets a body that sits outside the aquarium into the nearest edge cell", () => {
    const strayed = organismAt(-20, AQUARIUM_HEIGHT + 20);
    const grid = buildUniformGrid([strayed]);

    expect(totalBucketed(grid)).toBe(1);
    expect(
      grid.occupancy().counts[(GEOMETRY.rows - 1) * GEOMETRY.columns],
    ).toBe(1);
    expect(grid.query(0, AQUARIUM_HEIGHT, MAX_BODY_RADIUS)).toContain(strayed);
  });

  it("keeps no state between builds, so one grid never sees another's population", () => {
    const first = buildUniformGrid([organismAt(5, 5)]);
    const second = buildUniformGrid([organismAt(20, 20)]);

    expect(totalBucketed(first)).toBe(1);
    expect(totalBucketed(second)).toBe(1);
    expect(second.query(5, 5, 1)).toEqual([]);
  });
});

describe("query", () => {
  it("returns every organism actually within range, over random populations and circles", () => {
    const population = randomPopulation(7, 300);
    const grid = buildUniformGrid(population);
    const draw = openDraws(99);
    let found = 0;

    for (let i = 0; i < 400; i++) {
      found += expectFindsEveryBodyTouching(grid, population, {
        x: draw() * AQUARIUM_WIDTH,
        y: draw() * AQUARIUM_HEIGHT,
        radius: MIN_BODY_RADIUS + draw() * (MAX_BODY_RADIUS - MIN_BODY_RADIUS),
      });
    }

    expect(found).toBeGreaterThan(0);
  });

  // The population the world will actually hand it: every radius between the
  // smallest and the largest allowed, so a cell size derived from the largest
  // has to hold for bodies less than half that wide too.
  it("returns every organism within range when the smallest and largest bodies are mixed", () => {
    const population = [
      ...randomPopulation(11, 100, MIN_BODY_RADIUS, MIN_BODY_RADIUS),
      ...randomPopulation(12, 100, MAX_BODY_RADIUS, MAX_BODY_RADIUS),
      ...randomPopulation(13, 100),
    ];
    const grid = buildUniformGrid(population);
    const draw = openDraws(1234);
    let found = 0;

    for (let i = 0; i < 400; i++) {
      found += expectFindsEveryBodyTouching(grid, population, {
        x: draw() * AQUARIUM_WIDTH,
        y: draw() * AQUARIUM_HEIGHT,
        radius: draw() * MAX_BODY_RADIUS,
      });
    }

    expect(found).toBeGreaterThan(0);
  });

  // Where a bucketing scheme breaks if it looks only at the cell a query's
  // centre lands in: the body is one cell over, and touching all the same.
  it("finds a body straddling a cell border, from the cell on either side", () => {
    const border = 4 * GEOMETRY.cellSize;
    const population = [
      organismAt(border, 5 * GEOMETRY.cellSize, MAX_BODY_RADIUS),
    ];
    const grid = buildUniformGrid(population);

    for (const offset of [-MAX_BODY_RADIUS, MAX_BODY_RADIUS]) {
      expect(
        expectFindsEveryBodyTouching(grid, population, {
          x: border + offset,
          y: 5 * GEOMETRY.cellSize,
          radius: MIN_BODY_RADIUS,
        }),
      ).toBe(1);
    }
  });

  it("finds a body sitting on a four-cell corner, from each of the four cells", () => {
    const corner = {x: 4 * GEOMETRY.cellSize, y: 3 * GEOMETRY.cellSize};
    const population = [organismAt(corner.x, corner.y, MAX_BODY_RADIUS)];
    const grid = buildUniformGrid(population);

    for (const dx of [-1, 1]) {
      for (const dy of [-1, 1]) {
        // Asserted rather than assumed: the body has to be genuinely in
        // range of each of the four cells, or the loop below checks nothing.
        expect(
          expectFindsEveryBodyTouching(grid, population, {
            x: corner.x + dx * MAX_BODY_RADIUS,
            y: corner.y + dy * MAX_BODY_RADIUS,
            radius: MAX_BODY_RADIUS,
          }),
        ).toBe(1);
      }
    }
  });

  // The aquarium's walls are the grid's edges, so every query the collision
  // pass runs for a body resting against a wall asks for cells that are not
  // there. Pushed past the far edge deliberately: the grid's last column and
  // row overhang the walls, so a query at the wall itself never leaves the
  // grid and would pass whatever the out-of-range handling did.
  it.each([
    ["past the left wall", {x: -3 * GEOMETRY.cellSize, y: AQUARIUM_HEIGHT / 2}],
    ["past the top wall", {x: AQUARIUM_WIDTH / 2, y: -3 * GEOMETRY.cellSize}],
    [
      "past the right wall",
      {
        x: GEOMETRY.columns * GEOMETRY.cellSize + 3 * GEOMETRY.cellSize,
        y: AQUARIUM_HEIGHT / 2,
      },
    ],
    [
      "past the bottom wall",
      {
        x: AQUARIUM_WIDTH / 2,
        y: GEOMETRY.rows * GEOMETRY.cellSize + 3 * GEOMETRY.cellSize,
      },
    ],
  ])("reads nothing outside the grid for a query %s", (_where, at) => {
    const population = randomPopulation(21, 200);
    const grid = buildUniformGrid(population);

    const candidates = grid.query(at.x, at.y, MAX_BODY_RADIUS);

    // No `undefined` from reading past the buckets, and nothing conjured.
    for (const candidate of candidates) {
      expect(population).toContain(candidate);
    }
  });

  // The other half of "does not read outside the grid", and the half a
  // clamp-vs-wrap mistake shows up in: a query against one wall must not
  // reach round to the opposite one. Each case plants a body directly across
  // the aquarium from the query — the body a wrapped column or row index
  // lands on — and one just inside the wall being queried, so the case fails
  // both if the far body is found and if the near one is lost.
  const midX = AQUARIUM_WIDTH / 2;
  const midY = AQUARIUM_HEIGHT / 2;
  const inset = MAX_BODY_RADIUS;

  it.each([
    [
      "left",
      {x: 0, y: midY},
      {x: inset, y: midY},
      {x: AQUARIUM_WIDTH - inset, y: midY},
    ],
    [
      "right",
      {x: AQUARIUM_WIDTH, y: midY},
      {x: AQUARIUM_WIDTH - inset, y: midY},
      {x: inset, y: midY},
    ],
    [
      "top",
      {x: midX, y: 0},
      {x: midX, y: inset},
      {x: midX, y: AQUARIUM_HEIGHT - inset},
    ],
    [
      "bottom",
      {x: midX, y: AQUARIUM_HEIGHT},
      {x: midX, y: AQUARIUM_HEIGHT - inset},
      {x: midX, y: inset},
    ],
  ])(
    "does not wrap a query at the %s wall round to the far side",
    (_wall, at, near, far) => {
      const nearBody = organismAt(near.x, near.y);
      const farBody = organismAt(far.x, far.y);
      const grid = buildUniformGrid([nearBody, farBody]);

      const candidates = grid.query(at.x, at.y, MAX_BODY_RADIUS);

      expect(candidates).toContain(nearBody);
      expect(candidates).not.toContain(farBody);
    },
  );

  it("finds nothing where there is nothing", () => {
    const grid = buildUniformGrid([organismAt(5, 5)]);

    expect(grid.query(AQUARIUM_WIDTH - 5, AQUARIUM_HEIGHT - 5, 1)).toEqual([]);
  });

  it("returns no organism twice", () => {
    const population = randomPopulation(31, 300);
    const grid = buildUniformGrid(population);

    const candidates = grid.query(
      AQUARIUM_WIDTH / 2,
      AQUARIUM_HEIGHT / 2,
      MAX_BODY_RADIUS,
    );

    expect(candidates.length).toBeGreaterThan(0);
    expect(new Set(candidates).size).toBe(candidates.length);
  });

  // Without this the whole ticket is satisfiable by returning the population
  // every time — a correct answer, and the O(n²) scan the grid exists to
  // replace.
  it("returns a small fraction of a large population, not all of it", () => {
    const population = randomPopulation(41, 2000);
    const grid = buildUniformGrid(population);

    const candidates = grid.query(
      AQUARIUM_WIDTH / 2,
      AQUARIUM_HEIGHT / 2,
      MIN_BODY_RADIUS,
    );

    expect(candidates.length).toBeLessThan(population.length / 20);
  });

  // What deriving cell size from the largest allowed body buys, in the form
  // that can fail: halve the cell and a query spans five columns instead of
  // three, and the bounded-work guarantee goes with it.
  it("touches at most nine cells, even for the largest body the world allows", () => {
    const grid = buildUniformGrid(oneBodyPerCell());

    for (let row = 0; row < GEOMETRY.rows; row++) {
      for (let column = 0; column < GEOMETRY.columns; column++) {
        const candidates = grid.query(
          (column + 0.5) * GEOMETRY.cellSize,
          (row + 0.5) * GEOMETRY.cellSize,
          MAX_BODY_RADIUS,
        );

        expect(candidates.length).toBeLessThanOrEqual(9);
      }
    }
  });

  // The property the separation pass leans on next: a grid built from a
  // shuffled population answers the same question. Order-independence there
  // is worth nothing if the candidate set it works from moves around.
  it("answers the same whatever order the population was built in", () => {
    const population = randomPopulation(51, 300);
    const shuffled = shuffle([...population], createRngStream(4242));
    const circle = {
      x: AQUARIUM_WIDTH / 2,
      y: AQUARIUM_HEIGHT / 2,
      radius: MAX_BODY_RADIUS,
    };

    const inOrder = buildUniformGrid(population).query(
      circle.x,
      circle.y,
      circle.radius,
    );
    const outOfOrder = buildUniformGrid(shuffled).query(
      circle.x,
      circle.y,
      circle.radius,
    );

    expect(shuffled).not.toEqual(population);
    expect(inOrder.length).toBeGreaterThan(0);
    expect(new Set(outOfOrder)).toEqual(new Set(inOrder));
  });
});

describe("occupancy", () => {
  it("reports one count per cell, row-major, accounting for every organism", () => {
    const population = randomPopulation(71, 200);

    const occupancy = buildUniformGrid(population).occupancy();

    expect(occupancy.counts).toHaveLength(occupancy.columns * occupancy.rows);
    expect(occupancy.counts.reduce((sum, count) => sum + count, 0)).toBe(
      population.length,
    );
  });

  it("puts a body's count in the cell the body is in, and nowhere else", () => {
    const column = 3;
    const row = 2;
    const inside = (at: number) => (at + 0.5) * GEOMETRY.cellSize;

    const occupancy = buildUniformGrid([
      organismAt(inside(column), inside(row)),
      organismAt(inside(column) + 0.1, inside(row) - 0.1),
      organismAt(inside(column), inside(row + 1)),
    ]).occupancy();

    expect(occupancy.counts[row * occupancy.columns + column]).toBe(2);
    expect(occupancy.counts[(row + 1) * occupancy.columns + column]).toBe(1);
    expect(occupancy.counts[0]).toBe(0);
  });
});
