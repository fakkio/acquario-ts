import {createRngStream, type RngStream} from "./rng";

/**
 * Fixed simulation step, decoupled from `requestAnimationFrame`. Every
 * world quantity from M1 onward is expressed as a rate × this value, never
 * per frame.
 */
export const FIXED_DT_MS = 1000 / 60;

/**
 * Bounds how much real time a single `advance` call will turn into ticks,
 * so a tab backgrounded for minutes can't trigger a catch-up "spiral of
 * death" on resume. Excess elapsed time beyond the cap is dropped, not
 * carried forward.
 */
const MAX_TICKS_PER_ADVANCE = 240;

/**
 * Guards the tick-count division against floating-point drift: summing
 * fractional-millisecond remainders across many `advance` calls can leave
 * the accumulator a hair under a full tick's worth of time.
 */
const EPSILON_MS = 1e-9;

declare const worldBrand: unique symbol;

/**
 * Opaque outside this module: the type carries none of its own fields, so
 * a consumer can hold a `World` and pass it to `advance`/`hashState` but
 * cannot read its tick count, accumulator remainder or PRNG state directly.
 */
export interface World {
  readonly [worldBrand]: never;
}

interface WorldState {
  readonly seed: number;
  readonly tick: number;
  readonly accumulatorMs: number;
  readonly globalRng: RngStream;
}

function toWorld(state: WorldState): World {
  return state as unknown as World;
}

function toState(world: World): WorldState {
  return world as unknown as WorldState;
}

export interface AdvanceResult {
  readonly world: World;
  readonly ticksRun: number;
}

export function createWorld(seed: number): World {
  return toWorld({
    seed,
    tick: 0,
    accumulatorMs: 0,
    globalRng: createRngStream(seed),
  });
}

export function advance(world: World, elapsedMs: number): AdvanceResult {
  const state = toState(world);
  const maxAccumulatorMs = MAX_TICKS_PER_ADVANCE * FIXED_DT_MS;
  const accumulatorMs = Math.min(
    state.accumulatorMs + elapsedMs,
    maxAccumulatorMs,
  );

  const ticksRun = Math.floor((accumulatorMs + EPSILON_MS) / FIXED_DT_MS);

  return {
    world: toWorld({
      ...state,
      tick: state.tick + ticksRun,
      accumulatorMs: Math.max(0, accumulatorMs - ticksRun * FIXED_DT_MS),
    }),
    ticksRun,
  };
}

export function hashState(world: World): string {
  const state = toState(world);
  const input = `${String(state.seed)}|${String(state.tick)}|${String(state.globalRng.state)}`;

  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}
