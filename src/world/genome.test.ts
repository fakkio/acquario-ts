import {describe, expect, it} from "vitest";

import {BASELINE_BODY_RADIUS} from "./aquarium";
import {DELTA_BODY_RADIUS} from "./constants";
import {
  BASELINE_GENOME,
  birthCostCeiling,
  mutateGenome,
  type Genome,
} from "./genome";
import {bodyAreaOfRadius} from "./organism";
import {createRngStream} from "./rng";

const SAMPLE_SEEDS = 500;

describe("mutateGenome", () => {
  it("mutates bodyRadius by × m or ÷ m with equal probability, m and 1/m both inside [1, 1 + δ]", () => {
    let up = 0;
    let down = 0;

    for (let seed = 0; seed < SAMPLE_SEEDS; seed++) {
      const {genome} = mutateGenome(BASELINE_GENOME, createRngStream(seed), {
        probability: 1,
      });
      const ratio = genome.bodyRadius / BASELINE_GENOME.bodyRadius;

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
      expect(reciprocalBound).toBeLessThanOrEqual(1 + DELTA_BODY_RADIUS + 1e-9);
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
        genome.bodyRadius === BASELINE_GENOME.bodyRadius &&
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
        bodyRadius: 0.3 + (seed % 100) * 0.03,
      };
      const ceiling = birthCostCeiling(parent);
      const {genome: child} = mutateGenome(parent, createRngStream(seed));
      const childArea = bodyAreaOfRadius(child.bodyRadius);

      expect(childArea).toBeLessThanOrEqual(ceiling);
      tightest = Math.max(tightest, childArea / ceiling);
    }

    // Not a ceiling at infinity: the largest children drawn come within a
    // whisker of it, so the gate is not pricing children that never exist.
    expect(tightest).toBeGreaterThan(0.99);
  });
});

describe("BASELINE_GENOME", () => {
  it("carries the baseline radius", () => {
    expect(BASELINE_GENOME.bodyRadius).toBe(BASELINE_BODY_RADIUS);
  });
});
