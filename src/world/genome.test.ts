import {describe, expect, it} from "vitest";

import {BASELINE_BODY_RADIUS} from "./aquarium";
import {
  DELTA_CYTOPLASM_RADIUS,
  DELTA_WEIGHT,
  WEIGHT_MAX,
  DELTA_DRIVE,
  DRIVE_NEW,
  EPSILON_ORIENTATION,
  DELTA_ORGANELLE_POSITION,
  DELTA_ORGANELLE_RADIUS,
  MAX_STRUCTURAL_EVENTS,
  R_MIN,
  R_NEW,
  SPLIT_HALF_WIDTH,
} from "./constants";
import {
  BASELINE_GENOME,
  birthCostCeiling,
  deriveBody,
  mintInnovationIds,
  mutateGenome,
  OPERATOR_WEIGHTS,
  organelleGenes,
  type Genome,
  type MutationOptions,
  type OperatorWeights,
  type OrganelleGene,
  type SynapseGene,
} from "./genome";
import {BODY_ID, DEFAULT_ROSTER, INNATE_SENSES} from "./organelles";
import {FIRST_INNOVATION_ID, bodyAreaOfRadius} from "./organism";
import {createRngStream, nextRng} from "./rng";

const SAMPLE_SEEDS = 500;

describe("mutateGenome", () => {
  it("mutates cytoplasmRadius by × m or ÷ m with equal probability, m and 1/m both inside [1, 1 + δ]", () => {
    let up = 0;
    let down = 0;

    for (let seed = 0; seed < SAMPLE_SEEDS; seed++) {
      const {genome} = mutateGenome(BASELINE_GENOME, createRngStream(seed), {
        probability: 1,
      });
      const ratio = genome.cytoplasmRadius / BASELINE_GENOME.cytoplasmRadius;

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
        1 + DELTA_CYTOPLASM_RADIUS + 1e-9,
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
        genome.cytoplasmRadius === BASELINE_GENOME.cytoplasmRadius &&
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
        cytoplasmRadius: 0.3 + (seed % 100) * 0.03,
      };
      const ceiling = birthCostCeiling(parent, []);
      const {genome: child} = mutateGenome(parent, createRngStream(seed));
      const childArea = bodyAreaOfRadius(deriveBody(child).radius);

      expect(childArea).toBeLessThanOrEqual(ceiling);
      tightest = Math.max(tightest, childArea / ceiling);
    }

    // Not a ceiling at infinity: the largest children drawn come within a
    // whisker of it, so the gate is not pricing children that never exist.
    expect(tightest).toBeGreaterThan(0.99);
  });

  it("prices v0.1's ceiling exactly for a genome with no organelles and an empty roster", () => {
    const thickness = 1.3;
    const v01 = bodyAreaOfRadius(thickness * (1 + DELTA_CYTOPLASM_RADIUS));
    const genome = {...BASELINE_GENOME, cytoplasmRadius: thickness};

    expect(birthCostCeiling(genome, [])).toBe(v01);
  });

  it("prices an empty body's insertion by the body it is born in", () => {
    // ADR-0036: the area term is the cytoplasm at its largest step plus the
    // new organelle's area, and the reach cannot pass it.
    const radius = 0.8;
    const cytoplasm = bodyAreaOfRadius(radius * (1 + DELTA_CYTOPLASM_RADIUS));
    const ceiling = birthCostCeiling(
      {...BASELINE_GENOME, cytoplasmRadius: radius},
      ["neuron"],
    );

    expect(ceiling).toBeGreaterThanOrEqual(cytoplasm + bodyAreaOfRadius(R_NEW));
    if (MAX_STRUCTURAL_EVENTS === 1) {
      expect(ceiling).toBeCloseTo(cytoplasm + bodyAreaOfRadius(R_NEW), 12);
    }
  });

  it("counts only the operators with a target: no insertion with an empty roster, no split of an organelle too small to split", () => {
    // A neuron at r_new splits into a piece below r_min, so it is no split
    // target; with an empty roster nothing is inserted. What is left is its
    // radius step and its position step, and the radius step adds the area.
    const radius = R_NEW;
    const genome: Genome = {
      ...BASELINE_GENOME,
      genes: [neuron(1, 0, 0, radius)],
    };
    const cytoplasm = bodyAreaOfRadius(
      BASELINE_GENOME.cytoplasmRadius * (1 + DELTA_CYTOPLASM_RADIUS),
    );
    const grown =
      radius * (1 + DELTA_ORGANELLE_RADIUS) ** MAX_STRUCTURAL_EVENTS;

    expect(birthCostCeiling(genome, [])).toBeCloseTo(
      cytoplasm + bodyAreaOfRadius(grown),
      12,
    );
    // The same neuron in a body that can receive one prices the insertion.
    expect(birthCostCeiling(genome, ["neuron"])).toBeGreaterThan(
      birthCostCeiling(genome, []),
    );
  });

  it("prices an organelle past the cytoplasm by its reach, not its area", () => {
    // A lone neuron far out in a thin body: the reach term dominates, and an
    // event can push it out by its own step.
    const radius = 0.1;
    const genome: Genome = {
      ...BASELINE_GENOME,
      cytoplasmRadius: 0.3,
      genes: [neuron(1, 2, 0, radius)],
    };
    const reachNow = 2 + radius;

    expect(birthCostCeiling(genome, [])).toBeGreaterThan(
      bodyAreaOfRadius(reachNow),
    );
    expect(birthCostCeiling(genome, [])).toBeLessThanOrEqual(
      bodyAreaOfRadius(
        reachNow +
          MAX_STRUCTURAL_EVENTS *
            (2 * radius + DELTA_ORGANELLE_POSITION * radius) *
            (1 + DELTA_ORGANELLE_RADIUS) ** MAX_STRUCTURAL_EVENTS,
      ),
    );
  });
});

describe("mutateGenome's structural events", () => {
  it("consumes no draws at all with an empty roster and no organelles", () => {
    for (let seed = 0; seed < 50; seed++) {
      const stream = createRngStream(seed);
      const headerOnly = mutateGenome(BASELINE_GENOME, stream);
      const structural = mutateGenome(BASELINE_GENOME, stream, {roster: []});

      expect(structural).toEqual(headerOnly);
    }
  });

  it("draws its events after the header, leaving the header's own draws where they were", () => {
    const parent: Genome = {
      ...BASELINE_GENOME,
      genes: [neuron(1, 0, 0, 0.2)],
    };

    for (let seed = 0; seed < 50; seed++) {
      const stream = createRngStream(seed);
      const headerOnly = mutateGenome(parent, stream, {probability: 1});
      const structural = mutateGenome(parent, stream, {
        probability: 1,
        roster: ["neuron"],
      });

      expect(headerOf(structural.genome)).toEqual(headerOf(headerOnly.genome));
      // At least the `M_max` Binomial trials, whatever they draw.
      expect(structural.stream).not.toEqual(headerOnly.stream);
    }
  });

  it("draws events for a body with organelles even when the roster is empty", () => {
    const parent: Genome = {
      ...BASELINE_GENOME,
      genes: [neuron(1, 0, 0, 0.2)],
    };
    const stream = createRngStream(3);

    expect(mutateGenome(parent, stream, {roster: []}).stream).not.toEqual(
      mutateGenome(parent, stream).stream,
    );
  });

  it("hands back the parent's genes untouched when no event happens", () => {
    const parent: Genome = {
      ...BASELINE_GENOME,
      genes: [neuron(1, -0.3, 0, 0.2), neuron(2, 0.3, 0, 0.2)],
    };

    for (let seed = 0; seed < 50; seed++) {
      const {genome} = mutateGenome(parent, createRngStream(seed), {
        roster: ["neuron"],
        eventProbability: 0,
      });
      expect(genome.genes).toBe(parent.genes);
    }
  });

  it("produces the same child for the same genome, stream and roster", () => {
    const parent = hostileGenomes()[2].genome;
    const options: MutationOptions = {roster: ["neuron"], eventProbability: 1};

    expect(mutateGenome(parent, createRngStream(5), options)).toEqual(
      mutateGenome(parent, createRngStream(5), options),
    );
  });

  describe("insertion", () => {
    // Pins the fixed order of draws (ADR-0036): the header's four, the
    // event trials, the operator, the type, and only then the position.
    it.runIf(MAX_STRUCTURAL_EVENTS === 1)(
      "draws the type before the position, the position after the body's new radius is known",
      () => {
        for (let seed = 0; seed < 20; seed++) {
          let stream = createRngStream(seed);
          const unit = (): number => {
            const draw = nextRng(stream);
            stream = draw.stream;
            return draw.value;
          };
          // Header (4), trials (M_max = 1), operator, type index.
          for (let i = 0; i < 4 + MAX_STRUCTURAL_EVENTS + 2; i++) {
            unit();
          }
          const point = (): {x: number; y: number} => {
            const x = unit() * 2 - 1;
            const y = unit() * 2 - 1;
            return x * x + y * y > 1 ? point() : {x, y};
          };
          const {x: px, y: py} = point();

          const {genome} = mutateGenome(
            BASELINE_GENOME,
            createRngStream(seed),
            {
              probability: 0,
              roster: ["neuron"],
              eventProbability: 1,
              operatorWeights: only("insertion"),
            },
          );
          const within =
            Math.sqrt(
              (bodyAreaOfRadius(BASELINE_GENOME.cytoplasmRadius) +
                bodyAreaOfRadius(R_NEW)) /
                Math.PI,
            ) - R_NEW;

          expect(organelleGenes(genome.genes)[0].x).toBeCloseTo(
            px * within,
            12,
          );
          expect(organelleGenes(genome.genes)[0].y).toBeCloseTo(
            py * within,
            12,
          );
        }
      },
    );

    it("adds organelles of radius r_new and a type from the roster, under provisional ids of their own", () => {
      for (let seed = 0; seed < 100; seed++) {
        const {genome} = mutateGenome(BASELINE_GENOME, createRngStream(seed), {
          roster: ["neuron"],
          eventProbability: 1,
          operatorWeights: only("insertion"),
        });

        expect(genome.genes).toHaveLength(MAX_STRUCTURAL_EVENTS);
        for (const gene of organelleGenes(genome.genes)) {
          expect(gene.type).toBe("neuron");
          expect(gene.radius).toBe(R_NEW);
          expect(gene.innovationId).toBeLessThan(0);
        }
        const ids = new Set(genome.genes.map((gene) => gene.innovationId));
        expect(ids.size).toBe(genome.genes.length);
      }
    });

    it("places an empty body's first organelle off its centre, inside the body it grows", () => {
      // Two trials at p = 0.5: some seeds draw exactly one event.
      let seen = 0;
      let offCentre = 0;
      for (let seed = 0; seed < 100; seed++) {
        const {genome} = mutateGenome(BASELINE_GENOME, createRngStream(seed), {
          roster: ["neuron"],
          eventProbability: 0.5,
          operatorWeights: only("insertion"),
        });
        if (genome.genes.length === 1) {
          seen++;
          const [gene] = organelleGenes(genome.genes);
          const body = deriveBody(genome);
          expect(body.radius).toBeCloseTo(
            Math.sqrt(
              (bodyAreaOfRadius(genome.cytoplasmRadius) +
                bodyAreaOfRadius(R_NEW)) /
                Math.PI,
            ),
            12,
          );
          expect(Math.hypot(gene.x, gene.y) + gene.radius).toBeLessThanOrEqual(
            body.radius + 1e-12,
          );
          if (Math.hypot(gene.x, gene.y) > 1e-6) {
            offCentre++;
          }
        }
      }
      expect(seen).toBeGreaterThan(0);
      expect(offCentre).toBe(seen);
    });

    it("lands inside the body it is born in, spread across it", () => {
      // Two neurons far apart: the body is already as wide as their reach,
      // so an insertion lands anywhere in that disc, and nowhere outside it
      // but by relaxation's slide.
      const parent: Genome = {
        ...BASELINE_GENOME,
        genes: [neuron(1, -1, 0, 0.1), neuron(2, 1, 0, 0.1)],
      };
      const bodyRadius = 1.1;
      let farthest = 0;

      for (let seed = 0; seed < 300; seed++) {
        const {genome} = mutateGenome(parent, createRngStream(seed), {
          roster: ["neuron"],
          eventProbability: 1,
          operatorWeights: only("insertion"),
        });
        for (const gene of organelleGenes(genome.genes).slice(2)) {
          const edge = Math.hypot(gene.x, gene.y) + gene.radius;
          // Relaxation may slide an organelle that landed on another out
          // past the old reach, by no more than its own diameter.
          expect(edge).toBeLessThanOrEqual(bodyRadius + 2 * R_NEW);
          farthest = Math.max(farthest, edge);
        }
      }
      expect(farthest).toBeGreaterThan(0.8 * bodyRadius);
    });

    it("never happens with an empty roster", () => {
      const parent = hostileGenomes()[2].genome;
      for (let seed = 0; seed < 50; seed++) {
        const {genome} = mutateGenome(parent, createRngStream(seed), {
          roster: [],
          eventProbability: 1,
          operatorWeights: only("insertion"),
        });
        expect(genome.genes).toBe(parent.genes);
      }
    });
  });

  describe("deletion", () => {
    it("removes one whole gene per event, any of them", () => {
      const parent: Genome = {
        ...BASELINE_GENOME,
        genes: [
          neuron(1, -0.4, 0, 0.1),
          neuron(2, 0, 0, 0.2),
          neuron(3, 0.4, 0, 0.1),
        ],
      };
      const survivors = new Set<number>();

      for (let seed = 0; seed < 100; seed++) {
        const {genome} = mutateGenome(parent, createRngStream(seed), {
          roster: [],
          eventProbability: 1,
          operatorWeights: only("deletion"),
        });

        expect(genome.genes).toHaveLength(
          parent.genes.length - MAX_STRUCTURAL_EVENTS,
        );
        for (const gene of organelleGenes(genome.genes)) {
          const original = organelleGenes(parent.genes).find(
            (candidate) => candidate.innovationId === gene.innovationId,
          );
          expect(gene.radius).toBe(original?.radius);
          survivors.add(gene.innovationId);
        }
      }
      expect(survivors.size).toBe(parent.genes.length);
    });
  });

  describe("split", () => {
    // A neuron just large enough to split, whose pieces are both too small
    // to split again: exactly one split per child, whatever the stream.
    const SPLITTABLE_ONCE = 0.06;

    it("divides one organelle into pieces of areas f·A and (1−f)·A, f on the bell [0.5 − w, 0.5 + w]", () => {
      const parent: Genome = {
        ...BASELINE_GENOME,
        genes: [neuron(7, 0, 0, SPLITTABLE_ONCE)],
      };
      const area = SPLITTABLE_ONCE * SPLITTABLE_ONCE;
      const STREAMS = 400;
      let central = 0;

      for (let seed = 0; seed < STREAMS; seed++) {
        const {genome} = mutateGenome(parent, createRngStream(seed), {
          roster: [],
          eventProbability: 1,
          operatorWeights: only("split"),
        });
        const [first, second] = organelleGenes(genome.genes);
        const f = (first.radius * first.radius) / area;

        expect(genome.genes).toHaveLength(2);
        expect(first.radius ** 2 + second.radius ** 2).toBeCloseTo(area, 15);
        expect(f).toBeGreaterThanOrEqual(0.5 - SPLIT_HALF_WIDTH);
        expect(f).toBeLessThanOrEqual(0.5 + SPLIT_HALF_WIDTH);
        if (Math.abs(f - 0.5) < SPLIT_HALF_WIDTH / 2) {
          central++;
        }
      }
      // A triangular bell puts three quarters of its mass in the central
      // half of its range, a uniform draw only half.
      expect(central / STREAMS).toBeGreaterThan(0.68);
    });

    it("keeps the original's id on the first piece and gives the second a new one, right after it", () => {
      const parent: Genome = {
        ...BASELINE_GENOME,
        genes: [neuron(7, -0.5, 0, SPLITTABLE_ONCE), neuron(9, 0.5, 0, R_NEW)],
      };

      for (let seed = 0; seed < 50; seed++) {
        const {genome} = mutateGenome(parent, createRngStream(seed), {
          roster: [],
          eventProbability: 1,
          operatorWeights: only("split"),
        });
        const [first, second, third] = organelleGenes(genome.genes);

        expect(genome.genes).toHaveLength(3);
        expect(first.innovationId).toBe(7);
        expect(second.innovationId).toBeLessThan(0);
        expect(third.innovationId).toBe(9);
      }
    });

    it("finds no target in an organelle whose smaller piece would fall below r_min", () => {
      // At r_new the smaller piece's radius is r_new·√(0.5 − w) < r_min.
      const parent: Genome = {
        ...BASELINE_GENOME,
        genes: [neuron(1, 0, 0, R_NEW)],
      };

      for (let seed = 0; seed < 50; seed++) {
        const {genome} = mutateGenome(parent, createRngStream(seed), {
          roster: [],
          eventProbability: 1,
          operatorWeights: only("split"),
        });
        expect(genome.genes).toBe(parent.genes);
      }
    });
  });

  describe("parameter change", () => {
    it("moves a radius by × m or ÷ m, m inside [1, 1 + δ], clamped up to r_min and never below it", () => {
      const parent: Genome = {
        ...BASELINE_GENOME,
        genes: [neuron(1, -0.5, 0, R_MIN), neuron(2, 0.5, 0, 0.2)],
      };
      let clamped = 0;

      for (let seed = 0; seed < 400; seed++) {
        const {genome} = mutateGenome(parent, createRngStream(seed), {
          roster: [],
          eventProbability: 1,
          operatorWeights: only("parameterChange"),
        });
        const [floor, large] = organelleGenes(genome.genes);
        const ratio = large.radius / 0.2;

        expect(floor.radius).toBeGreaterThanOrEqual(R_MIN);
        if (floor.radius === R_MIN) {
          clamped++;
        }
        expect(Math.max(ratio, 1 / ratio)).toBeLessThanOrEqual(
          (1 + DELTA_ORGANELLE_RADIUS) ** MAX_STRUCTURAL_EVENTS + 1e-12,
        );
      }
      // Most children keep the floor neuron at the floor: untouched, or
      // shrunk and clamped back.
      expect(clamped).toBeGreaterThan(200);
    });

    it("steps a position by at most δ_pos of the organelle's own radius", () => {
      // Two neurons far apart: no relaxation moves them, so the distance
      // between them changes only by the steps themselves.
      const radius = 0.2;
      const parent: Genome = {
        ...BASELINE_GENOME,
        genes: [neuron(1, -1, 0, radius), neuron(2, 1, 0, radius)],
      };
      let moved = 0;

      for (let seed = 0; seed < 1000; seed++) {
        const {genome} = mutateGenome(parent, createRngStream(seed), {
          roster: [],
          eventProbability: 1,
          operatorWeights: only("parameterChange"),
        });
        const [left, right] = organelleGenes(genome.genes);
        const change = Math.abs(
          Math.hypot(left.x - right.x, left.y - right.y) - 2,
        );

        // A radius step before a position step lets that one reach
        // δ_pos·r·(1 + δ_size).
        expect(change).toBeLessThanOrEqual(
          MAX_STRUCTURAL_EVENTS *
            DELTA_ORGANELLE_POSITION *
            radius *
            (1 + DELTA_ORGANELLE_RADIUS) +
            1e-12,
        );
        if (change > 1e-9) {
          moved++;
        }
      }
      expect(moved).toBeGreaterThan(100);
    });
  });
});

describe("the structural mutation law's invariant (ADR-0028, ADR-0034)", () => {
  // Every child of every hostile parent, under every mix of operators, fits
  // its parent's Birth Cost Ceiling, with a layout that has no overlaps,
  // holds every organelle inside its body, and keeps every radius at or above
  // the floor; a split, wherever it happens, conserves area.
  const MIXES: readonly {
    readonly name: string;
    readonly options: Omit<MutationOptions, "roster">;
  }[] = [
    {name: "the default law", options: {}},
    {name: "every trial an event", options: {eventProbability: 1}},
    ...(
      [
        "parameterChange",
        "insertion",
        "deletion",
        "split",
        "weightChange",
        "synapseInsertion",
      ] as const
    ).map((operator) => ({
      name: `only ${operator}`,
      options: {eventProbability: 1, operatorWeights: only(operator)},
    })),
  ];
  const STREAMS = 150;

  for (const {name: genomeName, genome: parent} of hostileGenomes()) {
    for (const roster of [["neuron"], []] as const) {
      it(`holds for ${genomeName}, roster [${roster.join(", ")}]`, () => {
        const ceiling = birthCostCeiling(parent, roster);

        for (const {name: mixName, options} of MIXES) {
          for (let seed = 0; seed < STREAMS; seed++) {
            const {genome: child} = mutateGenome(
              parent,
              createRngStream(seed),
              {...options, roster},
            );
            const where = `${mixName}, seed ${String(seed)}`;

            expect(
              bodyAreaOfRadius(deriveBody(child).radius),
              where,
            ).toBeLessThanOrEqual(ceiling);
            expect(
              deepestOverlap(organelleGenes(child.genes)),
              where,
            ).toBeLessThanOrEqual(1e-9);
            for (const gene of organelleGenes(child.genes)) {
              expect(gene.radius, where).toBeGreaterThanOrEqual(R_MIN);
            }
            expect(deriveBody(child).radius, where).toBeGreaterThanOrEqual(
              deriveBody(child).reach,
            );
            if (mixName === "only split") {
              expect(organelleArea(child), where).toBeCloseTo(
                organelleArea(parent),
                12,
              );
            }
          }
        }
      });
    }
  }
});

describe("deriveBody", () => {
  it("gives a genome with no organelles a body exactly as thick as its cytoplasm, all of it cytoplasm", () => {
    // v0.1's Minimal Organism, bit for bit: the golden hash rests on these
    // being the same numbers, not close ones.
    for (const cytoplasmRadius of [0.3, 1, 1.4, 2.5]) {
      const body = deriveBody({...BASELINE_GENOME, cytoplasmRadius});

      expect(body.radius).toBe(cytoplasmRadius);
      expect(body.cytoplasmArea).toBe(bodyAreaOfRadius(cytoplasmRadius));
      expect(body.organelles).toEqual([]);
    }
  });

  it("is as wide as the cytoplasm and the organelles' areas together while they fit", () => {
    // Two tangent neurons of radius 0.1 near the centre of a cytoplasm of
    // radius 0.5: the body's area is the sum, and the reach is inside it.
    const body = deriveBody({
      ...BASELINE_GENOME,
      cytoplasmRadius: 0.5,
      genes: [neuron(1, -0.1, 0, 0.1), neuron(2, 0.1, 0, 0.1)],
    });

    expect(body.radius).toBeCloseTo(Math.sqrt(0.25 + 2 * 0.01), 12);
    expect(body.reach).toBeCloseTo(0.2, 12);
    expect(body.cytoplasmArea).toBeCloseTo(Math.PI * 0.25, 12);
  });

  it("keeps the cytoplasm area at least the cytoplasm radius's own, whatever the layout", () => {
    for (const x of [0, 0.4, 1.5, 3]) {
      const body = deriveBody({
        ...BASELINE_GENOME,
        cytoplasmRadius: 0.5,
        genes: [neuron(1, x, 0, 0.1), neuron(2, x + 0.3, 0.2, 0.15)],
      });

      expect(body.cytoplasmArea).toBeGreaterThanOrEqual(
        bodyAreaOfRadius(0.5) - 1e-12,
      );
    }
  });

  it("grows to the reach when an organelle sticks out, and never moves it back", () => {
    const genes = [neuron(1, 1.5, 0, 0.1)];
    const body = deriveBody({...BASELINE_GENOME, cytoplasmRadius: 0.5, genes});

    expect(body.radius).toBeCloseTo(1.6, 12);
    expect(body.organelles).toEqual(genes);
    expect(body.cytoplasmArea).toBeGreaterThan(Math.PI * 0.25);

    // A smaller cytoplasm leaves the organelle where it was.
    const thinner = deriveBody({
      ...BASELINE_GENOME,
      cytoplasmRadius: 0.2,
      genes,
    });
    expect(thinner.organelles).toEqual(genes);
    expect(thinner.radius).toBeCloseTo(1.6, 12);
  });

  it("keeps the genome's origin as the body's centre, whatever the layout", () => {
    const genes = [
      neuron(1, 3, 2, 0.1),
      neuron(2, 3.4, 2, 0.2),
      neuron(3, 3, 2.5, 0.05),
    ];
    const body = deriveBody({...BASELINE_GENOME, genes});

    expect(body.organelles.map(({x, y}) => ({x, y}))).toEqual(
      genes.map(({x, y}) => ({x, y})),
    );
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
    expect(BASELINE_GENOME.cytoplasmRadius).toBe(BASELINE_BODY_RADIUS);
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

/** Operator weights that leave every event to one operator. */
function only(operator: keyof OperatorWeights): OperatorWeights {
  return {
    parameterChange: 0,
    insertion: 0,
    deletion: 0,
    split: 0,
    weightChange: 0,
    synapseInsertion: 0,
    [operator]: 1,
  };
}

function headerOf(genome: Genome): Omit<Genome, "genes"> {
  const {
    cytoplasmRadius,
    mitosisEnergyThreshold,
    childAllocationRatio,
    lineageHue,
  } = genome;
  return {
    cytoplasmRadius,
    mitosisEnergyThreshold,
    childAllocationRatio,
    lineageHue,
  };
}

/**
 * Parents chosen to push the ceiling and the relaxation where they are
 * weakest, each holding the relaxed layout a genome in the world holds
 * (ADR-0034, ADR-0036).
 */
function hostileGenomes(): {readonly name: string; readonly genome: Genome}[] {
  const settled = (cytoplasmRadius: number, genes: OrganelleGene[]): Genome => {
    const genome: Genome = {...BASELINE_GENOME, cytoplasmRadius, genes};
    return {...genome, genes: deriveBody(genome).organelles};
  };

  // Nineteen neurons at r_new on a hexagonal lattice, each tangent to its
  // neighbours.
  const packed: OrganelleGene[] = [];
  for (let i = -2; i <= 2; i++) {
    for (let j = -2; j <= 2; j++) {
      if (Math.abs(i + j) <= 2) {
        packed.push(
          neuron(
            packed.length + 1,
            (i + j / 2) * 2 * R_NEW,
            ((j * Math.sqrt(3)) / 2) * 2 * R_NEW,
            R_NEW,
          ),
        );
      }
    }
  }

  return [
    {name: "an empty body", genome: settled(1, [])},
    {
      name: "one organelle filling most of the body",
      genome: settled(0.05, [neuron(1, 0, 0, 1)]),
    },
    {name: "nineteen neurons packed tight", genome: settled(0.3, packed)},
    {
      name: "neurons resting at the floor",
      genome: settled(0.6, neurons(6, R_MIN)),
    },
    {
      name: "a mixed layout under a vanishing cytoplasm",
      genome: settled(0.001, [
        neuron(1, 0, 0, 0.3),
        neuron(2, 0.4, 0, 0.1),
        neuron(3, 0, 0.35, R_NEW),
        neuron(4, -0.32, 0, R_MIN),
      ]),
    },
    {
      name: "two neurons under an extreme thickness",
      genome: settled(10, [neuron(1, 0, 0, 0.4), neuron(2, 0.5, 0, 0.1)]),
    },
  ];
}

/** The deepest overlap between any two organelles, 0 when none touch past
 * tangency. */
function deepestOverlap(genes: readonly OrganelleGene[]): number {
  let deepest = 0;
  for (let i = 0; i < genes.length; i++) {
    for (let j = i + 1; j < genes.length; j++) {
      const a = genes[i];
      const b = genes[j];
      deepest = Math.max(
        deepest,
        a.radius + b.radius - Math.hypot(a.x - b.x, a.y - b.y),
      );
    }
  }
  return deepest;
}

function organelleArea(genome: Genome): number {
  let area = 0;
  for (const gene of organelleGenes(genome.genes)) {
    area += bodyAreaOfRadius(gene.radius);
  }
  return area;
}

function thruster(
  innovationId: number,
  x: number,
  y: number,
  radius: number,
  orientation = {cos: 1, sin: 0},
  drive = DRIVE_NEW,
): OrganelleGene {
  return {type: "thruster", innovationId, x, y, radius, orientation, drive};
}

describe("the thruster's laws (M10)", () => {
  it("inserts a thruster at r_new, drive_new and a unit orientation", () => {
    for (let seed = 0; seed < 50; seed++) {
      const {genome} = mutateGenome(BASELINE_GENOME, createRngStream(seed), {
        roster: ["thruster"],
        eventProbability: 1,
        operatorWeights: only("insertion"),
      });
      const gene = organelleGenes(genome.genes)[0];

      expect(gene.type).toBe("thruster");
      expect(gene.radius).toBe(R_NEW);
      expect(gene.drive).toBe(DRIVE_NEW);
      expect(
        Math.hypot(gene.orientation?.cos ?? 0, gene.orientation?.sin ?? 0),
      ).toBeCloseTo(1, 12);
    }
  });

  it("carries neither field on the other types, and draws for them what it drew before", () => {
    const insertion = (type: "neuron" | "float" | "chloroplast" | "thruster") =>
      mutateGenome(BASELINE_GENOME, createRngStream(3), {
        roster: [type],
        eventProbability: 1,
        operatorWeights: only("insertion"),
      });

    for (const type of ["neuron", "float", "chloroplast"] as const) {
      const gene = organelleGenes(insertion(type).genome.genes)[0];
      expect(gene.orientation).toBeUndefined();
      expect(gene.drive).toBeUndefined();
    }
    // The orientation is the one extra draw, after the position.
    const [neuronStream, floatStream] = [
      insertion("neuron"),
      insertion("float"),
    ];
    expect(floatStream.stream).toEqual(neuronStream.stream);
    expect(insertion("thruster").stream).not.toEqual(neuronStream.stream);
  });

  it("turns an orientation by at most atan(ε), unit-length, and moves drive by at most δ_drive inside [0, 1]", () => {
    const parent: Genome = {
      ...BASELINE_GENOME,
      genes: [thruster(1, 0, 0, 0.2, {cos: 0.6, sin: 0.8}, 0.99)],
    };
    let turned = 0;
    let moved = 0;

    for (let seed = 0; seed < 400; seed++) {
      const {genome} = mutateGenome(parent, createRngStream(seed), {
        roster: [],
        eventProbability: 1,
        operatorWeights: only("parameterChange"),
      });
      const gene = organelleGenes(genome.genes)[0];
      const {cos, sin} = gene.orientation ?? {cos: 0, sin: 0};
      const angle = Math.abs(
        Math.atan2(0.6 * sin - 0.8 * cos, 0.6 * cos + 0.8 * sin),
      );

      expect(Math.hypot(cos, sin)).toBeCloseTo(1, 12);
      expect(angle).toBeLessThanOrEqual(Math.atan(EPSILON_ORIENTATION) + 1e-12);
      expect(gene.drive).toBeGreaterThanOrEqual(0);
      expect(gene.drive).toBeLessThanOrEqual(1);
      expect(Math.abs((gene.drive ?? 0) - 0.99)).toBeLessThanOrEqual(
        DELTA_DRIVE + 1e-12,
      );
      if (angle > 1e-9) {
        turned++;
      }
      if (gene.drive !== 0.99) {
        moved++;
      }
    }
    expect(turned).toBeGreaterThan(50);
    expect(moved).toBeGreaterThan(50);
  });

  it("copies orientation and drive to both pieces of a split", () => {
    const parent: Genome = {
      ...BASELINE_GENOME,
      genes: [thruster(1, 0, 0, 0.2, {cos: 0, sin: -1}, 0.4)],
    };
    const {genome} = mutateGenome(parent, createRngStream(1), {
      roster: [],
      eventProbability: 1,
      operatorWeights: only("split"),
    });

    expect(genome.genes.length).toBeGreaterThanOrEqual(2);
    for (const gene of organelleGenes(genome.genes)) {
      expect(gene.orientation).toEqual({cos: 0, sin: -1});
      expect(gene.drive).toBe(0.4);
    }
  });

  it("prices a thruster genome at the Birth Cost Ceiling of the same genome with floats", () => {
    const layout = [
      [0, 0, 0.2],
      [0.5, 0, 0.1],
      [-0.5, 0.3, 0.05],
    ] as const;
    const withThrusters: Genome = {
      ...BASELINE_GENOME,
      genes: layout.map(([x, y, r], i) => thruster(i + 1, x, y, r)),
    };
    const withFloats: Genome = {
      ...BASELINE_GENOME,
      genes: layout.map(([x, y, r], i) => ({
        type: "float" as const,
        innovationId: i + 1,
        x,
        y,
        radius: r,
      })),
    };
    const roster = ["neuron", "float", "chloroplast", "thruster"] as const;

    expect(birthCostCeiling(withThrusters, roster)).toBe(
      birthCostCeiling(withFloats, roster),
    );
  });
});

describe("Synapse Genes (M11)", () => {
  const thruster: OrganelleGene = {
    type: "thruster",
    innovationId: 1,
    radius: 0.1,
    x: 0,
    y: 0,
    orientation: {cos: 1, sin: 0},
    drive: 0.5,
  };
  const synapse: SynapseGene = {
    innovationId: 2,
    source: {id: BODY_ID, port: "light"},
    destination: {id: 1, port: "power"},
    weight: 1,
  };
  const bare: Genome = {...BASELINE_GENOME, genes: [thruster]};
  const wired: Genome = {...BASELINE_GENOME, genes: [thruster, synapse]};

  it("prices the same Birth Cost Ceiling with a synapse as without", () => {
    expect(birthCostCeiling(wired, DEFAULT_ROSTER)).toBe(
      birthCostCeiling(bare, DEFAULT_ROSTER),
    );
  });

  it("derives the same body with a synapse as without", () => {
    expect(deriveBody(wired)).toEqual(deriveBody(bare));
  });

  it("carries a synapse through a structural event that leaves it alone", () => {
    const {genome} = mutateGenome(wired, createRngStream(5), {
      roster: DEFAULT_ROSTER,
      eventProbability: 1,
      operatorWeights: {
        parameterChange: 1,
        insertion: 0,
        deletion: 0,
        split: 0,
        weightChange: 0,
        synapseInsertion: 0,
      },
    });

    expect(genome.genes.filter((gene) => !("type" in gene))).toEqual([synapse]);
  });

  describe("a structural event keeps the wiring sound", () => {
    const wireFor = (id: number, innovationId: number): SynapseGene => ({
      innovationId,
      source: {id: BODY_ID, port: "light"},
      destination: {id, port: "power"},
      weight: -1.5,
    });
    const other: OrganelleGene = {
      ...thruster,
      innovationId: 3,
      x: 0.5,
    };
    const events = (operator: "deletion" | "split") => ({
      roster: DEFAULT_ROSTER,
      eventProbability: 1,
      operatorWeights: only(operator),
    });
    const synapsesOf = (genome: Genome): SynapseGene[] =>
      genome.genes.filter((gene): gene is SynapseGene => !("type" in gene));

    it("removes every synapse of a deleted organelle", () => {
      // One thruster and its wire: a deletion takes either the wire alone or
      // the thruster and the wire as one event, never the thruster alone.
      let thrusterDeleted = false;
      for (let seed = 0; seed < 20; seed++) {
        const {genome} = mutateGenome(
          wired,
          createRngStream(seed),
          events("deletion"),
        );
        if (!genome.genes.some((gene) => "type" in gene)) {
          thrusterDeleted = true;
          expect(synapsesOf(genome)).toEqual([]);
        }
      }

      expect(thrusterDeleted).toBe(true);
    });

    it("keeps the synapses of the organelles a deletion left", () => {
      const both: Genome = {
        ...BASELINE_GENOME,
        genes: [thruster, other, wireFor(1, 4), wireFor(3, 5)],
      };
      for (let seed = 1; seed <= 20; seed++) {
        const {genome} = mutateGenome(
          both,
          createRngStream(seed),
          events("deletion"),
        );
        const ids = new Set(
          genome.genes.filter((g) => "type" in g).map((g) => g.innovationId),
        );
        for (const wire of synapsesOf(genome)) {
          expect(ids.has(wire.destination.id)).toBe(true);
        }
        // One event removes one wire, or one organelle with its own wire.
        expect(synapsesOf(genome)).toHaveLength(1);
      }
    });

    it("copies each incoming synapse of a split thruster to both pieces", () => {
      const {genome} = mutateGenome(wired, createRngStream(5), events("split"));
      const pieces = genome.genes.filter(
        (gene): gene is OrganelleGene => "type" in gene,
      );
      const wires = synapsesOf(genome);

      expect(pieces).toHaveLength(2);
      expect(wires).toHaveLength(2);
      expect(wires.map(({destination}) => destination.id).sort()).toEqual(
        pieces.map(({innovationId}) => innovationId).sort(),
      );
      for (const wire of wires) {
        expect(wire.weight).toBe(synapse.weight);
        expect(wire.source).toEqual(synapse.source);
        expect(wire.destination.port).toBe("power");
      }
      expect(new Set(wires.map(({innovationId}) => innovationId)).size).toBe(2);
    });
  });

  describe("the split of a wired neuron (ADR-0037)", () => {
    const pieceOf = (genome: Genome): OrganelleGene[] =>
      genome.genes.filter((gene): gene is OrganelleGene => "type" in gene);
    const wiresOf = (genome: Genome): SynapseGene[] =>
      genome.genes.filter((gene): gene is SynapseGene => !("type" in gene));
    const splitNeuron = (genes: Genome["genes"]): Genome =>
      mutateGenome({...BASELINE_GENOME, genes}, createRngStream(5), {
        roster: [],
        eventProbability: 1,
        operatorWeights: only("split"),
      }).genome;
    const aNeuron: OrganelleGene = {
      type: "neuron",
      innovationId: 1,
      radius: 0.2,
      x: 0,
      y: 0,
      tau: 3,
      bias: 0.5,
      threshold: 2,
      dischargeFactor: 0.25,
    };
    const wire = (
      source: SynapseGene["source"],
      destination: SynapseGene["destination"],
      weight: number,
    ): SynapseGene => ({innovationId: 2, source, destination, weight});
    const share = (genome: Genome): number => {
      const [first] = pieceOf(genome);
      return (first.radius * first.radius) / (aNeuron.radius * aNeuron.radius);
    };

    it("copies an incoming synapse to both pieces at the same weight, and gives both the parameters", () => {
      const genome = splitNeuron([
        aNeuron,
        wire({id: BODY_ID, port: "light"}, {id: 1, port: "in"}, 1.5),
      ]);
      const [first, second] = pieceOf(genome);

      expect(
        wiresOf(genome).map(({destination, weight}) => [
          destination.id,
          weight,
        ]),
      ).toEqual([
        [first.innovationId, 1.5],
        [second.innovationId, 1.5],
      ]);
      expect([second.tau, second.bias, second.threshold]).toEqual([3, 0.5, 2]);
      expect(second.dischargeFactor).toBe(0.25);
    });

    it("divides an outgoing synapse into f·w and (1−f)·w", () => {
      const genome = splitNeuron([
        aNeuron,
        wire({id: 1, port: "out"}, {id: 9, port: "power"}, -2),
      ]);
      const [first, second] = pieceOf(genome);
      const f = share(genome);
      const [near, far] = wiresOf(genome);

      expect([near.source.id, far.source.id]).toEqual([
        first.innovationId,
        second.innovationId,
      ]);
      expect(near.weight).toBeCloseTo(-2 * f, 12);
      expect(far.weight).toBeCloseTo(-2 * (1 - f), 12);
    });

    it("turns a self-synapse into the four ADR-0037 gives", () => {
      const genome = splitNeuron([
        aNeuron,
        wire({id: 1, port: "out"}, {id: 1, port: "in"}, 2),
      ]);
      const [first, second] = pieceOf(genome);
      const f = share(genome);
      const ids = [first.innovationId, second.innovationId];

      const four = wiresOf(genome).map(({source, destination, weight}) => ({
        from: ids.indexOf(source.id),
        to: ids.indexOf(destination.id),
        weight,
      }));

      expect(four).toHaveLength(4);
      expect(
        new Set(four.map(({from, to}) => String(from) + String(to))).size,
      ).toBe(4);
      for (const {from, to, weight} of four) {
        expect(from).toBeGreaterThanOrEqual(0);
        expect(to).toBeGreaterThanOrEqual(0);
        expect(weight).toBeCloseTo((from === 0 ? f : 1 - f) * 2, 12);
      }
    });

    it("gives every new synapse a provisional id that minting resolves", () => {
      const genome = splitNeuron([
        aNeuron,
        wire({id: 1, port: "out"}, {id: 1, port: "in"}, 2),
      ]);

      expect(
        wiresOf(genome).filter(({innovationId}) => innovationId < 0),
      ).toHaveLength(3);
      const minted = mintInnovationIds(genome, 10).genome;
      const ids = new Set(minted.genes.map(({innovationId}) => innovationId));
      expect(ids.size).toBe(minted.genes.length);
      for (const {source, destination} of wiresOf(minted)) {
        expect(ids.has(source.id)).toBe(true);
        expect(ids.has(destination.id)).toBe(true);
      }
    });
  });

  describe("minting", () => {
    const provisional: Genome = {
      ...BASELINE_GENOME,
      genes: [
        {...thruster, innovationId: -1},
        {
          innovationId: -2,
          source: {id: BODY_ID, port: "energy"},
          destination: {id: -1, port: "power"},
          weight: -0.5,
        },
      ],
    };

    it("rewrites an endpoint naming a provisional organelle id to its minted id", () => {
      const {genome} = mintInnovationIds(provisional, 7);
      const [organelle, wire] = genome.genes as [OrganelleGene, SynapseGene];

      expect(organelle.innovationId).toBe(7);
      expect(wire.innovationId).toBe(8);
      expect(wire.destination).toEqual({id: 7, port: "power"});
    });

    it("leaves an endpoint naming the body's reserved id untouched", () => {
      const {genome} = mintInnovationIds(provisional, 7);

      expect((genome.genes[1] as SynapseGene).source).toEqual({
        id: BODY_ID,
        port: "energy",
      });
    });

    it("rewrites an endpoint that names an organelle later in the genome", () => {
      const reversed: Genome = {
        ...provisional,
        genes: [provisional.genes[1], provisional.genes[0]],
      };
      const {genome} = mintInnovationIds(reversed, 7);
      const wire = genome.genes[0] as SynapseGene;

      expect(wire.destination.id).toBe(
        (genome.genes[1] as OrganelleGene).innovationId,
      );
    });
  });

  it("reserves the body's id outside the counter and lists the seven senses", () => {
    expect(BODY_ID).toBeLessThan(FIRST_INNOVATION_ID);
    expect(BODY_ID).toBeGreaterThanOrEqual(0);
    expect(INNATE_SENSES).toEqual([
      "energy",
      "food",
      "O₂",
      "CO₂",
      "light",
      "up",
      "tilt",
    ]);
  });
});

describe("the neuron's CTRNN parameters (M11)", () => {
  const neuronGene = (
    parameters: Partial<
      Pick<OrganelleGene, "tau" | "bias" | "threshold" | "dischargeFactor">
    >,
  ): OrganelleGene => ({
    type: "neuron",
    innovationId: 1,
    x: 0,
    y: 0,
    radius: 0.2,
    tau: 1,
    bias: 0,
    threshold: 1,
    dischargeFactor: 1,
    ...parameters,
  });

  it("inserts a neuron at the inert values and draws what a float's insertion draws", () => {
    const insertion = (type: "neuron" | "float") =>
      mutateGenome(BASELINE_GENOME, createRngStream(3), {
        roster: [type],
        eventProbability: 1,
        operatorWeights: only("insertion"),
      });

    const gene = organelleGenes(insertion("neuron").genome.genes)[0];

    expect([gene.tau, gene.bias, gene.threshold, gene.dischargeFactor]).toEqual(
      [1, 0, 1, 1],
    );
    expect(insertion("neuron").stream).toEqual(insertion("float").stream);
    expect(
      organelleGenes(insertion("float").genome.genes)[0].tau,
    ).toBeUndefined();
  });

  it("moves each parameter by at most its step, inside its range", () => {
    const parent: Genome = {
      ...BASELINE_GENOME,
      genes: [
        neuronGene({tau: 1, bias: 3.9, threshold: 0.1, dischargeFactor: 0.98}),
      ],
    };
    const moved = {tau: 0, bias: 0, threshold: 0, dischargeFactor: 0};

    for (let seed = 0; seed < 600; seed++) {
      const {genome} = mutateGenome(parent, createRngStream(seed), {
        roster: [],
        eventProbability: 1,
        operatorWeights: only("parameterChange"),
      });
      const gene = organelleGenes(genome.genes)[0];

      expect(gene.tau).toBeGreaterThanOrEqual(1);
      expect(gene.tau).toBeLessThanOrEqual(1.25 + 1e-12);
      expect(Math.abs((gene.bias ?? 0) - 3.9)).toBeLessThanOrEqual(
        0.25 + 1e-12,
      );
      expect(gene.bias).toBeLessThanOrEqual(4);
      expect(gene.threshold).toBeGreaterThanOrEqual(0);
      expect(Math.abs((gene.threshold ?? 0) - 0.1)).toBeLessThanOrEqual(
        0.25 + 1e-12,
      );
      expect(gene.dischargeFactor).toBeGreaterThanOrEqual(0);
      expect(gene.dischargeFactor).toBeLessThanOrEqual(1);
      if (gene.tau !== 1) {
        moved.tau++;
      }
      if (gene.bias !== 3.9) {
        moved.bias++;
      }
      if (gene.threshold !== 0.1) {
        moved.threshold++;
      }
      if (gene.dischargeFactor !== 0.98) {
        moved.dischargeFactor++;
      }
    }
    for (const count of Object.values(moved)) {
      expect(count).toBeGreaterThan(20);
    }
  });
});

describe("the synapse operators (ADR-0037)", () => {
  const aThruster: OrganelleGene = {
    type: "thruster",
    innovationId: 1,
    radius: 0.1,
    x: 0,
    y: 0,
    orientation: {cos: 1, sin: 0},
    drive: 0.5,
  };
  const aNeuron: OrganelleGene = {
    type: "neuron",
    innovationId: 2,
    radius: 0.1,
    x: 0.5,
    y: 0,
  };
  const forced = (operator: keyof OperatorWeights): MutationOptions => ({
    roster: DEFAULT_ROSTER,
    eventProbability: 1,
    operatorWeights: only(operator),
  });
  const synapsesOf = (genome: Genome): SynapseGene[] =>
    genome.genes.filter((gene): gene is SynapseGene => !("type" in gene));
  const withGenes = (genes: Genome["genes"]): Genome => ({
    ...BASELINE_GENOME,
    genes,
  });

  it("walks the old four first, then the weight change and the synapse insertion", () => {
    const weights = Object.keys(OPERATOR_WEIGHTS);

    expect(weights).toEqual([
      "parameterChange",
      "insertion",
      "deletion",
      "split",
      "weightChange",
      "synapseInsertion",
    ]);
    expect(OPERATOR_WEIGHTS).toEqual({
      parameterChange: 0.4,
      insertion: 0.2,
      deletion: 0.2,
      split: 0.1,
      weightChange: 0.1,
      synapseInsertion: 0.2,
    });
  });

  describe("synapse insertion", () => {
    it("does nothing in a genome with no input port", () => {
      const float: OrganelleGene = {...aNeuron, type: "float"};
      for (const genome of [BASELINE_GENOME, withGenes([float])]) {
        for (let seed = 0; seed < 20; seed++) {
          const child = mutateGenome(
            genome,
            createRngStream(seed),
            forced("synapseInsertion"),
          ).genome;

          expect(child.genes).toBe(genome.genes);
        }
      }
    });

    it("wires a body sense or a neuron's out to power or in, born within a step of zero", () => {
      const genome = withGenes([aThruster, aNeuron]);
      for (let seed = 0; seed < 100; seed++) {
        const child = mutateGenome(
          genome,
          createRngStream(seed),
          forced("synapseInsertion"),
        ).genome;
        const [added] = synapsesOf(child);

        expect(child.genes).toHaveLength(3);
        expect(
          added.source.id === BODY_ID
            ? INNATE_SENSES.includes(added.source.port as never)
            : added.source.id === 2 && added.source.port === "out",
        ).toBe(true);
        expect(
          (added.destination.id === 1 && added.destination.port === "power") ||
            (added.destination.id === 2 && added.destination.port === "in"),
        ).toBe(true);
        expect(Math.abs(added.weight)).toBeLessThanOrEqual(DELTA_WEIGHT);
        expect(added.innovationId).toBeLessThan(0);
      }
    });

    it("reaches every source and every destination, and can repeat an existing pair", () => {
      const genome = withGenes([aThruster, aNeuron]);
      const sources = new Set<string>();
      const destinations = new Set<string>();
      let duplicated = false;
      const existing = {
        innovationId: 3,
        source: {id: BODY_ID, port: "energy"},
        destination: {id: 1, port: "power"},
        weight: 1,
      };
      for (let seed = 0; seed < 600; seed++) {
        const {source, destination} = synapsesOf(
          mutateGenome(
            genome,
            createRngStream(seed),
            forced("synapseInsertion"),
          ).genome,
        )[0];
        sources.add(`${String(source.id)}.${source.port}`);
        destinations.add(`${String(destination.id)}.${destination.port}`);

        const [first, second] = synapsesOf(
          mutateGenome(
            withGenes([aThruster, aNeuron, existing]),
            createRngStream(seed),
            forced("synapseInsertion"),
          ).genome,
        );
        duplicated ||=
          second.source.id === first.source.id &&
          second.source.port === first.source.port &&
          second.destination.id === first.destination.id &&
          second.destination.port === first.destination.port;
      }

      expect(sources.size).toBe(INNATE_SENSES.length + 1);
      expect([...destinations].sort()).toEqual(["1.power", "2.in"]);
      expect(duplicated).toBe(true);
    });
  });

  describe("weight change", () => {
    const wire = (weight: number): SynapseGene => ({
      innovationId: 3,
      source: {id: BODY_ID, port: "light"},
      destination: {id: 1, port: "power"},
      weight,
    });

    it("does nothing without a synapse", () => {
      const genome = withGenes([aThruster]);

      expect(
        mutateGenome(genome, createRngStream(1), forced("weightChange")).genome
          .genes,
      ).toBe(genome.genes);
    });

    it("moves one weight by at most a step, and never out of [−4, 4]", () => {
      for (const start of [0, 1, -3.9, 3.9, 4, -4]) {
        for (let seed = 0; seed < 100; seed++) {
          const [moved] = synapsesOf(
            mutateGenome(
              withGenes([aThruster, wire(start)]),
              createRngStream(seed),
              forced("weightChange"),
            ).genome,
          );

          expect(Math.abs(moved.weight - start)).toBeLessThanOrEqual(
            DELTA_WEIGHT + 1e-12,
          );
          expect(Math.abs(moved.weight)).toBeLessThanOrEqual(WEIGHT_MAX);
        }
      }
    });
  });

  describe("deletion", () => {
    it("can target a synapse, leaving the organelles", () => {
      const wire: SynapseGene = {
        innovationId: 3,
        source: {id: BODY_ID, port: "light"},
        destination: {id: 1, port: "power"},
        weight: 1,
      };
      let synapseGone = 0;
      let organelleGone = 0;
      for (let seed = 0; seed < 100; seed++) {
        const child = mutateGenome(
          withGenes([aThruster, wire]),
          createRngStream(seed),
          forced("deletion"),
        ).genome;
        if (child.genes.some((gene) => "type" in gene)) {
          synapseGone++;
          expect(synapsesOf(child)).toEqual([]);
        } else {
          organelleGone++;
        }
      }

      expect(synapseGone).toBeGreaterThan(0);
      expect(organelleGone).toBeGreaterThan(0);
    });
  });

  it("prices the same Birth Cost Ceiling under the six operators as under M7's four", () => {
    const wire: SynapseGene = {
      innovationId: 3,
      source: {id: BODY_ID, port: "light"},
      destination: {id: 2, port: "in"},
      weight: 1,
    };
    const bare = withGenes([aThruster, aNeuron]);

    expect(
      birthCostCeiling(withGenes([aThruster, aNeuron, wire]), DEFAULT_ROSTER),
    ).toBe(birthCostCeiling(bare, DEFAULT_ROSTER));
  });
});
