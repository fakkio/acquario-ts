import {
  AQUARIUM_HEIGHT,
  AQUARIUM_WIDTH,
  BASELINE_GENOME,
  BRIGHT_BAND_DEPTH,
  createWorld,
  getPopulation,
  type Founder,
} from "../../src/world";
import {G, R_NEW} from "../../src/world/constants";
import {createRngStream, nextRng, type RngStream} from "../../src/world/rng";
import {heading, note, num, percent, row} from "./report";
import {
  BUOYANCY_BODIES,
  BUOYANCY_SAMPLE_EVERY,
  BUOYANCY_TICKS,
  SEED,
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
