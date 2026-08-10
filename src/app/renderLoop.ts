import {advance, FIXED_DT_MS, type World} from "../world";

export interface RenderLoop {
  play(): void;
  pause(): void;
  step(): void;
  isRunning(): boolean;
}

export interface RenderLoopOptions {
  readonly world: World;
  readonly onAdvance: (world: World) => void;
  readonly requestFrame?: (callback: FrameRequestCallback) => number;
  readonly cancelFrame?: (handle: number) => void;
}

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

  const onFrame = (timestampMs: number): void => {
    const elapsedMs =
      lastTimestampMs === null ? 0 : timestampMs - lastTimestampMs;
    lastTimestampMs = timestampMs;

    ({world} = advance(world, elapsedMs));
    options.onAdvance(world);

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

      ({world} = advance(world, FIXED_DT_MS));
      options.onAdvance(world);
    },
    isRunning() {
      return running;
    },
  };
}
