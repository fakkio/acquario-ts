import {describe, expect, it, vi} from "vitest";

import {AQUARIUM_HEIGHT} from "./aquarium";
import {LIGHT_ATTENUATION_K, LIGHT_SURFACE_INTENSITY} from "./constants";
import {lightAt} from "./light";

/**
 * Linear interpolation of a curve with curvature carries a real error, not
 * just floating-point noise: for a step `h` the bound is
 * `(h²/8) · max|f''|`, and for `f(y) = I₀·e^(−ky)` that maximum is
 * `k²·I₀` at the surface. With `h = 0.1` and `k = ln(10)/10` that predicts
 * a relative error around 6.6e-5; this tolerance leaves an order of
 * magnitude of headroom above that prediction.
 */
const INTERPOLATION_TOLERANCE = 1e-3;

const exactLightAt = (y: number): number =>
  LIGHT_SURFACE_INTENSITY * Math.exp(-LIGHT_ATTENUATION_K * y);

describe("lightAt", () => {
  it("is strongest at the surface and weakest at the floor", () => {
    expect(lightAt(0)).toBeGreaterThan(lightAt(AQUARIUM_HEIGHT));
  });

  it("attenuates monotonically with depth", () => {
    let previous = lightAt(0);
    for (let y = 1; y <= AQUARIUM_HEIGHT; y++) {
      const current = lightAt(y);
      expect(current).toBeLessThan(previous);
      previous = current;
    }
  });

  it("falls to a tenth of the surface value ten baseline radii down", () => {
    expect(lightAt(10)).toBeCloseTo(lightAt(0) / 10, 6);
  });

  it("matches the exact exponential within tolerance across the full height", () => {
    for (let y = 0; y <= AQUARIUM_HEIGHT; y += 0.37) {
      const exact = exactLightAt(y);
      const relativeError = Math.abs(lightAt(y) - exact) / exact;
      expect(relativeError).toBeLessThan(INTERPOLATION_TOLERANCE);
    }
  });

  it("matches the exact exponential at both extremes", () => {
    expect(lightAt(0)).toBeCloseTo(exactLightAt(0), 9);
    expect(lightAt(AQUARIUM_HEIGHT)).toBeCloseTo(
      exactLightAt(AQUARIUM_HEIGHT),
      9,
    );
  });

  it("interpolates linearly between two adjacent sample points", () => {
    // Halfway between the samples at y=5 and y=5.1, the interpolated value
    // has to be their exact midpoint — not a re-evaluation of the curve,
    // which is what would happen if a lookup fell through to Math.exp.
    const midpoint = (lightAt(5) + lightAt(5.1)) / 2;
    expect(lightAt(5.05)).toBeCloseTo(midpoint, 9);
  });

  it("clamps to the surface value above y=0", () => {
    expect(lightAt(-5)).toBe(lightAt(0));
  });

  it("clamps to the floor value below the aquarium", () => {
    expect(lightAt(AQUARIUM_HEIGHT + 50)).toBe(lightAt(AQUARIUM_HEIGHT));
  });

  it("evaluates no transcendental function per lookup", () => {
    // The table is built at module load, before this spy is installed —
    // this only proves a lookup itself never reaches for Math.exp again.
    const exp = vi.spyOn(Math, "exp");
    lightAt(0);
    lightAt(13.37);
    lightAt(AQUARIUM_HEIGHT);
    expect(exp).not.toHaveBeenCalled();
    exp.mockRestore();
  });
});
