import {
  isSynapseGene,
  type Gene,
  type OrganelleGene,
  type SynapseEndpoint,
} from "./genome";
import {
  BODY_ID,
  INNATE_SENSES,
  type InnateSense,
  type OrganelleTypeDeclaration,
} from "./organelles";

/**
 * One synapse as the tick reads it: the slot of the signal array it reads
 * and its weight. Nothing looks an id up during the tick.
 */
export interface SynapseInput {
  readonly slot: number;
  readonly weight: number;
}

/**
 * The network derived once at birth with the body (ADR-0031): for each
 * thruster in genome order, the synapses into its `power` port in genome order.
 * Slot `i < INNATE_SENSES.length` is that sense's; a synapse whose source or
 * destination names nothing that exists yet (no neuron outputs until later in
 * M11) is left out, as if the gene were absent.
 */
export interface CompiledNetwork {
  readonly thrusterInputs: readonly (readonly SynapseInput[])[];
}

const POWER = "power";

/** The signal slot of a synapse source, or -1 when it names no Innate
 * Sense: the only sources that exist until neurons have outputs. */
export function senseSlot(source: SynapseEndpoint): number {
  return source.id === BODY_ID
    ? INNATE_SENSES.indexOf(source.port as InnateSense)
    : -1;
}

export function compileNetwork(
  genes: readonly Gene[],
  organelles: readonly OrganelleGene[],
  declarations: Readonly<Record<string, OrganelleTypeDeclaration>>,
): CompiledNetwork {
  // The thrusters are the organelles `Body.thrusters` is made of, in the same
  // order: one that declares a thrust and carries an orientation.
  const thrusterIds = organelles
    .filter(
      ({type, orientation}) =>
        declarations[type].thrust !== undefined && orientation !== undefined,
    )
    .map(({innovationId}) => innovationId);
  const thrusterInputs: SynapseInput[][] = thrusterIds.map(() => []);

  for (const gene of genes) {
    if (!isSynapseGene(gene)) {
      continue;
    }
    const {source, destination, weight} = gene;
    const target = thrusterIds.indexOf(destination.id);
    const slot = senseSlot(source);
    if (target >= 0 && destination.port === POWER && slot >= 0) {
      thrusterInputs[target].push({slot, weight});
    }
  }
  return {thrusterInputs};
}
