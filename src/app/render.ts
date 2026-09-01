import type {Camera} from "./camera";
import {
  AQUARIUM_HEIGHT,
  AQUARIUM_WIDTH,
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
