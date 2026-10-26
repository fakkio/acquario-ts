import {
  BIAS_NEW,
  DISCHARGE_FACTOR_NEW,
  TAU_NEW,
  THRESHOLD_NEW,
} from "./constants";
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

/** One neuron as the tick reads it (ADR-0037): its parameters, with `decay =
 * 1 − 1/τ` precomputed, and the synapses into its `in` port in genome order. */
export interface CompiledNeuron {
  readonly decay: number;
  readonly bias: number;
  readonly threshold: number;
  readonly dischargeFactor: number;
  readonly inputs: readonly SynapseInput[];
}

/**
 * The network derived once at birth with the body (ADR-0031): for each
 * thruster in genome order, the synapses into its `power` port, and for each
 * neuron in genome order, its parameters and the synapses into its `in`
 * port, both in genome order. Slot `i < INNATE_SENSES.length` is that sense's
 * and slot `INNATE_SENSES.length + n` is the `n`th neuron's `out`. A synapse
 * whose source or destination names nothing that exists is left out, as if
 * the gene were absent.
 */
export interface CompiledNetwork {
  readonly thrusterInputs: readonly (readonly SynapseInput[])[];
  readonly neurons: readonly CompiledNeuron[];
}

const POWER = "power";
const IN = "in";
const OUT = "out";

/** The slot of the first neuron's `out`, right after the senses. */
export const NEURON_SLOT_BASE = INNATE_SENSES.length;

/** The signal slot of a synapse source that names an Innate Sense, or -1:
 * a neuron's `out` has a slot only within the network it belongs to
 * (`compileNetwork`). */
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
  const neuronGenes = organelles.filter(
    ({type}) => declarations[type].outputPorts?.includes(OUT) ?? false,
  );
  const neuronIds = neuronGenes.map(({innovationId}) => innovationId);
  const thrusterInputs: SynapseInput[][] = thrusterIds.map(() => []);
  const neuronInputs: SynapseInput[][] = neuronIds.map(() => []);

  const slotOf = (source: SynapseEndpoint): number => {
    if (source.id === BODY_ID) {
      return senseSlot(source);
    }
    const neuron = neuronIds.indexOf(source.id);
    return neuron >= 0 && source.port === OUT ? NEURON_SLOT_BASE + neuron : -1;
  };

  for (const gene of genes) {
    if (!isSynapseGene(gene)) {
      continue;
    }
    const {source, destination, weight} = gene;
    const slot = slotOf(source);
    if (slot < 0) {
      continue;
    }
    const thruster = thrusterIds.indexOf(destination.id);
    if (thruster >= 0 && destination.port === POWER) {
      thrusterInputs[thruster].push({slot, weight});
    }
    const neuron = neuronIds.indexOf(destination.id);
    if (neuron >= 0 && destination.port === IN) {
      neuronInputs[neuron].push({slot, weight});
    }
  }

  return {
    thrusterInputs,
    neurons: neuronGenes.map((gene, i) => ({
      decay: 1 - 1 / (gene.tau ?? TAU_NEW),
      bias: gene.bias ?? BIAS_NEW,
      threshold: gene.threshold ?? THRESHOLD_NEW,
      dischargeFactor: gene.dischargeFactor ?? DISCHARGE_FACTOR_NEW,
      inputs: neuronInputs[i],
    })),
  };
}
