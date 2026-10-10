import {
  AQUARIUM_HEIGHT,
  AQUARIUM_WIDTH,
  BASELINE_GENOME,
  BRIGHT_BAND_DEPTH,
  createWorld,
  getPopulation,
  getWorstPenetration,
  type Founder,
} from "../../src/world";
import {G, R_NEW} from "../../src/world/constants";
import {createRngStream, nextRng, type RngStream} from "../../src/world/rng";
import {
  heading,
  integer,
  meanAndSigma,
  note,
  num,
  percent,
  row,
  table,
} from "./report";
import {
  BUOYANCY_BODIES,
  BUOYANCY_SAMPLE_EVERY,
  BUOYANCY_TICKS,
  SEED,
  seeds,
  WORLD_SAMPLE_EVERY,
  WORLD_TICKS,
} from "./settings";
import {runTicksWatching} from "./worlds";

/**
 * M8's `g` check (#77): is the closed-form `g` the one that gives a float
 * carrier a scale height of the Bright Band's thickness? A Fixed Population
 * of baseline bodies, each carrying one float at `r_new` and placed at
 * random, run with Brownian motion and gravity; its depths are compared with
 * the profile the drift and the diffusion predict. Mortality and fertility
 * off, so nothing but motion and the walls shape the depths.
 *
 * The lift is `g·π·r²·(1 + y/H)` over a drag of `6π·R`, so the drift speed
 * grows linearly with depth while the diffusion stays put, and the
 * stationary density is `exp(−(y + y²/2H)/L)` between the walls, with `L`
 * the scale height `D/v₀`.
 *
 * The prediction is for non-interacting bodies. Forty bodies of radius 1
 * pile two or three rows deep against the surface and push each other
 * down, so a measured mean depth deeper than the prediction (and a
 * smaller Bright Band fraction) is the separation pass, not a wrong `g`:
 * fewer bodies come closer to the profile, with more noise.
 *
 * Reported, never gated (ADR-0024).
 */

export interface BuoyancyCheck {
  readonly g: number;
  readonly bodies: number;
  readonly ticks: number;
  readonly samples: number;
  readonly meanDepth: number;
  readonly brightFraction: number;
  readonly predictedMeanDepth: number;
  readonly predictedBrightFraction: number;
}

/** The depth range a body's centre can occupy: the walls clamp the whole
 * circle, and a baseline body carrying a float has this radius. */
function centreRange(): {readonly lowest: number; readonly highest: number} {
  const radius = Math.sqrt(1 + R_NEW * R_NEW);

  return {lowest: radius, highest: AQUARIUM_HEIGHT - radius};
}

/** The predicted mean depth and Bright Band fraction of
 * `exp(−(y + y²/2H)/L)` between the walls, by midpoint quadrature. */
export function predictedProfile(): {
  readonly meanDepth: number;
  readonly brightFraction: number;
} {
  const {lowest, highest} = centreRange();
  const scale = BRIGHT_BAND_DEPTH;
  const steps = 200_000;
  const width = (highest - lowest) / steps;

  let total = 0;
  let depthSum = 0;
  let bright = 0;
  for (let step = 0; step < steps; step++) {
    const y = lowest + (step + 0.5) * width;
    const weight = Math.exp(-(y + (y * y) / (2 * AQUARIUM_HEIGHT)) / scale);
    total += weight;
    depthSum += weight * y;
    bright += y <= BRIGHT_BAND_DEPTH ? weight : 0;
  }

  return {meanDepth: depthSum / total, brightFraction: bright / total};
}

function randomFounders(count: number, seed: number): readonly Founder[] {
  let stream: RngStream = createRngStream(seed);
  const draw = (): number => {
    const next = nextRng(stream);
    stream = next.stream;

    return next.value;
  };

  const {lowest, highest} = centreRange();

  return Array.from({length: count}, () => ({
    x: lowest + draw() * (AQUARIUM_WIDTH - 2 * lowest),
    y: lowest + draw() * (highest - lowest),
    genome: {
      ...BASELINE_GENOME,
      genes: [{type: "float" as const, radius: R_NEW, x: 0, y: 0}],
    },
  }));
}

export function measureBuoyancy(): BuoyancyCheck {
  const world = createWorld(SEED, {
    mortality: "off",
    fertility: "off",
    generation0: {founders: randomFounders(BUOYANCY_BODIES, SEED)},
  });

  const settledFrom = BUOYANCY_TICKS / 2;
  let depthSum = 0;
  let brightSum = 0;
  let samples = 0;
  runTicksWatching(world, BUOYANCY_TICKS, (current, tick) => {
    if (tick <= settledFrom || tick % BUOYANCY_SAMPLE_EVERY !== 0) {
      return;
    }
    const population = getPopulation(current);
    for (const organism of population) {
      depthSum += organism.y;
      brightSum += organism.y <= BRIGHT_BAND_DEPTH ? 1 : 0;
    }
    samples += population.length;
  });

  const predicted = predictedProfile();

  return {
    g: G,
    bodies: BUOYANCY_BODIES,
    ticks: BUOYANCY_TICKS,
    samples,
    meanDepth: depthSum / samples,
    brightFraction: brightSum / samples,
    predictedMeanDepth: predicted.meanDepth,
    predictedBrightFraction: predicted.brightFraction,
  };
}

export function reportBuoyancy(check: BuoyancyCheck): void {
  heading("The g check: float carriers against the predicted depth profile");
  note(
    `  ${String(check.bodies)} baseline bodies, one float each at r_new = ${num(R_NEW)}, random placement, mortality and fertility off, seed ${String(SEED)}.`,
  );
  note(
    `  ${String(check.ticks)} ticks, second half sampled (${String(check.samples)} depth readings). Profile exp(−(y + y²/2H)/L), L = ${num(BRIGHT_BAND_DEPTH)}, within the walls.`,
  );
  row("g", num(check.g));
  row("mean depth, measured", num(check.meanDepth));
  row("mean depth, predicted", num(check.predictedMeanDepth));
  row("Bright Band fraction, measured", percent(check.brightFraction));
  row(
    "Bright Band fraction, predicted",
    percent(check.predictedBrightFraction),
  );
}

/**
 * The float on the Reference World (#81): does it rise above the drift level
 * the neuron sits at, and do its carriers sit higher and stand upright? The
 * default roster, five seeds, mortal and fertile, as the app runs it. Every
 * number is reported, never gated (ADR-0024).
 */

interface WorldSample {
  readonly tick: number;
  readonly size: number;
  readonly floatCarriers: number;
  readonly floats: number;
  readonly neuronCarriers: number;
  readonly neurons: number;
  readonly carrierDepthSum: number;
  readonly plainDepthSum: number;
  /** Over float carriers: summed |angle| of the Body Axis from the world's
   * vertical in degrees, and summed cosine (1 upright, −1 inverted). */
  readonly absAngleSum: number;
  readonly cosSum: number;
}

export interface ReferenceWorldRun {
  readonly seed: number;
  readonly samples: readonly WorldSample[];
  readonly worstOverlap: number;
}

function runReferenceWorld(seed: number): ReferenceWorldRun {
  const samples: WorldSample[] = [];
  let worstOverlap = 0;

  runTicksWatching(createWorld(seed), WORLD_TICKS, (world, tick) => {
    worstOverlap = Math.max(worstOverlap, getWorstPenetration(world));
    if (tick % WORLD_SAMPLE_EVERY !== 0) {
      return;
    }
    const population = getPopulation(world);
    let floatCarriers = 0;
    let floats = 0;
    let neuronCarriers = 0;
    let neurons = 0;
    let carrierDepthSum = 0;
    let plainDepthSum = 0;
    let absAngleSum = 0;
    let cosSum = 0;
    for (const organism of population) {
      const floatCount = organism.organelles.filter(
        (gene) => gene.type === "float",
      ).length;
      const neuronCount = organism.organelles.length - floatCount;
      floats += floatCount;
      neurons += neuronCount;
      neuronCarriers += neuronCount > 0 ? 1 : 0;
      if (floatCount > 0) {
        floatCarriers++;
        carrierDepthSum += organism.y;
        absAngleSum +=
          (Math.abs(Math.atan2(organism.axis.sin, organism.axis.cos)) * 180) /
          Math.PI;
        cosSum += organism.axis.cos;
      } else {
        plainDepthSum += organism.y;
      }
    }
    samples.push({
      tick,
      size: population.length,
      floatCarriers,
      floats,
      neuronCarriers,
      neurons,
      carrierDepthSum,
      plainDepthSum,
      absAngleSum,
      cosSum,
    });
  });

  return {seed, samples, worstOverlap};
}

export function measureReferenceWorld(): readonly ReferenceWorldRun[] {
  return seeds().map(runReferenceWorld);
}

function secondHalf(run: ReferenceWorldRun): readonly WorldSample[] {
  return run.samples.slice(Math.floor(run.samples.length / 2));
}

function sum(
  samples: readonly WorldSample[],
  pick: (sample: WorldSample) => number,
): number {
  return samples.reduce((total, sample) => total + pick(sample), 0);
}

/** Pooled over the samples rather than averaged per sample: a sample with no
 * carrier has no mean depth, and a zero in its place would drag the pool. */
function ratio(numerator: number, denominator: number, digits = 4): string {
  return denominator > 0 ? num(numerator / denominator, digits) : "—";
}

function share(numerator: number, denominator: number): string {
  return denominator > 0 ? percent(numerator / denominator) : "—";
}

export function reportReferenceWorld(runs: readonly ReferenceWorldRun[]): void {
  heading("The float on the Reference World");
  note(
    `  Default roster, seeds ${seeds().join(", ")}, ${integer(WORLD_TICKS)} ticks, sampled every ${integer(WORLD_SAMPLE_EVERY)}; second half pooled.`,
  );
  note(
    "  Angle: the Body Axis from the world's vertical, 0° upright (float carriers).",
  );

  table(
    [
      "seed",
      "float",
      "per carrier",
      "neuron",
      "per carrier",
      "depth float",
      "depth plain",
      "mean |angle|",
      "mean cos",
      "worst overlap",
    ],
    runs.map((run) => {
      const half = secondHalf(run);
      const size = sum(half, (s) => s.size);
      const floatCarriers = sum(half, (s) => s.floatCarriers);
      const neuronCarriers = sum(half, (s) => s.neuronCarriers);

      return [
        String(run.seed),
        share(floatCarriers, size),
        ratio(
          sum(half, (s) => s.floats),
          floatCarriers,
          3,
        ),
        share(neuronCarriers, size),
        ratio(
          sum(half, (s) => s.neurons),
          neuronCarriers,
          3,
        ),
        ratio(
          sum(half, (s) => s.carrierDepthSum),
          floatCarriers,
        ),
        ratio(
          sum(half, (s) => s.plainDepthSum),
          size - floatCarriers,
        ),
        `${ratio(
          sum(half, (s) => s.absAngleSum),
          floatCarriers,
          3,
        )}°`,
        ratio(
          sum(half, (s) => s.cosSum),
          floatCarriers,
          3,
        ),
        num(run.worstOverlap),
      ];
    }),
  );

  const fractions = runs.map((run) => {
    const half = secondHalf(run);

    return (
      sum(half, (s) => s.floatCarriers) /
      Math.max(
        1,
        sum(half, (s) => s.size),
      )
    );
  });
  const neuronFractions = runs.map((run) => {
    const half = secondHalf(run);

    return (
      sum(half, (s) => s.neuronCarriers) /
      Math.max(
        1,
        sum(half, (s) => s.size),
      )
    );
  });
  const float = meanAndSigma(fractions);
  const neuron = meanAndSigma(neuronFractions);
  row(
    "float carrier fraction",
    `${percent(float.mean)} ± ${percent(float.sigma)}`,
  );
  row(
    "neuron carrier fraction",
    `${percent(neuron.mean)} ± ${percent(neuron.sigma)}`,
  );
  row(
    "worst overlap, any run",
    num(Math.max(...runs.map((run) => run.worstOverlap))),
  );
}
