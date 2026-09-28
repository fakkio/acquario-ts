import {
  createWorld,
  getCumulativeBirths,
  getCumulativeDeaths,
  getPopulation,
  isBright,
  type OrganismView,
} from "../src/world";
import {reportIncome} from "./calibration/income";
import {environment, overrideNames} from "./calibration/settings";
import {runTicksWatching} from "./calibration/worlds";

/**
 * EXPERIMENT ONLY (#40, throwaway branch). One variant of the world — its
 * constants set through `ACQUARIO_*` like `npm run calibrate` — run unprimed
 * over several seeds, printing one JSON object: per seed, time to
 * extinction or survival, the trajectory, births, tenancy (the harness's
 * own definition, `live.ts`), and, when `EXP_INCOME=1`, the income ladder's
 * `n` and `r_max` for the same constants.
 *
 *     EXP_SEED=7 ACQUARIO_CONFINE_DEPTH=10 node --import ./scripts/ts-esm-resolver.mjs scripts/extinction.ts
 */

const env = environment();
const TICKS = Number(env.EXP_TICKS ?? 100_000);
const SAMPLE_EVERY = Number(env.EXP_SAMPLE_EVERY ?? 1_000);
const STAY_SAMPLE_EVERY = 250; // live.ts's LIVE_SAMPLE_EVERY
const SEEDS = (env.EXP_SEEDS ?? "7,8,9,10,11").split(",").map(Number);

interface Point {
  tick: number;
  size: number;
  births: number;
  deaths: number;
  meanR: number;
  inBand: number;
}

function runSeed(seed: number) {
  const world = createWorld(seed);
  const trajectory: Point[] = [];
  const enteredAt = new Map<OrganismView, number | null>();
  const completedStays: number[] = [];
  let organismTicks = 0; // summed per STAY_SAMPLE_EVERY sample × that period
  let extinctAt: number | null = null;
  let firstBirthTick: number | null = null;
  let peakSize = 0;

  const t0 = Date.now();
  let current = world;
  for (let block = 0; block < TICKS / STAY_SAMPLE_EVERY; block++) {
    current = runTicksWatching(current, STAY_SAMPLE_EVERY, (w, t) => {
      if (firstBirthTick === null && getCumulativeBirths(w) > 0) {
        firstBirthTick = block * STAY_SAMPLE_EVERY + t;
      }
    });
    const tick = (block + 1) * STAY_SAMPLE_EVERY;
    const population = getPopulation(current);
    peakSize = Math.max(peakSize, population.length);
    organismTicks += population.length * STAY_SAMPLE_EVERY;

    const present = new Set(population);
    for (const organism of enteredAt.keys()) {
      if (!present.has(organism)) {
        enteredAt.delete(organism);
      }
    }
    for (const organism of population) {
      const inside = isBright(organism.y);
      const since = enteredAt.get(organism) ?? null;
      if (!enteredAt.has(organism)) {
        enteredAt.set(organism, null);
      }
      if (inside && since === null) {
        enteredAt.set(organism, tick);
      } else if (!inside && since !== null) {
        completedStays.push(tick - since);
        enteredAt.set(organism, null);
      }
    }

    if (tick % SAMPLE_EVERY === 0 || population.length === 0) {
      let radiusSum = 0;
      let inBand = 0;
      for (const organism of population) {
        radiusSum += organism.bodyRadius;
        if (isBright(organism.y)) {
          inBand++;
        }
      }
      trajectory.push({
        tick,
        size: population.length,
        births: getCumulativeBirths(current),
        deaths: getCumulativeDeaths(current),
        meanR: population.length > 0 ? radiusSum / population.length : 0,
        inBand,
      });
    }
    if (population.length === 0) {
      extinctAt = tick;
      break;
    }
  }

  const births = getCumulativeBirths(current);
  const openStays = [...enteredAt.values()].filter((v) => v !== null).length;
  const meanStay =
    completedStays.length > 0
      ? completedStays.reduce((a, b) => a + b, 0) / completedStays.length
      : null;
  const period = births > 0 ? organismTicks / births : null;
  const final = getPopulation(current);
  const last10k = trajectory.filter((p) => p.tick > TICKS - 10_000 && p.size);

  return {
    seed,
    extinctAt,
    firstBirthTick,
    births,
    deaths: getCumulativeDeaths(current),
    peakSize,
    finalSize: final.length,
    completedStays: completedStays.length,
    openStays,
    meanStayTicks: meanStay,
    reproductivePeriod: period,
    tenancy: meanStay !== null && period !== null ? meanStay / period : null,
    meanRLast10k:
      last10k.length > 0
        ? last10k.reduce((a, p) => a + p.meanR, 0) / last10k.length
        : null,
    sizeLast10k:
      last10k.length > 0
        ? last10k.reduce((a, p) => a + p.size, 0) / last10k.length
        : null,
    wallSeconds: (Date.now() - t0) / 1000,
    trajectory,
  };
}

const income =
  env.EXP_INCOME === "1"
    ? (() => {
        const report = reportIncome();
        return {
          nSettled: report.exponentSettled,
          nAll: report.exponentAllRungs,
          rMax: report.maxReproductiveRadius,
        };
      })()
    : null;

const runs = env.EXP_INCOME_ONLY === "1" ? [] : SEEDS.map(runSeed);

console.log(
  JSON.stringify({
    variant: env.EXP_VARIANT ?? "unnamed",
    overrides: overrideNames().map((name) => `${name}=${env[name] ?? ""}`),
    income,
    runs,
  }),
);
