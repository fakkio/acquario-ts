import {AQUARIUM_HEIGHT, AQUARIUM_WIDTH} from "./aquarium";
import {BROWNIAN_FORCE, DRAG_PER_RADIUS} from "./constants";
import {buoyantTorque, buoyantWeight, turn} from "./gravity";
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

/** `8π`, the rotational drag of a Stokes sphere per cubed radius; its
 * translational sibling is `DRAG_PER_RADIUS = 6π`. */
export const ROTATIONAL_DRAG_PER_CUBE = 8 * Math.PI;

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
 * Three forces move a body, all over its drag `6π·R`: a Brownian push in a
 * random direction (the step's first and only draw), the Buoyant Weight
 * straight down, positive towards the floor (`gravity.ts`), and each
 * thruster's push along its orientation, turned through the axis the tick
 * started with. The buoyant torque and the thrusters' torques `p × F` add,
 * and their sum turns the Body Axis at `τ / 8π·R³`. A body with nothing that
 * weighs and no thruster feels none of them, and moves exactly as in v0.1.
 */
export function applyMotion(
  organism: Organism,
  options: MotionOptions = {},
): void {
  const radius = organism.bodyRadius;
  const moments = organism.moments;
  const {thrusters} = organism;

  if (options.brownian !== "off") {
    const direction = drawUnitVector(organism.rng);
    organism.rng = direction.stream;

    // BROWNIAN_FORCE·√R / (DRAG_PER_RADIUS·R), simplified.
    const velocity = BROWNIAN_FORCE / (DRAG_PER_RADIUS * Math.sqrt(radius));

    organism.x += direction.x * velocity;
    organism.y += direction.y * velocity;
  }

  if (moments.area === 0 && thrusters.length === 0) {
    return;
  }

  const {axis} = organism;
  const weight = buoyantWeight(moments, organism.y, axis);
  let torque = buoyantTorque(moments, organism.y, axis);
  organism.y += weight / (DRAG_PER_RADIUS * radius);

  // Each thruster in genome order: its force in the body frame, turned into
  // the world for the translation, and `p × F` for the torque (the cross
  // product is the same in either frame), signed as gravity's is.
  let thrustX = 0;
  let thrustY = 0;
  for (const [i, thruster] of thrusters.entries()) {
    const magnitude = organism.thrusterSignals[i] * thruster.maxForce;
    const fx = thruster.dx * magnitude;
    const fy = thruster.dy * magnitude;
    const world = turn(axis, fx, fy);
    thrustX += world.x;
    thrustY += world.y;
    torque += thruster.x * fy - thruster.y * fx;
  }
  const drag = DRAG_PER_RADIUS * radius;
  organism.x += thrustX / drag;
  organism.y += thrustY / drag;

  // The rotational drag of the Stokes sphere whose translational drag is
  // `6π·R`. One small rotation by `ω` and a renormalising square root: no
  // `sin` or `cos` in the tick, and the axis stays a unit vector to rounding.
  const omega = torque / (ROTATIONAL_DRAG_PER_CUBE * radius ** 3);
  const cos = axis.cos - omega * axis.sin;
  const sin = axis.sin + omega * axis.cos;
  const norm = Math.sqrt(cos * cos + sin * sin);
  axis.cos = cos / norm;
  axis.sin = sin / norm;
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
