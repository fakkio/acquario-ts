import {mountCanvas} from "./app/canvas";
import {mountControls} from "./app/controls";
import {renderWorld} from "./app/render";
import {createRenderLoop} from "./app/renderLoop";
import {createWorld} from "./world";

const canvas = mountCanvas();
const ctx = canvas.getContext("2d");
if (!ctx) {
  throw new Error("Canvas 2D context unavailable");
}

const seed = Date.now() >>> 0;
const world = createWorld(seed);

const loop = createRenderLoop({
  world,
  onAdvance: (nextWorld) => {
    renderWorld(ctx, canvas, nextWorld);
  },
});

renderWorld(ctx, canvas, world);

const controls = mountControls();
controls.playPauseButton.addEventListener("click", () => {
  if (loop.isRunning()) {
    loop.pause();
    controls.playPauseButton.textContent = "Play";
  } else {
    loop.play();
    controls.playPauseButton.textContent = "Pause";
  }
});
controls.stepButton.addEventListener("click", () => {
  loop.step();
});
