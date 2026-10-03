import {BASELINE_BODY_RADIUS} from "./aquarium";
import {
  DELTA_CHILD_ALLOCATION_RATIO,
  DELTA_CYTOPLASM_THICKNESS,
  DELTA_LINEAGE_HUE,
  DELTA_MITOSIS_ENERGY_THRESHOLD,
  MUTATION_PROBABILITY,
} from "./constants";
import {enclosingCircle, relax} from "./layout";
import type {OrganelleType} from "./organelles";
import {bodyAreaOfRadius} from "./organism";
import {nextRng, type RngStream} from "./rng";

/**
 * The structural gene describing one organelle (glossary: Organelle Gene):
 * its type, its Innovation Id, its radius and its position in the genome's
 * frame. A type's further parameters join it when a type declares one (M8
 * on); the neuron declares only radius and position (`organelles.ts`).
 */
export interface OrganelleGene {
  readonly type: OrganelleType;
  /**
   * Identity only (glossary: Innovation Id), minted once from the world's
   * counter: compared for equality and nothing else, so nothing sorts,
   * iterates, draws or branches on its value.
   */
  readonly innovationId: number;
  readonly radius: number;
  readonly x: number;
  readonly y: number;
}

/**
 * An Organelle Gene before the world has minted its Innovation Id: how a
 * caller describes a founder's organelles (`placeFounders`).
 */
export type OrganelleGeneDraft = Omit<OrganelleGene, "innovationId">;

/**
 * A structural gene (glossary: Structural Gene), one entry of a genome's
 * `genes`. Only the Organelle Gene until synapses arrive (M11).
 */
export type Gene = OrganelleGene;

/**
 * The complete heritable description of an organism (glossary: Genome),
 * held by `Organism` and fixed for its life: it changes only at birth,
 * through `mutateGenome`, never in place.
 *
 * v0.2's shape (ADR-0028): a fixed header of **Organism Genes**, the genes
 * an organism has exactly once, plus `genes`, the structural genes, which
 * grow and shrink as structure evolves. The header is v0.1's four genes
 * with `cytoplasmThickness` in place of `bodyRadius`: the body is no longer
 * a gene but a consequence of the layout (`deriveBody`), and with no
 * organelles the thickness is the whole radius.
 *
 * The header's declaration order is its draw order in `mutateGenome`, so
 * `cytoplasmThickness` sits where `bodyRadius` did.
 */
export interface Genome {
  readonly cytoplasmThickness: number;
  readonly mitosisEnergyThreshold: number;
  readonly childAllocationRatio: number;
  readonly lineageHue: number;
  readonly genes: readonly Gene[];
}

/**
 * The single minimal genome generation 0 is independently mutated from
 * (glossary: Baseline Genome). It carries no organelles, so a baseline
 * organism is v0.1's Minimal Organism (ADR-0028), and its
 * `cytoplasmThickness` is the baseline radius, 1 by definition
 * (`GLOSSARY.md`). `mitosisEnergyThreshold` and
 * `childAllocationRatio` are provisional, measured against the current
 * constants rather than derived — a baseline parent's energy cap is
 * `K_CAP_ENERGY × π ≈ 1257`, so at `0.75` it breeds at about 943, pays
 * roughly 314 for a child, and splits the remaining 629 evenly at `0.5`,
 * leaving parent and child both near a quarter of cap with a climb ahead of
 * them — a reproductive cycle rather than a population that never breeds or
 * breeds every tick. Nothing in this ticket exercises those two numbers yet;
 * they exist so the mitosis ticket starts from a considered value.
 *
 * `lineageHue` here is never read as an ancestor's value: generation 0 draws
 * that one gene uniformly from the global stream instead of inheriting it
 * (`docs/vision.md`'s "Initial population"), so this field is a placeholder
 * that satisfies the record's shape and nothing more.
 */
export const BASELINE_GENOME: Genome = {
  cytoplasmThickness: BASELINE_BODY_RADIUS,
  mitosisEnergyThreshold: 0.75,
  childAllocationRatio: 0.5,
  lineageHue: 0,
  genes: [],
};

export interface MutationOptions {
  /**
   * The probability that any one gene mutates at all, independently of
   * every other gene. Defaults to `MUTATION_PROBABILITY`. Generation 0
   * forces this to 1, so every founder differs from the baseline in every
   * functional gene.
   */
  readonly probability?: number;
  /**
   * Multiplies every gene's δ. Defaults to 1. Generation 0 scales it by
   * `GENERATION_0_MUTATION_SCALE` so founders spread across the range M1
   * calibrated, rather than the small step one ordinary birth takes.
   */
  readonly scale?: number;
}

export interface GenomeMutation {
  readonly genome: Genome;
  /** The stream, advanced past every draw the mutation consumed. */
  readonly stream: RngStream;
}

/**
 * The mutation operator (ADR-0021): a pure function of a genome and a
 * stream, returning both. The only thing in the world allowed to produce a
 * new genome — applied to a child at birth, never to a living organism.
 *
 * Draw order is a law of the world, not an implementation detail: every
 * header gene, in the record's own declaration order, takes one probability
 * draw and then its magnitude draw(s), only if that probability draw fires.
 * Reordering it later reseeds every child mutated from this point on.
 *
 * `genes` passes through untouched: the structural events that act on it
 * arrive with #62, after the header and with draws of their own.
 */
export function mutateGenome(
  genome: Genome,
  stream: RngStream,
  options: MutationOptions = {},
): GenomeMutation {
  const probability = options.probability ?? MUTATION_PROBABILITY;
  const scale = options.scale ?? 1;
  const draws = openDraws(stream);

  const cytoplasmThickness = draws.fires(probability)
    ? mutateMultiplicatively(
        genome.cytoplasmThickness,
        draws,
        DELTA_CYTOPLASM_THICKNESS * scale,
      )
    : genome.cytoplasmThickness;

  const mitosisEnergyThreshold = draws.fires(probability)
    ? clampUnitInterval(
        genome.mitosisEnergyThreshold +
          draws.signed() * DELTA_MITOSIS_ENERGY_THRESHOLD * scale,
      )
    : genome.mitosisEnergyThreshold;

  const childAllocationRatio = draws.fires(probability)
    ? clampUnitInterval(
        genome.childAllocationRatio +
          draws.signed() * DELTA_CHILD_ALLOCATION_RATIO * scale,
      )
    : genome.childAllocationRatio;

  const lineageHue = draws.fires(probability)
    ? wrapUnitInterval(
        genome.lineageHue + draws.signed() * DELTA_LINEAGE_HUE * scale,
      )
    : genome.lineageHue;

  return {
    genome: {
      cytoplasmThickness,
      mitosisEnergyThreshold,
      childAllocationRatio,
      lineageHue,
      genes: genome.genes,
    },
    stream: draws.stream(),
  };
}

/**
 * The Birth Cost Ceiling (ADR-0027): the largest body area a child of
 * `genome` can have under `mutateGenome`'s default options, the margin the
 * Worst-Case Birth Gate prices before anything is drawn. A guarantee the
 * mutation law makes by construction, never a bound enforced by rejecting
 * draws above it — that would bring the Birth Sieve back from the other
 * side.
 *
 * ADR-0028's `π·R_max²`, with `R_max` the parent's Enclosing Circle plus
 * the largest thickness `mutateMultiplicatively` can draw, `t·(1 + δ)`,
 * since its magnitude draw stays below 1. A child inherits its parent's
 * layout unchanged until the structural events exist, so its Enclosing
 * Circle is its parent's; those events add their `M_max · maxEventGrowth`
 * term to the radius (#62), and the signature stays. With no organelles the
 * circle is empty and this is v0.1's ceiling exactly.
 *
 * It covers ordinary births only. Generation 0's scaled founder mutation is
 * not a birth, and its founders can exceed it.
 */
export function birthCostCeiling(genome: Genome): number {
  return bodyAreaOfRadius(
    deriveBody(genome).enclosingRadius +
      genome.cytoplasmThickness * (1 + DELTA_CYTOPLASM_THICKNESS),
  );
}

/**
 * What a genome builds (ADR-0028): the body is derived from the layout,
 * never inherited as a number of its own. Pure, so mitosis can price a child
 * from its genome before any `Organism` for it exists.
 */
export interface Body {
  /** The Enclosing Circle's radius plus the Cytoplasm Thickness. */
  readonly radius: number;
  /**
   * The body's area minus every organelle's (glossary: Cytoplasm Area):
   * the space that holds the stores, so caps, internal concentrations and
   * `β` read it rather than the whole body (ADR-0029).
   */
  readonly cytoplasmArea: number;
  /** The Enclosing Circle's radius, 0 with no organelles. */
  readonly enclosingRadius: number;
  /**
   * The organelles, in genome order, relaxed apart and positioned relative
   * to the Enclosing Circle's centre, which is the body's centre: an
   * organelle sits in the world at the organism's position plus its own,
   * with no rotation until the first torque (M8).
   */
  readonly organelles: readonly OrganelleGene[];
}

/**
 * Derives the body a genome builds (ADR-0028): the organelles relaxed apart
 * (`relax`), their Enclosing Circle, and the cytoplasm wrapped around it.
 * A genome in the world already holds a relaxed, recentred layout
 * (ADR-0034), and relaxing it again moves nothing; the relaxation here is
 * what puts a hand-written layout into that form (`placeFounders`).
 *
 * With no organelles the Enclosing Circle is empty: the radius is the
 * thickness alone and the whole body is cytoplasm, v0.1's Minimal Organism
 * to the last bit.
 */
export function deriveBody(genome: Genome): Body {
  const relaxed = relax(genome.genes);
  const circle = enclosingCircle(relaxed);
  const radius = circle.radius + genome.cytoplasmThickness;
  let organelleArea = 0;
  for (const gene of relaxed) {
    organelleArea += bodyAreaOfRadius(gene.radius);
  }

  return {
    radius,
    cytoplasmArea: bodyAreaOfRadius(radius) - organelleArea,
    enclosingRadius: circle.radius,
    organelles: relaxed.map((gene) => ({
      ...gene,
      x: gene.x - circle.x,
      y: gene.y - circle.y,
    })),
  };
}

/**
 * `cytoplasmThickness`'s law, inherited from v0.1's `bodyRadius`: draw a
 * magnitude `m = 1 + u·δ`, then a second draw
 * picks `× m` or `÷ m` with equal probability. Symmetric in log space, unlike
 * the obvious additive form `1 + (2u−1)·δ` — `×1.08` then `×0.92` lands at
 * `0.9936`, a free downward drift sitting on top of the signal M5 measures.
 * Log-normal is the textbook fix and is rejected on ADR-0007's grounds, the
 * same grounds `motion.ts` already rejects `cos`/`sin` on: `+ − × ÷` only.
 */
function mutateMultiplicatively(
  value: number,
  draws: MutationDraws,
  delta: number,
): number {
  const magnitude = 1 + draws.unit() * delta;
  return draws.unit() < 0.5 ? value * magnitude : value / magnitude;
}

/** Clamps rather than rejects, per ADR-0002: `1.0` has to stay reachable and
 * viable, and sterile lineages have to be impossible. */
function clampUnitInterval(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Wraps rather than clamps: `lineageHue` has no physiological effect to
 * saturate, and a marker that piled up at 0 or 1 would stop being neutral. */
function wrapUnitInterval(value: number): number {
  const wrapped = value % 1;
  return wrapped < 0 ? wrapped + 1 : wrapped;
}

interface MutationDraws {
  unit(): number;
  /** A draw remapped to `[-1, 1)`, for the two additive genes. */
  signed(): number;
  /** Whether this gene's probability draw fires — consumes exactly one
   * draw whether or not it does. */
  fires(probability: number): boolean;
  stream(): RngStream;
}

function openDraws(stream: RngStream): MutationDraws {
  let current = stream;

  const unit = (): number => {
    const draw = nextRng(current);
    current = draw.stream;
    return draw.value;
  };

  return {
    unit,
    signed(): number {
      return unit() * 2 - 1;
    },
    fires(probability: number): boolean {
      return unit() < probability;
    },
    stream(): RngStream {
      return current;
    },
  };
}
