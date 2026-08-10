import type {Camera} from "./camera";
import {hashState, type World} from "../world";

const GRID_SPACING = 100;
const GRID_EXTENT = 5000;

/**
 * No organism bodies exist yet in M0 — the background hue is derived from
 * `hashState`, the one public window onto `World`'s otherwise-opaque state,
 * so the loop's effect (the hash changing tick-over-tick) stays visible. A
 * world-space placeholder grid, drawn under the camera transform, is what
 * makes pan/zoom visible/testable by eye per the M0 spec.
 */
export function renderWorld(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  world: World,
  camera: Camera,
): void {
  const hue = parseInt(hashState(world).slice(0, 4), 16) % 360;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = `hsl(${String(hue)}, 35%, 12%)`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.setTransform(
    camera.scale,
    0,
    0,
    camera.scale,
    camera.offsetX,
    camera.offsetY,
  );
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1 / camera.scale;

  ctx.beginPath();
  for (let x = -GRID_EXTENT; x <= GRID_EXTENT; x += GRID_SPACING) {
    ctx.moveTo(x, -GRID_EXTENT);
    ctx.lineTo(x, GRID_EXTENT);
  }
  for (let y = -GRID_EXTENT; y <= GRID_EXTENT; y += GRID_SPACING) {
    ctx.moveTo(-GRID_EXTENT, y);
    ctx.lineTo(GRID_EXTENT, y);
  }
  ctx.stroke();
}
