import {
  BODY_COST_COEFFICIENT,
  C_NEURON,
  C_ORGANELLE,
  DELTA_BIAS,
  DELTA_DISCHARGE_FACTOR,
  DELTA_DRIVE,
  DELTA_ORGANELLE_POSITION,
  DELTA_ORGANELLE_RADIUS,
  DELTA_TAU,
  DELTA_THRESHOLD,
  EPSILON_ORIENTATION,
  K_CHLORO,
  K_FORCE,
  K_THRUST,
  R_MIN,
} from "./constants";

/**
 * The organelle types the world knows, each a declaration rather than code
 * (ADR-0028, ADR-0032): what a type's genes carry and how each of them
 * mutates, what the type costs to keep, and what it weighs. A declared
 * law has a worst case that can be read off the declaration, which is what
 * the Birth Cost Ceiling reads; a free `mutate()` per type could break the
 * ceiling unnoticed.
 */

/**
 * The closed menu of mutation laws a parameter can declare (ADR-0028),
 * widened only by ADR. M7 needed two of them; M10's thruster brings the
 * additive clamped law and the wrapping angle.
 */
export type ParameterLaw =
  /** `× (1 + u·δ)` or its reciprocal with equal probability, clamped up to
   * `floor` (ADR-0034). */
  | {
      readonly kind: "symmetricMultiplicative";
      readonly delta: number;
      readonly floor: number;
    }
  /** A step in the genome's frame of at most `delta` times the organelle's
   * own radius. */
  | {readonly kind: "cartesianStep"; readonly delta: number}
  /** `+ u·delta`, `u` signed, clamped to `[min, max]`. Adds no area or
   * reach. */
  | {
      readonly kind: "additiveClamped";
      readonly delta: number;
      readonly min: number;
      readonly max: number;
    }
  /** A unit vector `(c, s)` turned by `(c, s) += ε·(−s, c)`, `ε` a signed
   * step of at most `epsilon`, and renormalised: it wraps by construction
   * and evaluates no `sin` or `cos`. Adds no area or reach. */
  | {readonly kind: "unitVectorRotation"; readonly epsilon: number};

export interface ParameterDeclaration {
  /** The Organelle Gene field it mutates: `radius`, `position` for the
   * `x`/`y` pair, `orientation`, `drive` or one of the neuron's four CTRNN
   * parameters. The field a law writes follows
   * this name, not the law's kind. */
  readonly name:
    | "radius"
    | "position"
    | "orientation"
    | "drive"
    | "tau"
    | "bias"
    | "threshold"
    | "dischargeFactor";
  readonly law: ParameterLaw;
}

export interface OrganelleTypeDeclaration {
  /** Only the parameters the type uses, so no gene carries an inert
   * parameter that drifts at random (ADR-0032). */
  readonly parameters: readonly ParameterDeclaration[];
  /** The type's Organelle Overhead `c_type`, flat per tick per piece. */
  readonly overhead: number;
  /** `β_type`, what the type's own tissue costs per unit area per tick. */
  readonly tissueCost: number;
  /**
   * The type's density `c_type`, in units of `Δ` above the surface's water
   * (ADR-0030), or `"weightless"`: gravity ignores it, like the cytoplasm
   * (ADR-0032). A type weighs only when weight is what it does or what it
   * costs.
   */
  readonly density: number | "weightless";
  /**
   * The type's photosynthesis coefficient (ADR-0029): each piece fixes
   * `k × light × 2·r × C` on its own disc. Absent for a type that does not
   * photosynthesise, so M13's knockout is a different declaration, not a
   * branch in the metabolism.
   */
  readonly photosynthesis?: number;
  /**
   * What the type pushes with and pays for it (ADR-0032, ADR-0029): `force`
   * is `kForce`, each piece pushing with `signal × kForce × 2·r` along its
   * orientation, and `cost` is `k_thrust`, each piece paying `k_thrust × |F|`
   * of energy per tick. One field, so a type cannot push for free. Absent for
   * a type that does not push, so a knockout is a different declaration.
   */
  readonly thrust?: {readonly force: number; readonly cost: number};
  /** The names of the input ports the type declares: what a synapse's
   * destination names. */
  readonly inputPorts?: readonly string[];
  /** The names of the output ports the type declares: what a synapse's
   * source names. Absent for a type that has none. */
  readonly outputPorts?: readonly string[];
}

/**
 * The body's reserved id (ADR-0031): the endpoint the Innate Senses are
 * wired from. Outside the innovation counter's range, which starts at
 * `FIRST_INNOVATION_ID`, and outside the provisional negatives, so a
 * synapse names the body exactly as it names an organelle and minting never
 * touches it.
 */
export const BODY_ID = 0;

/**
 * The body's output ports, the seven Innate Senses (ADR-0037), in the fixed
 * order a report or an inspector lists them in. The body has no input port.
 */
export const INNATE_SENSES = [
  "energy",
  "food",
  "O₂",
  "CO₂",
  "light",
  "up",
  "tilt",
] as const;

export type InnateSense = (typeof INNATE_SENSES)[number];

/** The radius and position laws every type shares. */
const SHAPE_PARAMETERS: readonly ParameterDeclaration[] = [
  {
    name: "radius",
    law: {
      kind: "symmetricMultiplicative",
      delta: DELTA_ORGANELLE_RADIUS,
      floor: R_MIN,
    },
  },
  {
    name: "position",
    law: {kind: "cartesianStep", delta: DELTA_ORGANELLE_POSITION},
  },
];

/**
 * M7's one type, which M11 gives a mind. It takes space and pays its
 * overhead, and its tissue costs what cytoplasm costs (`β_type = β`), so its
 * price is the overhead, the storage it displaces and its packing. Weightless.
 * Beside radius and position it declares the four CTRNN parameters (ADR-0037)
 * and one input port `in` and one output port `out` (ADR-0031).
 */
const NEURON: OrganelleTypeDeclaration = {
  parameters: [
    ...SHAPE_PARAMETERS,
    {
      name: "tau",
      law: {kind: "symmetricMultiplicative", delta: DELTA_TAU, floor: 1},
    },
    {
      name: "bias",
      law: {kind: "additiveClamped", delta: DELTA_BIAS, min: -4, max: 4},
    },
    {
      name: "threshold",
      law: {kind: "additiveClamped", delta: DELTA_THRESHOLD, min: 0, max: 4},
    },
    {
      name: "dischargeFactor",
      law: {
        kind: "additiveClamped",
        delta: DELTA_DISCHARGE_FACTOR,
        min: 0,
        max: 1,
      },
    },
  ],
  overhead: C_NEURON,
  tissueCost: BODY_COST_COEFFICIENT,
  density: "weightless",
  inputPorts: ["in"],
  outputPorts: ["out"],
};

/**
 * M8's float: the first type that weighs. Its density is `ρ_w(0) − Δ`, one
 * span lighter than the surface's water, so it lifts at every depth and
 * more the deeper it sits (ADR-0032). It has the shape laws, no ports, and
 * pays the shared `c_organelle` as its overhead and `β` on its tissue.
 */
const FLOAT: OrganelleTypeDeclaration = {
  parameters: SHAPE_PARAMETERS,
  overhead: C_ORGANELLE,
  tissueCost: BODY_COST_COEFFICIENT,
  density: -1,
};

/**
 * M9's chloroplast: the first organelle that moves carbon, and the second
 * that weighs. Denser than the floor's water (`+3/2`), so alone it sinks its
 * carrier. It has the shape laws, no ports, and pays the shared
 * `c_organelle` as its overhead and `β` on its tissue. In the default roster
 * since M9.
 */
const CHLOROPLAST: OrganelleTypeDeclaration = {
  parameters: SHAPE_PARAMETERS,
  overhead: C_ORGANELLE,
  tissueCost: BODY_COST_COEFFICIENT,
  density: 1.5,
  photosynthesis: K_CHLORO,
};

/**
 * M10's thruster: the only actuator of v0.2 and the second weightless type.
 * It has the shape laws, plus `orientation` and
 * `drive`, pays the shared `c_organelle` and `β`, and declares the `power`
 * port, which a synapse can wire (M11).
 */
const THRUSTER: OrganelleTypeDeclaration = {
  parameters: [
    ...SHAPE_PARAMETERS,
    {
      name: "orientation",
      law: {kind: "unitVectorRotation", epsilon: EPSILON_ORIENTATION},
    },
    {
      name: "drive",
      law: {kind: "additiveClamped", delta: DELTA_DRIVE, min: 0, max: 1},
    },
  ],
  overhead: C_ORGANELLE,
  tissueCost: BODY_COST_COEFFICIENT,
  density: "weightless",
  thrust: {force: K_FORCE, cost: K_THRUST},
  inputPorts: ["power"],
};

export const ORGANELLE_TYPES = {
  neuron: NEURON,
  float: FLOAT,
  chloroplast: CHLOROPLAST,
  thruster: THRUSTER,
} as const satisfies Readonly<Record<string, OrganelleTypeDeclaration>>;

export type OrganelleType = keyof typeof ORGANELLE_TYPES;

/**
 * The roster a world runs with unless it is given another (ADR-0032): the
 * organelle types its insertions draw from. M10's is the neuron, the float,
 * the chloroplast and the thruster, a quarter of the insertions each; an
 * empty roster is M6's world.
 */
export const DEFAULT_ROSTER: readonly OrganelleType[] = [
  "neuron",
  "float",
  "chloroplast",
  "thruster",
];
