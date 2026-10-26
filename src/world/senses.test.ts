import {describe, expect, it} from "vitest";

import {BASELINE_BODY_RADIUS} from "./aquarium";
import type {Environment} from "./environment";
import {BASELINE_GENOME, type SynapseGeneDraft} from "./genome";
import {lightAt} from "./light";
import {applyThrustCost} from "./metabolism";
import {BODY_ID, INNATE_SENSES, type InnateSense} from "./organelles";
import {Organism, energyCap} from "./organism";
import {createRngStream} from "./rng";
import {applyNetwork, readSenses} from "./senses";

/** An environment that answers light by depth and never exchanges. */
const environment: Environment = {
  concentration: () => 0,
  light: ({y}) => lightAt(y),
  exchange: () => 0,
};

const thruster = {
  type: "thruster" as const,
  innovationId: 1,
  radius: 0.2,
  x: 0,
  y: 0,
  orientation: {cos: 1, sin: 0},
  drive: 0.5,
};

const reflex = (
  port: InnateSense,
  weight: number,
  innovationId = 2,
): SynapseGeneDraft & {innovationId: number} => ({
  innovationId,
  source: {id: BODY_ID, port},
  destination: {id: 1, port: "power"},
  weight,
});

function bodyWith(
  genes: Organism["genome"]["genes"],
  y = 5,
  init: Partial<ConstructorParameters<typeof Organism>[0]> = {},
): Organism {
  return new Organism({
    x: 10,
    y,
    genome: {
      ...BASELINE_GENOME,
      cytoplasmRadius: BASELINE_BODY_RADIUS,
      genes,
    },
    rng: createRngStream(11),
    ...init,
  });
}

describe("the Innate Senses", () => {
  it("read c/(1+c) of each diffusible's concentration, energy over cap, light at the centre and the axis", () => {
    const organism = bodyWith([], 5, {
      food: 2,
      oxygen: 0.5,
      carbonDioxide: 0,
      axis: {cos: 0.6, sin: 0.8},
    });
    organism.energy = energyCap(organism) / 4;
    const concentration = (store: number) => store / organism.cytoplasmArea;

    const senses = readSenses(organism, environment);

    const expected: Record<InnateSense, number> = {
      energy: 0.25,
      food: concentration(2) / (1 + concentration(2)),
      "O₂": concentration(0.5) / (1 + concentration(0.5)),
      "CO₂": 0,
      light: lightAt(5),
      up: 0.6,
      tilt: 0.8,
    };
    INNATE_SENSES.forEach((name, i) => {
      expect(senses[i]).toBeCloseTo(expected[name], 12);
    });
  });

  it("read 0.5 at a concentration of ρ", () => {
    const organism = bodyWith([]);
    organism.food = organism.cytoplasmArea;

    expect(readSenses(organism, environment)[1]).toBeCloseTo(0.5, 12);
  });

  it("keep the energy sense in [0, 1]", () => {
    const organism = bodyWith([]);
    organism.energy = -1;
    expect(readSenses(organism, environment)[0]).toBe(0);
    organism.energy = 10 * energyCap(organism);
    expect(readSenses(organism, environment)[0]).toBe(1);
  });
});

describe("applyNetwork", () => {
  it("sets a Reflex's thruster to clamp(drive + w·light, 0, 1)", () => {
    const organism = bodyWith([thruster, reflex("light", -0.25)], 3);

    applyNetwork(organism, environment);

    expect(organism.thrusterSignals[0]).toBeCloseTo(
      0.5 - 0.25 * lightAt(3),
      12,
    );
  });

  it("clamps the signal at both ends", () => {
    const high = bodyWith([thruster, reflex("light", 100)]);
    const low = bodyWith([thruster, reflex("light", -100)]);

    applyNetwork(high, environment);
    applyNetwork(low, environment);

    expect(high.thrusterSignals).toEqual([1]);
    expect(low.thrusterSignals).toEqual([0]);
  });

  it("changes the force and the Thrust Cost with depth", () => {
    const shallow = bodyWith([thruster, reflex("light", -0.4)], 1);
    const deep = bodyWith([thruster, reflex("light", -0.4)], 20);
    shallow.energy = deep.energy = 1;

    applyNetwork(shallow, environment);
    applyNetwork(deep, environment);
    applyThrustCost(shallow);
    applyThrustCost(deep);

    expect(deep.thrusterSignals[0]).toBeGreaterThan(shallow.thrusterSignals[0]);
    expect(1 - deep.energy).toBeGreaterThan(1 - shallow.energy);
  });

  it("sums the synapses of an input port in genome order", () => {
    const organism = bodyWith([
      thruster,
      reflex("up", 0.125, 2),
      reflex("tilt", 0.25, 3),
      reflex("up", 0.125, 4),
    ]);

    applyNetwork(organism, environment);

    expect(organism.thrusterSignals[0]).toBeCloseTo(0.5 + 0.125 + 0.125, 12);
  });

  it("leaves an unwired thruster at its drive", () => {
    const organism = bodyWith([
      thruster,
      {...thruster, innovationId: 3, x: 0.5},
      {
        ...reflex("light", 1),
        innovationId: 4,
        destination: {id: 3, port: "power"},
      },
    ]);

    applyNetwork(organism, environment);

    expect(organism.thrusterSignals[0]).toBe(0.5);
    expect(organism.thrusterSignals[1]).not.toBe(0.5);
  });

  it("leaves a body with no synapses unchanged", () => {
    const organism = bodyWith([thruster]);

    applyNetwork(organism, environment);

    expect(organism.thrusterSignals).toEqual([0.5]);
  });

  it("ignores a synapse whose endpoints name nothing that exists", () => {
    const organism = bodyWith([
      thruster,
      {...reflex("light", 1), source: {id: 99, port: "out"}},
      {...reflex("light", 1, 3), destination: {id: 77, port: "power"}},
    ]);

    applyNetwork(organism, environment);

    expect(organism.thrusterSignals).toEqual([0.5]);
  });
});

const neuron = (
  innovationId: number,
  parameters: Partial<{
    tau: number;
    bias: number;
    threshold: number;
    dischargeFactor: number;
  }> = {},
) => ({
  type: "neuron" as const,
  innovationId,
  radius: 0.2,
  x: 0.5 * innovationId,
  y: 0,
  tau: 1,
  bias: 0,
  threshold: 1,
  dischargeFactor: 1,
  ...parameters,
});

const synapse = (
  innovationId: number,
  source: {id: number; port: string},
  destination: {id: number; port: string},
  weight: number,
) => ({innovationId, source, destination, weight});

/** Runs `ticks` ticks and lists the first neuron's memory after each. */
function memoriesOf(organism: Organism, ticks: number): number[] {
  const memories: number[] = [];
  for (let t = 0; t < ticks; t++) {
    applyNetwork(organism, environment);
    memories.push(organism.neuronMemories[0]);
  }
  return memories;
}

describe("a neuron", () => {
  it("with τ = 1, a bias b and no input emits tanh(b)", () => {
    for (const bias of [-2, 0, 0.5, 3]) {
      const organism = bodyWith([neuron(1, {bias, threshold: 4})]);

      applyNetwork(organism, environment);

      expect(organism.neuronSignals[0]).toBeCloseTo(Math.tanh(bias), 12);
    }
  });

  it("settles its memory at a constant input u, for several τ", () => {
    for (const tau of [1, 2, 5, 20]) {
      const organism = bodyWith([neuron(1, {tau, bias: 0.75, threshold: 4})]);

      const memories = memoriesOf(organism, 400);

      expect(memories[399]).toBeCloseTo(0.75, 7);
    }
  });

  it("with τ = 20, threshold 1, discharge 0 and an input of 1.5 resets about every 22 ticks", () => {
    const organism = bodyWith([
      neuron(1, {tau: 20, bias: 1.5, dischargeFactor: 0}),
    ]);

    const resets = memoriesOf(organism, 100)
      .map((memory, t) => (memory === 0 ? t : -1))
      .filter((t) => t >= 0);

    expect(resets.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < resets.length; i++) {
      expect(resets[i] - resets[i - 1]).toBeGreaterThanOrEqual(21);
      expect(resets[i] - resets[i - 1]).toBeLessThanOrEqual(23);
    }
  });

  it("with discharge 1 never resets", () => {
    const organism = bodyWith([
      neuron(1, {tau: 20, bias: 1.5, dischargeFactor: 1}),
    ]);

    const memories = memoriesOf(organism, 200);

    memories.forEach((memory, t) => {
      if (t > 0) {
        expect(memory).toBeGreaterThanOrEqual(memories[t - 1]);
      }
    });
  });

  it("passes a signal across one neuron in one tick, a tick behind a Reflex", () => {
    const light = {id: BODY_ID, port: "light"};
    const viaNeuron = bodyWith(
      [
        thruster,
        neuron(2),
        synapse(3, light, {id: 2, port: "in"}, 0.25),
        synapse(4, {id: 2, port: "out"}, {id: 1, port: "power"}, 1),
      ],
      3,
    );
    const direct = bodyWith([thruster, reflex("light", 0.25)], 3);

    applyNetwork(viaNeuron, environment);
    applyNetwork(direct, environment);
    const first = viaNeuron.thrusterSignals[0];
    applyNetwork(viaNeuron, environment);

    expect(first).toBe(0.5);
    expect(direct.thrusterSignals[0]).toBeCloseTo(0.5 + 0.25 * lightAt(3), 12);
    expect(viaNeuron.thrusterSignals[0]).toBeCloseTo(
      0.5 + Math.tanh(0.25 * lightAt(3)),
      12,
    );
  });

  it("holds either sign once pulsed through a self-synapse of weight 2 (a latch)", () => {
    for (const sign of [1, -1]) {
      const organism = bodyWith([
        neuron(1, {threshold: 4}),
        synapse(2, {id: 1, port: "out"}, {id: 1, port: "in"}, 2),
      ]);
      organism.neuronSignals[0] = 0.1 * sign;

      memoriesOf(organism, 60);

      expect(organism.neuronSignals[0] * sign).toBeGreaterThan(0.95);
    }
  });

  it("reads every other neuron's previous signal, whatever the genome order", () => {
    const organism = bodyWith([
      neuron(1),
      neuron(2, {bias: 1, threshold: 4}),
      synapse(3, {id: 2, port: "out"}, {id: 1, port: "in"}, 1),
    ]);

    applyNetwork(organism, environment);
    expect(organism.neuronSignals[0]).toBe(0);
    applyNetwork(organism, environment);

    expect(organism.neuronSignals[0]).toBeCloseTo(Math.tanh(Math.tanh(1)), 12);
  });

  it("is born with a memory and a signal of 0", () => {
    const organism = bodyWith([neuron(1, {bias: 2}), neuron(2)]);

    expect(organism.neuronMemories).toEqual([0, 0]);
    expect(organism.neuronSignals).toEqual([0, 0]);
  });
});
