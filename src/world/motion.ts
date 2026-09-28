import {AQUARIUM_HEIGHT, AQUARIUM_WIDTH} from "./aquarium";
import {CONFINE_DEPTH} from "./constants";
import type {Organism} from "./organism";
import {drawUnitVector} from "./rng";

/**
 * How bodies move, per ADR-0008: overdamped, at low Reynolds number.
 * `velocity = force / (drag · bodyRadius)` — velocity is proportional to the
 * force itself, not to its derivative, so there is no momentum to carry
 * between ticks and an organism that stops being pushed stops in the same
 * tick. Nothing here is integrated twice; there is no velocity field on
 * `Organism` because there is no velocity worth remembering.
 *
 * The simulation's time unit is one tick, so the `dt` in
 * `position += velocity · dt` is 1 by construction and does not appear in the
 * arithmetic below. `FIXED_DT_MS` is only how a tick is priced in real time
 * for the render loop's benefit, and never enters a world quantity.
 */

/**
 * Stokes' law, `drag = 6πμr`, with the medium's viscosity μ ≡ 1 — the same
 * move `BASELINE_BODY_RADIUS = 1` makes for length. This constant fixes the
 * *shape* of the drag law and was not tuned; the force below is the one free
 * knob, which is why all the tuning was done there.
 */
const DRAG_PER_RADIUS = 6 * Math.PI;

/**
 * The magnitude of the random force applied to a baseline body each tick, in
 * the direction it drew. Tuned against the constant above so a baseline body
 * moves about a tenth of its own radius per tick: enough to read as microscopy
 * at sixty ticks a second, little enough that a body covers a few body radii
 * in a minute rather than a lap of the aquarium.
 *
 * A body of any other radius is pushed by this times `√bodyRadius`. That is
 * fluctuation–dissipation: a larger body has more drag and takes more
 * molecular kicks, so the random force scales with the square root of drag.
 * The step then goes as `1/√r`, and since a random walk's diffusion
 * coefficient goes as the square of its step, `D ∝ 1/r` — Stokes–Einstein. A
 * force independent of radius would give a step `∝ 1/r` and `D ∝ 1/r²`,
 * sending small bodies out of the bright band twice as fast as the physics
 * says.
 *
 * Retuning this is a visible change to how a run looks, so the resulting step
 * length is pinned by a test rather than left to drift silently.
 */
const BROWNIAN_FORCE = 2;

/**
 * Resolve phase, step 6. Reads and writes only this organism — its position
 * and its own stream — which is what lets the phase run in any order.
 */
export function applyBrownianMotion(organism: Organism): void {
  const direction = drawUnitVector(organism.rng);
  organism.rng = direction.stream;

  // BROWNIAN_FORCE·√r / (DRAG_PER_RADIUS·r), simplified.
  const velocity =
    BROWNIAN_FORCE / (DRAG_PER_RADIUS * Math.sqrt(organism.bodyRadius));

  organism.x += direction.x * velocity;
  organism.y += direction.y * velocity;
}

/**
 * Commit phase, step 10, the wall half. Hard walls per ADR-0013: no
 * wraparound, no bouncing, no restitution. A body driven into a wall is set
 * down against it and stays there until brownian motion takes it away again —
 * clamping rather than reflecting is what makes the wall read as solid, and it
 * is also the one form that cannot inject energy into an overdamped world.
 *
 * The whole circle is constrained, not its centre, so a body never overlaps a
 * wall the way it may still overlap another body between separation passes.
 */
export function constrainToAquarium(organism: Organism): void {
  organism.x = clamp(
    organism.x,
    organism.bodyRadius,
    AQUARIUM_WIDTH - organism.bodyRadius,
  );
  organism.y = clamp(
    organism.y,
    organism.bodyRadius,
    Math.min(AQUARIUM_HEIGHT, CONFINE_DEPTH) - organism.bodyRadius,
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
