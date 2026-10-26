import {BASELINE_BODY_RADIUS} from "./aquarium";
import {
  DELETION_WEIGHT,
  DELTA_CHILD_ALLOCATION_RATIO,
  DELTA_CYTOPLASM_RADIUS,
  DELTA_LINEAGE_HUE,
  DELTA_MITOSIS_ENERGY_THRESHOLD,
  DRIVE_NEW,
  INSERTION_WEIGHT,
  MAX_STRUCTURAL_EVENTS,
  MUTATION_PROBABILITY,
  PARAMETER_CHANGE_WEIGHT,
  R_NEW,
  SPLIT_HALF_WIDTH,
  SPLIT_WEIGHT,
  STRUCTURAL_EVENT_PROBABILITY,
} from "./constants";
import {layoutMoments, type LayoutMoments} from "./gravity";
import {makeRoom, reach, relax} from "./layout";
import {
  ORGANELLE_TYPES,
  type OrganelleType,
  type OrganelleTypeDeclaration,
  type ParameterLaw,
} from "./organelles";
import {bodyAreaOfRadius} from "./organism";
import {drawUnitVector, nextRng, type RngStream} from "./rng";

/**
 * The structural gene describing one organelle (glossary: Organelle Gene):
 * its type, its Innovation Id, its radius and its position in the genome's
 * frame. A type's further parameters join it when a type declares one: the
 * thruster's `orientation` and `drive` (M10); the neuron, the float and the
 * chloroplast declare only radius and position (`organelles.ts`).
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
  /** The direction the organelle acts along, a unit `(cos, sin)` in the
   * genome's frame. Only on a type that declares an `orientation`. */
  readonly orientation?: {readonly cos: number; readonly sin: number};
  /** How hard it acts, in `[0, 1]`. Only on a type that declares a `drive`. */
  readonly drive?: number;
}

/**
 * An Organelle Gene before the world has minted its Innovation Id: how a
 * caller describes a founder's organelles (`placeFounders`).
 */
export type OrganelleGeneDraft = Omit<OrganelleGene, "innovationId">;

/** One end of a synapse: an endpoint's id (an organelle's Innovation Id, or
 * `BODY_ID`) and the name of one of its ports. */
export interface SynapseEndpoint {
  readonly id: number;
  readonly port: string;
}

/**
 * The structural gene describing one synapse (glossary: Synapse Gene): a
 * wire from an output port to an input port, with a weight. Adds no area and
 * no reach, so nothing that lays the body out reads it. Its Innovation Id
 * follows the rules of an Organelle Gene's.
 */
export interface SynapseGene {
  readonly innovationId: number;
  readonly source: SynapseEndpoint;
  readonly destination: SynapseEndpoint;
  readonly weight: number;
}

/** A Synapse Gene before the world has minted its Innovation Id. */
export type SynapseGeneDraft = Omit<SynapseGene, "innovationId">;

/**
 * A structural gene (glossary: Structural Gene), one entry of a genome's
 * `genes`: an Organelle Gene or a Synapse Gene.
 */
export type Gene = OrganelleGene | SynapseGene;

export function isOrganelleGene(gene: Gene): gene is OrganelleGene {
  return "type" in gene;
}

export function isSynapseGene(gene: Gene): gene is SynapseGene {
  return !isOrganelleGene(gene);
}

/** The Organelle Genes of `genes`, in genome order: what everything that
 * lays out, prices or derives a body reads. */
export function organelleGenes(genes: readonly Gene[]): OrganelleGene[] {
  return genes.filter(isOrganelleGene);
}

/** `genes` with its Organelle Genes replaced, one for one and in order, by
 * `organelles`, and every Synapse Gene where it was. */
export function withOrganelleGenes(
  genes: readonly Gene[],
  organelles: readonly OrganelleGene[],
): Gene[] {
  let next = 0;
  return genes.map((gene) =>
    isOrganelleGene(gene) ? organelles[next++] : gene,
  );
}

/**
 * The complete heritable description of an organism (glossary: Genome),
 * held by `Organism` and fixed for its life: it changes only at birth,
 * through `mutateGenome`, never in place.
 *
 * v0.2's shape (ADR-0028): a fixed header of **Organism Genes**, the genes
 * an organism has exactly once, plus `genes`, the structural genes, which
 * grow and shrink as structure evolves. The header is v0.1's four genes
 * with `cytoplasmRadius` in place of `bodyRadius`: the body is no longer
 * a gene but a consequence of the layout (`deriveBody`), and with no
 * organelles the cytoplasm radius is the whole body radius.
 *
 * The header's declaration order is its draw order in `mutateGenome`, so
 * `cytoplasmRadius` sits where `bodyRadius` did.
 */
export interface Genome {
  readonly cytoplasmRadius: number;
  readonly mitosisEnergyThreshold: number;
  readonly childAllocationRatio: number;
  readonly lineageHue: number;
  readonly genes: readonly Gene[];
}

/**
 * The single minimal genome generation 0 is independently mutated from
 * (glossary: Baseline Genome). It carries no organelles, so a baseline
 * organism is v0.1's Minimal Organism (ADR-0028), and its
 * `cytoplasmRadius` is the baseline radius, 1 by definition
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
  cytoplasmRadius: BASELINE_BODY_RADIUS,
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
  for (const {innovationId} of genome.genes) {
    if (isProvisional(innovationId) && !minted.has(innovationId)) {
      minted.set(innovationId, next++);
    }
  }
  if (next === nextInnovationId) {
    return {genome, nextInnovationId};
  }

  // Every id is minted before any endpoint is rewritten, so a synapse that
  // precedes the organelle it names still finds it.
  const mintedId = (id: number): number => minted.get(id) ?? id;
  const genes = genome.genes.map((gene): Gene => {
    const innovationId = mintedId(gene.innovationId);
    return isOrganelleGene(gene)
      ? {...gene, innovationId}
      : {
          ...gene,
          innovationId,
          source: {...gene.source, id: mintedId(gene.source.id)},
          destination: {
            ...gene.destination,
            id: mintedId(gene.destination.id),
          },
        };
  });

  return {genome: {...genome, genes}, nextInnovationId: next};
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

  const cytoplasmRadius = draws.fires(probability)
    ? mutateMultiplicatively(
        genome.cytoplasmRadius,
        draws,
        DELTA_CYTOPLASM_RADIUS * scale,
      )
    : genome.cytoplasmRadius;

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
          cytoplasmRadius,
          roster: options.roster,
          eventProbability:
            options.eventProbability ?? STRUCTURAL_EVENT_PROBABILITY,
          weights: options.operatorWeights ?? OPERATOR_WEIGHTS,
        });

  return {
    genome: {
      cytoplasmRadius,
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
 * draws above it, which would bring the Birth Sieve back from the other
 * side.
 *
 * ADR-0036's `π·max(R_area_max², Reach_max²)`. The area bound is the
 * cytoplasm at its largest step plus the parent's organelle area plus what
 * `M_max` events can add to it; the reach bound is the parent's reach plus
 * what the same events can add to it. Both are read off each type's
 * declared laws by walking every sequence of `M_max` events the parent's
 * genome and the roster allow (`worstCaseBody`), so an event that acts on an
 * organelle an earlier one grew or created is priced too. Only operators
 * with a valid target are walked (ADR-0034), so with no organelles and an
 * empty roster this is v0.1's ceiling exactly.
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
  const terms = birthCostCeilingTerms(genome, roster);
  return Math.max(terms.area, terms.reach);
}

/**
 * The two areas `birthCostCeiling` takes the larger of, apart: the area term
 * `π·R_area_max²` and the reach term `π·Reach_max²`. A report on which one
 * sets the ceiling reads them here, so it cannot disagree with the law.
 */
export function birthCostCeilingTerms(
  genome: Genome,
  roster: readonly OrganelleType[],
): {readonly area: number; readonly reach: number} {
  const cytoplasm = bodyAreaOfRadius(
    genome.cytoplasmRadius * (1 + DELTA_CYTOPLASM_RADIUS),
  );
  const parent = relax(organelleGenes(genome.genes));
  const worst = worstCaseBody(
    {
      organelleArea: sumOrganelleArea(parent),
      reach: reach(parent),
      organelles: parent.map(({type, radius}) => ({type, radius})),
    },
    cytoplasm,
    roster,
    MAX_STRUCTURAL_EVENTS,
  );
  return {
    area: cytoplasm + worst.organelleArea,
    reach: bodyAreaOfRadius(worst.reach),
  };
}

/**
 * What a genome builds (ADR-0036): the body is derived from the cytoplasm
 * radius and the organelles, never inherited as a number of its own. Pure, so
 * mitosis can price a child from its genome before any `Organism` for it
 * exists.
 */
export interface Body {
  /** `max(R_area, reach)`: the body is a circle of this radius centred on the
   * genome's origin. */
  readonly radius: number;
  /**
   * The body's area minus every organelle's (glossary: Cytoplasm Area), at
   * least the cytoplasm radius's own area: the space that holds the stores,
   * so caps, internal concentrations and `β` read it rather than the whole
   * body (ADR-0029).
   */
  readonly cytoplasmArea: number;
  /** The farthest edge of any organelle from the origin, 0 with none. */
  readonly reach: number;
  /**
   * The organelles, in genome order, relaxed apart and positioned relative
   * to the body's centre, the genome's origin: an organelle sits in the world
   * at the organism's position plus its own turned through the Body Axis.
   */
  readonly organelles: readonly OrganelleGene[];
  /** The layout moments over weighing organelles that gravity reads
   * (`gravity.ts`), zero for a body with none. */
  readonly moments: LayoutMoments;
  /**
   * The body's thrusters in genome order, each with its position and
   * direction in the body frame and the maximum force and cost they are
   * read with, fixed at birth with the body. The force is `signal × maxForce`
   * along `(dx, dy)`, the signal being the organism's state
   * (`Organism.thrusterSignals`), not the body's.
   */
  readonly thrusters: readonly Thruster[];
}

/** One thruster as the motion step reads it (`Body.thrusters`). */
export interface Thruster {
  readonly x: number;
  readonly y: number;
  readonly dx: number;
  readonly dy: number;
  /** The thruster's `drive`: what its signal on the organism is born at.
   * The signal itself is the organism's state (`thrusterSignals`). */
  readonly drive: number;
  /** `kForce × 2·r`. */
  readonly maxForce: number;
  /** `k_thrust`: the energy a unit of force costs this thruster per tick. */
  readonly thrustCost: number;
}

/**
 * Derives the body a genome builds (ADR-0036): the organelles relaxed apart
 * (`relax`), and a body of the cytoplasm's area plus theirs, widened to their
 * reach if any of them sticks out of it. Nothing recentres: the genome's
 * origin is the body's centre. A genome in the world already holds a relaxed
 * layout, and relaxing it again moves nothing; the relaxation here is what
 * puts a hand-written layout into that form (`placeFounders`).
 *
 * With no organelles the radius is the cytoplasm radius itself, to the last
 * bit: v0.1's Minimal Organism.
 */
export function deriveBody(
  genome: Genome,
  declarations: Readonly<
    Record<string, OrganelleTypeDeclaration>
  > = ORGANELLE_TYPES,
): Body {
  const relaxed = relax(organelleGenes(genome.genes));
  const organelleArea = sumOrganelleArea(relaxed);
  const organelleReach = reach(relaxed);
  const radius = Math.max(
    areaRadius(genome.cytoplasmRadius, organelleArea),
    organelleReach,
  );

  return {
    radius,
    cytoplasmArea: bodyAreaOfRadius(radius) - organelleArea,
    reach: organelleReach,
    organelles: relaxed,
    moments: layoutMoments(relaxed, declarations),
    thrusters: thrustersOf(relaxed, declarations),
  };
}

function thrustersOf(
  organelles: readonly OrganelleGene[],
  declarations: Readonly<Record<string, OrganelleTypeDeclaration>>,
): Thruster[] {
  const thrusters: Thruster[] = [];
  for (const {type, radius, x, y, orientation, drive} of organelles) {
    const {thrust} = declarations[type];
    if (thrust === undefined || orientation === undefined) {
      continue;
    }
    thrusters.push({
      x,
      y,
      dx: orientation.cos,
      dy: orientation.sin,
      drive: drive ?? 0,
      maxForce: thrust.force * 2 * radius,
      thrustCost: thrust.cost,
    });
  }
  return thrusters;
}

/** `R_area`: the radius of a circle of the cytoplasm's area plus
 * `organelleArea`, which is the cytoplasm radius itself with none. */
function areaRadius(cytoplasmRadius: number, organelleArea: number): number {
  return organelleArea === 0
    ? cytoplasmRadius
    : Math.sqrt((bodyAreaOfRadius(cytoplasmRadius) + organelleArea) / Math.PI);
}

function sumOrganelleArea(discs: readonly {readonly radius: number}[]): number {
  let area = 0;
  for (const disc of discs) {
    area += bodyAreaOfRadius(disc.radius);
  }
  return area;
}

interface StructuralLaw {
  /** The child's own cytoplasm radius, already mutated: the body an
   * insertion is born in is sized with it. */
  readonly cytoplasmRadius: number;
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
 * stated per event, and nothing recentres it (ADR-0036): the relaxed layout
 * is what the child's genome holds. A child no event touched keeps its
 * parent's genes as they are.
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
  // The events act on Organelle Genes alone: a Synapse Gene is no target of
  // any operator, but follows the organelle it is wired to (a deletion
  // removes it, a split copies it). A child an event touched holds its
  // organelles first, then its synapses.
  const organelles = organelleGenes(genes);
  if (law.roster.length === 0 && organelles.length === 0) {
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
  let layout = organelles;
  let wiring: readonly SynapseGene[] = genes.filter(isSynapseGene);
  let touched = false;
  for (let event = 0; event < events; event++) {
    const operator = pickOperator(draws.unit(), law.weights);
    const changed = applyEvent(
      operator,
      layout,
      wiring,
      law.roster,
      draws,
      provisionalId,
      law.cytoplasmRadius,
    );
    if (changed !== null) {
      layout = relax(changed.layout);
      wiring = changed.wiring;
      touched = true;
    }
  }

  return touched ? [...layout, ...wiring] : genes;
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

/** What a structural event leaves: the organelles before relaxation, and the
 * synapses that stay sound against them. */
interface EventResult {
  readonly layout: OrganelleGene[];
  readonly wiring: readonly SynapseGene[];
}

/**
 * One structural event, before relaxation, or `null` when its operator has
 * no valid target and it does nothing.
 */
function applyEvent(
  operator: StructuralOperator,
  layout: readonly OrganelleGene[],
  wiring: readonly SynapseGene[],
  roster: readonly OrganelleType[],
  draws: MutationDraws,
  provisionalId: () => number,
  cytoplasmRadius: number,
): EventResult | null {
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
      return {
        layout: replaceAt(layout, index, [changeParameter(gene, law, draws)]),
        wiring,
      };
    }

    case "insertion": {
      if (roster.length === 0) {
        return null;
      }
      const type = roster[draws.index(roster.length)];
      // The radius the body will have with the new organelle's area added
      // comes first, and the position is drawn after it, uniform by area
      // over the disc that holds the whole organelle (ADR-0036).
      const bodyRadius = Math.max(
        areaRadius(
          cytoplasmRadius,
          sumOrganelleArea(layout) + bodyAreaOfRadius(R_NEW),
        ),
        reach(layout),
      );
      const offset = draws.pointInUnitDisc();
      const within = bodyRadius - R_NEW;
      const {parameters} = ORGANELLE_TYPES[type];
      // A type's further parameters are born after the position, and only a
      // type that declares them draws or carries them.
      const orientation = parameters.some(({name}) => name === "orientation")
        ? draws.unitVector()
        : undefined;
      const drive = parameters.some(({name}) => name === "drive")
        ? DRIVE_NEW
        : undefined;
      return {
        layout: [
          ...layout,
          {
            type,
            innovationId: provisionalId(),
            radius: R_NEW,
            x: offset.x * within,
            y: offset.y * within,
            ...(orientation && {
              orientation: {cos: orientation.x, sin: orientation.y},
            }),
            ...(drive !== undefined && {drive}),
          },
        ],
        wiring,
      };
    }

    case "deletion": {
      if (layout.length === 0) {
        return null;
      }
      const index = draws.index(layout.length);
      const {innovationId} = layout[index];
      // A synapse never outlives an endpoint: both go as one event.
      return {
        layout: replaceAt(layout, index, []),
        wiring: wiring.filter(
          ({source, destination}) =>
            source.id !== innovationId && destination.id !== innovationId,
        ),
      };
    }

    case "split": {
      const targets = indicesWhere(layout, isSplitTarget);
      if (targets.length === 0) {
        return null;
      }
      return split(
        layout,
        wiring,
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
 * The additive clamped law moves `drive`, and the unit-vector rotation turns
 * `orientation`.
 */
function changeParameter(
  gene: OrganelleGene,
  law: ParameterLaw,
  draws: MutationDraws,
): OrganelleGene {
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
    case "additiveClamped":
      return {
        ...gene,
        drive: Math.min(
          law.max,
          Math.max(law.min, (gene.drive ?? 0) + draws.signed() * law.delta),
        ),
      };
    case "unitVectorRotation": {
      // The Body Axis's own update: a small rotation and a renormalising
      // square root, so no `sin` or `cos`.
      const epsilon = draws.signed() * law.epsilon;
      const {cos: c, sin: s} = gene.orientation ?? {cos: 1, sin: 0};
      const cos = c - epsilon * s;
      const sin = s + epsilon * c;
      const norm = Math.sqrt(cos * cos + sin * sin);
      return {...gene, orientation: {cos: cos / norm, sin: sin / norm}};
    }
  }
}

/**
 * A Split (ADR-0028): the organelle at `index` becomes two, of areas `f·A`
 * and `(1−f)·A` with `f = 0.5 + (u₁ + u₂ − 1)·w`, conserving its area. The
 * pieces lie tangent along a drawn direction, filling the circle of radius
 * `r·(√f + √(1−f))` centred where the organelle was, and the other
 * organelles first make way for that circle (`makeRoom`). That circle is at
 * most `√2·r`, so the Reach grows by at most `(√2 − 1)·r`,
 * inside the `2(√2 − 1)·r` the ceiling prices.
 *
 * The first piece keeps the original's id and its place in the genome; the
 * second gets a new id and the place right after it.
 */
function split(
  layout: readonly OrganelleGene[],
  wiring: readonly SynapseGene[],
  index: number,
  draws: MutationDraws,
  provisionalId: () => number,
): EventResult {
  const gene = layout[index];
  const f = 0.5 + (draws.unit() + draws.unit() - 1) * SPLIT_HALF_WIDTH;
  const direction = draws.unitVector();
  const firstRadius = gene.radius * Math.sqrt(f);
  const secondRadius = gene.radius * Math.sqrt(1 - f);
  const room = {x: gene.x, y: gene.y, radius: firstRadius + secondRadius};
  const others = makeRoom(replaceAt(layout, index, []), room);

  const first: OrganelleGene = {
    ...gene,
    radius: firstRadius,
    x: gene.x - direction.x * secondRadius,
    y: gene.y - direction.y * secondRadius,
  };
  const second: OrganelleGene = {
    ...gene,
    innovationId: provisionalId(),
    radius: secondRadius,
    x: gene.x + direction.x * firstRadius,
    y: gene.y + direction.y * firstRadius,
  };
  // Each incoming synapse is copied to the second piece, with the same
  // weight, right after the original, which stays on the first.
  const copied = wiring.flatMap((synapse) =>
    synapse.destination.id === gene.innovationId
      ? [
          synapse,
          {
            ...synapse,
            innovationId: provisionalId(),
            destination: {...synapse.destination, id: second.innovationId},
          },
        ]
      : [synapse],
  );
  return {
    layout: [...others.slice(0, index), first, second, ...others.slice(index)],
    wiring: copied,
  };
}

/**
 * Whether a Split can act on this organelle: only if its smaller piece, at
 * the bell's most uneven `f = 0.5 − w`, still reaches its type's radius
 * floor. Clamping that piece up would add the area a split exists to
 * conserve (ADR-0034).
 */
function isSplitTarget(gene: PricedOrganelle): boolean {
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

/** An organelle as the ceiling's walk tracks it: only what the operators'
 * laws read. */
interface PricedOrganelle {
  readonly type: OrganelleType;
  readonly radius: number;
}

/** What a sequence of events leaves of a body, bounded from above: the
 * organelles' total area, their reach, and the organelles themselves, so the
 * next event can act on what an earlier one grew or made. */
interface PricedBody {
  readonly organelleArea: number;
  readonly reach: number;
  readonly organelles: readonly PricedOrganelle[];
}

/**
 * The largest organelle area and the largest reach any sequence of `events`
 * structural events can leave `body` with (ADR-0036's `R_area_max` and
 * `Reach_max`), over the operators with a valid target at each step and read
 * off each type's declared laws rather than found by trying mutations. Every
 * choice of event is walked, and the two bounds are the maxima over them.
 * `cytoplasmArea` is the child's cytoplasm at its largest step.
 *
 * Each event's effect on the reach is ADR-0028's contract restated on it
 * (`relax`): an event that adds `Δd` of diameter or moves an organelle by `d`
 * grows the reach by at most `Δd + d`.
 *
 * - insertion, with a non-empty roster: area `π·r_new²`, and a reach of at
 *   most the body it is born in (`R_area` after it) or `2·r_new` past the
 *   old reach, once relaxed;
 * - a symmetric multiplicative radius step `r → max(r·(1+δ), floor)`: the
 *   area it adds, and `2·(r' − r)` of reach;
 * - a Cartesian step: `δ·r` of reach;
 * - a Split of a valid target: no area, `2(√2 − 1)·r` of reach, and two
 *   pieces of at most `r·√(½ + w)` and `r·√(½ − w)` for later events;
 * - a deletion adds nothing and is left out.
 */
function worstCaseBody(
  body: PricedBody,
  cytoplasmArea: number,
  roster: readonly OrganelleType[],
  events: number,
): {readonly organelleArea: number; readonly reach: number} {
  let worst = {organelleArea: body.organelleArea, reach: body.reach};
  if (events < 1) {
    return worst;
  }

  for (const next of successors(body, cytoplasmArea, roster)) {
    const ahead = worstCaseBody(next, cytoplasmArea, roster, events - 1);
    worst = {
      organelleArea: Math.max(worst.organelleArea, ahead.organelleArea),
      reach: Math.max(worst.reach, ahead.reach),
    };
  }
  return worst;
}

/** Every body one valid event can leave `body` as, in its worst case. */
function successors(
  body: PricedBody,
  cytoplasmArea: number,
  roster: readonly OrganelleType[],
): PricedBody[] {
  const result: PricedBody[] = [];

  for (const type of roster) {
    const organelleArea = body.organelleArea + bodyAreaOfRadius(R_NEW);
    result.push({
      organelleArea,
      reach: Math.max(
        Math.sqrt((cytoplasmArea + organelleArea) / Math.PI),
        body.reach + 2 * R_NEW,
      ),
      organelles: [...body.organelles, {type, radius: R_NEW}],
    });
  }

  body.organelles.forEach((organelle, index) => {
    for (const {law} of ORGANELLE_TYPES[organelle.type].parameters) {
      switch (law.kind) {
        case "symmetricMultiplicative": {
          const grown = Math.max(organelle.radius * (1 + law.delta), law.floor);
          result.push({
            organelleArea:
              body.organelleArea +
              bodyAreaOfRadius(grown) -
              bodyAreaOfRadius(organelle.radius),
            reach: body.reach + 2 * (grown - organelle.radius),
            organelles: replaceAt(body.organelles, index, [
              {type: organelle.type, radius: grown},
            ]),
          });
          break;
        }
        case "cartesianStep":
          result.push({
            ...body,
            reach: body.reach + law.delta * organelle.radius,
          });
          break;
        case "additiveClamped":
        case "unitVectorRotation":
          // No area, no reach: the body the ceiling prices is unchanged.
          break;
      }
    }

    if (isSplitTarget(organelle)) {
      result.push({
        ...body,
        reach: body.reach + 2 * (Math.SQRT2 - 1) * organelle.radius,
        organelles: replaceAt(body.organelles, index, [
          {
            type: organelle.type,
            radius: organelle.radius * Math.sqrt(0.5 + SPLIT_HALF_WIDTH),
          },
          {
            type: organelle.type,
            radius: organelle.radius * Math.sqrt(0.5 - SPLIT_HALF_WIDTH),
          },
        ]),
      });
    }
  });

  return result;
}

function indicesWhere(
  genes: readonly OrganelleGene[],
  valid: (gene: OrganelleGene) => boolean,
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
function replaceAt<T>(
  genes: readonly T[],
  index: number,
  replacement: readonly T[],
): T[] {
  return [...genes.slice(0, index), ...replacement, ...genes.slice(index + 1)];
}

/**
 * `cytoplasmRadius`'s law, inherited from v0.1's `bodyRadius`: draw a
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
