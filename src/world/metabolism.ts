import {
  BODY_COST_COEFFICIENT,
  EXISTENCE_COST,
  K_DIFFUSION,
  K_PHOTO,
  K_RESP,
  RESPIRATION_ENERGY_YIELD,
} from "./constants";
import type {Environment} from "./environment";
import {DIFFUSIBLES, bodyArea, capFor, type Organism} from "./organism";

/**
 * The reactions and costs that spend and fill an organism's internal
 * stores. Free functions in the style M1's `motion.ts` already chose,
 * writing only to the organism they run for. Passive exchange and
 * photosynthesis take an `Environment`, since both cross the membrane or
 * read light; respiration and maintenance are purely internal and take
 * none.
 */

/**
 * Resolve-phase step 2 (ADR-0006): passive exchange, ADR-0003's one signed
 * law over all three diffusibles —
 *
 * `flux = kDiffusion × perimeter × (C_external − C_internal)`
 *
 * ADR-0003 writes this with a trailing `× dt`; it is dropped here for the
 * same reason `motion.ts` drops it from its own integration — the
 * simulation's time unit is one tick, so `dt` is 1 by construction and
 * never appears in the arithmetic.
 *
 * A positive flux absorbs, a negative flux vents, and equilibrium falls out
 * for free as the internal concentration approaches the external one. No
 * direction flag and no special case per resource: the same formula runs
 * for oxygen, CO₂ and food alike, and an organism holding more than ambient
 * leaks back into the pool without this function knowing it is happening.
 *
 * Called once per exchange sub-pass (ADR-0016), against a different
 * `Environment` each time. In the request pass every `exchange` call
 * answers 0, so the loop below writes nothing to the organism; in the
 * grant pass it answers the settled amount, and that is exactly what the
 * organism ends the tick holding. The function itself does not know which
 * pass it is in — only the `Environment` it is handed does.
 *
 * `flux` is recomputed rather than carried from the request call to the
 * grant call, which is only safe because nothing touches this organism's
 * stores in between: `runTick` runs every organism's request, then
 * `settle`s, then runs every organism's grant, with no other step
 * interleaved. A future ticket that inserts a step between 2a and 2b would
 * need this function to carry the requested flux forward instead of
 * recomputing it, or the grant could settle against a demand tally that no
 * longer matches what `exchange` is asked for here.
 */
export function applyPassiveExchange(
  organism: Organism,
  environment: Environment,
): void {
  const area = bodyArea(organism);
  const perimeter = 2 * Math.PI * organism.bodyRadius;

  for (const resource of DIFFUSIBLES) {
    const externalConcentration = environment.concentration(resource, organism);
    const internalConcentration = organism[resource] / area;
    const flux =
      K_DIFFUSION * perimeter * (externalConcentration - internalConcentration);

    organism[resource] += environment.exchange(resource, organism, flux);
  }
}

/**
 * Resolve-phase step 3 (ADR-0006): photosynthesis, the first reaction and
 * the only route by which anything enters the closed system from outside —
 * `CO₂ + light → food + O₂` at 1:1:1 stoichiometry, producing no energy
 * (CONTEXT.md). A purely internal transformation: carbon and oxygen move
 * between an organism's own stores, never through the `Environment`'s
 * `exchange`, so this reaction cannot itself move mass into or out of a
 * pool — only passive exchange (step 2) and, later, respiration (step 4)
 * do that.
 *
 * The rate follows mass action on internal CO₂ — ADR-0003's shape, applied
 * here to fixation rather than diffusion — multiplied by the light at the
 * body's centre and by the width it projects toward that light, i.e. its
 * diameter. Depth buys something real: an organism in the photic zone
 * fixes carbon a floor-dwelling twin cannot approach, and complete darkness
 * fixes nothing at all.
 *
 * **Throttle, never spill.** The reaction runs at the minimum of its rate,
 * the CO₂ actually available, and the headroom left in the food and oxygen
 * stores — spilling either product past its cap would create carbon or
 * oxygen out of nothing and break the invariant on the first tick that ran
 * long enough to fill one.
 *
 * Runs after both of step 2's exchange sub-passes, so `organism.carbonDioxide`
 * already reflects this tick's settled grant rather than last tick's — the
 * substrate and headroom this throttles against are the exact numbers the
 * settlement struck, not optimistic ones.
 */
export function applyPhotosynthesis(
  organism: Organism,
  environment: Environment,
): void {
  const area = bodyArea(organism);
  const diameter = 2 * organism.bodyRadius;
  const internalCo2Concentration = organism.carbonDioxide / area;
  const light = environment.light(organism);

  const rate = K_PHOTO * internalCo2Concentration * light * diameter;
  const substrateAvailable = organism.carbonDioxide;
  const foodHeadroom = capFor(organism, "food") - organism.food;
  const oxygenHeadroom = capFor(organism, "oxygen") - organism.oxygen;

  const fixed = Math.max(
    0,
    Math.min(rate, substrateAvailable, foodHeadroom, oxygenHeadroom),
  );

  organism.carbonDioxide -= fixed;
  organism.food += fixed;
  organism.oxygen += fixed;
}

/** What `applyRespiration` reports back, beyond the mutation it makes to
 * the organism, for the tick to fold into the population's measured `α`
 * (ADR-0015) — nothing here is stored on the organism itself, since it
 * describes this tick's reaction and not next tick's starting state. */
export interface RespirationOutcome {
  /** Energy this reaction actually produced this tick, before
   * maintenance spends any of it. The numerator of one organism's `α`. */
  readonly energyProduced: number;
  /**
   * Whether the energy store's headroom, not the substrate or the CO₂
   * cap, was the binding limit. An organism throttled this way is
   * measuring the size of its own tank rather than the income available
   * to it, so ADR-0015 excludes it from the population mean.
   */
  readonly throttledByFullEnergyStore: boolean;
}

/**
 * Resolve-phase step 4 (ADR-0006): respiration, the only source of energy
 * in the simulation — `food + O₂ → energy + CO₂` at 1:1:1 stoichiometry on
 * the carbon and oxygen ledgers, the exact reverse of photosynthesis's
 * transfer plus an energy yield. A purely internal transformation, like
 * photosynthesis: it never calls `exchange`, so it cannot itself move mass
 * into or out of a pool.
 *
 * **Runs after photosynthesis, reading the food it just produced in the
 * same tick.** This is a law of the world, not a matter of presentation
 * (see the ticket): steps 3 and 4 are chained rather than merely ordered,
 * so an illuminated organism's net for the tick is `light → energy`
 * exactly the way a real plant's is. Reordering these two steps during a
 * refactor would look harmless — both still run once per tick — and would
 * quietly turn every illuminated organism's food output into a one-tick
 * lag instead of the same-tick cycle the milestone promises.
 *
 * The rate follows mass action on *two* internal reactant concentrations —
 * food and O₂ — multiplied by body area rather than by the perimeter-like
 * factor photosynthesis uses. That is what keeps energy income linear in
 * `r`: capacity here grows with area while passive exchange's supply grows
 * only with perimeter, so a larger body's respiration stays supply-limited
 * rather than pegged at some internal ceiling of its own.
 *
 * **Throttle, never spill**, exactly as photosynthesis is: the reaction
 * runs at the minimum of its rate, the food and O₂ actually available, and
 * the headroom left in the CO₂ store. It is throttled by the energy
 * store's headroom too, even though spilling energy would not break
 * conservation — energy is not part of either ledger — on the grounds that
 * nothing burns fuel with nowhere to put the result. Without that rule a
 * sated organism would strip-mine the food pool for a product it has no
 * room to hold.
 */
export function applyRespiration(organism: Organism): RespirationOutcome {
  const area = bodyArea(organism);
  const foodConcentration = organism.food / area;
  const oxygenConcentration = organism.oxygen / area;
  const rate = K_RESP * foodConcentration * oxygenConcentration * area;

  const foodAvailable = organism.food;
  const oxygenAvailable = organism.oxygen;
  const co2Headroom =
    capFor(organism, "carbonDioxide") - organism.carbonDioxide;
  const energyHeadroom =
    (capFor(organism, "energy") - organism.energy) / RESPIRATION_ENERGY_YIELD;

  const reacted = Math.max(
    0,
    Math.min(rate, foodAvailable, oxygenAvailable, co2Headroom, energyHeadroom),
  );

  organism.food -= reacted;
  organism.oxygen -= reacted;
  organism.carbonDioxide += reacted;
  const energyProduced = reacted * RESPIRATION_ENERGY_YIELD;
  organism.energy += energyProduced;

  return {
    energyProduced,
    throttledByFullEnergyStore:
      energyHeadroom <= rate &&
      energyHeadroom <= foodAvailable &&
      energyHeadroom <= oxygenAvailable &&
      energyHeadroom <= co2Headroom,
  };
}

/**
 * Resolve-phase step 5 (ADR-0006): maintenance, the cost of being an
 * organism at all — `c₀ + β·area` (ADR-0009), charged in full every tick to
 * every organism. `c₀` is the flat existence cost that creates a minimum
 * viable body size; `β·area` is the body cost. Both halves run in M2 rather
 * than waiting for M5, so the term that shapes `r_opt` is exercised from
 * the milestone that first gives organisms energy to spend.
 *
 * **Energy clamps at zero and nothing dies.** M2's population is fixed and
 * immortal on purpose (see the ticket): an organism that cannot afford its
 * own maintenance simply stops there, still diffusing and able to recover
 * if food drifts its way, rather than being removed. Immortality is a
 * clamp on this one line, not an exemption from the cost itself — the full
 * charge is always subtracted before the floor is applied.
 */
export function applyMaintenance(organism: Organism): void {
  const cost = EXISTENCE_COST + BODY_COST_COEFFICIENT * bodyArea(organism);
  organism.energy = Math.max(0, organism.energy - cost);
}
