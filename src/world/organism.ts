import {
  AQUARIUM_HEIGHT,
  AQUARIUM_WIDTH,
  BASELINE_BODY_RADIUS,
} from "./aquarium";
import {GENERATION_0_MUTATION_SCALE, K_CAP_ENERGY, RHO} from "./constants";
import {
  BASELINE_GENOME,
  deriveBody,
  mintInnovationIds,
  mutateGenome,
  type Body,
  type Genome,
  type MutationOptions,
  type OrganelleGene,
  type OrganelleGeneDraft,
} from "./genome";
import {foldString} from "./hash";
import type {OrganelleType} from "./organelles";
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
 * body the world allows. The radius grows from `cytoplasmRadius`, a gene
 * with range `> 0` mutating multiplicatively (v0.1's `bodyRadius` until M7),
 * so once reproduction exists there is no largest radius
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
  /** The derived body's radius (`deriveBody`), not a gene: what collides,
   * what is drawn, and what the HUD's body-radius row folds. */
  readonly bodyRadius: number;
  /** The gene the body radius grows from, on the view from M7 so the HUD
   * can show it apart from the radius it no longer is. */
  readonly cytoplasmRadius: number;
  /** The derived body's Cytoplasm Area, the denominator of every cap and
   * internal concentration (ADR-0029). */
  readonly cytoplasmArea: number;
  /** The body's organelles in genome order: type, Innovation Id, radius and
   * position relative to the body's centre (`Body.organelles`). */
  readonly organelles: readonly OrganelleGene[];
  readonly lineageHue: number;
  /** How many births separate this organism from generation 0's founders,
   * which are 0. Read by the inspector only: no tick reads it, so it stays
   * out of the state hash. */
  readonly generation: number;
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
  /** The whole genome, on the view so the inspector can price the costliest
   * child this organism could bear (`birthCosts`). Read-only like the rest. */
  readonly genome: Genome;
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
  /** The parent's Generation plus one for a child; defaults to 0, a founder's. */
  readonly generation?: number;
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
 * list so `RESOURCES` and the mitosis split can be written once against the
 * resource instead of once per field.
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
 * A mutable class instance, per ADR-0013's choice of OOP over SoA: the tick
 * moves a body by writing to it, rather than by allocating a replacement
 * population every one of sixty ticks a second.
 *
 * `x`/`y` and `rng` are the state a tick advances. `genome` is fixed for a
 * life: it changes only at birth, through `mutateGenome`, where the child
 * gets its own record — never in place on a living organism. All four
 * header genes are readable as getters over it, and so is the body the
 * genome builds, derived once at construction because a fixed genome builds
 * a fixed body. `bodyRadius` stays the name every collision, wall and draw
 * reads, in `grid.ts`, `motion.ts`, `separation.ts` and `render.ts`; from
 * M7 it is the derived radius rather than a gene.
 *
 * No rotation and no angular velocity: `x`/`y` is the body's centre, the
 * genome's origin, and an organelle sits in the world at that position plus its own.
 * Rotation arrives with the first torque (M8), the thruster's.
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
  readonly generation: number;
  private readonly body: Body;

  constructor(init: OrganismInit) {
    this.x = init.x;
    this.y = init.y;
    this.genome = init.genome;
    this.body = deriveBody(init.genome);
    this.rng = init.rng;
    this.generation = init.generation ?? 0;
    this.energy = init.energy ?? 0;
    this.oxygen = init.oxygen ?? 0;
    this.carbonDioxide = init.carbonDioxide ?? 0;
    this.food = init.food ?? 0;
  }

  get bodyRadius(): number {
    return this.body.radius;
  }

  get cytoplasmArea(): number {
    return this.body.cytoplasmArea;
  }

  get cytoplasmRadius(): number {
    return this.genome.cytoplasmRadius;
  }

  get organelles(): readonly OrganelleGene[] {
    return this.body.organelles;
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
 * so `bodyArea`, `bodyMass` and `deriveBody` all read it the same way — and
 * so does `mitosis.ts` (ADR-0019), which has to price a child from its
 * derived body before any `Organism` for it exists to hand `bodyArea`
 * itself.
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

/** The most energy a body with `cytoplasmArea` can hold: `K_CAP_ENERGY ×
 * cytoplasmArea` (ADR-0029). The only cap in the world (ADR-0035): food,
 * O₂ and CO₂ are read as concentrations, and passive exchange corrects
 * whatever a store holds above the ambient level. `energyCap`'s sibling for
 * a body with no `Organism` yet, a child mitosis is still pricing from its
 * `deriveBody`. */
export function energyCapForArea(cytoplasmArea: number): number {
  return K_CAP_ENERGY * cytoplasmArea;
}

/** The most energy this organism can hold right now, scaled by its own
 * Cytoplasm Area, since organelles take space that holds no stores
 * (ADR-0029). Accepts an `OrganismView` too; see `bodyArea`. */
export function energyCap(organism: Organism | OrganismView): number {
  return energyCapForArea(organism.cytoplasmArea);
}

export interface PopulationDraw {
  readonly population: Organism[];
  /** The global stream, advanced past every draw placement consumed. */
  readonly stream: RngStream;
  /** The world's Innovation Id counter, advanced past every id placement
   * minted. */
  readonly nextInnovationId: number;
}

/**
 * The first Innovation Id a world's counter mints. `0` stays outside the
 * counter's range for the body's own reserved id, the endpoint its Innate
 * Senses are wired from (ADR-0031, M11).
 */
export const FIRST_INNOVATION_ID = 1;

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
 * Each founder then goes through the structural law over `roster` exactly
 * as a birth does, unscaled and unforced (ADR-0028): the header's founder
 * mutation is forced and scaled, the structural events keep their own
 * rates. A founder may be born with a neuron, and none is seeded. Its
 * provisional Innovation Ids are minted here, in placement order, the
 * counter's first mints. An empty `roster` with no organelles draws nothing
 * beyond M6's placement.
 *
 * Bodies land entirely inside the aquarium; overlaps between them are
 * expected and are the separation ticket's problem, not this one's.
 */
export function createPopulation(
  globalRng: RngStream,
  baselineGenome: Genome = BASELINE_GENOME,
  roster: readonly OrganelleType[] = [],
): PopulationDraw {
  const draws = openDraws(globalRng);
  const population: Organism[] = [];
  let nextInnovationId = FIRST_INNOVATION_ID;

  for (let i = 0; i < STARTING_POPULATION; i++) {
    // Derived before the placement draws, so an organism's own stream is
    // fixed by its position in the placement order and by nothing else.
    const rng = draws.child();
    const mutated = draws.mutate(baselineGenome, {
      probability: 1,
      scale: GENERATION_0_MUTATION_SCALE,
      roster,
    });
    const minted = mintInnovationIds(mutated, nextInnovationId);
    nextInnovationId = minted.nextInnovationId;
    const genome: Genome = {...minted.genome, lineageHue: draws.unit()};
    const {radius} = deriveBody(genome);

    population.push(
      new Organism({
        x: placeWithin(draws.unit(), AQUARIUM_WIDTH, radius),
        y: placeWithin(draws.unit(), AQUARIUM_HEIGHT, radius),
        genome,
        rng,
      }),
    );
  }

  return {population, stream: draws.stream(), nextInnovationId};
}

/** A founder's genome as a caller describes it: the header, and organelles
 * whose Innovation Ids the world has not minted yet. */
export type FounderGenome = Omit<Genome, "genes"> & {
  readonly genes: readonly OrganelleGeneDraft[];
};

/**
 * One organism of an explicitly placed generation 0: a position and a whole
 * genome, with nothing drawn and nothing mutated. Its organelles are given
 * without ids, and `placeFounders` mints them; a full `Genome` fits too, and
 * any ids it carries are replaced.
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
  readonly genome: FounderGenome;
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
 *
 * Each founder's organelles get their Innovation Ids here, from the world's
 * counter, in placement order and then genome order: the counter's first
 * mints. Organelle positions are not taken at their word: the genome a
 * founder is built from holds its layout relaxed apart, as every genome does
 * (ADR-0034), and not moved otherwise: the body is centred on the genome's
 * origin (ADR-0036).
 */
export function placeFounders(
  globalRng: RngStream,
  founders: readonly Founder[],
): PopulationDraw {
  const draws = openDraws(globalRng);
  let nextInnovationId = FIRST_INNOVATION_ID;
  const population = founders.map((founder) => {
    const minted: Genome = {
      ...founder.genome,
      genes: founder.genome.genes.map((draft) => ({
        type: draft.type,
        innovationId: nextInnovationId++,
        radius: draft.radius,
        x: draft.x,
        y: draft.y,
      })),
    };
    // The body's organelles are the layout relaxed, which is
    // what a genome holds (ADR-0034): stored as the genes, nothing is left
    // for construction to fix.
    const genes = deriveBody(minted).organelles;

    return new Organism({
      x: founder.x,
      y: founder.y,
      genome: {...minted, genes},
      rng: draws.child(),
    });
  });

  return {population, stream: draws.stream(), nextInnovationId};
}

/**
 * Folds every organism's mutable state into the running world hash, so M0's
 * determinism invariant covers bodies and not only the clock. Every gene
 * folds in, including the two M4 adds — `mitosisEnergyThreshold` and
 * `childAllocationRatio` — per the rule: what enters the hash is what the
 * next tick reads, and a gene left out is a gene the invariant silently
 * stops covering. `cytoplasmRadius` folds into the slot `bodyRadius`
 * held, and with no organelles it is the same number, so a world of
 * Minimal Organisms hashes as it did in M6 (#59).
 *
 * Every Organelle Gene folds in after those fields, as the genome holds it:
 * type, Innovation Id, radius, position. An empty `genes` adds nothing to
 * the string, which is what keeps M6's hash reproducible. The id folds
 * through the gene that holds it, so the world's counter itself stays out
 * (`hashState`).
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
    let genes = "";
    for (const gene of genome.genes) {
      genes += `|${gene.type}|${String(gene.innovationId)}|${String(gene.radius)}|${String(gene.x)}|${String(gene.y)}`;
    }
    folded = foldString(
      folded,
      `${String(organism.x)}|${String(organism.y)}|${String(genome.cytoplasmRadius)}|${String(genome.mitosisEnergyThreshold)}|${String(genome.childAllocationRatio)}|${String(genome.lineageHue)}|${String(organism.rng.state)}|${String(organism.energy)}|${String(organism.oxygen)}|${String(organism.carbonDioxide)}|${String(organism.food)}${genes}`,
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
