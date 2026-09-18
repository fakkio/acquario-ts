import type {Camera} from "./camera";
import type {DeathEffects} from "./deathEffects";
import {
  AQUARIUM_HEIGHT,
  AQUARIUM_WIDTH,
  capFor,
  getGridOccupancy,
  getPopulation,
  lightAt,
  type OrganismView,
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
const WALL_STROKE = "hsl(190, 40%, 60%)";
const WALL_WIDTH_PX = 2;

/** The water's hue and saturation stay fixed; only lightness answers to the
 * light gradient below. */
const WATER_HUE = 205;
const WATER_SATURATION = 45;

/** Lightness at zero light and at full surface light, in percent — the
 * range `waterLightness` maps the light gradient into. */
const WATER_LIGHTNESS_FLOOR = 6;
const WATER_LIGHTNESS_SURFACE = 32;

/** How many stops the gradient samples the light table at. Coarser than the
 * table itself: a canvas gradient interpolates linearly between its own
 * stops in RGB space regardless, so more stops than the eye can tell apart
 * buys nothing. */
const GRADIENT_STOPS = 20;

/** Lightness at zero energy and at a full store, in percent — the range a
 * body's brightness maps its energy fraction into (M2, ADR-0010). A
 * starving body never goes fully black: it stays a dim, legible ghost of
 * its lineage hue rather than vanishing into the background. */
const BODY_LIGHTNESS_FLOOR = 12;
const BODY_LIGHTNESS_FULL = 55;

const GRID_STROKE = "hsla(50, 90%, 70%, 0.22)";
const GRID_OCCUPIED_FILL = "hsla(50, 90%, 70%, 0.10)";
const GRID_WIDTH_PX = 1;

export interface RenderOptions {
  /** Whether the uniform grid's debug overlay is drawn over the water. */
  readonly showGrid: boolean;
  /** The death-effect layer (ticket #24): recorded and drawn against this
   * frame's population and wall-clock time, so it animates independently of
   * whether this repaint was triggered by a tick. */
  readonly deathEffects: DeathEffects;
  /** Wall-clock time this frame is drawn at — `deathEffects`' only clock. */
  readonly nowMs: number;
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
 * Rendering encodes state directly, per ADR-0010: hue is `lineageHue`,
 * radius is `bodyRadius`, and brightness is the energy fraction — a
 * starving body reads as a dim ghost of its lineage hue, a sated one as
 * its full colour, so a starvation wave is legible on screen without
 * opening a test.
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

  drawLightGradient(ctx);

  // Under the bodies: the grid is the machinery behind them, and an overlay
  // that hid what it is an index of would be the wrong way round.
  if (options.showGrid) {
    drawGrid(ctx, world, worldScale);
  }

  const population = getPopulation(world);
  for (const organism of population) {
    ctx.fillStyle = bodyFillFor(organism);
    ctx.beginPath();
    ctx.arc(organism.x, organism.y, organism.bodyRadius, 0, 2 * Math.PI);
    ctx.fill();
  }

  // Recorded and drawn last, over the bodies and the wall alike: the ring
  // marks where an organism *was*, so it reads as an overlay on the whole
  // scene rather than as part of it.
  options.deathEffects.recordFrame(population, options.nowMs);

  // Stroked before the death effect so a ring at a body resting against a
  // wall reads over it, the same way a live body would.
  ctx.strokeStyle = WALL_STROKE;
  ctx.lineWidth = WALL_WIDTH_PX / worldScale;
  ctx.strokeRect(0, 0, AQUARIUM_WIDTH, AQUARIUM_HEIGHT);

  options.deathEffects.draw(ctx, worldScale, options.nowMs);
}

/**
 * Untested per ADR-0013's TDD boundary, like everything else that draws.
 *
 * A body's fill colour: `lineageHue` unchanged, brightness carrying the
 * energy fraction linearly between `BODY_LIGHTNESS_FLOOR` and
 * `BODY_LIGHTNESS_FULL`. No perceptual compression the way
 * `waterFillAt` applies to light — the energy fraction is already linear
 * in `[0, 1]`, with no orders-of-magnitude spread to compress.
 */
function bodyFillFor(organism: OrganismView): string {
  const energyFraction = organism.energy / capFor(organism, "energy");
  const lightness =
    BODY_LIGHTNESS_FLOOR +
    (BODY_LIGHTNESS_FULL - BODY_LIGHTNESS_FLOOR) * energyFraction;

  return `hsl(${String(organism.lineageHue)}, 70%, ${String(lightness)}%)`;
}

/**
 * Untested per ADR-0013's TDD boundary, like everything else that draws.
 *
 * The one visible consequence of ADR-0004's light gradient: a vertical
 * background running from a brighter surface to a near-black floor, drawn
 * under the same world-space transform as everything else so it sits still
 * while the camera pans and scales with it while the camera zooms. It costs
 * one fill and it is the only way the difference between two organisms'
 * fortunes — one in the photic zone, one in the dark — is legible on screen.
 *
 * Reads `lightAt` at `GRADIENT_STOPS` depths rather than the table's own
 * resolution — see that constant for why.
 */
function drawLightGradient(ctx: CanvasRenderingContext2D): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, AQUARIUM_HEIGHT);
  for (let stop = 0; stop <= GRADIENT_STOPS; stop++) {
    const y = (stop / GRADIENT_STOPS) * AQUARIUM_HEIGHT;
    gradient.addColorStop(stop / GRADIENT_STOPS, waterFillAt(lightAt(y)));
  }

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, AQUARIUM_WIDTH, AQUARIUM_HEIGHT);
}

/**
 * Light intensity spans several orders of magnitude by the floor (ADR-0004's
 * whole point), so mapping it straight to lightness would read as fully dark
 * past the photic zone and waste the gradient's range on its top few units.
 * The square root compresses that range perceptually, the way gamma does for
 * a display, while staying monotonic — the one property `lightAt` itself is
 * tested for and the only one this rendering decision has to preserve.
 */
function waterFillAt(intensity: number): string {
  const lightness =
    WATER_LIGHTNESS_FLOOR +
    (WATER_LIGHTNESS_SURFACE - WATER_LIGHTNESS_FLOOR) * Math.sqrt(intensity);

  return `hsl(${String(WATER_HUE)}, ${String(WATER_SATURATION)}%, ${String(lightness)}%)`;
}

/**
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
