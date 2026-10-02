import {BASELINE_BODY_RADIUS} from "./aquarium";
import {
  DELTA_BODY_RADIUS,
  DELTA_CHILD_ALLOCATION_RATIO,
  DELTA_LINEAGE_HUE,
  DELTA_MITOSIS_ENERGY_THRESHOLD,
  MUTATION_PROBABILITY,
} from "./constants";
import {nextRng, type RngStream} from "./rng";

/**
 * The complete heritable description of an organism (glossary: Genome). In
 * v0.1 a flat record of the four genes `docs/vision.md` names, held by
 * `Organism` and fixed for its life: it changes only at birth, through
 * `mutateGenome`, never in place.
 */
export interface Genome {
  readonly bodyRadius: number;
  readonly mitosisEnergyThreshold: number;
  readonly childAllocationRatio: number;
  readonly lineageHue: number;
}

/**
 * The single minimal genome generation 0 is independently mutated from
 * (glossary: Baseline Genome). `bodyRadius` is the baseline radius, 1 by
 * definition (`GLOSSARY.md`). `mitosisEnergyThreshold` and
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
  bodyRadius: BASELINE_BODY_RADIUS,
  mitosisEnergyThreshold: 0.75,
  childAllocationRatio: 0.5,
  lineageHue: 0,
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
 * gene, in the record's own declaration order, takes one probability draw
 * and then its magnitude draw(s), only if that probability draw fires.
 * Reordering it later reseeds every child mutated from this point on.
 */
export function mutateGenome(
  genome: Genome,
  stream: RngStream,
  options: MutationOptions = {},
): GenomeMutation {
  const probability = options.probability ?? MUTATION_PROBABILITY;
  const scale = options.scale ?? 1;
  const draws = openDraws(stream);

  const bodyRadius = draws.fires(probability)
    ? mutateRadius(genome.bodyRadius, draws, DELTA_BODY_RADIUS * scale)
    : genome.bodyRadius;

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
      bodyRadius,
      mitosisEnergyThreshold,
      childAllocationRatio,
      lineageHue,
    },
    stream: draws.stream(),
  };
}

/**
 * `bodyRadius`'s own law: draw a magnitude `m = 1 + u·δ`, then a second draw
 * picks `× m` or `÷ m` with equal probability. Symmetric in log space, unlike
 * the obvious additive form `1 + (2u−1)·δ` — `×1.08` then `×0.92` lands at
 * `0.9936`, a free downward drift sitting on top of the signal M5 measures.
 * Log-normal is the textbook fix and is rejected on ADR-0007's grounds, the
 * same grounds `motion.ts` already rejects `cos`/`sin` on: `+ − × ÷` only.
 */
function mutateRadius(
  radius: number,
  draws: MutationDraws,
  delta: number,
): number {
  const magnitude = 1 + draws.unit() * delta;
  return draws.unit() < 0.5 ? radius * magnitude : radius / magnitude;
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
