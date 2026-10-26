import {describe, expect, it} from "vitest";

import {BASELINE_BODY_RADIUS} from "./aquarium";
import {R_MIN} from "./constants";
import type {Environment} from "./environment";
import {
  BASELINE_GENOME,
  mintInnovationIds,
  mutateGenome,
  type Gene,
  type Genome,
  type OrganelleGene,
  type SynapseEndpoint,
} from "./genome";
import {BODY_ID, INNATE_SENSES} from "./organelles";
import {Organism} from "./organism";
import {createRngStream} from "./rng";
import {applyNetwork} from "./senses";

// A neuron's split is neutral: exact in arithmetic, since a copied incoming
// synapse feeds both pieces the sum the original had and the divided outgoing
// ones add back to `w`. In floating point `f·w·s + (1−f)·w·s` differs from
// `w·s` in its last ulp, a recurrent network can amplify that, and an ulp
// either side of a threshold would make one piece fire a tick before the
// original. So the invariant is checked within 1e-9, over a finite horizon,
// and the discharging networks keep every threshold a margin from its memory.
const TICKS = 500;
const TOLERANCE = 1e-9;
const MARGIN = 1e-3;

/** An environment whose light is scripted by `tick` and whose other senses
 * are constant, so the network is the only thing that varies. */
function scripted(): Environment & {tick: number} {
  const environment = {
    tick: 0,
    concentration: () => 0,
    light: () => 0.5 + 0.5 * Math.sin(environment.tick * 0.37),
    exchange: () => 0,
  };
  return environment;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A thruster too small to split, so only a neuron can be a split's target. */
const thruster: OrganelleGene = {
  type: "thruster",
  innovationId: 1,
  radius: R_MIN,
  x: 0,
  y: 0,
  orientation: {cos: 1, sin: 0},
  drive: 0.5,
};

type Port = SynapseEndpoint;

function randomNetwork(seed: number, discharge: boolean): Genome {
  const random = mulberry32(seed);
  const count = 2 + Math.floor(random() * 3);
  const neurons: OrganelleGene[] = Array.from({length: count}, (_, i) => ({
    type: "neuron",
    innovationId: 2 + i,
    radius: 0.2,
    x: 0.5 * (i + 1),
    y: 0,
    tau: [1, 2, 5][Math.floor(random() * 3)],
    bias: (random() - 0.5) * 2,
    threshold: discharge ? 0.5 + random() : 4,
    dischargeFactor: discharge ? 0.5 * random() : 1,
  }));
  const sources: Port[] = [
    ...INNATE_SENSES.map((port) => ({id: BODY_ID, port})),
    ...neurons.map(({innovationId}) => ({id: innovationId, port: "out"})),
  ];
  const destinations: Port[] = [
    {id: 1, port: "power"},
    ...neurons.map(({innovationId}) => ({id: innovationId, port: "in"})),
  ];
  const wires: Gene[] = [];
  const wire = (source: Port, destination: Port) =>
    wires.push({
      innovationId: 100 + wires.length,
      source,
      destination,
      // Into the thruster the weights are small, or its clamp would hide
      // the very differences the test looks for.
      weight: (random() - 0.5) * (destination.id === 1 ? 0.4 : 4),
    });
  for (let i = 0; i < 4 + count * 3; i++) {
    wire(
      sources[Math.floor(random() * sources.length)],
      destinations[Math.floor(random() * destinations.length)],
    );
  }
  // A self-synapse on every neuron and a ring through them, so cycles are
  // always present, and a neuron wired to the thruster.
  neurons.forEach(({innovationId}, i) => {
    wire({id: innovationId, port: "out"}, {id: innovationId, port: "in"});
    wire(
      {id: innovationId, port: "out"},
      {id: neurons[(i + 1) % count].innovationId, port: "in"},
    );
  });
  wire({id: neurons[0].innovationId, port: "out"}, destinations[0]);
  return {...BASELINE_GENOME, genes: [thruster, ...neurons, ...wires]};
}

function bodyOf(genome: Genome): Organism {
  return new Organism({
    x: 10,
    y: 5,
    genome: {...genome, cytoplasmRadius: BASELINE_BODY_RADIUS},
    rng: createRngStream(11),
  });
}

function splitOf(genome: Genome, seed: number): Genome {
  const {genome: split} = mutateGenome(genome, createRngStream(seed), {
    roster: [],
    eventProbability: 1,
    operatorWeights: {
      parameterChange: 0,
      insertion: 0,
      deletion: 0,
      split: 1,
      weightChange: 0,
      synapseInsertion: 0,
    },
  });
  return mintInnovationIds(split, 1000).genome;
}

/** Steps both side by side: the largest gap between their thruster signals,
 * and the smallest distance of any discharging memory from its threshold. */
function run(genome: Genome, split: Genome) {
  const [a, b] = [bodyOf(genome), bodyOf(split)];
  const [ea, eb] = [scripted(), scripted()];
  let gap = 0;
  let margin = Infinity;
  let low = Infinity;
  let high = -Infinity;
  for (let t = 0; t < TICKS; t++) {
    ea.tick = eb.tick = t;
    applyNetwork(a, ea);
    applyNetwork(b, eb);
    gap = Math.max(gap, Math.abs(a.thrusterSignals[0] - b.thrusterSignals[0]));
    low = Math.min(low, a.thrusterSignals[0]);
    high = Math.max(high, a.thrusterSignals[0]);
    a.network.neurons.forEach(({threshold, dischargeFactor}, i) => {
      if (dischargeFactor < 1) {
        // The signal is tanh of the memory before any discharge, which the
        // stored memory has already been scaled down from.
        const before = Math.atanh(a.neuronSignals[i]);
        margin = Math.min(margin, Math.abs(before - threshold));
      }
    });
  }
  return {gap, margin, spread: high - low};
}

describe("a neuron split is neutral (M11's invariant)", () => {
  it("leaves the thruster's signal unchanged for random recurrent networks, self-synapses included", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const genome = randomNetwork(seed, false);
      const split = splitOf(genome, seed);
      expect(split.genes.length).toBeGreaterThan(genome.genes.length);

      const {gap, spread} = run(genome, split);
      // The signal moves, so equality is not the vacuous equality of a
      // thruster clamped at 0 or 1.
      expect(spread).toBeGreaterThan(1e-3);
      expect(gap).toBeLessThan(TOLERANCE);
    }
  });

  it("holds for discharging networks whose thresholds keep a margin from the memory", () => {
    let checked = 0;
    for (let seed = 1; seed <= 400 && checked < 15; seed++) {
      const genome = randomNetwork(seed, true);
      const split = splitOf(genome, seed);
      const {gap, margin, spread} = run(genome, split);
      // A network that comes within the margin of a threshold is no
      // candidate: there one ulp could decide the tick a piece discharges.
      if (margin < MARGIN) {
        continue;
      }
      if (spread < 1e-3) {
        continue;
      }
      checked++;
      expect(gap).toBeLessThan(TOLERANCE);
    }
    expect(checked).toBeGreaterThanOrEqual(15);
  });
});
