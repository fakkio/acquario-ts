import {
  AQUARIUM_HEIGHT,
  AQUARIUM_WIDTH,
  BASELINE_BODY_RADIUS,
} from "./aquarium";
import {K_CAP, K_CAP_ENERGY, RHO} from "./constants";
import {foldString} from "./hash";
import {deriveChildStream, nextRng, type RngStream} from "./rng";

/**
 * How many organisms `createWorld` places. Generation 0 is placed, not bred:
 * mitosis and the baseline genome it mutates from arrive in M4.
 */
export const STARTING_POPULATION = 40;

/**
 * Generation-0 body radii are drawn uniformly between these multiples of the
 * baseline, which is why they sit either side of 1: the baseline has to stay
 * the population's central body, or the length unit the whole calibration
 * method rests on ends up smaller than the median organism.
 *
 * The spread exists so the `1/r` diffusion coefficient of the motion ticket
 * is visible by eye, and so the grid's cell size has a real largest radius to
 * derive itself from. None of it is heritable: the variation comes from the
 * global stream at placement, and the `Genome` that makes it heritable
 * arrives in M4.
 */
export const MIN_RADIUS_FACTOR = 0.6;
export const MAX_RADIUS_FACTOR = 1.4;

/**
 * The largest body the world allows, and so the reach every structure that
 * has to bound how far a body extends past its own centre is derived from —
 * the uniform grid's cell size first. Kept here rather than in the grid so
 * there is one answer to "how big can a body get", and the grid asks it
 * rather than restating it.
 *
 * In M1 nothing grows and nothing is born, so this is exactly the top of
 * generation 0's spread, and a real ceiling.
 *
 * **It stops being one at M4.** `bodyRadius` is a gene with range `> 0`
 * mutating multiplicatively, so once reproduction exists there is no largest
 * radius for anything to derive itself from, and this constant goes on
 * describing generation 0 while the population grows past it. Nothing fails
 * loudly when that happens: a body wider than a cell is a body its neighbours'
 * queries stop finding, with the suite still green. ADR-0012 records what the
 * grid has to do instead.
 */
export const MAX_BODY_RADIUS = MAX_RADIUS_FACTOR * BASELINE_BODY_RADIUS;

/**
 * Everything the App layer is allowed to know about an organism. `World`
 * hands out `OrganismView[]`, never `Organism[]`, so the render layer can
 * read a body without being able to move it — the population is the world's
 * to mutate, and only inside a tick's commit phase.
 */
export interface OrganismView {
  readonly x: number;
  readonly y: number;
  readonly bodyRadius: number;
  readonly lineageHue: number;
  readonly energy: number;
  readonly oxygen: number;
  readonly carbonDioxide: number;
  readonly food: number;
}

export interface OrganismInit {
  readonly x: number;
  readonly y: number;
  readonly bodyRadius: number;
  readonly lineageHue: number;
  readonly rng: RngStream;
  /**
   * The four internal resource stores, all defaulting to 0. Left optional
   * here rather than required: placement (`createPopulation`) does not know
   * the carbon budget, so it is `initializeMetabolism` in `ledger.ts`,
   * called once from `createWorld`, that fills generation 0 to diffusive
   * equilibrium. Everywhere else that builds an `Organism` by hand — motion
   * and separation's fixtures among them — has no reason to care about
   * metabolism at all, and 0 lets them go on not caring.
   */
  readonly energy?: number;
  readonly oxygen?: number;
  readonly carbonDioxide?: number;
  readonly food?: number;
}

/**
 * One of the four quantities an organism holds internally (glossary:
 * Resource). Named as a union rather than folded into `Organism`'s field
 * list so `capFor` can be written once against the resource instead of once
 * per field.
 */
export type Resource = "energy" | "oxygen" | "carbonDioxide" | "food";

/**
 * The three resources that cross the membrane and have a pool — `Resource`
 * minus `energy`, which is produced and spent but never exchanged with the
 * world (CONTEXT.md). The `Environment` seam (ADR-0005) is typed against
 * this subtype rather than `Resource`, so "energy is never exchanged" is a
 * fact the compiler enforces rather than a comment somebody has to
 * remember.
 */
export type Diffusible = "oxygen" | "carbonDioxide" | "food";

/** Every `Diffusible`, for the modules that need to loop over all three
 * without redeclaring the list — `environment.ts` and `metabolism.ts`. */
export const DIFFUSIBLES: readonly Diffusible[] = [
  "oxygen",
  "carbonDioxide",
  "food",
];

/**
 * A cap is a maximum internal *concentration* (ADR-0003), not a bucket
 * size: `coefficient × bodyArea`. Energy carries `K_CAP_ENERGY` rather than
 * the three diffusibles' `K_CAP`, because its unit is fixed independently
 * by `β = 1` rather than by coincidence of notation.
 */
const CAP_COEFFICIENT: Readonly<Record<Resource, number>> = {
  energy: K_CAP_ENERGY,
  oxygen: K_CAP,
  carbonDioxide: K_CAP,
  food: K_CAP,
};

/**
 * A mutable class instance, per ADR-0013's choice of OOP over SoA: the tick
 * moves a body by writing to it, rather than by allocating a replacement
 * population every one of sixty ticks a second.
 *
 * `x`/`y` and `rng` are the state a tick advances. `bodyRadius` and
 * `lineageHue` are fixed for a life: both mutate at reproduction from M4 on,
 * where the child gets its own values, never in place on a living organism.
 * They are plain fields here rather than a `Genome` because nothing in M1
 * reproduces, so nothing in M1 is heritable.
 *
 * No rotation and no angular velocity: a circle with no organelles has no
 * visible orientation, and rotation arrives in v0.2 with the organelles whose
 * placement makes it matter.
 *
 * The four internal resource stores arrive in M2. They are plain mutable
 * fields for the same reason `x`/`y` are: metabolism will write to them
 * every tick. `bodyMass` is deliberately *not* one of them — see
 * `bodyMass` below.
 */
export class Organism {
  x: number;
  y: number;
  readonly bodyRadius: number;
  readonly lineageHue: number;
  /** Per ADR-0007, consumed only by this organism, so its sequence depends
   * on its own lineage and not on how many draws the rest of the world made. */
  rng: RngStream;
  energy: number;
  oxygen: number;
  carbonDioxide: number;
  food: number;

  constructor(init: OrganismInit) {
    this.x = init.x;
    this.y = init.y;
    this.bodyRadius = init.bodyRadius;
    this.lineageHue = init.lineageHue;
    this.rng = init.rng;
    this.energy = init.energy ?? 0;
    this.oxygen = init.oxygen ?? 0;
    this.carbonDioxide = init.carbonDioxide ?? 0;
    this.food = init.food ?? 0;
  }
}

/**
 * The area a body occupies, in the same length unit as `bodyRadius`. The
 * one place that area is computed, so every cap and every ledger term reads
 * it the same way.
 *
 * Typed against `bodyRadius` alone, not the full `Organism`, so the App
 * layer can compute a cap or an area off an `OrganismView` too — the render
 * layer reads energy fraction for body brightness (M2) without needing the
 * mutable class the world itself works with.
 */
export function bodyArea(organism: {readonly bodyRadius: number}): number {
  return Math.PI * organism.bodyRadius * organism.bodyRadius;
}

/**
 * A body's mass, derived from `bodyRadius` rather than stored. With `ρ = 1`
 * and a radius fixed for life the two can never disagree, and a stored
 * field would be a second home for the same truth — one that fails
 * silently, since a ledger stays self-consistent while describing a body
 * that is not there. Growth during life is out of scope until well past
 * v0.1; that is the milestone where a stored field becomes a decision
 * rather than an inheritance.
 */
export function bodyMass(organism: Organism): number {
  return RHO * bodyArea(organism);
}

/** The maximum amount of `resource` this organism can hold right now — a
 * maximum internal concentration, scaled by its own body area. Accepts
 * anything with a `bodyRadius`; see `bodyArea`. */
export function capFor(
  organism: {readonly bodyRadius: number},
  resource: Resource,
): number {
  return CAP_COEFFICIENT[resource] * bodyArea(organism);
}

export interface PopulationDraw {
  readonly population: Organism[];
  /** The global stream, advanced past every draw placement consumed. */
  readonly stream: RngStream;
}

/**
 * Places generation 0 from the global stream. Bodies land entirely inside
 * the aquarium; overlaps between them are expected and are the separation
 * ticket's problem, not this one's.
 */
export function createPopulation(globalRng: RngStream): PopulationDraw {
  const draws = openDraws(globalRng);
  const population: Organism[] = [];

  for (let i = 0; i < STARTING_POPULATION; i++) {
    // Derived before the placement draws, so an organism's own stream is
    // fixed by its position in the placement order and by nothing else.
    const rng = draws.child();
    const bodyRadius =
      BASELINE_BODY_RADIUS *
      (MIN_RADIUS_FACTOR +
        draws.unit() * (MAX_RADIUS_FACTOR - MIN_RADIUS_FACTOR));

    population.push(
      new Organism({
        x: placeWithin(draws.unit(), AQUARIUM_WIDTH, bodyRadius),
        y: placeWithin(draws.unit(), AQUARIUM_HEIGHT, bodyRadius),
        bodyRadius,
        lineageHue: draws.unit() * 360,
        rng,
      }),
    );
  }

  return {population, stream: draws.stream()};
}

/**
 * Folds every organism's mutable state into the running world hash, so M0's
 * determinism invariant covers bodies and not only the clock. `lineageHue`
 * rides along even though it never changes in M1: it starts drifting in M4,
 * and a field left out here is a field the invariant silently stops testing.
 *
 * The four internal stores fold in too, per the rule M2 adds beside
 * `hashState`: what enters the hash is what the next tick *reads*, and
 * metabolism reads an organism's stores every tick from here on.
 */
export function foldPopulation(
  hash: number,
  population: readonly Organism[],
): number {
  let folded = hash;
  for (const organism of population) {
    folded = foldString(
      folded,
      `${String(organism.x)}|${String(organism.y)}|${String(organism.bodyRadius)}|${String(organism.lineageHue)}|${String(organism.rng.state)}|${String(organism.energy)}|${String(organism.oxygen)}|${String(organism.carbonDioxide)}|${String(organism.food)}`,
    );
  }

  return folded;
}

/** Keeps a body's whole circle inside a wall-to-wall span. */
function placeWithin(unit: number, span: number, bodyRadius: number): number {
  return bodyRadius + unit * (span - 2 * bodyRadius);
}

/**
 * A cursor over an immutable stream. Placement makes five draws per organism
 * and threading `stream` through each by hand buries the placement rules
 * under bookkeeping; the cursor keeps the draw *order* — the thing
 * determinism actually depends on — readable as a list.
 */
function openDraws(stream: RngStream) {
  let current = stream;

  return {
    unit(): number {
      const draw = nextRng(current);
      current = draw.stream;
      return draw.value;
    },
    child(): RngStream {
      const derivation = deriveChildStream(current);
      current = derivation.parentStream;
      return derivation.childStream;
    },
    stream(): RngStream {
      return current;
    },
  };
}
