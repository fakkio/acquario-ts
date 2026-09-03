import {mountCamera} from "./app/camera";
import {mountCanvas} from "./app/canvas";
import {mountControls} from "./app/controls";
import {mountHud} from "./app/hud";
import {frameAquarium, renderWorld} from "./app/render";
import {createRenderLoop} from "./app/renderLoop";
import {
  createWorld,
  getPopulation,
  getSeed,
  getTick,
  getWorstPenetration,
  type World,
} from "./world";

const canvas = mountCanvas();
const ctx = canvas.getContext("2d");
if (!ctx) {
  throw new Error("Canvas 2D context unavailable");
}

const seed = Date.now() >>> 0;
const world = createWorld(seed);
let latestWorld = world;
let showGrid = false;

const hud = mountHud();
const updateHud = (currentWorld: World): void => {
  hud.setField("tick", "Tick", String(getTick(currentWorld)));
  hud.setField("seed", "Seed", String(getSeed(currentWorld)));
  hud.setField(
    "population",
    "Population",
    String(getPopulation(currentWorld).length),
  );
  // M1's invariant, live: how deep the worst-overlapping pair stands, in
  // baseline body radii. Three decimals, because what the row is watched for
  // is whether the number sits at zero or holds a floor — not what its fourth
  // digit is. On a settled run it reads 0.000 and flashes to a tenth or so
  // when two bodies collide, a few times a minute.
  hud.setField(
    "penetration",
    "Worst penetration",
    getWorstPenetration(currentWorld).toFixed(3),
  );
};

// Everything that can change what the canvas should show — a tick, a camera
// gesture, a resize, the grid overlay going on or off — repaints through
// here, so a new render option has one call site to reach rather than four.
const repaint = (): void => {
  renderWorld(ctx, canvas, latestWorld, camera.getCamera(), {showGrid});
};

const camera = mountCamera(canvas, frameAquarium(canvas), repaint);

const loop = createRenderLoop({
  world,
  onAdvance: (nextWorld) => {
    latestWorld = nextWorld;
    repaint();
    updateHud(nextWorld);
  },
});

repaint();
updateHud(world);

// Resizing the canvas resets its backing store, so whatever was on it is
// gone. Nothing repaints it while the sim is paused, which used to leave a
// blank window until the next play. The camera is deliberately left where it
// is: re-framing here would throw away a pan the user had made.
window.addEventListener("resize", repaint);

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
controls.gridButton.addEventListener("click", () => {
  showGrid = !showGrid;
  controls.gridButton.textContent = showGrid ? "Hide grid" : "Show grid";
  // Repainted here rather than left to the next tick, so the overlay answers
  // the click while the simulation is paused too.
  repaint();
});
