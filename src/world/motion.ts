import {AQUARIUM_HEIGHT, AQUARIUM_WIDTH} from "./aquarium";
import {BROWNIAN_FORCE, DRAG_PER_RADIUS} from "./constants";
import {buoyantWeight} from "./gravity";
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

/*
 * The Brownian force is applied to a body of radius `R` as `BROWNIAN_FORCE ·
 * √R` (`constants.ts`). That is fluctuation–dissipation: a larger body has
 * more drag and takes more molecular kicks, so the random force scales with
 * the square root of drag. The step then goes as `1/√R`, and since a random
 * walk's diffusion coefficient goes as the square of its step, `D ∝ 1/R`,
 * Stokes–Einstein. A force independent of radius would give a step `∝ 1/R`
 * and `D ∝ 1/R²`, sending small bodies out of the bright band twice as fast
 * as the physics says.
 *
 * Retuning `BROWNIAN_FORCE` is a visible change to how a run looks, and moves
 * `G` with it, so the resulting step length is pinned by a test rather than
 * left to drift silently.
 */

/** What a test may change about the motion step. Production passes none; the
 * declarations it reads are the organism's, supplied at its construction. */
export interface MotionOptions {
  /** `"off"` draws nothing and moves a body by its Buoyant Weight alone. */
  readonly brownian?: "on" | "off";
}

/**
 * Resolve phase, step 6. Reads and writes only this organism — its position
 * and its own stream — which is what lets the phase run in any order.
 *
 * Two forces move a body, both over its drag `6π·R`: a Brownian push in a
 * random direction (the step's first and only draw), and the Buoyant Weight
 * straight down, positive towards the floor (`gravity.ts`). A body with
 * nothing that weighs feels no gravity and moves exactly as in v0.1.
 */
export function applyMotion(
  organism: Organism,
  options: MotionOptions = {},
): void {
  const radius = organism.bodyRadius;
  const moments = organism.moments;

  if (options.brownian !== "off") {
    const direction = drawUnitVector(organism.rng);
    organism.rng = direction.stream;

    // BROWNIAN_FORCE·√R / (DRAG_PER_RADIUS·R), simplified.
    const velocity = BROWNIAN_FORCE / (DRAG_PER_RADIUS * Math.sqrt(radius));

    organism.x += direction.x * velocity;
    organism.y += direction.y * velocity;
  }

  organism.y += buoyantWeight(moments, organism.y) / (DRAG_PER_RADIUS * radius);
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
    AQUARIUM_HEIGHT - organism.bodyRadius,
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
