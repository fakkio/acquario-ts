import {MITOSIS_ENERGY_COST, RHO} from "./constants";
import {mutateGenome, type Genome} from "./genome";
import {constrainToAquarium} from "./motion";
import {
  Organism,
  RESOURCES,
  bodyAreaOfRadius,
  capFor,
  capForRadius,
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
 * either hands back a `PendingBirth` or does not. A rejected birth can
 * still have spent the parent's stream on the derivation and mutation
 * draws below — see step 4 — so "does not" means the return value, not
 * necessarily the stream.
 *
 * The draw order below is a law of the world (see the ticket): reordering
 * it later reseeds every child mutated from this point on.
 *
 * 1. **The threshold gate, with no draws at all.** `energy ≥
 *    mitosisEnergyThreshold × cap(energy)`, read off the parent's own
 *    unmutated genome. An organism that never breeds draws exactly the
 *    numbers it drew before this function existed.
 * 2. **Derive the child's stream, before mutating.** The child's seed is
 *    then a function of the parent's state at birth and of nothing else —
 *    adding a fifth gene later, or retuning a δ, does not reseed every
 *    lineage in the world. `createPopulation` derives before drawing for
 *    the same reason.
 * 3. **Mutate the genome**, gene by gene in `mutateGenome`'s own fixed
 *    declaration order, drawn from the *parent's* stream — the same stream
 *    `deriveChildStream` just advanced past the derivation draw, not the
 *    freshly derived child stream, which the child keeps for its own life
 *    from here on untouched by its own birth.
 * 4. **Price and pay.** If a physical requirement fails, the draws from 2
 *    and 3 are already spent and the child is discarded — no rollback, and
 *    harmless, because ADR-0007 scopes the consequence to the parent's own
 *    lineage.
 * 5. **The tangent angle, last, and only on a committed birth**, so the
 *    rejection-sampling loop's variable draw count never runs on the
 *    failed path.
 */
export function evaluateMitosis(organism: Organism): PendingBirth | null {
  const thresholdEnergy =
    organism.genome.mitosisEnergyThreshold * capFor(organism, "energy");
  if (organism.energy < thresholdEnergy) {
    return null;
  }

  const derivation = deriveChildStream(organism.rng);
  organism.rng = derivation.parentStream;
  const childStream = derivation.childStream;

  const mutation = mutateGenome(organism.genome, organism.rng);
  organism.rng = mutation.stream;
  const childGenome = mutation.genome;

  const childArea = bodyAreaOfRadius(childGenome.bodyRadius);
  // `mitosisMassCost` is forced, not chosen (ADR-0019): `bodyMass` is
  // `ρ × area`, and death returns exactly that amount, so any other number
  // breaks the ledger the moment this child is born.
  const massCost = RHO * childArea;
  // `mitosisEnergyCost` is strictly proportional, with no flat term — see
  // `MITOSIS_ENERGY_COST`'s own comment for why that asymmetry with
  // maintenance is load-bearing.
  const energyCost = MITOSIS_ENERGY_COST * childArea;

  if (organism.food < massCost || organism.energy < energyCost) {
    return null;
  }

  organism.food -= massCost;
  organism.energy -= energyCost;

  // `childAllocationRatio` splits what remains after both costs, across
  // all four resources including energy (ADR-0019). A child that cannot
  // hold its full share receives up to its own caps — computed from its
  // own mutated area via `capForRadius`, since no `Organism` for it exists
  // yet to hand `capFor` — and the excess simply stays subtracted from
  // nothing: `organism[resource]` only ever loses the granted amount.
  const ratio = organism.genome.childAllocationRatio;
  const childStores: Record<Resource, number> = {
    energy: 0,
    oxygen: 0,
    carbonDioxide: 0,
    food: 0,
  };
  for (const resource of RESOURCES) {
    const desired = ratio * organism[resource];
    const granted = Math.min(
      desired,
      capForRadius(childGenome.bodyRadius, resource),
    );
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
  const separation = organism.bodyRadius + childGenome.bodyRadius;

  return {
    genome: childGenome,
    x: organism.x + direction.x * separation,
    y: organism.y + direction.y * separation,
    rng: childStream,
    energy: childStores.energy,
    oxygen: childStores.oxygen,
    carbonDioxide: childStores.carbonDioxide,
    food: childStores.food,
  };
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
