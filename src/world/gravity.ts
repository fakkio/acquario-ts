import {AQUARIUM_HEIGHT} from "./aquarium";
import {DENSITY_SPAN, G, WATER_DENSITY_AT_SURFACE} from "./constants";
import type {OrganelleGene} from "./genome";
import {ORGANELLE_TYPES, type OrganelleTypeDeclaration} from "./organelles";

/**
 * Gravity on a body (ADR-0030): the water's density rises linearly from the
 * surface to the floor, `ρ_w(y) = ρ_w(0) + Δ·y/H`, and only weighing
 * organelles feel it. The cytoplasm, the neuron and every store are neutral
 * at every depth. Each organelle weighs `aᵢ·(cᵢ − ρ_w(yᵢ))` at its own depth
 * `yᵢ = y + rᵢ_y`, positive downwards, and because the water is linear in
 * depth the sum over a body needs only the sums below, derived once from the
 * layout.
 */

/**
 * The layout moments over weighing organelles, in the body frame, with
 * `aᵢ = π·rᵢ²`, `cᵢ` the type's density and `rᵢ` its position in the body.
 * A body with none has them at zero. Internal: only motion and the
 * inspector read them.
 */
export interface LayoutMoments {
  /** `A = Σ aᵢ`, the weighing area. */
  readonly area: number;
  /** `M = Σ cᵢ·aᵢ`, the weighing area's total density. */
  readonly densityArea: number;
  /** `P = Σ aᵢ·rᵢ`, in the body frame. */
  readonly px: number;
  readonly py: number;
  /** `Q = Σ cᵢ·aᵢ·rᵢ`, in the body frame. */
  readonly qx: number;
  readonly qy: number;
  /** `I = Σ aᵢ·rᵢ·rᵢᵀ`, the symmetric tensor, in the body frame. */
  readonly ixx: number;
  readonly ixy: number;
  readonly iyy: number;
}

export const NO_MOMENTS: LayoutMoments = {
  area: 0,
  densityArea: 0,
  px: 0,
  py: 0,
  qx: 0,
  qy: 0,
  ixx: 0,
  ixy: 0,
  iyy: 0,
};

/**
 * The **Body Axis** (glossary): the body frame's orientation in the world, as
 * the cosine and sine of its angle. Physical state, not a gene. A unit vector
 * to rounding, kept so by the motion step; `WORLD_AXIS` is the world's own,
 * where a founder starts and every body of M7 and before stayed.
 */
export interface BodyAxis {
  cos: number;
  sin: number;
}

export const WORLD_AXIS: Readonly<BodyAxis> = {cos: 1, sin: 0};

export const worldAxis = (): BodyAxis => ({...WORLD_AXIS});

/** A body-frame vector turned through the axis into the world frame. */
export function turn(
  axis: BodyAxis,
  x: number,
  y: number,
): {readonly x: number; readonly y: number} {
  return {x: axis.cos * x - axis.sin * y, y: axis.sin * x + axis.cos * y};
}

/**
 * `declarations` is `ORGANELLE_TYPES` in production; a test may supply its
 * own, to put a fixture type of a chosen density on a body.
 */
export function layoutMoments(
  organelles: readonly OrganelleGene[],
  declarations: Readonly<
    Record<string, OrganelleTypeDeclaration>
  > = ORGANELLE_TYPES,
): LayoutMoments {
  let area = 0;
  let densityArea = 0;
  let px = 0;
  let py = 0;
  let qx = 0;
  let qy = 0;
  let ixx = 0;
  let ixy = 0;
  let iyy = 0;
  for (const organelle of organelles) {
    const {density: typeDensity} = declarations[organelle.type];
    if (typeDensity === "weightless") {
      continue;
    }
    const c = typeDensity;
    const a = Math.PI * organelle.radius * organelle.radius;
    area += a;
    densityArea += c * a;
    px += a * organelle.x;
    py += a * organelle.y;
    qx += c * a * organelle.x;
    qy += c * a * organelle.y;
    ixx += a * organelle.x * organelle.x;
    ixy += a * organelle.x * organelle.y;
    iyy += a * organelle.y * organelle.y;
  }

  return area === 0
    ? NO_MOMENTS
    : {area, densityArea, px, py, qx, qy, ixx, ixy, iyy};
}

/**
 * The Buoyant Weight of a body at depth `y` with its Body Axis turned: `W =
 * g·[M − (y/H)·A − P'_y/H]`, positive downwards, `P'` the moment turned
 * through the axis. Exact for the linear water, and zero for a body with
 * nothing that weighs.
 */
export function buoyantWeight(
  moments: LayoutMoments,
  y: number,
  axis: BodyAxis = WORLD_AXIS,
): number {
  if (moments.area === 0) {
    return 0;
  }
  const turned = turn(axis, moments.px, moments.py);

  return (
    G *
    (moments.densityArea -
      WATER_DENSITY_AT_SURFACE * moments.area -
      (DENSITY_SPAN * (y * moments.area + turned.y)) / AQUARIUM_HEIGHT)
  );
}

/**
 * The torque of that weight about the body's centre: `τ = g·[Q'_x − (y/H)·P'_x
 * − I'_xy/H]`, exact for the same reason. Positive turns the axis the way the
 * render turns organelles (x towards y, clockwise on the screen, whose y runs
 * down). Zero for a body whose weight sits on its centre, and for one with
 * nothing that weighs.
 */
export function buoyantTorque(
  moments: LayoutMoments,
  y: number,
  axis: BodyAxis = WORLD_AXIS,
): number {
  if (moments.area === 0) {
    return 0;
  }
  const {cos: c, sin: s} = axis;
  const p = turn(axis, moments.px, moments.py);
  const q = turn(axis, moments.qx, moments.qy);
  const ixy =
    c * s * (moments.ixx - moments.iyy) + (c * c - s * s) * moments.ixy;
  const shift = WATER_DENSITY_AT_SURFACE + (DENSITY_SPAN * y) / AQUARIUM_HEIGHT;

  return G * (q.x - shift * p.x - (DENSITY_SPAN * ixy) / AQUARIUM_HEIGHT);
}

/** Where a body comes to rest: a depth, or the wall it ends against. */
export type RestingDepth =
  | {readonly kind: "interior"; readonly depth: number}
  | {readonly kind: "surface" | "floor" | "none"};

/**
 * The **Resting Depth** (glossary): the depth of the body's centre where the
 * Buoyant Weight is zero. The weighing organelles' mean density `M/A` sits
 * at depth `H·(M/A − ρ_w(0))/Δ` in the water, so the centre rests that far
 * down less the layout's mean offset `P_y/A`. A mean density outside the
 * water's range has no depth to rest at: the body ends against the surface
 * (lighter than the water at every depth) or the floor (heavier), and a body
 * with nothing that weighs has none.
 */
export function restingDepth(moments: LayoutMoments): RestingDepth {
  if (moments.area === 0) {
    return {kind: "none"};
  }
  const meanDensity = moments.densityArea / moments.area;
  if (meanDensity <= WATER_DENSITY_AT_SURFACE) {
    return {kind: "surface"};
  }
  if (meanDensity >= WATER_DENSITY_AT_SURFACE + DENSITY_SPAN) {
    return {kind: "floor"};
  }

  return {
    kind: "interior",
    depth:
      (AQUARIUM_HEIGHT * (meanDensity - WATER_DENSITY_AT_SURFACE)) /
        DENSITY_SPAN -
      moments.py / moments.area,
  };
}
