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
