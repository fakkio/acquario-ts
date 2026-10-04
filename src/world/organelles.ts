import {
  BODY_COST_COEFFICIENT,
  C_NEURON,
  DELTA_ORGANELLE_POSITION,
  DELTA_ORGANELLE_RADIUS,
  R_MIN,
} from "./constants";

/**
 * The organelle types the world knows, each a declaration rather than code
 * (ADR-0028, ADR-0032): what a type's genes carry and how each of them
 * mutates, what the type costs to keep, and whether it weighs. A declared
 * law has a worst case that can be read off the declaration, which is what
 * the Birth Cost Ceiling reads; a free `mutate()` per type could break the
 * ceiling unnoticed.
 */

/**
 * The closed menu of mutation laws a parameter can declare (ADR-0028),
 * widened only by ADR. M7 needs two of them; the additive clamped law and
 * the wrapping angle arrive with the first type that declares one.
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
  | {readonly kind: "cartesianStep"; readonly delta: number};

export interface ParameterDeclaration {
  /** The Organelle Gene field it mutates: `radius`, or `position` for the
   * `x`/`y` pair. */
  readonly name: "radius" | "position";
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
  /** Whether gravity ignores it (ADR-0032), read once gravity exists (M8). */
  readonly weightless: boolean;
}

/**
 * M7's one type. A neuron without synapses does nothing: it takes space and
 * pays its overhead, and its tissue costs what cytoplasm costs (`β_type =
 * β`), so its whole price is the overhead, the storage it displaces and its
 * packing. Weightless and without ports: the CTRNN parameters and the ports
 * that give them meaning are M11's (ADR-0031).
 */
const NEURON: OrganelleTypeDeclaration = {
  parameters: [
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
  ],
  overhead: C_NEURON,
  tissueCost: BODY_COST_COEFFICIENT,
  weightless: true,
};

export const ORGANELLE_TYPES = {
  neuron: NEURON,
} as const satisfies Readonly<Record<string, OrganelleTypeDeclaration>>;

export type OrganelleType = keyof typeof ORGANELLE_TYPES;

/**
 * The roster a world runs with unless it is given another (ADR-0032): the
 * organelle types its insertions draw from. M7's is the neuron alone; an
 * empty roster is M6's world.
 */
export const DEFAULT_ROSTER: readonly OrganelleType[] = ["neuron"];
