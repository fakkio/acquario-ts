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
import {mountInspector} from "./app/inspector";
import {frameAquarium, renderWorld, screenToWorld} from "./app/render";
import {createRenderLoop} from "./app/renderLoop";
import {
  NO_SELECTION,
  pickOrganism,
  updateSelection,
  type Selection,
} from "./app/selection";
import {createSession, isRestartDue} from "./app/session";
import {
  AQUARIUM_AREA,
  createWorld,
  getCarbonDrift,
  getCumulativeBirths,
  getCumulativeDeaths,
  getMeasuredAlpha,
  getOxygenDrift,
  getBrightAlpha,
  getPoolCapacities,
  getPoolLevels,
  getPopulation,
  getSeed,
  getTick,
  getWorstPenetration,
  getZeroEnergyCount,
  DEFAULT_ROSTER,
  type TickFlows,
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

/** The roster every world the app builds runs with, and the HUD reports. */
const ROSTER = DEFAULT_ROSTER;

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
const world = createWorld(masterSeed, {roster: ROSTER});
let latestWorld = world;
let showGrid = false;
let selection: Selection = NO_SELECTION;
// What the last tick did to the selected organism's stores, for the inspector.
let selectedFlows: TickFlows | null = null;
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
  // Each level beside the most it can hold: the world's starting carbon (or
  // oxygen), since a pool has no cap of its own. `c` is the ambient
  // concentration, the number passive exchange actually reads.
  const capacities = getPoolCapacities(currentWorld);
  const formatPool = (level: number, capacity: number): string =>
    `${level.toFixed(2)} / ${capacity.toFixed(0)} (${((level / capacity) * 100).toFixed(0)}%), c ${(level / AQUARIUM_AREA).toFixed(2)}`;
  hud.setField(
    "poolFood",
    "Pool food",
    formatPool(pools.food, capacities.food),
  );
  hud.setField(
    "poolCO2",
    "Pool CO₂",
    formatPool(pools.carbonDioxide, capacities.carbonDioxide),
  );
  hud.setField(
    "poolO2",
    "Pool O₂",
    formatPool(pools.oxygen, capacities.oxygen),
  );
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
    selected: selection.kind === "alive" ? selection.organism : undefined,
  });
};

const camera = mountCamera(canvas, frameAquarium(canvas), repaint);

// The world never restarts itself (ADR-0018): this is the whole feature,
// noticing an empty population from outside and rebinding the loop's
// handle to a freshly constructed world.
const restart = (): void => {
  const newWorld = createWorld(session.nextWorldSeed(), {roster: ROSTER});
  loop.setWorld(newWorld);
  latestWorld = newWorld;
  // The old world's organisms are gone; a selection would point at nothing.
  selection = NO_SELECTION;
  selectedFlows = null;
  // A fresh world's own α has produced nothing yet; carrying the last
  // world's smoothed reading across the restart would flash a stale number.
  smoothedAlpha = 0;
  smoothedBrightAlpha = 0;
  updateHud(newWorld, 0);
  repaint();
};

const loop = createRenderLoop({
  world,
  trace: () => (selection.kind === "alive" ? selection.organism : undefined),
  onAdvance: (nextWorld, fps, flows) => {
    latestWorld = nextWorld;
    selectedFlows = flows;
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
const inspector = mountInspector();
const animate = (nowMs: number): void => {
  selection = updateSelection(
    selection,
    getPopulation(latestWorld),
    getTick(latestWorld),
    nowMs,
  );
  inspector.render(selection, selectedFlows);
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

// A click selects, a drag pans (the camera owns drags): the two are told
// apart by how far the pointer travelled between press and release.
const CLICK_MAX_TRAVEL_PX = 4;
let pressX = 0;
let pressY = 0;
canvas.addEventListener("mousedown", (event) => {
  pressX = event.clientX;
  pressY = event.clientY;
});
canvas.addEventListener("mouseup", (event) => {
  if (
    Math.hypot(event.clientX - pressX, event.clientY - pressY) >
    CLICK_MAX_TRAVEL_PX
  ) {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const point = screenToWorld(
    camera.getCamera(),
    event.clientX - rect.left,
    event.clientY - rect.top,
  );
  const picked = pickOrganism(getPopulation(latestWorld), point.x, point.y);
  selection = picked ? {kind: "alive", organism: picked} : NO_SELECTION;
  selectedFlows = null;
  repaint();
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    selection = NO_SELECTION;
    selectedFlows = null;
    repaint();
  }
});
