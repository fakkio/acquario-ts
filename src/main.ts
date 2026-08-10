import {mountCamera} from "./app/camera";
import {mountCanvas} from "./app/canvas";
import {mountControls} from "./app/controls";
import {mountHud} from "./app/hud";
import {renderWorld} from "./app/render";
import {createRenderLoop} from "./app/renderLoop";
import {createWorld, getSeed, getTick, type World} from "./world";

const canvas = mountCanvas();
const ctx = canvas.getContext("2d");
if (!ctx) {
  throw new Error("Canvas 2D context unavailable");
}

const seed = Date.now() >>> 0;
const world = createWorld(seed);
let latestWorld = world;

const hud = mountHud();
const updateHud = (currentWorld: World): void => {
  hud.setField("tick", "Tick", String(getTick(currentWorld)));
  hud.setField("seed", "Seed", String(getSeed(currentWorld)));
};

const camera = mountCamera(canvas, () => {
  renderWorld(ctx, canvas, latestWorld, camera.getCamera());
});

const loop = createRenderLoop({
  world,
  onAdvance: (nextWorld) => {
    latestWorld = nextWorld;
    renderWorld(ctx, canvas, nextWorld, camera.getCamera());
    updateHud(nextWorld);
  },
});

renderWorld(ctx, canvas, world, camera.getCamera());
updateHud(world);

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
