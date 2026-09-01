/**
 * The world's geometry, in the length unit `vision.md`'s calibration method
 * fixes: **one baseline body radius**. Non-dimensionalising rather than
 * guessing is what lets M5 solve the constants for a target `r_opt` instead
 * of tuning them by eye, so every length in the simulation is written as a
 * multiple of `BASELINE_BODY_RADIUS` and never in pixels. How many pixels a
 * unit is drawn at is a rendering decision, and lives in the App layer.
 */

export const BASELINE_BODY_RADIUS = 1;

/**
 * Hard-walled and finite, per ADR-0013: no toroidal wraparound, and the
 * landscape aspect gives the M2 light gradient a surface (y = 0) and a floor
 * to run between. Sized so the generation-0 population reads as a sparse
 * culture under a microscope — crowded enough that bodies meet, open enough
 * that a lineage has somewhere to spread into.
 */
export const AQUARIUM_WIDTH = 60 * BASELINE_BODY_RADIUS;
export const AQUARIUM_HEIGHT = 40 * BASELINE_BODY_RADIUS;
