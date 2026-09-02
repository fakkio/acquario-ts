import {AQUARIUM_HEIGHT, AQUARIUM_WIDTH} from "./aquarium";
import {MAX_BODY_RADIUS, type Organism} from "./organism";

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
 * One cell holds the largest body the world allows, whole. That is the one
 * thing cell size has to buy, and it is why it is derived from
 * `MAX_BODY_RADIUS` rather than picked: a body narrower than a cell extends
 * at most one cell past the cell its centre sits in, so the dilation `query`
 * applies below is exactly one cell wide and the cells a query touches stay
 * bounded — nine of them for a body-sized circle — however wide the radius
 * spread in the population gets.
 */
const CELL_SIZE = 2 * MAX_BODY_RADIUS;

/** Sized to cover the aquarium, so the walls are the grid's edges too. The
 * last column and row hang over the far walls by up to a cell; nothing lives
 * out there, since the wall constraint keeps every body wholly inside. */
const GRID_COLUMNS = Math.ceil(AQUARIUM_WIDTH / CELL_SIZE);
const GRID_ROWS = Math.ceil(AQUARIUM_HEIGHT / CELL_SIZE);

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
   * query therefore reads the cells covered by the circle grown by
   * `MAX_BODY_RADIUS`, which is the furthest any centre outside it can be and
   * still have its body inside.
   */
  query(x: number, y: number, radius: number): readonly Organism[];

  /** The grid as a picture rather than as an index. */
  occupancy(): GridOccupancy;
}

export function buildUniformGrid(population: readonly Organism[]): UniformGrid {
  // Flat buckets, indexed row-major — the cache-friendly layout ADR-0012
  // prefers over tree pointers. The cell count is fixed by the aquarium and
  // by `CELL_SIZE`, both constants, so allocating them all keeps the build
  // O(n) in the population.
  const cells: Organism[][] = Array.from(
    {length: GRID_COLUMNS * GRID_ROWS},
    () => [],
  );

  for (const organism of population) {
    cells[cellIndexAt(organism.x, organism.y)].push(organism);
  }

  return {
    cellSize: CELL_SIZE,
    columns: GRID_COLUMNS,
    rows: GRID_ROWS,

    query(x, y, radius) {
      const reach = radius + MAX_BODY_RADIUS;
      const firstColumn = clampColumn(columnAt(x - reach));
      const lastColumn = clampColumn(columnAt(x + reach));
      const firstRow = clampRow(rowAt(y - reach));
      const lastRow = clampRow(rowAt(y + reach));

      const candidates: Organism[] = [];
      for (let row = firstRow; row <= lastRow; row++) {
        for (let column = firstColumn; column <= lastColumn; column++) {
          for (const organism of cells[row * GRID_COLUMNS + column]) {
            candidates.push(organism);
          }
        }
      }

      return candidates;
    },

    occupancy() {
      return {
        cellSize: CELL_SIZE,
        columns: GRID_COLUMNS,
        rows: GRID_ROWS,
        counts: cells.map((cell) => cell.length),
      };
    },
  };
}

const columnAt = (x: number): number => Math.floor(x / CELL_SIZE);
const rowAt = (y: number): number => Math.floor(y / CELL_SIZE);

/**
 * Clamped rather than wrapped, and rather than skipped. Wrapping is what the
 * aquarium's hard walls rule out: reading column −1 as the last column would
 * make a body resting on the left wall a neighbour of one resting on the
 * right. Clamping instead of dropping the out-of-range cells keeps a query
 * against a wall reading the cells that *are* there, which is where its
 * neighbours are.
 */
const clampColumn = (column: number): number =>
  Math.min(Math.max(column, 0), GRID_COLUMNS - 1);

const clampRow = (row: number): number =>
  Math.min(Math.max(row, 0), GRID_ROWS - 1);

/**
 * Bucketing clamps too, for the same reason `query` does: a body that somehow
 * sits outside the aquarium still has to land in a bucket, and it lands in
 * the nearest edge cell — the cell a query from inside would look in for it.
 * The wall constraint means this should never fire; if it ever does, a
 * misplaced body stays findable instead of silently vanishing from every
 * neighbour query in the world.
 */
const cellIndexAt = (x: number, y: number): number =>
  clampRow(rowAt(y)) * GRID_COLUMNS + clampColumn(columnAt(x));
