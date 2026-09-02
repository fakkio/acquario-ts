import type {Camera} from "./camera";
import {
  AQUARIUM_HEIGHT,
  AQUARIUM_WIDTH,
  getGridOccupancy,
  getPopulation,
  type World,
} from "../world";

/**
 * How many pixels one world length unit — one baseline body radius — is drawn
 * at. The simulation is non-dimensional and knows nothing about pixels; this
 * is the single place the two meet, so the aquarium's on-screen size can be
 * re-tuned without touching a world constant. Sized so the whole tank fits an
 * ordinary window at the camera's default scale of 1.
 */
const PIXELS_PER_UNIT = 14;

const VOID_FILL = "hsl(210, 20%, 7%)";
const WATER_FILL = "hsl(205, 45%, 14%)";
const WALL_STROKE = "hsl(190, 40%, 60%)";
const WALL_WIDTH_PX = 2;

const GRID_STROKE = "hsla(50, 90%, 70%, 0.22)";
const GRID_OCCUPIED_FILL = "hsla(50, 90%, 70%, 0.10)";
const GRID_WIDTH_PX = 1;

export interface RenderOptions {
  /** Whether the uniform grid's debug overlay is drawn over the water. */
  readonly showGrid: boolean;
}

/**
 * The camera position that frames the whole aquarium in the middle of the
 * canvas. Only the render layer knows how many pixels wide the tank is, so
 * the framing is computed here and handed to the camera rather than guessed
 * by the caller.
 */
export function frameAquarium(canvas: HTMLCanvasElement): Camera {
  return {
    offsetX: (canvas.width - AQUARIUM_WIDTH * PIXELS_PER_UNIT) / 2,
    offsetY: (canvas.height - AQUARIUM_HEIGHT * PIXELS_PER_UNIT) / 2,
    scale: 1,
  };
}

/**
 * Untested per ADR-0013's TDD boundary: canvas drawing is verified by running
 * the app.
 *
 * Rendering encodes state directly, per ADR-0010: hue is `lineageHue` and
 * radius is `bodyRadius`. Brightness is the third channel and encodes the
 * energy fraction, so every body is drawn at the one fixed lightness below
 * until M2 gives them energy to be a fraction of — a fraction of 1, read as
 * the top of the range M2 will dim bodies down from.
 */
export function renderWorld(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  world: World,
  camera: Camera,
  options: RenderOptions,
): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = VOID_FILL;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // World space from here down: one unit is one baseline body radius, the
  // origin is the aquarium's top-left corner, and y grows downward — so
  // depth is y, ready for M2's light gradient to run from surface to floor.
  const worldScale = camera.scale * PIXELS_PER_UNIT;
  ctx.setTransform(
    worldScale,
    0,
    0,
    worldScale,
    camera.offsetX,
    camera.offsetY,
  );

  ctx.fillStyle = WATER_FILL;
  ctx.fillRect(0, 0, AQUARIUM_WIDTH, AQUARIUM_HEIGHT);

  // Under the bodies: the grid is the machinery behind them, and an overlay
  // that hid what it is an index of would be the wrong way round.
  if (options.showGrid) {
    drawGrid(ctx, world, worldScale);
  }

  for (const organism of getPopulation(world)) {
    ctx.fillStyle = `hsl(${String(organism.lineageHue)}, 70%, 55%)`;
    ctx.beginPath();
    ctx.arc(organism.x, organism.y, organism.bodyRadius, 0, 2 * Math.PI);
    ctx.fill();
  }

  // Stroked last so bodies resting against a wall sit under it rather than
  // over it, which is what makes the hard wall read as solid.
  ctx.strokeStyle = WALL_STROKE;
  ctx.lineWidth = WALL_WIDTH_PX / worldScale;
  ctx.strokeRect(0, 0, AQUARIUM_WIDTH, AQUARIUM_HEIGHT);
}

/**
 * Untested per ADR-0013's TDD boundary, like everything else that draws.
 *
 * The uniform grid is the one piece of M1 with no visible consequence of its
 * own: bodies would move and separate the same way if the neighbour query
 * were an O(n²) scan, so nothing on screen says whether the index is doing
 * its job or even where its cells are. This draws it — every cell outlined,
 * the occupied ones filled — so the structure can be watched changing tick by
 * tick rather than inspected only through tests.
 *
 * Occupied cells are distinguished by fill rather than by count: what the
 * overlay is for is seeing bodies land in cells and cells empty out behind
 * them, and the exact tenants of a cell are what the tests are for.
 *
 * The last column and row hang visibly past the right and bottom walls,
 * because a whole number of cells rarely covers the aquarium exactly. Drawn
 * rather than clipped: the lattice on screen is then the lattice the queries
 * run over, and an overlay that tidied away part of it would be showing
 * something the grid is not.
 */
function drawGrid(
  ctx: CanvasRenderingContext2D,
  world: World,
  worldScale: number,
): void {
  const {cellSize, columns, rows, counts} = getGridOccupancy(world);

  ctx.fillStyle = GRID_OCCUPIED_FILL;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      if (counts[row * columns + column] > 0) {
        ctx.fillRect(column * cellSize, row * cellSize, cellSize, cellSize);
      }
    }
  }

  // One path for every line, so the whole lattice costs a single stroke.
  ctx.strokeStyle = GRID_STROKE;
  ctx.lineWidth = GRID_WIDTH_PX / worldScale;
  ctx.beginPath();
  for (let column = 0; column <= columns; column++) {
    ctx.moveTo(column * cellSize, 0);
    ctx.lineTo(column * cellSize, rows * cellSize);
  }
  for (let row = 0; row <= rows; row++) {
    ctx.moveTo(0, row * cellSize);
    ctx.lineTo(columns * cellSize, row * cellSize);
  }
  ctx.stroke();
}
