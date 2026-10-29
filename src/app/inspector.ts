import {
  BIAS_NEW,
  DISCHARGE_FACTOR_NEW,
  TAU_NEW,
  THRESHOLD_NEW,
} from "../world/constants";
import {
  AQUARIUM_AREA,
  BODY_ID,
  birthCosts,
  bodyAreaOfRadius,
  buoyantTorque,
  buoyantWeight,
  DRAG_PER_RADIUS,
  energyCap,
  INNATE_SENSES,
  isSynapseGene,
  maintenanceBreakdown,
  senseSlot,
  ORGANELLE_TYPES,
  restingDepth,
  ROTATIONAL_DRAG_PER_CUBE,
  turn,
  type OrganelleType,
  type SynapseEndpoint,
  type OrganismView,
  type Pools,
  type Resource,
  type Thruster,
  type TickFlows,
} from "../world";
import type {Selection} from "./selection";

/**
 * The inspector (`docs/vision.md` § Interface, v0.2's first version): a DOM
 * panel in the HUD's style that reads the selected organism's view. It shows
 * the numbers the tick charges rather than recomputing them — maintenance
 * comes from `maintenanceBreakdown`, the world module's own function.
 * Untested per ADR-0013's TDD boundary: verified by running the app.
 */
export interface Inspector {
  /** Redraws the panel for this frame's selection. Cheap when nothing
   * changed: the organelle table is only rebuilt for a new organism. */
  render(selection: Selection, flows: TickFlows | null, pools: Pools): void;
}

const fixed = (value: number, digits = 3): string => value.toFixed(digits);

/** The Buoyant Weight with its direction: positive pulls towards the floor. */
const buoyantWeightText = (organism: OrganismView): string => {
  const weight = buoyantWeight(organism.moments, organism.y, organism.axis);

  return weight === 0
    ? "0"
    : `${signed(weight)} (${weight > 0 ? "down" : "up"})`;
};

/** The Body Axis in degrees from the vertical (0 upright, positive turned
 * clockwise on the screen), and the torque turning it. */
const axisText = (organism: OrganismView): string => {
  const torque = buoyantTorque(organism.moments, organism.y, organism.axis);

  // The body's up, `(0, −1)` in its own frame, turned into the world.
  const up = turn(organism.axis, 0, -1);

  return `${fixed(fromVertical(up.x, up.y), 1)}°  torque ${torque === 0 ? "0" : signed(torque)}`;
};

const degrees = (radians: number): number => (radians * 180) / Math.PI;

/** A direction's angle from straight up in degrees, positive turned clockwise
 * on the screen (whose y runs down). */
const fromVertical = (x: number, y: number): number =>
  degrees(Math.atan2(x, -y));

/** One thruster's push: `|F| = signal × maxForce` along its body-frame
 * direction, and the torque `p × F` it puts on the body, signed as gravity's. */
const thrustOf = (thruster: Thruster, signal: number) => {
  const magnitude = signal * thruster.maxForce;
  const fx = thruster.dx * magnitude;
  const fy = thruster.dy * magnitude;

  return {
    magnitude,
    fx,
    fy,
    torque: thruster.x * fy - thruster.y * fx,
  };
};

/** The thrusters' net force in the world and net torque, with the velocity
 * `ΣF/(6π·R)` and turn rate `τ/(8π·R³)` they give, as the motion step reads
 * them. Empty for a body with no thruster. */
const thrustLines = (organism: OrganismView): string[] => {
  if (organism.thrusters.length === 0) {
    return [];
  }
  let fx = 0;
  let fy = 0;
  let torque = 0;
  for (const [i, thruster] of organism.thrusters.entries()) {
    const push = thrustOf(thruster, organism.thrusterSignals[i]);
    const world = turn(organism.axis, push.fx, push.fy);
    fx += world.x;
    fy += world.y;
    torque += push.torque;
  }
  const drag = DRAG_PER_RADIUS * organism.bodyRadius;
  const turnRate =
    torque / (ROTATIONAL_DRAG_PER_CUBE * organism.bodyRadius ** 3);

  return [
    `  thrust force        ${signed(fx)}, ${signed(fy)}`,
    `  thrust torque       ${signed(torque)}`,
    `  thrust velocity     ${signed(fx / drag)}, ${signed(fy / drag)}`,
    `  thrust turn rate    ${signed(turnRate)} rad/tick`,
  ];
};

/** A synapse endpoint as the table prints it: `body.light`, `7.power`. */
const endpointText = ({id, port}: SynapseEndpoint): string =>
  `${id === BODY_ID ? "body" : String(id)}.${port}`;

/** The Innate Senses as the network read them this tick, one line each. */
const senseLines = (organism: OrganismView): string[] =>
  INNATE_SENSES.map(
    (name, i) => `  ${name.padEnd(7)}${fixed(organism.senses[i])}`,
  );

const restingDepthText = (organism: OrganismView): string => {
  const resting = restingDepth(organism.moments);

  return resting.kind === "interior" ? fixed(resting.depth) : resting.kind;
};

const densityText = (type: OrganelleType): string => {
  const {density} = ORGANELLE_TYPES[type];

  return density === "weightless" ? density : signed(density);
};

const signed = (value: number): string =>
  `${value < 0 ? "−" : "+"}${Math.abs(value).toFixed(3)}`;

/** The steps of a tick, in the order they run, with the short label the panel gives them. */
const FLOW_STEPS = [
  ["exchange", "exch"],
  ["photosynthesisBody", "photo body"],
  ["photosynthesisChloroplasts", "photo chloro"],
  ["respiration", "resp"],
  ["maintenance", "maint"],
  ["thrust", "thrust"],
  ["mitosis", "mitosis"],
] as const;

/** What the last tick did to one store, one term per step that touched it.
 * Always a line, even an empty one, so the panel's height never depends on it. */
const flowsOf = (flows: TickFlows | null, resource: Resource): string => {
  if (!flows) {
    return "    ";
  }

  const terms = FLOW_STEPS.filter(([step]) => flows[step][resource] !== 0).map(
    ([step, label]) => `${signed(flows[step][resource])} ${label}`,
  );

  return terms.length === 0 ? "    (no change)" : `    ${terms.join("  ")}`;
};

/** Energy against its cap and how full it is, the one store with a ceiling
 * (ADR-0035): `937.000/1000.000 (94%)`. */
const energyStore = (organism: OrganismView): string => {
  const cap = energyCap(organism);
  return `${fixed(organism.energy)}/${fixed(cap)} (${(
    (organism.energy / cap) *
    100
  ).toFixed(0)}%)`;
};

/** A diffusible store as its internal Concentration (store per cytoplasm area)
 * next to the ambient one (pool per aquarium area), the comparison that decides
 * which way passive exchange runs: `0.700  ambient 0.500`. */
const concentration = (
  organism: OrganismView,
  pools: Pools,
  resource: Exclude<Resource, "energy">,
): string =>
  `${fixed(organism[resource] / organism.cytoplasmArea)}  ambient ${fixed(
    pools[resource] / AQUARIUM_AREA,
  )}  (${fixed(organism[resource])} held)`;

const BAR_WIDTH = 20;

const bar = (have: number, need: number): string => {
  const ratio = need > 0 ? have / need : 1;
  const filled = Math.round(Math.min(Math.max(ratio, 0), 1) * BAR_WIDTH);
  return `[${"#".repeat(filled)}${"-".repeat(BAR_WIDTH - filled)}] ${(ratio * 100).toFixed(0)}%`;
};

/** How close the organism is to mitosis, one bar per condition the mitosis step
 * gates on: energy against the threshold (`mitosisEnergyThreshold × cap`), and
 * energy and food against the costliest child its mutation could produce
 * (`birthCosts`, the Worst-Case Birth Gate). It breeds when all three are full. */
const mitosisProgress = (
  organism: OrganismView,
  roster: readonly OrganelleType[],
): string[] => {
  const threshold = organism.mitosisEnergyThreshold * energyCap(organism);
  const costs = birthCosts(organism.genome, roster);
  return [
    `  threshold ${bar(organism.energy, threshold)}`,
    `  energy    ${bar(organism.energy, costs.energy)}`,
    `  food      ${bar(organism.food, costs.food)}`,
  ];
};

export function mountInspector(roster: readonly OrganelleType[]): Inspector {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.top = "44px";
  container.style.left = "8px";
  container.style.zIndex = "10";
  // A fixed width, in characters: the text is monospace and its length moves
  // every tick, and an auto-sized panel resized with it, which read as flicker.
  container.style.width = "52ch";
  container.style.boxSizing = "content-box";
  container.style.maxHeight = "calc(100vh - 60px)";
  container.style.overflowY = "auto";
  container.style.padding = "6px 10px";
  container.style.background = "rgba(0, 0, 0, 0.55)";
  container.style.color = "#fff";
  container.style.fontFamily = "monospace";
  container.style.fontSize = "12px";
  // The panel scrolls and its sections fold, so it takes the pointer.
  container.style.pointerEvents = "auto";
  container.style.display = "none";
  document.body.appendChild(container);

  const summary = document.createElement("pre");
  summary.style.margin = "0";
  summary.style.whiteSpace = "pre-wrap";
  const table = document.createElement("table");
  table.style.borderCollapse = "collapse";
  const synapseTable = document.createElement("table");
  synapseTable.style.borderCollapse = "collapse";

  // One folding section per block. The `<details>` are built once and only
  // their text is refilled, so a section keeps its open state, and the panel
  // its scroll, across ticks and across selections.
  const makeSection = (open: boolean) => {
    const details = document.createElement("details");
    details.open = open;
    details.style.marginTop = "6px";
    const title = document.createElement("summary");
    title.style.cursor = "pointer";
    title.style.fontWeight = "bold";
    details.appendChild(title);
    return {details, title};
  };
  const textSection = (open: boolean) => {
    const section = makeSection(open);
    const body = document.createElement("pre");
    body.style.margin = "0";
    body.style.whiteSpace = "pre-wrap";
    section.details.appendChild(body);
    return {...section, body};
  };
  const setText = (element: HTMLElement, text: string): void => {
    if (element.textContent !== text) {
      element.textContent = text;
    }
  };
  const genesSection = textSection(true);
  const bodySection = textSection(true);
  const mitosisSection = textSection(true);
  const maintenanceSection = textSection(false);
  const storesSection = textSection(true);
  const sensesSection = textSection(false);
  const synapsesSection = makeSection(false);
  synapsesSection.details.appendChild(synapseTable);
  const organellesSection = makeSection(false);
  organellesSection.details.appendChild(table);
  const sections = [
    genesSection,
    bodySection,
    mitosisSection,
    maintenanceSection,
    storesSection,
    sensesSection,
    synapsesSection,
    organellesSection,
  ];
  container.append(summary, ...sections.map(({details}) => details));

  let tableFor: OrganismView | null = null;
  // The two columns that change every tick, by organelle id, refilled from
  // the flows without rebuilding the table.
  let readingCells = new Map<
    number,
    {light: HTMLTableCellElement; fixation: HTMLTableCellElement}
  >();
  // A thruster's direction in the world turns with the body, so it is
  // refilled every frame too, by the thruster's place in genome order.
  let worldCells: {
    cell: HTMLTableCellElement;
    thruster: Thruster;
    index: number;
    signal: HTMLTableCellElement;
    force: HTMLTableCellElement;
    torque: HTMLTableCellElement;
  }[] = [];
  // A neuron's memory and signal change every tick, refilled by the neuron's
  // place in genome order.
  let neuronCells: {
    index: number;
    memory: HTMLTableCellElement;
    signal: HTMLTableCellElement;
  }[] = [];
  // The synapse table's last column, the signal each synapse carries this
  // tick, refilled with the rest of the readings.
  let carriedCells: {
    cell: HTMLTableCellElement;
    source: SynapseEndpoint;
    weight: number;
  }[] = [];

  const fillReadings = (
    flows: TickFlows | null,
    organism: OrganismView,
  ): void => {
    for (const {cell, thruster, index, signal, force, torque} of worldCells) {
      const world = turn(organism.axis, thruster.dx, thruster.dy);
      cell.textContent = `${fixed(fromVertical(world.x, world.y), 1)}°`;
      const live = organism.thrusterSignals[index];
      const push = thrustOf(thruster, live);
      signal.textContent = fixed(live);
      force.textContent = fixed(push.magnitude, 5);
      torque.textContent = signed(push.torque);
    }
    for (const {index, memory, signal} of neuronCells) {
      memory.textContent = signed(organism.neuronMemories[index]);
      signal.textContent = signed(organism.neuronSignals[index]);
    }
    for (const {cell, source, weight} of carriedCells) {
      const sense = senseSlot(source);
      cell.textContent =
        sense < 0 ? "" : signed(weight * organism.senses[sense]);
    }
    for (const [id, cells] of readingCells) {
      const reading = flows?.discs.find((disc) => disc.innovationId === id);
      cells.light.textContent = reading ? fixed(reading.light) : "";
      cells.fixation.textContent = reading ? fixed(reading.fixation, 5) : "";
    }
  };

  const buildSynapseTable = (organism: OrganismView): void => {
    const synapses = organism.genome.genes.filter(isSynapseGene);
    if (synapses.length === 0) {
      return;
    }
    const head = synapseTable.insertRow();
    for (const title of ["id", "source", "destination", "weight", "carries"]) {
      const cell = document.createElement("th");
      cell.textContent = title;
      cell.style.textAlign = "right";
      cell.style.padding = "0 6px";
      head.appendChild(cell);
    }
    for (const synapse of synapses) {
      const row = synapseTable.insertRow();
      const cells = [
        String(synapse.innovationId),
        endpointText(synapse.source),
        endpointText(synapse.destination),
        signed(synapse.weight),
        "",
      ].map((value) => {
        const cell = row.insertCell();
        cell.textContent = value;
        cell.style.textAlign = "right";
        cell.style.padding = "0 6px";
        return cell;
      });
      carriedCells.push({
        cell: cells[4],
        source: synapse.source,
        weight: synapse.weight,
      });
    }
  };

  const rebuildTable = (organism: OrganismView): void => {
    table.replaceChildren();
    synapseTable.replaceChildren();
    readingCells = new Map();
    worldCells = [];
    neuronCells = [];
    carriedCells = [];
    buildSynapseTable(organism);
    if (organism.organelles.length === 0) {
      tableFor = organism;
      return;
    }

    const head = table.insertRow();
    for (const title of [
      "type",
      "id",
      "radius",
      "x",
      "y",
      "density",
      "light",
      "fixation",
      "dir body",
      "dir world",
      "drive",
      "|F|",
      "torque",
      "τ",
      "bias",
      "threshold",
      "discharge",
      "memory",
      "signal",
    ]) {
      const cell = document.createElement("th");
      cell.textContent = title;
      cell.style.textAlign = "right";
      cell.style.padding = "0 6px";
      head.appendChild(cell);
    }
    let thrusterIndex = 0;
    let neuronIndex = 0;
    for (const organelle of organism.organelles) {
      const row = table.insertRow();
      const values = [
        organelle.type,
        String(organelle.innovationId),
        fixed(organelle.radius),
        fixed(organelle.x),
        fixed(organelle.y),
        densityText(organelle.type),
      ];
      for (const value of values) {
        const cell = row.insertCell();
        cell.textContent = value;
        cell.style.textAlign = "right";
        cell.style.padding = "0 6px";
      }
      // Empty for every type that declares no photosynthesis coefficient.
      const light = row.insertCell();
      const fixation = row.insertCell();
      for (const cell of [light, fixation]) {
        cell.style.textAlign = "right";
        cell.style.padding = "0 6px";
      }
      if (ORGANELLE_TYPES[organelle.type].photosynthesis !== undefined) {
        readingCells.set(organelle.innovationId, {light, fixation});
      }

      // Empty for every type without a thrust declaration. Thrusters are the
      // organelles that declare one, in genome order (`Body.thrusters`).
      const thrustCells = Array.from({length: 5}, () => row.insertCell());
      for (const cell of thrustCells) {
        cell.style.textAlign = "right";
        cell.style.padding = "0 6px";
      }
      const thrusterAt =
        ORGANELLE_TYPES[organelle.type].thrust !== undefined
          ? thrusterIndex++
          : undefined;
      if (thrusterAt !== undefined) {
        const thruster = organism.thrusters[thrusterAt];
        thrustCells[0].textContent = `${fixed(fromVertical(thruster.dx, thruster.dy), 1)}°`;
        worldCells.push({
          cell: thrustCells[1],
          thruster,
          index: thrusterAt,
          signal: thrustCells[2],
          force: thrustCells[3],
          torque: thrustCells[4],
        });
      }

      // Empty for every type without an output port: the neurons, in genome
      // order (`CompiledNetwork.neurons`).
      const neuronCellsOfRow = Array.from({length: 6}, () => row.insertCell());
      for (const cell of neuronCellsOfRow) {
        cell.style.textAlign = "right";
        cell.style.padding = "0 6px";
      }
      if (ORGANELLE_TYPES[organelle.type].outputPorts !== undefined) {
        const {tau, bias, threshold, dischargeFactor} = organelle;
        neuronCellsOfRow[0].textContent = fixed(tau ?? TAU_NEW);
        neuronCellsOfRow[1].textContent = signed(bias ?? BIAS_NEW);
        neuronCellsOfRow[2].textContent = fixed(threshold ?? THRESHOLD_NEW);
        neuronCellsOfRow[3].textContent = fixed(
          dischargeFactor ?? DISCHARGE_FACTOR_NEW,
          2,
        );
        neuronCells.push({
          index: neuronIndex++,
          memory: neuronCellsOfRow[4],
          signal: neuronCellsOfRow[5],
        });
      }
    }
    tableFor = organism;
  };

  return {
    render(selection, flows, pools) {
      if (selection.kind === "none") {
        container.style.display = "none";
        tableFor = null;
        return;
      }

      container.style.display = "block";

      if (selection.kind === "dead") {
        summary.textContent = `Died at tick ${String(selection.tick)}`;
        for (const {details} of sections) {
          details.style.display = "none";
        }
        table.replaceChildren();
        synapseTable.replaceChildren();
        readingCells = new Map();
        worldCells = [];
        neuronCells = [];
        carriedCells = [];
        tableFor = null;
        return;
      }

      for (const {details} of sections) {
        details.style.display = "";
      }
      const organism = selection.organism;
      const maintenance = maintenanceBreakdown(organism);
      let organelleArea = 0;
      for (const organelle of organism.organelles) {
        organelleArea += bodyAreaOfRadius(organelle.radius);
      }
      const synapses = organism.genome.genes.filter(isSynapseGene).length;
      setText(summary, `Generation ${String(organism.generation)}`);

      setText(genesSection.title, "Genes");
      setText(
        genesSection.body,
        [
          `  cytoplasm radius    ${fixed(organism.cytoplasmRadius)}`,
          `  mitosis threshold   ${fixed(organism.mitosisEnergyThreshold)}`,
          `  child allocation    ${fixed(organism.childAllocationRatio)}`,
          `  lineage hue         ${fixed(organism.lineageHue)}`,
        ].join("\n"),
      );

      setText(bodySection.title, "Body");
      setText(
        bodySection.body,
        [
          `  body radius         ${fixed(organism.bodyRadius)}`,
          `  cytoplasm area      ${fixed(organism.cytoplasmArea)}`,
          `  organelle areas     ${fixed(organelleArea)}`,
          `  buoyant weight      ${buoyantWeightText(organism)}`,
          `  body axis           ${axisText(organism)}`,
          ...thrustLines(organism),
          `  resting depth       ${restingDepthText(organism)}`,
        ].join("\n"),
      );

      setText(mitosisSection.title, "Mitosis");
      setText(
        mitosisSection.body,
        mitosisProgress(organism, roster).join("\n"),
      );

      setText(
        maintenanceSection.title,
        `Maintenance${fixed(maintenance.total, 5)} / tick`,
      );
      setText(
        maintenanceSection.body,
        [
          `  c₀                  ${fixed(maintenance.existence, 5)}`,
          `  cytoplasm           ${fixed(maintenance.cytoplasm, 5)}`,
          `  organelle overheads ${fixed(maintenance.organelleOverheads, 5)}`,
          `  organelle tissue    ${fixed(maintenance.organelleTissue, 5)}`,
          `  synapses            ${fixed(maintenance.synapses, 5)}`,
        ].join("\n"),
      );

      setText(storesSection.title, flows ? "Stores (last tick)" : "Stores");
      setText(
        storesSection.body,
        [
          `  energy ${energyStore(organism)}`,
          flowsOf(flows, "energy"),
          `  food   ${concentration(organism, pools, "food")}`,
          flowsOf(flows, "food"),
          `  O₂     ${concentration(organism, pools, "oxygen")}`,
          flowsOf(flows, "oxygen"),
          `  CO₂    ${concentration(organism, pools, "carbonDioxide")}`,
          flowsOf(flows, "carbonDioxide"),
        ].join("\n"),
      );

      setText(sensesSection.title, "Senses (as the network read them)");
      setText(sensesSection.body, senseLines(organism).join("\n"));

      setText(synapsesSection.title, `Synapses (${String(synapses)})`);
      setText(
        organellesSection.title,
        `Organelles (${String(organism.organelles.length)})`,
      );

      if (tableFor !== organism) {
        rebuildTable(organism);
      }
      fillReadings(flows, organism);
    },
  };
}
