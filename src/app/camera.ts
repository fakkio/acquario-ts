export interface Camera {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly scale: number;
}

export interface CameraController {
  getCamera(): Camera;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 8;

/**
 * Untested per M0's TDD policy (DOM input handling) — mouse drag pans,
 * wheel zooms toward the cursor. Listens on `canvas` for the gestures that
 * start there, but on `window` for move/up so a drag doesn't break when the
 * pointer leaves the canvas mid-gesture; nothing here reaches into `World`.
 * `onChange` fires after every pan/zoom update so the caller can repaint
 * immediately even while the sim is paused — camera motion is independent
 * of `World` ticks.
 */
export function mountCamera(
  canvas: HTMLCanvasElement,
  onChange: () => void,
): CameraController {
  let offsetX = 0;
  let offsetY = 0;
  let scale = 1;
  let dragging = false;
  let lastClientX = 0;
  let lastClientY = 0;

  canvas.addEventListener("mousedown", (event) => {
    dragging = true;
    lastClientX = event.clientX;
    lastClientY = event.clientY;
  });

  window.addEventListener("mousemove", (event) => {
    if (!dragging) {
      return;
    }

    offsetX += event.clientX - lastClientX;
    offsetY += event.clientY - lastClientY;
    lastClientX = event.clientX;
    lastClientY = event.clientY;
    onChange();
  });

  window.addEventListener("mouseup", () => {
    dragging = false;
  });

  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();

      const rect = canvas.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;

      const nextScale = clamp(
        scale * Math.exp(-event.deltaY * 0.001),
        MIN_SCALE,
        MAX_SCALE,
      );

      offsetX = pointerX - ((pointerX - offsetX) * nextScale) / scale;
      offsetY = pointerY - ((pointerY - offsetY) * nextScale) / scale;
      scale = nextScale;
      onChange();
    },
    {passive: false},
  );

  return {
    getCamera() {
      return {offsetX, offsetY, scale};
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
