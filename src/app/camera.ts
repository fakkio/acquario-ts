export interface Camera {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly scale: number;
}

export interface CameraController {
  getCamera(): Camera;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 8;

/**
 * Untested per M0's TDD policy (DOM input handling) — mouse drag or a
 * single touch pans, wheel or a two-finger pinch zooms toward the
 * cursor/pinch midpoint. Mouse move/up listen on `window` so a drag doesn't
 * break when the pointer leaves the canvas mid-gesture; touch move/end stay
 * on `canvas` since, unlike mouse events, they keep firing on their original
 * target regardless of where the finger moves. Nothing here reaches into
 * `World`. `onChange` fires after every pan/zoom update so the caller can
 * repaint immediately even while the sim is paused — camera motion is
 * independent of `World` ticks.
 *
 * `initial` is where the camera rests before the first gesture. It is the
 * caller's business rather than a hardcoded `{0, 0, 1}` because framing the
 * aquarium needs both the canvas size and the render layer's pixels-per-unit,
 * and neither of those belongs here.
 */
export function mountCamera(
  canvas: HTMLCanvasElement,
  initial: Camera,
  onChange: () => void,
): CameraController {
  let offsetX = initial.offsetX;
  let offsetY = initial.offsetY;
  let scale = initial.scale;
  let dragging = false;
  let lastClientX = 0;
  let lastClientY = 0;
  const activeTouches = new Map<number, Point>();
  let pinchStartDistance = 0;
  let pinchStartScale = 1;

  const panBy = (dx: number, dy: number): void => {
    offsetX += dx;
    offsetY += dy;
    onChange();
  };

  const zoomAt = (point: Point, nextScale: number): void => {
    offsetX = point.x - ((point.x - offsetX) * nextScale) / scale;
    offsetY = point.y - ((point.y - offsetY) * nextScale) / scale;
    scale = nextScale;
    onChange();
  };

  canvas.addEventListener("mousedown", (event) => {
    dragging = true;
    lastClientX = event.clientX;
    lastClientY = event.clientY;
  });

  window.addEventListener("mousemove", (event) => {
    if (!dragging) {
      return;
    }

    panBy(event.clientX - lastClientX, event.clientY - lastClientY);
    lastClientX = event.clientX;
    lastClientY = event.clientY;
  });

  window.addEventListener("mouseup", () => {
    dragging = false;
  });

  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();

      const rect = canvas.getBoundingClientRect();
      const nextScale = clamp(
        scale * Math.exp(-event.deltaY * 0.001),
        MIN_SCALE,
        MAX_SCALE,
      );

      zoomAt(
        {x: event.clientX - rect.left, y: event.clientY - rect.top},
        nextScale,
      );
    },
    {passive: false},
  );

  const touchPoint = (touch: Touch, rect: DOMRect): Point => ({
    x: touch.clientX - rect.left,
    y: touch.clientY - rect.top,
  });

  const distance = (a: Point, b: Point): number =>
    Math.hypot(a.x - b.x, a.y - b.y);

  const midpoint = (a: Point, b: Point): Point => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });

  const startPinch = (): void => {
    const [a, b] = [...activeTouches.values()];
    pinchStartDistance = distance(a, b);
    pinchStartScale = scale;
  };

  canvas.addEventListener(
    "touchstart",
    (event) => {
      event.preventDefault();

      const rect = canvas.getBoundingClientRect();
      for (const touch of event.changedTouches) {
        activeTouches.set(touch.identifier, touchPoint(touch, rect));
      }

      if (activeTouches.size === 2) {
        startPinch();
      }
    },
    {passive: false},
  );

  canvas.addEventListener(
    "touchmove",
    (event) => {
      event.preventDefault();

      const rect = canvas.getBoundingClientRect();
      const previousTouches = new Map(activeTouches);
      for (const touch of event.changedTouches) {
        activeTouches.set(touch.identifier, touchPoint(touch, rect));
      }

      if (activeTouches.size === 1) {
        const [[id, point]] = [...activeTouches.entries()];
        const previousPoint = previousTouches.get(id);
        if (previousPoint) {
          panBy(point.x - previousPoint.x, point.y - previousPoint.y);
        }
      } else if (activeTouches.size === 2) {
        const [a, b] = [...activeTouches.values()];
        const nextScale =
          pinchStartDistance > 0
            ? clamp(
                (distance(a, b) / pinchStartDistance) * pinchStartScale,
                MIN_SCALE,
                MAX_SCALE,
              )
            : scale;

        zoomAt(midpoint(a, b), nextScale);
      }
    },
    {passive: false},
  );

  const endTouch = (event: TouchEvent): void => {
    for (const touch of event.changedTouches) {
      activeTouches.delete(touch.identifier);
    }

    if (activeTouches.size === 2) {
      startPinch();
    }
  };

  canvas.addEventListener("touchend", endTouch);
  canvas.addEventListener("touchcancel", endTouch);

  return {
    getCamera() {
      return {offsetX, offsetY, scale};
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
