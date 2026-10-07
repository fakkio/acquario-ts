import {describe, expect, it} from "vitest";

import {BASELINE_BODY_RADIUS} from "./aquarium";
import {
  DELTA_CYTOPLASM_RADIUS,
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
  mutateGenome,
  type Genome,
  type MutationOptions,
  type OperatorWeights,
  type OrganelleGene,
} from "./genome";
import {bodyAreaOfRadius} from "./organism";
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

          expect(genome.genes[0].x).toBeCloseTo(px * within, 12);
          expect(genome.genes[0].y).toBeCloseTo(py * within, 12);
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
        for (const gene of genome.genes) {
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
          const [gene] = genome.genes;
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
        for (const gene of genome.genes.slice(2)) {
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
        for (const gene of genome.genes) {
          const original = parent.genes.find(
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
        const [first, second] = genome.genes;
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
        const [first, second, third] = genome.genes;

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
        const [floor, large] = genome.genes;
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

      for (let seed = 0; seed < 400; seed++) {
        const {genome} = mutateGenome(parent, createRngStream(seed), {
          roster: [],
          eventProbability: 1,
          operatorWeights: only("parameterChange"),
        });
        const [left, right] = genome.genes;
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
    ...(["parameterChange", "insertion", "deletion", "split"] as const).map(
      (operator) => ({
        name: `only ${operator}`,
        options: {eventProbability: 1, operatorWeights: only(operator)},
      }),
    ),
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
            expect(deepestOverlap(child.genes), where).toBeLessThanOrEqual(
              1e-9,
            );
            for (const gene of child.genes) {
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
  for (const gene of genome.genes) {
    area += bodyAreaOfRadius(gene.radius);
  }
  return area;
}
