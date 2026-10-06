import {
  AQUARIUM_AREA,
  AQUARIUM_HEIGHT,
  AQUARIUM_WIDTH,
  BASELINE_GENOME,
  FIXED_DT_MS,
  advance,
  type Founder,
  type Genome,
  type Pools,
  type World,
} from "../../src/world";

/**
 * How the harness drives a world, and how it places the populations it
 * measures in.
 *
 * Everything here goes through `createWorld`, `advance` and the `get*`
 * readers — the same door the app and the long suite use. ADR-0024's
 * instrument opens no seam of its own, so if a measurement below cannot be
 * taken through that door, the answer is a reader on the world (there is
 * exactly one in this milestone, `getBrightAlpha`) and never a back way in
 * from `scripts/`.
 */

/**
 * `advance` is priced in real milliseconds and caps itself at 240 ticks per
 * call, so the harness asks for one tick at a time, exactly as
 * `conservation.long.test.ts` does. A 100k-tick run is 100k calls; the cost
 * is the ticks, not the calls.
 */
export function runTicks(world: World, ticks: number): World {
  let current = world;
  for (let tick = 0; tick < ticks; tick++) {
    ({world: current} = advance(current, FIXED_DT_MS));
  }

  return current;
}

/**
 * Runs `ticks`, calling `onTick` after each one. The sampling variant of
 * `runTicks`: a measurement that needs to watch something change over a run
 * — a depth, a peak, a trajectory — cannot get it from the world at the
 * end, because a peak is not state the world keeps.
 */
export function runTicksWatching(
  world: World,
  ticks: number,
  onTick: (world: World, tick: number) => void,
): World {
  let current = world;
  for (let tick = 1; tick <= ticks; tick++) {
    ({world: current} = advance(current, FIXED_DT_MS));
    onTick(current, tick);
  }

  return current;
}

/**
 * A genome that differs from the baseline in Cytoplasm Thickness alone, and
 * carries no organelles, so the thickness is the body's whole radius and a
 * ladder of thicknesses is a ladder of radii. Every
 * measurement here runs in a **fixed population** or an infertile one, so
 * the two reproduction genes are never read; they ride along at the
 * baseline's values so that a founder the harness places is the same
 * organism a founder the app places is, apart from the one gene under
 * measurement.
 */
export function genomeOfThickness(cytoplasmThickness: number): Genome {
  return {...BASELINE_GENOME, cytoplasmThickness};
}

/**
 * A geometric ladder of radii. Geometric rather than linear because the
 * exponent `n` in `income ∝ r^n` is fitted against `ln r`: evenly spaced
 * logs give every rung the same leverage on the fit, where evenly spaced
 * radii would crowd the small end of the log axis and let the largest body
 * decide the slope on its own.
 */
export function radiusLadder(
  min: number,
  max: number,
  rungs: number,
): readonly number[] {
  const ratio = (max / min) ** (1 / (rungs - 1));

  return Array.from({length: rungs}, (_unused, rung) => min * ratio ** rung);
}

/**
 * The ladder laid out along one depth: bodies in ascending order of radius,
 * touching nobody, with the leftover width shared equally between the gaps.
 *
 * One row at one depth, because `α` is a field over the aquarium (ADR-0015)
 * and a ladder measured across depths would be fitting an exponent against
 * two variables at once. One world holding the whole ladder rather than one
 * world per rung, for the same reason: the pools are global, so every rung
 * has to see the same ambient concentration or the fit picks up the
 * difference between their worlds instead of the difference between their
 * radii.
 */
export function ladderFounders(
  radii: readonly number[],
  depth: number,
): readonly Founder[] {
  const totalWidth = radii.reduce((sum, radius) => sum + 2 * radius, 0);
  const gap = (AQUARIUM_WIDTH - totalWidth) / (radii.length + 1);
  if (gap <= 0) {
    throw new Error(
      `A ladder of ${String(radii.length)} bodies up to radius ${String(radii[radii.length - 1])} does not fit across ${String(AQUARIUM_WIDTH)} baseline radii.`,
    );
  }

  let cursor = gap;

  return radii.map((radius) => {
    const x = cursor + radius;
    cursor += 2 * radius + gap;

    return {x, y: depth, genome: genomeOfThickness(radius)};
  });
}

/** A single body at `depth`, pulled up if its own radius would hang it
 * through the floor. `placeFounders` takes positions at their word and does
 * not clamp, deliberately, so the clamping belongs to whoever chose the
 * coordinate — here. */
export function soleFounder(radius: number, depth: number): readonly Founder[] {
  return [
    {
      x: AQUARIUM_WIDTH / 2,
      y: Math.min(depth, AQUARIUM_HEIGHT - radius),
      genome: genomeOfThickness(radius),
    },
  ];
}

/**
 * The ambient carbon concentration `s` (ADR-0022): both carbon-bearing
 * pools over the aquarium's area.
 *
 * One function rather than the division written out wherever it is needed,
 * because `s` is a named quantity of the model — the thing `s ≥ ρ` is a
 * statement about — and four copies of its arithmetic are four places that
 * can come to disagree about what the ambient is. It lives here rather than
 * on the world because the harness is the only reader: adding a third
 * thing to the world layer for an instrument is exactly what #34 says not
 * to do.
 */
export function ambientCarbon(pools: Pools): number {
  return (pools.food + pools.carbonDioxide) / AQUARIUM_AREA;
}
