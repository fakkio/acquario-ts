import {
  AQUARIUM_HEIGHT,
  AQUARIUM_WIDTH,
  BASELINE_BODY_RADIUS,
} from "./aquarium";
import {
  GENERATION_0_MUTATION_SCALE,
  K_CAP,
  K_CAP_ENERGY,
  RHO,
} from "./constants";
import {
  BASELINE_GENOME,
  mutateGenome,
  type Genome,
  type MutationOptions,
} from "./genome";
import {foldString} from "./hash";
import {deriveChildStream, nextRng, type RngStream} from "./rng";

/**
 * How many organisms `createWorld` places. Generation 0 is placed, not bred:
 * mitosis, arriving with the rest of M4, is what grows the population from
 * here on.
 */
export const STARTING_POPULATION = 40;

/**
 * Generation-0 body radii land between these multiples of the baseline,
 * which is why they sit either side of 1: the baseline has to stay the
 * population's central body, or the length unit the whole calibration
 * method rests on ends up smaller than the median organism.
 *
 * From M4 the spread is a consequence of mutation rather than a placement
 * rule of its own: each founder is `BASELINE_GENOME` mutated once with every
 * δ scaled by `GENERATION_0_MUTATION_SCALE` (`createPopulation`), and these
 * two factors are `createPopulation`'s ceiling and the grid's fallback cell
 * size rather than a range anything still draws from directly.
 */
export const MIN_RADIUS_FACTOR = 0.6;
export const MAX_RADIUS_FACTOR = 1.4;

/**
 * The largest body generation 0 places — no longer, from M4 on, the largest
 * body the world allows. `bodyRadius` is a gene with range `> 0` mutating
 * multiplicatively, so once reproduction exists there is no largest radius
 * to derive a world-wide ceiling from; the ledger is the only ceiling left,
 * since a single body cannot exceed the carbon budget (`r ≤ √K`, ADR-0012's
 * amendment).
 *
 * This constant still describes generation 0's spread, and stays useful for
 * exactly that: `createPopulation`'s ceiling, and the fallback the grid
 * reaches for when it is handed no population to derive a size from at all.
 */
export const GENERATION_0_MAX_BODY_RADIUS =
  MAX_RADIUS_FACTOR * BASELINE_BODY_RADIUS;

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
  /**
   * The two reproduction genes, on the view from M5 so that all four genes
   * can be read where the statistics over them are computed — the HUD and
   * the calibration harness. They go here rather than behind a
   * `getGeneStatistics` reader of the world's, the same call ADR-0015 made
   * when it left `α` smoothing to the App layer: a second path to the same
   * numbers is a second thing to keep in agreement.
   */
  readonly mitosisEnergyThreshold: number;
  readonly childAllocationRatio: number;
  readonly energy: number;
  readonly oxygen: number;
  readonly carbonDioxide: number;
  readonly food: number;
}

export interface OrganismInit {
  readonly x: number;
  readonly y: number;
  readonly genome: Genome;
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
 * world (GLOSSARY.md). The `Environment` seam (ADR-0005) is typed against
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

/** Every `Resource`, energy included, for the modules that need to loop
 * over all four — `mitosis.ts`'s allocation split, the first caller that
 * treats energy as just another store to divide (ADR-0019). */
export const RESOURCES: readonly Resource[] = [
  "energy",
  "oxygen",
  "carbonDioxide",
  "food",
];

/**
 * A cap is a maximum internal *concentration* (ADR-0003), not a bucket
 * size: `coefficient × bodyArea`. The three diffusibles' coefficients come
 * from `K_CAP`'s own per-resource table, spread in whole rather than listed
 * again here, so a diffusible added later cannot be given a cap in one
 * place and forgotten in the other. Energy carries `K_CAP_ENERGY` and sits
 * outside that table, because its unit is fixed independently by `β = 1`
 * rather than by coincidence of notation.
 */
const CAP_COEFFICIENT: Readonly<Record<Resource, number>> = {
  energy: K_CAP_ENERGY,
  ...K_CAP,
};

/**
 * A mutable class instance, per ADR-0013's choice of OOP over SoA: the tick
 * moves a body by writing to it, rather than by allocating a replacement
 * population every one of sixty ticks a second.
 *
 * `x`/`y` and `rng` are the state a tick advances. `genome` is fixed for a
 * life: it changes only at birth, through `mutateGenome`, where the child
 * gets its own record — never in place on a living organism. All four genes
 * are readable as getters over it, so every existing read of `bodyRadius`
 * or `lineageHue` — in `grid.ts`, `motion.ts`, `metabolism.ts`,
 * `separation.ts`, `render.ts` and the test fixtures — keeps working
 * untouched, and `OrganismView` is widened rather than reshaped.
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
  readonly genome: Genome;
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
    this.genome = init.genome;
    this.rng = init.rng;
    this.energy = init.energy ?? 0;
    this.oxygen = init.oxygen ?? 0;
    this.carbonDioxide = init.carbonDioxide ?? 0;
    this.food = init.food ?? 0;
  }

  get bodyRadius(): number {
    return this.genome.bodyRadius;
  }

  get lineageHue(): number {
    return this.genome.lineageHue;
  }

  get mitosisEnergyThreshold(): number {
    return this.genome.mitosisEnergyThreshold;
  }

  get childAllocationRatio(): number {
    return this.genome.childAllocationRatio;
  }
}

/**
 * The area a body of `bodyRadius` occupies, in the same length unit as the
 * radius itself. The one place that area is computed from a bare radius,
 * so `bodyArea`, `bodyMass` and `capFor` all read it the same way — and so
 * does `mitosis.ts` (ADR-0019), which has to price a child's cost and caps
 * from its mutated `bodyRadius` before any `Organism` for it exists to hand
 * `bodyArea` itself.
 */
export function bodyAreaOfRadius(bodyRadius: number): number {
  return Math.PI * bodyRadius * bodyRadius;
}

/**
 * The area a body occupies, in the same length unit as `bodyRadius`.
 *
 * Typed against `Organism | OrganismView` rather than `Organism` alone, so
 * the App layer can compute a cap or an area off the read-only view too —
 * the render layer reads energy fraction for body brightness (M2) without
 * needing the mutable class the world itself works with.
 */
export function bodyArea(organism: Organism | OrganismView): number {
  return bodyAreaOfRadius(organism.bodyRadius);
}

/** A body's mass at `bodyRadius`, the same formula `bodyMass` derives from
 * a live organism — see `bodyAreaOfRadius` for why a radius-only sibling
 * exists at all. */
export function bodyMassOfRadius(bodyRadius: number): number {
  return RHO * bodyAreaOfRadius(bodyRadius);
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
  return bodyMassOfRadius(organism.bodyRadius);
}

/** The maximum amount of `resource` a body of `bodyRadius` can hold — see
 * `bodyAreaOfRadius` for why a radius-only sibling of `capFor` exists. */
export function capForRadius(bodyRadius: number, resource: Resource): number {
  return CAP_COEFFICIENT[resource] * bodyAreaOfRadius(bodyRadius);
}

/** The maximum amount of `resource` this organism can hold right now — a
 * maximum internal concentration, scaled by its own body area. Accepts an
 * `OrganismView` too; see `bodyArea`. */
export function capFor(
  organism: Organism | OrganismView,
  resource: Resource,
): number {
  return capForRadius(organism.bodyRadius, resource);
}

export interface PopulationDraw {
  readonly population: Organism[];
  /** The global stream, advanced past every draw placement consumed. */
  readonly stream: RngStream;
}

/**
 * Places generation 0 from the global stream. Each founder is
 * `baselineGenome` put through the same mutation operator every later
 * birth uses, with its probability forced to 1 and every δ scaled by
 * `GENERATION_0_MUTATION_SCALE` — so no two founders are identical, and the
 * spread lands in the range M1 already calibrated, around whichever genome
 * it was handed.
 *
 * The baseline is an argument rather than the module constant from M5,
 * because ADR-0011's done criterion asks gene means to converge "from
 * different seeds **and** different baseline genomes": a run that can only
 * vary its seed has no way to start above the target and come down, and
 * drift keeps a downhill excuse for landing where selection would
 * (ADR-0025). It defaults to `BASELINE_GENOME`, so an omitted argument is
 * the world M4 shipped.
 *
 * `lineageHue` is the one gene generation 0 does not inherit: it is drawn
 * uniformly over `[0, 1)` here, overwriting whatever the operator drifted
 * it to, because forty founders each one mutation from a single baseline
 * would sit within a hair of the same hue — forty near-indistinguishable
 * shades of one colour, in the milestone that introduces the gene whose
 * whole purpose is making descent visible (`docs/vision.md`).
 *
 * Bodies land entirely inside the aquarium; overlaps between them are
 * expected and are the separation ticket's problem, not this one's.
 */
export function createPopulation(
  globalRng: RngStream,
  baselineGenome: Genome = BASELINE_GENOME,
): PopulationDraw {
  const draws = openDraws(globalRng);
  const population: Organism[] = [];

  for (let i = 0; i < STARTING_POPULATION; i++) {
    // Derived before the placement draws, so an organism's own stream is
    // fixed by its position in the placement order and by nothing else.
    const rng = draws.child();
    const mutated = draws.mutate(baselineGenome, {
      probability: 1,
      scale: GENERATION_0_MUTATION_SCALE,
    });
    const genome: Genome = {...mutated, lineageHue: draws.unit()};

    population.push(
      new Organism({
        x: placeWithin(draws.unit(), AQUARIUM_WIDTH, genome.bodyRadius),
        y: placeWithin(draws.unit(), AQUARIUM_HEIGHT, genome.bodyRadius),
        genome,
        rng,
      }),
    );
  }

  return {population, stream: draws.stream()};
}

/**
 * One organism of an explicitly placed generation 0: a position and a whole
 * genome, with nothing drawn and nothing mutated.
 *
 * A position as well as a genome, because the two measurements the
 * calibration harness cannot take from a placed population need both. The
 * income exponent `n` in `income ∝ r^n` is fitted across a ladder of radii,
 * and generation 0's natural spread is `[1/1.4, 1.4]` — far too narrow to
 * tell `r¹` from `r^1.3` (ADR-0025). Depth matters for the same reason: `α`
 * is a field over the aquarium (ADR-0015), so a ladder measured at one
 * depth and a ladder measured across them are different measurements.
 */
export interface Founder {
  readonly x: number;
  readonly y: number;
  readonly genome: Genome;
}

/**
 * Places generation 0 exactly as given: `createPopulation`'s sibling for
 * the world the harness builds rather than the world the app runs.
 *
 * Nothing here draws a position, a genome or a hue. The one thing it does
 * take from the global stream is each founder's own stream, derived in
 * placement order the same way `createPopulation` derives it, so an
 * explicitly placed organism's random sequence still depends on its own
 * lineage and on nothing else (ADR-0007).
 *
 * Positions are taken at their word and not clamped. A founder placed
 * outside the walls is pulled in by step 10's wall constraint on the first
 * tick, visibly, which is a better answer than silently moving a body the
 * caller chose the coordinates of — an instrument that quietly corrects its
 * own inputs is an instrument that measures something other than what was
 * asked for.
 *
 * The four internal stores are left at zero, exactly as `createPopulation`
 * leaves them: `initializeMetabolism` is what brings any generation 0 to
 * diffusive equilibrium, and it does not care how the bodies got there.
 */
export function placeFounders(
  globalRng: RngStream,
  founders: readonly Founder[],
): PopulationDraw {
  const draws = openDraws(globalRng);
  const population = founders.map(
    (founder) =>
      new Organism({
        x: founder.x,
        y: founder.y,
        genome: founder.genome,
        rng: draws.child(),
      }),
  );

  return {population, stream: draws.stream()};
}

/**
 * Folds every organism's mutable state into the running world hash, so M0's
 * determinism invariant covers bodies and not only the clock. Every gene
 * folds in, including the two M4 adds — `mitosisEnergyThreshold` and
 * `childAllocationRatio` — per the rule: what enters the hash is what the
 * next tick reads, and a gene left out is a gene the invariant silently
 * stops covering.
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
    const {genome} = organism;
    folded = foldString(
      folded,
      `${String(organism.x)}|${String(organism.y)}|${String(genome.bodyRadius)}|${String(genome.mitosisEnergyThreshold)}|${String(genome.childAllocationRatio)}|${String(genome.lineageHue)}|${String(organism.rng.state)}|${String(organism.energy)}|${String(organism.oxygen)}|${String(organism.carbonDioxide)}|${String(organism.food)}`,
    );
  }

  return folded;
}

/** Keeps a body's whole circle inside a wall-to-wall span. */
function placeWithin(unit: number, span: number, bodyRadius: number): number {
  return bodyRadius + unit * (span - 2 * bodyRadius);
}

/**
 * A cursor over an immutable stream. Placement makes several draws per
 * organism and threading `stream` through each by hand buries the placement
 * rules under bookkeeping; the cursor keeps the draw *order* — the thing
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
    mutate(genome: Genome, options?: MutationOptions): Genome {
      const mutation = mutateGenome(genome, current, options);
      current = mutation.stream;
      return mutation.genome;
    },
    stream(): RngStream {
      return current;
    },
  };
}
