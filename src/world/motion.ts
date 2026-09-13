import {AQUARIUM_HEIGHT, AQUARIUM_WIDTH} from "./aquarium";
import type {Organism} from "./organism";
import {nextRng, type RngStream} from "./rng";

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
 * The magnitude of the random force applied to a body each tick, in the
 * direction it drew. Tuned against the constant above so a baseline body moves
 * about a tenth of its own radius per tick: enough to read as microscopy at
 * sixty ticks a second, little enough that a body covers a few body radii in a
 * minute rather than a lap of the aquarium.
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
  const direction = drawDirection(organism.rng);
  organism.rng = direction.stream;

  const velocity = BROWNIAN_FORCE / (DRAG_PER_RADIUS * organism.bodyRadius);

  organism.x += direction.x * velocity;
  organism.y += direction.y * velocity;
}

/**
 * A uniformly distributed unit vector, by rejection sampling the unit disc:
 * draw a point in the square, keep it if it landed inside the circle,
 * normalise. Roughly a fifth of draws are thrown away, and the loop consumes a
 * number of draws that varies from tick to tick.
 *
 * The obvious alternative — draw an angle and take its cosine and sine — is
 * one draw and no loop, and it is rejected on ADR-0007's grounds. That ADR
 * settles for same-engine determinism precisely because `Math.sin` and friends
 * are implementation-defined to the last ulp, and records as the consequence
 * that v0.1's inner loop is left "using arithmetic only", so the remaining gap
 * to bit-portability is "one table to freeze rather than an audit of every
 * formula". Putting a transcendental in the hottest loop in the simulation
 * would not break the guarantee as stated, but it would quietly cost that
 * consequence. Every operation below is drawn from the `+ − × ÷ sqrt` set the
 * same ADR names as bit-identical everywhere.
 *
 * The varying draw count costs nothing: per-organism streams are exactly what
 * ADR-0007 introduces so that changing how many numbers brownian motion
 * consumes cannot shift any other organism's sequence.
 */
function drawDirection(stream: RngStream): {
  readonly x: number;
  readonly y: number;
  readonly stream: RngStream;
} {
  let current = stream;

  for (;;) {
    const drawX = nextRng(current);
    const drawY = nextRng(drawX.stream);
    current = drawY.stream;

    const x = drawX.value * 2 - 1;
    const y = drawY.value * 2 - 1;
    const lengthSquared = x * x + y * y;

    // Outside the disc would bias the direction toward the square's corners;
    // dead centre has no direction to point in at all.
    if (lengthSquared > 0 && lengthSquared <= 1) {
      const length = Math.sqrt(lengthSquared);
      return {x: x / length, y: y / length, stream: current};
    }
  }
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
