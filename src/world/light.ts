import {AQUARIUM_HEIGHT} from "./aquarium";
import {LIGHT_ATTENUATION_K, LIGHT_SURFACE_INTENSITY} from "./constants";

/**
 * Light as a quantity the simulation can read (ADR-0004): exponential
 * attenuation with depth, `I(y) = I₀ · e^(−k·y)`, precomputed into a table
 * rather than evaluated in the loop. `Math.exp` is implementation-defined to
 * the last ulp (ADR-0007), and a chaotic system run for a million ticks
 * would diverge across engines on that alone. This module pays that cost
 * exactly once, at module load, and every lookup after that costs linear
 * interpolation only — `+ − × ÷`, nothing transcendental.
 *
 * The table is a pure function of the aquarium's height and the world's
 * light constants and never changes over a run — the opposite of the
 * uniform grid, which is rebuilt every tick precisely because it describes
 * something that moves.
 */

/**
 * Table resolution, per the ticket: every 0.1 baseline radii. Finer buys
 * precision the interpolation tolerance does not need; coarser starts
 * quantising the gradient into steps wide enough for a lineage to settle
 * on one.
 */
const SAMPLE_STEP = 0.1;

/**
 * Sample count from the surface to the floor, inclusive of both ends, so a
 * lookup exactly at `AQUARIUM_HEIGHT` reads the floor's real value instead
 * of extrapolating past the last entry. `Math.round` guards the count
 * against `AQUARIUM_HEIGHT / SAMPLE_STEP` landing a hair either side of an
 * integer, which 0.1's binary imprecision otherwise risks.
 */
const SAMPLE_COUNT = Math.round(AQUARIUM_HEIGHT / SAMPLE_STEP) + 1;

/** The exact answer, evaluated only here, while the table is built. */
function exactLightAt(y: number): number {
  return LIGHT_SURFACE_INTENSITY * Math.exp(-LIGHT_ATTENUATION_K * y);
}

function buildLightTable(): readonly number[] {
  const table: number[] = [];
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    table.push(exactLightAt(i * SAMPLE_STEP));
  }

  return table;
}

/** Built once, at module load — see the module comment above. */
const LIGHT_TABLE = buildLightTable();

/**
 * Light at depth `y`, read from the precomputed table with linear
 * interpolation. Depths outside the aquarium clamp to its nearest edge
 * rather than reading past the table: above the surface reads as the
 * surface's value, below the floor as the floor's.
 *
 * Callers sample at a body's *centre*, never its upper edge. The
 * projected-width factor in the photosynthesis rate already carries body
 * size; sampling the edge would hand a large body a second advantage
 * nothing in the model intends. Nothing calls this with a body's edge yet —
 * photosynthesis arrives later in the milestone — but the rule belongs here,
 * on the function that owns it.
 */
export function lightAt(y: number): number {
  const clampedY = Math.min(Math.max(y, 0), AQUARIUM_HEIGHT);
  const position = clampedY / SAMPLE_STEP;
  const lowerIndex = Math.min(Math.floor(position), SAMPLE_COUNT - 1);
  const upperIndex = Math.min(lowerIndex + 1, SAMPLE_COUNT - 1);
  const fraction = position - lowerIndex;

  const lower = LIGHT_TABLE[lowerIndex];
  const upper = LIGHT_TABLE[upperIndex];

  return lower + (upper - lower) * fraction;
}
