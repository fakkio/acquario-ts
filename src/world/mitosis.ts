import {MITOSIS_ENERGY_COST, RHO} from "./constants";
import {
  birthCostCeiling,
  deriveBody,
  mintInnovationIds,
  mutateGenome,
  type Genome,
} from "./genome";
import type {OrganelleType} from "./organelles";
import {constrainToAquarium} from "./motion";
import {
  Organism,
  RESOURCES,
  bodyAreaOfRadius,
  energyCap,
  energyCapForArea,
  type Resource,
} from "./organism";
import {deriveChildStream, drawUnitVector, type RngStream} from "./rng";

/**
 * ADR-0019's pending birth (glossary: Pending Birth): a frozen record of a
 * child between step 7, where `evaluateMitosis` builds it, and step 12,
 * where `appendBirths` turns it into a population member. The mirror of
 * `death.ts`'s `Remains` — matter already taken from a parent and not yet
 * given to a population — which is what keeps the carbon ledger balanced
 * at the end of a tick in which something was born: nothing here is lost
 * between the two steps, only relocated.
 */
export interface PendingBirth {
  readonly genome: Genome;
  readonly x: number;
  readonly y: number;
  readonly rng: RngStream;
  /** The parent's Generation plus one. */
  readonly generation: number;
  readonly energy: number;
  readonly oxygen: number;
  readonly carbonDioxide: number;
  readonly food: number;
}

/**
 * Resolve-phase step 7 (ADR-0006/ADR-0019): per organism, writing only to
 * that organism — its own stores and its own stream — exactly like
 * `applyRespiration` and `applyBrownianMotion`, which is what keeps this
 * phase order-independent by construction. Unlike `evaluateDeaths`, this
 * does not partition the population: it is called once per organism and
 * either hands back a `PendingBirth` or does not. A parent turned away
 * draws nothing: both gates come before the first draw.
 *
 * The draw order below is a law of the world (ADR-0019, amended by
 * ADR-0027): reordering it later reseeds every child mutated from this
 * point on.
 *
 * 1. **The threshold gate, with no draws at all.** `energy ≥
 *    mitosisEnergyThreshold × cap(energy)`, read off the parent's own
 *    unmutated genome. An organism that never breeds draws exactly the
 *    numbers it drew before this function existed.
 * 2. **The Worst-Case Birth Gate, with no draws either** (ADR-0027). The
 *    parent must already hold both costs of the most expensive child its
 *    mutation law could produce, its `birthCostCeiling` over the world's
 *    `roster`. What this gate
 *    filters is which parents breed, on their own state; the child drawn
 *    after it is an unbiased sample of the mutation law. Pricing the drawn
 *    child instead, and turning it away when it costs too much, is the
 *    Birth Sieve that killed v0.1 (#40).
 * 3. **Derive the child's stream, before mutating.** The child's seed is
 *    then a function of the parent's state at birth and of nothing else —
 *    adding a fifth gene later, or retuning a δ, does not reseed every
 *    lineage in the world. `createPopulation` derives before drawing for
 *    the same reason.
 * 4. **Mutate the genome**, the header gene by gene in `mutateGenome`'s own
 *    fixed declaration order and then the structural events, drawn from the
 *    *parent's* stream — the same stream
 *    `deriveChildStream` just advanced past the derivation draw, not the
 *    freshly derived child stream, which the child keeps for its own life
 *    from here on untouched by its own birth.
 * 5. **Price and pay**, from the body the child's genome builds
 *    (`deriveBody`), which cannot fail after step 2. A child the parent
 *    cannot pay for means the ceiling is broken, and that throws, before
 *    anything is subtracted: returning no birth would reject the draw and
 *    bring the sieve back from the other side.
 * 6. **The tangent angle, last**, so its rejection-sampling loop's
 *    variable draw count shifts nothing drawn before it.
 */
export function evaluateMitosis(
  organism: Organism,
  roster: readonly OrganelleType[],
): PendingBirth | null {
  const thresholdEnergy =
    organism.genome.mitosisEnergyThreshold * energyCap(organism);
  if (organism.energy < thresholdEnergy) {
    return null;
  }

  const ceiling = birthCosts(organism.genome, roster);
  const maxChildArea = ceiling.area;
  if (organism.energy < ceiling.energy || organism.food < ceiling.food) {
    return null;
  }

  const derivation = deriveChildStream(organism.rng);
  organism.rng = derivation.parentStream;
  const childStream = derivation.childStream;

  const mutation = mutateGenome(organism.genome, organism.rng, {roster});
  organism.rng = mutation.stream;
  const childGenome = mutation.genome;

  const childBody = deriveBody(childGenome);
  const childArea = bodyAreaOfRadius(childBody.radius);
  const massCost = mitosisMassCost(childArea);
  const energyCost = mitosisEnergyCost(childArea);

  if (organism.food < massCost || organism.energy < energyCost) {
    throw new Error(
      `Birth Cost Ceiling broken: a child of area ${String(childArea)} ` +
        `exceeds its parent's ceiling of ${String(maxChildArea)} (ADR-0027)`,
    );
  }

  organism.food -= massCost;
  organism.energy -= energyCost;

  // `childAllocationRatio` splits what remains after both costs, across
  // all four resources including energy (ADR-0019). Only energy has a cap
  // (ADR-0035): a child that cannot hold its full energy share receives up
  // to its own cap — computed from its own Cytoplasm Area via
  // `energyCapForArea`, since no `Organism` for it exists yet to hand
  // `energyCap` — and the excess stays with the parent. Food, O₂ and CO₂
  // are handed over in full, even into a child whose concentration then
  // sits above its parent's: it vents the difference through exchange.
  const ratio = organism.genome.childAllocationRatio;
  const childStores: Record<Resource, number> = {
    energy: 0,
    oxygen: 0,
    carbonDioxide: 0,
    food: 0,
  };
  for (const resource of RESOURCES) {
    const desired = ratio * organism[resource];
    const granted =
      resource === "energy"
        ? Math.min(desired, energyCapForArea(childBody.cytoplasmArea))
        : desired;
    organism[resource] -= granted;
    childStores[resource] = granted;
  }

  const direction = drawUnitVector(organism.rng);
  organism.rng = direction.stream;
  // Budding, not teleportation (`docs/vision.md`): the child's centre sits
  // one body-to-body tangent point away from the parent's, in the drawn
  // direction. Left free to land outside the aquarium — `appendBirths`
  // constrains it at step 12, after step 10's separation has already run
  // for everyone else this tick.
  const separation = organism.bodyRadius + childBody.radius;

  return {
    genome: childGenome,
    x: organism.x + direction.x * separation,
    y: organism.y + direction.y * separation,
    rng: childStream,
    generation: organism.generation + 1,
    energy: childStores.energy,
    oxygen: childStores.oxygen,
    carbonDioxide: childStores.carbonDioxide,
    food: childStores.food,
  };
}

/**
 * What the Worst-Case Birth Gate (ADR-0027) asks a parent to hold: the energy
 * and the food of the most expensive child its mutation law could produce.
 * One function for the gate and for the inspector that shows it, so the two
 * cannot disagree.
 */
export function birthCosts(
  genome: Genome,
  roster: readonly OrganelleType[],
): {readonly area: number; readonly energy: number; readonly food: number} {
  const area = birthCostCeiling(genome, roster);
  return {
    area,
    energy: mitosisEnergyCost(area),
    food: mitosisMassCost(area),
  };
}

/**
 * `mitosisMassCost` is forced, not chosen (ADR-0019): `bodyMass` is
 * `ρ × area`, and death returns exactly that amount, so any other number
 * breaks the ledger the moment this child is born. Paid from food alone —
 * ADR-0025's fallback of drawing the remainder from CO₂ was considered at
 * #36 and rejected: a parent hands its child the same resource it gives
 * up, food for food, oxygen for oxygen, CO₂ for CO₂, and a cross-type
 * conversion at the exact moment of birth broke that symmetry for food
 * alone. See `AMBIENT_CO2_SHARE`'s own comment for how the ambient split
 * covers the mass gate without it.
 *
 * One function for the gate and the payment, so the two can never disagree
 * about what a child costs.
 */
function mitosisMassCost(childArea: number): number {
  return RHO * childArea;
}

/**
 * `mitosisEnergyCost` is strictly proportional, with no flat term — see
 * `MITOSIS_ENERGY_COST`'s own comment for why that asymmetry with
 * maintenance is load-bearing. Shared by the gate and the payment, like
 * `mitosisMassCost`.
 */
function mitosisEnergyCost(childArea: number): number {
  return MITOSIS_ENERGY_COST * childArea;
}

/**
 * Commit-phase step 12's first half: replaces each pending birth's
 * provisional Innovation Ids from the world's counter, in the order the
 * births were enqueued, which is the population's order (ADR-0028). Pure,
 * like `appendBirths`: it returns the counter advanced past what it
 * minted. Nothing reads an id's value, so the order only has to be
 * reproducible, and it is.
 */
export function mintBirths(
  births: readonly PendingBirth[],
  nextInnovationId: number,
): {
  readonly births: readonly PendingBirth[];
  readonly nextInnovationId: number;
} {
  let next = nextInnovationId;
  const minted = births.map((birth) => {
    const result = mintInnovationIds(birth.genome, next);
    next = result.nextInnovationId;
    return result.genome === birth.genome
      ? birth
      : {...birth, genome: result.genome};
  });

  return {births: minted, nextInnovationId: next};
}

/**
 * Commit-phase step 12: a pure `(population, births[]) => population`
 * (ADR-0019), so it is testable against no world at all — the same shape
 * `death.ts`'s `depositRemains` gives step 11. Each pending birth becomes a
 * real `Organism`, constrained to the aquarium before it joins the
 * population: births land after step 10's separation and wall clamp have
 * already run for this tick, so without that call here a newborn could end
 * its birth tick outside the walls. Newborns are appended, never spliced
 * in, so they are inert for their first tick (`docs/vision.md`) — the
 * iteration that creates them has already finished.
 */
export function appendBirths(
  population: readonly Organism[],
  births: readonly PendingBirth[],
): readonly Organism[] {
  if (births.length === 0) {
    return population;
  }

  const children = births.map((birth) => {
    const child = new Organism({
      x: birth.x,
      y: birth.y,
      genome: birth.genome,
      rng: birth.rng,
      generation: birth.generation,
      energy: birth.energy,
      oxygen: birth.oxygen,
      carbonDioxide: birth.carbonDioxide,
      food: birth.food,
    });
    constrainToAquarium(child);
    return child;
  });

  return [...population, ...children];
}
