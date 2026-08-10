import {hashState, type World} from "../world";

/**
 * No organism bodies exist yet in M0 — the background hue is derived from
 * `hashState`, the one public window onto `World`'s otherwise-opaque state,
 * so the loop's effect (the hash changing tick-over-tick) stays visible.
 */
export function renderWorld(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  world: World,
): void {
  const hue = parseInt(hashState(world).slice(0, 4), 16) % 360;

  ctx.fillStyle = `hsl(${String(hue)}, 35%, 12%)`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}
