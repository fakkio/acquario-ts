import {advance, FIXED_DT_MS, type World} from "../world";

export interface RenderLoop {
  play(): void;
  pause(): void;
  step(): void;
  isRunning(): boolean;
  /** Swaps in a new world without touching whether the loop is running or
   * its fps smoothing — a session restart (ADR-0018) replaces what
   * `advance` is called on, not the loop driving it. */
  setWorld(nextWorld: World): void;
}

export interface RenderLoopOptions {
  readonly world: World;
  readonly onAdvance: (world: World, fps: number) => void;
  readonly requestFrame?: (callback: FrameRequestCallback) => number;
  readonly cancelFrame?: (handle: number) => void;
}

// Exponential moving average, not the raw instantaneous reading: frame time
// jitters tick to tick even at a stable rate, and an unsmoothed HUD number is
// unreadable. 0.1 settles within roughly a second at 60fps.
const FPS_SMOOTHING = 0.1;

/**
 * Drives `World.advance` from `requestAnimationFrame` while running, and
 * exposes a `step` escape hatch that advances exactly one fixed tick while
 * paused — both the running and stepped paths only ever call `World`'s
 * public functions.
 */
export function createRenderLoop(options: RenderLoopOptions): RenderLoop {
  const requestFrame = options.requestFrame ?? requestAnimationFrame;
  const cancelFrame = options.cancelFrame ?? cancelAnimationFrame;

  let world = options.world;
  let running = false;
  let frameHandle: number | null = null;
  let lastTimestampMs: number | null = null;
  let smoothedFps = 0;

  const onFrame = (timestampMs: number): void => {
    const elapsedMs =
      lastTimestampMs === null ? 0 : timestampMs - lastTimestampMs;
    lastTimestampMs = timestampMs;

    if (elapsedMs > 0) {
      const instantFps = 1000 / elapsedMs;
      smoothedFps =
        smoothedFps === 0
          ? instantFps
          : smoothedFps + (instantFps - smoothedFps) * FPS_SMOOTHING;
    }

    ({world} = advance(world, elapsedMs));
    options.onAdvance(world, smoothedFps);

    frameHandle = requestFrame(onFrame);
  };

  return {
    play() {
      if (running) {
        return;
      }

      running = true;
      lastTimestampMs = null;
      frameHandle = requestFrame(onFrame);
    },
    pause() {
      if (!running) {
        return;
      }

      running = false;
      if (frameHandle !== null) {
        cancelFrame(frameHandle);
        frameHandle = null;
      }
    },
    step() {
      if (running) {
        return;
      }

      // No rAF frame backs a manual step, so the last-known fps would just
      // sit there frozen and misread as a live rate. 0 says "not applicable".
      ({world} = advance(world, FIXED_DT_MS));
      options.onAdvance(world, 0);
    },
    isRunning() {
      return running;
    },
    setWorld(nextWorld) {
      world = nextWorld;
    },
  };
}
