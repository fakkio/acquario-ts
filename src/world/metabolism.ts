import {K_DIFFUSION} from "./constants";
import type {Environment} from "./environment";
import {bodyArea, type Diffusible, type Organism} from "./organism";

/**
 * The reactions and costs that spend and fill an organism's internal
 * stores. This ticket adds the first of them; photosynthesis, respiration
 * and maintenance land in later M2 tickets. Free functions taking an
 * organism and an `Environment`, in the style M1's `motion.ts` already
 * chose, writing only to the organism they run for.
 */

const DIFFUSIBLES: readonly Diffusible[] = ["oxygen", "carbonDioxide", "food"];

/**
 * Resolve-phase step 2 (ADR-0006): passive exchange, ADR-0003's one signed
 * law over all three diffusibles —
 *
 * `flux = kDiffusion × perimeter × (C_external − C_internal)`
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
