import {mountCamera} from "./app/camera";
import {mountCanvas} from "./app/canvas";
import {mountControls} from "./app/controls";
import {createDeathEffects} from "./app/deathEffects";
import {
  foldCarrierStatistics,
  foldGeneStatistics,
  type CarrierStat,
  type GeneStat,
} from "./app/geneStatistics";
import {mountHud} from "./app/hud";
import {frameAquarium, renderWorld} from "./app/render";
import {createRenderLoop} from "./app/renderLoop";
import {createSession, isRestartDue} from "./app/session";
import {
  createWorld,
  getCarbonDrift,
  getCumulativeBirths,
  getCumulativeDeaths,
  getMeasuredAlpha,
  getOxygenDrift,
  getBrightAlpha,
  getPoolLevels,
  getPopulation,
  getSeed,
  getTick,
  getWorstPenetration,
  getZeroEnergyCount,
  ORGANELLE_TYPES,
  type OrganelleType,
  type World,
} from "./world";

/**
 * A drift near 0 is the whole point of the row: exponential notation keeps
 * a leak visible in whatever digit it first shows up in, from the twelfth
 * significant one on up, rather than being hidden by fixed-point rounding.
 */
const formatDrift = (drift: number): string => drift.toExponential(3);

/**
 * How much weight each tick's fresh `α` reading carries in the HUD's
 * running average (ADR-0015): low, because the raw reading is a per-tick
 * mean over a whole population and jitters tick to tick even at a real
 * steady state — the row is worth having only once it has settled into
 * something legible to read at a glance. The bright-band reading (ADR-0023)
 * gets its own running average, smoothed the same way and reset alongside
 * it, so the two rows stay comparable.
 */
const ALPHA_SMOOTHING = 0.02;
let smoothedAlpha = 0;
let smoothedBrightAlpha = 0;

/** M7's roster is every type the world knows; `roster` joins `WorldOptions` in #63. */
const ROSTER = Object.keys(ORGANELLE_TYPES) as OrganelleType[];

const formatCarrier = (value: CarrierStat | undefined): string =>
  value === undefined
    ? "-"
    : `${(value.fraction * 100).toFixed(1)}% × ${value.meanCountPerCarrier.toFixed(2)}`;

const formatStat = (value: GeneStat): string =>
  `${value.mean.toFixed(3)} ± ${value.sigma.toFixed(3)}`;

const canvas = mountCanvas();
const ctx = canvas.getContext("2d");
if (!ctx) {
  throw new Error("Canvas 2D context unavailable");
}

const masterSeed = Date.now() >>> 0;
const session = createSession(masterSeed);
// The first world uses the master seed directly; every world after it
// draws its seed from the session (ADR-0018), so one master seed
// reproduces the whole sequence, extinctions included.
const world = createWorld(masterSeed);
let latestWorld = world;
let showGrid = false;
// On by default from M5 (ADR-0018): M4's worlds could never breed, so a
// restart showed nothing; M5's calibrated constants are what makes leaving
// the tab open show a sequence of worlds rather than one dead aquarium.
let autoRestart = true;

const hud = mountHud();
const updateHud = (currentWorld: World, fps: number): void => {
  hud.setField("fps", "FPS", fps.toFixed(0));
  hud.setField("tick", "Tick", String(getTick(currentWorld)));
  hud.setField("seed", "Seed", String(getSeed(currentWorld)));
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

  const pools = getPoolLevels(currentWorld);
  hud.setField("poolFood", "Pool food", pools.food.toFixed(2));
  hud.setField("poolCO2", "Pool CO₂", pools.carbonDioxide.toFixed(2));
  hud.setField("poolO2", "Pool O₂", pools.oxygen.toFixed(2));
  hud.setField(
    "carbonDrift",
    "Carbon drift",
    formatDrift(getCarbonDrift(currentWorld)),
  );
  hud.setField(
    "oxygenDrift",
    "Oxygen drift",
    formatDrift(getOxygenDrift(currentWorld)),
  );
  hud.setField(
    "zeroEnergy",
    "Zero-energy",
    String(getZeroEnergyCount(currentWorld)),
  );
  // Population, births and deaths are set together (ticket #30) so they
  // read on the HUD as one group: population is the number that finally
  // moves once a world can grow, and it only means something read beside
  // how it got there.
  hud.setField(
    "population",
    "Population",
    String(getPopulation(currentWorld).length),
  );
  hud.setField("births", "Births", String(getCumulativeBirths(currentWorld)));
  hud.setField("deaths", "Deaths", String(getCumulativeDeaths(currentWorld)));
  // Smoothed here, in the App layer, per ADR-0015: a moving average kept in
  // the world would be state crossing tick boundaries with no reader inside
  // a tick, so it would only enter `hashState` for the sake of this row.
  // Shown beside the bright-band reading (ADR-0023) so the gap between the
  // two ecologies — everyone, versus only who can actually breed — is
  // visible while the run is happening rather than only in a report.
  smoothedAlpha +=
    (getMeasuredAlpha(currentWorld) - smoothedAlpha) * ALPHA_SMOOTHING;
  hud.setField("alpha", "α whole (energy/r)", smoothedAlpha.toFixed(2));
  smoothedBrightAlpha +=
    (getBrightAlpha(currentWorld) - smoothedBrightAlpha) * ALPHA_SMOOTHING;
  hud.setField(
    "alphaBright",
    "α bright (energy/r)",
    smoothedBrightAlpha.toFixed(2),
  );

  // Gene mean ± σ (ADR-0011), folded here rather than read off a world
  // reader — the same call ADR-0015 made for `α` smoothing above.
  const population = getPopulation(currentWorld);
  const geneStats = foldGeneStatistics(population);
  hud.setField(
    "geneCytoplasmThickness",
    "Cytoplasm thickness (μ±σ)",
    formatStat(geneStats.cytoplasmThickness),
  );
  hud.setField(
    "bodyRadius",
    "Body radius (μ±σ)",
    formatStat(geneStats.bodyRadius),
  );
  hud.setField(
    "geneMitosisThreshold",
    "Mitosis threshold (μ±σ)",
    formatStat(geneStats.mitosisEnergyThreshold),
  );
  hud.setField(
    "geneChildAllocation",
    "Child allocation (μ±σ)",
    formatStat(geneStats.childAllocationRatio),
  );
  hud.setField(
    "geneLineageHue",
    "Lineage hue (μ±σ)",
    formatStat(geneStats.lineageHue),
  );

  // Structural genes cannot be averaged by name: one row per roster type,
  // the fraction carrying at least one and the mean count per carrier.
  const carrierStats = foldCarrierStatistics(population, ROSTER);
  for (const type of ROSTER) {
    hud.setField(
      `carriers.${type}`,
      `${type} carriers (fraction × count)`,
      formatCarrier(carrierStats[type]),
    );
  }
};

const deathEffects = createDeathEffects();

// Everything that can change what the canvas should show — a tick, a camera
// gesture, a resize, the grid overlay going on or off — repaints through
// here, so a new render option has one call site to reach rather than four.
// `nowMs` drives the death-effect layer only; it defaults to the actual
// clock so a caller with no timestamp handy (a button click, a resize)
// still animates it correctly.
const repaint = (nowMs: number = performance.now()): void => {
  renderWorld(ctx, canvas, latestWorld, camera.getCamera(), {
    showGrid,
    deathEffects,
    nowMs,
  });
};

const camera = mountCamera(canvas, frameAquarium(canvas), repaint);

// The world never restarts itself (ADR-0018): this is the whole feature,
// noticing an empty population from outside and rebinding the loop's
// handle to a freshly constructed world.
const restart = (): void => {
  const newWorld = createWorld(session.nextWorldSeed());
  loop.setWorld(newWorld);
  latestWorld = newWorld;
  // A fresh world's own α has produced nothing yet; carrying the last
  // world's smoothed reading across the restart would flash a stale number.
  smoothedAlpha = 0;
  smoothedBrightAlpha = 0;
  updateHud(newWorld, 0);
  repaint();
};

const loop = createRenderLoop({
  world,
  onAdvance: (nextWorld, fps) => {
    latestWorld = nextWorld;
    updateHud(nextWorld, fps);
    if (isRestartDue(getPopulation(nextWorld).length, autoRestart)) {
      restart();
    }
  },
});

repaint();
updateHud(world, 0);

// Resizing the canvas resets its backing store, so whatever was on it is
// gone. Nothing repaints it while the sim is paused, which used to leave a
// blank window until the next play. The camera is deliberately left where it
// is: re-framing here would throw away a pan the user had made.
window.addEventListener("resize", () => {
  repaint();
});

// A dedicated animation loop, independent of `loop`'s play/pause state: the
// death effect is driven by wall-clock (ticket #24), so it has to keep
// animating while the sim is paused, which means the canvas needs a repaint
// every frame regardless of whether a tick ran. `loop`'s own `onAdvance`
// (above) deliberately does not repaint any more — this loop is the sole
// caller of `repaint` now, so a tick landing and an animation frame firing
// can never double-draw the same frame.
const animate = (nowMs: number): void => {
  repaint(nowMs);
  requestAnimationFrame(animate);
};
requestAnimationFrame(animate);

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
controls.newWorldButton.addEventListener("click", () => {
  restart();
});
controls.autoRestartButton.addEventListener("click", () => {
  autoRestart = !autoRestart;
  controls.autoRestartButton.textContent = autoRestart
    ? "Auto-restart: on"
    : "Auto-restart: off";
});
