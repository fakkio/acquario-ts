import {describe, expect, it} from "vitest";

import {BASELINE_BODY_RADIUS} from "./aquarium";
import {DELTA_CYTOPLASM_THICKNESS} from "./constants";
import {
  BASELINE_GENOME,
  birthCostCeiling,
  deriveBody,
  mutateGenome,
  type Genome,
  type OrganelleGene,
} from "./genome";
import {enclosingCircle} from "./layout";
import {bodyAreaOfRadius} from "./organism";
import {createRngStream} from "./rng";

const SAMPLE_SEEDS = 500;

describe("mutateGenome", () => {
  it("mutates cytoplasmThickness by × m or ÷ m with equal probability, m and 1/m both inside [1, 1 + δ]", () => {
    let up = 0;
    let down = 0;

    for (let seed = 0; seed < SAMPLE_SEEDS; seed++) {
      const {genome} = mutateGenome(BASELINE_GENOME, createRngStream(seed), {
        probability: 1,
      });
      const ratio =
        genome.cytoplasmThickness / BASELINE_GENOME.cytoplasmThickness;

      if (ratio > 1) {
        up++;
      } else if (ratio < 1) {
        down++;
      }

      // Symmetric in log space: whichever way the coin fell, the ratio and
      // its reciprocal both sit inside the same magnitude bound. The
      // rejected additive form `1 + (2u−1)·δ` fails this near the bottom of
      // its range — e.g. a ratio of 0.92 has a reciprocal of ~1.087, outside
      // `1 + δ = 1.08`.
      const reciprocalBound = Math.max(ratio, 1 / ratio);
      expect(reciprocalBound).toBeLessThanOrEqual(
        1 + DELTA_CYTOPLASM_THICKNESS + 1e-9,
      );
      expect(reciprocalBound).toBeGreaterThanOrEqual(1);
    }

    // Roughly 50/50 across 500 seeds; loose enough that sampling noise alone
    // cannot flip it, tight enough to catch a direction draw that never
    // fires the other way.
    expect(up).toBeGreaterThan(SAMPLE_SEEDS * 0.35);
    expect(down).toBeGreaterThan(SAMPLE_SEEDS * 0.35);
  });

  it("clamps the two ratio genes to [0, 1] rather than letting them escape it", () => {
    const atFloor: Genome = {...BASELINE_GENOME, mitosisEnergyThreshold: 0};
    const atCeiling: Genome = {...BASELINE_GENOME, childAllocationRatio: 1};

    for (let seed = 0; seed < SAMPLE_SEEDS; seed++) {
      const stream = createRngStream(seed);
      const floorMutation = mutateGenome(atFloor, stream, {probability: 1});
      const ceilingMutation = mutateGenome(atCeiling, stream, {
        probability: 1,
      });

      expect(
        floorMutation.genome.mitosisEnergyThreshold,
      ).toBeGreaterThanOrEqual(0);
      expect(floorMutation.genome.mitosisEnergyThreshold).toBeLessThanOrEqual(
        1,
      );
      expect(
        ceilingMutation.genome.childAllocationRatio,
      ).toBeGreaterThanOrEqual(0);
      expect(ceilingMutation.genome.childAllocationRatio).toBeLessThanOrEqual(
        1,
      );
    }
  });

  it("lets 1.0 be reached and stay reachable, rather than sterilising a lineage (ADR-0002)", () => {
    let reachedOne = false;

    for (let seed = 0; seed < SAMPLE_SEEDS; seed++) {
      const genome: Genome = {...BASELINE_GENOME, mitosisEnergyThreshold: 0.98};
      const {genome: mutated} = mutateGenome(genome, createRngStream(seed), {
        probability: 1,
      });
      if (mutated.mitosisEnergyThreshold === 1) {
        reachedOne = true;
      }
    }

    expect(reachedOne).toBe(true);
  });

  it("wraps lineageHue into [0, 1) rather than clamping, even under a large drift", () => {
    const seen = new Set<number>();

    for (let seed = 0; seed < 50; seed++) {
      const genome: Genome = {...BASELINE_GENOME, lineageHue: 0.5};
      const {genome: mutated} = mutateGenome(genome, createRngStream(seed), {
        probability: 1,
        scale: 1000,
      });

      expect(mutated.lineageHue).toBeGreaterThanOrEqual(0);
      expect(mutated.lineageHue).toBeLessThan(1);
      seen.add(mutated.lineageHue);
    }

    // A clamp would pin every out-of-range draw at 0 or 1 (1 excluded by the
    // interval itself); wrapping instead spreads results across the whole
    // range.
    expect(seen.size).toBeGreaterThan(10);
  });

  it("mutates each gene independently, so some genomes come back exact clones", () => {
    let clones = 0;

    for (let seed = 0; seed < SAMPLE_SEEDS; seed++) {
      const {genome} = mutateGenome(BASELINE_GENOME, createRngStream(seed));
      if (
        genome.cytoplasmThickness === BASELINE_GENOME.cytoplasmThickness &&
        genome.mitosisEnergyThreshold ===
          BASELINE_GENOME.mitosisEnergyThreshold &&
        genome.childAllocationRatio === BASELINE_GENOME.childAllocationRatio &&
        genome.lineageHue === BASELINE_GENOME.lineageHue
      ) {
        clones++;
      }
    }

    expect(clones).toBeGreaterThan(0);
  });

  it("produces the same child genome and stream for the same genome and stream", () => {
    const a = mutateGenome(BASELINE_GENOME, createRngStream(7));
    const b = mutateGenome(BASELINE_GENOME, createRngStream(7));

    expect(a.genome).toEqual(b.genome);
    expect(a.stream).toEqual(b.stream);
  });

  it("advances the stream it was handed rather than reusing its state", () => {
    const stream = createRngStream(7);
    const {stream: advanced} = mutateGenome(BASELINE_GENOME, stream);

    expect(advanced).not.toEqual(stream);
  });
});

describe("birthCostCeiling", () => {
  it("bounds every child the default mutation operator produces, over many streams and parent radii", () => {
    // The guarantee the Worst-Case Birth Gate rests on (ADR-0027), checked
    // where it is made: at default options — an ordinary birth, not
    // generation 0's scaled founder mutation — no child costs more than
    // its parent's ceiling.
    const STREAMS = 20000;
    let tightest = 0;

    for (let seed = 0; seed < STREAMS; seed++) {
      const parent: Genome = {
        ...BASELINE_GENOME,
        cytoplasmThickness: 0.3 + (seed % 100) * 0.03,
      };
      const ceiling = birthCostCeiling(parent);
      const {genome: child} = mutateGenome(parent, createRngStream(seed));
      const childArea = bodyAreaOfRadius(deriveBody(child).radius);

      expect(childArea).toBeLessThanOrEqual(ceiling);
      tightest = Math.max(tightest, childArea / ceiling);
    }

    // Not a ceiling at infinity: the largest children drawn come within a
    // whisker of it, so the gate is not pricing children that never exist.
    expect(tightest).toBeGreaterThan(0.99);
  });

  it("bounds every child of a parent carrying neurons, which it inherits unchanged until #62", () => {
    const STREAMS = 2000;

    for (let seed = 0; seed < STREAMS; seed++) {
      const parent: Genome = {
        ...BASELINE_GENOME,
        cytoplasmThickness: 0.3 + (seed % 50) * 0.05,
        genes: neurons(1 + (seed % 7), 0.05 + (seed % 3) * 0.1),
      };
      const ceiling = birthCostCeiling(parent);
      const {genome: child} = mutateGenome(parent, createRngStream(seed), {
        probability: 1,
      });

      expect(bodyAreaOfRadius(deriveBody(child).radius)).toBeLessThanOrEqual(
        ceiling,
      );
    }
  });

  it("prices v0.1's ceiling exactly for a genome with no organelles", () => {
    const thickness = 1.3;
    expect(
      birthCostCeiling({...BASELINE_GENOME, cytoplasmThickness: thickness}),
    ).toBe(bodyAreaOfRadius(thickness * (1 + DELTA_CYTOPLASM_THICKNESS)));
  });
});

describe("deriveBody", () => {
  it("gives a genome with no organelles a body exactly as thick as its cytoplasm, all of it cytoplasm", () => {
    // v0.1's Minimal Organism, bit for bit: the golden hash rests on these
    // being the same numbers, not close ones.
    for (const cytoplasmThickness of [0.3, 1, 1.4, 2.5]) {
      const body = deriveBody({...BASELINE_GENOME, cytoplasmThickness});

      expect(body.radius).toBe(cytoplasmThickness);
      expect(body.cytoplasmArea).toBe(bodyAreaOfRadius(cytoplasmThickness));
      expect(body.organelles).toEqual([]);
    }
  });

  it("wraps the cytoplasm around the Enclosing Circle of the organelles", () => {
    // Two tangent neurons of radius 0.1 side by side: their Enclosing Circle
    // has radius 0.2, so a thickness of 0.5 gives a body of radius 0.7.
    const body = deriveBody({
      ...BASELINE_GENOME,
      cytoplasmThickness: 0.5,
      genes: [neuron(1, -0.1, 0, 0.1), neuron(2, 0.1, 0, 0.1)],
    });

    expect(body.radius).toBeCloseTo(0.7, 12);
    expect(body.enclosingRadius).toBeCloseTo(0.2, 12);
  });

  it("leaves as cytoplasm the body's area minus every organelle's", () => {
    const body = deriveBody({
      ...BASELINE_GENOME,
      cytoplasmThickness: 0.5,
      genes: [neuron(1, -0.1, 0, 0.1), neuron(2, 0.1, 0, 0.1)],
    });

    expect(body.cytoplasmArea).toBeCloseTo(
      Math.PI * 0.7 * 0.7 - 2 * Math.PI * 0.1 * 0.1,
      12,
    );
  });

  it("centres the organelles on their Enclosing Circle, wherever the genome put them", () => {
    const body = deriveBody({
      ...BASELINE_GENOME,
      genes: [
        neuron(1, 3, 2, 0.1),
        neuron(2, 3.4, 2, 0.2),
        neuron(3, 3, 2.5, 0.05),
      ],
    });
    const circle = enclosingCircle(body.organelles);

    expect(circle.x).toBeCloseTo(0, 12);
    expect(circle.y).toBeCloseTo(0, 12);
  });

  it("relaxes overlapping organelles apart, keeping each one's type, id and radius", () => {
    const genes = [
      neuron(4, 0, 0, 0.2),
      neuron(9, 0.05, 0, 0.15),
      neuron(2, 0, 0.05, 0.1),
    ];
    const {organelles} = deriveBody({...BASELINE_GENOME, genes});
    const identity = ({type, innovationId, radius}: OrganelleGene) => ({
      type,
      innovationId,
      radius,
    });

    expect(organelles.map(identity)).toEqual(genes.map(identity));
    for (let i = 0; i < organelles.length; i++) {
      for (let j = i + 1; j < organelles.length; j++) {
        const a = organelles[i];
        const b = organelles[j];
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(
          a.radius + b.radius - 1e-9,
        );
      }
    }
  });
});

describe("BASELINE_GENOME", () => {
  it("carries the baseline radius as its thickness, and no organelles", () => {
    expect(BASELINE_GENOME.cytoplasmThickness).toBe(BASELINE_BODY_RADIUS);
    expect(BASELINE_GENOME.genes).toEqual([]);
  });
});

function neuron(
  innovationId: number,
  x: number,
  y: number,
  radius: number,
): OrganelleGene {
  return {type: "neuron", innovationId, x, y, radius};
}

/** `count` tangent neurons of one radius in a row, for a parent to carry. */
function neurons(count: number, radius: number): OrganelleGene[] {
  return Array.from({length: count}, (_, i) =>
    neuron(i + 1, i * 2 * radius, 0, radius),
  );
}
