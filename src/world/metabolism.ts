import {K_DIFFUSION, K_PHOTO} from "./constants";
import type {Environment} from "./environment";
import {DIFFUSIBLES, bodyArea, capFor, type Organism} from "./organism";

/**
 * The reactions and costs that spend and fill an organism's internal
 * stores. Passive exchange and photosynthesis land here; respiration and
 * maintenance land in later M2 tickets. Free functions taking an organism
 * and an `Environment`, in the style M1's `motion.ts` already chose,
 * writing only to the organism they run for.
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
