import {AQUARIUM_HEIGHT, AQUARIUM_WIDTH} from "./aquarium";
import {GENERATION_0_MAX_BODY_RADIUS, type Organism} from "./organism";

/**
 * The neighbour query the collision pass runs on: a uniform grid over the
 * aquarium, per ADR-0012, rebuilt from scratch every tick.
 *
 * Rebuilt rather than updated because every organism moves every tick, so
 * there is no incremental case to optimise for — and bucketing on cell index
 * is O(n) where a tree's subdivision is O(n log n). "From scratch" is a
 * property of this module's shape rather than a discipline callers keep:
 * `buildUniformGrid` is a pure function of the population it is handed and
 * nothing here survives the call, so a grid cannot carry a stale position
 * into the tick after the one that built it.
 */

/**
 * The largest `bodyRadius` in `population`, or generation 0's ceiling as a
 * fallback for a population with no bodies to derive one from at all.
 * `buildUniformGrid` is called on whatever population exists, including an
 * extinct one (M3's worlds can and do go extinct, and the render layer reads
 * `getGridOccupancy` regardless), so "no largest body" has to produce a valid
 * grid rather than a division by zero — and generation 0's ceiling is as good
 * a guess as any for a grid nobody is querying for real.
 *
 * One cell has to hold this body whole — the one thing cell size has to buy —
 * which is why cell size is derived from it fresh every build rather than
 * from a constant: from M4 on, the body radius mutates without an upper
 * bound other than the carbon ledger (through `cytoplasmThickness` from M7), so there is no fixed largest radius left to
 * derive a module-level cell size from (ADR-0012's amendment).
 */
function largestBodyRadius(population: readonly Organism[]): number {
  let largest = 0;
  for (const organism of population) {
    if (organism.bodyRadius > largest) {
      largest = organism.bodyRadius;
    }
  }

  return largest > 0 ? largest : GENERATION_0_MAX_BODY_RADIUS;
}

/**
 * A grid flattened to numbers. Deliberately holds no organisms: this is what
 * crosses out of the world to the debug overlay, whose business with the grid
 * is where the cells are and which ones have something in them. Handing it
 * the buckets themselves would hand it mutable bodies through the back door
 * `OrganismView` exists to close.
 */
export interface GridOccupancy {
  readonly cellSize: number;
  readonly columns: number;
  readonly rows: number;
  /** How many organisms bucketed into each cell, row-major, `columns × rows`
   * long. */
  readonly counts: readonly number[];
}

export interface UniformGrid {
  readonly cellSize: number;
  readonly columns: number;
  readonly rows: number;

  /**
   * The candidate organisms for a circle: every organism whose *body* could
   * touch it, and some that cannot. Candidates, not an answer — the caller
   * does the precise distance test, because that is the only way the grid
   * gets to be cheap.
   *
   * The superset is the whole design, and the place a naive implementation
   * goes wrong invisibly. Organisms bucket by their centre, so a body whose
   * centre sits one cell over can still reach into the circle; reading only
   * the cells the circle itself covers would miss it, and miss it *rarely* —
   * exactly the near-touching pairs the collision pass exists to find. The
   * query therefore reads the cells covered by the circle grown by this
   * build's largest body radius, which is the furthest any centre outside it
   * can be and still have its body inside.
   */
  query(x: number, y: number, radius: number): readonly Organism[];

  /** The grid as a picture rather than as an index. */
  occupancy(): GridOccupancy;
}

export function buildUniformGrid(population: readonly Organism[]): UniformGrid {
  const dilation = largestBodyRadius(population);
  const cellSize = 2 * dilation;

  // Sized to cover the aquarium, so the walls are the grid's edges too. The
  // last column and row hang over the far walls by up to a cell; nothing
  // lives out there, since the wall constraint keeps every body wholly
  // inside. Derived per build, not module constants, because `cellSize`
  // itself is now a property of this tick's population.
  const columns = Math.ceil(AQUARIUM_WIDTH / cellSize);
  const rows = Math.ceil(AQUARIUM_HEIGHT / cellSize);

  const columnAt = (x: number): number => Math.floor(x / cellSize);
  const rowAt = (y: number): number => Math.floor(y / cellSize);

  /**
   * Clamped rather than wrapped, and rather than skipped. Wrapping is what
   * the aquarium's hard walls rule out: reading column −1 as the last column
   * would make a body resting on the left wall a neighbour of one resting on
   * the right. Clamping instead of dropping the out-of-range cells keeps a
   * query against a wall reading the cells that *are* there, which is where
   * its neighbours are.
   */
  const clampColumn = (column: number): number =>
    Math.min(Math.max(column, 0), columns - 1);

  const clampRow = (row: number): number =>
    Math.min(Math.max(row, 0), rows - 1);

  /**
   * Bucketing clamps too, for the same reason `query` does: a body that
   * somehow sits outside the aquarium still has to land in a bucket, and it
   * lands in the nearest edge cell — the cell a query from inside would look
   * in for it. The wall constraint means this should never fire; if it ever
   * does, a misplaced body stays findable instead of silently vanishing from
   * every neighbour query in the world.
   */
  const cellIndexAt = (x: number, y: number): number =>
    clampRow(rowAt(y)) * columns + clampColumn(columnAt(x));

  // Flat buckets, indexed row-major — the cache-friendly layout ADR-0012
  // prefers over tree pointers. The cell count is fixed once `cellSize` is
  // known for this build, so allocating them all keeps the build O(n) in the
  // population.
  const cells: Organism[][] = Array.from({length: columns * rows}, () => []);

  for (const organism of population) {
    cells[cellIndexAt(organism.x, organism.y)].push(organism);
  }

  return {
    cellSize,
    columns,
    rows,

    query(x, y, radius) {
      const reach = radius + dilation;
      const firstColumn = clampColumn(columnAt(x - reach));
      const lastColumn = clampColumn(columnAt(x + reach));
      const firstRow = clampRow(rowAt(y - reach));
      const lastRow = clampRow(rowAt(y + reach));

      const candidates: Organism[] = [];
      for (let row = firstRow; row <= lastRow; row++) {
        for (let column = firstColumn; column <= lastColumn; column++) {
          for (const organism of cells[row * columns + column]) {
            candidates.push(organism);
          }
        }
      }

      return candidates;
    },

    occupancy() {
      return {
        cellSize,
        columns,
        rows,
        counts: cells.map((cell) => cell.length),
      };
    },
  };
}
