import {beforeAll, describe, expect, it} from "vitest";

import {AQUARIUM_HEIGHT, AQUARIUM_WIDTH} from "./aquarium";
import {BASELINE_GENOME} from "./genome";
import type {Founder} from "./organism";
import {
  FIXED_DT_MS,
  advance,
  createWorld,
  getCarbonDrift,
  getCumulativeBirths,
  getCumulativeDeaths,
  getOxygenDrift,
  getPopulation,
  type World,
} from "./world";

/**
 * Ticket #85, M9's acceptance gate: conservation survives chloroplasts.
 * The Reference World carries too few of them to put the invariant under
 * load, and `conservation.long.test.ts` is a Fixed Population with no births,
 * so this run is the one where chloroplasts fix, are born and die all the
 * time (the pattern of M3's and M4's gates).
 *
 * Founders are explicit and all carry chloroplasts, of several counts and
 * radii; half sit at the surface, where the CO₂ throttle binds, and half
 * deep. They are small, as the Birth Cost Ceiling prices an organelle's
 * worst event by its radius. Mortality and fertility are on, the roster is
 * the float and the chloroplast.
 *
 * The founders were rebuilt, not the tolerance, until carriers stayed alive
 * through the run: fewer than about thirty, or ones placed mostly at the
 * surface, lose every carrier to starvation or to mutation before tick 100k.
 * The mix below (half the founders at the surface, the rest from half
 * the aquarium's depth down) keeps carriers present at every sample.
 */
const TICKS = 100_000;
const SEED = 7;
const SAMPLE_EVERY = 1000;
const RUN_TIMEOUT_MS = 120_000;

const FOUNDER_COUNT = 32;

const FOUNDERS: readonly Founder[] = Array.from(
  {length: FOUNDER_COUNT},
  (_, i) => {
    const surface = i % 2 === 0;
    return {
      x: 2 + ((AQUARIUM_WIDTH - 4) * i) / FOUNDER_COUNT,
      y: surface ? 2 + (i % 6) : AQUARIUM_HEIGHT * (0.5 + 0.04 * (i % 12)),
      genome: {
        ...BASELINE_GENOME,
        lineageHue: i / FOUNDER_COUNT,
        genes: Array.from({length: 1 + (i % 4)}, (_, k) => ({
          type: "chloroplast" as const,
          x: 0.03 * k,
          y: 0,
          radius: 0.03 + 0.01 * ((i + k) % 5),
        })),
      },
    };
  },
);

function carriers(world: World): number {
  return getPopulation(world).filter((organism) =>
    organism.organelles.some((organelle) => organelle.type === "chloroplast"),
  ).length;
}

interface LongRun {
  readonly carbonDrift: number;
  readonly oxygenDrift: number;
  readonly births: number;
  readonly deaths: number;
  readonly minCarriers: number;
}

function runLong(): LongRun {
  let world: World = createWorld(SEED, {
    generation0: {founders: FOUNDERS},
    roster: ["float", "chloroplast"],
    mortality: "on",
    fertility: "on",
  });
  let minCarriers = carriers(world);

  for (let tick = 1; tick <= TICKS; tick++) {
    ({world} = advance(world, FIXED_DT_MS));
    if (tick % SAMPLE_EVERY === 0) {
      minCarriers = Math.min(minCarriers, carriers(world));
    }
  }

  return {
    carbonDrift: getCarbonDrift(world),
    oxygenDrift: getOxygenDrift(world),
    births: getCumulativeBirths(world),
    deaths: getCumulativeDeaths(world),
    minCarriers,
  };
}

describe("conservation survives chloroplasts: the 100k gate (#85)", () => {
  let run: LongRun;

  beforeAll(() => {
    run = runLong();
  }, RUN_TIMEOUT_MS);

  it("conserves total carbon within 1e-9 relative drift", () => {
    expect(Math.abs(run.carbonDrift)).toBeLessThan(1e-9);
  });

  it("conserves total oxygen within 1e-9 relative drift", () => {
    expect(Math.abs(run.oxygenDrift)).toBeLessThan(1e-9);
  });

  // Non-vacuity: a run that never bred, never lost anyone or lost every
  // carrier early would conserve trivially.
  it("saw births and deaths", () => {
    expect(run.births).toBeGreaterThan(0);
    expect(run.deaths).toBeGreaterThan(0);
  });

  it("kept chloroplast carriers alive at every sample", () => {
    expect(run.minCarriers).toBeGreaterThan(0);
  });
});
