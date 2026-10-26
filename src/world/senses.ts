import type {Environment} from "./environment";
import {energyCap, type Diffusible, type Organism} from "./organism";

/** The concentration `c` read as `c / (1 + c)` (ADR-0037). */
function saturating(c: number): number {
  return c / (1 + c);
}

/**
 * The seven Innate Senses, in `INNATE_SENSES`' order, read from the state the
 * last tick committed (ADR-0031, ADR-0037).
 */
export function readSenses(
  organism: Organism,
  environment: Environment,
  into: number[] = [],
): number[] {
  const area = organism.cytoplasmArea;
  const diffusible = (resource: Diffusible): number =>
    saturating(organism[resource] / area);
  into[0] = Math.min(1, Math.max(0, organism.energy / energyCap(organism)));
  into[1] = diffusible("food");
  into[2] = diffusible("oxygen");
  into[3] = diffusible("carbonDioxide");
  into[4] = environment.light({x: organism.x, y: organism.y});
  into[5] = organism.axis.cos;
  into[6] = organism.axis.sin;
  return into;
}

/**
 * Resolve-phase step 2, the network: runs first, per organism, before
 * exchange is requested, and writes only to its own organism. Reads the
 * senses and sets each thruster's signal to `clamp(drive + Σ w·s, 0, 1)`; an
 * unwired thruster stays at its `drive`, so a body with no synapses is left
 * unchanged.
 */
export function applyNetwork(
  organism: Organism,
  environment: Environment,
): void {
  const signals = readSenses(organism, environment, organism.senses);
  const {thrusterInputs} = organism.network;
  organism.thrusters.forEach(({drive}, i) => {
    let sum = 0;
    for (const {slot, weight} of thrusterInputs[i]) {
      sum += weight * signals[slot];
    }
    organism.thrusterSignals[i] = Math.min(1, Math.max(0, drive + sum));
  });
}
