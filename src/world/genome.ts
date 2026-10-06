import {BASELINE_BODY_RADIUS} from "./aquarium";
import {
  DELETION_WEIGHT,
  DELTA_CHILD_ALLOCATION_RATIO,
  DELTA_CYTOPLASM_THICKNESS,
  DELTA_LINEAGE_HUE,
  DELTA_MITOSIS_ENERGY_THRESHOLD,
  INSERTION_WEIGHT,
  MAX_STRUCTURAL_EVENTS,
  MUTATION_PROBABILITY,
  PARAMETER_CHANGE_WEIGHT,
  R_NEW,
  SPLIT_HALF_WIDTH,
  SPLIT_WEIGHT,
  STRUCTURAL_EVENT_PROBABILITY,
} from "./constants";
import {enclosingCircle, makeRoom, relax} from "./layout";
import {
  ORGANELLE_TYPES,
  type OrganelleType,
  type ParameterLaw,
} from "./organelles";
import {bodyAreaOfRadius} from "./organism";
import {drawUnitVector, nextRng, type RngStream} from "./rng";

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
   *
   * A gene a child's structural events create carries a provisional,
   * child-local id until the world mints it: negative, `-1, -2, …` in the
   * order its events created them, so it can never be taken for a minted
   * one (`FIRST_INNOVATION_ID` and up). The world mints it when the pending
   * birth is committed.
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
   * Header only, like `probability`: the structural events have their own
   * rates below.
   */
  readonly scale?: number;
  /**
   * The world's roster, the organelle types an insertion draws from
   * (ADR-0032). Given, the structural events run after the header: an
   * empty roster disables insertion, and with no organelles every other
   * operator too, so then they draw nothing at all. Omitted, they do not
   * run and `genes` passes through untouched: the header-only law, for the
   * tests that exercise the header alone. The world's mitosis and
   * generation 0 always give it, the same roster `birthCostCeiling` prices,
   * since a roster given to one and not the other either breaks the
   * ceiling or overprices it silently.
   */
  readonly roster?: readonly OrganelleType[];
  /**
   * Each of the `MAX_STRUCTURAL_EVENTS` trials' chance of becoming an event,
   * `p` in `n ~ Binomial(M_max, p)`. Defaults to
   * `STRUCTURAL_EVENT_PROBABILITY`. Neither this nor `operatorWeights`
   * moves the Birth Cost Ceiling, which prices the worst case whatever the
   * rates, so a test can force any mix of events and still hold every
   * child to it.
   */
  readonly eventProbability?: number;
  /** The structural operators' rate weights. Defaults to
   * `OPERATOR_WEIGHTS`. */
  readonly operatorWeights?: OperatorWeights;
}

/**
 * The structural operators M7 knows (ADR-0028), in the order an event's
 * operator draw walks their weights: part of the law, like the header's
 * draw order. The weight change and the synapse insertion are M11's.
 */
const OPERATORS = [
  "parameterChange",
  "insertion",
  "deletion",
  "split",
] as const;

export type StructuralOperator = (typeof OPERATORS)[number];

/** How often an event picks each operator, in proportion. */
export type OperatorWeights = Readonly<Record<StructuralOperator, number>>;

export const OPERATOR_WEIGHTS: OperatorWeights = {
  parameterChange: PARAMETER_CHANGE_WEIGHT,
  insertion: INSERTION_WEIGHT,
  deletion: DELETION_WEIGHT,
  split: SPLIT_WEIGHT,
};

/** Whether an id is a child-local provisional one, not yet minted. The one
 * place an id's sign is read: it names the convention, not an ordering. */
function isProvisional(innovationId: number): boolean {
  return innovationId < 0;
}

/**
 * Replaces every provisional Innovation Id in `genome` with one minted from
 * the world's counter, in genome order, and hands back the counter advanced
 * past them. A gene carrying a minted id (positive) is left as it is. Pure:
 * the caller threads the counter, so the order births are minted in is the
 * order it calls this in.
 */
export function mintInnovationIds(
  genome: Genome,
  nextInnovationId: number,
): {readonly genome: Genome; readonly nextInnovationId: number} {
  let next = nextInnovationId;
  const minted = new Map<number, number>();
  const genes = genome.genes.map((gene) => {
    if (!isProvisional(gene.innovationId)) {
      return gene;
    }
    let id = minted.get(gene.innovationId);
    if (id === undefined) {
      id = next++;
      minted.set(gene.innovationId, id);
    }
    return {...gene, innovationId: id};
  });

  return {
    genome: next === nextInnovationId ? genome : {...genome, genes},
    nextInnovationId: next,
  };
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
 * The structural events follow the header (`mutateStructure`), so a genome
 * with no organelles under an empty roster draws exactly what v0.1's did.
 * Reordering any of it later reseeds every child mutated from this point
 * on.
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

  const genes =
    options.roster === undefined
      ? genome.genes
      : mutateStructure(genome.genes, draws, {
          roster: options.roster,
          eventProbability:
            options.eventProbability ?? STRUCTURAL_EVENT_PROBABILITY,
          weights: options.operatorWeights ?? OPERATOR_WEIGHTS,
        });

  return {
    genome: {
      cytoplasmThickness,
      mitosisEnergyThreshold,
      childAllocationRatio,
      lineageHue,
      genes,
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
 * ADR-0028's `π·R_max²`, with `R_max = enclosing radius + M_max ·
 * maxEventGrowth + t·(1 + δ)`: the parent's Enclosing Circle, the most its
 * structural events can grow it (`maxStructuralGrowth`), and the largest
 * thickness `mutateMultiplicatively` can draw, since its magnitude draw
 * stays below 1. `maxEventGrowth` counts only the operators with a valid
 * target in the parent's genome (ADR-0034), so with no organelles and an
 * empty roster this is v0.1's ceiling exactly.
 *
 * The bound is read off the parent's own genome. A later event acts on a
 * genome an earlier one changed, an organelle grown a step or newly
 * splittable; the slack the operators leave (a size step or a split moves
 * the circle by half what is priced) covers that at `M_max = 2`, and the
 * property test in `genome.test.ts` is what says so for the constants a
 * sweep tries.
 *
 * `roster` is the one the child's mutation runs with, required so that the
 * ceiling and the law cannot be given different ones.
 *
 * It covers ordinary births only. Generation 0's scaled founder mutation is
 * not a birth, and its founders can exceed it.
 */
export function birthCostCeiling(
  genome: Genome,
  roster: readonly OrganelleType[],
): number {
  return bodyAreaOfRadius(
    deriveBody(genome).enclosingRadius +
      maxStructuralGrowth(genome.genes, roster) +
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

interface StructuralLaw {
  readonly roster: readonly OrganelleType[];
  readonly eventProbability: number;
  readonly weights: OperatorWeights;
}

/**
 * The structural half of the mutation law (ADR-0028, ADR-0034): `n ~
 * Binomial(M_max, p)` events, drawn as `M_max` trials up front, then each
 * event in turn. An event draws its operator by weight, then a target
 * uniformly among the genes that operator can act on. With no valid target
 * it does nothing, having drawn only its operator, and is not redrawn, so
 * the law never becomes a rejection sampler.
 *
 * The layout is relaxed after every event, since the relaxation contract is
 * stated per event, and recentred on its Enclosing Circle once all of them
 * are applied: the relaxed, recentred layout is what the child's genome
 * holds. A child no event touched keeps its parent's genes as they are.
 *
 * With an empty roster and no organelles no operator can ever find a
 * target, and this draws nothing at all, so a world with an empty roster
 * draws exactly the numbers M6 drew.
 */
function mutateStructure(
  genes: readonly Gene[],
  draws: MutationDraws,
  law: StructuralLaw,
): readonly Gene[] {
  if (law.roster.length === 0 && genes.length === 0) {
    return genes;
  }

  let events = 0;
  for (let trial = 0; trial < MAX_STRUCTURAL_EVENTS; trial++) {
    if (draws.fires(law.eventProbability)) {
      events++;
    }
  }

  let nextProvisionalId = -1;
  const provisionalId = (): number => nextProvisionalId--;
  let layout = genes;
  let touched = false;
  for (let event = 0; event < events; event++) {
    const operator = pickOperator(draws.unit(), law.weights);
    const changed = applyEvent(
      operator,
      layout,
      law.roster,
      draws,
      provisionalId,
    );
    if (changed !== null) {
      layout = relax(changed);
      touched = true;
    }
  }

  if (!touched) {
    return genes;
  }
  const centre = enclosingCircle(layout);
  return layout.map((gene) => ({
    ...gene,
    x: gene.x - centre.x,
    y: gene.y - centre.y,
  }));
}

/** The operator a draw `u` picks, walking the weights in `OPERATORS`'
 * order. */
function pickOperator(u: number, weights: OperatorWeights): StructuralOperator {
  let total = 0;
  for (const operator of OPERATORS) {
    total += weights[operator];
  }
  let remaining = u * total;
  let picked: StructuralOperator = OPERATORS[0];
  for (const operator of OPERATORS) {
    if (weights[operator] > 0) {
      // The last operator with any weight also takes the hair rounding can
      // leave `u·total` past the running sum.
      picked = operator;
      if (remaining < weights[operator]) {
        return operator;
      }
      remaining -= weights[operator];
    }
  }
  return picked;
}

/**
 * One structural event, before relaxation: the layout it leaves, or `null`
 * when its operator has no valid target and it does nothing.
 */
function applyEvent(
  operator: StructuralOperator,
  layout: readonly Gene[],
  roster: readonly OrganelleType[],
  draws: MutationDraws,
  provisionalId: () => number,
): Gene[] | null {
  switch (operator) {
    case "parameterChange": {
      const targets = indicesWhere(
        layout,
        (gene) => ORGANELLE_TYPES[gene.type].parameters.length > 0,
      );
      if (targets.length === 0) {
        return null;
      }
      const index = targets[draws.index(targets.length)];
      const gene = layout[index];
      const {parameters} = ORGANELLE_TYPES[gene.type];
      const {law} = parameters[draws.index(parameters.length)];
      return replaceAt(layout, index, [changeParameter(gene, law, draws)]);
    }

    case "insertion": {
      if (roster.length === 0) {
        return null;
      }
      const type = roster[draws.index(roster.length)];
      // An empty Enclosing Circle is a point at the origin, and the first
      // organelle is born there without a draw (ADR-0034).
      const circle = enclosingCircle(layout);
      const offset =
        layout.length === 0 ? {x: 0, y: 0} : draws.pointInUnitDisc();
      return [
        ...layout,
        {
          type,
          innovationId: provisionalId(),
          radius: R_NEW,
          x: circle.x + offset.x * circle.radius,
          y: circle.y + offset.y * circle.radius,
        },
      ];
    }

    case "deletion": {
      if (layout.length === 0) {
        return null;
      }
      return replaceAt(layout, draws.index(layout.length), []);
    }

    case "split": {
      const targets = indicesWhere(layout, isSplitTarget);
      if (targets.length === 0) {
        return null;
      }
      return split(
        layout,
        targets[draws.index(targets.length)],
        draws,
        provisionalId,
      );
    }
  }
}

/**
 * One parameter of one organelle, moved by the law its type declares
 * (ADR-0028's closed menu): the symmetric multiplicative law is the
 * radius's, clamped up to its floor (ADR-0034), and the Cartesian step is
 * the position's, uniform over a disc of `δ` of the organelle's own radius.
 */
function changeParameter(
  gene: Gene,
  law: ParameterLaw,
  draws: MutationDraws,
): Gene {
  switch (law.kind) {
    case "symmetricMultiplicative":
      return {
        ...gene,
        radius: Math.max(
          law.floor,
          mutateMultiplicatively(gene.radius, draws, law.delta),
        ),
      };
    case "cartesianStep": {
      const step = draws.pointInUnitDisc();
      const reach = law.delta * gene.radius;
      return {
        ...gene,
        x: gene.x + step.x * reach,
        y: gene.y + step.y * reach,
      };
    }
  }
}

/**
 * A Split (ADR-0028): the organelle at `index` becomes two, of areas `f·A`
 * and `(1−f)·A` with `f = 0.5 + (u₁ + u₂ − 1)·w`, conserving its area. The
 * pieces lie tangent along a drawn direction, filling the circle of radius
 * `r·(√f + √(1−f))` centred where the organelle was, and the other
 * organelles first make way for that circle (`makeRoom`). That circle is at
 * most `√2·r`, so the Enclosing Circle grows by at most `(√2 − 1)·r`,
 * inside the `2(√2 − 1)·r` the ceiling prices.
 *
 * The first piece keeps the original's id and its place in the genome; the
 * second gets a new id and the place right after it.
 */
function split(
  layout: readonly Gene[],
  index: number,
  draws: MutationDraws,
  provisionalId: () => number,
): Gene[] {
  const gene = layout[index];
  const f = 0.5 + (draws.unit() + draws.unit() - 1) * SPLIT_HALF_WIDTH;
  const direction = draws.unitVector();
  const firstRadius = gene.radius * Math.sqrt(f);
  const secondRadius = gene.radius * Math.sqrt(1 - f);
  const room = {x: gene.x, y: gene.y, radius: firstRadius + secondRadius};
  const others = makeRoom(replaceAt(layout, index, []), room);

  const first: Gene = {
    ...gene,
    radius: firstRadius,
    x: gene.x - direction.x * secondRadius,
    y: gene.y - direction.y * secondRadius,
  };
  const second: Gene = {
    ...gene,
    innovationId: provisionalId(),
    radius: secondRadius,
    x: gene.x + direction.x * firstRadius,
    y: gene.y + direction.y * firstRadius,
  };
  return [...others.slice(0, index), first, second, ...others.slice(index)];
}

/**
 * Whether a Split can act on this organelle: only if its smaller piece, at
 * the bell's most uneven `f = 0.5 − w`, still reaches its type's radius
 * floor. Clamping that piece up would add the area a split exists to
 * conserve (ADR-0034).
 */
function isSplitTarget(gene: Gene): boolean {
  return (
    gene.radius * Math.sqrt(0.5 - SPLIT_HALF_WIDTH) >= radiusFloor(gene.type)
  );
}

/** A type's radius floor, read off its declared radius law: 0 for a type
 * that declares none. */
function radiusFloor(type: OrganelleType): number {
  for (const {name, law} of ORGANELLE_TYPES[type].parameters) {
    if (name === "radius" && law.kind === "symmetricMultiplicative") {
      return law.floor;
    }
  }
  return 0;
}

/**
 * The most one event can grow the Enclosing Circle of `genes`, over the
 * operators with a valid target there (ADR-0028, ADR-0034), read off each
 * type's declared laws rather than found by trying mutations:
 *
 * - insertion, with a non-empty roster: `2·r_new`, or `r_new` into an empty
 *   circle;
 * - a symmetric multiplicative radius: twice the largest step it can take,
 *   `2·δ·r` above its floor;
 * - a Cartesian step: `δ·r`;
 * - a Split of a valid target: `2(√2 − 1)·r`;
 * - a deletion grows nothing.
 */
function maxEventGrowth(
  genes: readonly Gene[],
  roster: readonly OrganelleType[],
): number {
  let growth = 0;
  if (roster.length > 0) {
    growth = genes.length === 0 ? R_NEW : 2 * R_NEW;
  }
  for (const gene of genes) {
    for (const {law} of ORGANELLE_TYPES[gene.type].parameters) {
      growth = Math.max(growth, lawGrowth(gene.radius, law));
    }
    if (isSplitTarget(gene)) {
      growth = Math.max(growth, 2 * (Math.SQRT2 - 1) * gene.radius);
    }
  }
  return growth;
}

/** The most one step of `law` on an organelle of `radius` can grow the
 * Enclosing Circle. */
function lawGrowth(radius: number, law: ParameterLaw): number {
  switch (law.kind) {
    case "symmetricMultiplicative":
      return 2 * (Math.max(radius * (1 + law.delta), law.floor) - radius);
    case "cartesianStep":
      return law.delta * radius;
  }
}

/**
 * The most a child's structural events can grow its parent's Enclosing
 * Circle: `M_max` times the parent's worst event. An empty circle is the
 * one exception, priced as ADR-0034 states it: only the first event can
 * find it empty, at `r_new`, and every later one acts on a body holding one
 * organelle of `r_new`, of whichever roster type prices worst.
 */
function maxStructuralGrowth(
  genes: readonly Gene[],
  roster: readonly OrganelleType[],
): number {
  const first = maxEventGrowth(genes, roster);
  if (genes.length > 0 || roster.length === 0 || MAX_STRUCTURAL_EVENTS < 1) {
    return Math.max(0, MAX_STRUCTURAL_EVENTS) * first;
  }

  let later = 0;
  for (const type of roster) {
    later = Math.max(
      later,
      maxEventGrowth(
        [{type, innovationId: 0, radius: R_NEW, x: 0, y: 0}],
        roster,
      ),
    );
  }
  return first + (MAX_STRUCTURAL_EVENTS - 1) * later;
}

function indicesWhere(
  genes: readonly Gene[],
  valid: (gene: Gene) => boolean,
): number[] {
  const indices: number[] = [];
  for (let i = 0; i < genes.length; i++) {
    if (valid(genes[i])) {
      indices.push(i);
    }
  }
  return indices;
}

/** `genes` with the entry at `index` replaced by `replacement`, which may
 * be empty. */
function replaceAt(
  genes: readonly Gene[],
  index: number,
  replacement: readonly Gene[],
): Gene[] {
  return [...genes.slice(0, index), ...replacement, ...genes.slice(index + 1)];
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
  /** A uniform index into `count` entries, from one draw. */
  index(count: number): number;
  /** A uniform point inside the unit disc, by rejection from its bounding
   * square: arithmetic only (ADR-0007), at a varying number of draws. */
  pointInUnitDisc(): {x: number; y: number};
  /** A uniform direction, by `drawUnitVector`'s own rejection. */
  unitVector(): {x: number; y: number};
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
    index(count: number): number {
      return Math.floor(unit() * count);
    },
    pointInUnitDisc(): {x: number; y: number} {
      for (;;) {
        const x = unit() * 2 - 1;
        const y = unit() * 2 - 1;
        if (x * x + y * y <= 1) {
          return {x, y};
        }
      }
    },
    unitVector(): {x: number; y: number} {
      const direction = drawUnitVector(current);
      current = direction.stream;
      return {x: direction.x, y: direction.y};
    },
    fires(probability: number): boolean {
      return unit() < probability;
    },
    stream(): RngStream {
      return current;
    },
  };
}
