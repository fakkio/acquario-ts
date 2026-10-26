import type {Environment} from "./environment";
import {NEURON_SLOT_BASE} from "./network";
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
 * senses and the neurons' signals of the last tick, and:
 *
 * - sets each thruster's signal to `clamp(drive + Σ w·s, 0, 1)`; an unwired
 *   thruster stays at its `drive`, so a body with no synapses is left
 *   unchanged. A thruster wired from a neuron reads its previous-tick signal;
 * - updates each neuron from the previous tick's signals only (ADR-0037):
 *   `memory ← decay·memory + (1 − decay)·(bias + Σ w·s)`, `signal =
 *   tanh(memory)`, then a memory at or past `threshold` is multiplied by
 *   `dischargeFactor`. Neurons pay no activity cost.
 */
export function applyNetwork(
  organism: Organism,
  environment: Environment,
): void {
  readSenses(organism, environment, organism.senses);
  const {senses, neuronSignals, neuronMemories, neuronSums} = organism;
  const read = (slot: number): number =>
    slot < NEURON_SLOT_BASE
      ? senses[slot]
      : neuronSignals[slot - NEURON_SLOT_BASE];
  const {thrusterInputs, neurons} = organism.network;

  organism.thrusters.forEach(({drive}, i) => {
    let sum = 0;
    for (const {slot, weight} of thrusterInputs[i]) {
      sum += weight * read(slot);
    }
    organism.thrusterSignals[i] = Math.min(1, Math.max(0, drive + sum));
  });

  // Every sum reads the previous signals before any neuron writes its own.
  neurons.forEach(({bias, inputs}, i) => {
    let sum = bias;
    for (const {slot, weight} of inputs) {
      sum += weight * read(slot);
    }
    neuronSums[i] = sum;
  });
  neurons.forEach(({decay, threshold, dischargeFactor}, i) => {
    const memory = decay * neuronMemories[i] + (1 - decay) * neuronSums[i];
    neuronSignals[i] = Math.tanh(memory);
    neuronMemories[i] = memory >= threshold ? memory * dischargeFactor : memory;
  });
}
